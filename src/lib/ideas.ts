import { app, authReady } from "@/lib/cloudbase";
import { createNotification } from "@/lib/notifications";
import { sanitizeInput, sanitizeTitle, sanitizeTag } from "@/lib/sanitize";
import { checkCurrentUserBanned } from "@/lib/ban";
import { containsSensitiveWord } from "@/lib/sensitive-words";
import { awardReputation } from "@/lib/reputation";
import { getCurrentUid, getCurrentUserName } from "@/lib/current-user";
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
    await authReady; // #345/#402 等匿名身份就绪，避免新访客深链 401 误报"灵感不存在"
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

  // #404 走云函数写入，接入服务端审核（上方本地校验仅为快速反馈）
  const res = await app.callFunction({
    name: "content-actions",
    data: {
      action: "createIdea",
      title: cleanTitle,
      summary: cleanSummary,
      topic: cleanTopic,
      tags: cleanTags,
      author: getCurrentUserName(),
    },
  });
  const result = (res?.result ?? {}) as {
    ok?: boolean;
    error?: string;
    data?: {
      id?: string;
      title: string;
      summary: string;
      author: string;
      authorUid: string;
      avatarColor: string;
      topic: string;
      tags: string[];
      createdAt: string;
    };
  };
  if (!result.ok) throw new Error(result.error || "发布失败，请重试");
  const doc = result.data;
  if (!doc) return null;
  const newId = doc.id ?? "";

  await awardReputation("createIdea", newId);

  return {
    id: newId,
    title: doc.title,
    summary: doc.summary,
    author: doc.author,
    authorUid: doc.authorUid,
    avatarColor: doc.avatarColor,
    topic: doc.topic,
    tags: doc.tags ?? [],
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

/** 编辑灵感（仅作者，#404 走云函数，接入服务端审核） */
export async function updateIdea(
  ideaId: string,
  params: { title: string; summary: string; tags: string[] }
): Promise<boolean> {
  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");

  // Sanitize inputs
  const cleanTitle = sanitizeTitle(params.title);
  const cleanSummary = sanitizeInput(params.summary);
  const cleanTags = params.tags.map(sanitizeTag);

  const res = await app.callFunction({
    name: "content-actions",
    data: { action: "updateIdea", ideaId, title: cleanTitle, summary: cleanSummary, tags: cleanTags },
  });
  const result = (res?.result ?? {}) as { ok?: boolean; error?: string };
  if (!result.ok) {
    // 与旧实现一致：灵感不存在返回 false，越权/审核拦截抛出
    if (result.error === "灵感不存在") return false;
    throw new Error(result.error || "保存失败，请重试");
  }
  return true;
}

/** 添加评论（#400 走云函数：绕过 ideas 仅作者可 update 的安全规则，并获得服务端审核） */
export async function addIdeaComment(ideaId: string, content: string): Promise<IdeaComment | null> {
  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");
  if (!content.trim()) throw new Error("评论内容不能为空");

  // Sanitize input
  const cleanContent = sanitizeInput(content.trim());

  const res = await app.callFunction({
    name: "content-actions",
    data: { action: "addIdeaComment", ideaId, content: cleanContent, author: getCurrentUserName() },
  });
  const result = (res?.result ?? {}) as {
    ok?: boolean;
    error?: string;
    data?: { comment?: IdeaComment; ideaTitle?: string; ideaAuthorUid?: string };
  };
  if (!result.ok) {
    // 与旧实现一致：灵感已被删除时返回 null，由调用方给出友好提示
    if (result.error === "灵感不存在") return null;
    throw new Error(result.error || "评论失败，请重试");
  }
  const comment = result.data?.comment;
  if (!comment) return null;

  // 通知灵感作者（legacy 灵感缺 authorUid 时不写无主通知 #115）
  const ideaAuthorUid = result.data?.ideaAuthorUid;
  if (ideaAuthorUid && ideaAuthorUid !== uid) {
    await createNotification({
      uid: ideaAuthorUid,
      type: "comment",
      title: result.data?.ideaTitle ?? "",
      link: `/ideas/${ideaId}`,
    }).catch(() => {});
  }

  return comment;
}

/** 删除评论（仅作者，#400 走云函数） */
export async function deleteIdeaComment(ideaId: string, commentId: string): Promise<boolean> {
  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");

  const res = await app.callFunction({
    name: "content-actions",
    data: { action: "deleteIdeaComment", ideaId, commentId },
  });
  const result = (res?.result ?? {}) as { ok?: boolean; error?: string };
  if (!result.ok) {
    // 与旧实现一致：目标不存在返回 false，越权等其余错误抛出
    if (result.error === "灵感不存在" || result.error === "评论不存在") return false;
    throw new Error(result.error || "删除失败，请重试");
  }
  return true;
}

/** 删除灵感（仅作者，#374 改走云函数以 admin 权限级联清理） */
export async function deleteIdea(ideaId: string): Promise<boolean> {
  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");

  const res = await app.callFunction({
    name: "content-actions",
    data: { action: "deleteIdea", ideaId },
  });
  const result = (res?.result ?? {}) as { ok?: boolean; error?: string };
  if (!result.ok) throw new Error(result.error || "删除失败，请稍后重试");
  return true;
}
