import { app } from "@/lib/cloudbase";
import { sanitizeInput, sanitizeTitle, sanitizeTag } from "@/lib/sanitize";
import { checkCurrentUserBanned } from "@/lib/ban";
import { containsSensitiveWord } from "@/lib/sensitive-words";
import { awardReputation, REPUTATION_RULES } from "@/lib/reputation";
import { useAuthStore } from "@/stores/auth";

const db = app.database();
const COLLECTION = "workshops";

export type WorkshopType = "教材" | "论文";
export type WorkshopStatus = "招募中" | "进行中" | "已完成" | "open" | "closed";

export interface OutlineChapter {
  id: string;
  title: string;
  brief: string;
}

export interface Contribution {
  id: string;
  chapterId: string;
  author: string;
  authorUid: string;
  avatarColor: string;
  content: string;
  createdAt: string;
}

export interface Annotation {
  id: string;
  author: string;
  authorUid: string;
  content: string;
  resolved: boolean;
  createdAt: string;
}

export interface WorkshopProject {
  id: string;
  title: string;
  type: WorkshopType;
  description: string;
  content: string;
  outline: OutlineChapter[];
  creator: string;
  creatorUid: string;
  avatarColor: string;
  participants: string[];
  contributions: Contribution[];
  annotations: Annotation[];
  tags: string[];
  status: WorkshopStatus;
  createdAt: string;
  updatedAt: string;
}

export interface WorkshopDoc {
  _id?: string;
  title: string;
  type: WorkshopType;
  description: string;
  content: string;
  outline: OutlineChapter[];
  creator: string;
  creatorUid: string;
  avatarColor: string;
  participants: string[];
  contributions: Contribution[];
  annotations: Annotation[];
  tags: string[];
  status: WorkshopStatus;
  createdAt: string;
  updatedAt: string;
}

const AVATAR_COLORS = ["#7cc4ff", "#f3c969", "#5aa6f0", "#a78bfa", "#34d399", "#fb923c"];

function getCurrentUserName(): string {
  const user = useAuthStore.getState().user;
  return user?.nickname || user?.username || user?.email || "匿名用户";
}

function getCurrentUid(): string {
  return useAuthStore.getState().user?.uid ?? "";
}

function toProject(doc: WorkshopDoc): WorkshopProject {
  return {
    id: doc._id ?? "",
    title: doc.title,
    type: doc.type,
    description: doc.description,
    content: doc.content ?? "",
    outline: doc.outline ?? [],
    creator: doc.creator,
    creatorUid: doc.creatorUid,
    avatarColor: doc.avatarColor,
    participants: doc.participants ?? [],
    contributions: doc.contributions ?? [],
    annotations: doc.annotations ?? [],
    tags: doc.tags ?? [],
    status: doc.status ?? "open",
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt ?? doc.createdAt,
  };
}

/** 获取所有协作项目 */
export async function fetchWorkshops(): Promise<WorkshopProject[]> {
  try {
    const { data } = await db
      .collection(COLLECTION)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();
    return (data as WorkshopDoc[]).map(toProject);
  } catch {
    return [];
  }
}

/** 获取单个项目 */
export async function fetchWorkshopById(id: string): Promise<WorkshopProject | null> {
  try {
    const { data } = await db.collection(COLLECTION).doc(id).get();
    if (!data || data.length === 0) return null;
    return toProject(data[0] as WorkshopDoc);
  } catch {
    return null;
  }
}

