import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Lightbulb, ThumbsUp, MessageCircle, Sparkles, Plus, Loader2, Bookmark, Pencil, Trash2, Flag } from "lucide-react";
import PageHero from "@/components/PageHero";
import Avatar from "@/components/Avatar";
import IdeaModal from "@/components/IdeaModal";
import ReportModal from "@/components/ReportModal";
import { IdeaCardSkeleton, ListSkeleton } from "@/components/Skeleton";
import { ideas as mockIdeas } from "@/data/ideas";
import { fetchIdeas, resonanceIdea, updateIdea, deleteIdea } from "@/lib/ideas";
import { toggleFavorite, getFavoritedIds } from "@/lib/favorites";
import { useAuthStore } from "@/stores/auth";
import type { Idea } from "@/types";

export default function Ideas() {
  const [topic, setTopic] = useState("全部");
  const [sort, setSort] = useState<"最新" | "共鸣">("共鸣");
  const [ideaModalOpen, setIdeaModalOpen] = useState(false);
  const [realIdeas, setRealIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [resonated, setResonated] = useState<Record<string, boolean>>({});
  const [favedIdeas, setFavedIdeas] = useState<Set<string>>(new Set());
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [reportTarget, setReportTarget] = useState<{ id: string; title: string } | null>(null);
  const { user } = useAuthStore();

  const openReport = (idea: Idea) => {
    if (!user) {
      window.dispatchEvent(new CustomEvent("tianji:open-auth"));
      return;
    }
    setReportTarget({ id: idea.id, title: idea.title });
  };

  // 加载真实灵感
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const ideas = await fetchIdeas();
      if (mounted) {
        setRealIdeas(ideas);
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // 加载收藏状态
  useEffect(() => {
    if (!user || realIdeas.length === 0) return;
    getFavoritedIds(realIdeas.map((i) => i.id)).then(setFavedIdeas);
  }, [user, realIdeas]);

  // 真实灵感在前，Mock 在后
  const allIdeas = useMemo(() => {
    const mockIds = new Set(realIdeas.map((i) => i.id));
    return [...realIdeas, ...mockIdeas.filter((i) => !mockIds.has(i.id))];
  }, [realIdeas]);

  const TOPICS = useMemo(
    () => ["全部", ...Array.from(new Set(allIdeas.map((i) => i.topic)))],
    [allIdeas]
  );

  const filtered = useMemo(
    () =>
      allIdeas
        .filter((i) => topic === "全部" || i.topic === topic)
        .sort((a, b) => {
          if (sort === "最新") return b.createdAt < a.createdAt ? 1 : -1;
          return b.resonance - a.resonance;
        }),
    [allIdeas, topic, sort]
  );

  const handleNewIdea = (idea: Idea) => {
    setRealIdeas((prev) => [idea, ...prev]);
  };

  const handleIdeaClick = () => {
    if (!user) {
      window.dispatchEvent(new CustomEvent("tianji:open-auth"));
      return;
    }
    setIdeaModalOpen(true);
  };

  const handleResonance = async (idea: Idea) => {
    if (!user) {
      window.dispatchEvent(new CustomEvent("tianji:open-auth"));
      return;
    }
    if (resonated[idea.id]) return;

    // 本地先 +1
    setResonated((v) => ({ ...v, [idea.id]: true }));
    setRealIdeas((prev) =>
      prev.map((i) => (i.id === idea.id ? { ...i, resonance: i.resonance + 1 } : i))
    );

    // 远程更新
    await resonanceIdea(idea.id);
  };

  const handleFav = async (idea: Idea) => {
    if (!user) {
      window.dispatchEvent(new CustomEvent("tianji:open-auth"));
      return;
    }
    try {
      const fav = await toggleFavorite({
        targetId: idea.id,
        type: "idea",
        title: idea.title,
        excerpt: idea.summary,
        link: `/ideas`,
      });
      setFavedIdeas((prev) => {
        const next = new Set(prev);
        if (fav) next.add(idea.id);
        else next.delete(idea.id);
        return next;
      });
    } catch {
      // 静默
    }
  };

  const startEditIdea = (idea: Idea) => {
    setEditingIdea(idea);
    setEditTitle(idea.title);
    setEditSummary(idea.summary);
  };

  const handleSaveIdea = async () => {
    if (!editingIdea || !editTitle.trim() || !editSummary.trim()) return;
    try {
      await updateIdea(editingIdea.id, { title: editTitle.trim(), summary: editSummary.trim(), tags: editingIdea.tags });
      setRealIdeas((prev) => prev.map((i) => i.id === editingIdea.id ? { ...i, title: editTitle.trim(), summary: editSummary.trim() } : i));
      setEditingIdea(null);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleDeleteIdea = async (idea: Idea) => {
    if (!confirm("确定删除这条灵感？删除后不可恢复。")) return;
    try {
      await deleteIdea(idea.id);
      setRealIdeas((prev) => prev.filter((i) => i.id !== idea.id));
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <>
      <PageHero
        eyebrow="Ideas · 灵感广场"
        title={
          <>
            让思维的<span className="text-star-400">星火</span>，落地成真实作品
          </>
        }
        subtitle="项目创意与研究思路的交流星图。把数学、物理、金融、算法与领域知识做成可展示的作品，让每一个萌芽的念头，都可能长成一个能分享的 Demo。"
      >
        <button onClick={handleIdeaClick} className="btn-gold">
          <Plus size={15} /> 分享灵感
        </button>
      </PageHero>

      <section className="container-tj py-12">
        {/* 主题筛选 */}
        <div className="mb-10 flex flex-wrap items-center gap-2">
          {TOPICS.map((t) => (
            <button
              key={t}
              onClick={() => setTopic(t)}
              className={`rounded-full border px-3.5 py-1.5 text-xs transition-all ${
                topic === t
                  ? "border-star-400/60 bg-star-400/15 text-star-200"
                  : "border-void-600/50 bg-void-800/40 text-mist-300 hover:border-mist-400/40"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* 排序 */}
        <div className="mb-6 flex items-center justify-end gap-2">
          <span className="text-xs text-mist-500">排序：</span>
          {(["共鸣", "最新"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                sort === s
                  ? "border-star-400/60 bg-star-400/15 text-star-200"
                  : "border-void-600/50 bg-void-800/40 text-mist-300 hover:border-mist-400/40"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* 加载状态 */}
        {loading && (
          <div className="flex items-center justify-center py-20 text-mist-400">
            <Loader2 size={20} className="mr-2 animate-spin" /> 加载灵感中…
          </div>
        )}

        {/* 星图陈列：交错网格 + 装饰连线 */}
        {!loading && (
          <div className="relative">
            {/* 背景星座连线 */}
            <svg
              className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block"
              aria-hidden
            >
              <defs>
                <linearGradient id="ideaLine" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#7cc4ff" stopOpacity="0" />
                  <stop offset="50%" stopColor="#f3c969" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#7cc4ff" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[
                [15, 18, 55, 42],
                [55, 42, 85, 12],
                [30, 68, 70, 78],
              ].map(([x1, y1, x2, y2], i) => (
                <line
                  key={i}
                  x1={`${x1}%`}
                  y1={`${y1}%`}
                  x2={`${x2}%`}
                  y2={`${y2}%`}
                  stroke="url(#ideaLine)"
                  strokeWidth="1"
                  strokeDasharray="4 6"
                />
              ))}
            </svg>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((idea, i) => (
                <motion.article
                  key={idea.id}
                  initial={{ opacity: 0, y: 24, scale: 0.97 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.5, delay: (i % 3) * 0.1 }}
                  className={`group relative flex flex-col rounded-xl border border-void-600/40 bg-void-800/40 p-6 backdrop-blur-sm transition-all duration-300 hover:border-star-400/40 hover:bg-void-700/40 ${
                    i % 3 === 1 ? "xl:translate-y-8" : ""
                  }`}
                >
                  {/* 星点装饰 */}
                  <Sparkles
                    size={14}
                    className="absolute right-5 top-5 text-star-400/30 transition-colors group-hover:text-star-400/70"
                    strokeWidth={1.5}
                  />
                  {user?.uid === idea.authorUid && (
                    <div className="absolute right-5 top-12 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => startEditIdea(idea)}
                        className="rounded-md p-1 text-mist-400 hover:bg-void-700/60 hover:text-tian-300"
                        title="编辑灵感"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteIdea(idea)}
                        className="rounded-md p-1 text-mist-400 hover:bg-void-700/60 hover:text-red-300"
                        title="删除灵感"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-star-400/30 bg-star-400/10 text-star-300">
                      <Lightbulb size={17} />
                    </span>
                    <span className="pill-blue">{idea.topic}</span>
                  </div>

                  <h3 className="mt-4 heading-display text-lg leading-snug text-parchment-50 transition-colors group-hover:text-star-200">
                    {idea.title}
                  </h3>
                  <p className="mt-2.5 flex-1 text-sm leading-relaxed text-mist-300">
                    {idea.summary}
                  </p>

                  <div className="mt-5 flex items-center justify-between border-t border-void-600/30 pt-4">
                    <div className="flex items-center gap-2">
                      <Avatar name={idea.author} color={idea.avatarColor} size={24} />
                      {idea.authorUid ? (
                        <Link to={`/user/${idea.authorUid}`} className="text-xs text-mist-300 transition-colors hover:text-star-300" onClick={(e) => e.stopPropagation()}>
                          {idea.author}
                        </Link>
                      ) : (
                        <span className="text-xs text-mist-300">{idea.author}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-mist-400">
                      <button
                        onClick={() => handleResonance(idea)}
                        className={`flex items-center gap-1 transition-colors hover:text-star-300 ${
                          resonated[idea.id] ? "text-star-300" : ""
                        }`}
                        title="共鸣"
                      >
                        <ThumbsUp
                          size={12}
                          className={resonated[idea.id] ? "fill-star-400" : ""}
                        />{" "}
                        {idea.resonance}
                      </button>
                      <button
                        onClick={() => handleFav(idea)}
                        className={`flex items-center gap-1 transition-colors hover:text-star-300 ${
                          favedIdeas.has(idea.id) ? "text-star-300" : ""
                        }`}
                        title="收藏"
                      >
                        <Bookmark
                          size={12}
                          className={favedIdeas.has(idea.id) ? "fill-star-400" : ""}
                        />
                      </button>
                      {user?.uid !== idea.authorUid && (
                        <button
                          onClick={() => openReport(idea)}
                          className="flex items-center gap-1 text-mist-400 transition-colors hover:text-red-300"
                          title="举报"
                        >
                          <Flag size={12} />
                        </button>
                      )}
                      <span className="flex items-center gap-1">
                        <MessageCircle size={12} /> {idea.replies}
                      </span>
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        )}
      </section>

      <IdeaModal
        open={ideaModalOpen}
        onClose={() => setIdeaModalOpen(false)}
        onCreated={handleNewIdea}
      />

      {/* 编辑灵感弹窗 */}
      {editingIdea && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-void-950/70 backdrop-blur-sm" onClick={() => setEditingIdea(null)}>
          <div className="w-full max-w-lg rounded-2xl border border-void-600/50 bg-void-900/90 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 heading-display text-lg text-parchment-50">编辑灵感</h3>
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="mb-3 w-full rounded-lg border border-void-600/50 bg-void-950/50 px-3 py-2.5 text-sm text-parchment-100 focus:border-star-400/50 focus:outline-none"
              placeholder="标题"
            />
            <textarea
              rows={5}
              value={editSummary}
              onChange={(e) => setEditSummary(e.target.value)}
              className="w-full resize-none rounded-lg border border-void-600/50 bg-void-950/50 p-3 text-sm text-parchment-100 focus:border-star-400/50 focus:outline-none"
              placeholder="灵感内容"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setEditingIdea(null)} className="btn-ghost text-sm">取消</button>
              <button onClick={handleSaveIdea} className="btn-gold text-sm">保存</button>
            </div>
          </div>
        </div>
      )}

      <ReportModal
        open={!!reportTarget}
        onClose={() => setReportTarget(null)}
        targetType="idea"
        targetId={reportTarget?.id ?? ""}
        targetTitle={reportTarget?.title ?? ""}
      />
    </>
  );
}
