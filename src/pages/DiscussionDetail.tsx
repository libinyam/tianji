import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowLeft,
  ThumbsUp,
  Check,
  Star,
  Eye,
  MessageCircle,
  CornerDownRight,
  Loader2,
  Bookmark,
  Pencil,
  Trash2,
} from "lucide-react";
import { questions as mockQuestions } from "@/data/questions";
import {
  fetchPostById,
  submitAnswer,
  submitComment,
  incrementViews,
  updatePost,
  deletePost,
  updateAnswer,
  deleteAnswer,
  deleteComment,
} from "@/lib/posts";
import { toggleFavorite, isFavorited } from "@/lib/favorites";
import { rateLimiters } from "@/lib/security";
import { app } from "@/lib/cloudbase";
import { useAuthStore } from "@/stores/auth";
import MathText from "@/components/MathText";
import Avatar from "@/components/Avatar";
import type { Question, Comment, Answer } from "@/types";

export default function DiscussionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // 先从 Mock 中查找（同步，快速渲染）
  const mockQuestion = mockQuestions.find((q) => q.id === id);

  const [question, setQuestion] = useState<Question | null>(mockQuestion ?? null);
  const [loading, setLoading] = useState(!mockQuestion);
  const [voted, setVoted] = useState<Record<string, boolean>>({});

  // 回答框
  const [answerText, setAnswerText] = useState("");
  const [aiThinking, setAiThinking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);

  // 评论框：记录哪个回答正在输入评论，以及回复目标
  const [commentingAnswerId, setCommentingAnswerId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [replyTarget, setReplyTarget] = useState<{ answerId: string; commentId: string; author: string } | null>(null);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  // 收藏状态
  const [favState, setFavState] = useState(false);

  // 如果 Mock 中没有，从数据库加载
  useEffect(() => {
    if (mockQuestion) {
      setQuestion(mockQuestion);
      setLoading(false);
      return;
    }
    if (!id) return;

    let mounted = true;
    (async () => {
      setLoading(true);
      const post = await fetchPostById(id);
      if (mounted) {
        setQuestion(post);
        setLoading(false);
        if (post) {
          // 增加浏览量（异步，不阻塞渲染）
          incrementViews(id);
          // 检查收藏状态
          isFavorited(id).then(setFavState);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id, mockQuestion]);

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
    } catch {
      // 静默
    }
  };

  // === 内容管理 ===
  const [editingPost, setEditingPost] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editingAnswerId, setEditingAnswerId] = useState<string | null>(null);
  const [editAnswerText, setEditAnswerText] = useState("");

  const startEditPost = () => {
    if (!question) return;
    setEditTitle(question.title);
    setEditBody(question.body);
    setEditingPost(true);
  };

  const handleSavePost = async () => {
    if (!question || !editTitle.trim() || !editBody.trim()) return;
    try {
      await updatePost(question.id, { title: editTitle.trim(), body: editBody.trim(), tags: question.tags });
      setQuestion({ ...question, title: editTitle.trim(), body: editBody.trim(), excerpt: editBody.trim().slice(0, 120) + "…" });
      setEditingPost(false);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleDeletePost = async () => {
    if (!question) return;
    if (!confirm("确定删除这篇帖子？删除后不可恢复。")) return;
    try {
      await deletePost(question.id);
      navigate("/discussion");
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const startEditAnswer = (aId: string, content: string) => {
    setEditingAnswerId(aId);
    setEditAnswerText(content);
  };

  const handleSaveAnswer = async (aId: string) => {
    if (!question || !editAnswerText.trim()) return;
    try {
      await updateAnswer(question.id, aId, editAnswerText.trim());
      const newAnswerList = question.answerList.map((a) =>
        a.id === aId ? { ...a, content: editAnswerText.trim() } : a
      );
      setQuestion({ ...question, answerList: newAnswerList });
      setEditingAnswerId(null);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleDeleteAnswer = async (aId: string) => {
    if (!question) return;
    if (!confirm("确定删除这条回答？")) return;
    try {
      await deleteAnswer(question.id, aId);
      const newAnswerList = question.answerList.filter((a) => a.id !== aId);
      setQuestion({ ...question, answerList: newAnswerList, answers: newAnswerList.length });
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleDeleteComment = async (answerId: string, commentId: string) => {
    if (!question) return;
    if (!confirm("确定删除这条评论？")) return;
    try {
      await deleteComment(question.id, answerId, commentId);
      const newAnswerList = question.answerList.map((a) => {
        if (a.id === answerId) {
          return { ...a, comments: (a.comments ?? []).filter((c) => c.id !== commentId) };
        }
        return a;
      });
      setQuestion({ ...question, answerList: newAnswerList });
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const toggleVote = (aid: string) =>
    setVoted((v) => ({ ...v, [aid]: !v[aid] }));

  const handleSubmitAnswer = async () => {
    if (!user) {
      window.dispatchEvent(new CustomEvent("tianji:open-auth"));
      return;
    }
    if (!answerText.trim() || !question) return;

    // 频率限制
    const rl = rateLimiters.answer.tryAction();
    if (!rl.ok) {
      setAnswerError(`操作太快了，请等待 ${rl.remaining} 秒后再试`);
      return;
    }

    setSubmitting(true);
    setAnswerError(null);
    try {
      const answer = await submitAnswer(question.id, answerText.trim());
      if (answer) {
        // 更新本地状态
        setQuestion({
          ...question,
          answerList: [...question.answerList, answer],
          answers: question.answers + 1,
        });
        setAnswerText("");

        // 异步触发 AI 机器人回复（不阻塞用户）
        setAiThinking(true);
        app.callFunction({
          name: "ai-bot",
          data: {
            postId: question.id,
            postTitle: question.title,
            postBody: question.body,
            contentType: "answer",
            content: answer.content,
            tags: question.tags,
          },
        }).then((res: unknown) => {
          console.log("AI bot response:", res);
          const result = (res as { result?: { ok?: boolean; answer?: Answer } }).result;
          if (result?.ok && result.answer) {
            setQuestion((prev) => prev ? {
              ...prev,
              answerList: [...prev.answerList, result.answer],
              answers: prev.answers + 1,
            } : prev);
          }
        }).catch((err) => {
          console.error("AI bot error:", err);
        }).finally(() => {
          setAiThinking(false);
        });
      }
    } catch (err) {
      setAnswerError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // 打开/关闭评论框
  const openComment = (answerId: string) => {
    if (!user) {
      window.dispatchEvent(new CustomEvent("tianji:open-auth"));
      return;
    }
    setCommentingAnswerId(commentingAnswerId === answerId ? null : answerId);
    setCommentText("");
    setReplyTarget(null);
  };

  // 回复某条评论
  const openReply = (answerId: string, comment: Comment) => {
    if (!user) {
      window.dispatchEvent(new CustomEvent("tianji:open-auth"));
      return;
    }
    setCommentingAnswerId(answerId);
    setReplyTarget({ answerId, commentId: comment.id, author: comment.author });
    setCommentText(`@${comment.author} `);
  };

  // 提交评论
  const handleSubmitComment = async (answerId: string) => {
    if (!question) return;
    if (!commentText.trim()) return;

    // 频率限制
    const rl = rateLimiters.comment.tryAction();
    if (!rl.ok) {
      setCommentError(`操作太快了，请等待 ${rl.remaining} 秒后再试`);
      return;
    }

    setCommentSubmitting(true);
    try {
      const comment = await submitComment(
        question.id,
        answerId,
        commentText.trim(),
        replyTarget?.commentId
      );
      if (comment) {
        // 更新本地状态
        const newAnswerList = question.answerList.map((a) => {
          if (a.id === answerId) {
            return { ...a, comments: [...(a.comments ?? []), comment] };
          }
          return a;
        });
        setQuestion({ ...question, answerList: newAnswerList });
        setCommentText("");
        setReplyTarget(null);
        setCommentingAnswerId(null);
      }
    } catch {
      // 静默处理
    } finally {
      setCommentSubmitting(false);
    }
  };

  // 加载中
  if (loading) {
    return (
      <div className="container-tj flex items-center justify-center py-40 text-mist-400">
        <Loader2 size={20} className="mr-2 animate-spin" /> 加载讨论中…
      </div>
    );
  }

  // 未找到
  if (!question) {
    return (
      <div className="container-tj py-40 text-center">
        <p className="text-mist-400">未找到该讨论。</p>
        <Link to="/discussion" className="btn-ghost mt-6 inline-flex">
          <ArrowLeft size={15} /> 返回讨论区
        </Link>
      </div>
    );
  }

  return (
    <div className="container-tj py-10">
      <Link
        to="/discussion"
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
              {question.bounty && (
                <span className="pill-gold">
                  <Star size={11} className="fill-star-400" /> 悬赏 {question.bounty} 星辰
                </span>
              )}
              {question.tags.map((t) => (
                <span key={t} className="pill">
                  {t}
                </span>
              ))}
            </div>

            <h1 className="mt-4 heading-display text-2xl leading-snug text-parchment-50 sm:text-3xl">
              {question.title}
            </h1>

            <div className="mt-4 flex items-center gap-3 text-xs text-mist-500">
              <Avatar name={question.author} color={question.avatarColor} size={24} />
              {question.authorUid ? (
                <Link to={`/user/${question.authorUid}`} className="text-mist-300 transition-colors hover:text-star-300">
                  {question.author}
                </Link>
              ) : (
                <span className="text-mist-300">{question.author}</span>
              )}
              <span>·</span>
              <span className="font-mono">{question.createdAt}</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Eye size={12} /> {question.views} 浏览
              </span>
              <button
                onClick={handleToggleFav}
                className={`ml-auto flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs transition-all ${
                  favState
                    ? "border-star-400/70 bg-star-400/15 text-star-200"
                    : "border-void-600/50 bg-void-800/40 text-mist-300 hover:border-mist-400/40"
                }`}
              >
                <Bookmark size={13} className={favState ? "fill-star-400" : ""} />
                {favState ? "已收藏" : "收藏"}
              </button>
              {user?.uid === question.authorUid && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={startEditPost}
                    className="flex items-center gap-1 rounded-lg border border-void-600/50 bg-void-800/40 px-2.5 py-1.5 text-xs text-mist-300 transition-all hover:border-tian-400/40 hover:text-tian-300"
                    title="编辑帖子"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={handleDeletePost}
                    className="flex items-center gap-1 rounded-lg border border-void-600/50 bg-void-800/40 px-2.5 py-1.5 text-xs text-mist-300 transition-all hover:border-red-400/40 hover:text-red-300"
                    title="删除帖子"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>

            {editingPost ? (
              <div className="mt-6 rounded-xl border border-tian-400/30 bg-void-800/30 p-6">
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="mb-3 w-full rounded-lg border border-void-600/50 bg-void-950/50 px-3 py-2 text-lg text-parchment-100 focus:border-star-400/50 focus:outline-none"
                  placeholder="标题"
                />
                <textarea
                  rows={8}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  className="w-full resize-none rounded-lg border border-void-600/50 bg-void-950/50 p-3 text-sm text-parchment-100 focus:border-star-400/50 focus:outline-none"
                />
                <div className="mt-3 flex justify-end gap-2">
                  <button onClick={() => setEditingPost(false)} className="btn-ghost text-xs">取消</button>
                  <button onClick={handleSavePost} className="btn-gold text-xs">保存</button>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-xl border border-void-600/40 bg-void-800/30 p-6">
                <MathText
                  content={question.body}
                  className="text-[15px] leading-relaxed text-parchment-100"
                />
              </div>
            )}
          </motion.div>

          {/* 回答 */}
          <div className="mt-10">
            <div className="mb-5 flex items-center gap-2">
              <MessageCircle size={18} className="text-star-400" />
              <h2 className="heading-display text-xl text-parchment-50">
                {question.answerList.length} 个回答
              </h2>
            </div>

            <div className="space-y-4">
              {question.answerList.map((a, i) => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  className={`rounded-xl border p-5 ${
                    a.accepted
                      ? "border-star-400/40 bg-star-400/[0.06]"
                      : "border-void-600/40 bg-void-800/30"
                  }`}
                >
                  <div className="flex gap-5">
                    {/* 投票 */}
                    <div className="flex flex-col items-center gap-1.5">
                      <button
                        onClick={() => toggleVote(a.id)}
                        className={`flex h-8 w-8 items-center justify-center rounded-md border transition-all ${
                          voted[a.id]
                            ? "border-star-400/60 bg-star-400/15 text-star-300"
                            : "border-void-600/50 text-mist-400 hover:border-star-400/40 hover:text-star-300"
                        }`}
                        aria-label="投票"
                      >
                        <ThumbsUp size={14} className={voted[a.id] ? "fill-star-400" : ""} />
                      </button>
                      <span className="text-sm font-medium text-parchment-100">
                        {a.votes + (voted[a.id] ? 1 : 0)}
                      </span>
                      {a.accepted && (
                        <span className="flex h-8 w-8 items-center justify-center rounded-md border border-star-400/60 bg-star-400/15 text-star-300" title="已采纳">
                          <Check size={15} />
                        </span>
                      )}
                    </div>

                    {/* 内容 */}
                    <div className="min-w-0 flex-1">
                      {a.accepted && (
                        <span className="mb-2 inline-flex items-center gap-1 rounded-md bg-star-400/15 px-2 py-0.5 text-[11px] text-star-300">
                          <Check size={11} /> 已采纳
                        </span>
                      )}
                      {editingAnswerId === a.id ? (
                        <div>
                          <textarea
                            rows={5}
                            value={editAnswerText}
                            onChange={(e) => setEditAnswerText(e.target.value)}
                            className="w-full resize-none rounded-lg border border-tian-400/30 bg-void-950/50 p-3 text-sm text-parchment-100 focus:border-star-400/50 focus:outline-none"
                          />
                          <div className="mt-2 flex justify-end gap-2">
                            <button onClick={() => setEditingAnswerId(null)} className="btn-ghost text-xs">取消</button>
                            <button onClick={() => handleSaveAnswer(a.id)} className="btn-gold text-xs">保存</button>
                          </div>
                        </div>
                      ) : (
                        <MathText
                          content={a.content}
                          className="text-sm leading-relaxed text-mist-200"
                        />
                      )}

                      {/* 评论列表 */}
                      {a.comments && a.comments.length > 0 && (
                        <div className="mt-4 space-y-2 border-l-2 border-void-600/40 pl-4">
                          {a.comments.map((c) => {
                            const repliedComment = c.replyTo
                              ? a.comments?.find((rc) => rc.id === c.replyTo)
                              : null;
                            return (
                              <div
                                key={c.id}
                                onClick={() => openReply(a.id, c)}
                                className="group cursor-pointer rounded-lg bg-void-900/40 p-3 transition-colors hover:bg-void-900/60"
                              >
                                <div className="mb-1 flex items-center gap-2 text-xs text-mist-500">
                                  <Avatar name={c.author} color={c.avatarColor} size={18} />
                                  <span className="text-mist-300">{c.author}</span>
                                  {repliedComment && (
                                    <span className="text-tian-300">
                                      回复 @{repliedComment.author}
                                    </span>
                                  )}
                                  <span>·</span>
                                  <span className="font-mono">{c.date}</span>
                                  {user?.uid === c.authorUid && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteComment(a.id, c.id);
                                      }}
                                      className="ml-auto text-mist-500 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100"
                                      title="删除评论"
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  )}
                                </div>
                                <p className="text-sm text-mist-200">{c.content}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* 评论输入框 */}
                      {commentingAnswerId === a.id && (
                        <div className="mt-3 rounded-lg border border-void-600/40 bg-void-900/40 p-3">
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
                          <textarea
                            rows={2}
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder="写下你的评论…"
                            className="w-full resize-none rounded-md border border-void-600/50 bg-void-950/50 p-2.5 text-sm text-parchment-100 placeholder:text-mist-500 focus:border-star-400/50 focus:outline-none"
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

                      <div className="mt-4 flex items-center justify-between">
                        <button
                          onClick={() => openComment(a.id)}
                          className="inline-flex items-center gap-1 text-xs text-mist-500 transition-colors hover:text-tian-200"
                        >
                          <CornerDownRight size={12} />
                          {a.comments && a.comments.length > 0
                            ? `${a.comments.length} 条评论 · 添加评论`
                            : "添加评论"}
                        </button>
                        <div className="flex items-center gap-2 text-xs text-mist-500">
                          <Avatar name={a.author} color={a.avatarColor} size={22} />
                          <span className="text-mist-300">{a.author}</span>
                          <span>·</span>
                          <span className="font-mono">{a.date}</span>
                          {user?.uid === a.authorUid && (
                            <div className="ml-2 flex items-center gap-1">
                              <button
                                onClick={() => startEditAnswer(a.id, a.content)}
                                className="text-mist-500 transition-colors hover:text-tian-300"
                                title="编辑回答"
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                onClick={() => handleDeleteAnswer(a.id)}
                                className="text-mist-500 transition-colors hover:text-red-300"
                                title="删除回答"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* AI 正在思考 */}
            {aiThinking && (
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-tian-400/30 bg-tian-400/5 p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-tian-400/30 bg-tian-400/10 text-tian-300">
                  <Loader2 size={18} className="animate-spin" />
                </div>
                <div>
                  <p className="text-sm text-tian-200">天玑AI 正在思考…</p>
                  <p className="text-xs text-mist-500">AI 机器人正在生成回复</p>
                </div>
              </div>
            )}

            {/* 回答框 */}
            <div className="mt-8 rounded-xl border border-void-600/40 bg-void-800/30 p-5">
              <h3 className="heading-display text-base text-parchment-50">你的回答</h3>
              <p className="mt-1 text-xs text-mist-500">
                支持 LaTeX：行内用 <code className="text-star-300">$...$</code>，行间用{" "}
                <code className="text-star-300">$$...$$</code>
              </p>
              <textarea
                rows={5}
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                placeholder={user ? "撰写你的推导与解答…" : "请先登录后再回答…"}
                disabled={!user}
                className="mt-3 w-full resize-none rounded-lg border border-void-600/50 bg-void-950/50 p-3 text-sm text-parchment-100 placeholder:text-mist-500 focus:border-star-400/50 focus:outline-none disabled:opacity-50"
              />
              {answerError && (
                <p className="mt-2 text-xs text-red-300">{answerError}</p>
              )}
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

        {/* 侧栏 */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-5">
            <div className="rounded-xl border border-void-600/40 bg-void-800/30 p-5">
              <h4 className="font-mono text-xs uppercase tracking-[0.2em] text-star-300">
                问题状态
              </h4>
              <dl className="mt-4 space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-mist-500">浏览</dt>
                  <dd className="text-parchment-100">{question.views}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-mist-500">回答</dt>
                  <dd className="text-parchment-100">{question.answerList.length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-mist-500">投票</dt>
                  <dd className="text-parchment-100">{question.votes}</dd>
                </div>
                {question.bounty && (
                  <div className="flex justify-between">
                    <dt className="text-mist-500">悬赏</dt>
                    <dd className="text-star-300">{question.bounty}</dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="rounded-xl border border-void-600/40 bg-void-800/30 p-5">
              <h4 className="font-mono text-xs uppercase tracking-[0.2em] text-star-300">
                相关标签
              </h4>
              <div className="mt-4 flex flex-wrap gap-2">
                {question.tags.map((t) => (
                  <Link key={t} to="/discussion" className="pill hover:border-tian-400/50 hover:text-tian-100">
                    {t}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
