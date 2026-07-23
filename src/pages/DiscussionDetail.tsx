import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { toast } from "@/stores/toast";
import {
  ArrowLeft,
  ThumbsUp,
  Check,
  X,
  Star,
  Eye,
  MessageCircle,
  CornerDownRight,
  Loader2,
  Bookmark,
  Pencil,
  Trash2,
  Flag,
} from "lucide-react";
import ShareButton from "@/components/ShareButton";
import { PostDetailSkeleton } from "@/components/Skeleton";
import { questions as mockQuestions } from "@/data/questions";
import { submitAnswer } from "@/lib/posts";
import { toggleFavorite } from "@/lib/favorites";
import { rateLimiters } from "@/lib/security";
import { useAuthStore } from "@/stores/auth";
import { formatRelativeTime } from "@/lib/format";
import { useSEO, qaPageJsonLd } from "@/hooks/useSEO";
import { useDiscussionDetail } from "@/hooks/useDiscussionDetail";
import { useAnswerActions } from "@/hooks/useAnswerActions";
import { useCommentActions } from "@/hooks/useCommentActions";
import { usePostEditor } from "@/hooks/usePostEditor";
import LazyMarkdownRenderer from "@/components/LazyMarkdownRenderer";
import MarkdownEditor from "@/components/MarkdownEditor";
import Avatar from "@/components/Avatar";
import RelatedContent from "@/components/RelatedContent";
import ReportModal from "@/components/ReportModal";
import { isAuthor } from "@/lib/utils";

