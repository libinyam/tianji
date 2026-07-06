import { app } from "@/lib/cloudbase";
import { useAuthStore } from "@/stores/auth";
import { assertAdmin } from "@/lib/admin";

const db = app.database();
const COLLECTION = "announcements";

export interface Announcement {
  id: string;
  title: string;
  content: string;
  authorUid: string;
  authorName: string;
  createdAt: string;
  active: boolean;
}

/** 获取所有公告（管理后台用） */
export async function fetchAllAnnouncements(): Promise<Announcement[]> {
  const { data } = await db
    .collection(COLLECTION)
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();
  return (data || []).map((d: Record<string, unknown>) => ({
    id: d._id as string,
    title: d.title as string,
    content: d.content as string,
    authorUid: d.authorUid as string,
    authorName: d.authorName as string,
    createdAt: d.createdAt as string,
    active: d.active !== false,
  }));
}

/** 获取活跃公告（讨论区展示用） */
export async function fetchActiveAnnouncements(): Promise<Announcement[]> {
  const { data } = await db
    .collection(COLLECTION)
    .where({ active: true })
    .orderBy("createdAt", "desc")
    .limit(5)
    .get();
  return (data || []).map((d: Record<string, unknown>) => ({
    id: d._id as string,
    title: d.title as string,
    content: d.content as string,
    authorUid: d.authorUid as string,
    authorName: d.authorName as string,
    createdAt: d.createdAt as string,
    active: true,
  }));
}

/** 发布公告（管理员） */
export async function createAnnouncement(title: string, content: string): Promise<Announcement> {
  await assertAdmin();
  const user = useAuthStore.getState().user;
  const doc = {
    title: title.trim(),
    content: content.trim(),
    authorUid: user?.uid ?? "",
    authorName: user?.nickname || user?.username || "管理员",
    createdAt: new Date().toISOString(),
    active: true,
  };
  const { id } = await db.collection(COLLECTION).add(doc);
  return { id: id ?? "", ...doc };
}

/** 切换公告状态（管理员） */
export async function toggleAnnouncement(id: string, active: boolean): Promise<void> {
  await assertAdmin();
  await db.collection(COLLECTION).doc(id).update({ active });
}

/** 删除公告（管理员） */
export async function deleteAnnouncement(id: string): Promise<void> {
  await assertAdmin();
  await db.collection(COLLECTION).doc(id).remove();
}
