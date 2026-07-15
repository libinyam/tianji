import { app } from "@/lib/cloudbase";
import { useAuthStore } from "@/stores/auth";
import { getCurrentUid } from "@/lib/current-user";
import { sanitizeInput } from "@/lib/sanitize";
import { checkCurrentUserBanned } from "@/lib/ban";
import { createNotification } from "@/lib/notifications";

const db = app.database();
const FOLLOWS_COLLECTION = "follows";
const TAG_FOLLOWS_COLLECTION = "tag_follows";

// ===== 用户关注 =====

export interface FollowDoc {
  _id?: string;
  uid: string;          // 关注者
  targetUid: string;    // 被关注者
  nickname: string;     // 被关注者昵称快照（避免反查 posts/ideas）
  avatarUrl: string;    // 被关注者头像快照
  createdAt: string;
}

export interface FollowItem {
  id: string;
  uid: string;
  nickname: string;
  avatarUrl: string;
  createdAt: string;
}

function toFollow(doc: FollowDoc): FollowItem {
  return {
    id: doc._id ?? "",
    uid: doc.targetUid,
    nickname: doc.nickname,
    avatarUrl: doc.avatarUrl,
    createdAt: doc.createdAt,
  };
}

function toFollower(doc: FollowDoc): FollowItem {
  return {
    id: doc._id ?? "",
    uid: doc.uid,
    nickname: doc.nickname,
    avatarUrl: doc.avatarUrl,
    createdAt: doc.createdAt,
  };
}

function getCurrentUser() {
  return useAuthStore.getState().user;
}

/** 关注 / 取消关注用户（toggle），返回新的关注状态 */
export async function toggleFollow(params: {
  targetUid: string;
  targetNickname: string;
  targetAvatarUrl?: string;
}): Promise<boolean> {
  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");
  if (uid === params.targetUid) throw new Error("不能关注自己");

  const banStatus = await checkCurrentUserBanned();
  if (banStatus) throw new Error("您的账号已被封禁");

  const col = db.collection(FOLLOWS_COLLECTION);

  // 查询是否已关注
  const { data: existing } = await col
    .where({ uid, targetUid: params.targetUid })
    .get();
  const list = existing ?? [];

  if (list.length > 0) {
    // 已关注 -> 取消
    const docId = (list[0] as FollowDoc)._id;
    if (!docId) throw new Error("无法获取关注记录ID");
    await col.doc(docId).remove();
    return false;
  }

  // 未关注 -> 添加
  const doc: Omit<FollowDoc, "_id"> = {
    uid,
    targetUid: params.targetUid,
    nickname: sanitizeInput(params.targetNickname, 100),
    avatarUrl: params.targetAvatarUrl ?? "",
    createdAt: new Date().toISOString(),
  };
  const addRes = await col.add(doc);
  const addResult = addRes as { id?: string; _id?: string };
  if (!addResult.id && !addResult._id) {
    throw new Error("关注失败，可能是权限不足");
  }

  // 触发通知（不阻塞主流程）
  const currentUser = getCurrentUser();
  const actorName = currentUser?.nickname || currentUser?.username || "匿名用户";
  createNotification({
    uid: params.targetUid,
    type: "follow",
    title: `${actorName} 关注了你`,
    link: `/user/${uid}`,
  }).catch(() => {});

  return true;
}

/** 查询当前用户是否已关注某用户 */
export async function isFollowing(targetUid: string): Promise<boolean> {
  const uid = getCurrentUid();
  if (!uid) return false;
  try {
    const { data } = await db
      .collection(FOLLOWS_COLLECTION)
      .where({ uid, targetUid })
      .get();
    return (data ?? []).length > 0;
  } catch {
    return false;
  }
}

/** 获取某用户的关注列表（他关注了谁） */
export async function fetchFollowing(uid: string, limit = 100): Promise<FollowItem[]> {
  try {
    const { data } = await db
      .collection(FOLLOWS_COLLECTION)
      .where({ uid })
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    return ((data as FollowDoc[]) ?? []).map(toFollow);
  } catch {
    return [];
  }
}

/** 获取某用户的粉丝列表（谁关注了他） */
export async function fetchFollowers(uid: string, limit = 100): Promise<FollowItem[]> {
  try {
    const { data } = await db
      .collection(FOLLOWS_COLLECTION)
      .where({ targetUid: uid })
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    return ((data as FollowDoc[]) ?? []).map(toFollower);
  } catch {
    return [];
  }
}

/** 获取某用户的关注数 */
export async function fetchFollowingCount(uid: string): Promise<number> {
  try {
    const { total } = await db
      .collection(FOLLOWS_COLLECTION)
      .where({ uid })
      .count();
    return total ?? 0;
  } catch {
    return 0;
  }
}

/** 获取某用户的粉丝数 */
export async function fetchFollowersCount(uid: string): Promise<number> {
  try {
    const { total } = await db
      .collection(FOLLOWS_COLLECTION)
      .where({ targetUid: uid })
      .count();
    return total ?? 0;
  } catch {
    return 0;
  }
}

/** 获取当前用户关注的所有 uid（用于个性化 Feed 查询） */
export async function fetchFollowingUids(uid: string): Promise<string[]> {
  try {
    const { data } = await db
      .collection(FOLLOWS_COLLECTION)
      .where({ uid })
      .field({ targetUid: true })
      .limit(500)
      .get();
    return ((data as { targetUid: string }[]) ?? []).map((d) => d.targetUid);
  } catch {
    return [];
  }
}

// ===== 标签关注 =====

export interface TagFollowDoc {
  _id?: string;
  uid: string;
  tagName: string;
  createdAt: string;
}

/** 关注 / 取消关注标签（toggle），返回新的关注状态 */
export async function toggleTagFollow(tagName: string): Promise<boolean> {
  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");

  const banStatus = await checkCurrentUserBanned();
  if (banStatus) throw new Error("您的账号已被封禁");

  const col = db.collection(TAG_FOLLOWS_COLLECTION);

  const { data: existing } = await col
    .where({ uid, tagName })
    .get();
  const list = existing ?? [];

  if (list.length > 0) {
    const docId = (list[0] as TagFollowDoc)._id;
    if (!docId) throw new Error("无法获取标签关注记录ID");
    await col.doc(docId).remove();
    return false;
  }

  const doc: Omit<TagFollowDoc, "_id"> = {
    uid,
    tagName,
    createdAt: new Date().toISOString(),
  };
  const addRes = await col.add(doc);
  const addResult = addRes as { id?: string; _id?: string };
  if (!addResult.id && !addResult._id) {
    throw new Error("关注标签失败，可能是权限不足");
  }
  return true;
}

/** 查询当前用户是否已关注某标签 */
export async function isTagFollowing(tagName: string): Promise<boolean> {
  const uid = getCurrentUid();
  if (!uid) return false;
  try {
    const { data } = await db
      .collection(TAG_FOLLOWS_COLLECTION)
      .where({ uid, tagName })
      .get();
    return (data ?? []).length > 0;
  } catch {
    return false;
  }
}

/** 获取当前用户关注的所有标签 */
export async function fetchFollowedTags(uid?: string): Promise<string[]> {
  const targetUid = uid ?? getCurrentUid();
  if (!targetUid) return [];
  try {
    const { data } = await db
      .collection(TAG_FOLLOWS_COLLECTION)
      .where({ uid: targetUid })
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();
    return ((data as TagFollowDoc[]) ?? []).map((d) => d.tagName);
  } catch {
    return [];
  }
}