export default function DiscussionDetail() {
  const { id } = useParams();
  const { user } = useAuthStore();

  const mockQuestion = mockQuestions.find((q) => q.id === id);

  const { question, setQuestion, loading, loadError, voted, setVoted, favState, setFavState } =
    useDiscussionDetail(id, mockQuestion);
  // #150 动态 SEO + QAPage JSON-LD
  const pageUrl = id ? `https://tianjihub.cn/discussion/${id}` : "https://tianjihub.cn/";
  useSEO({
    title: question?.title,
    description: question?.excerpt,
    canonical: pageUrl,
    type: "article",
    jsonLd: question
      ? qaPageJsonLd({
          title: question.title,
          body: question.body,
          author: question.author,
          url: pageUrl,
          answerCount: question.answers,
        })
      : null,
  });

  const {
    editingPost,
    setEditingPost,
    editTitle,
    setEditTitle,
    editBody,
    setEditBody,
    startEditPost,
    handleSavePost,
    handleDeletePost,
  } = usePostEditor(question, setQuestion);

  const {
    editingAnswerId,
    setEditingAnswerId,
    editAnswerText,
    setEditAnswerText,
    acceptingId,
    startEditAnswer,
    handleSaveAnswer,
    handleDeleteAnswer,
    handleAccept,
    toggleVote,
  } = useAnswerActions(question, setQuestion, voted, setVoted);

  const {
    commentingAnswerId,
    setCommentingAnswerId,
    commentText,
    setCommentText,
    replyTarget,
    setReplyTarget,
    commentSubmitting,
    editingCommentId,
    setEditingCommentId,
    editCommentText,
    setEditCommentText,
    openComment,
    openReply,
    handleSubmitComment,
    handleDeleteComment,
    startEditComment,
    handleSaveComment,
  } = useCommentActions(question, setQuestion);

  const [answerText, setAnswerText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);

  const [reportTarget, setReportTarget] = useState<{
    targetType: "post" | "answer" | "comment";
    targetId: string;
    targetTitle: string;
  } | null>(null);

  const openReport = (
    targetType: "post" | "answer" | "comment",
    targetId: string,
    targetTitle: string,
  ) => {
    if (!user) {
      window.dispatchEvent(new CustomEvent("tianji:open-auth"));
      return;
    }
    setReportTarget({ targetType, targetId, targetTitle });
  };

  const handleToggleFav = async () => {
    if (!user) {
      window.dispatchEvent(new CustomEvent("tianji:open-auth"));
      return;
    }
    if (!question) return;
    try {
      const fav = await toggleFavorite({
        targetId: question.id,
        type: "post",
        title: question.title,
        excerpt: question.excerpt,
        link: `/discussion/${question.id}`,
      });
      setFavState(fav);
      toast.success(fav ? "已收藏" : "已取消收藏");
    } catch (e) {
      console.error("收藏操作失败:", e);
      toast.error("操作失败，请重试");
    }
  };

  const handleSubmitAnswer = async () => {
    if (!user) {
      window.dispatchEvent(new CustomEvent("tianji:open-auth"));
      return;
    }
    if (!answerText.trim() || !question) return;

    // 频率限制：先检查，成功后再记录（失败不白等冷却）
    const rl = rateLimiters.answer.check();
    if (!rl.allowed) {
      setAnswerError(`操作太快了，请等待 ${rl.remaining} 秒后再试`);
      return;
    }

    setSubmitting(true);
    setAnswerError(null);
    try {
      const answer = await submitAnswer(question.id, answerText.trim());
      if (answer) {
        rateLimiters.answer.record();
        // 更新本地状态
        setQuestion({
          ...question,
          answerList: [...question.answerList, answer],
          answers: question.answers + 1,
        });
        setAnswerText("");
        toast.success("回答已提交");
      } else {
        toast.error("该帖子暂不支持回答");
      }
    } catch (err) {
      setAnswerError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // 加载骨架
  if (loading) {
    return <PostDetailSkeleton />;
  }

  // 加载失败或帖子不存在
  if (!question) {
    return (
      <div className="container-tj py-40 text-center">
        <p className="text-mist-400">{loadError ?? "未找到该讨论。"}</p>
        <button onClick={() => window.location.reload()} className="btn-ghost mt-6 inline-flex">
          重试
        </button>
        <Link to="/" className="btn-ghost ml-2 inline-flex">
          <ArrowLeft size={15} /> 返回讨论区
        </Link>
      </div>
    );
  }

  return (
    <div className="forum-light min-h-screen bg-void-950">
      <div className="container-tj py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-mist-400 transition-colors hover:text-star-300"
        >
          <ArrowLeft size={15} /> 返回讨论区
        </Link>

        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_260px]">
          {/* 主体 */}
          <div className="min-w-0">
            {/* 问题 */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex flex-wrap items-center gap-2">
                {question.category === "casual" ? (
                  <span className="rounded-full border border-orange-400/30 bg-orange-400/10 px-2.5 py-0.5 text-[11px] text-orange-300">
                    闲聊区
                  </span>
                ) : (
                  <span className="rounded-full border border-star-400/30 bg-star-400/10 px-2.5 py-0.5 text-[11px] text-star-300">
                    学术区
                  </span>
                )}
                {question.bounty && (
                  <span className="pill-gold">
                    <Star size={11} className="fill-star-400" /> 悬赏 {question.bounty} 星辰
                  </span>
                )}
                {question.tags.map((t) => (
                  <Link
                    key={t}
                    to={`/tags/${encodeURIComponent(t)}`}
                    className="pill transition-colors hover:border-tian-400/50 hover:text-tian-100"
                  >
                    {t}
                  </Link>
                ))}
              </div>

              <h1 className="mt-4 heading-display text-2xl leading-snug text-parchment-50 sm:text-3xl">
                {question.title}
              </h1>

              {/* 帖子元信息条 - Discourse 风格作者栏 (#294) */}
              <div className="mt-5 flex items-center gap-3 rounded-lg border border-void-600/30 bg-void-800/40 px-4 py-2.5 text-sm text-mist-500">
                <Avatar name={question.author} color={question.avatarColor} size={28} />
                {question.authorUid ? (
                  <Link
                    to={`/user/${question.authorUid}`}
                    className="font-medium text-parchment-100 transition-colors hover:text-star-300"
                  >
                    {question.author}
                  </Link>
                ) : (
                  <span className="font-medium text-parchment-100">{question.author}</span>
                )}
                <span className="text-mist-600">·</span>
                <span className="font-mono text-xs">{formatRelativeTime(question.createdAt)}</span>
                <span className="text-mist-600">·</span>
                <span className="flex items-center gap-1 text-xs">
                  <Eye size={12} /> {question.views} 浏览
                </span>
                <button
                  onClick={handleToggleFav}
                  className={`ml-auto flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                    favState
                      ? "text-star-300"
                      : "text-mist-400 hover:bg-void-700/60 hover:text-star-300"
                  }`}
                >
                  <Bookmark size={13} className={favState ? "fill-star-400" : ""} />
                  {favState ? "已收藏" : "收藏"}
                </button>
                {!isAuthor(user?.uid, question.authorUid) && (
                  <>
                    <ShareButton title={question.title} path={`/discussion/${id}`} />
                    <button
                      onClick={() => openReport("post", question.id, question.title)}
                      className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs text-mist-400 transition-colors hover:bg-void-700/60 hover:text-red-300"
                      title="举报帖子"
                    >
                      <Flag size={13} /> 举报
                    </button>
                  </>
                )}
                {isAuthor(user?.uid, question.authorUid) && (
                  <div className="flex items-center gap-1">
                    <ShareButton title={question.title} path={`/discussion/${id}`} />
                    <button
                      onClick={startEditPost}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-mist-400 transition-colors hover:bg-void-700/60 hover:text-tian-300"
                      title="编辑帖子"
                      aria-label="编辑帖子"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={handleDeletePost}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-mist-400 transition-colors hover:bg-void-700/60 hover:text-red-300"
                      title="删除帖子"
                      aria-label="删除帖子"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>

              {editingPost ? (
                <div className="mt-6 border-t border-void-600/40 pt-6">
                  <input
                    name="title"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="mb-3 w-full rounded-lg border border-void-600/50 bg-void-950/50 px-3 py-2 text-lg text-parchment-100 focus:border-star-400/50 focus:outline-none"
                    placeholder="标题"
                    maxLength={200}
                  />
                  <MarkdownEditor
                    name="body"
                    value={editBody}
                    onChange={setEditBody}
                    rows={8}
                    maxLength={10000}
                  />
                  <div className="mt-3 flex justify-end gap-2">
                    <button onClick={() => setEditingPost(false)} className="btn-ghost text-xs">
                      取消
                    </button>
                    <button onClick={handleSavePost} className="btn-gold text-xs">
                      保存
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-6 border-t border-void-600/40 pt-6">
                  <LazyMarkdownRenderer
                    content={question.body}
                    className="text-[15px] leading-relaxed text-parchment-100"
                  />
                </div>
              )}
            </motion.div>

            {/* 回答 - Discourse 风格：头像左侧 + 作者栏 + 内容 + 操作行 (#294) */}
            <div className="mt-10 border-t border-void-600/40 pt-6">
              <h2 className="heading-display text-lg text-parchment-50">
                {question.answerList.length} 个回答
              </h2>

              <div className="mt-4 space-y-4">
                {[...question.answerList]
                  .sort((a, b) => {
                    // 采纳的回答始终排第一
                    if (a.accepted && !b.accepted) return -1;
                    if (!a.accepted && b.accepted) return 1;
                    // 其余按时间倒序（最新在最上面）
                    return b.date > a.date ? 1 : -1;
                  })
                  .map((a, idx) => (
                    <div
                      key={a.id}
                      className="rounded-lg border border-void-600/30 bg-void-800/40 px-5 py-4"
                    >
                      <div className="flex gap-4">
                        <Avatar name={a.author} color={a.avatarColor} size={42} />

                        {/* 内容 */}
                        <div className="min-w-0 flex-1">
                          {/* 作者栏 - Discourse 风格：楼层号 + 用户名 + 时间 + 采纳标记 */}
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                            <span className="font-mono text-xs text-mist-500">#{idx + 2}</span>
                            <span className="font-medium text-parchment-100">{a.author}</span>
                            <span className="text-xs text-mist-500 font-mono">
                              {formatRelativeTime(a.date)}
                            </span>
                            {a.accepted && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-300">
                                <Check size={11} /> 已采纳
                              </span>
                            )}
                          </div>
                          {editingAnswerId === a.id ? (
                            <div className="mt-3">
                              <MarkdownEditor
                                name="answer"
                                value={editAnswerText}
                                onChange={setEditAnswerText}
                                rows={5}
                                maxLength={8000}
                              />
                              <div className="mt-2 flex justify-end gap-2">
                                <button
                                  onClick={() => setEditingAnswerId(null)}
                                  className="btn-ghost text-xs"
                                >
                                  取消
                                </button>
                                <button
                                  onClick={() => handleSaveAnswer(a.id)}
                                  className="btn-gold text-xs"
                                >
                                  保存
                                </button>
                              </div>
                            </div>
                          ) : (
                            <LazyMarkdownRenderer
                              content={a.content}
                              className="mt-3 font-content text-[15px] leading-relaxed text-mist-200"
                            />
                          )}

                          {/* 动作行 - Discourse 风格按钮组 */}
                          <div className="mt-4 flex items-center gap-1 text-xs text-mist-500">
                            <button
                              onClick={() => toggleVote(a.id)}
                              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors ${
                                voted[a.id]
                                  ? "text-star-300"
                                  : "hover:bg-void-700/60 hover:text-star-300"
                              }`}
                              aria-label="投票"
                            >
                              <ThumbsUp size={14} className={voted[a.id] ? "fill-star-400" : ""} />
                              {a.votes > 0 && <span>{a.votes}</span>}
                            </button>
                            <button
                              onClick={() => openComment(a.id)}
                              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors hover:bg-void-700/60 hover:text-tian-200"
                            >
                              <MessageCircle size={14} />
                              {a.comments && a.comments.length > 0
                                ? `${a.comments.length} 条评论`
                                : "评论"}
                            </button>
                            {isAuthor(user?.uid, question.authorUid) &&
                              a.authorUid !== "ai-bot-001" &&
                              !a.accepted && (
                                <button
                                  onClick={() => handleAccept(a.id, true)}
                                  disabled={acceptingId !== null}
                                  className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 transition-colors hover:bg-emerald-400/10 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {acceptingId === a.id ? (
                                    <Loader2 size={13} className="animate-spin" />
                                  ) : (
                                    <Check size={13} />
                                  )}
                                  采纳
                                </button>
                              )}
                            {isAuthor(user?.uid, question.authorUid) && a.accepted && (
                              <button
                                onClick={() => handleAccept(a.id, false)}
                                disabled={acceptingId !== null}
                                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 transition-colors hover:bg-void-700/60 hover:text-mist-300 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {acceptingId === a.id ? (
                                  <Loader2 size={13} className="animate-spin" />
                                ) : (
                                  <X size={13} />
                                )}
                                取消采纳
                              </button>
                            )}
                            <span className="ml-auto flex items-center gap-1">
                              {!isAuthor(user?.uid, a.authorUid) && (
                                <button
                                  onClick={() =>
                                    openReport("answer", a.id, `回答：${a.content.slice(0, 30)}`)
                                  }
                                  className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-void-700/60 hover:text-red-300"
                                  title="举报回答"
                                >
                                  <Flag size={13} />
                                </button>
                              )}
                              {isAuthor(user?.uid, a.authorUid) && (
                                <>
                                  <button
                                    onClick={() => startEditAnswer(a.id, a.content)}
                                    className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-void-700/60 hover:text-tian-300"
                                    title="编辑回答"
                                  >
                                    <Pencil size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteAnswer(a.id)}
                                    className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-void-700/60 hover:text-red-300"
                                    title="删除回答"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </>
                              )}
                            </span>
                          </div>

                          {/* 评论列表 - Discourse 嵌套缩进，左侧竖线连接 (#294) */}
                          {a.comments && a.comments.length > 0 && (
                            <div className="mt-4 space-y-3 border-t border-void-600/30 pt-4 pl-2">
                              {[...(a.comments ?? [])]
                                .sort((x, y) => (y.date > x.date ? 1 : -1))
                                .map((c) => {
                                  const repliedComment = c.replyTo
                                    ? a.comments?.find((rc) => rc.id === c.replyTo)
                                    : null;
                                  return (
                                    <div
                                      key={c.id}
                                      className="group flex gap-3 border-l-2 border-void-600/40 pl-3"
                                    >
                                      <Avatar name={c.author} color={c.avatarColor} size={24} />
                                      <div className="min-w-0 flex-1">
                                        {/* 评论作者栏 */}
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                                          <span className="font-medium text-parchment-100">
                                            {c.author}
                                          </span>
                                          {repliedComment && (
                                            <span className="text-tian-300">
                                              回复 @{repliedComment.author}
                                            </span>
                                          )}
                                          <span className="font-mono text-mist-500">
                                            {formatRelativeTime(c.date)}
                                          </span>
                                          <div className="ml-auto flex items-center gap-0.5">
                                            <button
                                              onClick={() => openReply(a.id, c)}
                                              className="flex h-7 w-7 items-center justify-center rounded text-mist-500 opacity-0 transition-opacity hover:text-tian-300 group-hover:opacity-100"
                                              aria-label="回复评论"
                                              title="回复评论"
                                            >
                                              <CornerDownRight size={11} />
                                            </button>
                                            {isAuthor(user?.uid, c.authorUid) && (
                                              <>
                                                <button
                                                  onClick={() => startEditComment(c.id, c.content)}
                                                  className="flex h-7 w-7 items-center justify-center rounded-md text-mist-500 opacity-0 transition-opacity hover:text-tian-300 group-hover:opacity-100"
                                                  title="编辑评论"
                                                  aria-label="编辑评论"
                                                >
                                                  <Pencil size={11} />
                                                </button>
                                                <button
                                                  onClick={() => {
                                                    handleDeleteComment(a.id, c.id);
                                                  }}
                                                  className="flex h-7 w-7 items-center justify-center rounded-md text-mist-500 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100"
                                                  title="删除评论"
                                                  aria-label="删除评论"
                                                >
                                                  <Trash2 size={11} />
                                                </button>
                                              </>
                                            )}
                                            {user && !isAuthor(user.uid, c.authorUid) && (
                                              <button
                                                onClick={() => {
                                                  openReport(
                                                    "comment",
                                                    c.id,
                                                    `评论：${c.content.slice(0, 30)}`,
                                                  );
                                                }}
                                                className="flex h-7 w-7 items-center justify-center rounded text-mist-500 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100"
                                                aria-label="举报评论"
                                                title="举报评论"
                                              >
                                                <Flag size={11} />
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                        {editingCommentId === c.id ? (
                                          <div className="mt-2">
                                            <MarkdownEditor
                                              value={editCommentText}
                                              onChange={setEditCommentText}
                                              rows={3}
                                              maxLength={2000}
                                              compact
                                            />
                                            <div className="mt-1 flex justify-end gap-2">
                                              <button
                                                onClick={() => setEditingCommentId(null)}
                                                className="btn-ghost text-xs"
                                              >
                                                取消
                                              </button>
                                              <button
                                                onClick={() => handleSaveComment(a.id, c.id)}
                                                className="btn-gold text-xs"
                                              >
                                                保存
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <LazyMarkdownRenderer
                                            content={c.content}
                                            className="mt-1 text-[13px] leading-relaxed text-mist-200"
                                          />
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          )}

                          {/* 评论输入框 */}
                          {commentingAnswerId === a.id && (
                            <div className="mt-3 border-t border-void-600/30 pt-3">
                              {replyTarget && (
                                <div className="mb-2 flex items-center gap-1 text-xs text-tian-300">
                                  <CornerDownRight size={11} />
                                  回复 @{replyTarget.author}
                                  <button
                                    onClick={() => {
                                      setReplyTarget(null);
                                      setCommentText("");
                                    }}
                                    className="ml-1 text-mist-500 hover:text-red-300"
                                  >
                                    ✕
                                  </button>
                                </div>
                              )}
                              <MarkdownEditor
                                name="comment"
                                value={commentText}
                                onChange={setCommentText}
                                rows={2}
                                maxLength={500}
                                placeholder="写下你的评论…"
                                compact
                              />
                              <div className="mt-2 flex justify-end gap-2">
                                <button
                                  onClick={() => {
                                    setCommentingAnswerId(null);
                                    setCommentText("");
                                    setReplyTarget(null);
                                  }}
                                  className="btn-ghost text-xs"
                                >
                                  取消
                                </button>
                                <button
                                  onClick={() => handleSubmitComment(a.id)}
                                  disabled={commentSubmitting || !commentText.trim()}
                                  className="btn-gold text-xs disabled:opacity-60"
                                >
                                  {commentSubmitting ? "提交中…" : "发送"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>

              {/* 回答框 */}
              <div className="mt-8 rounded-xl border border-void-600/40 bg-void-800/30 p-5">
                <h3 className="heading-display text-base text-parchment-50">你的回答</h3>
                <p className="mt-1 text-xs text-mist-500">支持 Markdown 排版与 LaTeX 公式</p>
                <MarkdownEditor
                  name="answer"
                  value={answerText}
                  onChange={setAnswerText}
                  rows={5}
                  maxLength={8000}
                  placeholder={user ? "撰写你的推导与解答…" : "请先登录后再回答…"}
                  disabled={!user}
                  className="mt-3"
                />
                {answerError && <p className="mt-2 text-xs text-red-300">{answerError}</p>}
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={handleSubmitAnswer}
                    disabled={submitting || !answerText.trim()}
                    className="btn-gold disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> 提交中…
                      </>
                    ) : (
                      "提交回答"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 侧栏 - Discourse 风格 topic map */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-5">
              {/* Topic Map - 统计 */}
              <div className="discourse-topic-map">
                <div className="discourse-topic-map__section px-4 py-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-mist-500">
                    话题摘要
                  </h4>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-mist-400">创建</dt>
                      <dd className="text-mist-500">{formatRelativeTime(question.createdAt)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-mist-400">回复</dt>
                      <dd className="text-parchment-100">{question.answerList.length}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-mist-400">浏览</dt>
                      <dd className="text-parchment-100">{question.views}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-mist-400">投票</dt>
                      <dd className="text-parchment-100">{question.votes}</dd>
                    </div>
                    {question.bounty && (
                      <div className="flex justify-between">
                        <dt className="text-mist-400">悬赏</dt>
                        <dd className="text-star-400">{question.bounty}</dd>
                      </div>
                    )}
                  </dl>
                </div>
                {/* 参与者头像组 - Discourse 标志 */}
                <div className="discourse-topic-map__section px-4 py-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-mist-500">
                    参与者
                  </h4>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Avatar name={question.author} color={question.avatarColor} size={28} />
                    {question.answerList.map((a) => (
                      <Avatar key={a.id} name={a.author} color={a.avatarColor} size={28} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-void-600/40 bg-void-800/30 p-5">
                <h4 className="font-mono text-xs uppercase tracking-[0.2em] text-star-300">
                  相关标签
                </h4>
                <div className="mt-4 flex flex-wrap gap-2">
                  {question.tags.map((t) => (
                    <Link
                      key={t}
                      to={`/tags/${encodeURIComponent(t)}`}
                      className="pill hover:border-tian-400/50 hover:text-tian-100"
                    >
                      {t}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>

        {question && question.tags.length > 0 && (
          <RelatedContent tags={question.tags} excludeId={question.id} />
        )}

        <ReportModal
          open={!!reportTarget}
          onClose={() => setReportTarget(null)}
          targetType={reportTarget?.targetType ?? "post"}
          targetId={reportTarget?.targetId ?? ""}
          targetTitle={reportTarget?.targetTitle ?? ""}
        />
      </div>
    </div>
  );
}
