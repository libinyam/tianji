import { app } from "@/lib/cloudbase";
import { useAuthStore } from "@/stores/auth";

const db = app.database();

export interface ReputationInfo {
  reputation: number;
  level: number;
  levelName: string;
  badgeCount: number;
}

export const LEVEL_NAMES = ["初学者", "探索者", "引路人", "智者", "北辰"];

export const REPUTATION_RULES = {
  createPost: 2,
  createAnswer: 5,
  answerAccepted: 15,
  answerVoted: 10,
  bookFavorited: 3,
  ideaResonated: 1,
};

export function calculateLevel(reputation: number): { level: number; levelName: string } {
  if (reputation >= 1000) return { level: 5, levelName: LEVEL_NAMES[4] };
  if (reputation >= 500) return { level: 4, levelName: LEVEL_NAMES[3] };
  if (reputation >= 200) return { level: 3, levelName: LEVEL_NAMES[2] };
  if (reputation >= 50) return { level: 2, levelName: LEVEL_NAMES[1] };
  return { level: 1, levelName: LEVEL_NAMES[0] };
}

export async function fetchReputation(uid: string): Promise<ReputationInfo> {
  try {
    const { data } = await db.collection("users_v2").doc(uid).get();
    if (!data || data.length === 0) {
      return { reputation: 0, level: 1, levelName: LEVEL_NAMES[0], badgeCount: 0 };
    }
    const user = data[0] as { reputation?: number; badges?: string[] };
    const reputation = user.reputation ?? 0;
    const { level, levelName } = calculateLevel(reputation);
    return {
      reputation,
      level,
      levelName,
      badgeCount: user.badges?.length ?? 0,
    };
  } catch {
    return { reputation: 0, level: 1, levelName: LEVEL_NAMES[0], badgeCount: 0 };
  }
}

/** 原子化增加声望值，避免并发读写丢失更新 */
export async function awardReputation(uid: string, points: number): Promise<void> {
  const _ = db.command;
  try {
    await db.collection("users_v2").doc(uid).update({
      reputation: _.inc(points),
    });
  } catch {
    // 用户文档不存在时静默忽略（新用户首次操作前可能尚未创建 users_v2 文档）
  }
}

export async function checkReputationThreshold(uid: string, minLevel: number): Promise<boolean> {
  const info = await fetchReputation(uid);
  return info.level >= minLevel;
}

export async function getCurrentUserReputation(): Promise<ReputationInfo> {
  const uid = useAuthStore.getState().user?.uid;
  if (!uid) return { reputation: 0, level: 1, levelName: LEVEL_NAMES[0], badgeCount: 0 };
  return fetchReputation(uid);
}

export function getBadges(reputation: number): string[] {
  const badges: string[] = [];
  if (reputation >= 50) badges.push("贡献者");
  if (reputation >= 200) badges.push("解答者");
  if (reputation >= 500) badges.push("精选作者");
  if (reputation >= 1000) badges.push("灵感大师");
  return badges;
}
