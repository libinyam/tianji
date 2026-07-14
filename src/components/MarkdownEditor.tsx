import { useRef, useState, useCallback } from "react";
import {
  Bold, Italic, Heading, Code, List, ListOrdered,
  Link as LinkIcon, Image as ImageIcon, Sigma, Eye, Pencil,
  Loader2,
} from "lucide-react";
import LazyMarkdownRenderer from "@/components/LazyMarkdownRenderer";
import { uploadFile } from "@/lib/storage";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/stores/toast";

interface MarkdownEditorProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
  /** 允许图片上传（默认 true） */
  allowImageUpload?: boolean;
  /** 紧凑模式：评论等小输入框，工具栏简化，无预览切换 */
  compact?: boolean;
  disabled?: boolean;
  className?: string;
  /** textarea name 属性 */
  name?: string;
}

interface InsertResult {
  value: string;
  selStart: number;
  selEnd: number;
}

/** 在选区两侧插入包裹符号（如 **、*、`） */
function wrapSelection(text: string, start: number, end: number, before: string, after: string, placeholder: string): InsertResult {
  const selected = text.slice(start, end);
  const insertText = before + (selected || placeholder) + after;
  const newValue = text.slice(0, start) + insertText + text.slice(end);
  const newSelStart = start + before.length;
  const newSelEnd = newSelStart + (selected || placeholder).length;
  return { value: newValue, selStart: newSelStart, selEnd: newSelEnd };
}

/** 在当前行首插入前缀（如 #、-、1.） */
function insertAtLineStart(text: string, start: number, prefix: string): InsertResult {
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const newValue = text.slice(0, lineStart) + prefix + text.slice(lineStart);
  const newSelStart = start + prefix.length;
  const newSelEnd = newSelStart;
  return { value: newValue, selStart: newSelStart, selEnd: newSelEnd };
}

/** 在光标处插入块级内容（如代码块、公式块），前后各空一行 */
function insertBlock(text: string, start: number, end: number, block: string): InsertResult {
  const selected = text.slice(start, end);
  const content = selected || "在此输入";
  const fullBlock = block.replace("{content}", content);
  // 确保块前后有换行
  const needLeadingNl = start > 0 && text[start - 1] !== "\n";
  const needTrailingNl = end < text.length && text[end] !== "\n";
  const insertText = (needLeadingNl ? "\n" : "") + fullBlock + (needTrailingNl ? "\n" : "");
  const newValue = text.slice(0, start) + insertText + text.slice(end);
  // 光标移到块内 content 位置
  const contentIdx = insertText.indexOf(content);
  const newSelStart = start + contentIdx;
  const newSelEnd = newSelStart + content.length;
  return { value: newValue, selStart: newSelStart, selEnd: newSelEnd };
}

/**
 * #148 Markdown 编辑器
 *
 * 特性：
 * - 工具栏：加粗/斜体/标题/代码/列表/链接/图片/公式
 * - 编辑/预览 Tab 切换（compact 模式无预览）
 * - 图片上传到 CloudBase 存储，插入 cloud:// fileID
 * - 兼容现有 useDraft 草稿机制（value/onChange 受控）
 */
