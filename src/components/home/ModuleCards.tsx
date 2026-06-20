import { Link } from "react-router-dom";
import { motion } from "motion/react";
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
    desc: "从机器学习理论到 GitHub、AI 编程工具与项目部署教程，按学习阶段系统整理的资源与实战案例，降低新手入门试错成本。",
    accent: "#5aa6f0",
  },
  {
    index: "02",
    to: "/discussion",
    icon: MessagesSquare,
    title: "学问讨论",
    desc: "跨专业答疑与工具配置求助。从理论推导到 Codex、Claude Code、MCP 的使用，有人陪你打通从理论到实战的每一步。",
    accent: "#f3c969",
  },
  {
    index: "03",
    to: "/ideas",
    icon: Lightbulb,
    title: "灵感广场",
    desc: "项目创意与研究思路的交流星图。把专业知识做成可展示的作品，让每一个萌芽的念头都可能落地成 Demo。",
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
    <section className="container-tj py-20">
      <div className="mb-10 flex items-end justify-between gap-6">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="h-px w-8 bg-gradient-to-r from-transparent to-star-400" />
            <span className="font-mono text-xs uppercase tracking-[0.25em] text-star-300">
              四象 · 核心模块
            </span>
          </div>
          <h2 className="heading-display text-3xl text-parchment-50 sm:text-4xl">
            四重路径，从理论走向真实作品
          </h2>
        </div>
        <p className="hidden max-w-xs text-sm leading-relaxed text-mist-400 lg:block">
          每一个模块都是一颗引路星辰，指引你从学知识到做项目，从个体摸索到协同共创。
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {MODULES.map((m, i) => {
          const Icon = m.icon;
          return (
            <motion.div
              key={m.to}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <Link
                to={m.to}
                className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-void-600/50 bg-void-800/40 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-star-400/40 hover:bg-void-700/40"
              >
                {/* 悬浮辉光 */}
                <div
                  className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-40"
                  style={{ background: m.accent }}
                />
                <div className="relative flex items-center justify-between">
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-lg border"
                    style={{
                      borderColor: `${m.accent}55`,
                      background: `${m.accent}14`,
                      color: m.accent,
                    }}
                  >
                    <Icon size={20} strokeWidth={1.5} />
                  </span>
                  <span className="font-mono text-xs text-mist-500">{m.index}</span>
                </div>
                <h3 className="relative mt-5 heading-display text-xl text-parchment-50">
                  {m.title}
                </h3>
                <p className="relative mt-2.5 flex-1 text-sm leading-relaxed text-mist-400">
                  {m.desc}
                </p>
                <span className="relative mt-5 inline-flex items-center gap-1 text-xs text-star-300 transition-all group-hover:gap-2">
                  进入模块 <ArrowUpRight size={13} />
                </span>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
