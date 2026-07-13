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
    it("成功：返回新 Idea 并写入文档并奖励声望", async () => {
      mockAuth.user = { uid: "test-uid", nickname: "Tester" };
      mockDb._chain.add.mockResolvedValue({ id: "new-idea-id" });

      const result = await createIdea({
        title: "标题",
        summary: "摘要",
        topic: "话题",
        tags: ["t1"],
      });

      expect(result).not.toBeNull();
      expect(result?.id).toBe("new-idea-id");
      expect(result?.title).toBe("标题");
      expect(result?.summary).toBe("摘要");
      expect(result?.author).toBe("Tester");
      expect(result?.topic).toBe("话题");
      expect(result?.tags).toEqual(["t1"]);
      expect(result?.resonance).toBe(0);
      expect(result?.replies).toBe(0);
      expect(result?.avatarColor).toEqual(expect.any(String));
      expect(mockDb._chain.add).toHaveBeenCalledTimes(1);
      expect(mockDb._chain.add).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "标题",
          summary: "摘要",
          author: "Tester",
          authorUid: "test-uid",
          topic: "话题",
          tags: ["t1"],
          resonance: 0,
          replies: 0,
        })
      );
      expect(mockReputation.awardReputation).toHaveBeenCalledWith(
        "createIdea",
        "new-idea-id"
      );
    });

    it("未登录：抛出'请先登录'且不写入数据库", async () => {
      mockAuth.user = null;

      await expect(
        createIdea({ title: "标题", summary: "摘要", topic: "话题", tags: [] })
      ).rejects.toThrow("请先登录");

      expect(mockDb._chain.add).not.toHaveBeenCalled();
      expect(mockReputation.awardReputation).not.toHaveBeenCalled();
    });

    it("账号封禁：抛出'您的账号已被封禁'", async () => {
      mockAuth.user = { uid: "test-uid" };
      mockBan.checkCurrentUserBanned.mockResolvedValue(true);

      await expect(
        createIdea({ title: "标题", summary: "摘要", topic: "话题", tags: [] })
      ).rejects.toThrow("您的账号已被封禁");

      expect(mockDb._chain.add).not.toHaveBeenCalled();
    });

    it("敏感词：抛出包含敏感词的错误", async () => {
      mockAuth.user = { uid: "test-uid" };
      mockSensitive.containsSensitiveWord.mockReturnValue({
        found: true,
        words: ["bad"],
      });

      await expect(
        createIdea({ title: "标题", summary: "摘要", topic: "话题", tags: [] })
      ).rejects.toThrow("内容包含敏感词: bad");

      expect(mockDb._chain.add).not.toHaveBeenCalled();
    });

    it("标题为空：抛出校验错误且不写入数据库", async () => {
      mockAuth.user = { uid: "test-uid" };

      await expect(
        createIdea({ title: "   ", summary: "正文", topic: "话题", tags: [] })
      ).rejects.toThrow("标题不能为空");

      expect(mockDb._chain.add).not.toHaveBeenCalled();
    });

    it("用户名回退：无 nickname 时使用 username", async () => {
      mockAuth.user = { uid: "test-uid", username: "uname" };
      mockDb._chain.add.mockResolvedValue({ id: "new-id" });

      const result = await createIdea({
        title: "标题",
        summary: "摘要",
        topic: "话题",
        tags: [],
      });

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
    it("成功：作者更新自己的灵感返回 true", async () => {
      mockAuth.user = { uid: "test-uid" };
      mockDb._docRef.get.mockResolvedValue({
        data: [{ _id: "i1", authorUid: "test-uid", title: "旧标题" }],
      });

      const result = await updateIdea("i1", {
        title: "新标题",
        summary: "新摘要",
        tags: ["t1"],
      });

      expect(result).toBe(true);
      expect(mockDb._docRef.update).toHaveBeenCalledTimes(1);
      expect(mockDb._docRef.update).toHaveBeenCalledWith({
        title: "新标题",
        summary: "新摘要",
        tags: ["t1"],
      });
    });

    it("灵感不存在：返回 false 且不调用 update", async () => {
      mockAuth.user = { uid: "test-uid" };
      mockDb._docRef.get.mockResolvedValue({ data: [] });

      const result = await updateIdea("missing", {
        title: "新标题",
        summary: "新摘要",
        tags: [],
      });

      expect(result).toBe(false);
      expect(mockDb._docRef.update).not.toHaveBeenCalled();
    });

    it("非作者：抛出'无权编辑他人灵感'", async () => {
      mockAuth.user = { uid: "test-uid" };
      mockDb._docRef.get.mockResolvedValue({
        data: [{ _id: "i1", authorUid: "other-uid", title: "x" }],
      });

      await expect(
        updateIdea("i1", { title: "新", summary: "新", tags: [] })
      ).rejects.toThrow("无权编辑他人灵感");

      expect(mockDb._docRef.update).not.toHaveBeenCalled();
    });

    it("未登录：抛出'请先登录'", async () => {
      mockAuth.user = null;

      await expect(
        updateIdea("i1", { title: "新", summary: "新", tags: [] })
      ).rejects.toThrow("请先登录");

      expect(mockDb._docRef.update).not.toHaveBeenCalled();
    });
  });

  describe("addIdeaComment", () => {
    it("成功：返回评论并更新 comments 与 replies", async () => {
      mockAuth.user = { uid: "test-uid", nickname: "Tester" };
      mockDb._docRef.get.mockResolvedValue({
        data: [
          {
            _id: "i1",
            authorUid: "test-uid",
            title: "灵感",
            comments: [],
          },
        ],
      });

      const result = await addIdeaComment("i1", "评论内容");

      expect(result).not.toBeNull();
      expect(result?.id).toMatch(/^c_/);
      expect(result?.author).toBe("Tester");
      expect(result?.authorUid).toBe("test-uid");
      expect(result?.content).toBe("评论内容");
      expect(mockDb.command.push).toHaveBeenCalledTimes(1);
      expect(mockDb.command.push).toHaveBeenCalledWith([
        expect.objectContaining({ content: "评论内容", author: "Tester" }),
      ]);
      expect(mockDb.command.inc).toHaveBeenCalledWith(1);
      expect(mockDb._docRef.update).toHaveBeenCalledWith({
        comments: { __push: true },
        replies: { __inc: 1 },
      });
    });

    it("评论内容为空：抛出'评论内容不能为空'", async () => {
      mockAuth.user = { uid: "test-uid" };

      await expect(addIdeaComment("i1", "   ")).rejects.toThrow(
        "评论内容不能为空"
      );

      expect(mockDb._docRef.update).not.toHaveBeenCalled();
    });

    it("未登录：抛出'请先登录'", async () => {
      mockAuth.user = null;

      await expect(addIdeaComment("i1", "内容")).rejects.toThrow("请先登录");

      expect(mockDb._docRef.update).not.toHaveBeenCalled();
    });

    it("灵感不存在：返回 null", async () => {
      mockAuth.user = { uid: "test-uid" };
      mockDb._docRef.get.mockResolvedValue({ data: [] });

      const result = await addIdeaComment("missing", "内容");

      expect(result).toBeNull();
      expect(mockDb._docRef.update).not.toHaveBeenCalled();
    });

    it("评论他人灵感：向作者发送通知", async () => {
      mockAuth.user = { uid: "test-uid", nickname: "Tester" };
      mockDb._docRef.get.mockResolvedValue({
        data: [
          {
            _id: "i1",
            authorUid: "other-uid",
            title: "他人灵感",
            comments: [],
          },
        ],
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
      mockDb._docRef.get.mockResolvedValue({
        data: [
          {
            _id: "i1",
            authorUid: "test-uid",
            title: "自己灵感",
            comments: [],
          },
        ],
      });

      await addIdeaComment("i1", "评论");

      expect(mockNotifications.createNotification).not.toHaveBeenCalled();
    });
  });

  describe("deleteIdeaComment", () => {
    it("成功：删除自己评论并更新 replies", async () => {
      mockAuth.user = { uid: "test-uid" };
      mockDb._docRef.get.mockResolvedValue({
        data: [
          {
            _id: "i1",
            authorUid: "other-uid",
            comments: [
              { id: "c1", authorUid: "test-uid", content: "x" },
              { id: "c2", authorUid: "other-uid", content: "y" },
            ],
          },
        ],
      });

      const result = await deleteIdeaComment("i1", "c1");

      expect(result).toBe(true);
      expect(mockDb.command.pull).toHaveBeenCalledWith({ id: "c1" });
      expect(mockDb.command.inc).toHaveBeenCalledWith(-1);
      expect(mockDb._docRef.update).toHaveBeenCalledWith({
        comments: { __pull: true },
        replies: { __inc: 1 },
      });
    });

    it("灵感不存在：返回 false", async () => {
      mockAuth.user = { uid: "test-uid" };
      mockDb._docRef.get.mockResolvedValue({ data: [] });

      const result = await deleteIdeaComment("missing", "c1");

      expect(result).toBe(false);
      expect(mockDb._docRef.update).not.toHaveBeenCalled();
    });

    it("评论不存在：返回 false", async () => {
      mockAuth.user = { uid: "test-uid" };
      mockDb._docRef.get.mockResolvedValue({
        data: [{ _id: "i1", authorUid: "test-uid", comments: [] }],
      });

      const result = await deleteIdeaComment("i1", "missing-comment");

      expect(result).toBe(false);
      expect(mockDb._docRef.update).not.toHaveBeenCalled();
    });

    it("非评论作者：抛出'无权删除他人评论'", async () => {
      mockAuth.user = { uid: "test-uid" };
      mockDb._docRef.get.mockResolvedValue({
        data: [
          {
            _id: "i1",
            authorUid: "test-uid",
            comments: [{ id: "c1", authorUid: "other-uid", content: "x" }],
          },
        ],
      });

      await expect(deleteIdeaComment("i1", "c1")).rejects.toThrow(
        "无权删除他人评论"
      );

      expect(mockDb._docRef.update).not.toHaveBeenCalled();
    });

    it("未登录：抛出'请先登录'", async () => {
      mockAuth.user = null;

      await expect(deleteIdeaComment("i1", "c1")).rejects.toThrow("请先登录");

      expect(mockDb._docRef.update).not.toHaveBeenCalled();
    });
  });

  describe("deleteIdea", () => {
    it("成功：作者删除自己的灵感并级联清理收藏与举报", async () => {
      mockAuth.user = { uid: "test-uid" };
      mockDb._docRef.get.mockResolvedValue({
        data: [{ _id: "i1", authorUid: "test-uid", title: "x" }],
      });

      const result = await deleteIdea("i1");

      expect(result).toBe(true);
      expect(mockDb._docRef.remove).toHaveBeenCalledTimes(1);
      expect(mockDb._chain.remove).toHaveBeenCalledTimes(2);
      expect(mockDb._chain.where).toHaveBeenCalledWith({ targetId: "i1" });
      expect(mockDb._chain.where).toHaveBeenCalledTimes(2);
    });

    it("灵感不存在：返回 false 且不调用 remove", async () => {
      mockAuth.user = { uid: "test-uid" };
      mockDb._docRef.get.mockResolvedValue({ data: [] });

      const result = await deleteIdea("missing");

      expect(result).toBe(false);
      expect(mockDb._docRef.remove).not.toHaveBeenCalled();
      expect(mockDb._chain.remove).not.toHaveBeenCalled();
    });

    it("非作者：抛出'无权删除他人灵感'", async () => {
      mockAuth.user = { uid: "test-uid" };
      mockDb._docRef.get.mockResolvedValue({
        data: [{ _id: "i1", authorUid: "other-uid", title: "x" }],
      });

      await expect(deleteIdea("i1")).rejects.toThrow("无权删除他人灵感");

      expect(mockDb._docRef.remove).not.toHaveBeenCalled();
      expect(mockDb._chain.remove).not.toHaveBeenCalled();
    });

    it("未登录：抛出'请先登录'", async () => {
      mockAuth.user = null;

      await expect(deleteIdea("i1")).rejects.toThrow("请先登录");

      expect(mockDb._docRef.remove).not.toHaveBeenCalled();
    });

    it("级联清理失败：不阻断主流程仍返回 true", async () => {
      mockAuth.user = { uid: "test-uid" };
      mockDb._docRef.get.mockResolvedValue({
        data: [{ _id: "i1", authorUid: "test-uid", title: "x" }],
      });
      mockDb._chain.remove.mockRejectedValue(new Error("权限拒绝"));

      const result = await deleteIdea("i1");

      expect(result).toBe(true);
      expect(mockDb._docRef.remove).toHaveBeenCalledTimes(1);
    });
  });
});
