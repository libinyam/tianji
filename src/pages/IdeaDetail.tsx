import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Lightbulb, ThumbsUp, Bookmark, Flag, ArrowLeft, Loader2, Send, MessageCircle, Trash2 } from "lucide-react";
import { toast } from "@/stores/toast";
import Avatar from "@/components/Avatar";
import ReportModal from "@/components/ReportModal";
import { PostDetailSkeleton } from "@/components/Skeleton";
import { fetchIdeaById, resonanceIdea, addIdeaComment, deleteIdeaComment } from "@/lib/ideas";
import { toggleFavorite, isFavorited } from "@/lib/favorites";
import { rateLimiters } from "@/lib/security";
import { useAuthStore } from "@/stores/auth";
import { formatRelativeTime } from "@/lib/format";
import type { Idea } from "@/types";

export default function IdeaDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const [idea, setIdea] = useState<Idea | null>(null);
  const [loading, setLoading] = useState(true);
  const [resonated, setResonated] = useState(false);
  const [faved, setFaved] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);

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
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  // 登录状态变化时重新检查收藏
  useEffect(() => {
    if (id && user) {
      isFavorited(id).then(setFaved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

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
    } catch {
      setResonated(false);
      setIdea((prev) => prev ? { ...prev, resonance: Math.max(0, prev.resonance - 1) } : prev);
      toast.error("操作失败，请重试");
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
        setIdea({ ...idea, comments: [...(idea.comments ?? []), comment], replies: idea.replies + 1 });
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

            {user?.uid !== idea.authorUid && (
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
              (idea.comments ?? []).map((c) => (
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
                    {user?.uid === c.authorUid && (
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
