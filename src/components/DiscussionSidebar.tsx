import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, BookOpen, Lightbulb, PenLine, ArrowUpRight, Flame } from "lucide-react";
import { fetchHotPosts } from "@/lib/posts";
import type { Question } from "@/types";

const MODULES = [
  { to: "/library", icon: BookOpen, label: "资源库", desc: "按学习阶段整理的资源与教程" },
  { to: "/ideas", icon: Lightbulb, label: "灵感广场", desc: "项目创意与研究思路交流" },
  { to: "/workshop", icon: PenLine, label: "协作工坊", desc: "多人协同的项目创作空间" },
];

// 模块级缓存：后退返回首页时不重复请求榜单
let hotCache: Question[] | null = null;

/** 首页右侧栏：品牌简介 + 模块入口 + 热门讨论。仅桌面端显示。 */
export default function DiscussionSidebar() {
  const [hot, setHot] = useState<Question[]>(hotCache ?? []);

  useEffect(() => {
    if (hotCache) return;
    let mounted = true;
    void fetchHotPosts(5).then((list) => {
      hotCache = list;
      if (mounted) setHot(list);
    });
    return () => { mounted = false; };
  }, []);

  return (
    <aside className="hidden space-y-4 lg:sticky lg:top-20 lg:block">
      {/* 品牌简介 */}
      <div className="card-surface p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-star-400" strokeWidth={1.5} />
          <span className="heading-display text-base text-parchment-50">
            天<span className="text-star-400">玑</span>
          </span>
          <span className="text-xs text-mist-500">跨专业共创社区</span>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-mist-400">
          无论你来自数学、物理、金融还是计算机，都能在这里求解疑难、交流灵感、协同创作，把专业积累变成真实可用的作品。
        </p>
        <Link
          to="/about"
          className="mt-3 inline-flex items-center gap-1 text-xs text-star-300 transition-colors hover:text-star-200"
        >
          了解天玑 <ArrowUpRight size={12} />
        </Link>
      </div>

      {/* 模块入口 */}
      <div className="card-surface p-2">
        {MODULES.map((m) => {
          const Icon = m.icon;
          return (
            <Link
              key={m.to}
              to={m.to}
              className="group flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-void-700/30"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-void-600/40 bg-void-800/40 text-star-300">
                <Icon size={14} strokeWidth={1.5} />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-medium text-parchment-100 transition-colors group-hover:text-star-200">
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
        <div className="card-surface p-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-parchment-100">
            <Flame size={13} className="text-star-400" /> 热门讨论
          </div>
          <ul className="mt-3 space-y-2.5">
            {hot.map((q, i) => (
              <li key={q.id}>
                <Link to={`/discussion/${q.id}`} className="group flex items-start gap-2.5">
                  <span className={`font-mono text-xs ${i < 3 ? "text-star-400" : "text-mist-500"}`}>
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-xs leading-snug text-mist-300 transition-colors group-hover:text-star-200">
                      {q.title}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-mist-600">
                      {q.views} 浏览 · {q.answers} 回答
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
