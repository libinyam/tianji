import { useState, useEffect, useRef } from "react";
import { X, Flag, Loader2, Check } from "lucide-react";
import { createReport } from "@/lib/reports";
import Dialog from "@/components/Dialog";

interface ReportModalProps {
  open: boolean;
  onClose: () => void;
  targetType: "post" | "idea" | "book" | "answer" | "comment";
  targetId: string;
  targetTitle: string;
}

const REASONS = ["垃圾广告", "不友善内容", "违规内容", "其他"];

export default function ReportModal({
  open,
  onClose,
  targetType,
  targetId,
  targetTitle,
}: ReportModalProps) {
  const [reason, setReason] = useState<string>("");
  const [detail, setDetail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 打开时重置状态
  useEffect(() => {
    if (open) {
      setReason("");
      setDetail("");
      setLoading(false);
      setError(null);
      setDone(false);
    }
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [open]);

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    setLoading(true);
    setError(null);
    try {
      const finalReason = detail.trim()
        ? `${reason}：${detail.trim()}`
        : reason;
      await createReport({ targetType, targetId, targetTitle, reason: finalReason });
      setDone(true);
      closeTimerRef.current = setTimeout(() => handleClose(), 1200);
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
      labelledById="report-dialog-title"
      maxWidthClass="max-w-lg"
    >
      <button
        onClick={handleClose}
        className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-md text-mist-400 transition-colors hover:bg-void-700/50 hover:text-parchment-100"
        aria-label="关闭"
      >
        <X size={18} />
      </button>

      {done ? (
        <div className="flex flex-col items-center py-10 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-red-400/40 bg-red-400/15 text-red-300">
            <Check size={22} />
          </div>
          <h3 id="report-dialog-title" className="heading-display text-lg text-parchment-50">举报已提交</h3>
          <p className="mt-2 text-sm text-mist-400">感谢你的反馈，我们会尽快处理。</p>
        </div>
      ) : (
        <div className="relative">
          <div className="mb-2 flex items-center gap-2">
            <Flag size={14} className="text-red-400" />
            <span className="font-mono text-xs uppercase tracking-[0.25em] text-red-300">
              举报内容
            </span>
          </div>
          <h3 id="report-dialog-title" className="heading-display text-2xl text-parchment-50">举报这则内容</h3>
          <p className="mt-2 truncate text-sm text-mist-400" title={targetTitle}>
            {targetTitle}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label className="mb-1.5 block text-xs text-mist-400">举报原因</label>
              <div className="flex flex-wrap gap-2">
                {REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className={`rounded-full border px-3 py-1.5 text-xs transition-all ${
                      reason === r
                        ? "border-red-400/60 bg-red-400/15 text-red-200"
                        : "border-void-600/50 bg-void-800/40 text-mist-300 hover:border-mist-400/40"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-mist-400">
                补充说明（可选）
              </label>
              <textarea
                name="report-detail"
                rows={3}
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="补充描述具体情况，帮助我们更好地判断…"
                maxLength={500}
                className="w-full resize-y rounded-lg border border-void-600/50 bg-void-950/50 p-3 text-sm leading-relaxed text-parchment-100 placeholder:text-mist-500 focus:border-red-400/50 focus:outline-none focus:ring-1 focus:ring-red-400/30"
              />
            </div>

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
                disabled={loading || !reason}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-400/60 bg-red-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> 提交中…
                  </>
                ) : (
                  <>
                    <Flag size={15} /> 提交举报
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </Dialog>
  );
}
