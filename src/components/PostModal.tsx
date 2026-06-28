import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Loader2, RotateCcw } from "lucide-react";
import { createPost } from "@/lib/posts";
import { ensureTags } from "@/lib/tags";
import { rateLimiters } from "@/lib/security";
import { app } from "@/lib/cloudbase";
import { useAuthStore } from "@/stores/auth";
import { useDraft } from "@/hooks/useDraft";
import TagSelector from "@/components/TagSelector";
import type { Question } from "@/types";

interface PostModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (post: Question) => void;
}

export default function PostModal({ open, onClose, onCreated }: PostModalProps) {
  const { value: draft, setValue: setDraft, clearDraft, restored, dismissRestored } = useDraft("tianji-draft-post", {
    title: "",
    body: "",
    tags: [] as string[],
  });
  const title = draft.title;
  const body = draft.body;
  const tags = draft.tags;
  const setTitle = (v: string) => setDraft({ ...draft, title: v });
  const setBody = (v: string) => setDraft({ ...draft, body: v });
  const setTags = (v: string[]) => setDraft({ ...draft, tags: v });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();

  const handleClose = () => {
    setDraft({ title: "", body: "", tags: [] });
    clearDraft();
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    if (!user) {
      setError("请先登录后再发帖");
      return;
    }

    // 频率限制
    const rl = rateLimiters.post.tryAction();
    if (!rl.ok) {
      setError(`操作太快了，请等待 ${rl.remaining} 秒后再试`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const post = await createPost({
        title: title.trim(),
        body: body.trim(),
        tags: tags.length > 0 ? tags : ["综合讨论"],
      });
      if (post) {
        // 更新标签计数
        ensureTags(tags.length > 0 ? tags : ["综合讨论"]);
        clearDraft();
        onCreated(post);
        handleClose();

        // 异步触发 AI 机器人回复（不阻塞用户）
        app.callFunction({
          name: "ai-bot",
          data: {
            postId: post.id,
            postTitle: post.title,
            postBody: post.body,
            contentType: "post",
            content: post.body,
            tags: tags.length > 0 ? tags : ["综合讨论"],
          },
        }).then((res: unknown) => {
          console.log("AI bot response:", res);
        }).catch((err) => {
          console.error("AI bot error:", err);
        });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          <div
            className="absolute inset-0 bg-void-950/80 backdrop-blur-sm"
            onClick={handleClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.25 }}
            className="card-surface grain relative max-h-[90vh] w-full max-w-2xl overflow-y-auto p-7"
          >
            <button
              onClick={handleClose}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-md text-mist-400 transition-colors hover:bg-void-700/50 hover:text-parchment-100"
              aria-label="关闭"
            >
              <X size={18} />
            </button>

            <div className="relative">
              <div className="mb-2 font-mono text-xs uppercase tracking-[0.25em] text-star-300">
                发起讨论
              </div>
              <h3 className="heading-display text-2xl text-parchment-50">
                提出你的问题
              </h3>
              <p className="mt-2 text-sm text-mist-400">
                描述越具体，越容易得到有效回答。支持 LaTeX 公式。
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
                      onClick={() => { setDraft({ title: "", body: "", tags: [] }); clearDraft(); }}
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
                  type="text"
                  required
                  maxLength={100}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="一句话描述你的问题"
                  className="w-full rounded-lg border border-void-600/50 bg-void-950/50 px-3 py-2.5 text-sm text-parchment-100 placeholder:text-mist-500 focus:border-star-400/50 focus:outline-none focus:ring-1 focus:ring-star-400/30"
                />
              </div>

              {/* 正文 */}
              <div>
                <label className="mb-1.5 block text-xs text-mist-400">
                  正文
                  <span className="ml-2 text-mist-500">
                    支持 LaTeX：行内 $...$，行间 $$...$$
                  </span>
                </label>
                <textarea
                  required
                  rows={8}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="详细描述你的问题背景、已尝试的方案、具体的卡点…"
                  className="w-full resize-y rounded-lg border border-void-600/50 bg-void-950/50 p-3 text-sm leading-relaxed text-parchment-100 placeholder:text-mist-500 focus:border-star-400/50 focus:outline-none focus:ring-1 focus:ring-star-400/30"
                />
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
                <button
                  type="button"
                  onClick={handleClose}
                  className="btn-ghost"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={loading || !title.trim() || !body.trim()}
                  className="btn-gold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 size={15} className="animate-spin" /> 发布中…
                    </>
                  ) : (
                    "发布讨论"
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
