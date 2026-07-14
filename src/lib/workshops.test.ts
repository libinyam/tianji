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

vi.mock("@/lib/cloudbase", () => ({
  app: {
    database: () => mockDb,
    callFunction: mockCallFunction,
  },
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

import {
  fetchWorkshops,
  fetchWorkshopById,
  createWorkshop,
  joinWorkshop,
  submitContribution,
  canViewContent,
  updateWorkshop,
  deleteWorkshop,
  addAnnotation,
  resolveAnnotation,
} from "./workshops";
import type { WorkshopDoc, WorkshopProject } from "./workshops";

const workshopDoc: WorkshopDoc = {
  _id: "w1",
  title: "测试项目",
  type: "教材",
  description: "测试描述",
  content: "测试内容",
  outline: [{ id: "ch1", title: "第一章", brief: "简介" }],
  creator: "Tester",
  creatorUid: "creator-1",
  avatarColor: "#7cc4ff",
  participants: ["creator-1", "u2"],
  contributions: [],
  annotations: [],
  tags: ["AI"],
  status: "招募中",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-02T00:00:00.000Z",
};

describe("workshops", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.user = null;
    mockDb._chain.get.mockResolvedValue({ data: [] });
    mockDb._chain.add.mockResolvedValue({ id: "new-id" });
    mockDb._chain.update.mockResolvedValue(undefined);
    mockDb._chain.remove.mockResolvedValue(undefined);
    mockDb._docRef.get.mockResolvedValue({ data: [] });
    mockDb._docRef.update.mockResolvedValue(undefined);
    mockDb._docRef.remove.mockResolvedValue(undefined);
    mockCallFunction.mockResolvedValue({ result: { ok: true, data: null } });
    mockBan.checkCurrentUserBanned.mockResolvedValue(false);
    mockSensitive.containsSensitiveWord.mockReturnValue({ found: false, words: [] });
    mockReputation.awardReputation.mockResolvedValue(undefined);
  });

  describe("fetchWorkshops", () => {
    it("成功：返回 WorkshopProject 列表", async () => {
      mockDb._chain.get.mockResolvedValue({ data: [workshopDoc] });

      const result = await fetchWorkshops();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("w1");
      expect(result[0].title).toBe("测试项目");
      expect(result[0].outline).toHaveLength(1);
      expect(mockDb.collection).toHaveBeenCalledWith("workshops");
      expect(mockDb._chain.orderBy).toHaveBeenCalledWith("createdAt", "desc");
      expect(mockDb._chain.limit).toHaveBeenCalledWith(50);
    });

    it("空数据：返回空数组", async () => {
      mockDb._chain.get.mockResolvedValue({ data: [] });

      const result = await fetchWorkshops();

      expect(result).toEqual([]);
    });

    it("异常：返回空数组", async () => {
      mockDb._chain.get.mockRejectedValue(new Error("网络错误"));

      const result = await fetchWorkshops();

      expect(result).toEqual([]);
    });

    it("缺失字段使用默认值", async () => {
      const partialDoc = {
        _id: "w2",
        title: "部分项目",
        type: "论文" as const,
        description: "描述",
        creator: "User",
        creatorUid: "u1",
        avatarColor: "#fff",
        createdAt: "2024-01-01T00:00:00.000Z",
      };
      mockDb._chain.get.mockResolvedValue({ data: [partialDoc] });

      const result = await fetchWorkshops();

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe("");
      expect(result[0].outline).toEqual([]);
      expect(result[0].participants).toEqual([]);
      expect(result[0].contributions).toEqual([]);
      expect(result[0].annotations).toEqual([]);
      expect(result[0].tags).toEqual([]);
      expect(result[0].status).toBe("招募中");
      expect(result[0].updatedAt).toBe("2024-01-01T00:00:00.000Z");
    });
  });

  describe("fetchWorkshopById", () => {
    it("找到：返回 WorkshopProject", async () => {
      mockDb._docRef.get.mockResolvedValue({ data: [workshopDoc] });

      const result = await fetchWorkshopById("w1");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("w1");
      expect(result?.title).toBe("测试项目");
    });

    it("未找到：返回 null", async () => {
      mockDb._docRef.get.mockResolvedValue({ data: [] });

      const result = await fetchWorkshopById("no-exist");

      expect(result).toBeNull();
    });

    it("异常：返回 null", async () => {
      mockDb._docRef.get.mockRejectedValue(new Error("网络错误"));

      const result = await fetchWorkshopById("w1");

      expect(result).toBeNull();
    });
  });

  describe("createWorkshop", () => {
    const validParams = {
      title: "新项目",
      type: "教材" as const,
      description: "描述",
      content: "内容",
      outline: [{ id: "ch1", title: "第一章", brief: "简介" }],
      tags: ["AI"],
    };

    it("成功：创建文档并调用 awardReputation", async () => {
      mockAuth.user = { uid: "u1", nickname: "Tester" };

      const result = await createWorkshop(validParams);

      expect(result).not.toBeNull();
      expect(result?.id).toBe("new-id");
      expect(result?.creator).toBe("Tester");
      expect(result?.creatorUid).toBe("u1");
      expect(result?.participants).toEqual(["u1"]);
      expect(result?.status).toBe("招募中");
      expect(mockDb._chain.add).toHaveBeenCalled();
      expect(mockReputation.awardReputation).toHaveBeenCalledWith("createWorkshop", "new-id");
    });

    it("未登录：抛出错误", async () => {
      mockAuth.user = null;

      await expect(createWorkshop(validParams)).rejects.toThrow("请先登录");
      expect(mockDb._chain.add).not.toHaveBeenCalled();
    });

    it("被封禁：抛出错误", async () => {
      mockAuth.user = { uid: "u1" };
      mockBan.checkCurrentUserBanned.mockResolvedValue(true);

      await expect(createWorkshop(validParams)).rejects.toThrow("已被封禁");
      expect(mockDb._chain.add).not.toHaveBeenCalled();
    });

    it("含敏感词：抛出错误", async () => {
      mockAuth.user = { uid: "u1" };
      mockSensitive.containsSensitiveWord.mockReturnValue({
        found: true,
        words: ["垃圾"],
      });

      await expect(createWorkshop(validParams)).rejects.toThrow("敏感词");
      expect(mockDb._chain.add).not.toHaveBeenCalled();
    });

    it("用户信息缺失时使用匿名用户名", async () => {
      mockAuth.user = { uid: "u1" };

      await createWorkshop(validParams);

      const callArgs = mockDb._chain.add.mock.calls[0][0];
      expect(callArgs.creator).toBe("匿名用户");
    });
  });

  describe("joinWorkshop", () => {
    it("成功：云函数返回 ok=true 时返回 true", async () => {
      mockAuth.user = { uid: "u1" };
      mockCallFunction.mockResolvedValue({ result: { ok: true } });

      const result = await joinWorkshop("w1");

      expect(result).toBe(true);
      expect(mockCallFunction).toHaveBeenCalledWith({
        name: "content-actions",
        data: { action: "joinWorkshop", workshopId: "w1" },
      });
    });

    it("失败：云函数返回 ok=false 时返回 false", async () => {
      mockAuth.user = { uid: "u1" };
      mockCallFunction.mockResolvedValue({ result: { ok: false } });

      const result = await joinWorkshop("w1");

      expect(result).toBe(false);
    });

    it("异常：返回 false", async () => {
      mockAuth.user = { uid: "u1" };
      mockCallFunction.mockRejectedValue(new Error("网络错误"));

      const result = await joinWorkshop("w1");

      expect(result).toBe(false);
    });

    it("未登录：抛出错误", async () => {
      mockAuth.user = null;

      await expect(joinWorkshop("w1")).rejects.toThrow("请先登录");
    });
  });

  describe("submitContribution", () => {
    it("成功：返回 Contribution", async () => {
      mockAuth.user = { uid: "u1" };
      const contribution = {
        id: "c1",
        chapterId: "ch1",
        author: "Tester",
        authorUid: "u1",
        avatarColor: "#fff",
        content: "贡献内容",
        createdAt: "2024-01-01T00:00:00.000Z",
      };
      mockCallFunction.mockResolvedValue({ result: { ok: true, data: contribution } });

      const result = await submitContribution("w1", "ch1", "贡献内容");

      expect(result).toEqual(contribution);
      expect(mockCallFunction).toHaveBeenCalledWith({
        name: "content-actions",
        data: {
          action: "submitWorkshopContribution",
          workshopId: "w1",
          chapterId: "ch1",
          content: "贡献内容",
        },
      });
    });

    it("result.ok=false：返回 null", async () => {
      mockAuth.user = { uid: "u1" };
      mockCallFunction.mockResolvedValue({ result: { ok: false } });

      const result = await submitContribution("w1", "ch1", "内容");

      expect(result).toBeNull();
    });

    it("异常：返回 null", async () => {
      mockAuth.user = { uid: "u1" };
      mockCallFunction.mockRejectedValue(new Error("网络错误"));

      const result = await submitContribution("w1", "ch1", "内容");

      expect(result).toBeNull();
    });

    it("未登录：抛出错误", async () => {
      mockAuth.user = null;

      await expect(submitContribution("w1", "ch1", "内容")).rejects.toThrow("请先登录");
    });
  });

  describe("canViewContent", () => {
    it("教材类型：任何用户都可查看", () => {
      mockAuth.user = null;
      const project: WorkshopProject = {
        ...workshopDoc,
        type: "教材",
      } as WorkshopProject;

      expect(canViewContent(project)).toBe(true);
    });

    it("论文类型：创建者可查看", () => {
      mockAuth.user = { uid: "creator-1" };
      const project: WorkshopProject = {
        ...workshopDoc,
        type: "论文",
      } as WorkshopProject;

      expect(canViewContent(project)).toBe(true);
    });

    it("论文类型：参与者可查看", () => {
      mockAuth.user = { uid: "u2" };
      const project: WorkshopProject = {
        ...workshopDoc,
        type: "论文",
        creatorUid: "creator-1",
        participants: ["creator-1", "u2"],
      } as WorkshopProject;

      expect(canViewContent(project)).toBe(true);
    });

    it("论文类型：非参与者不可查看", () => {
      mockAuth.user = { uid: "u3" };
      const project: WorkshopProject = {
        ...workshopDoc,
        type: "论文",
        creatorUid: "creator-1",
        participants: ["creator-1", "u2"],
      } as WorkshopProject;

      expect(canViewContent(project)).toBe(false);
    });

    it("论文类型：未登录不可查看", () => {
      mockAuth.user = null;
      const project: WorkshopProject = {
        ...workshopDoc,
        type: "论文",
        creatorUid: "creator-1",
        participants: ["creator-1"],
      } as WorkshopProject;

      expect(canViewContent(project)).toBe(false);
    });
  });

  describe("updateWorkshop", () => {
    it("成功：创建者更新字段", async () => {
      mockAuth.user = { uid: "creator-1" };
      mockDb._docRef.get.mockResolvedValue({ data: [workshopDoc] });

      const result = await updateWorkshop("w1", {
        title: "新标题",
        status: "已完成",
      });

      expect(result).toBe(true);
      expect(mockDb._docRef.update).toHaveBeenCalled();
      const updateArgs = mockDb._docRef.update.mock.calls[0][0];
      expect(updateArgs.title).toBe("新标题");
      expect(updateArgs.status).toBe("已完成");
      expect(updateArgs.updatedAt).toBeDefined();
    });

    it("未找到：返回 false", async () => {
      mockAuth.user = { uid: "creator-1" };
      mockDb._docRef.get.mockResolvedValue({ data: [] });

      const result = await updateWorkshop("no-exist", { title: "x" });

      expect(result).toBe(false);
      expect(mockDb._docRef.update).not.toHaveBeenCalled();
    });

    it("非创建者：抛出权限错误", async () => {
      mockAuth.user = { uid: "other-uid" };
      mockDb._docRef.get.mockResolvedValue({ data: [workshopDoc] });

      await expect(updateWorkshop("w1", { title: "x" })).rejects.toThrow("仅创建者");
      expect(mockDb._docRef.update).not.toHaveBeenCalled();
    });

    it("其他异常：返回 false", async () => {
      mockAuth.user = { uid: "creator-1" };
      mockDb._docRef.get.mockRejectedValue(new Error("网络错误"));

      const result = await updateWorkshop("w1", { title: "x" });

      expect(result).toBe(false);
    });

    it("未登录：抛出错误", async () => {
      mockAuth.user = null;

      await expect(updateWorkshop("w1", { title: "x" })).rejects.toThrow("请先登录");
    });
  });

  describe("deleteWorkshop", () => {
    it("成功：创建者删除", async () => {
      mockAuth.user = { uid: "creator-1" };
      mockDb._docRef.get.mockResolvedValue({ data: [workshopDoc] });

      const result = await deleteWorkshop("w1");

      expect(result).toBe(true);
      expect(mockDb._docRef.remove).toHaveBeenCalled();
    });

    it("未找到：返回 false", async () => {
      mockAuth.user = { uid: "creator-1" };
      mockDb._docRef.get.mockResolvedValue({ data: [] });

      const result = await deleteWorkshop("no-exist");

      expect(result).toBe(false);
      expect(mockDb._docRef.remove).not.toHaveBeenCalled();
    });

    it("非创建者：抛出权限错误", async () => {
      mockAuth.user = { uid: "other-uid" };
      mockDb._docRef.get.mockResolvedValue({ data: [workshopDoc] });

      await expect(deleteWorkshop("w1")).rejects.toThrow("仅创建者");
      expect(mockDb._docRef.remove).not.toHaveBeenCalled();
    });

    it("其他异常：返回 false", async () => {
      mockAuth.user = { uid: "creator-1" };
      mockDb._docRef.get.mockRejectedValue(new Error("网络错误"));

      const result = await deleteWorkshop("w1");

      expect(result).toBe(false);
    });

    it("未登录：抛出错误", async () => {
      mockAuth.user = null;

      await expect(deleteWorkshop("w1")).rejects.toThrow("请先登录");
    });
  });

  describe("addAnnotation", () => {
    it("成功：返回 Annotation", async () => {
      mockAuth.user = { uid: "u1" };
      const annotation = {
        id: "a1",
        author: "Tester",
        authorUid: "u1",
        content: "批注内容",
        resolved: false,
        createdAt: "2024-01-01T00:00:00.000Z",
      };
      mockCallFunction.mockResolvedValue({ result: { ok: true, data: annotation } });

      const result = await addAnnotation("w1", "批注内容");

      expect(result).toEqual(annotation);
      expect(mockCallFunction).toHaveBeenCalledWith({
        name: "content-actions",
        data: {
          action: "addWorkshopAnnotation",
          workshopId: "w1",
          content: "批注内容",
        },
      });
    });

    it("result.ok=false：返回 null", async () => {
      mockAuth.user = { uid: "u1" };
      mockCallFunction.mockResolvedValue({ result: { ok: false } });

      const result = await addAnnotation("w1", "内容");

      expect(result).toBeNull();
    });

    it("异常：返回 null", async () => {
      mockAuth.user = { uid: "u1" };
      mockCallFunction.mockRejectedValue(new Error("网络错误"));

      const result = await addAnnotation("w1", "内容");

      expect(result).toBeNull();
    });

    it("空内容：抛出错误", async () => {
      mockAuth.user = { uid: "u1" };

      await expect(addAnnotation("w1", "   ")).rejects.toThrow("不能为空");
      expect(mockCallFunction).not.toHaveBeenCalled();
    });

    it("未登录：抛出错误", async () => {
      mockAuth.user = null;

      await expect(addAnnotation("w1", "内容")).rejects.toThrow("请先登录");
    });
  });

  describe("resolveAnnotation", () => {
    it("成功：返回 true", async () => {
      mockAuth.user = { uid: "u1" };
      mockCallFunction.mockResolvedValue({ result: { ok: true } });

      const result = await resolveAnnotation("w1", "a1");

      expect(result).toBe(true);
      expect(mockCallFunction).toHaveBeenCalledWith({
        name: "content-actions",
        data: {
          action: "resolveWorkshopAnnotation",
          workshopId: "w1",
          annotationId: "a1",
        },
      });
    });

    it("result.ok=false：返回 false", async () => {
      mockAuth.user = { uid: "u1" };
      mockCallFunction.mockResolvedValue({ result: { ok: false } });

      const result = await resolveAnnotation("w1", "a1");

      expect(result).toBe(false);
    });

    it("权限错误：抛出错误", async () => {
      mockAuth.user = { uid: "u1" };
      mockCallFunction.mockResolvedValue({
        result: { ok: false, error: "仅创建者或批注作者可解决" },
      });

      await expect(resolveAnnotation("w1", "a1")).rejects.toThrow("仅创建者或批注作者");
    });

    it("异常：返回 false", async () => {
      mockAuth.user = { uid: "u1" };
      mockCallFunction.mockRejectedValue(new Error("网络错误"));

      const result = await resolveAnnotation("w1", "a1");

      expect(result).toBe(false);
    });

    it("未登录：抛出错误", async () => {
      mockAuth.user = null;

      await expect(resolveAnnotation("w1", "a1")).rejects.toThrow("请先登录");
    });
  });
});
