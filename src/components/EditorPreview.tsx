import {
  Bold,
  Italic,
  Sigma,
  List,
  MessageSquare,
  Highlighter,
  PenLine,
  Circle,
} from "lucide-react";
import LazyMathText from "@/components/LazyMathText";

const CONTENT = `本章我们从链式法则出发，重新审视反向传播。设前向计算为 $z = Wa + b$，激活 $a' = \\sigma(z)$，则损失对参数的梯度可写作：

$$\\frac{\\partial L}{\\partial W} = \\delta \\, a^\\top, \\quad \\delta = \\frac{\\partial L}{\\partial a'} \\odot \\sigma'(z)$$

其中 $\\delta$ 即反向传播中的误差信号。这一形式揭示了：每一层的梯度仅依赖局部的雅可比与后传误差，因而可在计算图上高效求解。`;

const COMMENTS = [
  {
    author: "陆星阑",
    color: "#5aa6f0",
    text: "建议补充 $\\sigma'(z)$ 在 ReLU 情形下的次梯度讨论。",
    line: "第 12 行",
  },
  {
    author: "沈砚书",
    color: "#7cc4ff",
    text: "这里用 $\\odot$ 表示逐元素乘积，需在符号表前置说明。",
    line: "公式块",
  },
  {
    author: "秦望舒",
    color: "#f3c969",
    text: "可加一节，将此推导与自动微分的前向/反向模式复杂度对比相联系。",
    line: "段末",
  },
];

const TOOLS = [Bold, Italic, Sigma, List, Highlighter, MessageSquare];

export default function EditorPreview() {
  return (
    <div className="card-surface overflow-hidden">
      {/* 编辑器顶栏 */}
      <div className="flex items-center justify-between border-b border-void-600 bg-void-700 px-5 py-3">
        <div className="flex items-center gap-3">
          <PenLine size={15} className="text-tian-500" />
          <span className="text-sm text-parchment-100">深度学习入门：从理论到实现</span>
          <span className="pill-blue">第三章 · 链式法则与反向传播</span>
        </div>
        <div className="flex items-center gap-2">
          {/* 协作者在线指示 */}
          <div className="flex -space-x-1.5">
            {[
              { c: "#5aa6f0", n: "陆" },
              { c: "#7cc4ff", n: "沈" },
              { c: "#f3c969", n: "秦" },
            ].map((u, i) => (
              <span
                key={i}
                className="relative flex h-6 w-6 items-center justify-center rounded-full border-2 border-void-800 font-display text-[10px] text-white"
                style={{ background: u.c }}
              >
                {u.n}
                <Circle
                  size={6}
                  className="absolute -bottom-0.5 -right-0.5 fill-emerald-500 text-emerald-500"
                />
              </span>
            ))}
          </div>
          <span className="text-xs text-mist-400">3 人在线</span>
        </div>
      </div>

      {/* 工具栏 */}
      <div className="flex items-center gap-1 border-b border-void-600 px-4 py-2">
        {TOOLS.map((Icon, i) => (
          <button
            key={i}
            className="flex h-8 w-8 items-center justify-center rounded-md text-mist-400 transition-colors hover:bg-void-700 hover:text-tian-500"
          >
            <Icon size={15} />
          </button>
        ))}
        <span className="mx-2 h-5 w-px bg-void-600" />
        <span className="text-xs text-mist-500">自动保存 · 2 秒前</span>
      </div>

      <div className="grid lg:grid-cols-[1fr_280px]">
        {/* 正文 */}
        <div className="p-6 sm:p-8">
          <div className="prose-tj">
            <h3 className="heading-display text-xl text-parchment-50">3.2 链式法则与误差反传</h3>
            <LazyMathText
              content={CONTENT}
              className="mt-4 text-[15px] leading-relaxed text-parchment-200"
            />
          </div>
        </div>

        {/* 批注侧栏 */}
        <aside className="border-t border-void-600 bg-void-700 p-4 lg:border-l lg:border-t-0">
          <div className="mb-4 flex items-center gap-2">
            <MessageSquare size={14} className="text-tian-500" />
            <h4 className="text-xs font-medium text-tian-500">批注 · 3</h4>
          </div>
          <div className="space-y-3">
            {COMMENTS.map((c, i) => (
              <div key={i} className="rounded-lg border border-void-600 bg-void-800 p-3">
                <div className="flex items-center justify-between">
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full font-display text-[10px] text-white"
                    style={{ background: c.color }}
                  >
                    {c.author.charAt(0)}
                  </span>
                  <span className="text-[10px] text-mist-500">{c.line}</span>
                </div>
                <LazyMathText
                  content={c.text}
                  className="mt-2 text-xs leading-relaxed text-mist-300"
                />
                <span className="mt-1 block text-[10px] text-mist-500">{c.author}</span>
              </div>
            ))}
          </div>
          <button className="mt-3 w-full rounded-lg border border-dashed border-void-600 py-2 text-xs text-mist-500 transition-colors hover:border-tian-500 hover:text-tian-500">
            + 添加批注
          </button>
        </aside>
      </div>
    </div>
  );
}
