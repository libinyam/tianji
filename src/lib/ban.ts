import { app } from "@/lib/cloudbase";
import { useAuthStore } from "@/stores/auth";

const db = app.database();

export interface BanStatus {
  banned: boolean;
  bannedReason?: string;
  bannedUntil?: string;
}

export async function checkBanStatus(uid: string): Promise<BanStatus> {
  try {
    const { data } = await db.collection("users_v2").doc(uid).get();
    if (!data || data.length === 0) return { banned: false };
    const user = data[0] as BanStatus & { _id: string };
    if (!user.banned) return { banned: false };
    if (user.bannedUntil) {
      const until = new Date(user.bannedUntil).getTime();
      if (Date.now() > until) return { banned: false };
    }
    return {
      banned: true,
      bannedReason: user.bannedReason,
      bannedUntil: user.bannedUntil,
    };
  } catch {
    // #313 fail-closed：DB 异常时视为封禁，避免被封禁用户因数据库故障绕过封禁发帖
    return { banned: true, bannedReason: "数据库异常，临时拒绝操作，请稍后重试" };
  }
}

export async function checkCurrentUserBanned(): Promise<boolean> {
  const uid = useAuthStore.getState().user?.uid;
  if (!uid) return false;
  const status = await checkBanStatus(uid);
  return status.banned;
}

export async function banUser(uid: string, reason: string, days?: number): Promise<void> {
  await app.callFunction({
    name: "user-admin",
    data: { action: "banUser", uid, reason, days },
  });
}

export async function unbanUser(uid: string): Promise<void> {
  await app.callFunction({
    name: "user-admin",
    data: { action: "unbanUser", uid },
  });
}
