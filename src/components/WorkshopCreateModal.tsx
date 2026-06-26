import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Loader2, Plus, Trash2, BookOpen, FileText } from "lucide-react";
import { createWorkshop, type WorkshopType, type OutlineChapter } from "@/lib/workshops";
import { useAuthStore } from "@/stores/auth";
import type { WorkshopProject } from "@/lib/workshops";

interface WorkshopCreateModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (project: WorkshopProject) => void;
}

export default function WorkshopCreateModal({ open, onClose, onCreated }: WorkshopCreateModalProps) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<WorkshopType>("教材");
  const [description, setDescription] = useState("");
  const [outline, setOutline] = useState<OutlineChapter[]>([
    { id: "ch1", title: "", brief: "" },
  ]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();

  const handleClose = () => {
    setTitle("");
    setType("教材");
    setDescription("");
    setOutline([{ id: "ch1", title: "", brief: "" }]);
    setTags([]);
    setTagInput("");
    setError(null);
    onClose();
  };

  const addChapter = () => {
    setOutline([...outline, { id: `ch${Date.now()}`, title: "", brief: "" }]);
  };

  const removeChapter = (id: string) => {
    setOutline(outline.filter((c) => c.id !== id));
  };

  const updateChapter = (id: string, field: "title" | "brief", value: string) => {
    setOutline(outline.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed) && tags.length < 5) {
      setTags([...tags, trimmed]);
    }
    setTagInput("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    const validOutline = outline.filter((c) => c.title.trim());
    if (validOutline.length === 0) {
      setError("至少需要一章大纲");
      return;
    }
    if (!user) {
      setError("请先登录后再创建");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const project = await createWorkshop({
        title: title.trim(),
        type,
        description: description.trim(),
        outline: validOutline,
        tags: tags.length > 0 ? tags : ["综合"],
      });
      if (project) {
        onCreated(project);
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
          <div className="absolute inset-0 bg-void-950/80 backdrop-blur-sm" onClick={handleClose} />

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
            >
              <X size={18} />
            </button>

            <div className="relative">
              <span className="font-mono text-xs uppercase tracking-[0.25em] text-star-300">
                新建协作项目
              </span>
              <h3 className="mt-1 heading-display text-2xl text-parchment-50">发起共创</h3>
              <p className="mt-2 text-sm text-mist-400">
                创建大纲，邀请其他学习者共同书写教材或论文。
              </p>
            </div>

            <form onSubmit={handleSubmit} className="relative mt-6 space-y-5">
              {/* 类型选择 */}
              <div>
                <label className="mb-1.5 block text-xs text-mist-400">项目类型</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setType("教材")}
                    className={`flex flex-1 items-center gap-2 rounded-lg border p-3 text-sm transition-all ${
                      type === "教材"
                        ? "border-star-400/60 bg-star-400/10 text-star-200"
                        : "border-void-600/50 bg-void-800/40 text-mist-300 hover:border-mist-400/40"
                    }`}
                  >
                    <BookOpen size={16} /> 教材 / 书籍（公开）
                  </button>
                  <button
                    type="button"
                    onClick={() => setType("论文")}
                    className={`flex flex-1 items-center gap-2 rounded-lg border p-3 text-sm transition-all ${
                      type === "论文"
                        ? "border-star-400/60 bg-star-400/10 text-star-200"
                        : "border-void-600/50 bg-void-800/40 text-mist-300 hover:border-mist-400/40"
                    }`}
                  >
                    <FileText size={16} /> 论文（仅参与者可见）
                  </button>
                </div>
              </div>

              {/* 标题 */}
              <div>
                <label className="mb-1.5 block text-xs text-mist-400">标题 *</label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="项目名称"
                  className="w-full rounded-lg border border-void-600/50 bg-void-950/50 px-3 py-2.5 text-sm text-parchment-100 placeholder:text-mist-500 focus:border-star-400/50 focus:outline-none focus:ring-1 focus:ring-star-400/30"
                />
              </div>

              {/* 描述 */}
              <div>
                <label className="mb-1.5 block text-xs text-mist-400">项目简介 *</label>
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="描述项目的目标、适合的人群和预期成果…"
                  className="w-full resize-y rounded-lg border border-void-600/50 bg-void-950/50 p-3 text-sm leading-relaxed text-parchment-100 placeholder:text-mist-500 focus:border-star-400/50 focus:outline-none focus:ring-1 focus:ring-star-400/30"
                />
              </div>

              {/* 大纲 */}
              <div>
                <label className="mb-1.5 block text-xs text-mist-400">
                  大纲（章节列表）*
                </label>
                <div className="space-y-3">
                  {outline.map((ch, i) => (
                    <div
                      key={ch.id}
                      className="flex gap-2 rounded-lg border border-void-600/40 bg-void-800/30 p-3"
                    >
                      <span className="mt-2 font-mono text-xs text-mist-500">
                        第{i + 1}章
                      </span>
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={ch.title}
                          onChange={(e) => updateChapter(ch.id, "title", e.target.value)}
                          placeholder="章节标题"
                          className="w-full rounded-md border border-void-600/50 bg-void-950/50 px-2.5 py-1.5 text-sm text-parchment-100 placeholder:text-mist-500 focus:border-star-400/50 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={ch.brief}
                          onChange={(e) => updateChapter(ch.id, "brief", e.target.value)}
                          placeholder="简述（可选）"
                          className="w-full rounded-md border border-void-600/50 bg-void-950/50 px-2.5 py-1.5 text-xs text-mist-300 placeholder:text-mist-500 focus:border-star-400/50 focus:outline-none"
                        />
                      </div>
                      {outline.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeChapter(ch.id)}
                          className="mt-1 text-mist-500 transition-colors hover:text-red-300"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addChapter}
                  className="mt-2 flex items-center gap-1 text-xs text-star-300 transition-colors hover:text-star-200"
                >
                  <Plus size={13} /> 添加章节
                </button>
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
                      {t}
                      <button
                        type="button"
                        onClick={() => setTags(tags.filter((x) => x !== t))}
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
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && tagInput.trim()) {
                        e.preventDefault();
                        addTag(tagInput);
                      }
                    }}
                    placeholder={tags.length < 5 ? "输入标签后回车" : ""}
                    disabled={tags.length >= 5}
                    className="min-w-[120px] flex-1 rounded-full border border-void-600/50 bg-void-950/50 px-3 py-1 text-xs text-parchment-100 placeholder:text-mist-500 focus:border-star-400/50 focus:outline-none disabled:opacity-40"
                  />
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
                  disabled={loading || !title.trim() || !description.trim()}
                  className="btn-gold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 size={15} className="animate-spin" /> 创建中…
                    </>
                  ) : (
                    "创建项目"
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
