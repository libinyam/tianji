import { app } from "@/lib/cloudbase";
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

/** 获取活跃公告（讨论区首页展示用，客户端直读） */
export async function fetchActiveAnnouncements(): Promise<Announcement[]> {
  try {
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
  } catch {
    return [];
  }
}

/** 获取所有公告（管理后台用，走云函数确保管理员权限） */
export async function fetchAllAnnouncements(): Promise<Announcement[]> {
  await assertAdmin();
  const res = await app.callFunction({
    name: "manage-announcements",
    data: { action: "list" },
  });
  const result = (res?.result ?? {}) as { ok?: boolean; data?: Announcement[]; error?: string };
  if (!result.ok) throw new Error(result.error || "获取公告列表失败");
  return result.data ?? [];
}

/** 发布公告（管理员，走云函数） */
export async function createAnnouncement(title: string, content: string): Promise<Announcement> {
  await assertAdmin();
  const res = await app.callFunction({
    name: "manage-announcements",
    data: { action: "create", title, content },
  });
  const result = (res?.result ?? {}) as { ok?: boolean; data?: Announcement; error?: string };
  if (!result.ok) throw new Error(result.error || "发布失败");
  return result.data as Announcement;
}

/** 切换公告状态（管理员，走云函数） */
export async function toggleAnnouncement(id: string, active: boolean): Promise<void> {
  await assertAdmin();
  const res = await app.callFunction({
    name: "manage-announcements",
    data: { action: "toggle", id, active },
  });
  const result = (res?.result ?? {}) as { ok?: boolean; error?: string };
  if (!result.ok) throw new Error(result.error || "操作失败");
}

/** 删除公告（管理员，走云函数） */
export async function deleteAnnouncement(id: string): Promise<void> {
  await assertAdmin();
  const res = await app.callFunction({
    name: "manage-announcements",
    data: { action: "delete", id },
  });
  const result = (res?.result ?? {}) as { ok?: boolean; error?: string };
  if (!result.ok) throw new Error(result.error || "删除失败");
}
