import { app, callCloudFunction } from "@/lib/cloudbase";
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
  const data = await callCloudFunction<Announcement[] | undefined>(
    "manage-announcements",
    { action: "list" },
    "获取公告列表失败",
  );
  return data ?? [];
}

/** 发布公告（管理员，走云函数） */
export async function createAnnouncement(title: string, content: string): Promise<Announcement> {
  await assertAdmin();
  return await callCloudFunction<Announcement>(
    "manage-announcements",
    { action: "create", title, content },
    "发布失败",
  );
}

/** 切换公告状态（管理员，走云函数） */
export async function toggleAnnouncement(id: string, active: boolean): Promise<void> {
  await assertAdmin();
  await callCloudFunction("manage-announcements", { action: "toggle", id, active });
}

/** 删除公告（管理员，走云函数） */
export async function deleteAnnouncement(id: string): Promise<void> {
  await assertAdmin();
  await callCloudFunction("manage-announcements", { action: "delete", id }, "删除失败");
}
