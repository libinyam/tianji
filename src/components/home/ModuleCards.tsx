import { Link } from "react-router-dom";
import { BookOpen, MessagesSquare, Lightbulb, PenLine, ArrowUpRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ModuleDef {
  index: string;
  to: string;
  icon: LucideIcon;
  title: string;
  desc: string;
  accent: string;
}

const MODULES: ModuleDef[] = [
  {
    index: "01",
    to: "/library",
    icon: BookOpen,
    title: "学习资源库",
    desc: "从机器学习理论到 GitHub、AI 编程工具与项目部署教程，按学习阶段系统整理的资源与实战案例。",
    accent: "#5aa6f0",
  },
  {
    index: "02",
    to: "/discussion",
    icon: MessagesSquare,
    title: "学问讨论",
    desc: "跨专业答疑与工具配置求助。从理论推导到 Codex、Claude Code、MCP 的使用，有人陪你打通每一步。",
    accent: "#f3c969",
  },
  {
    index: "03",
    to: "/ideas",
    icon: Lightbulb,
    title: "灵感广场",
    desc: "项目创意与研究思路的交流星图。把专业知识做成可展示的作品，让每一个念头都可能落地成 Demo。",
    accent: "#7cc4ff",
  },
  {
    index: "04",
    to: "/workshop",
    icon: PenLine,
    title: "协作工坊",
    desc: "多人协作的项目与文档创作空间，实时协同编辑、批注讨论，一起把零散知识打磨成完整的作品集。",
    accent: "#eccd6b",
  },
];

export default function ModuleCards() {
  return (
    <section className="container-tj py-12">
      <div className="mb-8 flex items-end justify-between gap-6">
        <div>
          <h2 className="heading-display text-2xl text-parchment-50 sm:text-3xl">
            四重路径，从理论走向真实作品
          </h2>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {MODULES.map((m) => {
          const Icon = m.icon;
          return (
            <Link
              key={m.to}
              to={m.to}
              className="group flex h-full flex-col rounded-lg border border-void-600/30 bg-void-800/20 p-5 transition-colors hover:bg-void-800/40"
            >
              <div className="flex items-center justify-between">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-lg border"
                  style={{
                    borderColor: `${m.accent}44`,
                    background: `${m.accent}12`,
                    color: m.accent,
                  }}
                >
                  <Icon size={18} strokeWidth={1.5} />
                </span>
                <span className="font-mono text-xs text-mist-500">{m.index}</span>
              </div>
              <h3 className="mt-4 heading-display text-lg text-parchment-50">
                {m.title}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-mist-400">
                {m.desc}
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs text-star-300 transition-all group-hover:gap-2">
                进入模块 <ArrowUpRight size={13} />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
