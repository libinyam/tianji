import { useState, useEffect, useRef } from "react";
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
  Edit3,
  MessageSquare,
  CheckCircle2,
  Send,
  X,
  Eye,
} from "lucide-react";
import {
  fetchWorkshopById,
  joinWorkshop,
  canViewContent,
  updateWorkshop,
  addAnnotation,
  resolveAnnotation,
  type WorkshopProject,
  type Annotation,
} from "@/lib/workshops";
import { useAuthStore } from "@/stores/auth";
import Avatar from "@/components/Avatar";
import MathText from "@/components/MathText";

function formatTime(iso: string): string {
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

export default function WorkshopDetail() {
  const { id } = useParams();
  const { user } = useAuthStore();

  const [project, setProject] = useState<WorkshopProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  // 内联编辑器状态
  const [content, setContent] = useState("");
  const [editing, setEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // 批注状态
  const [selectedText, setSelectedText] = useState("");
  const [annotInput, setAnnotInput] = useState("");
  const [showAnnotForm, setShowAnnotForm] = useState(false);
  const [annotSubmitting, setAnnotSubmitting] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [annotError, setAnnotError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      const p = await fetchWorkshopById(id);
      if (mounted) {
        setProject(p);
        setContent(p?.content ?? "");
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  // 清理自动保存定时器
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

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

  // 自动保存（编辑后 2 秒）
  const handleContentChange = (value: string) => {
    setContent(value);
    setSaveStatus("idle");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      if (!id) return;
      setSaveStatus("saving");
      try {
        const ok = await updateWorkshop(id, { content: value });
        if (ok) {
          setSaveStatus("saved");
          setProject((prev) =>
            prev
              ? { ...prev, content: value, updatedAt: new Date().toISOString() }
              : prev
          );
        } else {
          setSaveStatus("error");
        }
      } catch {
        setSaveStatus("error");
      }
    }, 2000);
  };

  const handleToggleEdit = () => {
    if (editing) {
      // 退出编辑前立即保存未保存的内容
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        if (id && content !== project.content) {
          updateWorkshop(id, { content }).then((ok) => {
            if (ok) {
              setProject((prev) =>
                prev
                  ? {
                      ...prev,
                      content,
                      updatedAt: new Date().toISOString(),
                    }
                  : prev
              );
            }
          });
        }
      }
      setSaveStatus("idle");
    } else {
      setContent(project.content);
    }
    setEditing(!editing);
  };

  // 文本选中 → 显示批注表单
  const handleMouseUp = () => {
    if (editing) return;
    const sel = window.getSelection();
    if (sel && sel.toString().trim() && contentRef.current?.contains(sel.anchorNode)) {
      setSelectedText(sel.toString().trim());
      setShowAnnotForm(true);
    }
  };

  const handleAddAnnotation = async () => {
    if (!id || !annotInput.trim()) return;
    if (!user) {
      window.dispatchEvent(new CustomEvent("tianji:open-auth"));
      return;
    }
    setAnnotSubmitting(true);
    setAnnotError(null);
    try {
      const annot = await addAnnotation(id, annotInput);
      if (annot && project) {
        setProject({
          ...project,
          annotations: [...project.annotations, annot],
        });
        setAnnotInput("");
        setShowAnnotForm(false);
        setSelectedText("");
      }
    } catch (err) {
      setAnnotError((err as Error).message);
    } finally {
      setAnnotSubmitting(false);
    }
  };

  const handleResolve = async (annotId: string) => {
    if (!id || !project) return;
    if (!user) {
      window.dispatchEvent(new CustomEvent("tianji:open-auth"));
      return;
    }
    try {
      const ok = await resolveAnnotation(id, annotId);
      if (ok) {
        setProject({
          ...project,
          annotations: project.annotations.map((a) =>
            a.id === annotId ? { ...a, resolved: true } : a
          ),
        });
      }
    } catch {
      // 权限不足等错误静默处理
    }
  };

  const activeAnnotations = project.annotations.filter((a) => !a.resolved);
  const resolvedAnnotations = project.annotations.filter((a) => a.resolved);

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

        <div className="mt-4 flex items-start justify-between gap-4">
          <h1 className="heading-display text-2xl leading-snug text-parchment-50 sm:text-3xl">
            {project.title}
          </h1>
          {isCreator && (
            <button
              onClick={handleToggleEdit}
              className={`btn-ghost shrink-0 text-xs ${
                editing ? "border-star-400/40 text-star-300" : ""
              }`}
            >
              {editing ? (
                <>
                  <Eye size={13} /> 完成编辑
                </>
              ) : (
                <>
                  <Edit3 size={13} /> 编辑文档
                </>
              )}
            </button>
          )}
        </div>

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
          {project.updatedAt && (
            <>
              <span>·</span>
              <span>更新于 {formatTime(project.updatedAt)}</span>
            </>
          )}
        </div>

        {/* 参与成员列表 */}
        <div className="mt-4 flex items-center gap-2">
          <span className="text-xs text-mist-500">参与成员：</span>
          <div className="flex -space-x-1.5">
            {project.participants.slice(0, 10).map((pUid, i) => {
              const isCreatorMember = pUid === project.creatorUid;
              return (
                <span
                  key={pUid + i}
                  title={isCreatorMember ? `${project.creator}（创建者）` : `用户 ${pUid.slice(-6)}`}
                  className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-void-900 font-display text-[10px] text-void-900"
                  style={{
                    background: isCreatorMember
                      ? project.avatarColor
                      : `hsl(${(pUid.charCodeAt(0) * 37) % 360}, 60%, 65%)`,
                  }}
                >
                  {isCreatorMember
                    ? project.creator.charAt(0)
                    : pUid.slice(-2)}
                </span>
              );
            })}
            {project.participants.length > 10 && (
              <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-void-900 bg-void-700 text-[10px] text-mist-300">
                +{project.participants.length - 10}
              </span>
            )}
          </div>
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
            加入项目后，即可查看和编辑文档内容，并参与批注讨论。
          </p>
          <button onClick={handleJoin} disabled={joining} className="btn-gold mt-5 disabled:opacity-60">
            {joining ? "加入中…" : "加入项目"}
          </button>
        </div>
      )}

      {/* 文档内容 + 批注 */}
      {canView && (
        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* 正文区域 */}
          <div className="card-surface grain relative overflow-hidden">
            {/* 编辑器顶栏 */}
            <div className="flex items-center justify-between border-b border-void-600/40 bg-void-900/50 px-5 py-3">
              <div className="flex items-center gap-2">
                <PenLine size={15} className="text-star-400" />
                <span className="text-sm text-parchment-100">文档正文</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {editing && (
                  <>
                    {saveStatus === "saving" && (
                      <span className="flex items-center gap-1 text-mist-400">
                        <Loader2 size={11} className="animate-spin" /> 保存中…
                      </span>
                    )}
                    {saveStatus === "saved" && (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <Check size={11} /> 已自动保存
                      </span>
                    )}
                    {saveStatus === "error" && (
                      <span className="text-red-400">保存失败</span>
                    )}
                    {saveStatus === "idle" && (
                      <span className="text-mist-500">自动保存已开启</span>
                    )}
                  </>
                )}
                {!editing && content && (
                  <span className="text-mist-500">{content.length} 字</span>
                )}
              </div>
            </div>

            {/* 正文内容 */}
            <div className="p-6 sm:p-8" ref={contentRef} onMouseUp={handleMouseUp}>
              {editing ? (
                <textarea
                  value={content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  rows={20}
                  autoFocus
                  placeholder="撰写文档内容…支持 LaTeX：行内 $...$，行间 $$...$$"
                  className="w-full resize-y rounded-lg border border-void-600/50 bg-void-950/50 p-4 text-sm leading-relaxed text-parchment-100 placeholder:text-mist-500 focus:border-star-400/50 focus:outline-none focus:ring-1 focus:ring-star-400/30"
                />
              ) : content ? (
                <div className="prose-tj">
                  <MathText
                    content={content}
                    className="text-[15px] leading-relaxed text-mist-200"
                  />
                </div>
              ) : (
                <div className="py-12 text-center">
                  <PenLine size={28} className="mx-auto mb-3 text-mist-500" />
                  <p className="text-sm text-mist-400">
                    {isCreator ? "点击「编辑文档」开始撰写内容" : "创建者尚未撰写文档内容"}
                  </p>
                </div>
              )}
            </div>

            {/* 选中提示 */}
            {!editing && (
              <div className="border-t border-void-600/30 px-5 py-2.5 text-xs text-mist-500">
                <MessageSquare size={11} className="mr-1 inline" />
                选中文本即可添加批注
              </div>
            )}
          </div>

          {/* 批注侧栏 */}
          <aside className="space-y-4">
            <div className="card-surface grain p-5">
              <div className="mb-4 flex items-center gap-2">
                <MessageSquare size={14} className="text-star-400" />
                <h4 className="font-mono text-xs uppercase tracking-[0.2em] text-star-300">
                  批注 · {activeAnnotations.length}
                </h4>
              </div>

              {/* 批注输入表单 */}
              {showAnnotForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mb-4 overflow-hidden rounded-lg border border-tian-400/30 bg-tian-400/5 p-3"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <span className="text-xs text-tian-200">添加批注</span>
                    <button
                      onClick={() => {
                        setShowAnnotForm(false);
                        setSelectedText("");
                        setAnnotInput("");
                      }}
                      className="text-mist-500 transition-colors hover:text-mist-300"
                    >
                      <X size={13} />
                    </button>
                  </div>
                  {selectedText && (
                    <div className="mb-2 rounded border-l-2 border-tian-400/40 bg-void-900/40 px-2 py-1 text-[11px] text-mist-400">
                      「{selectedText.length > 60
                        ? selectedText.slice(0, 60) + "…"
                        : selectedText}」
                    </div>
                  )}
                  <textarea
                    value={annotInput}
                    onChange={(e) => setAnnotInput(e.target.value)}
                    rows={3}
                    placeholder="写下你的批注…"
                    className="w-full resize-y rounded-md border border-void-600/50 bg-void-950/50 p-2 text-xs leading-relaxed text-parchment-100 placeholder:text-mist-500 focus:border-star-400/50 focus:outline-none"
                  />
                  {annotError && (
                    <p className="mt-1 text-[11px] text-red-400">{annotError}</p>
                  )}
                  <button
                    onClick={handleAddAnnotation}
                    disabled={annotSubmitting || !annotInput.trim()}
                    className="btn-gold mt-2 w-full justify-center py-1.5 text-xs disabled:opacity-60"
                  >
                    {annotSubmitting ? (
                      <>
                        <Loader2 size={12} className="animate-spin" /> 提交中…
                      </>
                    ) : (
                      <>
                        <Send size={12} /> 提交批注
                      </>
                    )}
                  </button>
                </motion.div>
              )}

              {/* 活跃批注列表 */}
              {activeAnnotations.length > 0 ? (
                <div className="space-y-3">
                  {activeAnnotations.map((a, i) => (
                    <AnnotationCard
                      key={a.id}
                      annotation={a}
                      index={i}
                      canResolve={
                        !!user && (isCreator || a.authorUid === uid)
                      }
                      onResolve={() => handleResolve(a.id)}
                    />
                  ))}
                </div>
              ) : (
                !showAnnotForm && (
                  <p className="py-6 text-center text-xs text-mist-500">
                    暂无批注。选中文本即可添加。
                  </p>
                )
              )}

              {/* 已解决批注 */}
              {resolvedAnnotations.length > 0 && (
                <div className="mt-4 border-t border-void-600/30 pt-3">
                  <button
                    onClick={() => setShowResolved(!showResolved)}
                    className="flex w-full items-center justify-between text-xs text-mist-500 transition-colors hover:text-mist-300"
                  >
                    <span>
                      已解决 · {resolvedAnnotations.length}
                    </span>
                    <span>{showResolved ? "收起" : "展开"}</span>
                  </button>
                  {showResolved && (
                    <div className="mt-3 space-y-3">
                      {resolvedAnnotations.map((a, i) => (
                        <AnnotationCard
                          key={a.id}
                          annotation={a}
                          index={i}
                          resolved
                          canResolve={false}
                          onResolve={() => {}}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

/** 批注卡片组件 */
function AnnotationCard({
  annotation,
  index,
  resolved = false,
  canResolve,
  onResolve,
}: {
  annotation: Annotation;
  index: number;
  resolved?: boolean;
  canResolve: boolean;
  onResolve: () => void;
}) {
  const avatarColor = `hsl(${(annotation.authorUid.charCodeAt(0) * 37) % 360}, 60%, 65%)`;
  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={`rounded-lg border p-3 ${
        resolved
          ? "border-void-600/20 bg-void-800/20 opacity-60"
          : "border-void-600/40 bg-void-800/40"
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="flex h-5 w-5 items-center justify-center rounded-full font-display text-[10px] text-void-900"
            style={{ background: avatarColor }}
          >
            {annotation.author.charAt(0)}
          </span>
          <span className="text-xs text-mist-300">{annotation.author}</span>
        </div>
        <span className="font-mono text-[9px] text-mist-500">
          {formatTime(annotation.createdAt)}
        </span>
      </div>
      <MathText
        content={annotation.content}
        className="text-xs leading-relaxed text-mist-200"
      />
      <div className="mt-2 flex items-center justify-end">
        {resolved ? (
          <span className="flex items-center gap-1 text-[10px] text-emerald-400">
            <CheckCircle2 size={11} /> 已解决
          </span>
        ) : (
          canResolve && (
            <button
              onClick={onResolve}
              className="flex items-center gap-1 text-[10px] text-mist-400 transition-colors hover:text-emerald-400"
            >
              <CheckCircle2 size={11} /> 标记解决
            </button>
          )
        )}
      </div>
    </motion.div>
  );
}
