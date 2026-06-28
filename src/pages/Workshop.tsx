import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Plus, PenLine, Users, Sparkles, BookOpen, FileText, Lock, Loader2 } from "lucide-react";
import PageHero from "@/components/PageHero";
import EditorPreview from "@/components/EditorPreview";
import WorkshopCreateModal from "@/components/WorkshopCreateModal";
import { fetchWorkshops, canViewContent, type WorkshopProject } from "@/lib/workshops";
import { useAuthStore } from "@/stores/auth";
import { contributors } from "@/data/community";

function formatUpdatedAt(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Workshop() {
  const [createOpen, setCreateOpen] = useState(false);
  const [realProjects, setRealProjects] = useState<WorkshopProject[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const projects = await fetchWorkshops();
      if (mounted) {
        setRealProjects(projects);
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleCreateClick = () => {
    if (!user) {
      window.dispatchEvent(new CustomEvent("tianji:open-auth"));
      return;
    }
    setCreateOpen(true);
  };

  const handleNewProject = (project: WorkshopProject) => {
    setRealProjects((prev) => [project, ...prev]);
  };

  const totalContributors = new Set(
    [...realProjects.flatMap((p) => p.participants.map((uid) => uid))].join(",")
  ).size;

  return (
    <>
      <PageHero
        eyebrow="Workshop · 协作工坊"
        title={
          <>
            多人共创，把知识打磨成<span className="text-star-400">作品集</span>
          </>
        }
        subtitle="多人协作的项目与文档创作空间。发起大纲、邀请贡献者、共同书写教材与论文——把分散的学习与想法，编织成完整的作品。"
      >
        <div className="flex flex-wrap items-center gap-4 text-sm text-mist-400">
          <span className="flex items-center gap-1.5">
            <PenLine size={14} className="text-star-400" /> {realProjects.length} 部共创中
          </span>
          <span className="text-void-600">|</span>
          <span className="flex items-center gap-1.5">
            <Users size={14} className="text-star-400" /> {totalContributors || contributors.length} 位协作者
          </span>
          <button onClick={handleCreateClick} className="btn-gold ml-2">
            <Plus size={15} /> 新建项目
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

      {/* 真实项目列表 */}
      <section className="container-tj py-14">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="h-px w-8 bg-gradient-to-r from-transparent to-star-400" />
              <span className="font-mono text-xs uppercase tracking-[0.25em] text-star-300">
                协作项目 · 进行中
              </span>
            </div>
            <h2 className="heading-display text-2xl text-parchment-50 sm:text-3xl">
              {loading ? "加载中…" : "共创作品"}
            </h2>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20 text-mist-400">
            <Loader2 size={20} className="mr-2 animate-spin" /> 加载项目中…
          </div>
        )}

        {!loading && realProjects.length > 0 && (
          <div className="mb-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {realProjects.map((p, i) => {
              const canView = canViewContent(p);
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 22 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.45, delay: (i % 3) * 0.08 }}
                >
                  <Link
                    to={`/workshop/${p.id}`}
                    className="group flex h-full flex-col rounded-xl border border-void-600/50 bg-void-800/40 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-star-400/40 hover:shadow-card"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span
                        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                          p.type === "教材"
                            ? "border-star-400/40 bg-star-400/10 text-star-300"
                            : "border-tian-400/40 bg-tian-400/10 text-tian-200"
                        }`}
                      >
                        {p.type === "教材" ? <BookOpen size={11} /> : <FileText size={11} />}
                        {p.type}
                      </span>
                      <span className="text-[11px] text-mist-500">{p.status}</span>
                    </div>

                    <h3 className="heading-display text-lg leading-snug text-parchment-50 transition-colors group-hover:text-star-200">
                      {p.title}
                    </h3>
                    <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-mist-300">
                      {p.description}
                    </p>

                    {!canView && (
                      <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-tian-400/20 bg-tian-400/5 px-3 py-2 text-xs text-tian-200">
                        <Lock size={11} /> 加入后查看内容
                      </div>
                    )}

                    {canView && (
                      <div className="mt-3 text-xs text-mist-500">
                        {p.content ? `${p.content.length} 字` : "空文档"} · {p.annotations.filter((a) => !a.resolved).length} 条批注
                      </div>
                    )}

                    <div className="mt-4 flex items-center justify-between border-t border-void-600/30 pt-3 text-xs text-mist-400">
                      <div className="flex items-center gap-2">
                        <span
                          className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-medium text-void-900"
                          style={{ background: p.avatarColor }}
                        >
                          {p.creator.charAt(0)}
                        </span>
                        <span className="text-mist-300">{p.creator}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Users size={11} /> {p.participants.length}
                        </span>
                        {p.updatedAt && (
                          <span className="text-[10px] text-mist-500">{formatUpdatedAt(p.updatedAt)}</span>
                        )}
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* 空状态 */}
        {!loading && realProjects.length === 0 && (
          <div className="rounded-xl border border-dashed border-void-600/40 bg-void-800/20 py-16 text-center">
            <PenLine size={28} className="mx-auto mb-3 text-mist-500" />
            <p className="text-sm text-mist-400">还没有协作项目</p>
            <p className="mt-1 text-xs text-mist-500">点击「新建项目」发起第一个共创文档</p>
          </div>
        )}
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

      <WorkshopCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleNewProject}
      />
    </>
  );
}
