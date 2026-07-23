import { Link } from "react-router-dom";
import {
  BookOpen,
  MessageSquare,
  Lightbulb,
  Users,
  Trophy,
  ArrowRight,
  Compass,
} from "lucide-react";
import PageHero from "@/components/PageHero";
import { useSEO } from "@/hooks/useSEO";

/** 成长路径的 5 个阶段 */
const STAGES = [
  {
    step: 1,
    icon: BookOpen,
    title: "学习资源",
    subtitle: "找到该学什么",
    description: "资源库提供结构化学习材料——书籍、教程、项目实战指南。按难度分级，从入门到进阶，配套目录与摘要，帮你判断「该学什么、学到什么程度够用」。",
    link: "/library",
    linkLabel: "浏览资源库",
    example: { to: "/library", label: "C++ Primer / Effective C++ / CLI Notes 教程" },
    accent: "#60a5fa",
  },
  {
    step: 2,
    icon: MessageSquare,
    title: "讨论答疑",
    subtitle: "把不会的问出来",
    description: "讨论区学术/闲聊分区运营，支持发帖、回答、评论、投票。AI 机器人自动回复并推荐相关帖子，你的问题不会被搁置——哪怕深夜也有人（或 AI）回应。",
    link: "/",
    linkLabel: "进入讨论区",
    example: { to: "/tags/C++", label: "C++ 入门系列 8 篇 + AI 自动回复" },
    accent: "#f59e0b",
  },
  {
    step: 3,
    icon: Lightbulb,
    title: "灵感沉淀",
    subtitle: "把想法记下来",
    description: "灵感广场用于捕捉转瞬即逝的项目想法。学完知识后，你会自然产生「能不能做个 XXX」的念头——别让它溜走，发出来，看看有多少人共鸣。",
    link: "/ideas",
    linkLabel: "看看别人的灵感",
    example: { to: "/ideas", label: "用 C++ 做一个 CLI 笔记知识系统" },
    accent: "#a78bfa",
  },
  {
    step: 4,
    icon: Users,
    title: "协作工坊",
    subtitle: "把想法做成项目",
    description: "协作工坊支持多人编辑文档、章节大纲、批注讨论。把灵感落地为项目——拆解任务、分配章节、协作编写教程或论文。从「我想做」到「我们一起做」。",
    link: "/workshop",
    linkLabel: "查看协作项目",
    example: { to: "/workshop", label: "CLI Notes 知识系统 — 协作工坊" },
    accent: "#34d399",
  },
  {
    step: 5,
    icon: Trophy,
    title: "作品集产出",
    subtitle: "把成果展示出来",
    description: "最终目标：把学习路径沉淀成可展示的作品。项目文档、学习记录、协作者、演示链接——一个能分享给评审或同学的可信成果，证明「我真的学会了」。",
    link: "/portfolio",
    linkLabel: "查看作品集",
    example: { to: "/portfolio", label: "从 C++ 入门到 CLI Notes 知识系统" },
    accent: "#fb923c",
  },
];

/** 示例路线：C++ 学习到项目产出 */
const EXAMPLE_ROUTE = {
  title: "示例路线：C++ 入门 → CLI Notes 知识系统",
  description: "这是一条已在天玑上跑通的完整路径，评委可沿着这条路线完成 3 分钟演示。",
  steps: [
    { label: "学基础", to: "/library", detail: "C++ Primer + Effective C++" },
    { label: "提问答疑", to: "/tags/C++", detail: "C++ 入门 01-07 + 学习路线总结" },
    { label: "灵感落地", to: "/ideas", detail: "用 C++ 做 CLI 笔记知识系统" },
    { label: "协作开发", to: "/workshop", detail: "CLI Notes 协作工坊（5 章大纲）" },
    { label: "作品产出", to: "/portfolio", detail: "可展示的项目教程" },
  ],
};

