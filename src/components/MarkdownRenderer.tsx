import { useState, useEffect, useMemo, type ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import "katex/dist/katex.min.css";
import "highlight.js/styles/github-dark.css";
import { getTempFileURL } from "@/lib/storage";

// #148 cloud:// fileID 兑换缓存，避免同一图片重复兑换
const fileUrlCache = new Map<string, string>();

/** 处理 cloud:// fileID 图片：异步兑换临时 URL，其他 src 直接透传 */
function CloudImage({ src, alt, title }: { src?: string; alt?: string; title?: string }) {
  const [url, setUrl] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");

  useEffect(() => {
    if (!src) {
      setStatus("error");
      return;
    }
    // 非 cloud:// 直接使用
    if (!src.startsWith("cloud://")) {
      setUrl(src);
      setStatus("done");
      return;
    }
    // 命中缓存
    const cached = fileUrlCache.get(src);
    if (cached) {
      setUrl(cached);
      setStatus("done");
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const tempUrl = await getTempFileURL(src);
        if (!mounted) return;
        if (tempUrl) {
          fileUrlCache.set(src, tempUrl);
          setUrl(tempUrl);
          setStatus("done");
        } else {
          setStatus("error");
        }
      } catch {
        if (mounted) setStatus("error");
      }
    })();
    return () => { mounted = false; };
  }, [src]);

  if (status === "loading") {
    return (
      <div className="my-3 flex items-center justify-center rounded-lg border border-void-600/40 bg-void-800/30 py-8 text-xs text-mist-500">
        图片加载中…
      </div>
    );
  }
  if (status === "error" || !url) {
    return (
      <span className="text-xs text-red-400">[图片加载失败]</span>
    );
  }
  return (
    <img
      src={url}
      alt={alt ?? ""}
      title={title}
      loading="lazy"
      className="my-3 max-w-full rounded-lg border border-void-600/40"
    />
  );
}

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * #148 Markdown 渲染组件
 *
 * 基于 react-markdown，支持：
 * - GitHub Flavored Markdown（表格、删除线、任务列表）
 * - KaTeX 公式（$...$ 行内，$$...$$ 块级）——兼容旧 MathText 语法
 * - 代码块语法高亮（rehype-highlight + github-dark 主题）
 * - cloud:// fileID 图片自动兑换临时 URL
 *
 * 替代 LazyMathText 用于新内容渲染。旧内容（纯文本 + $...$）向后兼容。
 */
export default function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  const components = useMemo(() => ({
    // 图片：处理 cloud:// fileID
    img: ({ src, alt, title }: { src?: string; alt?: string; title?: string }) => (
      <CloudImage src={src} alt={alt} title={title} />
    ),
    // 代码块容器：rehype-highlight 处理后的 pre
    pre: ({ children }: ComponentPropsWithoutRef<"pre">) => (
      <pre className="my-3 overflow-x-auto rounded-lg border border-void-600/50 bg-void-950/70 p-3 font-mono text-xs leading-relaxed">
        {children}
      </pre>
    ),
    // code：区分行内代码与代码块（rehype-highlight 给代码块加 hljs class）
    code: ({ className: cn, children, ...rest }: ComponentPropsWithoutRef<"code"> & { className?: string }) => {
      const isBlock = cn && (cn.includes("hljs") || cn.includes("language-"));
      if (isBlock) {
        return <code className={cn} {...rest}>{children}</code>;
      }
      // 行内代码
      return (
        <code className="mx-0.5 rounded bg-void-700/70 px-1.5 py-0.5 font-mono text-[0.85em] text-tian-200" {...rest}>
          {children}
        </code>
      );
    },
    // 链接：安全打开新窗口
    a: ({ href, children, ...rest }: ComponentPropsWithoutRef<"a">) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-tian-300 underline decoration-tian-400/30 underline-offset-2 transition-colors hover:text-tian-200 hover:decoration-tian-400/60"
        {...rest}
      >
        {children}
      </a>
    ),
    // 引用块
    blockquote: ({ children }: ComponentPropsWithoutRef<"blockquote">) => (
      <blockquote className="my-3 border-l-2 border-star-400/40 bg-star-400/5 py-2 pl-4 text-mist-300">
        {children}
      </blockquote>
    ),
    // 表格
    table: ({ children }: ComponentPropsWithoutRef<"table">) => (
      <div className="my-3 overflow-x-auto">
        <table className="w-full border-collapse text-sm">{children}</table>
      </div>
    ),
    th: ({ children }: ComponentPropsWithoutRef<"th">) => (
      <th className="border border-void-600/40 bg-void-800/50 px-3 py-1.5 text-left text-parchment-100">{children}</th>
    ),
    td: ({ children }: ComponentPropsWithoutRef<"td">) => (
      <td className="border border-void-600/40 px-3 py-1.5 text-mist-300">{children}</td>
    ),
  }), []);

  return (
    <div className={`markdown-body break-words ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[
          [rehypeKatex, { strict: false, throwOnError: false }],
          rehypeHighlight,
        ]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
