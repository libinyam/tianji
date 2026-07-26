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
      pull: vi.fn(() => ({ __pull: true })),
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

const mockCallFunction = vi.hoisted(() => vi.fn());

const mockReputation = vi.hoisted(() => ({
  awardReputation: vi.fn().mockResolvedValue(undefined),
}));

const mockBan = vi.hoisted(() => ({
  checkCurrentUserBanned: vi.fn().mockResolvedValue(false),
}));

const mockSensitive = vi.hoisted(() => ({
  containsSensitiveWord: vi.fn(
    (): { found: boolean; words: string[] } => ({ found: false, words: [] })
  ),
}));

const mockNotifications = vi.hoisted(() => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/cloudbase", () => ({
  app: { database: () => mockDb, callFunction: mockCallFunction },
  authReady: Promise.resolve(),
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

vi.mock("@/lib/notifications", () => ({
  createNotification: mockNotifications.createNotification,
}));

import {
  fetchIdeas,
  fetchIdeaById,
  createIdea,
  resonanceIdea,
  updateIdea,
  addIdeaComment,
  deleteIdeaComment,
  deleteIdea,
} from "./ideas";

describe("ideas", () => {
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
    mockCallFunction.mockResolvedValue({ result: { ok: true } });
    mockBan.checkCurrentUserBanned.mockResolvedValue(false);
    mockSensitive.containsSensitiveWord.mockReturnValue({
      found: false,
      words: [],
    });
    mockReputation.awardReputation.mockResolvedValue(undefined);
    mockNotifications.createNotification.mockResolvedValue(undefined);
  });

  describe("fetchIdeas", () => {
    it("成功：将 IdeaDoc 转换为 Idea 列表", async () => {
      mockDb._chain.get.mockResolvedValue({
        data: [
          {
            _id: "i1",
            title: "灵感1",
            summary: "摘要",
            author: "作者",
            authorUid: "u1",
            avatarColor: "#fff",
            topic: "话题",
            tags: ["t1"],
            resonance: 5,
            replies: 2,
            createdAt: "2024-01-01T00:00:00.000Z",
            resonatedBy: ["u2"],
            comments: [],
          },
        ],
      });

      const result = await fetchIdeas();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("i1");
      expect(result[0].title).toBe("灵感1");
      expect(result[0].author).toBe("作者");
      expect(result[0].resonance).toBe(5);
      expect(result[0].replies).toBe(2);
      expect(result[0].tags).toEqual(["t1"]);
      expect(result[0].resonatedBy).toEqual(["u2"]);
      expect(mockDb.collection).toHaveBeenCalledWith("ideas");
      expect(mockDb._chain.orderBy).toHaveBeenCalledWith("createdAt", "desc");
      expect(mockDb._chain.limit).toHaveBeenCalledWith(100);
    });

    it("空数据：返回空数组", async () => {
      mockDb._chain.get.mockResolvedValue({ data: [] });

      const result = await fetchIdeas();

      expect(result).toEqual([]);
    });

    it("请求失败：返回空数组", async () => {
      mockDb._chain.get.mockRejectedValue(new Error("网络错误"));

      const result = await fetchIdeas();

      expect(result).toEqual([]);
    });

    it("缺失字段：使用默认值填充", async () => {
      mockDb._chain.get.mockResolvedValue({
        data: [
          {
            _id: "i2",
            title: "灵感2",
            summary: "摘要2",
            author: "作者2",
            authorUid: "u2",
            avatarColor: "#000",
            topic: "话题2",
            createdAt: "2024-02-01T00:00:00.000Z",
          },
        ],
      });

      const result = await fetchIdeas();

      expect(result).toHaveLength(1);
      expect(result[0].resonance).toBe(0);
      expect(result[0].replies).toBe(0);
      expect(result[0].tags).toEqual([]);
      expect(result[0].comments).toEqual([]);
      expect(result[0].resonatedBy).toEqual([]);
    });
  });

  describe("fetchIdeaById", () => {
    it("成功：返回单个 Idea", async () => {
      mockDb._docRef.get.mockResolvedValue({
        data: [
          {
            _id: "i1",
            title: "灵感",
            summary: "摘要",
            author: "作者",
            authorUid: "u1",
            avatarColor: "#fff",
            topic: "话题",
            tags: ["t1"],
            resonance: 1,
            replies: 0,
            createdAt: "2024-01-01T00:00:00.000Z",
          },
        ],
      });

      const result = await fetchIdeaById("i1");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("i1");
      expect(result?.title).toBe("灵感");
      expect(result?.topic).toBe("话题");
    });

    it("未找到：返回 null", async () => {
      mockDb._docRef.get.mockResolvedValue({ data: [] });

      const result = await fetchIdeaById("missing");

      expect(result).toBeNull();
    });

    it("请求失败：返回 null", async () => {
      mockDb._docRef.get.mockRejectedValue(new Error("网络错误"));

      const result = await fetchIdeaById("i1");

      expect(result).toBeNull();
    });
  });

  describe("createIdea", () => {
    // #404 改走云函数：服务端审核 + authorUid 由服务端取自登录态
    const cloudIdeaDoc = {
      id: "new-idea-id",
      title: "标题",
      summary: "摘要",
      author: "Tester",
      authorUid: "test-uid",
      avatarColor: "#7cc4ff",
      topic: "话题",
      tags: ["t1"],
      createdAt: "2026-07-26T00:00:00.000Z",
    };

    it("成功：调用云函数、返回新 Idea 并奖励声望", async () => {
      mockAuth.user = { uid: "test-uid", nickname: "Tester" };
      mockCallFunction.mockResolvedValue({ result: { ok: true, data: cloudIdeaDoc } });

      const result = await createIdea({
        title: "标题",
        summary: "摘要",
        topic: "话题",
        tags: ["t1"],
      });

      expect(result).not.toBeNull();
      expect(result?.id).toBe("new-idea-id");
      expect(result?.title).toBe("标题");
      expect(result?.author).toBe("Tester");
      expect(result?.resonance).toBe(0);
      expect(result?.replies).toBe(0);
      expect(mockCallFunction).toHaveBeenCalledWith({
        name: "content-actions",
        data: {
          action: "createIdea",
          title: "标题",
          summary: "摘要",
          topic: "话题",
          tags: ["t1"],
          author: "Tester",
        },
      });
      // 不再直写数据库
      expect(mockDb._chain.add).not.toHaveBeenCalled();
      expect(mockReputation.awardReputation).toHaveBeenCalledWith(
        "createIdea",
        "new-idea-id"
      );
    });

    it("未登录：抛出'请先登录'且不调用云函数", async () => {
      mockAuth.user = null;

      await expect(
        createIdea({ title: "标题", summary: "摘要", topic: "话题", tags: [] })
      ).rejects.toThrow("请先登录");

      expect(mockCallFunction).not.toHaveBeenCalled();
      expect(mockReputation.awardReputation).not.toHaveBeenCalled();
    });

    it("账号封禁：抛出'您的账号已被封禁'", async () => {
      mockAuth.user = { uid: "test-uid" };
      mockBan.checkCurrentUserBanned.mockResolvedValue(true);

      await expect(
        createIdea({ title: "标题", summary: "摘要", topic: "话题", tags: [] })
      ).rejects.toThrow("您的账号已被封禁");

      expect(mockCallFunction).not.toHaveBeenCalled();
    });

    it("敏感词：本地快筛抛错且不调用云函数", async () => {
      mockAuth.user = { uid: "test-uid" };
      mockSensitive.containsSensitiveWord.mockReturnValue({
        found: true,
        words: ["bad"],
      });

      await expect(
        createIdea({ title: "标题", summary: "摘要", topic: "话题", tags: [] })
      ).rejects.toThrow("内容包含敏感词: bad");

      expect(mockCallFunction).not.toHaveBeenCalled();
    });

    it("标题为空：抛出校验错误且不调用云函数", async () => {
      mockAuth.user = { uid: "test-uid" };

      await expect(
        createIdea({ title: "   ", summary: "正文", topic: "话题", tags: [] })
      ).rejects.toThrow("标题不能为空");

      expect(mockCallFunction).not.toHaveBeenCalled();
    });

    it("云函数返回失败（如服务端审核拦截）：抛出错误", async () => {
      mockAuth.user = { uid: "test-uid" };
      mockCallFunction.mockResolvedValue({
        result: { ok: false, error: "内容包含涉黄信息，请修改后重试" },
      });

      await expect(
        createIdea({ title: "标题", summary: "摘要", topic: "话题", tags: [] })
      ).rejects.toThrow("涉黄");

      expect(mockReputation.awardReputation).not.toHaveBeenCalled();
    });

    it("用户名回退：无 nickname 时以 username 作为 author 传给云函数", async () => {
      mockAuth.user = { uid: "test-uid", username: "uname" };
      mockCallFunction.mockResolvedValue({
        result: { ok: true, data: { ...cloudIdeaDoc, author: "uname" } },
      });

      const result = await createIdea({
        title: "标题",
        summary: "摘要",
        topic: "话题",
        tags: [],
      });

      expect(mockCallFunction).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ author: "uname" }),
        })
      );
      expect(result?.author).toBe("uname");
    });
  });

  describe("resonanceIdea", () => {
    it("成功：调用 callFunction 并返回 true", async () => {
      mockAuth.user = { uid: "test-uid" };
      mockCallFunction.mockResolvedValue({ result: { ok: true } });

      const result = await resonanceIdea("i1");

      expect(result).toBe(true);
      expect(mockCallFunction).toHaveBeenCalledTimes(1);
      expect(mockCallFunction).toHaveBeenCalledWith({
        name: "content-actions",
        data: { action: "resonanceIdea", id: "i1" },
      });
    });

    it("未登录：抛出'请先登录'且不调用 callFunction", async () => {
      mockAuth.user = null;

      await expect(resonanceIdea("i1")).rejects.toThrow("请先登录");

      expect(mockCallFunction).not.toHaveBeenCalled();
    });

    it("账号封禁：抛出'您的账号已被封禁'", async () => {
      mockAuth.user = { uid: "test-uid" };
      mockBan.checkCurrentUserBanned.mockResolvedValue(true);

      await expect(resonanceIdea("i1")).rejects.toThrow("您的账号已被封禁");

      expect(mockCallFunction).not.toHaveBeenCalled();
    });

    it("服务端返回失败：抛出服务端错误信息", async () => {
      mockAuth.user = { uid: "test-uid" };
      mockCallFunction.mockResolvedValue({
        result: { ok: false, error: "已共鸣过" },
      });

      await expect(resonanceIdea("i1")).rejects.toThrow("已共鸣过");
    });

    it("服务端返回失败且无错误信息：抛出默认错误", async () => {
      mockAuth.user = { uid: "test-uid" };
      mockCallFunction.mockResolvedValue({ result: { ok: false } });

      await expect(resonanceIdea("i1")).rejects.toThrow("操作失败");
    });

    it("callFunction 抛错：向上抛出", async () => {
      mockAuth.user = { uid: "test-uid" };
      mockCallFunction.mockRejectedValue(new Error("网络错误"));

      await expect(resonanceIdea("i1")).rejects.toThrow("网络错误");
    });
  });

  describe("updateIdea", () => {
    // #404 改走云函数：所有权校验与审核在服务端执行
    it("成功：调用云函数并返回 true", async () => {
      mockAuth.user = { uid: "test-uid" };
      mockCallFunction.mockResolvedValue({ result: { ok: true, data: { updated: true } } });

      const result = await updateIdea("i1", {
        title: "新标题",
        summary: "新摘要",
        tags: ["t1"],
      });

      expect(result).toBe(true);
      expect(mockCallFunction).toHaveBeenCalledWith({
        name: "content-actions",
        data: {
          action: "updateIdea",
          ideaId: "i1",
          title: "新标题",
          summary: "新摘要",
          tags: ["t1"],
        },
      });
      // 不再直写数据库
      expect(mockDb._docRef.update).not.toHaveBeenCalled();
    });

    it("灵感不存在：返回 false", async () => {
      mockAuth.user = { uid: "test-uid" };
      mockCallFunction.mockResolvedValue({
        result: { ok: false, error: "灵感不存在" },
      });

      const result = await updateIdea("missing", {
        title: "新标题",
        summary: "新摘要",
        tags: [],
      });

      expect(result).toBe(false);
    });

    it("非作者：抛出'无权编辑他人灵感'", async () => {
      mockAuth.user = { uid: "test-uid" };
      mockCallFunction.mockResolvedValue({
        result: { ok: false, error: "无权编辑他人灵感" },
      });

      await expect(
        updateIdea("i1", { title: "新", summary: "新", tags: [] })
      ).rejects.toThrow("无权编辑他人灵感");
    });

    it("服务端审核拦截：抛出错误", async () => {
      mockAuth.user = { uid: "test-uid" };
      mockCallFunction.mockResolvedValue({
        result: { ok: false, error: "内容包含敏感词: 广告" },
      });

      await expect(
        updateIdea("i1", { title: "新", summary: "新", tags: [] })
      ).rejects.toThrow("敏感词");
    });

    it("未登录：抛出'请先登录'且不调用云函数", async () => {
      mockAuth.user = null;

      await expect(
        updateIdea("i1", { title: "新", summary: "新", tags: [] })
      ).rejects.toThrow("请先登录");

      expect(mockCallFunction).not.toHaveBeenCalled();
    });
  });

  describe("addIdeaComment", () => {
    // #400 改走云函数：非作者评论他人灵感曾被安全规则（update 仅作者）拒绝
    const cloudComment = {
      id: "c_123_abc",
      author: "Tester",
      authorUid: "test-uid",
      avatarColor: "#7cc4ff",
      content: "评论内容",
      createdAt: "2026-07-26T00:00:00.000Z",
    };

    it("成功：调用云函数并返回服务端生成的评论", async () => {
      mockAuth.user = { uid: "test-uid", nickname: "Tester" };
      mockCallFunction.mockResolvedValue({
        result: {
          ok: true,
          data: { comment: cloudComment, ideaTitle: "灵感", ideaAuthorUid: "test-uid" },
        },
      });

      const result = await addIdeaComment("i1", "评论内容");

      expect(result).toEqual(cloudComment);
      expect(mockCallFunction).toHaveBeenCalledWith({
        name: "content-actions",
        data: { action: "addIdeaComment", ideaId: "i1", content: "评论内容", author: "Tester" },
      });
      // 不再直写数据库
      expect(mockDb._docRef.update).not.toHaveBeenCalled();
    });

    it("评论内容为空：抛出'评论内容不能为空'且不调用云函数", async () => {
      mockAuth.user = { uid: "test-uid" };

      await expect(addIdeaComment("i1", "   ")).rejects.toThrow(
        "评论内容不能为空"
      );

      expect(mockCallFunction).not.toHaveBeenCalled();
    });

    it("未登录：抛出'请先登录'且不调用云函数", async () => {
      mockAuth.user = null;

      await expect(addIdeaComment("i1", "内容")).rejects.toThrow("请先登录");

      expect(mockCallFunction).not.toHaveBeenCalled();
    });

    it("灵感不存在：返回 null", async () => {
      mockAuth.user = { uid: "test-uid" };
      mockCallFunction.mockResolvedValue({
        result: { ok: false, error: "灵感不存在" },
      });

      const result = await addIdeaComment("missing", "内容");

      expect(result).toBeNull();
    });

    it("云函数返回失败（如审核拦截）：抛出错误", async () => {
      mockAuth.user = { uid: "test-uid" };
      mockCallFunction.mockResolvedValue({
        result: { ok: false, error: "内容包含敏感词: 广告" },
      });

      await expect(addIdeaComment("i1", "内容")).rejects.toThrow(
        "内容包含敏感词"
      );
    });

    it("评论他人灵感：向作者发送通知", async () => {
      mockAuth.user = { uid: "test-uid", nickname: "Tester" };
      mockCallFunction.mockResolvedValue({
        result: {
          ok: true,
          data: { comment: cloudComment, ideaTitle: "他人灵感", ideaAuthorUid: "other-uid" },
        },
      });

      await addIdeaComment("i1", "评论");

      expect(mockNotifications.createNotification).toHaveBeenCalledTimes(1);
      expect(mockNotifications.createNotification).toHaveBeenCalledWith({
        uid: "other-uid",
        type: "comment",
        title: "他人灵感",
        link: "/ideas/i1",
      });
    });

    it("评论自己灵感：不发送通知", async () => {
      mockAuth.user = { uid: "test-uid", nickname: "Tester" };
      mockCallFunction.mockResolvedValue({
        result: {
          ok: true,
          data: { comment: cloudComment, ideaTitle: "自己灵感", ideaAuthorUid: "test-uid" },
        },
      });

      await addIdeaComment("i1", "评论");

      expect(mockNotifications.createNotification).not.toHaveBeenCalled();
    });
  });

  describe("deleteIdeaComment", () => {
    // #400 改走云函数（与 addIdeaComment 同批迁移）
    it("成功：调用云函数删除评论并返回 true", async () => {
      mockAuth.user = { uid: "test-uid" };
      mockCallFunction.mockResolvedValue({ result: { ok: true, data: { deleted: true } } });

      const result = await deleteIdeaComment("i1", "c1");

      expect(result).toBe(true);
      expect(mockCallFunction).toHaveBeenCalledWith({
        name: "content-actions",
        data: { action: "deleteIdeaComment", ideaId: "i1", commentId: "c1" },
      });
      // 不再直写数据库
      expect(mockDb._docRef.update).not.toHaveBeenCalled();
    });

    it("灵感不存在：返回 false", async () => {
      mockAuth.user = { uid: "test-uid" };
      mockCallFunction.mockResolvedValue({
        result: { ok: false, error: "灵感不存在" },
      });

      const result = await deleteIdeaComment("missing", "c1");

      expect(result).toBe(false);
    });

    it("评论不存在：返回 false", async () => {
      mockAuth.user = { uid: "test-uid" };
      mockCallFunction.mockResolvedValue({
        result: { ok: false, error: "评论不存在" },
      });

      const result = await deleteIdeaComment("i1", "missing-comment");

      expect(result).toBe(false);
    });

    it("非评论作者：抛出'无权删除他人评论'", async () => {
      mockAuth.user = { uid: "test-uid" };
      mockCallFunction.mockResolvedValue({
        result: { ok: false, error: "无权删除他人评论" },
      });

      await expect(deleteIdeaComment("i1", "c1")).rejects.toThrow(
        "无权删除他人评论"
      );
    });

    it("未登录：抛出'请先登录'且不调用云函数", async () => {
      mockAuth.user = null;

      await expect(deleteIdeaComment("i1", "c1")).rejects.toThrow("请先登录");

      expect(mockCallFunction).not.toHaveBeenCalled();
    });
  });

  describe("deleteIdea", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("成功：调用云函数删除灵感", async () => {
      mockAuth.user = { uid: "test-uid" };
      mockCallFunction.mockResolvedValue({ result: { ok: true } });

      const result = await deleteIdea("i1");

      expect(result).toBe(true);
      expect(mockCallFunction).toHaveBeenCalledWith({
        name: "content-actions",
        data: { action: "deleteIdea", ideaId: "i1" },
      });
    });

    it("云函数返回失败：抛出错误", async () => {
      mockAuth.user = { uid: "test-uid" };
      mockCallFunction.mockResolvedValue({ result: { ok: false, error: "无权删除他人灵感" } });

      await expect(deleteIdea("i1")).rejects.toThrow("无权删除他人灵感");
    });

    it("灵感不存在：云函数返回失败并抛出错误", async () => {
      mockAuth.user = { uid: "test-uid" };
      mockCallFunction.mockResolvedValue({ result: { ok: false, error: "灵感不存在" } });

      await expect(deleteIdea("missing")).rejects.toThrow("灵感不存在");
    });

    it("未登录：抛出'请先登录'", async () => {
      mockAuth.user = null;

      await expect(deleteIdea("i1")).rejects.toThrow("请先登录");

      expect(mockCallFunction).not.toHaveBeenCalled();
    });
  });
});
