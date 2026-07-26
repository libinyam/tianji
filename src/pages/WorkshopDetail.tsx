import { useState, useEffect, useRef } from "react";
import { openAuthModal } from "@/lib/pending-action";
import { formatRelativeTime } from "@/lib/format";
import { Link, useParams, useNavigate } from "react-router-dom";
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
  Trash2,
  Settings,
  ListTree,
  LogOut,
  Plus,
} from "lucide-react";
import { PostDetailSkeleton } from "@/components/Skeleton";
import ContributeModal from "@/components/ContributeModal";
import {
  fetchWorkshopById,
  joinWorkshop,
  canViewContent,
  updateWorkshop,
  deleteWorkshop,
  addAnnotation,
  resolveAnnotation,
  leaveWorkshop,
  deleteAnnotation,
  type WorkshopProject,
  type Annotation,
  type WorkshopStatus,
  type Contribution,
  type OutlineChapter,
} from "@/lib/workshops";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/stores/toast";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useSEO } from "@/hooks/useSEO";
import Avatar from "@/components/Avatar";
import LazyMathText from "@/components/LazyMathText";
import RelatedContent from "@/components/RelatedContent";

export default function WorkshopDetail() {
  const { id } = useParams();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [project, setProject] = useState<WorkshopProject | null>(null);
  useDocumentTitle(project?.title);
  // #150 动态 SEO
  useSEO({
    title: project?.title,
    description: project?.description,
    canonical: id ? `https://tianjihub.cn/workshop/${id}` : undefined,
  });
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  // 内联编辑器状态
  const [content, setContent] = useState("");
  const [editing, setEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // 元信息编辑状态
  const [metaEditing, setMetaEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [metaSaving, setMetaSaving] = useState(false);

  // 删除确认状态
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // #30 章节贡献流：当前正在贡献的章节
  const [contributingChapter, setContributingChapter] = useState<OutlineChapter | null>(null);

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
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [id]);

  // 清理自动保存定时器
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  if (loading) {
    return <PostDetailSkeleton />;
  }

  if (!project) {
    return (
      <div className="container-tj py-10 text-center">
        <p className="text-mist-400">未找到该项目。</p>
        <Link to="/workshop" className="btn-secondary mt-6 inline-flex">
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
      openAuthModal();
      return;
    }
    setJoining(true);
    try {
      const ok = await joinWorkshop(project.id);
      if (ok) {
        setProject({ ...project, participants: [...project.participants, uid] });
        toast.success("已加入协作");
      } else {
        toast.error("加入失败，请重试");
      }
    } catch {
      toast.error("加入失败，请重试");
    } finally {
      setJoining(false);
    }
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
            prev ? { ...prev, content: value, updatedAt: new Date().toISOString() } : prev,
          );
        } else {
          setSaveStatus("error");
        }
      } catch {
        setSaveStatus("error");
      }
    }, 2000);
  };

  const handleToggleEdit = async () => {
    if (editing) {
      // 退出编辑前立即保存未保存的内容
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        if (id && content !== project.content) {
          try {
            const ok = await updateWorkshop(id, { content });
            if (ok) {
              setProject((prev) =>
                prev
                  ? {
                      ...prev,
                      content,
                      updatedAt: new Date().toISOString(),
                    }
                  : prev,
              );
            } else {
              toast.error("保存失败，请稍后重试");
            }
          } catch {
            toast.error("保存失败，请稍后重试");
          }
        }
      }
      setSaveStatus("idle");
    } else {
      setContent(project.content);
    }
    setEditing(!editing);
  };

  // 元信息编辑：进入编辑
  const handleStartMetaEdit = () => {
    if (!project) return;
    setEditTitle(project.title);
    setEditDesc(project.description);
    setMetaEditing(true);
  };

  // 元信息编辑：保存
  const handleSaveMeta = async () => {
    if (!id || !project) return;
    if (!editTitle.trim()) {
      toast.error("标题不能为空");
      return;
    }
    setMetaSaving(true);
    try {
      const ok = await updateWorkshop(id, {
        title: editTitle.trim(),
        description: editDesc.trim(),
      });
      if (ok) {
        setProject({
          ...project,
          title: editTitle.trim(),
          description: editDesc.trim(),
          updatedAt: new Date().toISOString(),
        });
        setMetaEditing(false);
        toast.success("已保存");
      } else {
        toast.error("保存失败，请重试");
      }
    } catch {
      toast.error("保存失败，可能是权限不足");
    } finally {
      setMetaSaving(false);
    }
  };

  // 删除项目
  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      const ok = await deleteWorkshop(id);
      if (ok) {
        toast.success("项目已删除");
        navigate("/workshop");
      } else {
        toast.error("删除失败，请重试");
        setDeleteConfirm(false);
      }
    } catch (err) {
      toast.error((err as Error).message || "删除失败，可能是权限不足");
      setDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  // #98 变更项目状态（仅创建者）
  const handleStatusChange = async (newStatus: WorkshopStatus) => {
    if (!id || !project) return;
    try {
      const ok = await updateWorkshop(id, { status: newStatus });
      if (ok) {
        setProject({ ...project, status: newStatus, updatedAt: new Date().toISOString() });
        toast.success(`状态已变更为「${newStatus}」`);
      } else {
        toast.error("状态变更失败");
      }
    } catch (err) {
      toast.error((err as Error).message || "状态变更失败");
    }
  };

  // #98 参与者退出项目
  const handleLeave = async () => {
    if (!id || !user) return;
    try {
      const ok = await leaveWorkshop(id);
      if (ok) {
        toast.success("已退出项目");
        navigate("/workshop");
      }
    } catch (err) {
      toast.error((err as Error).message || "退出失败");
    }
  };

  // #98 删除批注
  const handleDeleteAnnotation = async (annotId: string) => {
    if (!id || !project) return;
    try {
      const ok = await deleteAnnotation(id, annotId);
      if (ok) {
        setProject({
          ...project,
          annotations: project.annotations.filter((a) => a.id !== annotId),
        });
        toast.success("批注已删除");
      }
    } catch (err) {
      toast.error((err as Error).message || "删除失败");
    }
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
      openAuthModal();
      return;
    }
    setAnnotSubmitting(true);
    setAnnotError(null);
    try {
      const annot = await addAnnotation(id, annotInput, selectedText);
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
      openAuthModal();
      return;
    }
    try {
      const ok = await resolveAnnotation(id, annotId);
      if (ok) {
        setProject({
          ...project,
          annotations: project.annotations.map((a) =>
            a.id === annotId ? { ...a, resolved: true } : a,
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
        className="inline-flex items-center gap-1.5 text-sm text-mist-400 transition-colors hover:text-tian-500"
      >
        <ArrowLeft size={15} /> 返回协作工坊
      </Link>

      {/* 项目头部 */}
      <div className="mt-8">
        <div className="flex items-center gap-2">
          <span className="pill">
            {project.type === "教材" ? <BookOpen size={12} /> : <FileText size={12} />}
            {project.type}
          </span>
          <span className={project.status === "已完成" ? "pill" : "pill-blue"}>
            {project.status}
          </span>
          {/* #98 创建者可变更状态 */}
          {isCreator && (
            <select
              value={project.status}
              onChange={(e) => handleStatusChange(e.target.value as WorkshopStatus)}
              className="rounded-md border border-void-600 bg-void-900 px-2 py-0.5 text-xs text-mist-300 focus:border-tian-500 focus:outline-none"
              aria-label="变更项目状态"
            >
              <option value="招募中">招募中</option>
              <option value="进行中">进行中</option>
              <option value="已完成">已完成</option>
            </select>
          )}
          {project.tags.map((t) => (
            <Link
              key={t}
              to={`/tags/${encodeURIComponent(t)}`}
              className="pill transition-colors hover:text-tian-500"
            >
              {t}
            </Link>
          ))}
        </div>

        <div className="mt-4 flex items-start justify-between gap-4">
          {metaEditing ? (
            <div className="flex-1 space-y-2">
              <input
                name="workshop-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="项目标题"
                className="w-full rounded-lg border border-void-600 bg-void-950 px-3 py-2 text-xl font-bold text-parchment-50 placeholder:text-mist-500 focus:border-tian-500 focus:outline-none"
                maxLength={200}
              />
              <textarea
                name="workshop-desc"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="简要描述项目的目标、适合的人群、协作方式…"
                rows={4}
                className="w-full resize-none rounded-lg border border-void-600 bg-void-950 p-3 text-sm leading-relaxed text-parchment-100 placeholder:text-mist-500 focus:border-tian-500 focus:outline-none"
                maxLength={5000}
              />
            </div>
          ) : (
            <h1 className="heading-display text-2xl leading-snug text-parchment-50 sm:text-3xl">
              {project.title}
            </h1>
          )}
          {/* #98 编辑文档：创建者和参与者都可编辑 content */}
          {(isCreator || isParticipant) && !metaEditing && (
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={handleToggleEdit}
                className={`btn-secondary text-xs ${
                  editing ? "border-tian-500 text-tian-500" : ""
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
              {/* 项目设置（标题/简介）仅创建者可见 */}
              {isCreator && (
                <button
                  onClick={handleStartMetaEdit}
                  className="btn-secondary text-xs"
                  title="编辑标题和简介"
                >
                  <Settings size={13} /> 项目设置
                </button>
              )}
            </div>
          )}
        </div>

        {metaEditing ? (
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={handleSaveMeta}
              disabled={metaSaving}
              className="btn-primary text-xs disabled:opacity-60"
            >
              {metaSaving ? (
                <>
                  <Loader2 size={13} className="animate-spin" /> 保存中…
                </>
              ) : (
                <>
                  <Check size={13} /> 保存
                </>
              )}
            </button>
            <button onClick={() => setMetaEditing(false)} className="btn-secondary text-xs">
              <X size={13} /> 取消
            </button>
          </div>
        ) : (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mist-300">
            {project.description}
          </p>
        )}

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
              <span>更新于 {formatRelativeTime(project.updatedAt)}</span>
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
                  title={
                    isCreatorMember
                      ? `${project.creator}（创建者）`
                      : `用户 ${pUid ? pUid.slice(-6) : "未知"}`
                  }
                  className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-void-900 font-display text-[10px] text-void-900"
                  style={{
                    background: isCreatorMember
                      ? project.avatarColor
                      : `hsl(${(pUid.charCodeAt(0) * 37) % 360}, 60%, 65%)`,
                  }}
                >
                  {isCreatorMember ? project.creator.charAt(0) : pUid.slice(-2)}
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
            className="btn-primary mt-5 disabled:opacity-60"
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
          <div className="mt-5 flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-600">
              <Check size={13} /> 已加入
            </span>
            {/* #98 参与者退出项目 */}
            <button
              onClick={handleLeave}
              className="inline-flex items-center gap-1 text-xs text-mist-500 transition-colors hover:text-red-500"
            >
              <LogOut size={12} /> 退出项目
            </button>
          </div>
        )}

        {/* 创建者：删除项目 */}
        {isCreator && !metaEditing && (
          <div className="mt-6 border-t border-void-600 pt-4">
            {deleteConfirm ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-red-600">确定删除整个项目？此操作不可撤销。</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-60"
                >
                  {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  {deleting ? "删除中…" : "确认删除"}
                </button>
                <button
                  onClick={() => setDeleteConfirm(false)}
                  disabled={deleting}
                  className="btn-secondary text-xs"
                >
                  取消
                </button>
              </div>
            ) : (
              <button
                onClick={() => setDeleteConfirm(true)}
                className="inline-flex items-center gap-1.5 text-xs text-mist-500 transition-colors hover:text-red-500"
              >
                <Trash2 size={12} /> 删除项目
              </button>
            )}
          </div>
        )}
      </div>

      {/* 论文权限提示 */}
      {project.type === "论文" && !canView && (
        <div className="mt-8 rounded-lg border border-void-600 bg-void-700 p-6 text-center">
          <Lock className="mx-auto mb-3 h-8 w-8 text-mist-400" />
          <p className="heading-display text-lg text-parchment-50">论文内容仅参与者可见</p>
          <p className="mt-2 text-sm text-mist-400">
            加入项目后，即可查看和编辑文档内容，并参与批注讨论。
          </p>
          <button
            onClick={handleJoin}
            disabled={joining}
            className="btn-primary mt-5 disabled:opacity-60"
          >
            {joining ? "加入中…" : "加入项目"}
          </button>
        </div>
      )}

      {/* #30 章节大纲 + 贡献流：每章一张卡片，含贡献按钮和该章节的贡献列表 */}
      {project.outline.length > 0 && (
        <div className="mt-8 rounded-lg border border-void-600 bg-void-800">
          <div className="flex items-center gap-2 border-b border-void-600 px-4 py-3">
            <ListTree size={15} className="text-mist-400" />
            <h3 className="text-sm font-medium text-parchment-100">
              章节大纲 · {project.outline.length} 章 · {project.contributions.length} 条贡献
            </h3>
          </div>
          <div className="divide-y divide-void-600">
            {project.outline.map((ch, i) => {
              const chapterContribs = project.contributions.filter((c) => c.chapterId === ch.id);
              return (
                <div key={ch.id} className="p-4">
                  {/* 章节标题区 */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-mist-500">第{i + 1}章</span>
                        <p className="text-sm font-medium text-parchment-100">{ch.title}</p>
                        {chapterContribs.length > 0 && (
                          <span className="rounded-full bg-void-700 px-1.5 py-0.5 text-[10px] text-mist-400">
                            {chapterContribs.length} 条贡献
                          </span>
                        )}
                      </div>
                      {ch.brief && <p className="mt-1 text-xs text-mist-400">{ch.brief}</p>}
                    </div>
                    {/* #30 参与者可为每个章节贡献内容 */}
                    {(isCreator || isParticipant) && (
                      <button
                        onClick={() => setContributingChapter(ch)}
                        className="flex shrink-0 items-center gap-1 rounded-md border border-void-600 px-3 py-1.5 text-xs text-tian-500 transition-colors hover:bg-void-700"
                      >
                        <Plus size={12} /> 贡献内容
                      </button>
                    )}
                  </div>

                  {/* 该章节的贡献列表 */}
                  {chapterContribs.length > 0 && (
                    <div className="mt-3 divide-y divide-void-600 border-t border-void-600">
                      {chapterContribs.map((c) => (
                        <div key={c.id} className="py-2.5">
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Avatar name={c.author} color={c.avatarColor} size={18} />
                              <span className="text-xs text-mist-300">{c.author}</span>
                            </div>
                            <span className="text-[10px] text-mist-500">
                              {formatRelativeTime(c.createdAt)}
                            </span>
                          </div>
                          <LazyMathText
                            content={c.content}
                            className="text-xs leading-relaxed text-parchment-200"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* #30 章节贡献弹窗 */}
      {contributingChapter && (
        <ContributeModal
          open={!!contributingChapter}
          onClose={() => setContributingChapter(null)}
          workshopId={project.id}
          chapterId={contributingChapter.id}
          chapterTitle={contributingChapter.title}
          onContributed={(contribution: Contribution) => {
            setProject({
              ...project,
              contributions: [...project.contributions, contribution],
            });
            setContributingChapter(null);
          }}
        />
      )}

      {/* 文档内容 + 批注 */}
      {canView && (
        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* 正文区域 */}
          <div className="card-surface relative overflow-hidden">
            {/* 编辑器顶栏 */}
            <div className="flex items-center justify-between border-b border-void-600 bg-void-700 px-5 py-3">
              <div className="flex items-center gap-2">
                <PenLine size={15} className="text-mist-400" />
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
                      <span className="flex items-center gap-1 text-emerald-600">
                        <Check size={11} /> 已自动保存
                      </span>
                    )}
                    {saveStatus === "error" && <span className="text-red-500">保存失败</span>}
                    {saveStatus === "idle" && <span className="text-mist-500">自动保存已开启</span>}
                  </>
                )}
                {!editing && content && <span className="text-mist-500">{content.length} 字</span>}
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
                  maxLength={30000}
                  className="w-full resize-y rounded-lg border border-void-600 bg-void-950 p-4 text-sm leading-relaxed text-parchment-100 placeholder:text-mist-500 focus:border-tian-500 focus:outline-none focus:ring-1 focus:ring-tian-500"
                />
              ) : content ? (
                <div className="prose-tj">
                  <LazyMathText
                    content={content}
                    className="text-[15px] leading-relaxed text-parchment-200"
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
              <div className="border-t border-void-600 px-5 py-2.5 text-xs text-mist-500">
                <MessageSquare size={11} className="mr-1 inline" />
                选中文本即可添加批注
              </div>
            )}
          </div>

          {/* 批注侧栏 */}
          <aside className="space-y-4">
            <div className="card-surface p-5">
              <div className="mb-4 flex items-center gap-2">
                <MessageSquare size={14} className="text-mist-400" />
                <h4 className="text-sm font-medium text-parchment-100">
                  批注 · {activeAnnotations.length}
                </h4>
              </div>

              {/* 批注输入表单 */}
              {showAnnotForm && (
                <div className="mb-4 rounded-lg border border-void-600 bg-void-700 p-3">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <span className="text-xs font-medium text-parchment-100">添加批注</span>
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
                    <div className="mb-2 rounded border-l-2 border-tian-500 bg-void-800 px-2 py-1 text-[11px] text-mist-400">
                      「{selectedText.length > 60 ? selectedText.slice(0, 60) + "…" : selectedText}
                      」
                    </div>
                  )}
                  <textarea
                    name="annotation"
                    value={annotInput}
                    onChange={(e) => setAnnotInput(e.target.value)}
                    rows={3}
                    placeholder="写下你的批注…"
                    maxLength={500}
                    className="w-full resize-y rounded-md border border-void-600 bg-void-950 p-2 text-xs leading-relaxed text-parchment-100 placeholder:text-mist-500 focus:border-tian-500 focus:outline-none"
                  />
                  {annotError && <p className="mt-1 text-[11px] text-red-500">{annotError}</p>}
                  <button
                    onClick={handleAddAnnotation}
                    disabled={annotSubmitting || !annotInput.trim()}
                    className="btn-primary mt-2 w-full justify-center py-1.5 text-xs disabled:opacity-60"
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
                </div>
              )}

              {/* 活跃批注列表 */}
              {activeAnnotations.length > 0 ? (
                <div className="divide-y divide-void-600">
                  {activeAnnotations.map((a, i) => (
                    <AnnotationCard
                      key={a.id}
                      annotation={a}
                      index={i}
                      canResolve={!!user && (isCreator || a.authorUid === uid)}
                      canDelete={!!user && (isCreator || a.authorUid === uid)}
                      onResolve={() => handleResolve(a.id)}
                      onDelete={() => handleDeleteAnnotation(a.id)}
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
                <div className="mt-4 border-t border-void-600 pt-3">
                  <button
                    onClick={() => setShowResolved(!showResolved)}
                    className="flex w-full items-center justify-between text-xs text-mist-500 transition-colors hover:text-mist-300"
                  >
                    <span>已解决 · {resolvedAnnotations.length}</span>
                    <span>{showResolved ? "收起" : "展开"}</span>
                  </button>
                  {showResolved && (
                    <div className="mt-3 divide-y divide-void-600">
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

      {project.tags.length > 0 && <RelatedContent tags={project.tags} excludeId={project.id} />}
    </div>
  );
}

/** 批注卡片组件 */
function AnnotationCard({
  annotation,
  resolved = false,
  canResolve,
  canDelete,
  onResolve,
  onDelete,
}: {
  annotation: Annotation;
  index: number;
  resolved?: boolean;
  canResolve: boolean;
  canDelete?: boolean;
  onResolve: () => void;
  onDelete?: () => void;
}) {
  const avatarColor = `hsl(${((annotation.authorUid || "x").charCodeAt(0) * 37) % 360}, 60%, 65%)`;
  return (
    <div className={`py-3 ${resolved ? "opacity-60" : ""}`}>
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
        <span className="text-[10px] text-mist-500">
          {formatRelativeTime(annotation.createdAt)}
        </span>
      </div>
      <LazyMathText
        content={annotation.content}
        className="text-xs leading-relaxed text-parchment-200"
      />
      {/* #27 展示批注对应的选中文本快照 */}
      {annotation.selectedText && (
        <blockquote className="mt-2 border-l-2 border-void-600 bg-void-700 px-2.5 py-1 text-[11px] italic leading-relaxed text-mist-400">
          「
          {annotation.selectedText.length > 80
            ? annotation.selectedText.slice(0, 80) + "…"
            : annotation.selectedText}
          」
        </blockquote>
      )}
      <div className="mt-2 flex items-center justify-end gap-3">
        {resolved ? (
          <span className="flex items-center gap-1 text-[10px] text-emerald-600">
            <CheckCircle2 size={11} /> 已解决
          </span>
        ) : (
          canResolve && (
            <button
              onClick={onResolve}
              className="flex items-center gap-1 text-[10px] text-mist-400 transition-colors hover:text-emerald-600"
            >
              <CheckCircle2 size={11} /> 标记解决
            </button>
          )
        )}
        {/* #98 删除批注 */}
        {canDelete && !resolved && onDelete && (
          <button
            onClick={onDelete}
            className="flex items-center gap-1 text-[10px] text-mist-500 transition-colors hover:text-red-500"
            aria-label="删除批注"
          >
            <Trash2 size={11} /> 删除
          </button>
        )}
      </div>
    </div>
  );
}
