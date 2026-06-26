import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Loader2, Tag as TagIcon, Lightbulb } from "lucide-react";
import { createIdea } from "@/lib/ideas";
import { useAuthStore } from "@/stores/auth";
import type { Idea } from "@/types";

interface IdeaModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (idea: Idea) => void;
}

const TOPIC_OPTIONS = ["入门项目", "AI 应用", "跨专业应用", "协作共创", "工具链", "科研辅助"];

const SUGGESTED_TAGS = [
  "作品集",
  "大模型",
  "前端",
  "部署",
  "RAG",
  "Python",
  "可视化",
  "MCP",
  "Claude Code",
  "GitHub",
];

export default function IdeaModal({ open, onClose, onCreated }: IdeaModalProps) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [topic, setTopic] = useState(TOPIC_OPTIONS[0]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();

  const handleClose = () => {
    setTitle("");
    setSummary("");
    setTopic(TOPIC_OPTIONS[0]);
    setTags([]);
    setTagInput("");
    setError(null);
    onClose();
  };

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed) && tags.length < 5) {
      setTags([...tags, trimmed]);
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      addTag(tagInput);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !summary.trim()) return;
    if (!user) {
      setError("请先登录后再发布");
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
              <div className="mb-2 flex items-center gap-2">
                <Lightbulb size={14} className="text-star-400" />
                <span className="font-mono text-xs uppercase tracking-[0.25em] text-star-300">
                  分享灵感
                </span>
              </div>
              <h3 className="heading-display text-2xl text-parchment-50">提出你的项目创意</h3>
              <p className="mt-2 text-sm text-mist-400">
                把你的想法描述清楚，让其他人能理解、共鸣并加入。
              </p>
            </div>

            <form onSubmit={handleSubmit} className="relative mt-6 space-y-5">
              {/* 标题 */}
              <div>
                <label className="mb-1.5 block text-xs text-mist-400">标题</label>
                <input
                  type="text"
                  required
                  maxLength={80}
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
                  required
                  rows={5}
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
                <div className="flex flex-wrap gap-2">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="flex items-center gap-1 rounded-full border border-tian-400/40 bg-tian-400/10 px-2.5 py-1 text-xs text-tian-100"
                    >
                      <TagIcon size={10} />
                      {t}
                      <button
                        type="button"
                        onClick={() => removeTag(t)}
                        className="ml-0.5 text-mist-500 hover:text-red-300"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={tags.length < 5 ? "输入标签后回车" : ""}
                    disabled={tags.length >= 5}
                    className="min-w-[120px] flex-1 rounded-full border border-void-600/50 bg-void-950/50 px-3 py-1 text-xs text-parchment-100 placeholder:text-mist-500 focus:border-star-400/50 focus:outline-none disabled:opacity-40"
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {SUGGESTED_TAGS.filter((t) => !tags.includes(t)).slice(0, 6).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => addTag(t)}
                      className="rounded-full border border-void-600/40 px-2 py-0.5 text-[11px] text-mist-400 transition-colors hover:border-mist-400/50 hover:text-mist-200"
                    >
                      + {t}
                    </button>
                  ))}
                </div>
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
