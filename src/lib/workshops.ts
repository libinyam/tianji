import { app } from "@/lib/cloudbase";
import { createNotification } from "@/lib/notifications";
import { useAuthStore } from "@/stores/auth";

const db = app.database();
const COLLECTION = "workshops";

export type WorkshopType = "教材" | "论文";
export type WorkshopStatus = "招募中" | "进行中" | "已完成";

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

export interface WorkshopProject {
  id: string;
  title: string;
  type: WorkshopType;
  description: string;
  outline: OutlineChapter[];
  creator: string;
  creatorUid: string;
  avatarColor: string;
  participants: string[];
  contributions: Contribution[];
  tags: string[];
  status: WorkshopStatus;
  createdAt: string;
}

export interface WorkshopDoc {
  _id?: string;
  title: string;
  type: WorkshopType;
  description: string;
  outline: OutlineChapter[];
  creator: string;
  creatorUid: string;
  avatarColor: string;
  participants: string[];
  contributions: Contribution[];
  tags: string[];
  status: WorkshopStatus;
  createdAt: string;
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
    outline: doc.outline ?? [],
    creator: doc.creator,
    creatorUid: doc.creatorUid,
    avatarColor: doc.avatarColor,
    participants: doc.participants ?? [],
    contributions: doc.contributions ?? [],
    tags: doc.tags ?? [],
    status: doc.status ?? "招募中",
    createdAt: doc.createdAt,
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
  outline: OutlineChapter[];
  tags: string[];
}): Promise<WorkshopProject | null> {
  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");

  const doc: Omit<WorkshopDoc, "_id"> = {
    title: params.title,
    type: params.type,
    description: params.description,
    outline: params.outline,
    creator: getCurrentUserName(),
    creatorUid: uid,
    avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    participants: [uid],
    contributions: [],
    tags: params.tags,
    status: "招募中",
    createdAt: new Date().toISOString(),
  };

  const res = await db.collection(COLLECTION).add(doc);
  const resObj = res as unknown as Record<string, unknown>;
  const newId = (resObj.id as string) ?? (resObj._id as string) ?? "";

  return {
    id: newId,
    title: doc.title,
    type: doc.type,
    description: doc.description,
    outline: doc.outline,
    creator: doc.creator,
    creatorUid: doc.creatorUid,
    avatarColor: doc.avatarColor,
    participants: doc.participants,
    contributions: [],
    tags: doc.tags,
    status: doc.status,
    createdAt: doc.createdAt,
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
    id: `c_${Date.now()}`,
    chapterId,
    author: getCurrentUserName(),
    authorUid: uid,
    avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    content,
    createdAt: new Date().toISOString().slice(0, 10),
  };

  await docRef.update({
    contributions: [...(project.contributions ?? []), contribution],
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
