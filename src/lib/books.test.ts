import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = vi.hoisted(() => {
  const chain = {
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    get: vi.fn(),
    add: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };
  const docRef = {
    get: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };
  return {
    collection: vi.fn(() => ({
      ...chain,
      doc: vi.fn(() => docRef),
    })),
    command: {
      inc: vi.fn(() => ({ __inc: 1 })),
      in: vi.fn(() => ({ __in: true })),
      push: vi.fn(() => ({ __push: true })),
    },
    _chain: chain,
    _docRef: docRef,
  };
});

const mockAuth = vi.hoisted(() => ({
  user: null as null | {
    uid: string;
    nickname?: string;
    username?: string;
    email?: string;
  },
}));

const mockCloudAuth = vi.hoisted(() => ({
  signInAnonymously: vi.fn().mockResolvedValue(undefined),
}));

const mockCallFunction = vi.hoisted(() => vi.fn());

const mockReputation = vi.hoisted(() => ({
  awardReputation: vi.fn().mockResolvedValue(undefined),
}));

const mockBan = vi.hoisted(() => ({
  checkCurrentUserBanned: vi.fn().mockResolvedValue(false),
}));

const mockSensitive = vi.hoisted(() => ({
  containsSensitiveWord: vi.fn<(text: string) => { found: boolean; words: string[] }>(
    () => ({ found: false, words: [] })
  ),
}));

const mockTags = vi.hoisted(() => ({
  ensureTags: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/cloudbase", () => ({
  app: {
    database: () => mockDb,
    callFunction: mockCallFunction,
  },
  auth: {
    signInAnonymously: mockCloudAuth.signInAnonymously,
  },
  authReady: Promise.resolve(),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: { getState: () => ({ user: mockAuth.user }) },
}));

vi.mock("@/lib/reputation", () => ({
  awardReputation: mockReputation.awardReputation,
}));

vi.mock("@/lib/sanitize", () => ({
  sanitizeInput: (text: string) => text,
  sanitizeTitle: (title: string) => {
    if (!title || !title.trim()) throw new Error("标题不能为空");
    return title;
  },
  sanitizeTag: (tag: string) => tag,
}));

vi.mock("@/lib/ban", () => ({
  checkCurrentUserBanned: mockBan.checkCurrentUserBanned,
}));

vi.mock("@/lib/sensitive-words", () => ({
  containsSensitiveWord: mockSensitive.containsSensitiveWord,
}));

vi.mock("@/lib/tags", () => ({
  ensureTags: mockTags.ensureTags,
}));

import {
  fetchBooks,
  fetchBookById,
  createBook,
  incrementBookDownloads,
  addReview,
} from "./books";

const bookDoc = {
  _id: "b1",
  title: "测试书籍",
  author: "Test Author",
  category: "AI工具实战" as const,
  difficulty: 3 as 1 | 2 | 3 | 4 | 5,
  tags: ["AI"],
  accent: "#7cc4ff",
  summary: "测试摘要",
  favorites: 5,
  downloads: 10,
  rating: 0,
  year: 2024,
  pages: 200,
  toc: ["第一章"],
  reviews: [
    { author: "Reader1", authorUid: "u1", rating: 4, content: "good", date: "2024-01-01" },
    { author: "Reader2", authorUid: "u2", rating: 5, content: "great", date: "2024-01-02" },
  ],
  authorUid: "test-uid",
  createdAt: "2024-01-01T00:00:00.000Z",
};

