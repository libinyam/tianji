import { useState, useEffect } from "react";
import { X, Loader2, RotateCcw, GraduationCap, Coffee } from "lucide-react";
import { createPost, type PostCategory, type CasualSubCategory, CASUAL_SUB_CATEGORIES } from "@/lib/posts";
import { ensureTags } from "@/lib/tags";
import { rateLimiters } from "@/lib/security";
import { app } from "@/lib/cloudbase";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/stores/toast";
import { useDraft } from "@/hooks/useDraft";
import Dialog from "@/components/Dialog";
import TagSelector from "@/components/TagSelector";
import type { Question } from "@/types";

interface PostModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (post: Question) => void;
  defaultCategory?: PostCategory;
  prefill?: { title: string; body: string; tags: string[] };
  onPrefillApplied?: () => void;
}

export default function PostModal({ open, onClose, onCreated, defaultCategory = "academic", prefill, onPrefillApplied }: PostModalProps) {
  const { value: draft, setValue: setDraft, clearDraft, restored, dismissRestored } = useDraft("tianji-draft-post", {
    title: "",
    body: "",
    tags: [] as string[],
    category: defaultCategory as PostCategory,
    subCategory: "" as CasualSubCategory | "",
  });
  const title = draft.title;
  const body = draft.body;
  const tags = draft.tags;
  const category = (draft.category as PostCategory) ?? defaultCategory;
  const subCategory = (draft.subCategory as CasualSubCategory | "") ?? "";
  const setTitle = (v: string) => setDraft({ ...draft, title: v });
  const setBody = (v: string) => setDraft({ ...draft, body: v });
  const setTags = (v: string[]) => setDraft({ ...draft, tags: v });
  const setCategory = (v: PostCategory) => setDraft({ ...draft, category: v, subCategory: "" });
  const setSubCategory = (v: CasualSubCategory) => setDraft({ ...draft, subCategory: v });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();

  useEffect(() => {
    // 仅在草稿为空时应用 prefill，避免覆盖用户未发布的草稿
    if (open && prefill && !title && !body) {
      setDraft({
        title: prefill.title,
        body: prefill.body,
        tags: prefill.tags,
        category: "academic" as PostCategory,
        subCategory: "" as CasualSubCategory | "",
      });
      // 通知父组件预填已应用，使其清空 prefill，保证 once 语义：
      // 避免用户手动清空标题/正文后被 prefill effect 再次预填（#113）
      onPrefillApplied?.();
    }
  }, [open, prefill, setDraft, title, body, onPrefillApplied]);

  const handleClose = () => {
    setDraft({ title: "", body: "", tags: [], category: defaultCategory, subCategory: "" });
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

    // 频率限制：先检查，成功后再记录
    const rl = rateLimiters.post.check();
    if (!rl.allowed) {
      setError(`操作太快了，请等待 ${rl.remaining} 秒后再试`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // 闲聊区：用子分类作为标签；学术区：用用户输入或默认标签
      const finalTags = category === "casual"
        ? (subCategory ? [subCategory] : ["闲聊"])
        : (tags.length > 0 ? tags : ["综合讨论"]);
      const post = await createPost({
        title: title.trim(),
        body: body.trim(),
        tags: finalTags,
        category,
        subCategory: category === "casual" && subCategory ? subCategory : undefined,
      });
      if (post) {
        // 发帖成功后才记录频率限制
        rateLimiters.post.record();
        // 更新标签计数
        ensureTags(finalTags);
        clearDraft();
        toast.success("讨论已发布");
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
            tags: finalTags,
          },
        }).then(() => {
          // AI 回复已异步写入数据库
        }).catch((err) => {
          console.error("AI bot error:", err);
          toast.info("AI回复暂时不可用");
        });
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
      labelledById="post-dialog-title"
      maxWidthClass="max-w-2xl"
      paddingClass="p-7"
    >
      <div className="max-h-[90vh] overflow-y-auto">
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
          <h3 id="post-dialog-title" className="heading-display text-2xl text-parchment-50">
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
                  onClick={() => { setDraft({ title: "", body: "", tags: [], category: defaultCategory, subCategory: "" }); clearDraft(); }}
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
          {/* 分区选择 */}
          <div>
            <label className="mb-1.5 block text-xs text-mist-400">发布到</label>
            <div className="flex gap-2">
              {([
                { key: "academic" as PostCategory, label: "学术区", icon: GraduationCap },
                { key: "casual" as PostCategory, label: "闲聊区", icon: Coffee },
              ]).map((s) => {
                const Icon = s.icon;
                const isActive = category === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setCategory(s.key)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-all ${
                      isActive
                        ? "border-star-400/40 bg-star-400/10 text-parchment-100"
                        : "border-void-600/40 bg-void-900/30 text-mist-400 hover:border-mist-400/30"
                    }`}
                  >
                    <Icon size={14} /> {s.label}
                  </button>
                );
              })}
            </div>
          </div>
          {/* 闲聊区子分类 */}
          {category === "casual" && (
            <div>
              <label className="mb-1.5 block text-xs text-mist-400">子分类</label>
              <div className="flex flex-wrap gap-2">
                {CASUAL_SUB_CATEGORIES.map((sc) => (
                  <button
                    key={sc}
                    type="button"
                    onClick={() => setSubCategory(sc)}
                    className={`rounded-lg border px-3 py-1.5 text-xs transition-all ${
                      subCategory === sc
                        ? "border-tian-400/50 bg-tian-400/15 text-tian-100"
                        : "border-void-600/40 bg-void-900/30 text-mist-400 hover:border-mist-400/30"
                    }`}
                  >
                    {sc}
                  </button>
                ))}
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
              name="body"
              required
              rows={8}
              maxLength={10000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="详细描述你的问题背景、已尝试的方案、具体的卡点…"
              className="w-full resize-y rounded-lg border border-void-600/50 bg-void-950/50 p-3 text-sm leading-relaxed text-parchment-100 placeholder:text-mist-500 focus:border-star-400/50 focus:outline-none focus:ring-1 focus:ring-star-400/30"
            />
          </div>

          {/* 标签 - 仅学术区显示 */}
          {category === "academic" && (
            <div>
              <label className="mb-1.5 block text-xs text-mist-400">标签（最多 5 个）</label>
              <TagSelector value={tags} onChange={setTags} />
            </div>
          )}

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
      </div>
    </Dialog>
  );
}
