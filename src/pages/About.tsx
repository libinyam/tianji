/**
 * DESIGN REMINDER — Guided Editorial: sell a learner's path and evidence, not a grid of product features.
 * Keep product proof truthful; the community section deliberately avoids fabricated engagement statistics.
 */
import JourneyCanvas from "@/components/home/JourneyCanvas";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Compass,
  Lightbulb,
  MessageCircleQuestion,
  PenLine,
  Presentation,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";

interface ModulePanel {
  number: string;
  title: string;
  description: string;
  evidence: string;
  to: string;
  icon: LucideIcon;
}

const MODULES: ModulePanel[] = [
  {
    number: "01",
    title: "学习资源库",
    description: "从理论、工具到部署，把开始前最分散的信息编排成可行动的路径。",
    evidence: "资源条目 · 已编排",
    to: "/library",
    icon: BookOpen,
  },
  {
    number: "02",
    title: "学问讨论",
    description: "让难题留在可引用的上下文里，获得可以继续、可以采纳的回应。",
    evidence: "主题行 · 可采纳回答",
    to: "/",
    icon: MessageCircleQuestion,
  },
  {
    number: "03",
    title: "灵感广场",
    description: "把一次讨论里的发现推进成可验证的研究问题或产品假设。",
    evidence: "灵感卡 · 关联来源",
    to: "/ideas",
    icon: Lightbulb,
  },
  {
    number: "04",
    title: "协作工坊",
    description: "围绕真实任务共笔、批注与分工，把个人理解变成共同交付。",
    evidence: "共笔文档 · 在线批注",
    to: "/workshop",
    icon: PenLine,
  },
  {
    number: "05",
    title: "作品集",
    description: "记录过程、方法和结果，让专业积累被真实、持续地展示。",
    evidence: "项目卡 · 可公开展示",
    to: "/portfolio",
    icon: Presentation,
  },
];