export default function MarkdownEditor({
  value,
  onChange,
  placeholder = "支持 Markdown 与 LaTeX 公式…",
  maxLength,
  rows = 8,
  allowImageUpload = true,
  compact = false,
  disabled = false,
  className = "",
  name,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [uploading, setUploading] = useState(false);
  const { user } = useAuthStore();

  /** 应用插入结果到 textarea，并恢复焦点/选区 */
  const applyInsert = useCallback((result: InsertResult) => {
    onChange(result.value);
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (ta) {
        ta.focus();
        ta.setSelectionRange(result.selStart, result.selEnd);
      }
    });
  }, [onChange]);

  /** 获取当前选区并执行插入 */
  const handleWrap = useCallback((before: string, after: string, placeholder: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const result = wrapSelection(value, ta.selectionStart, ta.selectionEnd, before, after, placeholder);
    applyInsert(result);
  }, [value, applyInsert]);

  const handleLineStart = useCallback((prefix: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const result = insertAtLineStart(value, ta.selectionStart, prefix);
    applyInsert(result);
  }, [value, applyInsert]);

  const handleBlock = useCallback((block: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const result = insertBlock(value, ta.selectionStart, ta.selectionEnd, block);
    applyInsert(result);
  }, [value, applyInsert]);

  /** 图片上传：上传到 CloudBase 存储，插入 cloud:// fileID */
  const handleImageUpload = useCallback(async (file: File) => {
    if (!user) {
      toast.error("请先登录后再上传图片");
      return;
    }
    // 5MB 限制
    if (file.size > 5 * 1024 * 1024) {
      toast.error("图片大小不能超过 5MB");
      return;
    }
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("仅支持 PNG / JPEG / WebP / GIF 格式");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const cloudPath = `post-images/${user.uid}-${Date.now()}.${ext}`;
      const fileID = await uploadFile(cloudPath, file as unknown as string);
      // 插入 Markdown 图片语法，使用 cloud:// fileID（渲染时兑换）
      const altText = file.name.replace(/\.[^.]+$/, "").slice(0, 50) || "图片";
      const ta = textareaRef.current;
      if (!ta) return;
      const insertText = `\n![${altText}](${fileID})\n`;
      const start = ta.selectionStart;
      const newValue = value.slice(0, start) + insertText + value.slice(start);
      onChange(newValue);
      requestAnimationFrame(() => {
        const t = textareaRef.current;
        if (t) {
          t.focus();
          t.setSelectionRange(start + insertText.length, start + insertText.length);
        }
      });
      toast.success("图片已上传");
    } catch (e) {
      console.error("图片上传失败:", e);
      toast.error("图片上传失败，请重试");
    } finally {
      setUploading(false);
    }
  }, [user, value, onChange]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
    // 重置 input 以便重复选择同一文件
    e.target.value = "";
  };

  // 工具栏按钮配置
  const toolbarButtons = compact
    ? [
        { icon: Bold, title: "加粗", action: () => handleWrap("**", "**", "加粗文本") },
        { icon: Italic, title: "斜体", action: () => handleWrap("*", "*", "斜体文本") },
        { icon: Code, title: "行内代码", action: () => handleWrap("`", "`", "code") },
        { icon: LinkIcon, title: "链接", action: () => handleWrap("[", "](https://)", "链接文字") },
      ]
    : [
        { icon: Bold, title: "加粗 (**)", action: () => handleWrap("**", "**", "加粗文本") },
        { icon: Italic, title: "斜体 (*)", action: () => handleWrap("*", "*", "斜体文本") },
        { icon: Heading, title: "标题 (##)", action: () => handleLineStart("## ") },
        { icon: Code, title: "行内代码", action: () => handleWrap("`", "`", "code") },
        { icon: List, title: "无序列表 (-)", action: () => handleLineStart("- ") },
        { icon: ListOrdered, title: "有序列表 (1.)", action: () => handleLineStart("1. ") },
        { icon: LinkIcon, title: "链接", action: () => handleWrap("[", "](https://)", "链接文字") },
        { icon: Sigma, title: "行内公式 ($...$)", action: () => handleWrap("$", "$", "E=mc^2") },
        { icon: Sigma, title: "块级公式 ($$...$$)", action: () => handleBlock("$$\n{content}\n$$") },
      ];

  // compact 模式图片按钮单独处理（避免重复）
  const showImageButton = allowImageUpload && !disabled;

  return (
    <div className={`overflow-hidden rounded-lg border border-void-600/50 bg-void-950/50 ${className}`}>
      {/* 工具栏 */}
      <div className="flex items-center gap-0.5 border-b border-void-600/30 bg-void-800/30 px-2 py-1.5">
        {toolbarButtons.map((btn, i) => {
          const Icon = btn.icon;
          return (
            <button
              key={i}
              type="button"
              title={btn.title}
              aria-label={btn.title}
              onMouseDown={(e) => { e.preventDefault(); btn.action(); }}
              disabled={disabled || uploading}
              className="flex h-7 w-7 items-center justify-center rounded text-mist-400 transition-colors hover:bg-void-700/60 hover:text-parchment-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icon size={14} />
            </button>
          );
        })}
        {/* 代码块按钮（非 compact） */}
        {!compact && (
          <button
            type="button"
            title="代码块"
            aria-label="代码块"
            onMouseDown={(e) => { e.preventDefault(); handleBlock("```\n{content}\n```"); }}
            disabled={disabled || uploading}
            className="flex h-7 items-center justify-center rounded px-1.5 text-[10px] font-mono text-mist-400 transition-colors hover:bg-void-700/60 hover:text-parchment-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {"</>"}
          </button>
        )}
        {/* 图片上传按钮 */}
        {showImageButton && (
          <button
            type="button"
            title="上传图片"
            aria-label="上传图片"
            onMouseDown={(e) => { e.preventDefault(); fileInputRef.current?.click(); }}
            disabled={disabled || uploading}
            className="flex h-7 w-7 items-center justify-center rounded text-mist-400 transition-colors hover:bg-void-700/60 hover:text-parchment-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
          onChange={onFileChange}
          className="hidden"
          disabled={disabled}
        />
        {/* 预览切换（非 compact） */}
        {!compact && (
          <div className="ml-auto flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setMode("edit")}
              className={`flex h-7 items-center gap-1 rounded px-2 text-xs transition-colors ${
                mode === "edit" ? "bg-void-700/60 text-parchment-100" : "text-mist-400 hover:text-parchment-100"
              }`}
            >
              <Pencil size={12} /> 编辑
            </button>
            <button
              type="button"
              onClick={() => setMode("preview")}
              className={`flex h-7 items-center gap-1 rounded px-2 text-xs transition-colors ${
                mode === "preview" ? "bg-void-700/60 text-parchment-100" : "text-mist-400 hover:text-parchment-100"
              }`}
            >
              <Eye size={12} /> 预览
            </button>
          </div>
        )}
      </div>

      {/* 编辑区 / 预览区 */}
      {mode === "edit" || compact ? (
        <textarea
          ref={textareaRef}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={rows}
          disabled={disabled}
          className="w-full resize-y bg-transparent p-3 text-sm leading-relaxed text-parchment-100 placeholder:text-mist-500 focus:outline-none disabled:opacity-50"
        />
      ) : (
        <div
          className="min-h-[calc(var(--rows,8)*1.5rem+1.5rem)] p-3 text-sm leading-relaxed text-parchment-100"
          style={{ "--rows": String(rows) } as React.CSSProperties}
        >
          {value.trim() ? (
            <LazyMarkdownRenderer content={value} />
          ) : (
            <p className="text-mist-500">暂无内容可预览</p>
          )}
        </div>
      )}
    </div>
  );
}
