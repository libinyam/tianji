import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, BookOpen, Lightbulb, PenLine, ArrowUpRight, Flame, Compass } from "lucide-react";
import { fetchHotPosts } from "@/lib/posts";
import type { Question } from "@/types";

const MODULES = [
  { to: "/library", icon: BookOpen, label: "资源库", desc: "按学习阶段整理的资源与教程" },
  { to: "/ideas", icon: Lightbulb, label: "灵感广场", desc: "项目创意与研究思路交流" },
  { to: "/workshop", icon: PenLine, label: "协作工坊", desc: "多人协同的项目创作空间" },
];

const ONBOARDING_STEPS = [
  { step: 1, text: "去资源库找学习资料", link: "/library" },
  { step: 2, text: "在讨论区提问或回答", link: "/" },
  { step: 3, text: "把想法沉淀到灵感广场", link: "/ideas" },
  { step: 4, text: "到协作工坊发起或参与项目", link: "/workshop" },
];

let hotCache: Question[] | null = null;

export default function DiscussionSidebar() {
  const [hot, setHot] = useState<Question[]>(hotCache ?? []);

  useEffect(() => {
    if (hotCache) return;
    let mounted = true;
    void fetchHotPosts(5).then((list) => {
      if (list.length === 0) {
        console.warn("[DiscussionSidebar] 热门帖子加载失败或为空");
        return;
      }
      hotCache = list;
      if (mounted) setHot(list);
    });
    return () => { mounted = false; };
  }, []);

  return (
    <aside className="hidden space-y-3 lg:sticky lg:top-20 lg:block">
      {/* 品牌简介 */}
      <div className="card-surface p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-star-400" strokeWidth={1.5} />
          <span className="heading-display text-base text-parchment-50">
            天<span className="text-star-400">玑</span>
          </span>
          <span className="text-xs text-mist-500">跨专业共创社区</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-mist-400">
          天玑帮助跨专业学习者从学习资料、问题答疑、灵感沉淀，到协作项目落地。无论你来自数学、物理、金融还是计算机，都能在这里把专业积累变成真实作品。
        </p>
        <Link
          to="/about"
          className="mt-2 inline-flex items-center gap-1 text-xs text-star-400 transition-colors hover:text-star-300"
        >
          了解天玑 <ArrowUpRight size={12} />
        </Link>
      </div>

      {/* 新手引导 */}
      <div className="card-surface px-4 py-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-parchment-100">
          <Compass size={13} className="text-star-400" /> 第一次来天玑？
        </div>
        <ol className="mt-2 space-y-2">
          {ONBOARDING_STEPS.map((s) => (
            <li key={s.step}>
              <Link
                to={s.link}
                className="group flex items-center gap-2 text-xs text-mist-400 transition-colors hover:text-star-400"
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-void-700/50 text-[10px] text-star-400">
                  {s.step}
                </span>
                {s.text}
              </Link>
            </li>
          ))}
        </ol>
      </div>

      {/* 模块入口 */}
      <div className="card-surface px-2 py-1">
        {MODULES.map((m) => {
          const Icon = m.icon;
          return (
            <Link
              key={m.to}
              to={m.to}
              className="group flex items-center gap-3 rounded-md px-2.5 py-2 transition-colors hover:bg-void-700/30"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-void-600/40 bg-void-800/40 text-star-400">
                <Icon size={14} strokeWidth={1.5} />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-medium text-parchment-100 transition-colors group-hover:text-star-400">
                  {m.label}
                </span>
                <span className="block truncate text-[11px] text-mist-500">{m.desc}</span>
              </span>
            </Link>
          );
        })}
      </div>

      {/* 热门讨论 */}
      {hot.length > 0 && (
        <div className="card-surface px-4 py-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-parchment-100">
            <Flame size={13} className="text-star-400" /> 热门讨论
          </div>
          <ul className="mt-2 space-y-2">
            {hot.map((q, i) => (
              <li key={q.id}>
                <Link to={`/discussion/${q.id}`} className="group flex items-start gap-2">
                  <span className={`font-mono text-xs ${i < 3 ? "text-star-400" : "text-mist-500"}`}>
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-xs leading-snug text-mist-300 transition-colors group-hover:text-star-400">
                      {q.title}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-mist-500">
                      {q.views} 浏览 · {q.answers} 回答
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}    </aside>
  );
}
