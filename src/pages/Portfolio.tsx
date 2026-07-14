import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Trophy, Users, Clock, ArrowRight, BookOpen } from "lucide-react";
import PageHero from "@/components/PageHero";
import EmptyState from "@/components/EmptyState";
import { PostCardSkeleton } from "@/components/Skeleton";
import {
  fetchPortfolioWorks,
  type WorkshopProject,
} from "@/lib/workshops";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useSEO } from "@/hooks/useSEO";

function formatTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) return "今天";
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export default function Portfolio() {
  useDocumentTitle("作品集");
  useSEO({
    title: "作品集 — 天玑",
    description:
      "天玑社区成员的项目作品集——从学习到产出的真实成果展示。每个作品都源自协作工坊，包含项目文档、贡献者、技术栈与演示链接。",
    canonical: "https://tianjihub.cn/portfolio",
  });

  const [works, setWorks] = useState<WorkshopProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPortfolioWorks()
      .then(setWorks)
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHero
        eyebrow="PORTFOLIO"
        title={
          <>
            从学习到作品的<span className="text-star-400">真实成果</span>
          </>
        }
        subtitle="天玑不只是学习社区——在这里，学习最终会变成可展示的作品。每个成果都源自协作工坊，包含项目文档、贡献者和技术栈，证明「我真的学会了」。"
      >
        <Link to="/growth" className="btn-gold inline-flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          查看成长路径
        </Link>
      </PageHero>

      <section className="container-tj py-12 lg:py-16">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <PostCardSkeleton key={i} />
            ))}
          </div>
        ) : works.length === 0 ? (
          <EmptyState
            icon={<Trophy size={28} strokeWidth={1.5} />}
            title="还没有作品集成果"
            description="协作工坊的项目创建者可以将项目标记为「作品集成果」，展示给评审和同学。去协作工坊看看有哪些正在进行的项目吧。"
            actionText="浏览协作工坊"
            onAction={() => {
              window.location.href = "/workshop";
            }}
          />
        ) : (
          <>
            {/* 作品集统计 */}
            <div className="mb-8 flex flex-wrap items-center gap-6 rounded-xl border border-void-600/30 bg-void-800/20 p-5">
              <div>
                <span className="heading-display text-2xl text-star-400">
                  {works.length}
                </span>
                <span className="ml-2 text-sm text-mist-400">个作品</span>
              </div>
              <div className="h-8 w-px bg-void-600/40" />
              <div>
                <span className="heading-display text-2xl text-star-400">
                  {works.reduce((sum, w) => sum + (w.participants?.length ?? 0), 0)}
                </span>
                <span className="ml-2 text-sm text-mist-400">位贡献者</span>
              </div>
              <div className="h-8 w-px bg-void-600/40" />
              <div>
                <span className="heading-display text-2xl text-star-400">
                  {works.reduce((sum, w) => sum + (w.contributions?.length ?? 0), 0)}
                </span>
                <span className="ml-2 text-sm text-mist-400">次协作贡献</span>
              </div>
            </div>

            {/* 作品卡片网格 */}
            <div className="grid gap-5 md:grid-cols-2">
              {works.map((work) => (
                <Link
                  key={work.id}
                  to={`/workshop/${work.id}`}
                  className="group flex flex-col rounded-xl border border-void-600/30 bg-void-800/20 p-6 transition-colors hover:border-star-500/30 hover:bg-void-800/40"
                >
                  {/* 标题行 */}
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="heading-display text-lg text-parchment-50 sm:text-xl">
                      {work.title}
                    </h3>
                    <span className="shrink-0 rounded-full bg-star-400/10 px-3 py-1 text-xs font-medium text-star-300">
                      {work.type}
                    </span>
                  </div>

                  {/* 描述 */}
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-mist-300">
                    {work.description}
                  </p>

                  {/* 大纲进度 */}
                  {work.outline && work.outline.length > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center gap-2 text-xs text-mist-500">
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>{work.outline.length} 章大纲</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {work.outline.slice(0, 4).map((ch) => (
                          <span
                            key={ch.id}
                            className="rounded bg-void-700/40 px-2 py-0.5 text-xs text-mist-400"
                          >
                            {ch.title.length > 12 ? ch.title.slice(0, 12) + "…" : ch.title}
                          </span>
                        ))}
                        {work.outline.length > 4 && (
                          <span className="rounded bg-void-700/40 px-2 py-0.5 text-xs text-mist-500">
                            +{work.outline.length - 4}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 标签 */}
                  {work.tags && work.tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {work.tags
                        .filter((t) => t !== "作品集")
                        .slice(0, 5)
                        .map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-void-700/30 px-2.5 py-0.5 text-xs text-mist-400"
                          >
                            {tag}
                          </span>
                        ))}
                    </div>
                  )}

                  {/* 底栏：贡献者 + 时间 */}
                  <div className="mt-5 flex items-center justify-between border-t border-void-600/20 pt-4">
                    <div className="flex items-center gap-4 text-xs text-mist-500">
                      <span className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        {work.participants?.length ?? 0} 人协作
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {formatTime(work.updatedAt || work.createdAt)}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs text-star-300 opacity-0 transition-opacity group-hover:opacity-100">
                      查看作品 <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>
    </>
  );
}
