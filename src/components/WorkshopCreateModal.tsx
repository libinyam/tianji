import { useState } from "react";
import { X, Loader2, Plus, Trash2, BookOpen, FileText } from "lucide-react";
import { createWorkshop, type WorkshopType, type OutlineChapter } from "@/lib/workshops";
import { ensureTags } from "@/lib/tags";
import { rateLimiters } from "@/lib/security";
import { useDraft } from "@/hooks/useDraft";
import TagSelector from "@/components/TagSelector";
import Dialog from "@/components/Dialog";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/stores/toast";
import type { WorkshopProject } from "@/lib/workshops";

// #98 草稿恢复的数据结构
interface WorkshopDraft {
  title: string;
  type: WorkshopType;
  description: string;
  content: string;
  outline: OutlineChapter[];
  tags: string[];
}

interface WorkshopCreateModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (project: WorkshopProject) => void;
}

export default function WorkshopCreateModal({ open, onClose, onCreated }: WorkshopCreateModalProps) {
  // #98 useDraft 草稿自动保存与恢复
  const draft = useDraft<WorkshopDraft>("workshop-create-draft", {
    title: "",
    type: "教材" as WorkshopType,
    description: "",
    content: "",
    outline: [{ id: "ch1", title: "", brief: "" }],
    tags: [],
  });
  const { value: form, setValue: setForm, clearDraft, restored, dismissRestored } = draft;
  const title = form.title;
  const type = form.type;
  const description = form.description;
  const content = form.content;
  const outline = form.outline;
  const tags = form.tags;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();

  const setTitle = (v: string) => setForm({ ...form, title: v });
  const setType = (v: WorkshopType) => setForm({ ...form, type: v });
  const setDescription = (v: string) => setForm({ ...form, description: v });
  const setContent = (v: string) => setForm({ ...form, content: v });
  const setTags = (v: string[]) => setForm({ ...form, tags: v });
  const setOutline = (v: OutlineChapter[]) => setForm({ ...form, outline: v });

  const handleClose = () => {
    clearDraft();
    setForm({
      title: "",
      type: "教材" as WorkshopType,
      description: "",
      content: "",
      outline: [{ id: "ch1", title: "", brief: "" }],
      tags: [],
    });
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

    // 频率限制：先检查，成功后再记录（失败不白等冷却）
    const rl = rateLimiters.workshop.check();
    if (!rl.allowed) {
      setError(`操作太快了，请等待 ${rl.remaining} 秒后再试`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const project = await createWorkshop({
        title: title.trim(),
        type,
        description: description.trim(),
        content: content.trim(),
        outline: validOutline,
        tags: tags.length > 0 ? tags : ["综合"],
      });
      if (project) {
        rateLimiters.workshop.record();
        ensureTags(tags.length > 0 ? tags : ["综合"]);
        toast.success("项目已创建");
        clearDraft();
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
    <Dialog
      open={open}
      onClose={handleClose}
      preventClose={loading}
      labelledById="workshop-create-dialog-title"
      maxWidthClass="max-w-xl"
    >
      <div className="max-h-[90vh] overflow-y-auto">
        <button
          onClick={handleClose}
          aria-label="关闭"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-md text-mist-400 transition-colors hover:bg-void-700/50 hover:text-parchment-100"
        >
          <X size={18} />
        </button>

        <div className="relative">
          <span className="font-mono text-xs uppercase tracking-[0.25em] text-star-300">
            新建协作项目
          </span>
          <h3 id="workshop-create-dialog-title" className="mt-1 heading-display text-2xl text-parchment-50">发起共创</h3>
              <p className="mt-2 text-sm text-mist-400">
                创建大纲，邀请其他学习者共同书写教材或论文。
              </p>
              {/* #98 草稿恢复提示 */}
              {restored && (
                <div className="mt-3 flex items-center justify-between rounded-lg border border-tian-400/30 bg-tian-400/5 px-3 py-2 text-xs text-tian-200">
                  <span>已恢复上次未完成的草稿</span>
                  <button
                    onClick={dismissRestored}
                    className="text-tian-300 transition-colors hover:text-tian-100"
                    aria-label="关闭提示"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
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
                  name="title"
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
                  name="description"
                  required
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="描述项目的目标、适合的人群和预期成果…"
                  className="w-full resize-y rounded-lg border border-void-600/50 bg-void-950/50 p-3 text-sm leading-relaxed text-parchment-100 placeholder:text-mist-500 focus:border-star-400/50 focus:outline-none focus:ring-1 focus:ring-star-400/30"
                  maxLength={3000}
                />
              </div>

              {/* 文档正文 */}
              <div>
                <label className="mb-1.5 block text-xs text-mist-400">
                  文档正文（可选，创建后也可编辑）
                </label>
                <textarea
                  name="content"
                  rows={5}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="写下文档初始内容…支持 LaTeX：行内 $...$，行间 $$...$$"
                  className="w-full resize-y rounded-lg border border-void-600/50 bg-void-950/50 p-3 text-sm leading-relaxed text-parchment-100 placeholder:text-mist-500 focus:border-star-400/50 focus:outline-none focus:ring-1 focus:ring-star-400/30"
                  maxLength={20000}
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
                          name="chapter-title"
                          type="text"
                          value={ch.title}
                          onChange={(e) => updateChapter(ch.id, "title", e.target.value)}
                          placeholder="章节标题"
                          maxLength={150}
                          className="w-full rounded-md border border-void-600/50 bg-void-950/50 px-2.5 py-1.5 text-sm text-parchment-100 placeholder:text-mist-500 focus:border-star-400/50 focus:outline-none"
                        />
                        <input
                          name="chapter-brief"
                          type="text"
                          value={ch.brief}
                          onChange={(e) => updateChapter(ch.id, "brief", e.target.value)}
                          placeholder="简述（可选）"
                          maxLength={200}
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
      </div>
    </Dialog>
  );
}