export default function About() {
  useDocumentTitle("为什么天玑");
  return (
    <div className="overflow-hidden">
      <section className="container-tj grid gap-10 py-14 lg:grid-cols-[5fr_7fr] lg:items-center lg:py-20">
        <div>
          <p className="font-mono text-[10px] font-medium tracking-[0.12em] text-tian-500">
            TIANJI · 跨专业 AI 学习与项目共创社区
          </p>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.16] tracking-tight text-parchment-50 sm:text-5xl lg:text-6xl">
            从跨专业学习，
            <br />
            <span className="text-tian-500">到交付一件真实作品。</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-mist-400">
            天玑把资料、答疑、灵感、协作和作品集串成一条可走完的路径，让专业积累不止停在笔记与考卷里。
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link to="/growth" className="btn-primary">
              <Compass size={16} />
              开始一段学习路径
            </Link>
            <Link to="/portfolio" className="btn-secondary">
              浏览真实作品 <ArrowUpRight size={15} />
            </Link>
          </div>
          <p className="mt-5 font-mono text-[10px] tracking-[0.08em] text-mist-500">
            跨学科 <span className="px-1">·</span> AI 实战 <span className="px-1">·</span> 社区共创
          </p>
        </div>
        <JourneyCanvas />
      </section>

      <section className="border-y border-void-600 bg-void-700/35">
        <div className="container-tj grid gap-8 py-14 lg:grid-cols-[150px_1fr_auto] lg:items-center">
          <p className="font-mono text-[10px] tracking-[0.12em] text-tian-500">
            01 · COMPLETE PATH
          </p>
          <div>
            <h2 className="font-display text-3xl font-semibold leading-tight text-parchment-50">
              五个阶段，不是五个孤立模块。
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-mist-400">
              每一步都为下一步提供真实输入。你带着问题进入，带着作品离开；资料、回应、灵感和协作始终在同一条轨迹中互相连接。
            </p>
          </div>
          <div className="flex items-center gap-2 whitespace-nowrap font-mono text-[10px] text-mist-500">
            <span>资料</span>
            <ArrowRight size={12} />
            <span>答疑</span>
            <ArrowRight size={12} />
            <span>灵感</span>
            <ArrowRight size={12} />
            <span>协作</span>
            <ArrowRight size={12} />
            <b className="text-tian-500">作品</b>
          </div>
        </div>
      </section>

      <section className="container-tj grid gap-10 py-16 lg:grid-cols-[.85fr_1.15fr] lg:items-center">
        <div className="rounded-xl border border-void-600 bg-void-700/45 p-6 sm:p-8">
          <p className="font-mono text-[10px] tracking-[0.12em] text-tian-500">OUTCOME PROOF</p>
          <div className="mt-7 grid gap-5">
            <div className="rounded-lg border border-void-600 bg-void-800 p-4">
              <small className="font-mono text-[9px] text-mist-500">01 · LEARNING ROUTE</small>
              <p className="mt-1 text-sm font-medium text-parchment-100">
                学习路径从“要学什么”变成“今天下一步做什么”。
              </p>
            </div>
            <div className="rounded-lg border border-tian-200 bg-tian-50/50 p-4">
              <small className="font-mono text-[9px] text-tian-500">02 · ACCEPTED THINKING</small>
              <p className="mt-1 text-sm font-medium text-parchment-100">
                一段回答被采纳，也成为下一个学习者可以引用的思考。
              </p>
            </div>
            <div className="rounded-lg border border-void-600 bg-void-800 p-4">
              <small className="font-mono text-[9px] text-mist-500">03 · PROJECT CARD</small>
              <p className="mt-1 text-sm font-medium text-parchment-100">
                过程、方法和结果被整理成可以展示、可以继续迭代的项目卡。
              </p>
            </div>
          </div>
        </div>
        <div>
          <p className="font-mono text-[10px] tracking-[0.12em] text-tian-500">
            WHAT YOU TAKE WITH YOU
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold leading-tight text-parchment-50 sm:text-4xl">
            最后带走的，
            <br />
            不是一次浏览记录。
          </h2>
          <p className="mt-5 max-w-xl text-sm leading-7 text-mist-400">
            当学习有路径、问题有回应、灵感有去处，作品就不再是遥远的“最终目标”，而是一连串小而清晰的交付。
          </p>
          <div className="mt-6 grid gap-4 text-sm text-mist-400">
            <p className="flex gap-3">
              <Compass className="mt-0.5 shrink-0 text-tian-500" size={17} />
              <span>
                <b className="block text-parchment-100">结构化学习路径</b>
                知道今天学什么，以及为什么。
              </span>
            </p>
            <p className="flex gap-3">
              <CheckCircle2 className="mt-0.5 shrink-0 text-tian-500" size={17} />
              <span>
                <b className="block text-parchment-100">可被采纳的思考</b>
                让问题和回答形成可复用的理解。
              </span>
            </p>
            <p className="flex gap-3">
              <Presentation className="mt-0.5 shrink-0 text-tian-500" size={17} />
              <span>
                <b className="block text-parchment-100">可公开展示的项目</b>
                把过程和成果沉淀成持续成长的作品卡。
              </span>
            </p>
          </div>
        </div>
      </section>

      <section className="container-tj py-10">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="font-mono text-[10px] tracking-[0.12em] text-tian-500">
              SCENES, NOT FEATURES
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold text-parchment-50">
              每一段路径，都有一个可进入的场景。
            </h2>
          </div>
          <p className="max-w-md text-sm leading-7 text-mist-400">
            少一些并列的功能名词，多一些对“我下一步该做什么”的明确回答。
          </p>
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {MODULES.map((module) => {
            const Icon = module.icon;
            return (
              <Link
                key={module.to}
                to={module.to}
                className="group flex min-h-[230px] flex-col rounded-xl border border-void-600 bg-void-800 p-4 transition hover:-translate-y-1 hover:border-tian-300 hover:shadow-card"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-mist-500">PATH {module.number}</span>
                  <Icon size={18} className="text-tian-500" />
                </div>
                <p className="mt-5 flex items-center gap-1.5 font-mono text-[9px] text-mist-500">
                  <i className="h-1.5 w-1.5 rounded-full bg-tian-500" />
                  {module.evidence}
                </p>
                <h3 className="mt-3 font-display text-lg font-semibold text-parchment-50">
                  {module.title}
                </h3>
                <p className="mt-2 text-xs leading-6 text-mist-400">{module.description}</p>
                <span className="mt-auto inline-flex items-center gap-1 pt-5 text-xs font-medium text-tian-500">
                  进入场景 <ArrowRight size={13} />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="container-tj py-16">
        <div className="border-y border-void-600 py-10">
          <div className="grid gap-6 lg:grid-cols-[190px_1fr_.8fr]">
            <p className="font-mono text-[10px] tracking-[0.12em] text-tian-500">
              COMMUNITY SNAPSHOT
            </p>
            <h2 className="font-display text-3xl font-semibold leading-tight text-parchment-50">
              社区不靠虚构的热闹证明自己。
            </h2>
            <p className="text-sm leading-7 text-mist-400">
              当数据尚未形成规模，天玑更愿意诚实地邀请你共同写下第一批主题、资源和项目。
            </p>
          </div>
          <div className="mt-7 grid gap-3 lg:grid-cols-[.8fr_1.4fr_.8fr]">
            <div className="rounded-lg border border-void-600 bg-void-700/50 p-5">
              <p className="font-mono text-xs text-tian-500">01</p>
              <h3 className="mt-5 font-display text-lg text-parchment-50">从一个真实问题开始</h3>
              <p className="mt-2 text-xs leading-6 text-mist-400">
                把卡住的推导、工具配置或项目决策写进讨论区。
              </p>
              <Link
                className="mt-6 inline-flex items-center gap-1 text-xs font-medium text-tian-500"
                to="/"
              >
                发起一个问题 <ArrowRight size={13} />
              </Link>
            </div>
            <div className="rounded-lg border border-void-600 bg-void-800 p-5 shadow-card">
              <div className="flex items-center justify-between">
                <span className="discourse-cat" style={{ backgroundColor: "var(--c-tian-500)" }}>
                  学术区
                </span>
                <small className="text-[10px] text-mist-500">主题行 · 可检索</small>
              </div>
              <h3 className="mt-5 font-display text-xl leading-relaxed text-parchment-50">
                从线性代数到第一个可解释的模型，我应该怎么走？
              </h3>
              <p className="mt-2 text-xs leading-6 text-mist-400">
                先把目标拆为可完成的练习，再把每一次卡住的地方留成可回应的上下文。
              </p>
              <div className="mt-4 flex flex-wrap gap-4 border-y border-void-600 py-3 text-[10px] text-mist-400">
                <span className="inline-flex items-center gap-1 text-tian-500">
                  <CheckCircle2 size={13} />
                  可采纳回答
                </span>
                <span>连续阅读</span>
                <span>可引用上下文</span>
              </div>
              <Link
                className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-tian-500"
                to="/"
              >
                进入讨论区 <ArrowRight size={13} />
              </Link>
            </div>
            <div className="rounded-lg border border-void-600 bg-void-700/50 p-5">
              <p className="font-mono text-xs text-tian-500">02</p>
              <h3 className="mt-5 font-display text-lg text-parchment-50">
                给一份资料补上一段说明
              </h3>
              <p className="mt-2 text-xs leading-6 text-mist-400">
                把“为什么值得看”和“看完可以做什么”写给下一位学习者。
              </p>
              <Link
                className="mt-6 inline-flex items-center gap-1 text-xs font-medium text-tian-500"
                to="/library"
              >
                贡献学习资料 <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="container-tj pb-16">
        <div className="rounded-xl border border-void-600 bg-void-700/45 px-6 py-12 text-center sm:px-10">
          <p className="font-mono text-[10px] tracking-[0.12em] text-tian-500">YOUR NEXT STEP</p>
          <h2 className="mt-3 font-display text-3xl font-semibold text-parchment-50">
            从你现在最需要的地方开始。
          </h2>
          <div className="mx-auto mt-8 grid max-w-4xl gap-3 sm:grid-cols-3">
            <Link
              to="/library"
              className="flex items-center gap-3 rounded-lg border border-void-600 bg-void-800 p-4 text-left transition hover:border-tian-300"
            >
              <BookOpen size={18} className="text-tian-500" />
              <span className="flex-1">
                <b className="block text-sm text-parchment-100">找学习资料</b>
                <small className="text-[10px] text-mist-500">先得到一条能走下去的路径</small>
              </span>
              <ArrowRight size={15} className="text-mist-500" />
            </Link>
            <Link
              to="/"
              className="flex items-center gap-3 rounded-lg border border-void-600 bg-void-800 p-4 text-left transition hover:border-tian-300"
            >
              <MessageCircleQuestion size={18} className="text-tian-500" />
              <span className="flex-1">
                <b className="block text-sm text-parchment-100">提出一个问题</b>
                <small className="text-[10px] text-mist-500">把卡住的地方留给真实回应</small>
              </span>
              <ArrowRight size={15} className="text-mist-500" />
            </Link>
            <Link
              to="/portfolio"
              className="flex items-center gap-3 rounded-lg border border-void-600 bg-void-800 p-4 text-left transition hover:border-tian-300"
            >
              <Presentation size={18} className="text-tian-500" />
              <span className="flex-1">
                <b className="block text-sm text-parchment-100">看项目作品</b>
                <small className="text-[10px] text-mist-500">从别人的成果想象自己的下一步</small>
              </span>
              <ArrowRight size={15} className="text-mist-500" />
            </Link>
          </div>
          <a
            href="https://github.com/libinyam/tianji"
            target="_blank"
            rel="noreferrer"
            className="mt-8 inline-flex items-center gap-2 text-xs font-medium text-tian-500"
          >
            查看公开建设记录 <ArrowUpRight size={13} />
          </a>
        </div>
      </section>
    </div>
  );
}
