import { useState } from "react";
import { toast } from "@/stores/toast";
import { submitComment, deleteComment, updateComment } from "@/lib/posts";
import { rateLimiters } from "@/lib/security";
import { triggerAiBotReply } from "@/lib/ai";
import { useAuthStore } from "@/stores/auth";
import type { Question, Comment } from "@/types";

type SetQuestion = React.Dispatch<React.SetStateAction<Question | null>>;

export function useCommentActions(
  question: Question | null,
  setQuestion: SetQuestion
) {
  const { user } = useAuthStore();

  const [commentingAnswerId, setCommentingAnswerId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [replyTarget, setReplyTarget] = useState<{
    answerId: string;
    commentId: string;
    author: string;
  } | null>(null);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");

  const openComment = (answerId: string) => {
    if (!user) {
      window.dispatchEvent(new CustomEvent("tianji:open-auth"));
      return;
    }
    setCommentingAnswerId(commentingAnswerId === answerId ? null : answerId);
    setCommentText("");
    setReplyTarget(null);
  };

  const openReply = (answerId: string, comment: Comment) => {
    if (!user) {
      window.dispatchEvent(new CustomEvent("tianji:open-auth"));
      return;
    }
    setCommentingAnswerId(answerId);
    setReplyTarget({ answerId, commentId: comment.id, author: comment.author });
    setCommentText(`@${comment.author} `);
  };

  const handleSubmitComment = async (answerId: string) => {
    if (!question) return;
    if (!commentText.trim()) return;

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

        const targetAnswer = question.answerList.find((a) => a.id === answerId);
        if (targetAnswer?.authorUid === "ai-bot-001") {
          triggerAiBotReply({
            postId: question.id,
            postTitle: question.title,
            tags: question.tags,
            replyType: "comment",
            answerId,
            answerContent: targetAnswer.content,
            userComment: comment.content,
          })
            .then((result) => {
              if (result?.ok && result.comment) {
                const aiComment = result.comment as Comment;
                setQuestion((prev) => {
                  if (!prev) return prev;
                  const updated = prev.answerList.map((a) => {
                    if (a.id === answerId) {
                      return { ...a, comments: [aiComment, ...(a.comments ?? [])] };
                    }
                    return a;
                  });
                  return { ...prev, answerList: updated };
                });
              }
            })
            .catch((err) => {
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

  return {
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
  };
}
