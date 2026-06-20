import { motion } from "motion/react";
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
    <section className="container-tj py-20">
      <div className="card-surface grain relative overflow-hidden p-8 sm:p-12">
        <div className="pointer-events-none absolute -left-20 top-0 h-64 w-64 rounded-full bg-tian-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-star-400/10 blur-3xl" />

        <div className="relative text-center">
          <div className="mb-3 flex items-center justify-center gap-2">
            <span className="h-px w-8 bg-gradient-to-r from-transparent to-star-400" />
            <span className="font-mono text-xs uppercase tracking-[0.25em] text-star-300">
              社区星象
            </span>
            <span className="h-px w-8 bg-gradient-to-l from-transparent to-star-400" />
          </div>
          <h2 className="heading-display text-3xl text-parchment-50 sm:text-4xl">
            一群人，正在点亮同一片星空
          </h2>
        </div>

        {/* 数据 */}
        <div className="relative mt-10 grid grid-cols-2 gap-6 lg:grid-cols-4">
          {communityStats.map((s, i) => {
            const Icon = ICONS[s.icon] ?? Users;
            return (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="text-center"
              >
                <Icon
                  className="mx-auto mb-3 text-star-400"
                  size={22}
                  strokeWidth={1.5}
                />
                <div className="heading-display text-3xl text-parchment-50 sm:text-4xl">
                  <CountUp end={s.value} suffix={s.suffix} />
                </div>
                <div className="mt-1.5 text-xs text-mist-400">{s.label}</div>
              </motion.div>
            );
          })}
        </div>

        {/* 活跃贡献者 */}
        <div className="relative mt-12 border-t border-void-600/40 pt-8">
          <p className="mb-5 text-center font-mono text-xs uppercase tracking-[0.2em] text-mist-400">
            活跃贡献者 · 本月排行榜
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {contributors.map((c, i) => (
              <motion.div
                key={c.name}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="group flex items-center gap-2.5 rounded-full border border-void-600/50 bg-void-800/50 py-1.5 pl-1.5 pr-4"
              >
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full font-display text-xs text-void-900"
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
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
