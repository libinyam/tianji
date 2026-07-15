import { useState } from "react";
import { toast } from "@/stores/toast";
import {
  updateAnswer,
  deleteAnswer,
  acceptAnswer,
  voteAnswer,
} from "@/lib/posts";
import { useAuthStore } from "@/stores/auth";
import type { Question } from "@/types";

type SetQuestion = React.Dispatch<React.SetStateAction<Question | null>>;
type SetVoted = React.Dispatch<React.SetStateAction<Record<string, boolean>>>;

export function useAnswerActions(
  question: Question | null,
  setQuestion: SetQuestion,
  voted: Record<string, boolean>,
  setVoted: SetVoted
) {
  const { user } = useAuthStore();

  const [editingAnswerId, setEditingAnswerId] = useState<string | null>(null);
  const [editAnswerText, setEditAnswerText] = useState("");
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

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

  const handleAccept = async (aId: string, accept: boolean) => {
    if (!question) return;
    if (acceptingId) return;
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
    setQuestion((q) => {
      if (!q) return q;
      return {
        ...q,
        answerList: q.answerList.map((a) =>
          a.id === aid
            ? { ...a, votes: Math.max(0, (a.votes ?? 0) + (newVoted ? 1 : -1)) }
            : a
        ),
      };
    });
    try {
      const { changed } = await voteAnswer(question.id, aid, newVoted);
      if (!changed) {
        // 后端未实际修改（重复点赞/取消），回滚 optimistic update
        setVoted((v) => ({ ...v, [aid]: !newVoted }));
        setQuestion((q) => {
          if (!q) return q;
          return {
            ...q,
            answerList: q.answerList.map((a) =>
              a.id === aid
                ? { ...a, votes: Math.max(0, (a.votes ?? 0) + (newVoted ? -1 : 1)) }
                : a
            ),
          };
        });
        toast.info(newVoted ? "你已经投过票了" : "你还没有投票");
      }
    } catch {
      setVoted((v) => ({ ...v, [aid]: !newVoted }));
      setQuestion((q) => {
        if (!q) return q;
        return {
          ...q,
          answerList: q.answerList.map((a) =>
            a.id === aid
              ? { ...a, votes: Math.max(0, (a.votes ?? 0) + (newVoted ? -1 : 1)) }
              : a
          ),
        };
      });
      toast.error("投票失败，请重试");
    }
  };

  return {
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
  };
}
