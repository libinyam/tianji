import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { escapeHtml } from "@/lib/security";

interface Segment {
  type: "text" | "inline" | "block" | "code" | "codeblock";
  value: string;
}

function parseContent(content: string): Segment[] {
  const segments: Segment[] = [];
  // 先按块级 $$...$$ 切分
  const blockParts = content.split(/(\$\$[\s\S]+?\$\$)/g);
  for (const block of blockParts) {
    if (!block) continue;
    const blockMatch = /^\$\$([\s\S]+?)\$\$$/.exec(block);
    if (blockMatch) {
      segments.push({ type: "block", value: blockMatch[1] });
      continue;
    }
    // 再按代码块 ```...``` 切分
    const codeBlockParts = block.split(/(```[\s\S]+?```)/g);
    for (const cb of codeBlockParts) {
      if (!cb) continue;
      const cbMatch = /^```([\s\S]+?)```$/.exec(cb);
      if (cbMatch) {
        segments.push({ type: "codeblock", value: cbMatch[1].replace(/^\n/, "") });
        continue;
      }
      // 行内：按 $...$ 与 `...` 交替切分
      const inlineParts = cb.split(/(\$[^$\n]+?\$|`[^`\n]+?`)/g);
      for (const inline of inlineParts) {
        if (!inline) continue;
        const mathMatch = /^\$([^$\n]+?)\$$/.exec(inline);
        if (mathMatch) {
          segments.push({ type: "inline", value: mathMatch[1] });
          continue;
        }
        const codeMatch = /^`([^`\n]+?)`$/.exec(inline);
        if (codeMatch) {
          segments.push({ type: "code", value: codeMatch[1] });
          continue;
        }
        segments.push({ type: "text", value: inline });
      }
    }
  }
  return segments;
}

function decodeMathEntities(tex: string): string {
  return tex
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function renderTex(tex: string, displayMode: boolean): string {
  try {
    const normalizedTex = decodeMathEntities(tex);
    return katex.renderToString(normalizedTex, {
      displayMode,
      throwOnError: false,
      output: "html",
      trust: false,
      strict: "warn",
    });
  } catch {
    return escapeHtml(tex);
  }
}

interface MathTextProps {
  content: string;
  className?: string;
}

/** 解析含 $...$、$$...$$ 与 `...`、```...``` 的文本并分别渲染。 */
export default function MathText({ content, className = "" }: MathTextProps) {
  const segments = useMemo(() => parseContent(content), [content]);

  return (
    <div className={`whitespace-pre-line ${className}`}>
      {segments.map((seg, i) => {
        if (seg.type === "block") {
          return (
            <div
              key={i}
              className="math-display my-4 overflow-x-auto py-2"
              dangerouslySetInnerHTML={{ __html: renderTex(seg.value, true) }}
            />
          );
        }
        if (seg.type === "inline") {
          return (
            <span
              key={i}
              className="math-inline"
              dangerouslySetInnerHTML={{ __html: renderTex(seg.value, false) }}
            />
          );
        }
        if (seg.type === "code") {
          return (
            <code
              key={i}
              className="mx-0.5 rounded bg-void-700/70 px-1.5 py-0.5 font-mono text-[0.85em] text-tian-200"
            >
              {seg.value}
            </code>
          );
        }
        if (seg.type === "codeblock") {
          return (
            <pre
              key={i}
              className="my-3 overflow-x-auto rounded-lg border border-void-600/50 bg-void-950/70 p-3 font-mono text-xs leading-relaxed text-tian-100"
            >
              <code>{seg.value}</code>
            </pre>
          );
        }
        return <span key={i}>{seg.value}</span>;
      })}
    </div>
  );
}
