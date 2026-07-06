import { Users, BookOpen, MessageCircle, PenLine } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { communityStats, contributors } from "@/data/community";
import CountUp from "@/components/CountUp";

const ICONS: Record<string, LucideIcon> = {
  users: Users,
  book: BookOpen,
  message: MessageCircle,
  edit: PenLine,
};

export default function CommunityStats() {
  return (
    <section className="container-tj py-12">
      <div className="card-surface relative overflow-hidden p-8 sm:p-10">
        <div className="text-center">
          <h2 className="heading-display text-2xl text-parchment-50 sm:text-3xl">
            一群人，正在点亮同一片星空
          </h2>
        </div>

        {/* 数据 */}
        <div className="mt-8 grid grid-cols-2 gap-6 lg:grid-cols-4">
          {communityStats.map((s) => {
            const Icon = ICONS[s.icon] ?? Users;
            return (
              <div key={s.label} className="text-center">
                <Icon className="mx-auto mb-2 text-star-400" size={20} strokeWidth={1.5} />
                <div className="heading-display text-2xl text-parchment-50 sm:text-3xl">
                  <CountUp end={s.value} suffix={s.suffix} />
                </div>
                <div className="mt-1 text-xs text-mist-400">{s.label}</div>
              </div>
            );
          })}
        </div>

        {/* 活跃贡献者 */}
        <div className="mt-10 border-t border-void-600/30 pt-7">
          <p className="mb-4 text-center font-mono text-[11px] uppercase tracking-[0.15em] text-mist-400">
            活跃贡献者 · 本月排行榜
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {contributors.map((c) => (
              <div
                key={c.name}
                className="flex items-center gap-2 rounded-full border border-void-600/30 bg-void-800/30 py-1 pl-1 pr-3"
              >
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full font-display text-[10px] text-void-900"
                  style={{
                    background: `linear-gradient(135deg, ${c.avatarColor}, ${c.avatarColor}aa)`,
                  }}
                >
                  {c.name.charAt(0)}
                </span>
                <span className="text-xs text-parchment-100">{c.name}</span>
                <span className="font-mono text-[10px] text-star-300">
                  {c.contributions}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
