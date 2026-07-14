import { app } from "@/lib/cloudbase";
import { useAuthStore } from "@/stores/auth";

const db = app.database();
const COLLECTION = "notifications";

export type NotificationType =
  | "answer"    // 有人回答了你的帖子
  | "comment"   // 有人回复了你的回答
  | "resonance" // 有人共鸣了你的灵感
  | "join"      // 有人加入了你的协作
  | "contribute" // 有人提交了协作贡献
  | "accept"   // 你的回答被采纳
  | "follow";  // 有人关注了你 (#149)

export interface NotificationDoc {
  _id?: string;
  uid: string;          // 接收者 uid
  actor: string;        // 触发者名称
  actorUid: string;     // 触发者 uid
  type: NotificationType;
  title: string;        // 相关内容标题
  link: string;         // 跳转链接
  read: boolean;        // 是否已读
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  actor: string;
  type: NotificationType;
  title: string;
  link: string;
  read: boolean;
  createdAt: string;
}

const TYPE_LABEL: Record<NotificationType, string> = {
  answer: "回答了你的帖子",
  comment: "回复了你的回答",
  resonance: "共鸣了你的灵感",
  join: "加入了你的协作",
  contribute: "提交了协作贡献",
  accept: "采纳了你的回答",
  follow: "关注了你",
};

export function getTypeLabel(type: NotificationType): string {
  return TYPE_LABEL[type] ?? "有新动态";
}

function toNotif(doc: NotificationDoc): NotificationItem {
  return {
    id: doc._id ?? "",
    actor: doc.actor,
    type: doc.type,
    title: doc.title,
    link: doc.link,
    read: doc.read ?? false,
    createdAt: doc.createdAt,
  };
}

function getCurrentUid(): string {
  return useAuthStore.getState().user?.uid ?? "";
}

function getCurrentUserName(): string {
  const user = useAuthStore.getState().user;
  return user?.nickname || user?.username || user?.email || "匿名用户";
}

/** 创建通知（供其他模块调用） */
export async function createNotification(params: {
  uid: string;          // 接收者
  type: NotificationType;
  title: string;
  link: string;
}): Promise<void> {
  const actorUid = getCurrentUid();
  // 不通知自己
  if (actorUid === params.uid) return;

  const doc: Omit<NotificationDoc, "_id"> = {
    uid: params.uid,
    actor: getCurrentUserName(),
    actorUid,
    type: params.type,
    title: params.title,
    link: params.link,
    read: false,
    createdAt: new Date().toISOString(),
  };
  try {
    await db.collection(COLLECTION).add(doc);
  } catch {
    // 静默失败，通知不影响核心流程
  }
}

/** 获取当前用户的通知列表 */
export async function fetchNotifications(): Promise<NotificationItem[]> {
  const uid = getCurrentUid();
  if (!uid) return [];
  try {
    const { data } = await db
      .collection(COLLECTION)
      .where({ uid })
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();
    return ((data as NotificationDoc[]) ?? []).map(toNotif);
  } catch {
    return [];
  }
}

/** 获取未读通知数量 */
export async function fetchUnreadCount(): Promise<number> {
  const uid = getCurrentUid();
  if (!uid) return 0;
  try {
    const { data } = await db
      .collection(COLLECTION)
      .where({ uid, read: false })
      .get();
    return (data ?? []).length;
  } catch {
    return 0;
  }
}

/** 标记单条通知为已读 */
export async function markAsRead(id: string): Promise<void> {
  const uid = getCurrentUid();
  if (!uid) return;
  try {
    // 使用 where 条件更新，将 uid 纳入查询以便安全规则验证
    await db.collection(COLLECTION).where({ _id: id, uid }).update({ read: true });
  } catch (e) {
    console.warn("[notifications] markAsRead failed:", e);
  }
}

/** 标记全部已读 */
export async function markAllRead(): Promise<void> {
  const uid = getCurrentUid();
  if (!uid) return;
  try {
    await db.collection(COLLECTION).where({ uid, read: false }).update({ read: true });
  } catch (e) {
    console.warn("[notifications] markAllRead failed:", e);
  }
}

export function watchNotifications(
  uid: string,
  onChange: (docs: unknown[]) => void,
  onError: (err: Error) => void,
): { close: () => void } {
  const watcher = db
    .collection(COLLECTION)
    .where({ uid })
    .watch({
      onChange: (snapshot) => onChange(Object.values(snapshot.docs ?? {})),
      onError,
    });
  return {
    close: () => {
      watcher?.close?.();
    },
  };
}
