import { useMemo, useState, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { Plus, Search, Megaphone, X, AlertCircle, RefreshCw } from "lucide-react";
import PostModal from "@/components/PostModal";
import EmptyState from "@/components/EmptyState";
import WelcomeBanner from "@/components/WelcomeBanner";
import DiscussionSidebar from "@/components/DiscussionSidebar";
import { PostCardSkeleton, ListSkeleton } from "@/components/Skeleton";
import Avatar from "@/components/Avatar";

import {
  fetchPosts,
  fetchFollowingPosts,
  type CasualSubCategory,
  CASUAL_SUB_CATEGORIES,
} from "@/lib/posts";
import type { PostsResult } from "@/lib/posts";
import { fetchActiveAnnouncements, type Announcement } from "@/lib/announcements";
import { fetchHotTags } from "@/lib/tags";
import { formatShortTime, formatCount } from "@/lib/format";
import { useSEO, websiteJsonLd } from "@/hooks/useSEO";
import { useAuthStore } from "@/stores/auth";
import { dispatchAuthWithIntent } from "@/lib/pending-action";
import type { Question } from "@/types";

type SortKey = "最新" | "热度";

const SORT_KEYS: SortKey[] = ["最新", "热度"];

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
type Section = "academic" | "casual" | "following";

/** 闲聊区子分类 emoji */
const SUB_CATEGORY_EMOJI: Record<string, string> = {
  灌水: "💧",
  动态: "📡",
  新闻: "📰",
  其他: "💬",
};

/** 常用标签 emoji 映射 */
const TAG_EMOJI: Record<string, string> = {
  人工智能: "🧠",
  深度学习: "🤖",
  机器学习: "📊",
  数学: "📐",
  物理: "⚛️",
  化学: "🧪",
  生物: "🧬",
  计算机: "💻",
  编程: "⌨️",
  Python: "🐍",
  工具部署: "🔧",
  工具与部署: "🔧",
  论文: "📄",
  学习: "📚",
  考研: "🎯",
  就业: "💼",
  留学: "✈️",
  问答: "❓",
  综合讨论: "💭",
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

/** 为分类标签生成稳定的纯色（Discourse 风格纯色徽标） */
function categoryColor(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h} 65% 45%)`;
}

/** 取最后回复者（Discourse 活动列标志：头像 + 时间） */
function getLastReplier(q: Question) {
  if (!q.answerList?.length) return null;
  return q.answerList.reduce((latest, a) => (a.date > latest.date ? a : latest));
}

export default function Discussion() {
  // #150 首页 SEO + WebSite JSON-LD
  useSEO({
    description:
      "天玑 -- 跨专业 AI 转型者的学习与项目共创社区。在讨论区提问、分享见解，探索 AI 工具实战、编程基础与项目案例。",
    canonical: "https://tianjihub.cn/",
    jsonLd: websiteJsonLd(),
  });
  const [searchParams, setSearchParams] = useSearchParams();

  // 筛选状态由 URL 承载：刷新、分享、后退都能还原
  const rawSection = searchParams.get("section");
  const section: Section =
    rawSection === "casual" ? "casual" : rawSection === "following" ? "following" : "academic";
  const rawCat = searchParams.get("cat") ?? "全部";
  const subFilter: CasualSubCategory | "全部" = (CASUAL_SUB_CATEGORIES as string[]).includes(rawCat)
    ? (rawCat as CasualSubCategory)
    : "全部";
  const activeTag = searchParams.get("tag") ?? "全部";
  const rawSort = searchParams.get("sort") ?? "最新";
  const sort: SortKey = SORT_KEYS.includes(rawSort as SortKey) ? (rawSort as SortKey) : "最新";

  // 关注分区不依赖子分类，cacheKey 单独处理（#149）
  // 标签筛选走后端查询，cacheKey 需包含 activeTag
  const cacheKey = section === "following" ? "following" : `${section}:${subFilter}:${activeTag}`;
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [capturedPrefill, setCapturedPrefill] = useState<{
    title: string;
    body: string;
    tags: string[];
  } | null>(null);
  const [realPosts, setRealPosts] = useState<Question[]>(() => postsCache.get(cacheKey) ?? []);
  const [loading, setLoading] = useState(() => !postsCache.has(cacheKey));
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissedAnn, setDismissedAnn] = useState<Set<string>>(new Set());
  const [hotTags, setHotTags] = useState<string[]>([]);
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = (
    location.state as { prefill?: { title: string; body: string; tags: string[] } } | null
  )?.prefill;

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
      // 标签筛选走后端查询，避免前端只从已加载的 20 条中筛
      const result: PostsResult =
        section === "following"
          ? await fetchFollowingPosts()
          : await fetchPosts(
              section,
              section === "casual" && subFilter !== "全部" ? subFilter : undefined,
              undefined,
              undefined,
              section === "academic" ? activeTag : undefined,
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
    return () => {
      mounted = false;
    };
  }, [section, subFilter, activeTag, cacheKey, reloadKey]);

  // 加载热门标签（学术区排除闲聊区标签，避免"灌水""动态"出现在学术区）
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const tags = await fetchHotTags(20, true);
        if (mounted) setHotTags(tags.map((t) => t.name));
      } catch {
        /* noop */
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

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
        offset,
        undefined,
        section === "academic" ? activeTag : undefined,
      );
      if (!result.error) {
        const next = [...realPosts, ...result.data];
        setRealPosts(next);
        postsCache.set(cacheKey, next);
        setHasMore(result.hasMore);
      }
    } catch {
      /* noop */
    }
    setLoadingMore(false);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await fetchActiveAnnouncements();
        if (mounted) setAnnouncements(list);
      } catch {
        /* noop */
      }
    })();
    return () => {
      mounted = false;
    };
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

  const filtered = useMemo(() => {
    // 标签筛选已走后端查询，前端只做排序
    const list = [...allQuestions].sort((a, b) => {
      if (sort === "热度") return b.views - a.views;
      return b.createdAt < a.createdAt ? -1 : 1;
    });
    return list;
  }, [allQuestions, sort]);

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
  const categoryOptions =
    section === "academic"
      ? ["全部"]
      : (["全部", ...CASUAL_SUB_CATEGORIES] as (CasualSubCategory | "全部")[]);
  const activeCategory = section === "academic" ? "全部" : subFilter;
  const setActiveCategory = (v: string) => updateFilters({ cat: v, tag: "全部" });

  return (
    <div className="forum-light min-h-screen bg-void-950 text-parchment-100">
      {/* 主体：左侧 Discourse 风导航 + 右侧整块讨论区 */}
      <section className="container-tj flex gap-6 py-6 lg:items-start">
        {/* 左侧导航栏 */}
        <DiscussionSidebar
          section={section}
          onSectionChange={(s) =>
            updateFilters({ section: s, cat: "全部", tag: "全部", sort: "最新" })
          }
          activeTag={activeTag}
          onTagChange={(t) => updateFilters({ tag: t })}
          hotTags={hotTags}
        />

        {/* 右侧主讨论区 */}
        <div className="min-w-0 flex-1">
          {/* 顶部条：标题 + 发起讨论 */}
          <div className="mb-3 flex items-center justify-between pb-3">
            <h1 className="text-lg font-semibold text-parchment-50">
              {section === "academic" ? "学术区" : section === "casual" ? "闲聊区" : "关注"}
            </h1>
            <button
              onClick={handlePostClick}
              className="inline-flex items-center gap-1.5 rounded-md bg-tian-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-tian-600"
            >
              <Plus size={15} /> 发起讨论
            </button>
          </div>

          {/* 子导航：Discourse 风最新/热门/未读切换 */}
          <div className="mb-4 flex items-center gap-1 border-b border-void-600/40 pb-2">
            {(["最新", "热门", "未读"] as const).map((v) => {
              const active =
                sort === "最新" && v === "最新" ? true : sort === "热度" && v === "热门";
              return (
                <button
                  key={v}
                  onClick={() =>
                    v !== "未读" && updateFilters({ sort: v === "热门" ? "热度" : "最新" })
                  }
                  className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                    active
                      ? "font-medium text-parchment-100"
                      : "text-mist-500 hover:bg-void-700/50 hover:text-parchment-100"
                  }`}
                >
                  {v}
                </button>
              );
            })}
          </div>

          {/* 新访客欢迎横幅 */}
          <WelcomeBanner />

          {/* 公告栏 */}
          {announcements.filter((a) => !dismissedAnn.has(a.id)).length > 0 && (
            <div className="mb-4 space-y-2">
              {announcements
                .filter((a) => !dismissedAnn.has(a.id))
                .map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start gap-3 rounded-md border border-tian-400/20 bg-tian-400/5 px-3 py-2 text-sm"
                  >
                    <Megaphone size={14} className="mt-0.5 shrink-0 text-tian-300" />
                    <div className="min-w-0 flex-1">
                      <span className="text-tian-200">{a.title}</span>
                      <p className="mt-0.5 text-mist-400">{a.content}</p>
                    </div>
                    <button
                      onClick={() => setDismissedAnn((prev) => new Set(prev).add(a.id))}
                      className="shrink-0 text-mist-500 hover:text-mist-300"
                      aria-label="关闭"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
            </div>
          )}

          {/* 闲聊区子分类筛选条（仅闲聊区） */}
          {section === "casual" && (
            <div className="mb-4 flex items-center gap-1 text-xs">
              {categoryOptions.map((c) => (
                <button
                  key={c}
                  onClick={() => setActiveCategory(c)}
                  className={`rounded-md px-2.5 py-1.5 transition-colors ${
                    activeCategory === c
                      ? "bg-tian-500/10 font-medium text-tian-500"
                      : "text-mist-500 hover:bg-void-700/50 hover:text-parchment-100"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

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
              actionText={
                section === "following"
                  ? user
                    ? "去学术区看看"
                    : "登录"
                  : user
                    ? "发起讨论"
                    : "登录后发起讨论"
              }
              onAction={
                section === "following"
                  ? () =>
                      user
                        ? updateFilters({
                            section: "academic",
                            cat: "全部",
                            tag: "全部",
                            sort: "最新",
                          })
                        : handlePostClick()
                  : handlePostClick
              }
            />
          )}

          {/* 帖子列表 - Discourse 风格：无边框行流，行间细线分隔 */}
          {!loading && !error && filtered.length > 0 && (
            <div className="bg-void-900/40">
              {/* 表头 */}
              <div className="grid grid-cols-[minmax(0,1fr)_64px_56px_56px_64px] items-center gap-2 border-b border-void-600/40 px-4 py-2 text-xs font-medium text-mist-500">
                <span>话题</span>
                <span className="text-center">参与者</span>
                <span className="text-center">回复</span>
                <span className="text-center">浏览量</span>
                <span className="text-center">活动</span>
              </div>
              {filtered.map((q, i) => {
                const lastActivity = getLastActivity(q);
                const replier = getLastReplier(q);
                const catBadge = getCategoryBadge(q);
                const catLabel = catBadge?.label;
                const extraTags =
                  q.category === "casual" && q.subCategory
                    ? q.tags
                    : q.tags.slice(catBadge ? 1 : 0);
                return (
                  <div
                    key={q.id}
                    onClick={() => navigate(`/discussion/${q.id}`)}
                    className={`group grid cursor-pointer grid-cols-[minmax(0,1fr)_64px_56px_56px_64px] items-center gap-2 px-4 py-3 transition-colors hover:bg-void-700/50 ${
                      i !== 0 ? "border-t border-void-600/40" : ""
                    }`}
                  >
                    {/* 主题列 */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {q.pinned && (
                          <span className="shrink-0 text-sm text-mist-400" title="置顶">
                            📌
                          </span>
                        )}
                        {q.locked && (
                          <span className="shrink-0 text-sm text-mist-400" title="锁定">
                            🔒
                          </span>
                        )}
                        {q.featured && !q.pinned && (
                          <span className="shrink-0 text-sm text-star-400" title="加精">
                            ⭐
                          </span>
                        )}
                        <h3 className="truncate text-[15px] font-medium leading-snug text-parchment-100 transition-colors group-hover:text-tian-500">
                          {q.title}
                        </h3>
                        {q.bounty ? (
                          <span className="shrink-0 rounded bg-star-400/10 px-1.5 py-0.5 text-xs font-medium text-star-300">
                            💰 {q.bounty}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                        {catLabel && (
                          <span
                            className="discourse-cat"
                            style={{ backgroundColor: categoryColor(catLabel) }}
                          >
                            {catLabel}
                          </span>
                        )}
                        {extraTags.slice(0, 2).map((t) => (
                          <span
                            key={t}
                            className="rounded bg-void-700/60 px-1.5 py-0.5 text-mist-400"
                          >
                            {t}
                          </span>
                        ))}
                        <span className="mx-0.5 text-void-600">·</span>
                        <span className="text-mist-500">{q.author}</span>
                      </div>
                    </div>

                    {/* 头像列：发起人 + 最后回复者 并排（Discourse featuredUsers 风格） */}
                    <div className="flex items-center justify-center gap-1">
                      <Avatar name={q.author} color={q.avatarColor} size={22} />
                      {replier && (
                        <Avatar name={replier.author} color={replier.avatarColor} size={22} />
                      )}
                    </div>

                    {/* 回复数 */}
                    <span
                      className={`text-center text-sm font-semibold ${q.answers > 0 ? "text-parchment-100" : "text-mist-400"}`}
                    >
                      {formatCount(q.answers)}
                    </span>

                    {/* 浏览数 */}
                    <span className="text-center text-sm text-mist-400">
                      {formatCount(q.views)}
                    </span>

                    {/* 活动时间 */}
                    <span className="shrink-0 text-center text-xs text-mist-500">
                      {formatShortTime(lastActivity)}
                    </span>
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
    </div>
  );
}
