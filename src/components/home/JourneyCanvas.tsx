/**
 * DESIGN REMINDER — Guided Editorial: this canvas explains the learner outcome with real product language,
 * using the path from resources to an exhibit-ready project rather than decorative AI imagery.
 */
import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Lightbulb,
  MessageCircleQuestion,
  PenLine,
  Presentation,
  type LucideIcon,
} from "lucide-react";

interface JourneyStage {
  id: string;
  number: string;
  label: string;
  subtitle: string;
  evidence: string;
  result: string;
  icon: LucideIcon;
  position: string;
}

const STAGES: JourneyStage[] = [
  {
    id: "resources",
    number: "01",
    label: "资料",
    subtitle: "发现资料",
    evidence: "学习路径 · 已编排",
    result: "从一份学习路线开始，建立可行动的知识底座。",
    icon: BookOpen,
    position: "left-[5%] top-[18%]",
  },
  {
    id: "question",
    number: "02",
    label: "问题",
    subtitle: "提出问题",
    evidence: "主题行 · 等待回应",
    result: "把卡住的推导写成可被回应、引用与采纳的问题。",
    icon: MessageCircleQuestion,
    position: "right-[5%] top-[18%]",
  },
  {
    id: "idea",
    number: "03",
    label: "灵感",
    subtitle: "沉淀灵感",
    evidence: "灵感卡 · 关联来源",
    result: "将讨论里的方法沉淀为可验证的项目假设与下一步。",
    icon: Lightbulb,
    position: "bottom-[30%] left-[5%]",
  },
  {
    id: "collaboration",
    number: "04",
    label: "协作",
    subtitle: "组队共创",
    evidence: "共笔文档 · 在线批注",
    result: "在共笔和批注中，让零散能力变成共同推进的成果。",
    icon: PenLine,
    position: "bottom-[30%] right-[5%]",
  },
  {
    id: "portfolio",
    number: "05",
    label: "作品",
    subtitle: "展示作品",
    evidence: "项目卡 · 可公开展示",
    result: "把过程和结果整理为可以持续迭代的项目卡。",
    icon: Presentation,
    position: "bottom-[9%] right-[24%]",
  },
];

export default function JourneyCanvas() {
  const [activeStage, setActiveStage] = useState(STAGES[0]);

  return (
    <section
      className="relative h-[430px] overflow-hidden rounded-xl border border-void-600 bg-void-700/55 p-5 shadow-card sm:h-[470px]"
      aria-label="资料、答疑、灵感、协作和作品构成的天玑成长路径"
    >
      <div className="absolute inset-0 opacity-[0.1] [background-image:radial-gradient(var(--c-tian-500)_1px,transparent_1px)] [background-size:24px_24px]" />
      <div className="relative z-10 flex items-center justify-between font-mono text-[10px] tracking-[0.14em] text-mist-500">
        <span>GROWTH CANVAS</span>
        <span>01 — 05</span>
      </div>

      <svg className="absolute inset-5 h-[calc(100%-40px)] w-[calc(100%-40px)]" viewBox="0 0 640 430" aria-hidden="true">
        <path
          d="M104 110 C172 58 236 88 306 175 S404 195 474 130 S545 146 576 214"
          className="fill-none stroke-tian-500/70 [stroke-dasharray:3_5]"
          strokeWidth="1.8"
        />
        <path
          d="M306 175 C282 250 331 290 402 303 S493 330 538 369"
          className="fill-none stroke-mist-500/50 [stroke-dasharray:3_5]"
          strokeWidth="1.5"
        />
        <circle cx="306" cy="175" r="6" className="fill-tian-500" />
      </svg>

      <div className="absolute left-[43%] top-[36%] z-10 grid h-20 w-20 place-items-center rounded-full border border-tian-300 bg-void-800 text-center shadow-card ring-8 ring-tian-500/10">
        <span className="block font-display text-xl font-semibold text-parchment-50">你</span>
        <span className="mt-[-15px] block text-[9px] text-mist-500">从这里出发</span>
      </div>

      {STAGES.map((stage) => {
        const Icon = stage.icon;
        const isActive = activeStage.id === stage.id;
        return (
          <button
            key={stage.id}
            type="button"
            className={`absolute z-20 flex min-w-[120px] items-center gap-2 rounded-lg border p-2 text-left transition-all duration-200 ${stage.position} ${
              isActive
                ? "border-tian-300 bg-void-800 shadow-card"
                : "border-transparent bg-void-800/80 hover:border-tian-300 hover:bg-void-800"
            }`}
            onClick={() => setActiveStage(stage)}
            onFocus={() => setActiveStage(stage)}
            aria-pressed={isActive}
          >
            <span className="font-mono text-[9px] text-mist-500">{stage.number}</span>
            <span className="grid h-7 w-7 place-items-center rounded-md bg-tian-50 text-tian-500">
              <Icon size={15} />
            </span>
            <span className="grid gap-0.5">
              <b className="text-xs text-parchment-50">{stage.label}</b>
              <small className="text-[9px] text-mist-400">{stage.subtitle}</small>
            </span>
          </button>
        );
      })}

      <div className="absolute bottom-4 left-4 right-4 z-30 rounded-lg border border-void-600 bg-void-800/95 px-4 py-3 shadow-card">
        <p className="font-mono text-[9px] tracking-[0.08em] text-tian-500">{activeStage.evidence}</p>
        <p className="mt-1 text-xs leading-relaxed text-mist-400">{activeStage.result}</p>
        <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-tian-500">
          查看这一阶段 <ArrowRight size={13} />
        </span>
      </div>
    </section>
  );
}
