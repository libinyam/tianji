import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Loader2, BookOpen, Link2 } from "lucide-react";
import { createBook } from "@/lib/books";
import { ensureTags } from "@/lib/tags";
import { rateLimiters } from "@/lib/security";
import { useAuthStore } from "@/stores/auth";
import TagSelector from "@/components/TagSelector";
import type { Book, BookCategory } from "@/types";

interface BookUploadModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (book: Book) => void;
}

const CATEGORIES: BookCategory[] = ["基础理论", "AI工具实战", "项目实战", "编程基础"];

export default function BookUploadModal({ open, onClose, onCreated }: BookUploadModalProps) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [category, setCategory] = useState<BookCategory>("AI工具实战");
  const [difficulty, setDifficulty] = useState<1 | 2 | 3 | 4 | 5>(2);
  const [summary, setSummary] = useState("");
  const [link, setLink] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();

  const handleClose = () => {
    setTitle("");
    setAuthor("");
    setCategory("AI工具实战");
    setDifficulty(2);
    setSummary("");
    setLink("");
    setTags([]);
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !author.trim() || !summary.trim()) return;
    if (!user) {
      setError("请先登录后再上传");
      return;
    }

    // 频率限制
    const rl = rateLimiters.book.tryAction();
    if (!rl.ok) {
      setError(`操作太快了，请等待 ${rl.remaining} 秒后再试`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const book = await createBook({
        title: title.trim(),
        author: author.trim(),
        category,
        difficulty,
        tags: tags.length > 0 ? tags : ["综合"],
        summary: summary.trim(),
        link: link.trim() || undefined,
      });
      if (book) {
        ensureTags(tags.length > 0 ? tags : ["综合"]);
        onCreated(book);
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
                <BookOpen size={14} className="text-star-400" />
                <span className="font-mono text-xs uppercase tracking-[0.25em] text-star-300">
                  上传资源
                </span>
              </div>
              <h3 className="heading-display text-2xl text-parchment-50">分享学习资源</h3>
              <p className="mt-2 text-sm text-mist-400">
                推荐好书、教程或工具，帮助其他学习者找到方向。
              </p>
            </div>

            <form onSubmit={handleSubmit} className="relative mt-6 space-y-5">
              {/* 标题 */}
              <div>
                <label className="mb-1.5 block text-xs text-mist-400">资源名称 *</label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="书名、教程名或工具名"
                  className="w-full rounded-lg border border-void-600/50 bg-void-950/50 px-3 py-2.5 text-sm text-parchment-100 placeholder:text-mist-500 focus:border-star-400/50 focus:outline-none focus:ring-1 focus:ring-star-400/30"
                />
              </div>

              {/* 作者 */}
              <div>
                <label className="mb-1.5 block text-xs text-mist-400">作者 / 来源 *</label>
                <input
                  type="text"
                  required
                  maxLength={50}
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="原作者或推荐人"
                  className="w-full rounded-lg border border-void-600/50 bg-void-950/50 px-3 py-2.5 text-sm text-parchment-100 placeholder:text-mist-500 focus:border-star-400/50 focus:outline-none focus:ring-1 focus:ring-star-400/30"
                />
              </div>

              {/* 分类 + 难度 */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs text-mist-400">分类</label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCategory(c)}
                        className={`rounded-full border px-3 py-1.5 text-xs transition-all ${
                          category === c
                            ? "border-star-400/60 bg-star-400/15 text-star-200"
                            : "border-void-600/50 bg-void-800/40 text-mist-300 hover:border-mist-400/40"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs text-mist-400">难度</label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDifficulty(d as 1 | 2 | 3 | 4 | 5)}
                        className={`flex h-8 w-8 items-center justify-center rounded-md border text-xs transition-all ${
                          difficulty >= d
                            ? "border-star-400/60 bg-star-400/15 text-star-300"
                            : "border-void-600/50 text-mist-500 hover:border-mist-400/40"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                    <span className="ml-1 text-xs text-mist-500">
                      {["", "入门", "初级", "中级", "进阶", "硬核"][difficulty]}
                    </span>
                  </div>
                </div>
              </div>

              {/* 摘要 */}
              <div>
                <label className="mb-1.5 block text-xs text-mist-400">简介 *</label>
                <textarea
                  required
                  rows={4}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="简要描述这份资源的内容、适合的人群和学习的价值…"
                  className="w-full resize-y rounded-lg border border-void-600/50 bg-void-950/50 p-3 text-sm leading-relaxed text-parchment-100 placeholder:text-mist-500 focus:border-star-400/50 focus:outline-none focus:ring-1 focus:ring-star-400/30"
                />
              </div>

              {/* 链接 */}
              <div>
                <label className="mb-1.5 block text-xs text-mist-400">资源链接（可选）</label>
                <div className="relative">
                  <Link2
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-mist-500"
                  />
                  <input
                    type="url"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="https://github.com/… 或电子书地址"
                    className="w-full rounded-lg border border-void-600/50 bg-void-950/50 py-2.5 pl-10 pr-3 text-sm text-parchment-100 placeholder:text-mist-500 focus:border-star-400/50 focus:outline-none focus:ring-1 focus:ring-star-400/30"
                  />
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
                  disabled={loading || !title.trim() || !author.trim() || !summary.trim()}
                  className="btn-gold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 size={15} className="animate-spin" /> 上传中…
                    </>
                  ) : (
                    "发布资源"
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
