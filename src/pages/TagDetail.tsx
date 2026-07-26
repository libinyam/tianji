import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Tag,
  MessageSquare,
  Lightbulb,
  BookOpen,
  Users,
  Wrench,
  GraduationCap,
} from "lucide-react";
import {
  fetchContentByTag,
  fetchTagCount,
  inferCategory,
  CATEGORY_LABEL,
  type TagContentItem,
} from "@/lib/tags";
import {
  PostCardSkeleton,
  BookCardSkeleton,
  IdeaCardSkeleton,
  WorkshopCardSkeleton,
} from "@/components/Skeleton";
import { useSEO } from "@/hooks/useSEO";
import { toggleTagFollow, isTagFollowing } from "@/lib/follows";
import { rateLimiters } from "@/lib/security";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/stores/toast";
import { Bookmark, Loader2 } from "lucide-react";

const TYPE_ICON = {
  post: MessageSquare,
  idea: Lightbulb,
  book: BookOpen,
  workshop: Users,
};

const TYPE_LABEL = {
  post: "帖子",
  idea: "灵感",
  book: "资源",
  workshop: "协作",
};

export default function TagDetail() {
  const { name = "" } = useParams<{ name: string }>();
  const { user } = useAuthStore();
  // #150 动态 SEO
  useSEO({
    title: name ? `#${name}` : undefined,
    description: name
      ? `查看天玑社区中带「#${name}」标签的所有内容：讨论、灵感、资源、协作工坊。`
      : undefined,
    canonical: name ? `https://tianjihub.cn/tags/${encodeURIComponent(name)}` : undefined,
  });
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<{
    posts: TagContentItem[];
    ideas: TagContentItem[];
    books: TagContentItem[];
    workshops: TagContentItem[];
  }>({ posts: [], ideas: [], books: [], workshops: [] });
  const [count, setCount] = useState(0);
  const [activeTab, setActiveTab] = useState<"post" | "idea" | "book" | "workshop">("post");
  // #149 标签关注
  const [tagFollowing, setTagFollowing] = useState(false);
  const [tagFollowLoading, setTagFollowLoading] = useState(false);

  useEffect(() => {
    if (!name) return;
    let mounted = true;
    setLoading(true);
    Promise.all([fetchContentByTag(name), fetchTagCount(name), isTagFollowing(name)]).then(
      ([c, n, isFollow]) => {
        if (!mounted) return;
        setContent(c);
        setCount(n);
        setTagFollowing(isFollow);
        setLoading(false);
      },
    );
    return () => {
      mounted = false;
    };
  }, [name]);

  // #149 关注 / 取消关注标签
  const handleTagFollow = async () => {
    if (!user) {
      window.dispatchEvent(new CustomEvent("tianji:open-auth"));
      return;
    }
    const rl = rateLimiters.tagFollow.check();
    if (!rl.allowed) {
      toast.error(`操作太快，请等待 ${rl.remaining} 秒`);
      return;
    }
    setTagFollowLoading(true);
    try {
      const newState = await toggleTagFollow(name);
      rateLimiters.tagFollow.record();
      setTagFollowing(newState);
      toast.success(newState ? "已关注标签" : "已取消关注");
    } catch (e) {
      toast.error((e as Error).message || "操作失败");
    } finally {
      setTagFollowLoading(false);
    }
  };

  const tabData = [
    { key: "post" as const, label: TYPE_LABEL.post, icon: MessageSquare, items: content.posts },
    { key: "idea" as const, label: TYPE_LABEL.idea, icon: Lightbulb, items: content.ideas },
    { key: "book" as const, label: TYPE_LABEL.book, icon: BookOpen, items: content.books },
    { key: "workshop" as const, label: TYPE_LABEL.workshop, icon: Users, items: content.workshops },
  ];

  const currentItems = tabData.find((t) => t.key === activeTab)?.items ?? [];

  return (
    <div className="container-tj py-10">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-2 text-sm text-mist-400 transition-colors hover:text-tian-500"
      >
        <ArrowLeft size={14} /> 返回首页
      </Link>

      {/* 标签头部 */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-void-600 bg-void-700 text-mist-400">
            <Tag size={20} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="heading-display text-3xl text-parchment-100">#{name}</h1>
              <span
                className={`flex items-center gap-1 rounded-full border border-void-600 bg-void-700 px-2.5 py-0.5 text-xs font-medium ${
                  inferCategory(name) === "tool" ? "text-mist-400" : "text-tian-500"
                }`}
              >
                {inferCategory(name) === "tool" ? <Wrench size={9} /> : <GraduationCap size={9} />}
                {CATEGORY_LABEL[inferCategory(name)]}
              </span>
            </div>
            <p className="mt-1 text-sm text-mist-400">
              {loading
                ? "加载中…"
                : `${count} 次使用 · ${content.posts.length + content.ideas.length + content.books.length + content.workshops.length} 条内容`}
            </p>
          </div>
        </div>
        {/* #149 关注标签按钮 */}
        {user && (
          <button
            onClick={handleTagFollow}
            disabled={tagFollowLoading}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${
              tagFollowing
                ? "border border-void-600 bg-void-800 text-mist-300 hover:border-red-400 hover:text-red-500"
                : "bg-tian-500 text-white hover:bg-tian-600"
            }`}
          >
            {tagFollowLoading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Bookmark size={12} className={tagFollowing ? "fill-mist-300" : ""} />
            )}
            {tagFollowing ? "已关注" : "关注标签"}
          </button>
        )}
      </div>

      {/* Tab 切换 */}
      <div className="mb-6 flex gap-1 border-b border-void-600">
        {tabData.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors ${
                isActive
                  ? "border-tian-500 text-tian-500"
                  : "border-transparent text-mist-400 hover:text-parchment-100"
              }`}
            >
              <Icon size={14} />
              {tab.label}
              {tab.items.length > 0 && (
                <span className="rounded-full bg-void-700 px-1.5 py-0.5 text-[10px] text-mist-400">
                  {tab.items.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 内容列表 */}
      {loading ? (
        <div className="space-y-3">
          {activeTab === "post" &&
            Array.from({ length: 4 }).map((_, i) => <PostCardSkeleton key={i} />)}
          {activeTab === "idea" &&
            Array.from({ length: 4 }).map((_, i) => <IdeaCardSkeleton key={i} />)}
          {activeTab === "book" && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <BookCardSkeleton key={i} />
              ))}
            </div>
          )}
          {activeTab === "workshop" &&
            Array.from({ length: 3 }).map((_, i) => <WorkshopCardSkeleton key={i} />)}
        </div>
      ) : currentItems.length === 0 ? (
        <div className="py-10 text-center text-sm text-mist-500">
          <Icon className="mx-auto mb-3 opacity-30" size={32} />
          暂无{TYPE_LABEL[activeTab]}内容使用此标签
        </div>
      ) : (
        <div className="divide-y divide-void-600 rounded-lg border border-void-600">
          {currentItems.map((item) => {
            const Icon = TYPE_ICON[item.type];
            return (
              <Link
                key={item.id}
                to={item.link}
                className="group flex items-start gap-3 p-3 transition-colors hover:bg-void-700"
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-void-700 text-mist-400">
                  <Icon size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-medium text-parchment-100 group-hover:text-tian-500">
                    {item.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs text-mist-500">{item.excerpt}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-mist-500">
                    <span>{item.author}</span>
                    <span>·</span>
                    <span>{item.createdAt.slice(0, 10)}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Icon({ className, size }: { className?: string; size?: number }) {
  return <Tag className={className} size={size} />;
}
