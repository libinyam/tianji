import { describe, it, expect, vi, beforeEach } from "vitest";

// #311 stats.ts 公开统计函数测试

const mockDb = vi.hoisted(() => {
  const counts: Record<string, number> = {};
  return {
    collection: vi.fn((name: string) => ({
      count: vi.fn(async () => ({ total: counts[name] ?? 0 })),
    })),
    _counts: counts,
    _reset: () => {
      for (const k of Object.keys(counts)) delete counts[k];
    },
  };
});

vi.mock("@/lib/cloudbase", () => ({
  app: { database: () => mockDb },
  authReady: Promise.resolve(),
}));

import { fetchPublicStats } from "./stats";

describe("stats 公开统计（#311）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb._reset();
  });

  it("成功：返回 4 个集合的 count", async () => {
    mockDb._counts.posts = 42;
    mockDb._counts.ideas = 15;
    mockDb._counts.books = 8;
    mockDb._counts.workshops = 3;

    const result = await fetchPublicStats();

    expect(result).toEqual({
      posts: 42,
      ideas: 15,
      books: 8,
      workshops: 3,
    });
  });

  it("空数据库：全部返回 0", async () => {
    const result = await fetchPublicStats();
    expect(result).toEqual({
      posts: 0,
      ideas: 0,
      books: 0,
      workshops: 0,
    });
  });

  it("单个集合查询失败：返回 0 不抛错", async () => {
    mockDb.collection.mockImplementation((name: string) => {
      if (name === "ideas") {
        return {
          count: vi.fn().mockRejectedValue(new Error("permission denied")),
        };
      }
      return {
        count: vi.fn(async () => ({ total: 10 })),
      };
    });

    const result = await fetchPublicStats();

    expect(result.posts).toBe(10);
    expect(result.ideas).toBe(0);
    expect(result.books).toBe(10);
    expect(result.workshops).toBe(10);
  });

  it("查询了 4 个公开集合", async () => {
    await fetchPublicStats();
    expect(mockDb.collection).toHaveBeenCalledWith("posts");
    expect(mockDb.collection).toHaveBeenCalledWith("ideas");
    expect(mockDb.collection).toHaveBeenCalledWith("books");
    expect(mockDb.collection).toHaveBeenCalledWith("workshops");
    expect(mockDb.collection).toHaveBeenCalledTimes(4);
  });
});
