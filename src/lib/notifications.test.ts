import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = vi.hoisted(() => {
  const watcher = { close: vi.fn() };
  const chain = {
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    get: vi.fn(),
    add: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    watch: vi.fn(),
  };
  return {
    collection: vi.fn(() => chain),
    _chain: chain,
    _watcher: watcher,
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

vi.mock("@/lib/cloudbase", () => ({
  app: { database: () => mockDb },
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: { getState: () => ({ user: mockAuth.user }) },
}));

import {
  fetchNotifications,
  fetchUnreadCount,
  markAsRead,
  markAllRead,
  createNotification,
  watchNotifications,
  getTypeLabel,
  type NotificationType,
} from "./notifications";

describe("notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.user = null;
    mockDb._chain.get.mockResolvedValue({ data: [] });
    mockDb._chain.add.mockResolvedValue({ id: "" });
    mockDb._chain.update.mockResolvedValue(undefined);
    mockDb._chain.remove.mockResolvedValue(undefined);
    mockDb._chain.watch.mockReturnValue(mockDb._watcher);
  });

  describe("fetchNotifications", () => {
    it("成功：将 NotificationDoc 转换为 NotificationItem 列表", async () => {
      mockAuth.user = { uid: "u1" };
      mockDb._chain.get.mockResolvedValue({
        data: [
          {
            _id: "n1",
            uid: "u1",
            actor: "Alice",
            actorUid: "a1",
            type: "answer",
            title: "帖子1",
            link: "/p/1",
            read: false,
            createdAt: "2024-01-01T00:00:00.000Z",
          },
        ],
      });

      const result = await fetchNotifications();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("n1");
      expect(result[0].actor).toBe("Alice");
      expect(result[0].type).toBe("answer");
      expect(result[0].title).toBe("帖子1");
      expect(result[0].link).toBe("/p/1");
      expect(result[0].read).toBe(false);
      expect(result[0].createdAt).toBe("2024-01-01T00:00:00.000Z");
      expect(mockDb.collection).toHaveBeenCalledWith("notifications");
      expect(mockDb._chain.where).toHaveBeenCalledWith({ uid: "u1" });
      expect(mockDb._chain.orderBy).toHaveBeenCalledWith("createdAt", "desc");
      expect(mockDb._chain.limit).toHaveBeenCalledWith(50);
    });

    it("空数据：返回空数组", async () => {
      mockAuth.user = { uid: "u1" };
      mockDb._chain.get.mockResolvedValue({ data: [] });

      const result = await fetchNotifications();

      expect(result).toEqual([]);
    });

    it("请求失败：返回空数组且不抛出", async () => {
      mockAuth.user = { uid: "u1" };
      mockDb._chain.get.mockRejectedValue(new Error("网络错误"));

      const result = await fetchNotifications();

      expect(result).toEqual([]);
    });

    it("未登录：返回空数组且不查询数据库", async () => {
      mockAuth.user = null;

      const result = await fetchNotifications();

      expect(result).toEqual([]);
      expect(mockDb.collection).not.toHaveBeenCalled();
    });
  });

  describe("fetchUnreadCount", () => {
    it("成功：返回未读通知数量", async () => {
      mockAuth.user = { uid: "u1" };
      mockDb._chain.get.mockResolvedValue({
        data: [
          { _id: "n1", read: false },
          { _id: "n2", read: false },
        ],
      });

      const count = await fetchUnreadCount();

      expect(count).toBe(2);
      expect(mockDb._chain.where).toHaveBeenCalledWith({
        uid: "u1",
        read: false,
      });
    });

    it("未登录：返回 0", async () => {
      mockAuth.user = null;

      const count = await fetchUnreadCount();

      expect(count).toBe(0);
      expect(mockDb.collection).not.toHaveBeenCalled();
    });

    it("请求失败：返回 0", async () => {
      mockAuth.user = { uid: "u1" };
      mockDb._chain.get.mockRejectedValue(new Error("fail"));

      const count = await fetchUnreadCount();

      expect(count).toBe(0);
    });
  });

  describe("markAsRead", () => {
    it("成功：调用 update 将单条标记为已读", async () => {
      mockAuth.user = { uid: "u1" };

      await markAsRead("n1");

      expect(mockDb._chain.where).toHaveBeenCalledWith({ _id: "n1", uid: "u1" });
      expect(mockDb._chain.update).toHaveBeenCalledWith({ read: true });
    });

    it("未登录：不调用 update", async () => {
      mockAuth.user = null;

      await markAsRead("n1");

      expect(mockDb._chain.update).not.toHaveBeenCalled();
    });

    it("失败：吞掉错误并输出警告", async () => {
      mockAuth.user = { uid: "u1" };
      mockDb._chain.update.mockRejectedValue(new Error("db error"));
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await expect(markAsRead("n1")).resolves.toBeUndefined();

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe("markAllRead", () => {
    it("成功：将所有未读标记为已读", async () => {
      mockAuth.user = { uid: "u1" };

      await markAllRead();

      expect(mockDb._chain.where).toHaveBeenCalledWith({
        uid: "u1",
        read: false,
      });
      expect(mockDb._chain.update).toHaveBeenCalledWith({ read: true });
    });

    it("未登录：不调用 update", async () => {
      mockAuth.user = null;

      await markAllRead();

      expect(mockDb._chain.update).not.toHaveBeenCalled();
    });

    it("失败：吞掉错误并输出警告", async () => {
      mockAuth.user = { uid: "u1" };
      mockDb._chain.update.mockRejectedValue(new Error("db error"));
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await expect(markAllRead()).resolves.toBeUndefined();

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe("createNotification", () => {
    it("成功：写入通知文档", async () => {
      mockAuth.user = { uid: "actor-uid", nickname: "Actor" };

      await createNotification({
        uid: "target-uid",
        type: "answer",
        title: "新回答",
        link: "/p/1",
      });

      expect(mockDb._chain.add).toHaveBeenCalledTimes(1);
      expect(mockDb._chain.add).toHaveBeenCalledWith(
        expect.objectContaining({
          uid: "target-uid",
          actor: "Actor",
          actorUid: "actor-uid",
          type: "answer",
          title: "新回答",
          link: "/p/1",
          read: false,
        })
      );
    });

    it("通知自己：不写入文档", async () => {
      mockAuth.user = { uid: "same-uid", nickname: "Me" };

      await createNotification({
        uid: "same-uid",
        type: "answer",
        title: "x",
        link: "/p/1",
      });

      expect(mockDb._chain.add).not.toHaveBeenCalled();
    });

    it("失败：静默失败不抛出", async () => {
      mockAuth.user = { uid: "actor-uid", nickname: "Actor" };
      mockDb._chain.add.mockRejectedValue(new Error("db error"));

      await expect(
        createNotification({
          uid: "target-uid",
          type: "answer",
          title: "x",
          link: "/p/1",
        })
      ).resolves.toBeUndefined();
    });

    it("无 nickname 时回退到 username", async () => {
      mockAuth.user = { uid: "actor-uid", username: "user1" };

      await createNotification({
        uid: "target-uid",
        type: "comment",
        title: "x",
        link: "/p/1",
      });

      expect(mockDb._chain.add).toHaveBeenCalledWith(
        expect.objectContaining({ actor: "user1" })
      );
    });

    it("无 nickname 与 username 时回退到 email", async () => {
      mockAuth.user = { uid: "actor-uid", email: "a@b.com" };

      await createNotification({
        uid: "target-uid",
        type: "comment",
        title: "x",
        link: "/p/1",
      });

      expect(mockDb._chain.add).toHaveBeenCalledWith(
        expect.objectContaining({ actor: "a@b.com" })
      );
    });

    it("无任何用户信息时回退到匿名用户", async () => {
      mockAuth.user = { uid: "actor-uid" };

      await createNotification({
        uid: "target-uid",
        type: "comment",
        title: "x",
        link: "/p/1",
      });

      expect(mockDb._chain.add).toHaveBeenCalledWith(
        expect.objectContaining({ actor: "匿名用户" })
      );
    });
  });

  describe("watchNotifications", () => {
    it("返回包含 close 函数的对象", () => {
      const result = watchNotifications("u1", () => {}, () => {});

      expect(result).toHaveProperty("close");
      expect(typeof result.close).toBe("function");
      expect(mockDb.collection).toHaveBeenCalledWith("notifications");
      expect(mockDb._chain.where).toHaveBeenCalledWith({ uid: "u1" });
      expect(mockDb._chain.watch).toHaveBeenCalledTimes(1);
    });

    it("close 调用 watcher.close", () => {
      const result = watchNotifications("u1", () => {}, () => {});

      result.close();

      expect(mockDb._watcher.close).toHaveBeenCalledTimes(1);
    });

    it("将 snapshot.docs 转为数组后回调 onChange", () => {
      const onChange = vi.fn();
      const onError = vi.fn();

      watchNotifications("u1", onChange, onError);

      const opts = mockDb._chain.watch.mock.calls[0][0] as {
        onChange: (snapshot: { docs?: Record<string, unknown> }) => void;
        onError: (err: Error) => void;
      };
      opts.onChange({ docs: { a: { _id: "a" }, b: { _id: "b" } } });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(
        expect.arrayContaining([{ _id: "a" }, { _id: "b" }])
      );
    });

    it("snapshot.docs 为空时回调空数组", () => {
      const onChange = vi.fn();

      watchNotifications("u1", onChange, () => {});

      const opts = mockDb._chain.watch.mock.calls[0][0] as {
        onChange: (snapshot: { docs?: Record<string, unknown> }) => void;
        onError: (err: Error) => void;
      };
      opts.onChange({});

      expect(onChange).toHaveBeenCalledWith([]);
    });

    it("将 onError 透传给 watch", () => {
      const onError = vi.fn();

      watchNotifications("u1", () => {}, onError);

      const opts = mockDb._chain.watch.mock.calls[0][0] as {
        onChange: (snapshot: { docs?: Record<string, unknown> }) => void;
        onError: (err: Error) => void;
      };
      expect(opts.onError).toBe(onError);
    });
  });

  describe("getTypeLabel", () => {
    it("返回已知类型的标签", () => {
      expect(getTypeLabel("answer")).toBe("回答了你的帖子");
      expect(getTypeLabel("comment")).toBe("回复了你的回答");
      expect(getTypeLabel("resonance")).toBe("共鸣了你的灵感");
      expect(getTypeLabel("join")).toBe("加入了你的协作");
      expect(getTypeLabel("contribute")).toBe("提交了协作贡献");
      expect(getTypeLabel("accept")).toBe("采纳了你的回答");
    });

    it("未知类型返回兜底标签", () => {
      expect(getTypeLabel("unknown" as NotificationType)).toBe("有新动态");
    });
  });
});
