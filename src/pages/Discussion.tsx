import { useMemo, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { MessageCircle, Eye, ThumbsUp, Star, Plus, GraduationCap, Coffee, Search } from "lucide-react";
import PageHero from "@/components/PageHero";
import Avatar from "@/components/Avatar";
import PostModal from "@/components/PostModal";
import EmptyState from "@/components/EmptyState";
import { PostCardSkeleton, ListSkeleton } from "@/components/Skeleton";

import { fetchPosts, type PostCategory, type CasualSubCategory, CASUAL_SUB_CATEGORIES } from "@/lib/posts";
import { PRESET_TAGS } from "@/lib/tags";
import { useAuthStore } from "@/stores/auth";
import type { Question } from "@/types";

type SortKey = "最新" | "热度" | "悬赏";
type CategoryFilter = "全部" | "学科" | "工具与部署";

const SECTIONS: { key: PostCategory; label: string; icon: typeof GraduationCap; desc: string }[] = [
  { key: "academic", label: "学术区", icon: GraduationCap, desc: "课程答疑 · 论文探讨 · 学术辩论" },
  { key: "casual", label: "闲聊区", icon: Coffee, desc: "日常交流 · 行业八卦 · 随心分享" },
];

export default function Discussion() {
  const [section, setSection] = useState<PostCategory>("academic");
  const [activeTag, setActiveTag] = useState<string>("全部");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("全部");
  const [subFilter, setSubFilter] = useState<CasualSubCategory | "全部">("全部");
  const [sort, setSort] = useState<SortKey>("热度");
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [realPosts, setRealPosts] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // 加载真实帖子（按分区筛选）
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const posts = await fetchPosts(
        section,
        section === "casual" && subFilter !== "全部" ? subFilter : undefined
      );
      if (mounted) {
        setRealPosts(posts);
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [section, subFilter]);

  const allQuestions = realPosts;

  const ALL_TAGS = useMemo(
    () => Array.from(new Set(allQuestions.flatMap((q) => q.tags))),
    [allQuestions]
  );

  const filtered = useMemo(() => {
    let list = allQuestions.filter((q) => {
      // 学术区：一级分类筛选
      if (section === "academic") {
        if (categoryFilter === "学科" && !q.tags.some((t) => PRESET_TAGS.subject.includes(t))) return false;
        if (categoryFilter === "工具与部署" && !q.tags.some((t) => PRESET_TAGS.tool.includes(t))) return false;
        // 二级标签筛选
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
      // 未登录时触发登录弹窗（通过全局事件）
      window.dispatchEvent(new CustomEvent("tianji:open-auth"));
      return;
    }
    setPostModalOpen(true);
  };

  return (
    <>
      <PageHero
        eyebrow="Discussion · 学问讨论"
        title={
          <>
            跨专业答疑，打通<span className="text-star-400">从理论到实战</span>
          </>
        }
        subtitle="工具配置、项目落地、跨专业转型……在这里每一个卡点都值得被认真解决。从 PowerShell 报错到论文复现，总有人陪你一步步走通。"
      >
        <button onClick={handlePostClick} className="btn-gold">
          <Plus size={15} /> 发起讨论
        </button>
      </PageHero>

      <section className="container-tj py-12">
        {/* 分区切换 */}
        <div className="mb-6 flex gap-3">
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
                  setSort("热度");
                }}
                className={`flex flex-1 items-center gap-3 rounded-xl border p-4 transition-all ${
                  isActive
                    ? "border-star-400/40 bg-star-400/10"
                    : "border-void-600/40 bg-void-900/30 hover:border-mist-400/30"
                }`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                    isActive ? "bg-star-400/20 text-star-300" : "bg-void-800/50 text-mist-400"
                  }`}
                >
                  <Icon size={20} />
                </span>
                <div className="text-left">
                  <div className={`text-sm font-medium ${isActive ? "text-parchment-100" : "text-mist-300"}`}>
                    {s.label}
                  </div>
                  <div className="text-xs text-mist-500">{s.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* 一级分类筛选 - 学术区：学科/工具；闲聊区：子分类 */}
        {section === "academic" ? (
          <div className="mb-4 flex items-center gap-2">
            {(["全部", "学科", "工具与部署"] as CategoryFilter[]).map((c) => (
              <button
                key={c}
                onClick={() => {
                  setCategoryFilter(c);
                  setActiveTag("全部");
                }}
                className={`rounded-lg border px-4 py-2 text-xs font-medium transition-all ${
                  categoryFilter === c
                    ? "border-star-400/60 bg-star-400/15 text-star-200"
                    : "border-void-600/50 bg-void-800/40 text-mist-400 hover:border-mist-400/40 hover:text-mist-200"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        ) : (
          <div className="mb-4 flex items-center gap-2">
            {(["全部", ...CASUAL_SUB_CATEGORIES] as (CasualSubCategory | "全部")[]).map((c) => (
              <button
                key={c}
                onClick={() => {
                  setSubFilter(c);
                  setActiveTag("全部");
                }}
                className={`rounded-lg border px-4 py-2 text-xs font-medium transition-all ${
                  subFilter === c
                    ? "border-tian-400/50 bg-tian-400/15 text-tian-100"
                    : "border-void-600/50 bg-void-800/40 text-mist-400 hover:border-mist-400/40 hover:text-mist-200"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {/* 标签筛选（仅学术区）+ 排序 */}
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {section === "academic" && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setActiveTag("全部")}
                className={`rounded-full border px-3.5 py-1.5 text-xs transition-all ${
                  activeTag === "全部"
                    ? "border-star-400/60 bg-star-400/15 text-star-200"
                    : "border-void-600/50 bg-void-800/40 text-mist-300 hover:border-mist-400/40"
                }`}
              >
                全部
              </button>
              {ALL_TAGS.map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTag(t)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs transition-all ${
                    activeTag === t
                      ? "border-tian-400/50 bg-tian-400/15 text-tian-100"
                      : "border-void-600/50 bg-void-800/40 text-mist-300 hover:border-mist-400/40"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          <div className={`flex items-center gap-3 text-xs ${section === "academic" ? "" : "lg:ml-auto"}`}>
            <span className="text-mist-500">排序</span>
            {(["最新", "热度", "悬赏"] as SortKey[]).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`transition-colors ${
                  sort === s ? "text-star-300" : "text-mist-500 hover:text-mist-300"
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

        {/* 问题列表 */}
        {!loading && filtered.length === 0 && (
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
        {!loading && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((q, i) => (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: (i % 6) * 0.06 }}
              >
                <div
                  onClick={() => navigate(`/discussion/${q.id}`)}
                  className="group flex cursor-pointer items-start gap-5 rounded-xl border border-void-600/40 bg-void-800/30 p-5 transition-all hover:border-star-400/30 hover:bg-void-700/30"
                >
                  {/* 投票/回答统计列 */}
                  <div className="hidden flex-col items-center gap-3 border-r border-void-600/40 pr-5 text-center sm:flex">
                    <div>
                      <div className="heading-display text-lg text-tian-300">{q.answers}</div>
                      <div className="text-[10px] text-mist-500">回答</div>
                    </div>
                    <div>
                      <div className="text-sm text-mist-300">{q.votes}</div>
                      <div className="text-[10px] text-mist-500">票数</div>
                    </div>
                    <div>
                      <div className="text-sm text-mist-300">
                        {q.views >= 1000 ? `${(q.views / 1000).toFixed(1)}k` : q.views}
                      </div>
                      <div className="text-[10px] text-mist-500">浏览</div>
                    </div>
                  </div>

                  {/* 主体 */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="heading-display text-lg leading-snug text-parchment-50 transition-colors group-hover:text-star-200">
                        {q.title}
                      </h3>
                      {q.bounty && (
                        <span className="pill-gold shrink-0">
                          <Star size={10} className="fill-star-400" /> 悬赏 {q.bounty}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-mist-400">
                      {q.excerpt}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {q.tags.map((t) => (
                        <Link key={t} to={`/tags/${encodeURIComponent(t)}`} className="pill transition-colors hover:border-star-400/40 hover:text-star-200" onClick={(e) => e.stopPropagation()}>
                          {t}
                        </Link>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center gap-3 text-xs text-mist-500">
                      <Avatar name={q.author} color={q.avatarColor} size={20} />
                      <span className="text-mist-300">{q.author}</span>
                      <span>·</span>
                      <span className="font-mono">{q.createdAt}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* 移动端统计提示 */}
        {!loading && (
          <div className="mt-6 flex items-center justify-center gap-6 text-xs text-mist-500 sm:hidden">
            <span className="flex items-center gap-1">
              <MessageCircle size={12} /> 回答数
            </span>
            <span className="flex items-center gap-1">
              <ThumbsUp size={12} /> 票数
            </span>
            <span className="flex items-center gap-1">
              <Eye size={12} /> 浏览
            </span>
          </div>
        )}
      </section>

      <PostModal
        open={postModalOpen}
        onClose={() => setPostModalOpen(false)}
        onCreated={handleNewPost}
        defaultCategory={section}
      />
    </>
  );
}
