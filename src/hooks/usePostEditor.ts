import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/stores/toast";
import { updatePost, deletePost } from "@/lib/posts";
import type { Question } from "@/types";

type SetQuestion = React.Dispatch<React.SetStateAction<Question | null>>;

export function usePostEditor(
  question: Question | null,
  setQuestion: SetQuestion
) {
  const navigate = useNavigate();

  const [editingPost, setEditingPost] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");

  const startEditPost = () => {
    if (!question) return;
    setEditTitle(question.title);
    setEditBody(question.body);
    setEditingPost(true);
  };

  const handleSavePost = async () => {
    if (!question || !editTitle.trim() || !editBody.trim()) return;
    try {
      await updatePost(question.id, {
        title: editTitle.trim(),
        body: editBody.trim(),
        tags: question.tags,
      });
      const trimmedBody = editBody.trim();
      setQuestion({
        ...question,
        title: editTitle.trim(),
        body: trimmedBody,
        excerpt:
          trimmedBody.length > 120 ? trimmedBody.slice(0, 120) + "…" : trimmedBody,
      });
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

  return {
    editingPost,
    setEditingPost,
    editTitle,
    setEditTitle,
    editBody,
    setEditBody,
    startEditPost,
    handleSavePost,
    handleDeletePost,
  };
}
