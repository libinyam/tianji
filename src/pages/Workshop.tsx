import { Plus, PenLine, Users, Sparkles } from "lucide-react";
import PageHero from "@/components/PageHero";
import DocCard from "@/components/DocCard";
import EditorPreview from "@/components/EditorPreview";
import { docs } from "@/data/docs";
import { contributors } from "@/data/community";

export default function Workshop() {
  const totalContributors = new Set(docs.flatMap((d) => d.contributors)).size;

  return (
    <>
      <PageHero
        eyebrow="Workshop · 协作工坊"
        title={
          <>
            多人共创，把知识打磨成<span className="text-star-400">作品集</span>
          </>
        }
        subtitle="多人协作的项目与文档创作空间。实时协同编辑、行内批注、版本追踪——把分散的学习与想法，编织成完整的教材、教程与作品集。"
      >
        <div className="flex flex-wrap items-center gap-4 text-sm text-mist-400">
          <span className="flex items-center gap-1.5">
            <PenLine size={14} className="text-star-400" /> {docs.length} 部共创中
          </span>
          <span className="text-void-600">|</span>
          <span className="flex items-center gap-1.5">
            <Users size={14} className="text-star-400" /> {totalContributors} 位协作者
          </span>
          <button className="btn-gold ml-2">
            <Plus size={15} /> 新建文档
          </button>
        </div>
      </PageHero>

      {/* 实时协作预览 */}
      <section className="container-tj py-14">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span className="font-mono text-xs uppercase tracking-[0.25em] text-emerald-400">
                Live · 实时协作中
              </span>
            </div>
            <h2 className="heading-display text-2xl text-parchment-50 sm:text-3xl">
              此刻正在共笔
            </h2>
          </div>
          <p className="hidden max-w-xs text-sm text-mist-400 sm:block">
            协作者的光标实时显现，每一处批注都在推动作品趋近完美。
          </p>
        </div>
        <EditorPreview />
      </section>

      {/* 文档列表 */}
      <section className="container-tj py-14">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="h-px w-8 bg-gradient-to-r from-transparent to-star-400" />
              <span className="font-mono text-xs uppercase tracking-[0.25em] text-star-300">
                协作文档 · 全部
              </span>
            </div>
            <h2 className="heading-display text-2xl text-parchment-50 sm:text-3xl">
              进行中的共创作品
            </h2>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {docs.map((d, i) => (
            <DocCard key={d.id} doc={d} index={i} />
          ))}
        </div>
      </section>

      {/* 贡献者面板 */}
      <section className="container-tj py-14">
        <div className="card-surface grain relative overflow-hidden p-8 sm:p-10">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-star-400/10 blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_1.4fr] lg:items-center">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Sparkles size={15} className="text-star-400" />
                <span className="font-mono text-xs uppercase tracking-[0.25em] text-star-300">
                  贡献者星谱
                </span>
              </div>
              <h2 className="heading-display text-2xl text-parchment-50 sm:text-3xl">
                每一位作者，都是一颗不可或缺的星辰
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-mist-300">
                协作工坊记录每一位贡献者的编辑、批注与修订。在这里，著作权属于所有让作品生长的人。
              </p>
            </div>

            <div className="space-y-3">
              {contributors.slice(0, 5).map((c, i) => (
                <div
                  key={c.name}
                  className="flex items-center gap-4 rounded-lg border border-void-600/40 bg-void-800/40 p-3"
                >
                  <span className="font-mono text-xs text-mist-500">#{i + 1}</span>
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full font-display text-sm text-void-900"
                    style={{
                      background: `linear-gradient(135deg, ${c.avatarColor}, ${c.avatarColor}aa)`,
                    }}
                  >
                    {c.name.charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-parchment-100">{c.name}</div>
                    <div className="text-xs text-mist-400">{c.role}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm text-star-300">{c.contributions}</div>
                    <div className="text-[10px] text-mist-500">贡献</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
