import { useMemo, useState, useEffect } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { Plus, GraduationCap, Coffee, Search, Megaphone, X, AlertCircle, RefreshCw } from "lucide-react";
import PostModal from "@/components/PostModal";
import EmptyState from "@/components/EmptyState";
import WelcomeBanner from "@/components/WelcomeBanner";
import DiscussionSidebar from "@/components/DiscussionSidebar";
import Avatar from "@/components/Avatar";
import { PostCardSkeleton, ListSkeleton } from "@/components/Skeleton";

import { fetchPosts, type PostCategory, type CasualSubCategory, CASUAL_SUB_CATEGORIES } from "@/lib/posts";
import type { PostsResult } from "@/lib/posts";
import { fetchActiveAnnouncements, type Announcement } from "@/lib/announcements";
import { PRESET_TAGS } from "@/lib/tags";
import { formatRelativeTime } from "@/lib/format";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useAuthStore } from "@/stores/auth";
import { dispatchAuthWithIntent } from "@/lib/pending-action";
import type { Question } from "@/types";

type SortKey = "最新" | "热度" | "悬赏";
type CategoryFilter = "全部" | "学科" | "工具与部署";

const SORT_KEYS: SortKey[] = ["最新", "热度", "悬赏"];
const ACADEMIC_CATEGORIES: CategoryFilter[] = ["全部", "学科", "工具与部署"];

/** 筛选参数默认值 —— 等于默认值的参数不写进 URL，保持地址干净 */
const FILTER_DEFAULTS: Record<string, string> = {
  section: "academic",
  cat: "全部",
  tag: "全部",
  sort: "最新",
};

/** 列表内存缓存（按分区+子分类）：后退返回时立即渲染，浏览器才能恢复滚动位置 */
const postsCache = new Map<string, Question[]>();

/** 从帖子中提取最后活动时间：有回答取最新回答时间，否则用创建时间 (#294) */
function getLastActivity(q: Question): string {
  if (q.answerList?.length) {
    return q.answerList.reduce((latest, a) => (a.date > latest ? a.date : latest), q.createdAt);
  }
  return q.createdAt;
}

/** 从帖子中提取参与者（去重，最多 3 个）：作者优先，然后是回答者 (#294) */
function getParticipants(q: Question): { author: string; avatarColor: string }[] {
  const seen = new Set<string>();
  const list: { author: string; avatarColor: string }[] = [];
  if (q.author && !seen.has(q.author)) {
    seen.add(q.author);
    list.push({ author: q.author, avatarColor: q.avatarColor });
  }
  for (const a of q.answerList ?? []) {
    if (a.author && !seen.has(a.author)) {
      seen.add(a.author);
      list.push({ author: a.author, avatarColor: a.avatarColor });
    }
    if (list.length >= 3) break;
  }
  return list;
}

const SECTIONS: { key: PostCategory; label: string; icon: typeof GraduationCap }[] = [
  { key: "academic", label: "学术区", icon: GraduationCap },
  { key: "casual", label: "闲聊区", icon: Coffee },
];