/** 创建新协作项目 */
export async function createWorkshop(params: {
  title: string;
  type: WorkshopType;
  description: string;
  content?: string;
  outline: OutlineChapter[];
  tags: string[];
}): Promise<WorkshopProject | null> {
  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");

  const banStatus = await checkCurrentUserBanned();
  if (banStatus) throw new Error("您的账号已被封禁");

  // Sanitize inputs
  const cleanTitle = sanitizeTitle(params.title);
  const cleanDescription = sanitizeInput(params.description);
  const cleanContent = sanitizeInput(params.content ?? "");
  const cleanTags = params.tags.map(sanitizeTag);
  const cleanOutline = params.outline.map((ch) => ({
    ...ch,
    title: sanitizeInput(ch.title, 200),
    brief: sanitizeInput(ch.brief, 1000),
  }));

  const sensitiveCheck = containsSensitiveWord(cleanTitle + cleanDescription);
  if (sensitiveCheck.found) {
    throw new Error(`内容包含敏感词: ${sensitiveCheck.words.join(", ")}`);
  }

  const now = new Date().toISOString();
  const doc: Omit<WorkshopDoc, "_id"> = {
    title: cleanTitle,
    type: params.type,
    description: cleanDescription,
    content: cleanContent,
    outline: cleanOutline,
    creator: getCurrentUserName(),
    creatorUid: uid,
    avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    participants: [uid],
    contributions: [],
    annotations: [],
    tags: cleanTags,
    status: "open",
    createdAt: now,
    updatedAt: now,
  };

  const res = await db.collection(COLLECTION).add(doc);
  const resObj = res as unknown as Record<string, unknown>;
  const newId = (resObj.id as string) ?? (resObj._id as string) ?? "";

  await awardReputation(uid, REPUTATION_RULES.createPost, newId);

  return {
    id: newId,
    title: doc.title,
    type: doc.type,
    description: doc.description,
    content: doc.content,
    outline: doc.outline,
    creator: doc.creator,
    creatorUid: doc.creatorUid,
    avatarColor: doc.avatarColor,
    participants: doc.participants,
    contributions: [],
    annotations: [],
    tags: doc.tags,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/** 加入项目（成为参与者） */
export async function joinWorkshop(id: string): Promise<boolean> {
  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");
  try {
    const res = await app.callFunction({
      name: "content-actions",
      data: { action: "joinWorkshop", workshopId: id },
    });
    const result = (res?.result ?? {}) as { ok?: boolean; error?: string };
    return result.ok === true;
  } catch {
    return false;
  }
}

/** 提交章节贡献 */
export async function submitContribution(
  workshopId: string,
  chapterId: string,
  content: string
): Promise<Contribution | null> {
  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");
  const cleanContent = sanitizeInput(content);
  try {
    const res = await app.callFunction({
      name: "content-actions",
      data: { action: "submitWorkshopContribution", workshopId, chapterId, content: cleanContent },
    });
    const result = (res?.result ?? {}) as { ok?: boolean; data?: Contribution; error?: string };
    if (!result.ok) return null;
    return result.data ?? null;
  } catch {
    return null;
  }
}

/** 判断当前用户是否可查看论文内容 */
export function canViewContent(project: WorkshopProject): boolean {
  const uid = getCurrentUid();
  if (project.type === "教材") return true;
  return uid === project.creatorUid || project.participants.includes(uid);
}

/**
 * 更新文档内容（仅创建者可编辑）
 * @param id 文档 id
 * @param params 可更新 title、description、content、status
 */
export async function updateWorkshop(
  id: string,
  params: {
    title?: string;
    description?: string;
    content?: string;
    status?: WorkshopStatus;
  }
): Promise<boolean> {
  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");

  try {
    const docRef = db.collection(COLLECTION).doc(id);
    const { data } = await docRef.get();
    if (!data || data.length === 0) return false;

    const project = data[0] as WorkshopDoc;
    if (project.creatorUid !== uid) {
      throw new Error("仅创建者可编辑文档内容");
    }

    const updateFields: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (params.title !== undefined) updateFields.title = sanitizeTitle(params.title);
    if (params.description !== undefined) updateFields.description = sanitizeInput(params.description);
    if (params.content !== undefined) updateFields.content = sanitizeInput(params.content);
    if (params.status !== undefined) updateFields.status = params.status;

    await docRef.update(updateFields);
    return true;
  } catch (err) {
    // 权限错误向上抛出，其他错误返回 false
    if (err instanceof Error && err.message.includes("仅创建者")) throw err;
    return false;
  }
}

/**
 * 删除协作项目（仅创建者可删除）
 * @param id 文档 id
 */
export async function deleteWorkshop(id: string): Promise<boolean> {
  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");

  try {
    const docRef = db.collection(COLLECTION).doc(id);
    const { data } = await docRef.get();
    if (!data || data.length === 0) return false;

    const project = data[0] as WorkshopDoc;
    if (project.creatorUid !== uid) {
      throw new Error("仅创建者可删除项目");
    }

    await docRef.remove();
    return true;
  } catch (err) {
    if (err instanceof Error && err.message.includes("仅创建者")) throw err;
    return false;
  }
}

/**
 * 添加批注（登录用户均可添加）
 * @param id 文档 id
 * @param content 批注内容
 */
export async function addAnnotation(
  id: string,
  content: string
): Promise<Annotation | null> {
  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");
  if (!content.trim()) throw new Error("批注内容不能为空");
  const cleanContent = sanitizeInput(content.trim());
  try {
    const res = await app.callFunction({
      name: "content-actions",
      data: { action: "addWorkshopAnnotation", workshopId: id, content: cleanContent },
    });
    const result = (res?.result ?? {}) as { ok?: boolean; data?: Annotation; error?: string };
    if (!result.ok) return null;
    return result.data ?? null;
  } catch {
    return null;
  }
}

/**
 * 解决批注（创建者或批注作者可解决）
 * @param id 文档 id
 * @param annotationId 批注 id
 */
export async function resolveAnnotation(
  id: string,
  annotationId: string
): Promise<boolean> {
  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");
  try {
    const res = await app.callFunction({
      name: "content-actions",
      data: { action: "resolveWorkshopAnnotation", workshopId: id, annotationId },
    });
    const result = (res?.result ?? {}) as { ok?: boolean; error?: string };
    if (result.error?.includes("仅创建者或批注作者")) {
      throw new Error(result.error);
    }
    return result.ok === true;
  } catch (err) {
    if (err instanceof Error && err.message.includes("仅创建者或批注作者")) throw err;
    return false;
  }
}
