import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { toast } from "@/stores/toast";
import { Lightbulb, ThumbsUp, MessageCircle, Plus, Loader2, Bookmark, Pencil, Trash2, Flag } from "lucide-react";
import IdeaModal from "@/components/IdeaModal";
import ReportModal from "@/components/ReportModal";
import EmptyState from "@/components/EmptyState";

import { fetchIdeas, resonanceIdea, updateIdea, deleteIdea } from "@/lib/ideas";
import { toggleFavorite, getFavoritedIds } from "@/lib/favorites";
import { useAuthStore } from "@/stores/auth";
import { isAuthor } from "@/lib/utils";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import type { Idea } from "@/types";

export default function Ideas() {
  useDocumentTitle("灵感广场");
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
      {/* 顶部工具栏 */}
      <div className="border-b border-void-600/30 bg-void-900/20">
        <div className="container-tj flex h-12 items-center justify-between">
          <h1 className="text-sm font-medium text-parchment-100">灵感广场</h1>
          <button onClick={handleIdeaClick} className="inline-flex items-center gap-1.5 rounded-md bg-star-400/10 px-3 py-1.5 text-xs font-medium text-star-300 transition-colors hover:bg-star-400/20">
            <Plus size={13} /> 分享灵感
          </button>
        </div>
      </div>

      <section className="container-tj py-6">
        {/* 筛选栏：主题 + 排序，单行 */}
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <div className="flex items-center gap-0.5">
            {TOPICS.map((t) => (
              <button
                key={t}
                onClick={() => setTopic(t)}
                className={`rounded px-2 py-1 transition-colors ${
                  topic === t ? "text-parchment-100" : "text-mist-500 hover:text-mist-300"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {(["共鸣", "最新"] as const).map((s) => (
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

        {/* 灵感列表 - 行内分割线风格 */}
        {!loading && filtered.length > 0 && (
          <div className="divide-y divide-void-600/20 rounded-lg border border-void-600/20">
            {filtered.map((idea) => (
              <div
                key={idea.id}
                className="group relative px-4 py-3 transition-colors hover:bg-void-800/30"
              >
                {/* 作者操作 */}
                {isAuthor(user?.uid, idea.authorUid) && (
                  <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button onClick={() => startEditIdea(idea)} className="rounded p-1 text-mist-500 hover:text-mist-300" title="编辑">
                      <Pencil size={12} />
                    </button>
                    <button onClick={() => handleDeleteIdea(idea)} className="rounded p-1 text-mist-500 hover:text-red-300" title="删除">
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  {/* 共鸣数标签 */}
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-star-400/10 text-xs font-medium text-star-300">
                    {idea.resonance}
                  </span>

                  <div className="min-w-0 flex-1">
                    <Link to={`/ideas/${idea.id}`} className="block">
                      <h3 className="truncate text-sm font-medium text-parchment-100 transition-colors group-hover:text-star-300">
                        {idea.title}
                      </h3>
                    </Link>
                    <p className="mt-0.5 line-clamp-1 text-xs text-mist-500">{idea.summary}</p>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-mist-500">
                      <span>{idea.topic}</span>
                      <span className="text-mist-600">&middot;</span>
                      <span>{idea.author}</span>
                      <span className="text-mist-600">&middot;</span>
                      <button
                        onClick={() => handleResonance(idea)}
                        className={`inline-flex items-center gap-0.5 transition-colors hover:text-star-300 ${resonated[idea.id] ? "text-star-300" : ""}`}
                      >
                        <ThumbsUp size={11} className={resonated[idea.id] ? "fill-star-400" : ""} />
                        共鸣
                      </button>
                      <button
                        onClick={() => handleFav(idea)}
                        className={`transition-colors hover:text-star-300 ${favedIdeas.has(idea.id) ? "text-star-300" : ""}`}
                      >
                        <Bookmark size={11} className={favedIdeas.has(idea.id) ? "fill-star-400" : ""} />
                      </button>
                      {!isAuthor(user?.uid, idea.authorUid) && (
                        <button onClick={() => openReport(idea)} className="transition-colors hover:text-red-300">
                          <Flag size={11} />
                        </button>
                      )}
                      <span className="flex items-center gap-0.5">
                        <MessageCircle size={11} /> {idea.replies}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
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
