import { app, authReady } from "@/lib/cloudbase";

// #172 声望排行榜:公开只读云函数 action,匿名可看

export interface LeaderboardEntry {
  uid: string;
  name: string;
  avatarColor: string;
  reputation: number;
}

export async function fetchLeaderboard(): Promise<{
  entries: LeaderboardEntry[];
  error: string | null;
}> {
  try {
    await authReady; // #345 等匿名身份就绪
    const res = await app.callFunction({
      name: "content-actions",
      data: { action: "getLeaderboard" },
    });
    const result = (res?.result ?? {}) as {
      ok?: boolean;
      error?: string;
      data?: { entries?: LeaderboardEntry[] };
    };
    if (!result.ok) return { entries: [], error: result.error || "加载失败" };
    return { entries: result.data?.entries ?? [], error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "加载失败";
    return { entries: [], error: msg };
  }
}
