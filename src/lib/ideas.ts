import { app } from "@/lib/cloudbase";
import { createNotification } from "@/lib/notifications";
import { useAuthStore } from "@/stores/auth";
import type { Idea } from "@/types";

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
}

const AVATAR_COLORS = ["#7cc4ff", "#f3c969", "#5aa6f0", "#a78bfa", "#34d399", "#fb923c"];

function toIdea(doc: IdeaDoc): Idea {
  return {
    id: doc._id ?? "",
    title: doc.title,
    summary: doc.summary,
    author: doc.author,
    avatarColor: doc.avatarColor,
    topic: doc.topic,
    tags: doc.tags,
    resonance: doc.resonance,
    replies: doc.replies,
    createdAt: doc.createdAt,
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
    createdAt: new Date().toISOString().slice(0, 10),
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

    const current = (data[0] as IdeaDoc).resonance ?? 0;
    await docRef.update({ resonance: current + 1 });

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
