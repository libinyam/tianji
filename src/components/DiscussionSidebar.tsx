import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  BookOpen,
  Lightbulb,
  PenLine,
  ArrowUpRight,
  Flame,
  Compass,
  Bookmark,
  GraduationCap,
  Coffee,
  Heart,
  Hash,
} from "lucide-react";
import { fetchHotPosts } from "@/lib/posts";
import { fetchFollowedTags } from "@/lib/follows";
import { useAuthStore } from "@/stores/auth";
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

export type Section = "academic" | "casual" | "following";

export interface SidebarProps {
  section: Section;
  onSectionChange: (s: Section) => void;
  activeTag: string;
  onTagChange: (t: string) => void;
  hotTags: string[];
}

/** 为标签生成稳定的纯色圆点（Discourse 风格） */
function tagDotColor(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h} 65% 45%)`;
}

export default function DiscussionSidebar({
  section,
  onSectionChange,
  activeTag,
  onTagChange,
  hotTags,
}: SidebarProps) {
  const { user } = useAuthStore();
  const [hot, setHot] = useState<Question[]>([]);
  const [followedTags, setFollowedTags] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    void fetchHotPosts(5).then((list) => {
      if (list.length === 0) return;
      if (mounted) setHot(list);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    void fetchFollowedTags().then((tags) => {
      if (mounted) setFollowedTags(tags);
    });
    return () => {
      mounted = false;
    };
  }, [user]);

  const SECTIONS: { key: Section; label: string; icon: typeof GraduationCap }[] = [
    { key: "academic", label: "学术区", icon: GraduationCap },
    { key: "casual", label: "闲聊区", icon: Coffee },
    { key: "following", label: "关注", icon: Heart },
  ];

  return (
    <aside className="hidden w-[260px] shrink-0 self-start border-r border-void-600/40 pr-4 lg:block">
      <div className="sticky top-20 max-h-[calc(100vh-6rem)] space-y-4 overflow-y-auto pb-8">
        {/* 品牌简介 */}
        <div className="p-1">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-star-400" strokeWidth={1.5} />
            <span className="heading-display text-base text-parchment-50">
              天<span className="text-star-400">玑</span>
            </span>
            <span className="text-xs text-mist-500">跨专业共创社区</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-mist-400">
            天玑帮助跨专业学习者从学习资料、问题答疑、灵感沉淀，到协作项目落地。
          </p>
          <Link
            to="/about"
            className="mt-2 inline-flex items-center gap-1 text-xs text-star-400 transition-colors hover:text-star-300"
          >
            了解天玑 <ArrowUpRight size={12} />
          </Link>
        </div>

        {/* 分区切换 - Discourse 风左侧导航主项 */}
        <nav className="overflow-hidden py-1">
          <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-mist-500">
            分区
          </div>
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const isActive = section === s.key;
            return (
              <button
                key={s.key}
                onClick={() => onSectionChange(s.key)}
                className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-tian-500/10 font-medium text-tian-500"
                    : "text-mist-400 hover:bg-void-700/50 hover:text-parchment-100"
                }`}
              >
                <Icon size={15} className={isActive ? "text-tian-500" : "text-mist-500"} />
                {s.label}
              </button>
            );
          })}
        </nav>

        {/* 热门标签 - Discourse 风标签列表（仅学术区） */}
        {section === "academic" && hotTags.length > 0 && (
          <nav className="py-1">
            <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-mist-500">
              热门标签
            </div>
            <button
              onClick={() => onTagChange("全部")}
              className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                activeTag === "全部"
                  ? "bg-tian-500/10 font-medium text-tian-500"
                  : "text-mist-400 hover:bg-void-700/50 hover:text-parchment-100"
              }`}
            >
              <Hash size={14} className="text-mist-500" />
              全部
            </button>
            {hotTags.map((t) => (
              <button
                key={t}
                onClick={() => onTagChange(t)}
                className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                  activeTag === t
                    ? "bg-tian-500/10 font-medium text-tian-500"
                    : "text-mist-400 hover:bg-void-700/50 hover:text-parchment-100"
                }`}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: tagDotColor(t) }}
                />
                <span className="truncate">{t}</span>
              </button>
            ))}
          </nav>
        )}

        {/* 我关注的标签 */}
        {user && followedTags.length > 0 && (
          <nav className="py-1">
            <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-mist-500">
              <Bookmark size={11} /> 关注的标签
            </div>
            {followedTags.map((tag) => (
              <Link
                key={tag}
                to={`/tags/${encodeURIComponent(tag)}`}
                className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-mist-400 transition-colors hover:bg-void-700/50 hover:text-parchment-100"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: tagDotColor(tag) }}
                />
                <span className="truncate">{tag}</span>
              </Link>
            ))}
          </nav>
        )}

        {/* 新手引导 */}
        <div className="py-1">
          <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-parchment-100">
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
        <div className="py-1">
          <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-mist-500">
            其他模块
          </div>
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
          <div className="py-1">
            <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-parchment-100">
              <Flame size={13} className="text-star-400" /> 热门讨论
            </div>
            <ul className="mt-2 space-y-2">
              {hot.map((q, i) => (
                <li key={q.id}>
                  <Link to={`/discussion/${q.id}`} className="group flex items-start gap-2">
                    <span
                      className={`font-mono text-xs ${i < 3 ? "text-star-400" : "text-mist-500"}`}
                    >
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
        )}
      </div>
    </aside>
  );
}