describe("books", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.user = null;
    mockDb._chain.get.mockResolvedValue({ data: [] });
    mockDb._chain.add.mockResolvedValue({ id: "" });
    mockDb._chain.update.mockResolvedValue(undefined);
    mockDb._chain.remove.mockResolvedValue(undefined);
    mockDb._docRef.get.mockResolvedValue({ data: [] });
    mockDb._docRef.update.mockResolvedValue(undefined);
    mockDb._docRef.remove.mockResolvedValue(undefined);
    mockCloudAuth.signInAnonymously.mockResolvedValue(undefined);
    mockCallFunction.mockResolvedValue({ result: { ok: true, data: null } });
    mockBan.checkCurrentUserBanned.mockResolvedValue(false);
    mockSensitive.containsSensitiveWord.mockReturnValue({ found: false, words: [] });
    mockReputation.awardReputation.mockResolvedValue(undefined);
    mockTags.ensureTags.mockResolvedValue(undefined);
  });

  describe("fetchBooks", () => {
    it("成功：将 BookDoc 转换为 Book 列表并按 reviews 实时计算评分", async () => {
      mockDb._chain.get.mockResolvedValue({ data: [bookDoc] });

      const result = await fetchBooks();

      expect(result.error).toBe(false);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe("b1");
      expect(result.data[0].title).toBe("测试书籍");
      expect(result.data[0].author).toBe("Test Author");
      expect(result.data[0].rating).toBe(4.5);
      expect(result.data[0].reviews).toHaveLength(2);
      expect(result.data[0].favorites).toBe(5);
      expect(mockDb.collection).toHaveBeenCalledWith("books");
      expect(mockDb._chain.orderBy).toHaveBeenCalledWith("createdAt", "desc");
      expect(mockDb._chain.limit).toHaveBeenCalledWith(100);
      expect(mockCloudAuth.signInAnonymously).not.toHaveBeenCalled();
    });

    it("空数据：返回空数组且无错误", async () => {
      mockDb._chain.get.mockResolvedValue({ data: [] });

      const result = await fetchBooks();

      expect(result.data).toEqual([]);
      expect(result.error).toBe(false);
    });

    it("请求失败且重试也失败：返回空数组与错误标记", async () => {
      mockDb._chain.get.mockRejectedValue(new Error("网络错误"));

      const result = await fetchBooks();

      expect(result.data).toEqual([]);
      expect(result.error).toBe(true);
      expect(mockCloudAuth.signInAnonymously).toHaveBeenCalled();
    });

    it("首次失败后刷新登录态重试成功：返回数据且无错误", async () => {
      mockDb._chain.get
        .mockRejectedValueOnce(new Error("token expired"))
        .mockResolvedValueOnce({ data: [bookDoc] });

      const result = await fetchBooks();

      expect(result.error).toBe(false);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe("b1");
      expect(mockCloudAuth.signInAnonymously).toHaveBeenCalled();
    });
  });

  describe("fetchBookById", () => {
    it("找到：返回转换后的 Book", async () => {
      mockDb._docRef.get.mockResolvedValue({ data: [bookDoc] });

      const result = await fetchBookById("b1");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("b1");
      expect(result?.title).toBe("测试书籍");
      expect(result?.rating).toBe(4.5);
      expect(result?.reviews).toHaveLength(2);
      expect(mockDb.collection).toHaveBeenCalledWith("books");
    });

    it("未找到：返回 null", async () => {
      mockDb._docRef.get.mockResolvedValue({ data: [] });

      const result = await fetchBookById("missing");

      expect(result).toBeNull();
    });

    it("请求异常：返回 null", async () => {
      mockDb._docRef.get.mockRejectedValue(new Error("db error"));

      const result = await fetchBookById("b1");

      expect(result).toBeNull();
    });
  });

  describe("createBook", () => {
    it("成功：写入文档并返回新 Book，同时登记标签与声望", async () => {
      mockAuth.user = { uid: "test-uid", nickname: "Tester" };
      mockDb._chain.add.mockResolvedValue({ id: "new-book-id" });

      const result = await createBook({
        title: "新书",
        author: "Author",
        category: "AI工具实战",
        difficulty: 3,
        tags: ["AI", "工具"],
        summary: "摘要内容",
        link: "https://example.com",
        fileUrl: "https://example.com/file.pdf",
        fileName: "file.pdf",
        toc: ["目录1"],
      });

      expect(result).not.toBeNull();
      expect(result?.id).toBe("new-book-id");
      expect(result?.title).toBe("新书");
      expect(result?.author).toBe("Author");
      expect(result?.category).toBe("AI工具实战");
      expect(result?.difficulty).toBe(3);
      expect(result?.tags).toEqual(["AI", "工具"]);
      expect(result?.favorites).toBe(0);
      expect(result?.rating).toBe(0);
      expect(result?.pages).toBe(0);
      expect(result?.reviews).toEqual([]);
      expect(result?.link).toBe("https://example.com");
      expect(result?.fileUrl).toBe("https://example.com/file.pdf");
      expect(result?.fileName).toBe("file.pdf");
      expect(mockDb._chain.add).toHaveBeenCalledTimes(1);
      expect(mockDb._chain.add).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "新书",
          author: "Author",
          category: "AI工具实战",
          difficulty: 3,
          tags: ["AI", "工具"],
          summary: "摘要内容",
          favorites: 0,
          downloads: 0,
          rating: 0,
          reviews: [],
          authorUid: "test-uid",
          link: "https://example.com",
          fileUrl: "https://example.com/file.pdf",
          fileName: "file.pdf",
          toc: ["目录1"],
          accent: expect.any(String),
          year: expect.any(Number),
          createdAt: expect.any(String),
        })
      );
      expect(mockTags.ensureTags).toHaveBeenCalledWith(["AI", "工具"]);
      expect(mockReputation.awardReputation).toHaveBeenCalledWith("createBook", "new-book-id");
    });

    it("未登录：抛出'请先登录'且不写入数据库", async () => {
      mockAuth.user = null;

      await expect(
        createBook({
          title: "新书",
          author: "Author",
          category: "AI工具实战",
          difficulty: 3,
          tags: [],
          summary: "摘要",
        })
      ).rejects.toThrow("请先登录");

      expect(mockDb._chain.add).not.toHaveBeenCalled();
      expect(mockTags.ensureTags).not.toHaveBeenCalled();
      expect(mockReputation.awardReputation).not.toHaveBeenCalled();
    });

    it("账号已封禁：抛出错误且不写入数据库", async () => {
      mockAuth.user = { uid: "test-uid" };
      mockBan.checkCurrentUserBanned.mockResolvedValue(true);

      await expect(
        createBook({
          title: "新书",
          author: "Author",
          category: "AI工具实战",
          difficulty: 3,
          tags: [],
          summary: "摘要",
        })
      ).rejects.toThrow("您的账号已被封禁");

      expect(mockDb._chain.add).not.toHaveBeenCalled();
    });

    it("包含敏感词：抛出错误且不写入数据库", async () => {
      mockAuth.user = { uid: "test-uid" };
      mockSensitive.containsSensitiveWord.mockReturnValue({
        found: true,
        words: ["敏感词"],
      });

      await expect(
        createBook({
          title: "新书",
          author: "Author",
          category: "AI工具实战",
          difficulty: 3,
          tags: [],
          summary: "包含敏感词的内容",
        })
      ).rejects.toThrow("内容包含敏感词: 敏感词");

      expect(mockDb._chain.add).not.toHaveBeenCalled();
    });
  });

  describe("incrementBookDownloads", () => {
    it("成功：调用 content-actions 云函数并传入 bookId", async () => {
      await incrementBookDownloads("b1");

      expect(mockCallFunction).toHaveBeenCalledWith({
        name: "content-actions",
        data: { action: "incrementBookDownloads", bookId: "b1" },
      });
    });

    it("云函数异常：静默吞掉错误不抛出", async () => {
      mockCallFunction.mockRejectedValue(new Error("函数调用失败"));

      await expect(incrementBookDownloads("b1")).resolves.toBeUndefined();
    });
  });

  describe("addReview", () => {
    it("成功：返回平均评分与更新标记", async () => {
      mockCallFunction.mockResolvedValue({
        result: { ok: true, data: { avgRating: 4.5, updated: true } },
      });

      const result = await addReview("b1", {
        author: "Reader",
        authorUid: "u1",
        rating: 5,
        content: "很好",
      });

      expect(result).toEqual({ avgRating: 4.5, updated: true });
      expect(mockCallFunction).toHaveBeenCalledWith({
        name: "content-actions",
        data: {
          action: "addBookReview",
          bookId: "b1",
          author: "Reader",
          authorUid: "u1",
          rating: 5,
          content: "很好",
        },
      });
    });

    it("云函数返回 ok=false：抛出错误", async () => {
      mockCallFunction.mockResolvedValue({
        result: { ok: false, error: "已封禁不能评价" },
      });

      await expect(
        addReview("b1", {
          author: "Reader",
          authorUid: "u1",
          rating: 5,
          content: "很好",
        })
      ).rejects.toThrow("已封禁不能评价");
    });
  });
});
