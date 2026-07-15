import { app, authReady } from "@/lib/cloudbase";
import { createNotification } from "@/lib/notifications";
import { sanitizeInput, sanitizeTitle, sanitizeTag } from "@/lib/sanitize";
import { checkCurrentUserBanned } from "@/lib/ban";
import { containsSensitiveWord } from "@/lib/sensitive-words";
import { awardReputation } from "@/lib/reputation";
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
    resonatedBy: doc.resonatedBy ?? [],
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
    await authReady; // #345 等匿名身份就绪，避免新访客首屏 401
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

  const banStatus = await checkCurrentUserBanned();
  if (banStatus) throw new Error("您的账号已被封禁");

  // Sanitize inputs
  const cleanTitle = sanitizeTitle(params.title);
  const cleanSummary = sanitizeInput(params.summary);
  const cleanTopic = sanitizeInput(params.topic, 100);
  const cleanTags = params.tags.map(sanitizeTag);

  const sensitiveCheck = containsSensitiveWord(cleanTitle + cleanSummary);
  if (sensitiveCheck.found) {
    throw new Error(`内容包含敏感词: ${sensitiveCheck.words.join(", ")}`);
  }

  const doc: Omit<IdeaDoc, "_id"> = {
    title: cleanTitle,
    summary: cleanSummary,
    author: getCurrentUserName(),
    authorUid: uid,
    avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    topic: cleanTopic,
    tags: cleanTags,
    resonance: 0,
    replies: 0,
    createdAt: new Date().toISOString(),
  };

  const res = await db.collection(IDEAS_COLLECTION).add(doc);
  const resObj = res as unknown as Record<string, unknown>;
  const newId = (resObj.id as string) ?? (resObj._id as string) ?? "";

  await awardReputation("createIdea", newId);

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

/** 共鸣（点赞），增加 resonance。失败（含已共鸣过）时抛错，由调用方回滚乐观更新 */
export async function resonanceIdea(id: string): Promise<boolean> {
  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");

  const banStatus = await checkCurrentUserBanned();
  if (banStatus) throw new Error("您的账号已被封禁");

  const res = await app.callFunction({
    name: "content-actions",
    data: { action: "resonanceIdea", id },
  });
  const result = (res?.result ?? {}) as { ok?: boolean; error?: string };
  if (!result.ok) throw new Error(result.error || "操作失败");
  return true;
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

  // Sanitize inputs
  const cleanTitle = sanitizeTitle(params.title);
  const cleanSummary = sanitizeInput(params.summary);
  const cleanTags = params.tags.map(sanitizeTag);

  await docRef.update({
    title: cleanTitle,
    summary: cleanSummary,
    tags: cleanTags,
  });
  return true;
}

/** 添加评论 */
export async function addIdeaComment(ideaId: string, content: string): Promise<IdeaComment | null> {
  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");
  if (!content.trim()) throw new Error("评论内容不能为空");

  // Sanitize input
  const cleanContent = sanitizeInput(content.trim());

  const docRef = db.collection(IDEAS_COLLECTION).doc(ideaId);
  const { data } = await docRef.get();
  if (!data || data.length === 0) return null;

  const idea = data[0] as IdeaDoc;
  const comment: IdeaComment = {
    id: `c_${crypto.randomUUID()}`,
    author: getCurrentUserName(),
    authorUid: uid,
    avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    content: cleanContent,
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
