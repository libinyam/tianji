import { useEffect, useState } from "react";
import { MessageSquare, Lightbulb, BookOpen, Users } from "lucide-react";
import { fetchPublicStats, type PublicStats } from "@/lib/stats";
import { Skeleton } from "@/components/Skeleton";

/**
 * #311 天玑成长数据
 * 展示 4 个真实统计指标，让评审快速感知项目活跃度
 * 数据来自数据库实时 count，非写死数字
 */
const STAT_ITEMS: {
  key: keyof PublicStats;
  label: string;
  icon: typeof MessageSquare;
  suffix: string;
}[] = [
  { key: "posts", label: "学术讨论", icon: MessageSquare, suffix: "篇" },
  { key: "ideas", label: "灵感火花", icon: Lightbulb, suffix: "条" },
  { key: "books", label: "学习资源", icon: BookOpen, suffix: "份" },
  { key: "workshops", label: "协作项目", icon: Users, suffix: "个" },
];

export default function GrowthStats() {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchPublicStats()
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => {
        // 失败时保持 null，UI 显示 --
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="container-tj py-12">
      <div className="mb-6 text-center">
        <div className="mb-2 flex items-center justify-center gap-2">
          <span className="font-mono text-xs uppercase tracking-[0.25em] text-star-300">
            Growth Data
          </span>
        </div>
        <h2 className="heading-display text-2xl text-parchment-50">天玑成长数据</h2>
        <p className="mt-2 text-sm text-mist-400">
          来自社区的真实数据，持续成长中
        </p>
      </div>

      <div className="mx-auto grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
        {STAT_ITEMS.map((item) => {
          const Icon = item.icon;
          const value = stats?.[item.key];
          return (
            <div
              key={item.key}
              className="rounded-xl border border-void-600/40 bg-void-900/40 p-5 text-center transition-colors hover:border-star-400/30"
            >
              <Icon size={20} className="mx-auto mb-2 text-star-400" />
              <div className="heading-display text-2xl text-parchment-50">
                {loading ? (
                  <Skeleton className="mx-auto h-7 w-12" />
                ) : value !== undefined && value > 0 ? (
                  value
                ) : (
                  "--"
                )}
              </div>
              <div className="mt-1 text-xs text-mist-400">
                {item.label}
                {value !== undefined && value > 0 && ` · ${item.suffix}`}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
