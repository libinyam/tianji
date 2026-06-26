import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Lock,
  Users,
  PenLine,
  Check,
  Loader2,
  FileText,
  BookOpen,
} from "lucide-react";
import {
  fetchWorkshopById,
  joinWorkshop,
  canViewContent,
  type WorkshopProject,
  type Contribution,
} from "@/lib/workshops";
import { useAuthStore } from "@/stores/auth";
import Avatar from "@/components/Avatar";
import MathText from "@/components/MathText";
import ContributeModal from "@/components/ContributeModal";

export default function WorkshopDetail() {
  const { id } = useParams();
  const { user } = useAuthStore();

  const [project, setProject] = useState<WorkshopProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [contributeChapter, setContributeChapter] = useState<{
    id: string;
    title: string;
  } | null>(null);

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      const p = await fetchWorkshopById(id);
      if (mounted) {
        setProject(p);
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="container-tj flex items-center justify-center py-40 text-mist-400">
        <Loader2 size={20} className="mr-2 animate-spin" /> 加载项目中…
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container-tj py-40 text-center">
        <p className="text-mist-400">未找到该项目。</p>
        <Link to="/workshop" className="btn-ghost mt-6 inline-flex">
          <ArrowLeft size={15} /> 返回协作工坊
        </Link>
      </div>
    );
  }

  const uid = user?.uid ?? "";
  const isParticipant = project.participants.includes(uid);
  const isCreator = project.creatorUid === uid;
  const canView = canViewContent(project);

  const handleJoin = async () => {
    if (!user) {
      window.dispatchEvent(new CustomEvent("tianji:open-auth"));
      return;
    }
    setJoining(true);
    const ok = await joinWorkshop(project.id);
    if (ok) {
      setProject({ ...project, participants: [...project.participants, uid] });
    }
    setJoining(false);
  };

  const handleContribute = (chapterId: string, chapterTitle: string) => {
    if (!user) {
      window.dispatchEvent(new CustomEvent("tianji:open-auth"));
      return;
    }
    if (!isParticipant) {
      handleJoin().then(() => {
        setContributeChapter({ id: chapterId, title: chapterTitle });
      });
      return;
    }
    setContributeChapter({ id: chapterId, title: chapterTitle });
  };

  const handleContributed = (contribution: Contribution) => {
    setProject({
      ...project,
      contributions: [...project.contributions, contribution],
    });
  };

  // 按章节分组贡献
  const contributionsByChapter = project.contributions.reduce<
    Record<string, Contribution[]>
  >((acc, c) => {
    if (!acc[c.chapterId]) acc[c.chapterId] = [];
    acc[c.chapterId].push(c);
    return acc;
  }, {});

  return (
    <div className="container-tj py-10">
      <Link
        to="/workshop"
        className="inline-flex items-center gap-1.5 text-sm text-mist-400 transition-colors hover:text-star-300"
      >
        <ArrowLeft size={15} /> 返回协作工坊
      </Link>

      {/* 项目头部 */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mt-8"
      >
        <div className="flex items-center gap-2">
          <span
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
              project.type === "教材"
                ? "border-star-400/40 bg-star-400/10 text-star-300"
                : "border-tian-400/40 bg-tian-400/10 text-tian-200"
            }`}
          >
            {project.type === "教材" ? <BookOpen size={12} /> : <FileText size={12} />}
            {project.type}
          </span>
          <span className="pill">{project.status}</span>
          {project.tags.map((t) => (
            <span key={t} className="pill">
              {t}
            </span>
          ))}
        </div>

        <h1 className="mt-4 heading-display text-2xl leading-snug text-parchment-50 sm:text-3xl">
          {project.title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mist-300">
          {project.description}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-mist-500">
          <div className="flex items-center gap-2">
            <Avatar name={project.creator} color={project.avatarColor} size={22} />
            <span className="text-mist-300">{project.creator}</span>
            <span className="text-mist-500">（发起人）</span>
          </div>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Users size={12} /> {project.participants.length} 位参与者
          </span>
          <span>·</span>
          <span className="font-mono">{project.outline.length} 章</span>
        </div>

        {/* 加入按钮 */}
        {!isParticipant && (
          <button
            onClick={handleJoin}
            disabled={joining}
            className="btn-gold mt-5 disabled:opacity-60"
          >
            {joining ? (
              <>
                <Loader2 size={14} className="animate-spin" /> 加入中…
              </>
            ) : (
              <>
                <Users size={14} /> 加入项目
              </>
            )}
          </button>
        )}
        {isParticipant && !isCreator && (
          <span className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-300">
            <Check size={13} /> 已加入
          </span>
        )}
      </motion.div>

      {/* 论文权限提示 */}
      {project.type === "论文" && !canView && (
        <div className="mt-8 rounded-xl border border-tian-400/30 bg-tian-400/5 p-8 text-center">
          <Lock className="mx-auto mb-3 h-8 w-8 text-tian-300" />
          <p className="heading-display text-lg text-parchment-50">论文内容仅参与者可见</p>
          <p className="mt-2 text-sm text-mist-400">
            加入项目后，即可查看大纲详情和已有贡献，并提交你的章节内容。
          </p>
          <button onClick={handleJoin} disabled={joining} className="btn-gold mt-5 disabled:opacity-60">
            {joining ? "加入中…" : "加入项目"}
          </button>
        </div>
      )}

      {/* 大纲 + 贡献 */}
      {canView && (
        <div className="mt-10 space-y-5">
          <div className="mb-4 flex items-center gap-2">
            <PenLine size={18} className="text-star-400" />
            <h2 className="heading-display text-xl text-parchment-50">章节大纲与贡献</h2>
          </div>

          {project.outline.map((chapter, i) => {
            const chapterContributions = contributionsByChapter[chapter.id] ?? [];
            return (
              <motion.div
                key={chapter.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="rounded-xl border border-void-600/40 bg-void-800/30 p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-mist-500">
                        第{i + 1}章
                      </span>
                      <span className="text-xs text-mist-500">
                        {chapterContributions.length} 份贡献
                      </span>
                    </div>
                    <h3 className="mt-1 heading-display text-lg text-parchment-50">
                      {chapter.title}
                    </h3>
                    {chapter.brief && (
                      <p className="mt-1 text-sm text-mist-400">{chapter.brief}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleContribute(chapter.id, chapter.title)}
                    className="btn-ghost shrink-0 text-xs"
                  >
                    <PenLine size={13} /> 贡献内容
                  </button>
                </div>

                {/* 贡献列表 */}
                {chapterContributions.length > 0 && (
                  <div className="mt-4 space-y-3 border-t border-void-600/30 pt-4">
                    {chapterContributions.map((c, ci) => (
                      <div
                        key={c.id}
                        className="rounded-lg border border-void-600/30 bg-void-900/30 p-4"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs text-mist-500">
                            <Avatar name={c.author} color={c.avatarColor} size={18} />
                            <span className="text-mist-300">{c.author}</span>
                            <span>·</span>
                            <span className="font-mono">{c.createdAt}</span>
                            <span className="text-mist-500">#{ci + 1}</span>
                          </div>
                        </div>
                        <MathText
                          content={c.content}
                          className="text-sm leading-relaxed text-mist-200"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* 贡献弹窗 */}
      {contributeChapter && (
        <ContributeModal
          open={!!contributeChapter}
          onClose={() => setContributeChapter(null)}
          workshopId={project.id}
          chapterId={contributeChapter.id}
          chapterTitle={contributeChapter.title}
          onContributed={handleContributed}
        />
      )}
    </div>
  );
}
