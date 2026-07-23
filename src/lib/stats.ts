import { app, authReady } from "@/lib/cloudbase";

/**
 * #311 公开统计数据：用于 About 页"天玑成长数据"展示
 * 只查询公开集合的 count，不暴露敏感数据
 * 失败时返回 0，不抛错，确保页面不崩溃
 */
export interface PublicStats {
  posts: number;
  ideas: number;
  books: number;
  workshops: number;
}

export async function fetchPublicStats(): Promise<PublicStats> {
  const db = app.database();
  await authReady;

  const collections: (keyof PublicStats)[] = ["posts", "ideas", "books", "workshops"];
  const entries = await Promise.all(
    collections.map(async (name) => {
      try {
        const { total } = await db.collection(name).count();
        return [name, total] as const;
      } catch {
        return [name, 0] as const;
      }
    }),
  );

  return Object.fromEntries(entries) as unknown as PublicStats;
}
