import { useMemo } from "react";
import katex from "katex";

interface Segment {
  type: "text" | "inline" | "block";
  value: string;
}

function parseMath(content: string): Segment[] {
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
    // 再按行内 $...$ 切分
    const inlineParts = block.split(/(\$[^$\n]+?\$)/g);
    for (const inline of inlineParts) {
      if (!inline) continue;
      const inlineMatch = /^\$([^$\n]+?)\$$/.exec(inline);
      if (inlineMatch) {
        segments.push({ type: "inline", value: inlineMatch[1] });
      } else {
        segments.push({ type: "text", value: inline });
      }
    }
  }
  return segments;
}

function renderTex(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      output: "html",
    });
  } catch {
    return tex;
  }
}

interface MathTextProps {
  content: string;
  className?: string;
}

/** 解析含 $...$ 与 $$...$$ 的文本并渲染 KaTeX。 */
export default function MathText({ content, className = "" }: MathTextProps) {
  const segments = useMemo(() => parseMath(content), [content]);

  return (
    <div className={className}>
      {segments.map((seg, i) => {
        if (seg.type === "block") {
          return (
            <div
              key={i}
              className="my-4 overflow-x-auto py-2 text-star-200"
              dangerouslySetInnerHTML={{ __html: renderTex(seg.value, true) }}
            />
          );
        }
        if (seg.type === "inline") {
          return (
            <span
              key={i}
              className="text-star-100"
              dangerouslySetInnerHTML={{ __html: renderTex(seg.value, false) }}
            />
          );
        }
        return <span key={i}>{seg.value}</span>;
      })}
    </div>
  );
}
