import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { MessageCircle, Eye, ThumbsUp, Star, Plus } from "lucide-react";
import PageHero from "@/components/PageHero";
import Avatar from "@/components/Avatar";
import { questions } from "@/data/questions";

const ALL_TAGS = Array.from(new Set(questions.flatMap((q) => q.tags)));

type SortKey = "最新" | "热度" | "悬赏";

export default function Discussion() {
  const [activeTag, setActiveTag] = useState<string>("全部");
  const [sort, setSort] = useState<SortKey>("热度");

  const filtered = useMemo(() => {
    let list = questions.filter(
      (q) => activeTag === "全部" || q.tags.includes(activeTag)
    );
    list = [...list].sort((a, b) => {
      if (sort === "热度") return b.views - a.views;
      if (sort === "悬赏") return (b.bounty ?? 0) - (a.bounty ?? 0);
      return b.createdAt < a.createdAt ? 1 : -1;
    });
    return list;
  }, [activeTag, sort]);

  return (
    <>
      <PageHero
        eyebrow="Discussion · 学问讨论"
        title={
          <>
            以严谨推导，求解<span className="text-star-400">交叉疑难</span>
          </>
        }
        subtitle="数学与机器学习交叉领域的深度问答。从谱理论到信息几何，从测度论到自动微分——在这里，每一个问题都值得被认真对待。"
      >
        <button className="btn-gold">
          <Plus size={15} /> 发起讨论
        </button>
      </PageHero>

      <section className="container-tj py-12">
        {/* 筛选标签栏 */}
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTag("全部")}
              className={`rounded-full border px-3.5 py-1.5 text-xs transition-all ${
                activeTag === "全部"
                  ? "border-star-400/60 bg-star-400/15 text-star-200"
                  : "border-void-600/50 bg-void-800/40 text-mist-300 hover:border-mist-400/40"
              }`}
            >
              全部
            </button>
            {ALL_TAGS.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTag(t)}
                className={`rounded-full border px-3.5 py-1.5 text-xs transition-all ${
                  activeTag === t
                    ? "border-tian-400/50 bg-tian-400/15 text-tian-100"
                    : "border-void-600/50 bg-void-800/40 text-mist-300 hover:border-mist-400/40"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="text-mist-500">排序</span>
            {(["最新", "热度", "悬赏"] as SortKey[]).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`transition-colors ${
                  sort === s ? "text-star-300" : "text-mist-500 hover:text-mist-300"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* 问题列表 */}
        <div className="space-y-3">
          {filtered.map((q, i) => (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: (i % 6) * 0.06 }}
            >
              <Link
                to={`/discussion/${q.id}`}
                className="group flex items-start gap-5 rounded-xl border border-void-600/40 bg-void-800/30 p-5 transition-all hover:border-star-400/30 hover:bg-void-700/30"
              >
                {/* 投票/回答统计列 */}
                <div className="hidden flex-col items-center gap-3 border-r border-void-600/40 pr-5 text-center sm:flex">
                  <div>
                    <div className="heading-display text-lg text-tian-300">{q.answers}</div>
                    <div className="text-[10px] text-mist-500">回答</div>
                  </div>
                  <div>
                    <div className="text-sm text-mist-300">{q.votes}</div>
                    <div className="text-[10px] text-mist-500">票数</div>
                  </div>
                  <div>
                    <div className="text-sm text-mist-300">{(q.views / 1000).toFixed(1)}k</div>
                    <div className="text-[10px] text-mist-500">浏览</div>
                  </div>
                </div>

                {/* 主体 */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="heading-display text-lg leading-snug text-parchment-50 transition-colors group-hover:text-star-200">
                      {q.title}
                    </h3>
                    {q.bounty && (
                      <span className="pill-gold shrink-0">
                        <Star size={10} className="fill-star-400" /> 悬赏 {q.bounty}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-mist-400">
                    {q.excerpt}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {q.tags.map((t) => (
                      <span key={t} className="pill">
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-xs text-mist-500">
                    <Avatar name={q.author} color={q.avatarColor} size={20} />
                    <span className="text-mist-300">{q.author}</span>
                    <span>·</span>
                    <span className="font-mono">{q.createdAt}</span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* 移动端统计提示 */}
        <div className="mt-6 flex items-center justify-center gap-6 text-xs text-mist-500 sm:hidden">
          <span className="flex items-center gap-1">
            <MessageCircle size={12} /> 回答数
          </span>
          <span className="flex items-center gap-1">
            <ThumbsUp size={12} /> 票数
          </span>
          <span className="flex items-center gap-1">
            <Eye size={12} /> 浏览
          </span>
        </div>
      </section>
    </>
  );
}
