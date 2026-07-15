import { describe, it, expect, vi, beforeEach } from "vitest";

// #322 src/lib/follows.ts 关注体系测试
// 覆盖 toggleFollow 幂等/自关注/封禁、isFollowing、fetchFollowing/fetchFollowers、
// fetchFollowingCount/fetchFollowersCount、fetchFollowingUids、
// toggleTagFollow、isTagFollowing、fetchFollowedTags

// 共享 chain：每个 collection 调用返回一个新的 chain 实例，避免测试间相互污染
function makeChain() {
  const docMock = {
    get: vi.fn().mockResolvedValue({ data: [] }),
    update: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
  };
  const chain = {
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    field: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    get: vi.fn().mockResolvedValue({ data: [] }),
    add: vi.fn().mockResolvedValue({ id: "" }),
    update: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    count: vi.fn().mockResolvedValue({ total: 0 }),
    doc: vi.fn(() => docMock),
    _docMock: docMock,
  };
  return chain;
}

const mockDb = vi.hoisted(() => {
  const chains: ReturnType<typeof makeChain>[] = [];
  return {
    collection: vi.fn(() => {
      const c = makeChain();
      chains.push(c);
      return c;
    }),
    _chains: chains,
    _lastChain: () => chains[chains.length - 1],
    _reset: () => (chains.length = 0),
  };
});

const mockAuth = vi.hoisted(() => ({
  user: null as null | { uid: string; nickname?: string; username?: string; email?: string },
}));

vi.mock("@/lib/cloudbase", () => ({
  app: { database: () => mockDb },
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: { getState: () => ({ user: mockAuth.user }) },
}));

const mockBanned = vi.hoisted(() => ({ banned: false }));

vi.mock("@/lib/ban", () => ({
  checkCurrentUserBanned: vi.fn(() => Promise.resolve(mockBanned.banned)),
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/sanitize", () => ({
  sanitizeInput: vi.fn((s: string) => s),
}));

import {
  toggleFollow,
  isFollowing,
  fetchFollowing,
  fetchFollowers,
  fetchFollowingCount,
  fetchFollowersCount,
  fetchFollowingUids,
  toggleTagFollow,
  isTagFollowing,
  fetchFollowedTags,
} from "./follows";
import { checkCurrentUserBanned } from "@/lib/ban";
import { createNotification } from "@/lib/notifications";