export default function GrowthPath() {
  useSEO({
    title: "成长路径",
    description:
      "从学习资源到项目作品的完整链路：学习 → 答疑 → 灵感 → 协作 → 作品集。天玑帮助跨专业学习者从「不会」开始，最终产出可展示的作品。",
    canonical: "https://tianjihub.cn/growth",
  });

  return (
    <>
      <PageHero
        eyebrow="GROWTH PATH"
        title={
          <>
            从学习到作品的<span className="text-star-400">完整路径</span>
          </>
        }
        subtitle="天玑不是另一个教程站或问答论坛。我们把学习资源、讨论答疑、灵感沉淀、协作工坊、作品集串成一条完整链路——一个普通学生从「不会」开始，最终能产出可展示的作品。"
      >
        <div className="flex flex-wrap gap-3">
          <Link to="/library" className="btn-gold inline-flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            从第一步开始
          </Link>
          <Link to="/about" className="btn-ghost inline-flex items-center gap-2">
            <Compass className="h-4 w-4" />
            了解天玑
          </Link>
        </div>
      </PageHero>

      {/* 5 步成长路径 */}
      <section className="container-tj py-12 lg:py-16">
        <div className="mx-auto max-w-4xl">
          {STAGES.map((stage, idx) => {
            const Icon = stage.icon;
            const isLast = idx === STAGES.length - 1;
            return (
              <div key={stage.step} className="relative">
                {/* 连接线 */}
                {!isLast && (
                  <div
                    className="absolute left-[27px] top-14 h-[calc(100%-3.5rem)] w-px bg-gradient-to-b from-void-600/50 to-void-600/20 sm:left-[31px]"
                    aria-hidden
                  />
                )}
                <div className="relative flex gap-4 pb-10 sm:gap-6 sm:pb-12">
                  {/* 步骤序号 + 图标 */}
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 sm:h-16 sm:w-16"
                    style={{
                      borderColor: `${stage.accent}40`,
                      background: `${stage.accent}15`,
                      color: stage.accent,
                    }}
                  >
                    <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
                  </div>
                  {/* 内容卡片 */}
                  <div className="group flex-1 rounded-xl border border-void-600/30 bg-void-800/20 p-5 transition-colors hover:bg-void-800/40 sm:p-6">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-mono text-xs text-mist-500">
                        STEP {stage.step}
                      </span>
                      <h3 className="heading-display text-xl text-parchment-50 sm:text-2xl">
                        {stage.title}
                      </h3>
                      <span className="text-sm text-mist-400">— {stage.subtitle}</span>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-mist-300 sm:text-base">
                      {stage.description}
                    </p>
                    {/* 真实内容示例 */}
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <Link
                        to={stage.link}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-star-300 transition-colors hover:text-star-200"
                      >
                        {stage.linkLabel}
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                      <span className="text-xs text-mist-500">·</span>
                      <Link
                        to={stage.example.to}
                        className="inline-flex items-center gap-1.5 rounded-full bg-void-700/30 px-3 py-1 text-xs text-mist-400 transition-colors hover:bg-void-700/50 hover:text-parchment-200"
                      >
                        {stage.example.label}
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 示例路线 */}
      <section className="border-t border-void-600/30 bg-void-900/30">
        <div className="container-tj py-12 lg:py-16">
          <div className="mx-auto max-w-4xl">
            <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.2em] text-mist-500">
              DEMO ROUTE
            </span>
            <h2 className="heading-display text-2xl text-parchment-50 sm:text-3xl">
              {EXAMPLE_ROUTE.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-mist-400">
              {EXAMPLE_ROUTE.description}
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-5">
              {EXAMPLE_ROUTE.steps.map((step, idx) => (
                <Link
                  key={idx}
                  to={step.to}
                  className="group flex flex-col rounded-lg border border-void-600/30 bg-void-800/20 p-4 transition-colors hover:border-star-500/30 hover:bg-void-800/40"
                >
                  <span className="font-mono text-xs text-star-400">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <span className="mt-1 text-sm font-medium text-parchment-100">
                    {step.label}
                  </span>
                  <span className="mt-1 text-xs leading-relaxed text-mist-500">
                    {step.detail}
                  </span>
                  <span className="mt-2 inline-flex items-center gap-1 text-xs text-star-300 opacity-0 transition-opacity group-hover:opacity-100">
                    查看 <ArrowRight className="h-3 w-3" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container-tj py-12 text-center">
        <h2 className="heading-display text-2xl text-parchment-50 sm:text-3xl">
          开始你的成长路径
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-mist-400">
          不用从零摸索。天玑已经为你铺好了从学习到作品的第一步。
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/library" className="btn-gold inline-flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            浏览学习资源
          </Link>
          <Link to="/" className="btn-ghost inline-flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            去讨论区提问
          </Link>
        </div>
      </section>
    </>
  );
}
