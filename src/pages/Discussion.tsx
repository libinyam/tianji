import { useMemo, useState, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { Plus, GraduationCap, Coffee, Search, Megaphone, X, AlertCircle, RefreshCw, Heart } from "lucide-react";
import PostModal from "@/components/PostModal";
import EmptyState from "@/components/EmptyState";
import WelcomeBanner from "@/components/WelcomeBanner";
import DiscussionSidebar from "@/components/DiscussionSidebar";
import { PostCardSkeleton, ListSkeleton } from "@/components/Skeleton";

import { fetchPosts, fetchFollowingPosts, type PostCategory, type CasualSubCategory, CASUAL_SUB_CATEGORIES } from "@/lib/posts";
import type { PostsResult } from "@/lib/posts";
import { fetchActiveAnnouncements, type Announcement } from "@/lib/announcements";
import { PRESET_TAGS } from "@/lib/tags";
import { formatShortTime, formatCount } from "@/lib/format";
import { useSEO, websiteJsonLd } from "@/hooks/useSEO";
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

/** 分区类型：在 PostCategory 基础上扩展「关注」分区（个性化 Feed，#149） */
type Section = PostCategory | "following";

const SECTIONS: { key: Section; label: string; icon: typeof GraduationCap }[] = [
  { key: "academic", label: "学术区", icon: GraduationCap },
  { key: "casual", label: "闲聊区", icon: Coffee },
  { key: "following", label: "关注", icon: Heart },
];

/** 闲聊区子分类 emoji */
const SUB_CATEGORY_EMOJI: Record<string, string> = {
  "灌水": "💧",
  "动态": "📡",
  "新闻": "📰",
  "其他": "💬",
};

/** 常用标签 emoji 映射 */
const TAG_EMOJI: Record<string, string> = {
  "人工智能": "🧠",
  "深度学习": "🤖",
  "机器学习": "📊",
  "数学": "📐",
  "物理": "⚛️",
  "化学": "🧪",
  "生物": "🧬",
  "计算机": "💻",
  "编程": "⌨️",
  "Python": "🐍",
  "工具部署": "🔧",
  "工具与部署": "🔧",
  "论文": "📄",
  "学习": "📚",
  "考研": "🎯",
  "就业": "💼",
  "留学": "✈️",
  "问答": "❓",
  "综合讨论": "💭",
};

function getTagEmoji(tag: string): string {
  return TAG_EMOJI[tag] || "🏷️";
}

function getCategoryBadge(q: Question): { emoji: string; label: string } | null {
  if (q.category === "casual" && q.subCategory) {
    return { emoji: SUB_CATEGORY_EMOJI[q.subCategory] || "💬", label: q.subCategory };
  }
  if (q.tags && q.tags.length > 0) {
    return { emoji: getTagEmoji(q.tags[0]), label: q.tags[0] };
  }
  if (q.category === "academic") return { emoji: "🎓", label: "学术" };
  return null;
}

export default function Discussion() {
  // #150 首页 SEO + WebSite JSON-LD
  useSEO({
    description: "天玑 -- 跨专业 AI 转型者的学习与项目共创社区。在讨论区提问、分享见解，探索 AI 工具实战、编程基础与项目案例。",
    canonical: "https://tianjihub.cn/",
    jsonLd: websiteJsonLd(),
  });
  const [searchParams, setSearchParams] = useSearchParams();

  // 筛选状态由 URL 承载：刷新、分享、后退都能还原
  const rawSection = searchParams.get("section");
  const section: Section = rawSection === "casual"
    ? "casual"
    : rawSection === "following"
      ? "following"
      : "academic";
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

  // 关注分区不依赖子分类，cacheKey 单独处理（#149）
  const cacheKey = section === "following" ? "following" : `${section}:${subFilter}`;
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
      // 关注分区走 fetchFollowingPosts，其他分区走 fetchPosts（#149）
      const result: PostsResult = section === "following"
        ? await fetchFollowingPosts()
        : await fetchPosts(
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
    // 关注分区暂不支持分页（#149）
    if (section === "following") return;
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
    // 关注分区不做分类/标签筛选，仅按所选排序展示（#149）
    let list = allQuestions.filter((q) => {
      if (section === "following") return true;
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
    // 关注分区是聚合 Feed，新发的帖子不直接插入列表（#149）
    if (section === "following") return;
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
      {/* 顶部工具栏：标题 + 操作 - 分区 tab 和发起讨论按钮加强可见性 (#294) */}
      <div className="border-b border-void-600/30 bg-void-900/20">
        <div className="container-tj flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-semibold text-parchment-100">学问讨论</h1>
            {/* 分区切换：明显的 pill tab */}
            <div className="flex items-center gap-1">
              {SECTIONS.map((s) => {
                const Icon = s.icon;
                const isActive = section === s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => updateFilters({ section: s.key, cat: "全部", tag: "全部", sort: "最新" })}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-tian-400/15 text-tian-300"
                        : "text-mist-400 hover:bg-void-700/50 hover:text-mist-200"
                    }`}
                  >
                    <Icon size={14} />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
          <button
            onClick={handlePostClick}
            className="inline-flex items-center gap-1.5 rounded-md bg-star-400 px-3.5 py-2 text-sm font-semibold text-void-950 shadow-sm transition-colors hover:bg-star-500"
          >
            <Plus size={15} /> 发起讨论
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

        {/* 筛选栏：分类 + 标签 + 排序，合并为紧凑单行。关注分区仅显示排序（#149） */}
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          {/* 分类筛选 */}
          {section !== "following" && (
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
          )}

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
            title={
              section === "following"
                ? user
                  ? "关注动态为空"
                  : "登录后查看关注动态"
                : "这片星域还很安静"
            }
            description={
              section === "following"
                ? user
                  ? "你还没有关注任何人，或关注的人尚未发帖。去学术区或闲聊区逛逛，关注感兴趣的作者吧。"
                  : "登录后即可关注其他用户，这里会显示他们的最新动态。"
                : section === "academic"
                  ? "还没有学术讨论。你可以发起第一个讨论，分享你的问题或见解。"
                  : "闲聊区还没有帖子。来聊聊最近的学习动态、有趣新闻，或者灌个水？"
            }
            actionText={section === "following" ? (user ? "去学术区看看" : "登录") : (user ? "发起讨论" : "登录后发起讨论")}
            onAction={section === "following"
              ? () => user
                ? updateFilters({ section: "academic", cat: "全部", tag: "全部", sort: "最新" })
                : handlePostClick()
              : handlePostClick}
          />
        )}

        {/* 帖子列表 - Discourse 风格 topic table：无外框圆角，行底部分隔线 (#294) */}
        {!loading && !error && filtered.length > 0 && (
          <div className="bg-void-800">
            {/* 表头 */}
            <div className="grid grid-cols-[minmax(0,1fr)_56px_64px_80px] items-center gap-3 border-b border-void-600/30 px-1 py-2 text-xs text-mist-500 lg:grid-cols-[minmax(0,1fr)_56px_64px_80px]">
              <span>话题</span>
              <span className="text-right">回复</span>
              <span className="text-right">浏览量</span>
              <span className="text-right">活动</span>
            </div>
            {filtered.map((q, i) => {
              const lastActivity = getLastActivity(q);
              const catBadge = getCategoryBadge(q);
              const extraTags = q.category === "casual" && q.subCategory
                ? q.tags
                : q.tags.slice(catBadge ? 1 : 0);
              return (
                <div
                  key={q.id}
                  onClick={() => navigate(`/discussion/${q.id}`)}
                  className={`group cursor-pointer grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-1 py-3 transition-colors hover:bg-void-700/50 lg:grid-cols-[minmax(0,1fr)_56px_64px_80px] ${
                    i !== 0 ? "border-t border-void-600/20" : ""
                  }`}
                >
                  {/* 主题列 */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {q.pinned && <span className="shrink-0 text-sm text-mist-400" title="置顶">📌</span>}
                      {q.locked && <span className="shrink-0 text-sm text-mist-400" title="锁定">🔒</span>}
                      {q.featured && !q.pinned && <span className="shrink-0 text-sm" title="加精">⭐</span>}
                      <h3 className="truncate text-[15px] font-medium leading-snug text-parchment-100 transition-colors group-hover:text-tian-400">
                        {q.title}
                      </h3>
                      {q.bounty ? (
                        <span className="shrink-0 rounded bg-star-400/10 px-1.5 py-0.5 text-xs font-medium text-star-400">
                          💰 {q.bounty}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-xs">
                      {catBadge && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-void-700/70 px-1.5 py-0.5 text-mist-400">
                          <span>{catBadge.emoji}</span>
                          <span>{catBadge.label}</span>
                        </span>
                      )}
                      {extraTags.slice(0, 2).map((t) => (
                        <span key={t} className="inline-flex items-center gap-0.5 rounded bg-void-700/70 px-1.5 py-0.5 text-mist-400">
                          <span>{getTagEmoji(t)}</span>
                          <span>{t}</span>
                        </span>
                      ))}
                      <span className="mx-0.5 text-void-600">·</span>
                      <span className="text-mist-500">{q.author}</span>
                    </div>
                  </div>

                  {/* 回复数 */}
                  <div className="text-right">
                    <span className={`text-[15px] font-semibold ${q.answers > 0 ? "text-star-400" : "text-mist-400"}`}>{formatCount(q.answers)}</span>
                  </div>

                  {/* 浏览数 */}
                  <div className="hidden text-right text-sm text-mist-400 lg:block">{formatCount(q.views)}</div>

                  {/* 活动时间 */}
                  <div className="hidden text-right text-sm text-mist-500 lg:block">{formatShortTime(lastActivity)}</div>
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
        defaultCategory={section === "following" ? "academic" : section}
        prefill={capturedPrefill ?? undefined}
        onPrefillApplied={() => setCapturedPrefill(null)}
      />
    </>
  );
}