describe("follows 用户关注体系（#322）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.user = null;
    mockBanned.banned = false;
    mockDb._reset();
  });

  describe("toggleFollow", () => {
    it("未登录：抛出错误", async () => {
      mockAuth.user = null;
      await expect(
        toggleFollow({ targetUid: "u2", targetNickname: "Bob" })
      ).rejects.toThrow("请先登录");
    });

    it("不能关注自己", async () => {
      mockAuth.user = { uid: "u1" };
      await expect(
        toggleFollow({ targetUid: "u1", targetNickname: "Me" })
      ).rejects.toThrow("不能关注自己");
    });

    it("被封禁：拒绝关注", async () => {
      mockAuth.user = { uid: "u1" };
      mockBanned.banned = true;
      await expect(
        toggleFollow({ targetUid: "u2", targetNickname: "Bob" })
      ).rejects.toThrow("已被封禁");
      expect(checkCurrentUserBanned).toHaveBeenCalled();
    });

    it("未关注 → 添加关注并返回 true", async () => {
      mockAuth.user = { uid: "u1", nickname: "Alice" };
      const chain = makeChain();
      chain.get.mockResolvedValueOnce({ data: [] });
      chain.add.mockResolvedValueOnce({ id: "new-follow-id" });
      mockDb.collection.mockReturnValueOnce(chain);

      const result = await toggleFollow({
        targetUid: "u2",
        targetNickname: "Bob",
        targetAvatarUrl: "https://example.com/a.png",
      });

      expect(result).toBe(true);
      expect(chain.where).toHaveBeenCalledWith({ uid: "u1", targetUid: "u2" });
      expect(chain.add).toHaveBeenCalledWith(
        expect.objectContaining({
          uid: "u1",
          targetUid: "u2",
          nickname: "Bob",
          avatarUrl: "https://example.com/a.png",
        })
      );
    });

    it("已关注 → 取消关注并返回 false", async () => {
      mockAuth.user = { uid: "u1" };
      const chain = makeChain();
      chain.get.mockResolvedValueOnce({
        data: [{ _id: "follow-id-1", uid: "u1", targetUid: "u2" }],
      });
      mockDb.collection.mockReturnValueOnce(chain);

      const result = await toggleFollow({
        targetUid: "u2",
        targetNickname: "Bob",
      });

      expect(result).toBe(false);
      expect(chain.doc).toHaveBeenCalledWith("follow-id-1");
      expect(chain._docMock.remove).toHaveBeenCalledTimes(1);
    });

    it("新增关注后触发通知（不阻塞主流程）", async () => {
      mockAuth.user = { uid: "u1", nickname: "Alice" };
      const chain = makeChain();
      chain.get.mockResolvedValueOnce({ data: [] });
      chain.add.mockResolvedValueOnce({ id: "f1" });
      mockDb.collection.mockReturnValueOnce(chain);

      await toggleFollow({ targetUid: "u2", targetNickname: "Bob" });

      expect(createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          uid: "u2",
          type: "follow",
          title: "Alice 关注了你",
          link: "/user/u1",
        })
      );
    });

    it("通知失败不阻塞主流程", async () => {
      mockAuth.user = { uid: "u1", nickname: "Alice" };
      const chain = makeChain();
      chain.get.mockResolvedValueOnce({ data: [] });
      chain.add.mockResolvedValueOnce({ id: "f1" });
      mockDb.collection.mockReturnValueOnce(chain);
      (createNotification as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("net"));

      const result = await toggleFollow({
        targetUid: "u2",
        targetNickname: "Bob",
      });

      // toggleFollow 用 .catch(() => {}) 吞掉通知错误
      expect(result).toBe(true);
    });

    it("add 返回无 id 时抛出权限错误", async () => {
      mockAuth.user = { uid: "u1" };
      const chain = makeChain();
      chain.get.mockResolvedValueOnce({ data: [] });
      chain.add.mockResolvedValueOnce({});
      mockDb.collection.mockReturnValueOnce(chain);

      await expect(
        toggleFollow({ targetUid: "u2", targetNickname: "Bob" })
      ).rejects.toThrow("权限不足");
    });
  });

  describe("isFollowing", () => {
    it("未登录：返回 false 不查询", async () => {
      mockAuth.user = null;
      const result = await isFollowing("u2");
      expect(result).toBe(false);
      expect(mockDb.collection).not.toHaveBeenCalled();
    });

    it("已关注：返回 true", async () => {
      mockAuth.user = { uid: "u1" };
      const chain = makeChain();
      chain.get.mockResolvedValueOnce({
        data: [{ _id: "f1", uid: "u1", targetUid: "u2" }],
      });
      mockDb.collection.mockReturnValueOnce(chain);

      const result = await isFollowing("u2");
      expect(result).toBe(true);
      expect(chain.where).toHaveBeenCalledWith({ uid: "u1", targetUid: "u2" });
    });

    it("未关注：返回 false", async () => {
      mockAuth.user = { uid: "u1" };
      const chain = makeChain();
      chain.get.mockResolvedValueOnce({ data: [] });
      mockDb.collection.mockReturnValueOnce(chain);

      const result = await isFollowing("u2");
      expect(result).toBe(false);
    });

    it("查询异常：返回 false", async () => {
      mockAuth.user = { uid: "u1" };
      const chain = makeChain();
      chain.get.mockRejectedValueOnce(new Error("net"));
      mockDb.collection.mockReturnValueOnce(chain);

      const result = await isFollowing("u2");
      expect(result).toBe(false);
    });
  });

  describe("fetchFollowing", () => {
    it("成功：返回关注列表（应用 toFollow 转换）", async () => {
      const chain = makeChain();
      chain.get.mockResolvedValueOnce({
        data: [
          {
            _id: "f1",
            uid: "u1",
            targetUid: "u2",
            nickname: "Bob",
            avatarUrl: "b.png",
            createdAt: "2024-01-01",
          },
        ],
      });
      mockDb.collection.mockReturnValueOnce(chain);

      const result = await fetchFollowing("u1");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: "f1",
        uid: "u2",
        nickname: "Bob",
        avatarUrl: "b.png",
        createdAt: "2024-01-01",
      });
      expect(chain.where).toHaveBeenCalledWith({ uid: "u1" });
      expect(chain.orderBy).toHaveBeenCalledWith("createdAt", "desc");
    });

    it("空数据：返回空数组", async () => {
      const chain = makeChain();
      chain.get.mockResolvedValueOnce({ data: [] });
      mockDb.collection.mockReturnValueOnce(chain);
      expect(await fetchFollowing("u1")).toEqual([]);
    });

    it("异常：返回空数组", async () => {
      const chain = makeChain();
      chain.get.mockRejectedValueOnce(new Error("fail"));
      mockDb.collection.mockReturnValueOnce(chain);
      expect(await fetchFollowing("u1")).toEqual([]);
    });
  });

  describe("fetchFollowers", () => {
    it("成功：返回粉丝列表（应用 toFollower 转换）", async () => {
      const chain = makeChain();
      chain.get.mockResolvedValueOnce({
        data: [
          {
            _id: "f1",
            uid: "u1",
            targetUid: "u2",
            nickname: "Alice",
            avatarUrl: "a.png",
            createdAt: "2024-01-01",
          },
        ],
      });
      mockDb.collection.mockReturnValueOnce(chain);

      const result = await fetchFollowers("u2");
      expect(result).toHaveLength(1);
      // toFollower 返回 uid: doc.uid（关注者），而非 targetUid
      expect(result[0].uid).toBe("u1");
      expect(result[0].nickname).toBe("Alice");
      expect(chain.where).toHaveBeenCalledWith({ targetUid: "u2" });
    });

    it("异常：返回空数组", async () => {
      const chain = makeChain();
      chain.get.mockRejectedValueOnce(new Error("fail"));
      mockDb.collection.mockReturnValueOnce(chain);
      expect(await fetchFollowers("u2")).toEqual([]);
    });
  });

  describe("fetchFollowingCount", () => {
    it("成功：返回关注数", async () => {
      const chain = makeChain();
      chain.count.mockResolvedValueOnce({ total: 42 });
      mockDb.collection.mockReturnValueOnce(chain);
      expect(await fetchFollowingCount("u1")).toBe(42);
    });

    it("异常：返回 0", async () => {
      const chain = makeChain();
      chain.count.mockRejectedValueOnce(new Error("fail"));
      mockDb.collection.mockReturnValueOnce(chain);
      expect(await fetchFollowingCount("u1")).toBe(0);
    });
  });

  describe("fetchFollowersCount", () => {
    it("成功：返回粉丝数", async () => {
      const chain = makeChain();
      chain.count.mockResolvedValueOnce({ total: 7 });
      mockDb.collection.mockReturnValueOnce(chain);
      expect(await fetchFollowersCount("u2")).toBe(7);
    });

    it("异常：返回 0", async () => {
      const chain = makeChain();
      chain.count.mockRejectedValueOnce(new Error("fail"));
      mockDb.collection.mockReturnValueOnce(chain);
      expect(await fetchFollowersCount("u2")).toBe(0);
    });
  });

  describe("fetchFollowingUids", () => {
    it("成功：返回 targetUid 数组", async () => {
      const chain = makeChain();
      chain.get.mockResolvedValueOnce({
        data: [
          { targetUid: "u2" },
          { targetUid: "u3" },
        ],
      });
      mockDb.collection.mockReturnValueOnce(chain);

      const result = await fetchFollowingUids("u1");
      expect(result).toEqual(["u2", "u3"]);
      expect(chain.field).toHaveBeenCalledWith({ targetUid: true });
      expect(chain.limit).toHaveBeenCalledWith(500);
    });

    it("异常：返回空数组", async () => {
      const chain = makeChain();
      chain.get.mockRejectedValueOnce(new Error("fail"));
      mockDb.collection.mockReturnValueOnce(chain);
      expect(await fetchFollowingUids("u1")).toEqual([]);
    });
  });
});

