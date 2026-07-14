import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Lightbulb, ThumbsUp, Bookmark, Flag, ArrowLeft, Loader2, Send, MessageCircle, Trash2, Pencil, Check } from "lucide-react";
import { toast } from "@/stores/toast";
import Avatar from "@/components/Avatar";
import ReportModal from "@/components/ReportModal";
import TagSelector from "@/components/TagSelector";
import Dialog from "@/components/Dialog";
import { PostDetailSkeleton } from "@/components/Skeleton";
import { fetchIdeaById, resonanceIdea, addIdeaComment, deleteIdeaComment, updateIdea, deleteIdea } from "@/lib/ideas";
import { toggleFavorite, isFavorited } from "@/lib/favorites";
import { rateLimiters } from "@/lib/security";
import { useAuthStore } from "@/stores/auth";
import { formatRelativeTime } from "@/lib/format";
import { isAuthor } from "@/lib/utils";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useSEO } from "@/hooks/useSEO";
import type { Idea } from "@/types";

export default function IdeaDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [idea, setIdea] = useState<Idea | null>(null);
  useDocumentTitle(idea?.title);
  // #150 动态 SEO
  useSEO({
    title: idea?.title,
    description: idea?.summary,
    canonical: id ? `https://tianjihub.cn/ideas/${id}` : undefined,
  });
  const [loading, setLoading] = useState(true);
  const [resonated, setResonated] = useState(false);
  const [faved, setFaved] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  // 编辑/删除状态 (#98)
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      const data = await fetchIdeaById(id);
      if (!mounted) return;
      setIdea(data);
      setLoading(false);
      if (data) {
        isFavorited(id).then((f) => mounted && setFaved(f));
        const curUid = useAuthStore.getState().user?.uid ?? "";
        setResonated(!!data.resonatedBy?.includes(curUid));
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  // 登录状态变化时重新检查收藏与共鸣状态；登出时重置为未选中（#132）
  useEffect(() => {
    if (!user) {
      setFaved(false);
      setResonated(false);
      return;
    }
    if (id) {
      isFavorited(id).then(setFaved);
      setResonated(!!idea?.resonatedBy?.includes(user.uid));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, idea?.id]);

  const handleResonance = async () => {
    if (!user) {
      window.dispatchEvent(new CustomEvent("tianji:open-auth"));
      return;
    }
    if (resonated || !idea) return;

    setResonated(true);
    setIdea((prev) => prev ? { ...prev, resonance: prev.resonance + 1 } : prev);

    try {
      await resonanceIdea(idea.id);
    } catch (err) {
      setResonated(false);
      setIdea((prev) => prev ? { ...prev, resonance: Math.max(0, prev.resonance - 1) } : prev);
      toast.error((err as Error).message || "操作失败，请重试");
    }
  };

  const handleFav = async () => {
    if (!user) {
      window.dispatchEvent(new CustomEvent("tianji:open-auth"));
      return;
    }
    if (!idea) return;
    try {
      const fav = await toggleFavorite({
        targetId: idea.id,
        type: "idea",
        title: idea.title,
        excerpt: idea.summary,
        link: `/ideas/${idea.id}`,
      });
      setFaved(fav);
      toast.success(fav ? "已收藏" : "已取消收藏");
    } catch {
      toast.error("操作失败，请重试");
    }
  };

  const handleComment = async () => {
    if (!user) {
      window.dispatchEvent(new CustomEvent("tianji:open-auth"));
      return;
    }
    if (!idea || !commentText.trim()) return;

    // 频率限制：先检查，成功后再记录（防刷屏+通知轰炸 #115）
    const rl = rateLimiters.comment.check();
    if (!rl.allowed) {
      toast.error(`操作太快了，请等待 ${rl.remaining} 秒后再试`);
      return;
    }

    setCommentSubmitting(true);
    try {
      const comment = await addIdeaComment(idea.id, commentText);
      if (comment) {
        rateLimiters.comment.record();
        setIdea({ ...idea, comments: [comment, ...(idea.comments ?? [])], replies: idea.replies + 1 });
        setCommentText("");
        toast.success("评论已发布");
      } else {
        toast.error("评论失败，该灵感可能已被删除");
      }
    } catch (e) {
      toast.error((e as Error).message || "评论失败，请重试");
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user || !idea) return;
    try {
      const ok = await deleteIdeaComment(idea.id, commentId);
      if (ok) {
        setIdea({
          ...idea,
          comments: (idea.comments ?? []).filter((c) => c.id !== commentId),
          replies: Math.max(0, idea.replies - 1),
        });
        toast.success("评论已删除");
      }
    } catch (e) {
      toast.error((e as Error).message || "删除失败，请重试");
    }
  };

  // #98 编辑灵感
  const handleStartEdit = () => {
    if (!idea) return;
    setEditTitle(idea.title);
    setEditSummary(idea.summary);
    setEditTags(idea.tags);
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!idea || !editTitle.trim() || !editSummary.trim()) return;
    setEditSaving(true);
    try {
      await updateIdea(idea.id, { title: editTitle.trim(), summary: editSummary.trim(), tags: editTags });
      setIdea({ ...idea, title: editTitle.trim(), summary: editSummary.trim(), tags: editTags });
      setEditOpen(false);
      toast.success("灵感已更新");
    } catch (e) {
      toast.error((e as Error).message || "保存失败");
    } finally {
      setEditSaving(false);
    }
  };

  // #98 删除灵感
  const handleDelete = async () => {
    if (!idea) return;
    setDeleting(true);
    try {
      const ok = await deleteIdea(idea.id);
      if (ok) {
        toast.success("灵感已删除");
        navigate("/ideas");
      } else {
        toast.error("删除失败");
        setDeleteConfirm(false);
      }
    } catch (e) {
      toast.error((e as Error).message || "删除失败");
      setDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <PostDetailSkeleton />;
  }

  if (!idea) {
    return (
      <div className="container-tj py-40 text-center">
        <p className="heading-display text-3xl text-parchment-50">灵感已消散</p>
        <p className="mt-3 text-mist-400">这条灵感可能已被作者删除，或从未存在过。</p>
        <Link to="/ideas" className="btn-ghost mt-6 inline-flex">
          <ArrowLeft size={16} className="mr-1.5" /> 返回灵感广场
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="container-tj py-8">
        <Link to="/ideas" className="mb-6 inline-flex items-center text-sm text-mist-400 transition-colors hover:text-star-300">
          <ArrowLeft size={15} className="mr-1.5" /> 返回灵感广场
        </Link>

        <article className="rounded-2xl border border-void-600/40 bg-void-800/40 p-8 backdrop-blur-sm">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-star-400/30 bg-star-400/10 text-star-300">
              <Lightbulb size={19} />
            </span>
            <span className="pill-blue">{idea.topic}</span>
            <span className="text-xs text-mist-500">{formatRelativeTime(idea.createdAt)}</span>
          </div>

          <h1 className="mt-5 heading-display text-2xl leading-snug text-parchment-50 md:text-3xl">
            {idea.title}
          </h1>

          <div className="mt-3 flex items-center gap-2.5">
            <Avatar name={idea.author} color={idea.avatarColor} size={28} />
            {idea.authorUid ? (
              <Link to={`/user/${idea.authorUid}`} className="text-sm text-mist-300 transition-colors hover:text-star-300">
                {idea.author}
              </Link>
            ) : (
              <span className="text-sm text-mist-300">{idea.author}</span>
            )}
          </div>

          <div className="mt-6 text-base leading-relaxed text-mist-200 whitespace-pre-wrap">
            {idea.summary}
          </div>

          {idea.tags.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {idea.tags.map((tag) => (
                <Link
                  key={tag}
                  to={`/tags/${encodeURIComponent(tag)}`}
                  className="rounded-full border border-void-600/50 bg-void-700/30 px-3 py-1 text-xs text-mist-300 transition-colors hover:border-star-400/40 hover:text-star-200"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          )}

          <div className="mt-8 flex items-center gap-4 border-t border-void-600/30 pt-6">
            <button
              onClick={handleResonance}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-all ${
                resonated
                  ? "border-star-400/60 bg-star-400/15 text-star-200"
                  : "border-void-600/50 bg-void-700/30 text-mist-300 hover:border-star-400/40 hover:text-star-300"
              }`}
            >
              <ThumbsUp size={15} className={resonated ? "fill-star-400" : ""} />
              {idea.resonance} 共鸣
            </button>

            <button
              onClick={handleFav}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-all ${
                faved
                  ? "border-star-400/60 bg-star-400/15 text-star-200"
                  : "border-void-600/50 bg-void-700/30 text-mist-300 hover:border-star-400/40 hover:text-star-300"
              }`}
            >
              <Bookmark size={15} className={faved ? "fill-star-400" : ""} />
              {faved ? "已收藏" : "收藏"}
            </button>

            {!isAuthor(user?.uid, idea.authorUid) && (
              <button
                onClick={() => {
                  if (!user) {
                    window.dispatchEvent(new CustomEvent("tianji:open-auth"));
                    return;
                  }
                  setReportOpen(true);
                }}
                className="flex items-center gap-2 rounded-lg border border-void-600/50 bg-void-700/30 px-4 py-2 text-sm text-mist-400 transition-colors hover:text-red-300"
              >
                <Flag size={15} /> 举报
              </button>
            )}

            {/* #98 作者可编辑/删除 */}
            {isAuthor(user?.uid, idea.authorUid) && (
              <>
                <button
                  onClick={handleStartEdit}
                  className="flex items-center gap-2 rounded-lg border border-void-600/50 bg-void-700/30 px-4 py-2 text-sm text-mist-300 transition-colors hover:text-star-300"
                >
                  <Pencil size={15} /> 编辑
                </button>
                {deleteConfirm ? (
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-red-300">确定删除？</span>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/20 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/30 disabled:opacity-60"
                    >
                      {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      确认
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(false)}
                      disabled={deleting}
                      className="text-xs text-mist-500 hover:text-mist-300"
                    >
                      取消
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(true)}
                    className="flex items-center gap-2 rounded-lg border border-void-600/50 bg-void-700/30 px-4 py-2 text-sm text-mist-400 transition-colors hover:text-red-300"
                  >
                    <Trash2 size={15} /> 删除
                  </button>
                )}
              </>
            )}
          </div>
        </article>

        {/* 评论区 */}
        <div className="mt-8">
          <h2 className="heading-display text-xl text-parchment-50 flex items-center gap-2">
            <MessageCircle size={20} className="text-star-400" />
            评论 {(idea.comments ?? []).length > 0 && `(${(idea.comments ?? []).length})`}
          </h2>

          {/* 评论输入 */}
          <div className="mt-4 rounded-xl border border-void-600/40 bg-void-800/30 p-4">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="写下你的想法…"
              aria-label="评论内容"
              className="w-full resize-none rounded-lg border border-void-600/50 bg-void-950/50 p-3 text-sm text-parchment-100 focus:border-star-400/50 focus:outline-none"
            />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-mist-500">{commentText.length}/1000</span>
              <button
                onClick={handleComment}
                disabled={commentSubmitting || !commentText.trim()}
                className="btn-gold text-sm disabled:opacity-50"
              >
                {commentSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                发布评论
              </button>
            </div>
          </div>

          {/* 评论列表 */}
          <div className="mt-4 space-y-4">
            {(idea.comments ?? []).length === 0 ? (
              <p className="py-8 text-center text-sm text-mist-500">还没有评论，第一个来分享你的想法吧</p>
            ) : (
              [...(idea.comments ?? [])].sort((x, y) => (y.createdAt > x.createdAt ? 1 : -1)).map((c) => (
                <div key={c.id} className="rounded-xl border border-void-600/40 bg-void-800/30 p-4">
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={c.author} color={c.avatarColor} size={28} />
                      {c.authorUid ? (
                        <Link to={`/user/${c.authorUid}`} className="text-sm text-mist-300 transition-colors hover:text-star-300">
                          {c.author}
                        </Link>
                      ) : (
                        <span className="text-sm text-mist-300">{c.author}</span>
                      )}
                      <span className="text-xs text-mist-500">{formatRelativeTime(c.createdAt)}</span>
                    </div>
                    {isAuthor(user?.uid, c.authorUid) && (
                      <button
                        onClick={() => handleDeleteComment(c.id)}
                        aria-label="删除评论"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-mist-500 transition-colors hover:bg-red-400/10 hover:text-red-300"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <p className="mt-2.5 text-sm leading-relaxed text-mist-200 whitespace-pre-wrap">{c.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* #98 编辑灵感弹窗 */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidthClass="max-w-lg">
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
        <div className="mt-3">
          <label className="mb-1.5 block text-xs text-mist-400">标签</label>
          <TagSelector value={editTags} onChange={setEditTags} />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setEditOpen(false)} className="btn-ghost text-sm">取消</button>
          <button
            onClick={handleSaveEdit}
            disabled={editSaving || !editTitle.trim() || !editSummary.trim()}
            className="btn-gold text-sm disabled:opacity-60"
          >
            {editSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            保存
          </button>
        </div>
      </Dialog>

      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="idea"
        targetId={idea.id}
        targetTitle={idea.title}
      />
    </>
  );
}
