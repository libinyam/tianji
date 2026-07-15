import { app } from "@/lib/cloudbase";
import { useAuthStore } from "@/stores/auth";
import { sanitizeInput } from "@/lib/sanitize";
import { checkCurrentUserBanned } from "@/lib/ban";

const db = app.database();
const COLLECTION = "favorites";

export type FavType = "post" | "idea" | "book";

export interface FavoriteDoc {
  _id?: string;
  uid: string;
  targetId: string;
  type: FavType;
  title: string;
  excerpt: string;
  link: string;
  createdAt: string;
}

export interface FavoriteItem {
  id: string;
  targetId: string;
  type: FavType;
  title: string;
  excerpt: string;
  link: string;
  createdAt: string;
}

function toFav(doc: FavoriteDoc): FavoriteItem {
  return {
    id: doc._id ?? "",
    targetId: doc.targetId,
    type: doc.type,
    title: doc.title,
    excerpt: doc.excerpt,
    link: doc.link,
    createdAt: doc.createdAt,
  };
}

function getCurrentUid(): string {
  return useAuthStore.getState().user?.uid ?? "";
}

/** 收藏 / 取消收藏（toggle），返回新的收藏状态 */
export async function toggleFavorite(params: {
  targetId: string;
  type: FavType;
  title: string;
  excerpt: string;
  link: string;
}): Promise<boolean> {
  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");

  const banStatus = await checkCurrentUserBanned();
  if (banStatus) throw new Error("您的账号已被封禁");

  const favCol = db.collection(COLLECTION);

  // 查询是否已收藏
  const { data: existing } = await favCol
    .where({ uid, targetId: params.targetId })
    .get();
  const list = existing ?? [];

  if (list.length > 0) {
    // 已收藏 -> 取消
    const docId = (list[0] as FavoriteDoc)._id;
    if (!docId) throw new Error("无法获取收藏记录ID");
    const res = await favCol.doc(docId).remove();
    // CloudBase 安全规则拦截时不会 throw，而是 deleted=0
    if (res.deleted === 0) {
      // #344 生产环境安全规则可能未及时部署，回退到云函数以 admin 权限删除
      const cfRes = await app.callFunction({
        name: "content-actions",
        data: { action: "removeFavorite", targetId: params.targetId },
      });
      const cfResult = (cfRes?.result ?? {}) as { ok?: boolean; error?: string };
      if (!cfResult.ok) throw new Error(cfResult.error || "取消收藏失败，可能是权限不足");
    }
    // 更新对应集合的 favorites 计数
    if (params.type === "book") {
      app.callFunction({ name: "content-actions", data: { action: "adjustBookFavorites", bookId: params.targetId, delta: -1 } }).catch(() => {});
    }
    return false;
  }

  // 未收藏 -> 添加
  const doc: Omit<FavoriteDoc, "_id"> = {
    uid,
    targetId: params.targetId,
    type: params.type,
    title: sanitizeInput(params.title, 200),
    excerpt: sanitizeInput(params.excerpt, 500),
    link: params.link,
    createdAt: new Date().toISOString(),
  };
  const addRes = await favCol.add(doc);
  const addResult = addRes as { id?: string; _id?: string };
  if (!addResult.id && !addResult._id) {
    throw new Error("收藏失败，可能是权限不足");
  }
  // 更新对应集合的 favorites 计数
  if (params.type === "book") {
    app.callFunction({ name: "content-actions", data: { action: "adjustBookFavorites", bookId: params.targetId, delta: 1 } }).catch(() => {});
  }
  return true;
}

/** 查询某个内容是否已被当前用户收藏 */
export async function isFavorited(targetId: string): Promise<boolean> {
  const uid = getCurrentUid();
  if (!uid) return false;
  try {
    const { data } = await db
      .collection(COLLECTION)
      .where({ uid, targetId })
      .get();
    return (data ?? []).length > 0;
  } catch {
    return false;
  }
}

/** 批量查询当前用户收藏了哪些 id */
export async function getFavoritedIds(targetIds: string[]): Promise<Set<string>> {
  const uid = getCurrentUid();
  if (!uid || targetIds.length === 0) return new Set();
  try {
    const { data } = await db
      .collection(COLLECTION)
      .where({ uid, targetId: db.command.in(targetIds) })
      .get();
    return new Set(((data as FavoriteDoc[]) ?? []).map((d) => d.targetId));
  } catch {
    return new Set();
  }
}

/** 获取当前用户的所有收藏 */
export async function fetchMyFavorites(): Promise<FavoriteItem[]> {
  const uid = getCurrentUid();
  if (!uid) return [];
  try {
    const { data } = await db
      .collection(COLLECTION)
      .where({ uid })
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();
    return ((data as FavoriteDoc[]) ?? []).map(toFav);
  } catch {
    return [];
  }
}
