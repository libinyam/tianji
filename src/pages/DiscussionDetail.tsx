import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
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
import { PostDetailSkeleton } from "@/components/Skeleton";
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
  updateComment,
  voteAnswer,
  getVotedAnswerIds,
  acceptAnswer,
} from "@/lib/posts";
import { toggleFavorite, isFavorited } from "@/lib/favorites";
import { rateLimiters } from "@/lib/security";
import { app } from "@/lib/cloudbase";
import { useAuthStore } from "@/stores/auth";
import { formatRelativeTime } from "@/lib/format";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import LazyMathText from "@/components/LazyMathText";
import Avatar from "@/components/Avatar";
import RelatedContent from "@/components/RelatedContent";
import ReportModal from "@/components/ReportModal";
import type { Question, Comment } from "@/types";
import { isAuthor } from "@/lib/utils";

export default function DiscussionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // 先从 Mock 中查找（同步，快速渲染）
  const mockQuestion = mockQuestions.find((q) => q.id === id);

  const [question, setQuestion] = useState<Question | null>(mockQuestion ?? null);
  useDocumentTitle(question?.title);
  const [loading, setLoading] = useState(!mockQuestion);
  const [voted, setVoted] = useState<Record<string, boolean>>({});

  // 回答框
  const [answerText, setAnswerText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);

  // 评论框：记录哪个回答正在输入评论，以及回复目标
  const [commentingAnswerId, setCommentingAnswerId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [replyTarget, setReplyTarget] = useState<{ answerId: string; commentId: string; author: string } | null>(null);
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  // 收藏状态
  const [favState, setFavState] = useState(false);

  // 采纳操作进行中，防止快速点击竞态
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  // 举报状态
  const [reportTarget, setReportTarget] = useState<{
    targetType: "post" | "answer" | "comment";
    targetId: string;
    targetTitle: string;
  } | null>(null);

  const openReport = (
    targetType: "post" | "answer" | "comment",
    targetId: string,
    targetTitle: string
  ) => {
    if (!user) {
      window.dispatchEvent(new CustomEvent("tianji:open-auth"));
      return;
    }
    setReportTarget({ targetType, targetId, targetTitle });
  };

  // 如果 Mock 中没有，从数据库加载
  useEffect(() => {
    if (mockQuestion) {
      setQuestion(mockQuestion);
      setLoading(false);
      return;
    }
    if (!id) return;

    // 导航到新帖子时立即清空旧内容，避免短暂显示旧数据
    setQuestion(null);
    setLoading(true);

    let mounted = true;
    (async () => {
      const post = await fetchPostById(id);
      if (mounted) {
        setQuestion(post);
        setLoading(false);
        if (post) {
          // 增加浏览量（同一会话内不重复计数）
          const viewedKey = `tianji:viewed:${id}`;
          if (!sessionStorage.getItem(viewedKey)) {
            sessionStorage.setItem(viewedKey, "1");
            incrementViews(id);
            setQuestion((prev) => prev ? { ...prev, views: prev.views + 1 } : prev);
          }
          // 检查收藏状态
          isFavorited(id).then((fav) => {
            if (mounted) setFavState(fav);
          });
          // 加载用户投票记录
          const answerIds = (post.answerList ?? []).map((a) => a.id);
          if (answerIds.length > 0) {
            getVotedAnswerIds(answerIds).then((votedSet) => {
              if (mounted) {
                const votedMap: Record<string, boolean> = {};
                votedSet.forEach((aid) => { votedMap[aid] = true; });
                setVoted(votedMap);
              }
            });
          }
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id, mockQuestion]);

  // 登录状态变化时重新检查收藏和投票
  useEffect(() => {
    if (!id || !user) return;
    let mounted = true;
    isFavorited(id).then((v) => { if (mounted) setFavState(v); });
    if (question) {
      const answerIds = (question.answerList ?? []).map((a) => a.id);
      if (answerIds.length > 0) {
        getVotedAnswerIds(answerIds).then((votedSet) => {
          if (!mounted) return;
          const votedMap: Record<string, boolean> = {};
          votedSet.forEach((aid) => { votedMap[aid] = true; });
          setVoted(votedMap);
        });
      }
    }
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

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

  // === 内容管理 ===
  const [editingPost, setEditingPost] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editingAnswerId, setEditingAnswerId] = useState<string | null>(null);
  const [editAnswerText, setEditAnswerText] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");

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
      const trimmedBody = editBody.trim();
      setQuestion({ ...question, title: editTitle.trim(), body: trimmedBody, excerpt: trimmedBody.length > 120 ? trimmedBody.slice(0, 120) + "…" : trimmedBody });
      setEditingPost(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleDeletePost = async () => {
    if (!question) return;
    if (!confirm("确定删除这篇帖子？删除后不可恢复。")) return;
    try {
      await deletePost(question.id);
      toast.success("帖子已删除");
      navigate("/");
    } catch (e) {
      toast.error((e as Error).message);
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
      toast.success("回答已更新");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleDeleteAnswer = async (aId: string) => {
    if (!question) return;
    if (!confirm("确定删除这条回答？")) return;
    try {
      await deleteAnswer(question.id, aId);
      const newAnswerList = question.answerList.filter((a) => a.id !== aId);
      setQuestion({ ...question, answerList: newAnswerList, answers: newAnswerList.length });
      toast.success("回答已删除");
    } catch (e) {
      toast.error((e as Error).message);
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
      toast.success("评论已删除");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const startEditComment = (commentId: string, content: string) => {
    setEditingCommentId(commentId);
    setEditCommentText(content);
  };

  const handleSaveComment = async (answerId: string, commentId: string) => {
    if (!question || !editCommentText.trim()) return;
    try {
      await updateComment(question.id, answerId, commentId, editCommentText.trim());
      const newAnswerList = question.answerList.map((a) => {
        if (a.id === answerId) {
          return {
            ...a,
            comments: (a.comments ?? []).map((c) =>
              c.id === commentId ? { ...c, content: editCommentText.trim() } : c
            ),
          };
        }
        return a;
      });
      setQuestion({ ...question, answerList: newAnswerList });
      setEditingCommentId(null);
      toast.success("评论已更新");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleAccept = async (aId: string, accept: boolean) => {
    if (!question) return;
    if (acceptingId) return; // 防止快速点击
    setAcceptingId(aId);
    try {
      await acceptAnswer(question.id, aId, accept);
      const newAnswerList = question.answerList.map((a) => ({
        ...a,
        accepted: a.id === aId ? accept : false,
      }));
      setQuestion({ ...question, answerList: newAnswerList });
      toast.success(accept ? "已采纳该回答" : "已取消采纳");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAcceptingId(null);
    }
  };

  const toggleVote = async (aid: string) => {
    if (!user) {
      window.dispatchEvent(new CustomEvent("tianji:open-auth"));
      return;
    }
    if (!question) return;
    const newVoted = !voted[aid];
    setVoted((v) => ({ ...v, [aid]: newVoted }));
    // 本地乐观更新
    setQuestion((q) => {
      if (!q) return q;
      return {
        ...q,
        answerList: q.answerList.map((a) =>
          a.id === aid ? { ...a, votes: Math.max(0, (a.votes ?? 0) + (newVoted ? 1 : -1)) } : a
        ),
      };
    });
    // 持久化到数据库
    try {
      const ok = await voteAnswer(question.id, aid, newVoted);
      if (!ok) {
        // 服务端未处理（已投过票/没投过票），回滚 UI
        setVoted((v) => ({ ...v, [aid]: !newVoted }));
        setQuestion((q) => {
          if (!q) return q;
          return {
            ...q,
            answerList: q.answerList.map((a) =>
              a.id === aid ? { ...a, votes: Math.max(0, (a.votes ?? 0) + (newVoted ? -1 : 1)) } : a
            ),
          };
        });
        toast.info(newVoted ? "你已经投过票了" : "你还没有投票");
      }
    } catch {
      // 回滚
      setVoted((v) => ({ ...v, [aid]: !newVoted }));
      setQuestion((q) => {
        if (!q) return q;
        return {
          ...q,
          answerList: q.answerList.map((a) =>
            a.id === aid ? { ...a, votes: Math.max(0, (a.votes ?? 0) + (newVoted ? -1 : 1)) } : a
          ),
        };
      });
      toast.error("投票失败，请重试");
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

    // 频率限制：先检查，成功后再记录（失败不白等冷却）
    const rl = rateLimiters.comment.check();
    if (!rl.allowed) {
      toast.error(`操作太频繁，请 ${rl.remaining}s 后再试`);
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
        rateLimiters.comment.record();
        // 更新本地状态
        const newAnswerList = question.answerList.map((a) => {
          if (a.id === answerId) {
            return { ...a, comments: [comment, ...(a.comments ?? [])] };
          }
          return a;
        });
        setQuestion({ ...question, answerList: newAnswerList });
        setCommentText("");
        setReplyTarget(null);
        setCommentingAnswerId(null);

        // 如果评论的是天玑bot的回答，触发 AI 评论回复
        const targetAnswer = question.answerList.find((a) => a.id === answerId);
        if (targetAnswer?.authorUid === "ai-bot-001") {
          app.callFunction({
            name: "ai-bot",
            data: {
              postId: question.id,
              postTitle: question.title,
              tags: question.tags,
              replyType: "comment",
              answerId,
              answerContent: targetAnswer.content,
              userComment: comment.content,
            },
          }).then((res: unknown) => {
            const result = (res as { result?: { ok?: boolean; comment?: Comment; answerId?: string } }).result;
            if (result?.ok && result.comment && result.answerId) {
              setQuestion((prev) => {
                if (!prev) return prev;
                const updated = prev.answerList.map((a) => {
                  if (a.id === result.answerId) {
                    return { ...a, comments: [result.comment!, ...(a.comments ?? [])] };
                  }
                  return a;
                });
                return { ...prev, answerList: updated };
              });
            }
          }).catch((err) => {
            console.error("AI bot comment error:", err);
          });
        }
      } else {
        toast.error("评论提交失败，请刷新后重试");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "评论提交失败");
    } finally {
      setCommentSubmitting(false);
    }
  };

  // 加载骨架
  if (loading) {
    return <PostDetailSkeleton />;
  }

  // 未找到
  if (!question) {
    return (
      <div className="container-tj py-40 text-center">
        <p className="text-mist-400">未找到该讨论。</p>
        <Link to="/" className="btn-ghost mt-6 inline-flex">
          <ArrowLeft size={15} /> 返回讨论区
        </Link>
      </div>
    );
  }

  return (
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
                <Link key={t} to={`/tags/${encodeURIComponent(t)}`} className="pill transition-colors hover:border-tian-400/50 hover:text-tian-100">
                  {t}
                </Link>
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
              <span className="font-mono">{formatRelativeTime(question.createdAt)}</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Eye size={12} /> {question.views} 浏览
              </span>
              <button
                onClick={handleToggleFav}
                className={`ml-auto flex items-center gap-1 transition-colors ${
                  favState ? "text-star-300" : "text-mist-400 hover:text-star-300"
                }`}
              >
                <Bookmark size={13} className={favState ? "fill-star-400" : ""} />
                {favState ? "已收藏" : "收藏"}
              </button>
              {!isAuthor(user?.uid, question.authorUid) && (
                <button
                  onClick={() => openReport("post", question.id, question.title)}
                  className="flex items-center gap-1 text-mist-400 transition-colors hover:text-red-300"
                  title="举报帖子"
                >
                  <Flag size={13} /> 举报
                </button>
              )}
              {isAuthor(user?.uid, question.authorUid) && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={startEditPost}
                    className="flex h-9 w-9 items-center justify-center rounded-md text-mist-400 transition-colors hover:bg-void-700/60 hover:text-tian-300"
                    title="编辑帖子"
                    aria-label="编辑帖子"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={handleDeletePost}
                    className="flex h-9 w-9 items-center justify-center rounded-md text-mist-400 transition-colors hover:bg-void-700/60 hover:text-red-300"
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
                <textarea
                  name="body"
                  rows={8}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  className="w-full resize-none rounded-lg border border-void-600/50 bg-void-950/50 p-3 text-sm text-parchment-100 focus:border-star-400/50 focus:outline-none"
                  maxLength={10000}
                />
                <div className="mt-3 flex justify-end gap-2">
                  <button onClick={() => setEditingPost(false)} className="btn-ghost text-xs">取消</button>
                  <button onClick={handleSavePost} className="btn-gold text-xs">保存</button>
                </div>
              </div>
            ) : (
              <div className="mt-6 border-t border-void-600/40 pt-6">
                <LazyMathText
                  content={question.body}
                  className="text-[15px] leading-relaxed text-parchment-100"
                />
              </div>
            )}
          </motion.div>

          {/* 回答 */}
          <div className="mt-10 border-t border-void-600/40 pt-6">
            <h2 className="heading-display text-lg text-parchment-50">
              {question.answerList.length} 个回答
            </h2>

            <div className="mt-2 divide-y divide-void-600/40">
              {[...question.answerList]
                .sort((a, b) => {
                  // 采纳的回答始终排第一
                  if (a.accepted && !b.accepted) return -1;
                  if (!a.accepted && b.accepted) return 1;
                  // 其余按时间倒序（最新在最上面）
                  return b.date > a.date ? 1 : -1;
                })
                .map((a) => (
                <div key={a.id} className="py-6">
                  <div className="flex gap-3">
                    <Avatar name={a.author} color={a.avatarColor} size={38} />

                    {/* 内容 */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-mist-500">
                        <span className="text-sm text-parchment-100">{a.author}</span>
                        <span className="font-mono">{formatRelativeTime(a.date)}</span>
                        {a.accepted && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-300">
                            <Check size={11} /> 已采纳
                          </span>
                        )}
                      </div>
                      {editingAnswerId === a.id ? (
                        <div className="mt-3">
                          <textarea
                            name="answer"
                            rows={5}
                            value={editAnswerText}
                            onChange={(e) => setEditAnswerText(e.target.value)}
                            className="w-full resize-none rounded-lg border border-void-600/50 bg-void-950/50 p-3 text-sm text-parchment-100 focus:border-star-400/50 focus:outline-none"
                            maxLength={8000}
                          />
                          <div className="mt-2 flex justify-end gap-2">
                            <button onClick={() => setEditingAnswerId(null)} className="btn-ghost text-xs">取消</button>
                            <button onClick={() => handleSaveAnswer(a.id)} className="btn-gold text-xs">保存</button>
                          </div>
                        </div>
                      ) : (
                        <LazyMathText
                          content={a.content}
                          className="mt-2 text-[15px] leading-relaxed text-mist-200"
                        />
                      )}

                      {/* 动作行 */}
                      <div className="mt-3 flex items-center gap-4 text-xs text-mist-500">
                        <button
                          onClick={() => toggleVote(a.id)}
                          className={`inline-flex items-center gap-1.5 transition-colors ${
                            voted[a.id] ? "text-star-300" : "hover:text-star-300"
                          }`}
                          aria-label="投票"
                        >
                          <ThumbsUp size={14} className={voted[a.id] ? "fill-star-400" : ""} />
                          {a.votes > 0 && <span>{a.votes}</span>}
                        </button>
                        <button
                          onClick={() => openComment(a.id)}
                          className="inline-flex items-center gap-1.5 transition-colors hover:text-tian-200"
                        >
                          <MessageCircle size={14} />
                          {a.comments && a.comments.length > 0 ? `${a.comments.length} 条评论` : "评论"}
                        </button>
                        {isAuthor(user?.uid, question.authorUid) && a.authorUid !== "ai-bot-001" && !a.accepted && (
                          <button
                            onClick={() => handleAccept(a.id, true)}
                            disabled={acceptingId !== null}
                            className="inline-flex items-center gap-1 transition-colors hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {acceptingId === a.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                            采纳
                          </button>
                        )}
                        {isAuthor(user?.uid, question.authorUid) && a.accepted && (
                          <button
                            onClick={() => handleAccept(a.id, false)}
                            disabled={acceptingId !== null}
                            className="inline-flex items-center gap-1 transition-colors hover:text-mist-300 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {acceptingId === a.id ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                            取消采纳
                          </button>
                        )}
                        <span className="ml-auto flex items-center gap-3">
                          {!isAuthor(user?.uid, a.authorUid) && (
                            <button
                              onClick={() => openReport("answer", a.id, `回答：${a.content.slice(0, 30)}`)}
                              className="transition-colors hover:text-red-300"
                              title="举报回答"
                            >
                              <Flag size={13} />
                            </button>
                          )}
                          {isAuthor(user?.uid, a.authorUid) && (
                            <>
                              <button
                                onClick={() => startEditAnswer(a.id, a.content)}
                                className="transition-colors hover:text-tian-300"
                                title="编辑回答"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteAnswer(a.id)}
                                className="transition-colors hover:text-red-300"
                                title="删除回答"
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                        </span>
                      </div>

                      {/* 评论列表（扁平） */}
                      {a.comments && a.comments.length > 0 && (
                        <div className="mt-4 divide-y divide-void-600/30 border-t border-void-600/30">
                          {[...(a.comments ?? [])].sort((x, y) => (y.date > x.date ? 1 : -1)).map((c) => {
                            const repliedComment = c.replyTo
                              ? a.comments?.find((rc) => rc.id === c.replyTo)
                              : null;
                            return (
                              <div key={c.id} className="group py-3">
                                <div className="flex items-center gap-2 text-xs text-mist-500">
                                  <Avatar name={c.author} color={c.avatarColor} size={20} />
                                  <span className="text-mist-300">{c.author}</span>
                                  {repliedComment && (
                                    <span className="text-tian-300">
                                      回复 @{repliedComment.author}
                                    </span>
                                  )}
                                  <span className="font-mono">{formatRelativeTime(c.date)}</span>
                                  <button
                                    onClick={() => openReply(a.id, c)}
                                    className="ml-auto flex h-8 w-8 items-center justify-center rounded text-mist-500 opacity-0 transition-opacity hover:text-tian-300 group-hover:opacity-100"
                                    aria-label="回复评论"
                                    title="回复评论"
                                  >
                                    <CornerDownRight size={11} />
                                  </button>
                                  {isAuthor(user?.uid, c.authorUid) && (
                                    <>
                                      <button
                                        onClick={() => startEditComment(c.id, c.content)}
                                        className="flex h-8 w-8 items-center justify-center rounded-md text-mist-500 opacity-0 transition-opacity hover:text-tian-300 group-hover:opacity-100"
                                        title="编辑评论"
                                        aria-label="编辑评论"
                                      >
                                        <Pencil size={11} />
                                      </button>
                                      <button
                                        onClick={() => {
                                          handleDeleteComment(a.id, c.id);
                                        }}
                                        className="flex h-8 w-8 items-center justify-center rounded-md text-mist-500 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100"
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
                                        openReport("comment", c.id, `评论：${c.content.slice(0, 30)}`);
                                      }}
                                      className="flex h-8 w-8 items-center justify-center rounded text-mist-500 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100"
                                      aria-label="举报评论"
                                      title="举报评论"
                                    >
                                      <Flag size={11} />
                                    </button>
                                  )}
                                </div>
                                {editingCommentId === c.id ? (
                                  <div className="mt-2 pl-7">
                                    <textarea
                                      rows={3}
                                      value={editCommentText}
                                      onChange={(e) => setEditCommentText(e.target.value)}
                                      className="w-full resize-none rounded-lg border border-void-600/50 bg-void-950/50 p-2 text-sm text-parchment-100 focus:border-star-400/50 focus:outline-none"
                                      maxLength={2000}
                                    />
                                    <div className="mt-1 flex justify-end gap-2">
                                      <button onClick={() => setEditingCommentId(null)} className="btn-ghost text-xs">取消</button>
                                      <button onClick={() => handleSaveComment(a.id, c.id)} className="btn-gold text-xs">保存</button>
                                    </div>
                                  </div>
                                ) : (
                                  <LazyMathText
                                    content={c.content}
                                    className="mt-1 pl-7 text-sm text-mist-200"
                                  />
                                )}
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
                          <textarea
                            name="comment"
                            rows={2}
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder="写下你的评论…"
                            className="w-full resize-none rounded-md border border-void-600/50 bg-void-950/50 p-2.5 text-sm text-parchment-100 placeholder:text-mist-500 focus:border-star-400/50 focus:outline-none"
                            maxLength={500}
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
              <p className="mt-1 text-xs text-mist-500">
                支持 LaTeX：行内用 <code className="text-star-300">$...$</code>，行间用{" "}
                <code className="text-star-300">$$...$$</code>
              </p>
              <textarea
                name="answer"
                rows={5}
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                placeholder={user ? "撰写你的推导与解答…" : "请先登录后再回答…"}
                disabled={!user}
                className="mt-3 w-full resize-none rounded-lg border border-void-600/50 bg-void-950/50 p-3 text-sm text-parchment-100 placeholder:text-mist-500 focus:border-star-400/50 focus:outline-none disabled:opacity-50"
                maxLength={8000}
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
                  <dt className="text-mist-500">状态</dt>
                  <dd className={question.answerList.some((a) => a.accepted) ? "text-emerald-300" : "text-amber-300"}>
                    {question.answerList.some((a) => a.accepted) ? "已解决" : "待解答"}
                  </dd>
                </div>
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
                  <Link key={t} to={`/tags/${encodeURIComponent(t)}`} className="pill hover:border-tian-400/50 hover:text-tian-100">
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
  );
}
