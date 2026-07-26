import { authReady, callAction } from "@/lib/cloudbase";

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
    const data = await callAction<{ entries?: LeaderboardEntry[] } | undefined>(
      "getLeaderboard",
      {},
      "加载失败",
    );
    return { entries: data?.entries ?? [], error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "加载失败";
    return { entries: [], error: msg };
  }
}