export default function Discussion() {
  useDocumentTitle();
  const [searchParams, setSearchParams] = useSearchParams();

  // 筛选状态由 URL 承载：刷新、分享、后退都能还原
  const section: PostCategory = searchParams.get("section") === "casual" ? "casual" : "academic";
  const rawCat = searchParams.get("cat") ?? "全部";
  const categoryFilter: CategoryFilter = ACADEMIC_CATEGORIES.includes(rawCat as CategoryFilter)
    ? (rawCat as CategoryFilter)
    : "全部";
  const subFilter: CasualSubCategory | "全部" = (CASUAL_SUB_CATEGORIES as string[]).includes(rawCat)
    ? (rawCat as CasualSubCategory)
    : "全部";
  const activeTag = searchParams.get("tag") ?? "全部";
  const rawSort = searchParams.get("sort") ?? "最新";
  const sort: SortKey = SORT_KEYS.includes(rawSort as SortKey) ? (rawSort as SortKey) : "最新";

  const cacheKey = `${section}:${subFilter}`;
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [capturedPrefill, setCapturedPrefill] = useState<{ title: string; body: string; tags: string[] } | null>(null);
  const [realPosts, setRealPosts] = useState<Question[]>(() => postsCache.get(cacheKey) ?? []);
  const [loading, setLoading] = useState(() => !postsCache.has(cacheKey));
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissedAnn, setDismissedAnn] = useState<Set<string>>(new Set());
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = (location.state as { prefill?: { title: string; body: string; tags: string[] } } | null)?.prefill;

  /** 更新 URL 中的筛选参数；等于默认值的参数从 URL 移除 */
  const updateFilters = (updates: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (value === FILTER_DEFAULTS[key]) next.delete(key);
      else next.set(key, value);
    }
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    let mounted = true;
    const cached = postsCache.get(cacheKey);
    if (cached) {
      // 有缓存先呈现，再后台静默刷新
      setRealPosts(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    (async () => {
      const result: PostsResult = await fetchPosts(
        section,
        section === "casual" && subFilter !== "全部" ? subFilter : undefined
      );
      if (!mounted) return;
      if (result.error) {
        if (!cached) {
          setError(result.error);
          setRealPosts([]);
        }
      } else {
        postsCache.set(cacheKey, result.data);
        setRealPosts(result.data);
      }
      setHasMore(result.hasMore);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [section, subFilter, cacheKey, reloadKey]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const offset = realPosts.length;
      const result = await fetchPosts(
        section,
        section === "casual" && subFilter !== "全部" ? subFilter : undefined,
        offset
      );
      if (!result.error) {
        const next = [...realPosts, ...result.data];
        setRealPosts(next);
        postsCache.set(cacheKey, next);
        setHasMore(result.hasMore);
      }
    } catch { /* noop */ }
    setLoadingMore(false);
  };

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
    const next = [post, ...realPosts];
    postsCache.set(cacheKey, next);
    setRealPosts(next);
  };

  const handlePostClick = () => {
    if (!user) {
      dispatchAuthWithIntent("create-post");
      return;
    }
    setPostModalOpen(true);
  };

  // 分类筛选选项
  const categoryOptions = section === "academic"
    ? ACADEMIC_CATEGORIES
    : (["全部", ...CASUAL_SUB_CATEGORIES] as (CasualSubCategory | "全部")[]);
  const activeCategory = section === "academic" ? categoryFilter : subFilter;
  const setActiveCategory = (v: string) => updateFilters({ cat: v, tag: "全部" });

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
                    onClick={() => updateFilters({ section: s.key, cat: "全部", tag: "全部", sort: "最新" })}
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

      {/* 主体：列表 + 桌面端右侧栏。主列表加宽为视觉主角，右侧栏收窄 (#292) */}
      <section className="container-tj grid gap-8 py-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="min-w-0">
        {/* 新访客欢迎横幅 */}
        <WelcomeBanner />

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
              <button onClick={() => updateFilters({ tag: "全部" })} className={`rounded px-2 py-1 transition-colors ${activeTag === "全部" ? "text-parchment-100" : ""}`}>
                全部
              </button>
              {ALL_TAGS.map((t) => (
                <button key={t} onClick={() => updateFilters({ tag: t })} className={`rounded px-2 py-1 transition-colors ${activeTag === t ? "text-parchment-100" : "hover:text-mist-300"}`}>
                  {t}
                </button>
              ))}
            </div>
          )}

          {/* 右侧排序 */}
          <div className="ml-auto flex items-center gap-2">
            {SORT_KEYS.map((s) => (
              <button
                key={s}
                onClick={() => updateFilters({ sort: s })}
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
              onClick={() => setReloadKey((k) => k + 1)}
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

        {/* 帖子列表 - 论坛 topic table 风格：标题+元信息 | 参与者 | 回复 | 浏览 | 活动时间 (#294) */}
        {!loading && !error && filtered.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-void-600/40 bg-void-800">
            {/* 表头 - 桌面端可见 */}
            <div className="hidden lg:grid grid-cols-[minmax(0,1fr)_120px_56px_64px_88px] items-center gap-3 border-b border-void-600/40 px-5 py-2.5 text-xs font-medium text-mist-500">
              <span>主题</span>
              <span className="text-right">参与者</span>
              <span className="text-right">回复</span>
              <span className="text-right">浏览</span>
              <span className="text-right">活动</span>
            </div>
            {filtered.map((q, i) => {
              const participants = getParticipants(q);
              const lastActivity = getLastActivity(q);
              return (
                <div
                  key={q.id}
                  onClick={() => navigate(`/discussion/${q.id}`)}
                  className={`group grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 transition-colors hover:bg-void-700/50 lg:grid-cols-[minmax(0,1fr)_120px_56px_64px_88px] ${
                    i !== 0 ? "border-t border-void-600/30" : ""
                  }`}
                >
                  {/* 主题列：标题 + 标签/作者/悬赏 */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {q.pinned && <span className="shrink-0 text-xs text-star-300" title="置顶">📌</span>}
                      <h3 className="truncate text-[17px] font-semibold leading-snug text-parchment-100 transition-colors group-hover:text-star-400">
                        {q.title}
                      </h3>
                      {q.bounty && (
                        <span className="shrink-0 rounded bg-star-400/10 px-2 py-0.5 text-xs font-medium text-star-300">
                          {q.bounty}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-mist-500">
                      {q.tags.slice(0, 3).map((t) => (
                        <Link key={t} to={`/tags/${encodeURIComponent(t)}`} onClick={(e) => e.stopPropagation()} className="transition-colors hover:text-mist-300">
                          {t}
                        </Link>
                      ))}
                      <span className="text-mist-600">&middot;</span>
                      <span>{q.author}</span>
                    </div>
                  </div>

                  {/* 参与者头像 - 桌面端 */}
                  <div className="hidden items-center justify-end lg:flex">
                    {participants.map((p, idx) => (
                      <span key={`${p.author}-${idx}`} className="-ml-1.5 first:ml-0" style={{ zIndex: 3 - idx }}>
                        <Avatar name={p.author} color={p.avatarColor} size={26} />
                      </span>
                    ))}
                  </div>

                  {/* 回复数 - 始终可见 */}
                  <div className="text-right">
                    <span className="text-[15px] font-semibold text-parchment-100">{q.answers}</span>
                  </div>

                  {/* 浏览数 - 桌面端 */}
                  <div className="hidden text-right text-sm text-mist-400 lg:block">{q.views}</div>

                  {/* 活动时间 - 桌面端 */}
                  <div className="hidden text-right text-sm text-mist-500 lg:block">{formatRelativeTime(lastActivity)}</div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && !error && hasMore && filtered.length > 0 && (
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="mt-4 w-full rounded-lg border border-void-600/20 py-2.5 text-sm text-mist-400 transition-colors hover:bg-void-800/30 disabled:opacity-50"
          >
            {loadingMore ? "加载中…" : "加载更多"}
          </button>
        )}
        </div>

        <DiscussionSidebar />
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
