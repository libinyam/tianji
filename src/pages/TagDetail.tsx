import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowLeft, Tag, MessageSquare, Lightbulb, BookOpen, Users, Wrench, GraduationCap } from "lucide-react";
import { fetchContentByTag, fetchTagCount, inferCategory, CATEGORY_LABEL, type TagContentItem } from "@/lib/tags";
import { PostCardSkeleton, BookCardSkeleton, IdeaCardSkeleton, WorkshopCardSkeleton } from "@/components/Skeleton";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useSEO } from "@/hooks/useSEO";

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
  useDocumentTitle(name ? `#${name}` : undefined);
  // #150 动态 SEO
  useSEO({
    title: name ? `#${name}` : undefined,
    description: name ? `查看天玑社区中带「#${name}」标签的所有内容：讨论、灵感、资源、协作工坊。` : undefined,
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

  useEffect(() => {
    if (!name) return;
    let mounted = true;
    setLoading(true);
    Promise.all([fetchContentByTag(name), fetchTagCount(name)]).then(([c, n]) => {
      if (!mounted) return;
      setContent(c);
      setCount(n);
      setLoading(false);
    });
    return () => { mounted = false; };
  }, [name]);

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
        className="mb-6 inline-flex items-center gap-2 text-sm text-mist-400 transition-colors hover:text-star-300"
      >
        <ArrowLeft size={14} /> 返回首页
      </Link>

      {/* 标签头部 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex items-center gap-4"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-star-400/30 bg-star-400/10 text-star-300">
          <Tag size={28} />
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="heading-display text-3xl text-parchment-100">#{name}</h1>
            <span className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${
              inferCategory(name) === "tool"
                ? "border-star-400/40 bg-star-400/10 text-star-300"
                : "border-tian-400/40 bg-tian-400/10 text-tian-300"
            }`}>
              {inferCategory(name) === "tool" ? <Wrench size={9} /> : <GraduationCap size={9} />}
              {CATEGORY_LABEL[inferCategory(name)]}
            </span>
          </div>
          <p className="mt-1 text-sm text-mist-400">
            {loading ? "加载中…" : `${count} 次使用 · ${content.posts.length + content.ideas.length + content.books.length + content.workshops.length} 条内容`}
          </p>
        </div>
      </motion.div>

      {/* Tab 切换 */}
      <div className="mb-6 flex gap-1 border-b border-void-600/40">
        {tabData.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm transition-colors ${
                isActive
                  ? "border-star-400 text-star-300"
                  : "border-transparent text-mist-400 hover:text-mist-200"
              }`}
            >
              <Icon size={14} />
              {tab.label}
              {tab.items.length > 0 && (
                <span className="rounded-full bg-void-700/60 px-1.5 py-0.5 text-[10px] text-mist-400">
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
          {activeTab === "post" && Array.from({ length: 4 }).map((_, i) => <PostCardSkeleton key={i} />)}
          {activeTab === "idea" && Array.from({ length: 4 }).map((_, i) => <IdeaCardSkeleton key={i} />)}
          {activeTab === "book" && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 6 }).map((_, i) => <BookCardSkeleton key={i} />)}
            </div>
          )}
          {activeTab === "workshop" && Array.from({ length: 3 }).map((_, i) => <WorkshopCardSkeleton key={i} />)}
        </div>
      ) : currentItems.length === 0 ? (
        <div className="py-20 text-center text-sm text-mist-500">
          <Icon className="mx-auto mb-3 opacity-30" size={32} />
          暂无{TYPE_LABEL[activeTab]}内容使用此标签
        </div>
      ) : (
        <div className="grid gap-3">
          {currentItems.map((item, i) => {
            const Icon = TYPE_ICON[item.type];
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Link
                  to={item.link}
                  className="group flex items-start gap-3 rounded-xl border border-void-600/40 bg-void-800/30 p-4 transition-colors hover:border-star-400/30 hover:bg-void-800/50"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-void-700/50 text-mist-400">
                    <Icon size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-medium text-parchment-100 group-hover:text-star-200">
                      {item.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs text-mist-500">{item.excerpt}</p>
                    <div className="mt-2 flex items-center gap-2 text-[10px] text-mist-600">
                      <span>{item.author}</span>
                      <span>·</span>
                      <span>{item.createdAt.slice(0, 10)}</span>
                    </div>
                  </div>
                </Link>
              </motion.div>
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
