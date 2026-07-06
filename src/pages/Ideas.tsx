import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { toast } from "@/stores/toast";
import { Lightbulb, ThumbsUp, MessageCircle, Plus, Loader2, Bookmark, Pencil, Trash2, Flag } from "lucide-react";
import PageHero from "@/components/PageHero";
import Avatar from "@/components/Avatar";
import IdeaModal from "@/components/IdeaModal";
import ReportModal from "@/components/ReportModal";
import EmptyState from "@/components/EmptyState";

import { fetchIdeas, resonanceIdea, updateIdea, deleteIdea } from "@/lib/ideas";
import { toggleFavorite, getFavoritedIds } from "@/lib/favorites";
import { useAuthStore } from "@/stores/auth";
import { isAuthor } from "@/lib/utils";
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
  const ideaIdsKey = realIdeas.map((i) => i.id).join(",");
  useEffect(() => {
    if (!user || !ideaIdsKey) return;
    getFavoritedIds(ideaIdsKey.split(",")).then(setFavedIdeas);
  }, [user, ideaIdsKey]);

  const allIdeas = realIdeas;

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
    try {
      await resonanceIdea(idea.id);
    } catch {
      // 回滚
      setResonated((v) => ({ ...v, [idea.id]: false }));
      setRealIdeas((prev) =>
        prev.map((i) => (i.id === idea.id ? { ...i, resonance: Math.max(0, i.resonance - 1) } : i))
      );
      toast.error("操作失败，请重试");
    }
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
        link: `/ideas/${idea.id}`,
      });
      setFavedIdeas((prev) => {
        const next = new Set(prev);
        if (fav) next.add(idea.id);
        else next.delete(idea.id);
        return next;
      });
      toast.success(fav ? "已收藏" : "已取消收藏");
    } catch {
      toast.error("操作失败，请重试");
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
      toast.success("灵感已更新");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleDeleteIdea = async (idea: Idea) => {
    if (!confirm("确定删除这条灵感？删除后不可恢复。")) return;
    try {
      await deleteIdea(idea.id);
      setRealIdeas((prev) => prev.filter((i) => i.id !== idea.id));
      toast.success("灵感已删除");
    } catch (e) {
      toast.error((e as Error).message);
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

      <section className="container-tj py-8">
        {/* 主题筛选 */}
        <div className="mb-8 flex flex-wrap items-center gap-2">
          {TOPICS.map((t) => (
            <button
              key={t}
              onClick={() => setTopic(t)}
              className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                topic === t
                  ? "border-void-600/50 bg-void-700/50 text-parchment-100"
                  : "border-void-600/30 bg-transparent text-mist-400 hover:text-mist-300"
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
              className={`text-xs transition-colors ${
                sort === s ? "text-parchment-100" : "text-mist-500 hover:text-mist-300"
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

        {/* 空状态 */}
        {!loading && filtered.length === 0 && (
          <EmptyState
            icon={<Lightbulb size={28} strokeWidth={1.5} />}
            title="还没有灵感被点亮"
            description="第一个灵感往往最难也最珍贵。分享你脑海中一闪而过的想法，或许能引发共鸣。"
            actionText={user ? "分享灵感" : "登录后分享灵感"}
            onAction={handleIdeaClick}
          />
        )}

        {/* 灵感卡片网格 */}
        {!loading && filtered.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((idea) => (
              <article
                key={idea.id}
                className="group relative flex flex-col rounded-lg border border-void-600/30 bg-void-800/20 px-5 py-5 transition-colors hover:bg-void-800/40"
              >
                {/* 作者操作 */}
                {isAuthor(user?.uid, idea.authorUid) && (
                  <div className="absolute right-4 top-4 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => startEditIdea(idea)}
                      className="rounded p-1 text-mist-400 hover:bg-void-700/60 hover:text-tian-300"
                      title="编辑灵感"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleDeleteIdea(idea)}
                      className="rounded p-1 text-mist-400 hover:bg-void-700/60 hover:text-red-300"
                      title="删除灵感"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Lightbulb size={14} className="text-star-400/60" />
                  <span className="text-xs text-mist-500">{idea.topic}</span>
                </div>

                <h3 className="mt-3 heading-display text-base leading-snug text-parchment-50 transition-colors group-hover:text-star-300">
                  <Link to={`/ideas/${idea.id}`} className="after:absolute after:inset-0">
                    {idea.title}
                  </Link>
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-mist-400">
                  {idea.summary}
                </p>

                <div className="mt-4 flex items-center justify-between border-t border-void-600/20 pt-3">
                  <div className="flex items-center gap-2">
                    <Avatar name={idea.author} color={idea.avatarColor} size={20} />
                    {idea.authorUid ? (
                      <Link to={`/user/${idea.authorUid}`} className="text-xs text-mist-400 transition-colors hover:text-star-300" onClick={(e) => e.stopPropagation()}>
                        {idea.author}
                      </Link>
                    ) : (
                      <span className="text-xs text-mist-400">{idea.author}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-mist-400">
                    <button
                      onClick={() => handleResonance(idea)}
                      className={`flex items-center gap-1 transition-colors hover:text-star-300 ${
                        resonated[idea.id] ? "text-star-300" : ""
                      }`}
                      title="共鸣"
                    >
                      <ThumbsUp size={12} className={resonated[idea.id] ? "fill-star-400" : ""} />{" "}
                      {idea.resonance}
                    </button>
                    <button
                      onClick={() => handleFav(idea)}
                      className={`transition-colors hover:text-star-300 ${
                        favedIdeas.has(idea.id) ? "text-star-300" : ""
                      }`}
                      title="收藏"
                    >
                      <Bookmark size={12} className={favedIdeas.has(idea.id) ? "fill-star-400" : ""} />
                    </button>
                    {!isAuthor(user?.uid, idea.authorUid) && (
                      <button
                        onClick={() => openReport(idea)}
                        className="transition-colors hover:text-red-300"
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
              </article>
            ))}
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
              name="title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="mb-3 w-full rounded-lg border border-void-600/50 bg-void-950/50 px-3 py-2.5 text-sm text-parchment-100 focus:border-star-400/50 focus:outline-none"
              placeholder="标题"
              maxLength={200}
            />
            <textarea
              name="body"
              rows={5}
              value={editSummary}
              onChange={(e) => setEditSummary(e.target.value)}
              className="w-full resize-none rounded-lg border border-void-600/50 bg-void-950/50 p-3 text-sm text-parchment-100 focus:border-star-400/50 focus:outline-none"
              maxLength={500}
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
