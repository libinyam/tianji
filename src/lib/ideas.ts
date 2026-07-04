import { app } from "@/lib/cloudbase";
import { createNotification } from "@/lib/notifications";
import { useAuthStore } from "@/stores/auth";
import type { Idea, IdeaComment } from "@/types";

const db = app.database();
const IDEAS_COLLECTION = "ideas";

export interface IdeaDoc {
  _id?: string;
  title: string;
  summary: string;
  author: string;
  authorUid: string;
  avatarColor: string;
  topic: string;
  tags: string[];
  resonance: number;
  replies: number;
  createdAt: string;
  resonatedBy?: string[];
  comments?: IdeaComment[];
}

const AVATAR_COLORS = ["#7cc4ff", "#f3c969", "#5aa6f0", "#a78bfa", "#34d399", "#fb923c"];

function toIdea(doc: IdeaDoc): Idea {
  return {
    id: doc._id ?? "",
    title: doc.title,
    summary: doc.summary,
    author: doc.author,
    authorUid: doc.authorUid,
    avatarColor: doc.avatarColor,
    topic: doc.topic,
    tags: doc.tags ?? [],
    resonance: doc.resonance ?? 0,
    replies: doc.replies ?? 0,
    createdAt: doc.createdAt,
    comments: doc.comments ?? [],
  };
}

function getCurrentUserName(): string {
  const user = useAuthStore.getState().user;
  return user?.nickname || user?.username || user?.email || "匿名用户";
}

function getCurrentUid(): string {
  return useAuthStore.getState().user?.uid ?? "";
}

/** 获取所有灵感（按共鸣数倒序） */
export async function fetchIdeas(): Promise<Idea[]> {
  try {
    const { data } = await db
      .collection(IDEAS_COLLECTION)
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();
    return (data as IdeaDoc[]).map(toIdea);
  } catch {
    return [];
  }
}

/** 按 ID 获取单个灵感 */
export async function fetchIdeaById(id: string): Promise<Idea | null> {
  try {
    const { data } = await db.collection(IDEAS_COLLECTION).doc(id).get();
    if (!data || data.length === 0) return null;
    return toIdea(data[0] as IdeaDoc);
  } catch {
    return null;
  }
}

/** 创建新灵感 */
export async function createIdea(params: {
  title: string;
  summary: string;
  topic: string;
  tags: string[];
}): Promise<Idea | null> {
  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");

  const doc: Omit<IdeaDoc, "_id"> = {
    title: params.title,
    summary: params.summary,
    author: getCurrentUserName(),
    authorUid: uid,
    avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    topic: params.topic,
    tags: params.tags,
    resonance: 0,
    replies: 0,
    createdAt: new Date().toISOString(),
  };

  const res = await db.collection(IDEAS_COLLECTION).add(doc);
  const resObj = res as unknown as Record<string, unknown>;
  const newId = (resObj.id as string) ?? (resObj._id as string) ?? "";

  return {
    id: newId,
    title: doc.title,
    summary: doc.summary,
    author: doc.author,
    avatarColor: doc.avatarColor,
    topic: doc.topic,
    tags: doc.tags,
    resonance: 0,
    replies: 0,
    createdAt: doc.createdAt,
  };
}

/** 共鸣（点赞），增加 resonance */
export async function resonanceIdea(id: string): Promise<boolean> {
  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");

  try {
    const docRef = db.collection(IDEAS_COLLECTION).doc(id);
    const { data } = await docRef.get();
    if (!data || data.length === 0) return false;

    const doc = data[0] as IdeaDoc;
    const resonatedBy = doc.resonatedBy ?? [];

    // 防重复共鸣
    if (resonatedBy.includes(uid)) {
      throw new Error("已共鸣过此灵感");
    }

    await docRef.update({
      resonance: db.command.inc(1),
      resonatedBy: db.command.addToSet(uid),
    });

    // 通知灵感作者
    await createNotification({
      uid: (data[0] as IdeaDoc).authorUid,
      type: "resonance",
      title: (data[0] as IdeaDoc).title,
      link: "/ideas",
    });

    return true;
  } catch {
    return false;
  }
}

/** 编辑灵感（仅作者） */
export async function updateIdea(
  ideaId: string,
  params: { title: string; summary: string; tags: string[] }
): Promise<boolean> {
  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");

  const docRef = db.collection(IDEAS_COLLECTION).doc(ideaId);
  const { data } = await docRef.get();
  if (!data || data.length === 0) return false;

  const idea = data[0] as IdeaDoc;
  if (idea.authorUid !== uid) throw new Error("无权编辑他人灵感");

  await docRef.update({
    title: params.title,
    summary: params.summary,
    tags: params.tags,
  });
  return true;
}

/** 添加评论 */
export async function addIdeaComment(ideaId: string, content: string): Promise<IdeaComment | null> {
  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");
  if (!content.trim()) throw new Error("评论内容不能为空");

  const docRef = db.collection(IDEAS_COLLECTION).doc(ideaId);
  const { data } = await docRef.get();
  if (!data || data.length === 0) return null;

  const idea = data[0] as IdeaDoc;
  const comment: IdeaComment = {
    id: `c_${crypto.randomUUID()}`,
    author: getCurrentUserName(),
    authorUid: uid,
    avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    content: content.trim(),
    createdAt: new Date().toISOString(),
  };

  await docRef.update({
    comments: db.command.push([comment]),
    replies: db.command.inc(1),
  });

  // 通知灵感作者（legacy 灵感缺 authorUid 时不写无主通知 #115）
  if (idea.authorUid && idea.authorUid !== uid) {
    await createNotification({
      uid: idea.authorUid,
      type: "comment",
      title: idea.title,
      link: `/ideas/${ideaId}`,
    }).catch(() => {});
  }

  return comment;
}

/** 删除评论（仅作者） */
export async function deleteIdeaComment(ideaId: string, commentId: string): Promise<boolean> {
  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");

  const docRef = db.collection(IDEAS_COLLECTION).doc(ideaId);
  const { data } = await docRef.get();
  if (!data || data.length === 0) return false;

  const idea = data[0] as IdeaDoc;
  const comments = idea.comments ?? [];
  const comment = comments.find((c) => c.id === commentId);
  if (!comment) return false;
  if (comment.authorUid !== uid) throw new Error("无权删除他人评论");

  await docRef.update({
    comments: db.command.pull({ id: commentId }),
    replies: db.command.inc(-1),
  });

  return true;
}

/** 删除灵感（仅作者） */
export async function deleteIdea(ideaId: string): Promise<boolean> {
  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");

  const docRef = db.collection(IDEAS_COLLECTION).doc(ideaId);
  const { data } = await docRef.get();
  if (!data || data.length === 0) return false;

  const idea = data[0] as IdeaDoc;
  if (idea.authorUid !== uid) throw new Error("无权删除他人灵感");

  await docRef.remove();

  // 级联清理收藏和举报（不阻塞主流程）
  try {
    await db.collection("favorites").where({ targetId: ideaId }).remove();
  } catch { /* 安全规则可能拦截，忽略 */ }
  try {
    await db.collection("reports").where({ targetId: ideaId }).remove();
  } catch { /* 安全规则可能拦截，忽略 */ }

  return true;
}
