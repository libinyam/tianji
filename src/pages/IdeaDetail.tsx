import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Lightbulb, ThumbsUp, Bookmark, Flag, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "@/stores/toast";
import Avatar from "@/components/Avatar";
import ReportModal from "@/components/ReportModal";
import { PostDetailSkeleton } from "@/components/Skeleton";
import { fetchIdeaById, resonanceIdea } from "@/lib/ideas";
import { toggleFavorite, isFavorited } from "@/lib/favorites";
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
      setIdea((prev) => prev ? { ...prev, resonance: prev.resonance - 1 } : prev);
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

        {/* 评论/讨论区域占位 */}
        <div className="mt-8 rounded-2xl border border-void-600/30 bg-void-800/20 p-8 text-center">
          <p className="text-sm text-mist-500">
            <Loader2 size={14} className="mr-1.5 inline animate-spin" />
            讨论功能即将上线
          </p>
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
