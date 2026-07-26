import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Trophy, RefreshCw, AlertCircle } from "lucide-react";
import PageHero from "@/components/PageHero";
import EmptyState from "@/components/EmptyState";
import { PostCardSkeleton } from "@/components/Skeleton";
import Avatar from "@/components/Avatar";
import { fetchLeaderboard, type LeaderboardEntry } from "@/lib/leaderboard";
import { calculateLevel, getBadges } from "@/lib/reputation";
import { formatCount } from "@/lib/format";
import { useSEO } from "@/hooks/useSEO";

// #172 声望排行榜:头部用户认可与新用户成长引导
export default function Leaderboard() {
  useSEO({
    title: "声望榜",
    description:
      "天玑社区声望排行榜——通过发帖、回答、被采纳与共鸣积累声望,认识社区里最活跃的贡献者。",
    canonical: "https://tianjihub.cn/leaderboard",
  });

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    fetchLeaderboard().then(({ entries: list, error: err }) => {
      if (!mounted) return;
      setEntries(list);
      setError(err);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [reloadKey]);

  return (
    <>
      <PageHero
        eyebrow="声望榜"
        title="社区贡献者排行"
        subtitle="发帖 +2、回答 +5、被采纳 +15、获赞 +10……声望记录你在天玑的每一次贡献。累积声望解锁等级与徽章,也让同学更容易找到值得请教的人。"
      />

      <section className="container-tj py-8">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <PostCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-void-600 bg-void-800 px-6 py-10 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-void-700 text-red-500">
              <AlertCircle size={28} strokeWidth={1.5} />
            </div>
            <h3 className="heading-display text-xl text-parchment-50">排行榜加载失败</h3>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-mist-400">
              {error}。请检查网络或稍后重试。
            </p>
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              className="btn-primary mt-4 inline-flex items-center gap-2 text-sm"
            >
              <RefreshCw size={14} /> 重试
            </button>
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={<Trophy size={28} strokeWidth={1.5} />}
            title="排行榜还在虚位以待"
            description="发出第一篇帖子、写下第一个回答,就能登上声望榜。"
          />
        ) : (
          <div className="divide-y divide-void-600 rounded-lg border border-void-600 bg-void-800">
            {entries.map((entry, i) => {
              const rank = i + 1;
              const { levelName } = calculateLevel(entry.reputation);
              const badges = getBadges(entry.reputation);
              return (
                <Link
                  key={entry.uid}
                  to={`/user/${entry.uid}`}
                  className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-void-700"
                >
                  <span
                    className={`w-8 shrink-0 text-center text-lg font-semibold ${
                      rank <= 3 ? "text-tian-500" : "text-mist-500"
                    }`}
                  >
                    {rank}
                  </span>
                  <Avatar name={entry.name} color={entry.avatarColor} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium text-parchment-100 transition-colors group-hover:text-tian-500">
                        {entry.name}
                      </span>
                      <span className="pill">{levelName}</span>
                    </div>
                    {badges.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {badges.map((b) => (
                          <span key={b} className="pill-blue text-[10px]">
                            {b}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 text-right">
                    <span className="heading-display block text-xl text-parchment-50">
                      {formatCount(entry.reputation)}
                    </span>
                    <span className="text-xs text-mist-500">声望</span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
