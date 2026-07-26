import { useState, useEffect, useMemo, memo, type ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
// #424 语言裁剪：默认 common 集打包约 37 种语言（fortran/perl 等纯属死重），
// 按社区实际内容注册常用集，MarkdownRenderer chunk 预计减 30-40KB gzip。
// 未注册语言的代码块正常渲染、仅无高亮；需要新语言时在此补注册。
import langJavascript from "highlight.js/lib/languages/javascript";
import langTypescript from "highlight.js/lib/languages/typescript";
import langPython from "highlight.js/lib/languages/python";
import langBash from "highlight.js/lib/languages/bash";
import langJson from "highlight.js/lib/languages/json";
import langMarkdown from "highlight.js/lib/languages/markdown";
import langXml from "highlight.js/lib/languages/xml";
import langCss from "highlight.js/lib/languages/css";
import langSql from "highlight.js/lib/languages/sql";
import langJava from "highlight.js/lib/languages/java";
import langCpp from "highlight.js/lib/languages/cpp";
import langPlaintext from "highlight.js/lib/languages/plaintext";
import "katex/dist/katex.min.css";
import "highlight.js/styles/github.css";

const HIGHLIGHT_LANGUAGES = {
  javascript: langJavascript,
  typescript: langTypescript,
  python: langPython,
  bash: langBash,
  json: langJson,
  markdown: langMarkdown,
  xml: langXml,
  css: langCss,
  sql: langSql,
  java: langJava,
  cpp: langCpp,
  plaintext: langPlaintext,
};
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
    return () => {
      mounted = false;
    };
  }, [src]);

  if (status === "loading") {
    return (
      <div className="my-3 flex items-center justify-center rounded-lg border border-void-600 bg-void-700 py-8 text-xs text-mist-500">
        图片加载中…
      </div>
    );
  }
  if (status === "error" || !url) {
    return <span className="text-xs text-red-500">[图片加载失败]</span>;
  }
  return (
    <img
      src={url}
      alt={alt ?? ""}
      title={title}
      loading="lazy"
      className="my-3 max-w-full rounded-lg border border-void-600"
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
 * - 代码块语法高亮（rehype-highlight + github 浅色主题）
 * - cloud:// fileID 图片自动兑换临时 URL
 *
 * 替代 LazyMathText 用于新内容渲染。旧内容（纯文本 + $...$）向后兼容。
 *
 * #408 用 React.memo 包裹：详情页输入回答/评论时整页重渲染，若无 memo，
 * 正文和每条回答/评论都会在每个按键上重跑 remark/KaTeX/highlight 解析。
 */
function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  const components = useMemo(
    () => ({
      // 图片：处理 cloud:// fileID
      img: ({ src, alt, title }: { src?: string; alt?: string; title?: string }) => (
        <CloudImage src={src} alt={alt} title={title} />
      ),
      // 代码块容器：rehype-highlight 处理后的 pre
      pre: ({ children }: ComponentPropsWithoutRef<"pre">) => (
        <pre className="my-3 overflow-x-auto rounded-lg border border-void-600 bg-void-700 p-3 font-mono text-xs leading-relaxed">
          {children}
        </pre>
      ),
      // code：区分行内代码与代码块（rehype-highlight 给代码块加 hljs class）
      code: ({
        className: cn,
        children,
        ...rest
      }: ComponentPropsWithoutRef<"code"> & { className?: string }) => {
        const isBlock = cn && (cn.includes("hljs") || cn.includes("language-"));
        if (isBlock) {
          return (
            <code className={cn} {...rest}>
              {children}
            </code>
          );
        }
        // 行内代码
        return (
          <code
            className="mx-0.5 rounded bg-void-700 px-1.5 py-0.5 font-mono text-[0.85em] text-parchment-100"
            {...rest}
          >
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
          className="text-tian-500 underline underline-offset-2 transition-colors hover:text-tian-600"
          {...rest}
        >
          {children}
        </a>
      ),
      // 引用块
      blockquote: ({ children }: ComponentPropsWithoutRef<"blockquote">) => (
        <blockquote className="my-3 border-l-2 border-void-600 bg-void-700 py-2 pl-4 text-mist-400">
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
        <th className="border border-void-600 bg-void-700 px-3 py-1.5 text-left text-parchment-100">
          {children}
        </th>
      ),
      td: ({ children }: ComponentPropsWithoutRef<"td">) => (
        <td className="border border-void-600 px-3 py-1.5 text-mist-300">{children}</td>
      ),
    }),
    [],
  );

  return (
    <div className={`markdown-body break-words ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[
          [rehypeKatex, { strict: false, throwOnError: false }],
          [rehypeHighlight, { languages: HIGHLIGHT_LANGUAGES }],
        ]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default memo(MarkdownRenderer);
