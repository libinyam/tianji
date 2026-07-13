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

const mockReputation = vi.hoisted(() => ({
  awardReputation: vi.fn().mockResolvedValue(undefined),
}));

const mockBan = vi.hoisted(() => ({
  checkCurrentUserBanned: vi.fn().mockResolvedValue(false),
}));

const mockSensitive = vi.hoisted(() => ({
  containsSensitiveWord: vi.fn(() => ({ found: false, words: [] })),
}));

vi.mock("@/lib/cloudbase", () => ({
  app: { database: () => mockDb },
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: { getState: () => ({ user: mockAuth.user }) },
}));

vi.mock("@/lib/reputation", () => ({
  awardReputation: mockReputation.awardReputation,
  REPUTATION_RULES: { createPost: 2, answerAccepted: 15 },
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

import { createPost, fetchPosts, deletePost, incrementViews } from "./posts";

describe("posts", () => {
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
    mockBan.checkCurrentUserBanned.mockResolvedValue(false);
    mockSensitive.containsSensitiveWord.mockReturnValue({
      found: false,
      words: [],
    });
    mockReputation.awardReputation.mockResolvedValue(undefined);
  });

  describe("createPost", () => {
    it("成功：返回包含新 id 的 Question 并写入文档", async () => {
      mockAuth.user = { uid: "test-uid", nickname: "Tester" };
      mockDb._chain.add.mockResolvedValue({ id: "new-post-id" });

      const result = await createPost({
        title: "标题",
        body: "正文内容",
        tags: ["t1"],
      });

      expect(result).not.toBeNull();
      expect(result?.id).toBe("new-post-id");
      expect(result?.title).toBe("标题");
      expect(result?.author).toBe("Tester");
      expect(result?.authorUid).toBe("test-uid");
      expect(result?.views).toBe(0);
      expect(result?.answers).toBe(0);
      expect(result?.category).toBe("academic");
      expect(mockDb._chain.add).toHaveBeenCalledTimes(1);
      expect(mockDb._chain.add).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "标题",
          body: "正文内容",
          author: "Tester",
          authorUid: "test-uid",
          views: 0,
          votes: 0,
          answersCount: 0,
          answerList: [],
          category: "academic",
        })
      );
      expect(mockReputation.awardReputation).toHaveBeenCalledWith(
        "createPost",
        "new-post-id"
      );
    });

    it("未登录：抛出'请先登录'且不写入数据库", async () => {
      mockAuth.user = null;

      await expect(
        createPost({ title: "标题", body: "正文", tags: [] })
      ).rejects.toThrow("请先登录");

      expect(mockDb._chain.add).not.toHaveBeenCalled();
      expect(mockReputation.awardReputation).not.toHaveBeenCalled();
    });

    it("标题为空：抛出校验错误且不写入数据库", async () => {
      mockAuth.user = { uid: "test-uid" };

      await expect(
        createPost({ title: "   ", body: "正文", tags: [] })
      ).rejects.toThrow("标题不能为空");

      expect(mockDb._chain.add).not.toHaveBeenCalled();
    });
  });

  describe("fetchPosts", () => {
    it("成功：将 PostDoc 转换为 Question 列表", async () => {
      mockDb._chain.get.mockResolvedValue({
        data: [
          {
            _id: "p1",
            title: "标题1",
            excerpt: "摘要",
            body: "正文",
            tags: ["t1"],
            author: "作者",
            authorUid: "u1",
            avatarColor: "#fff",
            views: 10,
            votes: 3,
            answersCount: 2,
            answerList: [],
            createdAt: "2024-01-01T00:00:00.000Z",
          },
        ],
      });

      const result = await fetchPosts();

      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe("p1");
      expect(result.data[0].title).toBe("标题1");
      expect(result.data[0].author).toBe("作者");
      expect(result.data[0].answers).toBe(2);
      expect(result.data[0].views).toBe(10);
      expect(result.data[0].votes).toBe(3);
      expect(result.data[0].category).toBe("academic");
      expect(mockDb.collection).toHaveBeenCalledWith("posts");
    });

    it("空数据：返回空数组且无错误", async () => {
      mockDb._chain.get.mockResolvedValue({ data: [] });

      const result = await fetchPosts();

      expect(result.data).toEqual([]);
      expect(result.error).toBeNull();
    });

    it("请求失败：返回空数组与错误信息", async () => {
      mockDb._chain.get.mockRejectedValue(new Error("网络错误"));

      const result = await fetchPosts();

      expect(result.data).toEqual([]);
      expect(result.error).toBe("网络错误");
      expect(result.hasMore).toBe(false);
    });

    it("分页：返回满页时 hasMore 为 true", async () => {
      const docs = Array.from({ length: 20 }, (_, i) => ({
        _id: `p${i}`,
        title: `帖子${i}`,
        excerpt: "",
        body: "",
        tags: [],
        author: "u",
        authorUid: "u1",
        avatarColor: "#fff",
        views: 0,
        votes: 0,
        answersCount: 0,
        answerList: [],
        createdAt: "2024-01-01T00:00:00.000Z",
      }));
      mockDb._chain.get.mockResolvedValue({ data: docs });

      const result = await fetchPosts();

      expect(result.data).toHaveLength(20);
      expect(result.hasMore).toBe(true);
    });

    it("分页：返回不足一页时 hasMore 为 false", async () => {
      const docs = Array.from({ length: 5 }, (_, i) => ({
        _id: `p${i}`,
        title: `帖子${i}`,
        excerpt: "",
        body: "",
        tags: [],
        author: "u",
        authorUid: "u1",
        avatarColor: "#fff",
        views: 0,
        votes: 0,
        answersCount: 0,
        answerList: [],
        createdAt: "2024-01-01T00:00:00.000Z",
      }));
      mockDb._chain.get.mockResolvedValue({ data: docs });

      const result = await fetchPosts();

      expect(result.data).toHaveLength(5);
      expect(result.hasMore).toBe(false);
    });

    it("分页：传入 offset 调用 skip", async () => {
      mockDb._chain.get.mockResolvedValue({ data: [] });

      await fetchPosts("academic", undefined, 40);

      expect(mockDb._chain.skip).toHaveBeenCalledWith(40);
    });
  });

  describe("deletePost", () => {
    it("成功：作者删除自己的帖子返回 true", async () => {
      mockAuth.user = { uid: "test-uid" };
      mockDb._docRef.get.mockResolvedValue({
        data: [{ _id: "p1", authorUid: "test-uid", title: "x" }],
      });

      const result = await deletePost("p1");

      expect(result).toBe(true);
      expect(mockDb._docRef.remove).toHaveBeenCalledTimes(1);
    });

    it("帖子不存在：返回 false 且不调用 remove", async () => {
      mockAuth.user = { uid: "test-uid" };
      mockDb._docRef.get.mockResolvedValue({ data: [] });

      const result = await deletePost("missing");

      expect(result).toBe(false);
      expect(mockDb._docRef.remove).not.toHaveBeenCalled();
    });

    it("非作者：抛出'无权删除他人帖子'", async () => {
      mockAuth.user = { uid: "test-uid" };
      mockDb._docRef.get.mockResolvedValue({
        data: [{ _id: "p1", authorUid: "other-uid", title: "x" }],
      });

      await expect(deletePost("p1")).rejects.toThrow("无权删除他人帖子");
      expect(mockDb._docRef.remove).not.toHaveBeenCalled();
    });
  });

  describe("incrementViews", () => {
    it("调用 doc.update 并使用 command.inc(1)", async () => {
      await incrementViews("p1");

      expect(mockDb.command.inc).toHaveBeenCalledWith(1);
      expect(mockDb._docRef.update).toHaveBeenCalledWith({
        views: { __inc: 1 },
      });
    });
  });
});
