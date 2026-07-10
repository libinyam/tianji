import { useState } from "react";
import { Loader2 } from "lucide-react";
import Dialog from "@/components/Dialog";
import { submitContribution } from "@/lib/workshops";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/stores/toast";
import type { Contribution } from "@/lib/workshops";

interface ContributeModalProps {
  open: boolean;
  onClose: () => void;
  workshopId: string;
  chapterId: string;
  chapterTitle: string;
  onContributed: (contribution: Contribution) => void;
}

export default function ContributeModal({
  open,
  onClose,
  workshopId,
  chapterId,
  chapterTitle,
  onContributed,
}: ContributeModalProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();

  const handleClose = () => {
    setContent("");
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    if (!user) {
      setError("请先登录后再贡献内容");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const contribution = await submitContribution(workshopId, chapterId, content.trim());
      if (contribution) {
        toast.success("贡献已提交");
        onContributed(contribution);
        handleClose();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      preventClose={loading}
      labelledById="contribute-title"
      maxWidthClass="max-w-2xl"
    >
      <div className="relative">
        <span className="font-mono text-xs uppercase tracking-[0.25em] text-star-300">
          贡献内容
        </span>
        <h3 id="contribute-title" className="mt-1 heading-display text-2xl text-parchment-50">{chapterTitle}</h3>
        <p className="mt-2 text-sm text-mist-400">
          撰写你对这一章节的内容。支持 LaTeX：行内 $...$，行间 $$...$$
        </p>
      </div>

      <form onSubmit={handleSubmit} className="relative mt-6 space-y-4">
        <textarea
          required
          rows={12}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="撰写章节内容…"
          className="w-full resize-y rounded-lg border border-void-600/50 bg-void-950/50 p-3 text-sm leading-relaxed text-parchment-100 placeholder:text-mist-500 focus:border-star-400/50 focus:outline-none focus:ring-1 focus:ring-star-400/30"
          maxLength={15000}
        />

        {error && (
          <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={handleClose} className="btn-ghost">
            取消
          </button>
          <button
            type="submit"
            disabled={loading || !content.trim()}
            className="btn-gold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" /> 提交中…
              </>
            ) : (
              "提交贡献"
            )}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
