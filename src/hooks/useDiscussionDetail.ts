import { useEffect, useState } from "react";
import { fetchPostById, incrementViews, getVotedAnswerIds } from "@/lib/posts";
import { isFavorited } from "@/lib/favorites";
import { useAuthStore } from "@/stores/auth";
import type { Question } from "@/types";

export function useDiscussionDetail(
  id: string | undefined,
  mockQuestion?: Question
) {
  const { user } = useAuthStore();

  const [question, setQuestion] = useState<Question | null>(mockQuestion ?? null);
  const [loading, setLoading] = useState(!mockQuestion);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [voted, setVoted] = useState<Record<string, boolean>>({});
  const [favState, setFavState] = useState(false);

  useEffect(() => {
    if (mockQuestion) {
      setQuestion(mockQuestion);
      setLoading(false);
      return;
    }
    if (!id) return;

    setQuestion(null);
    setLoading(true);
    setLoadError(null);

    let mounted = true;
    (async () => {
      const post = await fetchPostById(id);
      if (!mounted) return;
      setLoading(false);
      if (!post) {
        setQuestion(null);
        setLoadError("帖子不存在或已被删除");
        return;
      }
      setQuestion(post);
      const viewedKey = `tianji:viewed:${id}`;
      if (!sessionStorage.getItem(viewedKey)) {
        sessionStorage.setItem(viewedKey, "1");
        incrementViews(id);
        setQuestion((prev) => (prev ? { ...prev, views: prev.views + 1 } : prev));
      }
      isFavorited(id).then((fav) => {
        if (mounted) setFavState(fav);
      });
      const answerIds = (post.answerList ?? []).map((a) => a.id);
      if (answerIds.length > 0) {
        getVotedAnswerIds(answerIds).then((votedSet) => {
          if (mounted) {
            const votedMap: Record<string, boolean> = {};
            votedSet.forEach((aid) => {
              votedMap[aid] = true;
            });
            setVoted(votedMap);
          }
        });
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id, mockQuestion]);

  useEffect(() => {
    if (!id || !user) return;
    let mounted = true;
    isFavorited(id).then((v) => {
      if (mounted) setFavState(v);
    });
    if (question) {
      const answerIds = (question.answerList ?? []).map((a) => a.id);
      if (answerIds.length > 0) {
        getVotedAnswerIds(answerIds).then((votedSet) => {
          if (!mounted) return;
          const votedMap: Record<string, boolean> = {};
          votedSet.forEach((aid) => {
            votedMap[aid] = true;
          });
          setVoted(votedMap);
        });
      }
    }
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  return {
    question,
    setQuestion,
    loading,
    loadError,
    voted,
    setVoted,
    favState,
    setFavState,
  };
}
