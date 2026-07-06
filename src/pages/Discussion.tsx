import { useMemo, useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Plus, GraduationCap, Coffee, Search, Megaphone, X, AlertCircle, RefreshCw } from "lucide-react";
import PostModal from "@/components/PostModal";
import EmptyState from "@/components/EmptyState";
import { PostCardSkeleton, ListSkeleton } from "@/components/Skeleton";

import { fetchPosts, type PostCategory, type CasualSubCategory, CASUAL_SUB_CATEGORIES } from "@/lib/posts";
import type { PostsResult } from "@/lib/posts";
import { fetchActiveAnnouncements, type Announcement } from "@/lib/announcements";
import { PRESET_TAGS } from "@/lib/tags";
import { useAuthStore } from "@/stores/auth";
import type { Question } from "@/types";

type SortKey = "最新" | "热度" | "悬赏";
type CategoryFilter = "全部" | "学科" | "工具与部署";

const SECTIONS: { key: PostCategory; label: string; icon: typeof GraduationCap }[] = [
  { key: "academic", label: "学术区", icon: GraduationCap },
  { key: "casual", label: "闲聊区", icon: Coffee },
];

export default function Discussion() {
  const [section, setSection] = useState<PostCategory>("academic");
  const [activeTag, setActiveTag] = useState<string>("全部");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("全部");
  const [subFilter, setSubFilter] = useState<CasualSubCategory | "全部">("全部");
  const [sort, setSort] = useState<SortKey>("最新");
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [capturedPrefill, setCapturedPrefill] = useState<{ title: string; body: string; tags: string[] } | null>(null);
  const [realPosts, setRealPosts] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissedAnn, setDismissedAnn] = useState<Set<string>>(new Set());
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = (location.state as { prefill?: { title: string; body: string; tags: string[] } } | null)?.prefill;

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      const result: PostsResult = await fetchPosts(
        section,
        section === "casual" && subFilter !== "全部" ? subFilter : undefined
      );
      if (mounted) {
        if (result.error) {
          setError(result.error);
        } else {
          setError(null);
        }
        setRealPosts(result.data);
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [section, subFilter]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await fetchActiveAnnouncements();
        if (mounted) setAnnouncements(list);
      } catch { /* noop */ }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (prefill) {
      setCapturedPrefill(prefill);
      setPostModalOpen(true);
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  const allQuestions = realPosts;

  const ALL_TAGS = useMemo(
    () => Array.from(new Set(allQuestions.flatMap((q) => q.tags))),
    [allQuestions]
  );

  const filtered = useMemo(() => {
    let list = allQuestions.filter((q) => {
      if (section === "academic") {
        if (categoryFilter === "学科" && !q.tags.some((t) => PRESET_TAGS.subject.includes(t))) return false;
        if (categoryFilter === "工具与部署" && !q.tags.some((t) => PRESET_TAGS.tool.includes(t))) return false;
        if (activeTag !== "全部" && !q.tags.includes(activeTag)) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === "热度") return b.views - a.views;
      if (sort === "悬赏") return (b.bounty ?? 0) - (a.bounty ?? 0);
      return b.createdAt < a.createdAt ? -1 : 1;
    });
    return list;
  }, [allQuestions, activeTag, categoryFilter, sort, section]);

  const handleNewPost = (post: Question) => {
    if (post.category !== section) return;
    setRealPosts((prev) => [post, ...prev]);
  };

  const handlePostClick = () => {
    if (!user) {
      window.dispatchEvent(new CustomEvent("tianji:open-auth"));
      return;
    }
    setPostModalOpen(true);
  };

  // 分类筛选选项
  const categoryOptions = section === "academic"
    ? (["全部", "学科", "工具与部署"] as CategoryFilter[])
    : (["全部", ...CASUAL_SUB_CATEGORIES] as (CasualSubCategory | "全部")[]);
  const activeCategory = section === "academic" ? categoryFilter : subFilter;
  const setActiveCategory = (v: string) => {
    if (section === "academic") { setCategoryFilter(v as CategoryFilter); }
    else { setSubFilter(v as CasualSubCategory | "全部"); }
    setActiveTag("全部");
  };

  return (
    <>
      {/* 顶部工具栏：标题 + 操作 */}
      <div className="border-b border-void-600/30 bg-void-900/20">
        <div className="container-tj flex h-12 items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-medium text-parchment-100">学问讨论</h1>
            {/* 分区切换：极简文字 tab */}
            <div className="flex items-center gap-1 text-xs">
              {SECTIONS.map((s) => {
                const Icon = s.icon;
                const isActive = section === s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => {
                      setSection(s.key);
                      setSubFilter("全部");
                      setCategoryFilter("全部");
                      setActiveTag("全部");
                      setSort("最新");
                    }}
                    className={`inline-flex items-center gap-1 rounded px-2 py-1 transition-colors ${
                      isActive ? "text-parchment-100" : "text-mist-500 hover:text-mist-300"
                    }`}
                  >
                    <Icon size={12} />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
          <button onClick={handlePostClick} className="inline-flex items-center gap-1.5 rounded-md bg-star-400/10 px-3 py-1.5 text-xs font-medium text-star-300 transition-colors hover:bg-star-400/20">
            <Plus size={13} /> 发起讨论
          </button>
        </div>
      </div>

      <section className="container-tj py-6">
        {/* 公告栏 */}
        {announcements.filter((a) => !dismissedAnn.has(a.id)).length > 0 && (
          <div className="mb-4 space-y-2">
            {announcements
              .filter((a) => !dismissedAnn.has(a.id))
              .map((a) => (
                <div key={a.id} className="flex items-start gap-3 rounded-md border border-tian-400/20 bg-tian-400/5 px-3 py-2 text-sm">
                  <Megaphone size={14} className="mt-0.5 shrink-0 text-tian-300" />
                  <div className="min-w-0 flex-1">
                    <span className="text-tian-200">{a.title}</span>
                    <p className="mt-0.5 text-mist-400">{a.content}</p>
                  </div>
                  <button onClick={() => setDismissedAnn((prev) => new Set(prev).add(a.id))} className="shrink-0 text-mist-500 hover:text-mist-300" aria-label="关闭">
                    <X size={12} />
                  </button>
                </div>
              ))}
          </div>
        )}

        {/* 筛选栏：分类 + 标签 + 排序，合并为紧凑单行 */}
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          {/* 分类筛选 */}
          <div className="flex items-center gap-0.5">
            {categoryOptions.map((c) => (
              <button
                key={c}
                onClick={() => setActiveCategory(c)}
                className={`rounded px-2 py-1 transition-colors ${
                  activeCategory === c ? "text-parchment-100" : "text-mist-500 hover:text-mist-300"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {/* 标签筛选（仅学术区 + 选中分类时） */}
          {section === "academic" && categoryFilter !== "全部" && (
            <div className="flex items-center gap-0.5 text-mist-500">
              <span className="mr-1 text-mist-600">|</span>
              <button onClick={() => setActiveTag("全部")} className={`rounded px-2 py-1 transition-colors ${activeTag === "全部" ? "text-parchment-100" : ""}`}>
                全部
              </button>
              {ALL_TAGS.map((t) => (
                <button key={t} onClick={() => setActiveTag(t)} className={`rounded px-2 py-1 transition-colors ${activeTag === t ? "text-parchment-100" : "hover:text-mist-300"}`}>
                  {t}
                </button>
              ))}
            </div>
          )}

          {/* 右侧排序 */}
          <div className="ml-auto flex items-center gap-2">
            {(["最新", "热度", "悬赏"] as SortKey[]).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`rounded px-2 py-1 transition-colors ${
                  sort === s ? "text-parchment-100" : "text-mist-500 hover:text-mist-300"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* 加载骨架 */}
        {loading && (
          <ListSkeleton count={5}>
            <PostCardSkeleton />
          </ListSkeleton>
        )}

        {/* 错误态 */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-red-400/30 bg-red-400/5 px-6 py-20 text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-400/10 text-red-300">
              <AlertCircle size={28} strokeWidth={1.5} />
            </div>
            <h3 className="heading-display text-xl text-parchment-50">讨论加载失败</h3>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-mist-400">
              {error}。请检查网络或稍后重试。
            </p>
            <button
              onClick={() => {
                // 通过更新 state 触发 effect 重新加载
                setRealPosts([]);
                setError(null);
                setLoading(true);
                // 手动重新触发
                (async () => {
                  const result = await fetchPosts(
                    section,
                    section === "casual" && subFilter !== "全部" ? subFilter : undefined
                  );
                  setError(result.error);
                  setRealPosts(result.data);
                  setLoading(false);
                })();
              }}
              className="btn-gold mt-6 inline-flex items-center gap-2 text-sm"
            >
              <RefreshCw size={14} /> 重试
            </button>
          </div>
        )}

        {/* 空状态 */}
        {!loading && !error && filtered.length === 0 && (
          <EmptyState
            icon={<Search size={28} strokeWidth={1.5} />}
            title="这片星域还很安静"
            description={
              section === "academic"
                ? "还没有学术讨论。你可以发起第一个讨论，分享你的问题或见解。"
                : "闲聊区还没有帖子。来聊聊最近的学习动态、有趣新闻，或者灌个水？"
            }
            actionText={user ? "发起讨论" : "登录后发起讨论"}
            onAction={handlePostClick}
          />
        )}

        {/* 帖子列表 - Lobsters/HN 风格：行内分割线，无卡片容器 */}
        {!loading && !error && filtered.length > 0 && (
          <div className="divide-y divide-void-600/20 rounded-lg border border-void-600/20">
            {filtered.map((q) => (
              <div
                key={q.id}
                onClick={() => navigate(`/discussion/${q.id}`)}
                className="group flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-void-800/30"
              >
                {/* 回答数 - Lobsters 式彩色小标签 */}
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-tian-400/10 text-xs font-medium text-tian-300">
                  {q.answers}
                </span>

                {/* 主体 */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-medium text-parchment-100 transition-colors group-hover:text-star-300">
                      {q.title}
                    </h3>
                    {q.bounty && (
                      <span className="shrink-0 rounded bg-star-400/10 px-1.5 py-0.5 text-[10px] font-medium text-star-300">
                        {q.bounty}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-mist-500">
                    {q.tags.slice(0, 3).map((t) => (
                      <Link key={t} to={`/tags/${encodeURIComponent(t)}`} onClick={(e) => e.stopPropagation()} className="transition-colors hover:text-mist-300">
                        {t}
                      </Link>
                    ))}
                    <span className="text-mist-600">&middot;</span>
                    <span>{q.author}</span>
                    <span className="text-mist-600">&middot;</span>
                    <span>{q.createdAt}</span>
                    <span className="text-mist-600">&middot;</span>
                    <span>{q.views} 浏览</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <PostModal
        open={postModalOpen}
        onClose={() => {
          setPostModalOpen(false);
          setCapturedPrefill(null);
        }}
        onCreated={handleNewPost}
        defaultCategory={section}
        prefill={capturedPrefill ?? undefined}
        onPrefillApplied={() => setCapturedPrefill(null)}
      />
    </>
  );
}