describe("follows 标签关注体系（#322）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.user = null;
    mockBanned.banned = false;
    mockDb._reset();
  });

  describe("toggleTagFollow", () => {
    it("未登录：抛出错误", async () => {
      mockAuth.user = null;
      await expect(toggleTagFollow("React")).rejects.toThrow("请先登录");
    });

    it("被封禁：拒绝", async () => {
      mockAuth.user = { uid: "u1" };
      mockBanned.banned = true;
      await expect(toggleTagFollow("React")).rejects.toThrow("已被封禁");
    });

    it("未关注 → 添加并返回 true", async () => {
      mockAuth.user = { uid: "u1" };
      const chain = makeChain();
      chain.get.mockResolvedValueOnce({ data: [] });
      chain.add.mockResolvedValueOnce({ id: "tf1" });
      mockDb.collection.mockReturnValueOnce(chain);

      const result = await toggleTagFollow("React");
      expect(result).toBe(true);
      expect(chain.where).toHaveBeenCalledWith({ uid: "u1", tagName: "React" });
      expect(chain.add).toHaveBeenCalledWith(
        expect.objectContaining({
          uid: "u1",
          tagName: "React",
        })
      );
    });

    it("已关注 → 取消并返回 false", async () => {
      mockAuth.user = { uid: "u1" };
      const chain = makeChain();
      chain.get.mockResolvedValueOnce({
        data: [{ _id: "tf1", uid: "u1", tagName: "React" }],
      });
      mockDb.collection.mockReturnValueOnce(chain);

      const result = await toggleTagFollow("React");
      expect(result).toBe(false);
      expect(chain.doc).toHaveBeenCalledWith("tf1");
    });
  });

  describe("isTagFollowing", () => {
    it("未登录：返回 false 不查询", async () => {
      mockAuth.user = null;
      expect(await isTagFollowing("React")).toBe(false);
      expect(mockDb.collection).not.toHaveBeenCalled();
    });

    it("已关注：返回 true", async () => {
      mockAuth.user = { uid: "u1" };
      const chain = makeChain();
      chain.get.mockResolvedValueOnce({
        data: [{ _id: "tf1", uid: "u1", tagName: "React" }],
      });
      mockDb.collection.mockReturnValueOnce(chain);
      expect(await isTagFollowing("React")).toBe(true);
    });

    it("未关注：返回 false", async () => {
      mockAuth.user = { uid: "u1" };
      const chain = makeChain();
      chain.get.mockResolvedValueOnce({ data: [] });
      mockDb.collection.mockReturnValueOnce(chain);
      expect(await isTagFollowing("React")).toBe(false);
    });

    it("异常：返回 false", async () => {
      mockAuth.user = { uid: "u1" };
      const chain = makeChain();
      chain.get.mockRejectedValueOnce(new Error("fail"));
      mockDb.collection.mockReturnValueOnce(chain);
      expect(await isTagFollowing("React")).toBe(false);
    });
  });

  describe("fetchFollowedTags", () => {
    it("无 uid 且未登录：返回空数组", async () => {
      mockAuth.user = null;
      expect(await fetchFollowedTags()).toEqual([]);
      expect(mockDb.collection).not.toHaveBeenCalled();
    });

    it("传入 uid：返回标签名数组", async () => {
      const chain = makeChain();
      chain.get.mockResolvedValueOnce({
        data: [
          { _id: "t1", uid: "u1", tagName: "React", createdAt: "2024-01-01" },
          { _id: "t2", uid: "u1", tagName: "Vue", createdAt: "2024-01-02" },
        ],
      });
      mockDb.collection.mockReturnValueOnce(chain);

      const result = await fetchFollowedTags("u1");
      expect(result).toEqual(["React", "Vue"]);
      expect(chain.where).toHaveBeenCalledWith({ uid: "u1" });
      expect(chain.orderBy).toHaveBeenCalledWith("createdAt", "desc");
      expect(chain.limit).toHaveBeenCalledWith(50);
    });

    it("无 uid 但已登录：使用当前用户 uid", async () => {
      mockAuth.user = { uid: "u1" };
      const chain = makeChain();
      chain.get.mockResolvedValueOnce({ data: [] });
      mockDb.collection.mockReturnValueOnce(chain);

      await fetchFollowedTags();
      expect(chain.where).toHaveBeenCalledWith({ uid: "u1" });
    });

    it("异常：返回空数组", async () => {
      const chain = makeChain();
      chain.get.mockRejectedValueOnce(new Error("fail"));
      mockDb.collection.mockReturnValueOnce(chain);
      expect(await fetchFollowedTags("u1")).toEqual([]);
    });
  });
});
