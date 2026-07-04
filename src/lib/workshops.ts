import { app } from "@/lib/cloudbase";
import { createNotification } from "@/lib/notifications";
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

  const now = new Date().toISOString();
  const doc: Omit<WorkshopDoc, "_id"> = {
    title: params.title,
    type: params.type,
    description: params.description,
    content: params.content ?? "",
    outline: params.outline,
    creator: getCurrentUserName(),
    creatorUid: uid,
    avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    participants: [uid],
    contributions: [],
    annotations: [],
    tags: params.tags,
    status: "open",
    createdAt: now,
    updatedAt: now,
  };

  const res = await db.collection(COLLECTION).add(doc);
  const resObj = res as unknown as Record<string, unknown>;
  const newId = (resObj.id as string) ?? (resObj._id as string) ?? "";

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
    const docRef = db.collection(COLLECTION).doc(id);
    const { data } = await docRef.get();
    if (!data || data.length === 0) return false;

    const project = data[0] as WorkshopDoc;
    if (project.participants?.includes(uid)) return true;

    await docRef.update({
      participants: [...(project.participants ?? []), uid],
      updatedAt: new Date().toISOString(),
    });

    // 通知项目创建者
    await createNotification({
      uid: project.creatorUid,
      type: "join",
      title: project.title,
      link: `/workshop/${id}`,
    });

    return true;
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

  const docRef = db.collection(COLLECTION).doc(workshopId);
  const { data } = await docRef.get();
  if (!data || data.length === 0) return null;

  const project = data[0] as WorkshopDoc;
  const contribution: Contribution = {
    id: `c_${crypto.randomUUID()}`,
    chapterId,
    author: getCurrentUserName(),
    authorUid: uid,
    avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    content,
    createdAt: new Date().toISOString(),
  };

  await docRef.update({
    contributions: [...(project.contributions ?? []), contribution],
    updatedAt: new Date().toISOString(),
  });

  // 通知项目创建者
  await createNotification({
    uid: project.creatorUid,
    type: "contribute",
    title: project.title,
    link: `/workshop/${workshopId}`,
  });

  return contribution;
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
    if (params.title !== undefined) updateFields.title = params.title;
    if (params.description !== undefined) updateFields.description = params.description;
    if (params.content !== undefined) updateFields.content = params.content;
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

  try {
    const docRef = db.collection(COLLECTION).doc(id);
    const { data } = await docRef.get();
    if (!data || data.length === 0) return null;

    const annotation: Annotation = {
      id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      author: getCurrentUserName(),
      authorUid: uid,
      content: content.trim(),
      resolved: false,
      createdAt: new Date().toISOString(),
    };

    // 使用原子 push 追加批注，避免读-改-写竞态
    await docRef.update({
      annotations: db.command.push([annotation]),
      updatedAt: new Date().toISOString(),
    });

    return annotation;
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
    const docRef = db.collection(COLLECTION).doc(id);
    const { data } = await docRef.get();
    if (!data || data.length === 0) return false;

    const project = data[0] as WorkshopDoc;
    const annotations = project.annotations ?? [];
    const target = annotations.find((a) => a.id === annotationId);
    if (!target) return false;

    // 权限检查：仅创建者或批注作者可解决
    if (project.creatorUid !== uid && target.authorUid !== uid) {
      throw new Error("仅创建者或批注作者可解决批注");
    }

    const updated = annotations.map((a) =>
      a.id === annotationId ? { ...a, resolved: true } : a
    );

    await docRef.update({
      annotations: updated,
      updatedAt: new Date().toISOString(),
    });

    return true;
  } catch (err) {
    if (err instanceof Error && err.message.includes("仅创建者或批注作者")) throw err;
    return false;
  }
}
