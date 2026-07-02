import { useState } from "react";
import { X, Loader2, Lightbulb, RotateCcw } from "lucide-react";
import { createIdea } from "@/lib/ideas";
import { ensureTags } from "@/lib/tags";
import { rateLimiters } from "@/lib/security";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/stores/toast";
import { useDraft } from "@/hooks/useDraft";
import TagSelector from "@/components/TagSelector";
import Dialog from "@/components/Dialog";
import type { Idea } from "@/types";

interface IdeaModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (idea: Idea) => void;
}

const TOPIC_OPTIONS = ["入门项目", "AI 应用", "跨专业应用", "协作共创", "工具链", "科研辅助"];

export default function IdeaModal({ open, onClose, onCreated }: IdeaModalProps) {
  const { value: draft, setValue: setDraft, clearDraft, restored, dismissRestored } = useDraft("tianji-draft-idea", {
    title: "",
    summary: "",
    topic: TOPIC_OPTIONS[0],
    tags: [] as string[],
  });
  const title = draft.title;
  const summary = draft.summary;
  const topic = draft.topic;
  const tags = draft.tags;
  const setTitle = (v: string) => setDraft({ ...draft, title: v });
  const setSummary = (v: string) => setDraft({ ...draft, summary: v });
  const setTopic = (v: string) => setDraft({ ...draft, topic: v });
  const setTags = (v: string[]) => setDraft({ ...draft, tags: v });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();

  const handleClose = () => {
    setDraft({ title: "", summary: "", topic: TOPIC_OPTIONS[0], tags: [] });
    clearDraft();
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !summary.trim()) return;
    if (!user) {
      setError("请先登录后再发布");
      return;
    }

    // 频率限制
    const rl = rateLimiters.idea.tryAction();
    if (!rl.ok) {
      setError(`操作太快了，请等待 ${rl.remaining} 秒后再试`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const idea = await createIdea({
        title: title.trim(),
        summary: summary.trim(),
        topic,
        tags: tags.length > 0 ? tags : ["综合"],
      });
      if (idea) {
        ensureTags(tags.length > 0 ? tags : ["综合"]);
        clearDraft();
        toast.success("灵感已发布");
        onCreated(idea);
        handleClose();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} preventClose={loading} labelledById="idea-dialog-title" maxWidthClass="max-w-xl">
      <div className="max-h-[90vh] overflow-y-auto">
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-md text-mist-400 transition-colors hover:bg-void-700/50 hover:text-parchment-100"
          aria-label="关闭"
        >
          <X size={18} />
        </button>

        <div className="relative">
          <div className="mb-2 flex items-center gap-2">
            <Lightbulb size={14} className="text-star-400" />
            <span className="font-mono text-xs uppercase tracking-[0.25em] text-star-300">
              分享灵感
            </span>
          </div>
          <h3 id="idea-dialog-title" className="heading-display text-2xl text-parchment-50">提出你的项目创意</h3>
          <p className="mt-2 text-sm text-mist-400">
            把你的想法描述清楚，让其他人能理解、共鸣并加入。
          </p>
        </div>

        <form onSubmit={handleSubmit} className="relative mt-6 space-y-5">
          {/* 草稿恢复提示 */}
          {restored && (
            <div className="flex items-center justify-between rounded-lg border border-star-400/30 bg-star-400/10 px-3 py-2 text-xs text-star-200">
              <span>已恢复上次未发布的草稿</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { setDraft({ title: "", summary: "", topic: TOPIC_OPTIONS[0], tags: [] }); clearDraft(); }}
                  className="flex items-center gap-1 text-mist-300 transition-colors hover:text-parchment-100"
                >
                  <RotateCcw size={12} /> 清空
                </button>
                <button
                  type="button"
                  onClick={dismissRestored}
                  className="text-mist-400 transition-colors hover:text-parchment-100"
                >
                  忽略
                </button>
              </div>
            </div>
          )}
          {/* 标题 */}
          <div>
            <label className="mb-1.5 block text-xs text-mist-400">标题</label>
            <input
              name="title"
              type="text"
              required
              maxLength={100}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="一句话描述你的项目创意"
              className="w-full rounded-lg border border-void-600/50 bg-void-950/50 px-3 py-2.5 text-sm text-parchment-100 placeholder:text-mist-500 focus:border-star-400/50 focus:outline-none focus:ring-1 focus:ring-star-400/30"
            />
          </div>

          {/* 摘要 */}
          <div>
            <label className="mb-1.5 block text-xs text-mist-400">描述</label>
            <textarea
              name="body"
              required
              rows={5}
              maxLength={500}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="描述这个创意的背景、解决的问题、技术方案，以及为什么值得做…"
              className="w-full resize-y rounded-lg border border-void-600/50 bg-void-950/50 p-3 text-sm leading-relaxed text-parchment-100 placeholder:text-mist-500 focus:border-star-400/50 focus:outline-none focus:ring-1 focus:ring-star-400/30"
            />
          </div>

          {/* 主题 */}
          <div>
            <label className="mb-1.5 block text-xs text-mist-400">主题分类</label>
            <div className="flex flex-wrap gap-2">
              {TOPIC_OPTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTopic(t)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-all ${
                    topic === t
                      ? "border-star-400/60 bg-star-400/15 text-star-200"
                      : "border-void-600/50 bg-void-800/40 text-mist-300 hover:border-mist-400/40"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* 标签 */}
          <div>
            <label className="mb-1.5 block text-xs text-mist-400">标签（最多 5 个）</label>
            <TagSelector value={tags} onChange={setTags} />
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
              disabled={loading || !title.trim() || !summary.trim()}
              className="btn-gold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> 发布中…
                </>
              ) : (
                "发布灵感"
              )}
            </button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}
