import {
  Bug,
  Code2,
  GitPullRequestArrow,
  ListChecks,
  Rocket,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface TimelineItem {
  title: string;
  desc: string;
  icon: LucideIcon;
  meta: string;
}

const TIMELINE: TimelineItem[] = [
  {
    title: "从一个模糊想法开始",
    desc: "最初只是想帮助跨专业学生进入 AI 时代：少走弯路，能提问，能做项目，也能把作品展示出来。",
    icon: Sparkles,
    meta: "idea",
  },
  {
    title: "让 AI 拆出产品骨架",
    desc: "和 TRAE 反复对话，把想法拆成资源库、讨论区、灵感广场、协作工坊四个可体验模块。",
    icon: ListChecks,
    meta: "structure",
  },
  {
    title: "边跑边修真实问题",
    desc: "通过多轮测试发现黑屏、上传、管理员权限、按钮失效等问题，再用 issue 驱动方式逐个收敛。",
    icon: Bug,
    meta: "debug",
  },
  {
    title: "补上工程与安全底座",
    desc: "逐步加入 CloudBase 规则、云函数部署、内容审核、CI、测试覆盖和依赖安全检查，让 Demo 不只停留在页面。",
    icon: Code2,
    meta: "quality",
  },
  {
    title: "沉淀为可提交作品",
    desc: "最后把产品截图、演示脚本、种子内容和公开体验地址串起来，让评审能看到从学习到共创的完整路径。",
    icon: Rocket,
    meta: "demo",
  },
];

const LINKS = [
  { label: "README 截图", href: "https://github.com/libinyam/tianji/pull/287" },
  { label: "讨论区优化", href: "https://github.com/libinyam/tianji/issues/294" },
  { label: "内容审核", href: "https://github.com/libinyam/tianji/issues/289" },
  { label: "成长路径", href: "https://github.com/libinyam/tianji/issues/310" },
];

export default function AICreationTimeline() {
  return (
    <section className="container-tj py-12">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <GitPullRequestArrow className="h-4 w-4 text-star-400" strokeWidth={1.5} />
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-mist-400">
              Built with TRAE
            </span>
          </div>
          <h2 className="heading-display text-3xl leading-tight text-parchment-50 sm:text-4xl">
            人提出方向，AI 帮我把想法推成产品
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-mist-400 sm:text-base">
            天玑不是一次性生成出来的页面，而是我把真实困惑、使用反馈和代码问题不断讲给 AI，
            再通过测试、issue、修复和部署一轮轮打磨出来的 Demo。
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-void-600/40 px-3 py-1.5 text-xs text-star-200 transition-colors hover:border-star-400/60 hover:bg-star-400/10"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <ol className="relative space-y-3">
          {TIMELINE.map((item, index) => {
            const Icon = item.icon;
            return (
              <li
                key={item.title}
                className="grid grid-cols-[44px_1fr] gap-3 rounded-lg border border-void-600/30 bg-void-800/20 p-4"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-star-400/25 bg-star-400/10 text-star-300">
                  <Icon size={18} strokeWidth={1.5} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-mist-500">
                      {String(index + 1).padStart(2, "0")} · {item.meta}
                    </span>
                    <h3 className="text-sm font-semibold text-parchment-100 sm:text-base">
                      {item.title}
                    </h3>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-mist-400">
                    {item.desc}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
