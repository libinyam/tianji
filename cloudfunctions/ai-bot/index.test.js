import { describe, it, expect, beforeEach, vi } from "vitest";
import { main, __setTestDb } from "./index.js";

// 通过 __setTestDb 注入可控的假数据库与假 auth，
// 避免加载真实 CloudBase SDK（缺凭据会失败）。
// 这与 content-actions 的测试模式保持一致。

const store = {};

const command = {
  inc: (n) => ({ __inc: n }),
  push: (arr) => ({ __push: arr }),
  addToSet: (v) => ({ __addToSet: v }),
};

function makeFakeDb() {
  return {
    command,
    collection(name) {
      if (!store[name]) store[name] = new Map();
      const col = store[name];
      return {
        doc(id) {
          return {
            async get() {
              return { data: col.has(id) ? [col.get(id)] : [] };
            },
            async set(v) {
              const existed = col.has(id);
              col.set(id, { ...(col.get(id) || {}), ...v });
              return existed ? { replaced: 1 } : { upserted: 1 };
            },
            async update(patch) {
              const cur = col.get(id) || {};
              const next = { ...cur };
              for (const [k, v] of Object.entries(patch)) {
                if (v && typeof v === "object" && v.__inc !== undefined) {
                  next[k] = (next[k] || 0) + v.__inc;
                } else if (v && typeof v === "object" && v.__push !== undefined) {
                  const arr = Array.isArray(next[k]) ? next[k] : [];
                  next[k] = arr.concat(v.__push);
                } else {
                  next[k] = v;
                }
              }
              col.set(id, next);
              return { updated: 1 };
            },
            async remove() {
              col.delete(id);
              return { deleted: 1 };
            },
          };
        },
        async add(v) {
          const id = `gen_${col.size + 1}`;
          col.set(id, { _id: id, ...v });
          return { id };
        },
      };
    },
  };
}

const mockAuth = {
  getEndUserInfo: vi.fn().mockResolvedValue({ userInfo: { uid: "" } }),
};

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  vi.clearAllMocks();
  mockAuth.getEndUserInfo.mockResolvedValue({ userInfo: { uid: "" } });
  process.env.DEEPSEEK_API_KEY = "test-key";
  __setTestDb(makeFakeDb(), mockAuth);
});

function ctx(uid) {
  return { userInfo: { uid } };
}

describe("ai-bot", () => {
  describe("参数校验", () => {
    it("缺少 DEEPSEEK_API_KEY 返回错误", async () => {
      delete process.env.DEEPSEEK_API_KEY;
      const res = await main({ postId: "p1", postTitle: "t", postBody: "b" }, ctx("u1"));
      expect(res.ok).toBe(false);
      expect(res.error).toContain("DEEPSEEK_API_KEY");
    });

    it("发帖回复缺少 postTitle 返回错误", async () => {
      const res = await main({ postId: "p1", postBody: "b" }, ctx("u1"));
      expect(res.ok).toBe(false);
      expect(res.error).toContain("缺少必要参数");
    });

    it("发帖回复缺少 postBody 返回错误", async () => {
      const res = await main({ postId: "p1", postTitle: "t" }, ctx("u1"));
      expect(res.ok).toBe(false);
      expect(res.error).toContain("缺少必要参数");
    });

    it("评论回复缺少 userComment 返回错误", async () => {
      const res = await main(
        { postId: "p1", postTitle: "t", replyType: "comment", answerId: "a1", answerContent: "c" },
        ctx("u1")
      );
      expect(res.ok).toBe(false);
      expect(res.error).toContain("缺少必要参数");
    });
  });

  describe("限流", () => {
    it("15 秒内重复调用被拒绝", async () => {
      mockAuth.getEndUserInfo.mockResolvedValue({ userInfo: { uid: "u1" } });
      store.ai_bot_limits = new Map();
      store.ai_bot_limits.set("u1", { lastCallAt: Date.now() - 5000 });

      const res = await main({ postId: "p1", postTitle: "t", postBody: "b" }, ctx("u1"));
      expect(res.ok).toBe(false);
      expect(res.error).toContain("操作过于频繁");
    });

    it("超过 15 秒允许调用", async () => {
      mockAuth.getEndUserInfo.mockResolvedValue({ userInfo: { uid: "u1" } });
      store.ai_bot_limits = new Map();
      store.ai_bot_limits.set("u1", { lastCallAt: Date.now() - 20000 });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "测试回复" } }],
        }),
      });

      store.posts = new Map();
      store.posts.set("p1", {
        _id: "p1",
        title: "t",
        body: "b",
        answerList: [],
        answersCount: 0,
      });

      const res = await main({ postId: "p1", postTitle: "t", postBody: "b" }, ctx("u1"));
      expect(res.ok).toBe(true);
    });
  });

  describe("发帖回复", () => {
    it("成功生成回答并写入数据库", async () => {
      mockAuth.getEndUserInfo.mockResolvedValue({ userInfo: { uid: "u1" } });
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "这是一个有用的回答" } }],
        }),
      });

      store.posts = new Map();
      store.posts.set("p1", {
        _id: "p1",
        title: "测试帖子",
        body: "测试内容",
        answerList: [],
        answersCount: 0,
      });

      const res = await main(
        { postId: "p1", postTitle: "测试帖子", postBody: "测试内容", tags: ["数学"] },
        ctx("u1")
      );

      expect(res.ok).toBe(true);
      expect(res.reply).toBe("这是一个有用的回答");
      expect(res.answer).toBeTruthy();
      expect(res.answer.author).toContain("bot");

      const post = store.posts.get("p1");
      expect(post.answerList).toHaveLength(1);
      expect(post.answersCount).toBe(1);
    });

    it("DeepSeek API 返回错误时返回失败", async () => {
      mockAuth.getEndUserInfo.mockResolvedValue({ userInfo: { uid: "u1" } });
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      });

      const res = await main(
        { postId: "p1", postTitle: "t", postBody: "b" },
        ctx("u1")
      );

      expect(res.ok).toBe(false);
      expect(res.error).toContain("AI 服务异常");
    });

    it("AI 返回空内容时返回失败", async () => {
      mockAuth.getEndUserInfo.mockResolvedValue({ userInfo: { uid: "u1" } });
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "" } }],
        }),
      });

      const res = await main(
        { postId: "p1", postTitle: "t", postBody: "b" },
        ctx("u1")
      );

      expect(res.ok).toBe(false);
      expect(res.error).toContain("未返回内容");
    });
  });

  describe("评论回复", () => {
    it("成功生成评论并追加到回答", async () => {
      mockAuth.getEndUserInfo.mockResolvedValue({ userInfo: { uid: "u1" } });
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "好的，谢谢反馈" } }],
        }),
      });

      store.posts = new Map();
      store.posts.set("p1", {
        _id: "p1",
        title: "测试",
        body: "内容",
        answerList: [
          { id: "a1", author: "bot", authorUid: "ai-bot-001", content: "原回答", comments: [] },
        ],
      });

      const res = await main(
        {
          postId: "p1",
          postTitle: "测试",
          replyType: "comment",
          answerId: "a1",
          answerContent: "原回答",
          userComment: "谢谢",
        },
        ctx("u1")
      );

      expect(res.ok).toBe(true);
      expect(res.reply).toBe("好的，谢谢反馈");
      expect(res.comment).toBeTruthy();

      const post = store.posts.get("p1");
      expect(post.answerList[0].comments).toHaveLength(1);
      expect(post.answerList[0].comments[0].author).toContain("bot");
    });

    it("找不到目标回答时返回失败", async () => {
      mockAuth.getEndUserInfo.mockResolvedValue({ userInfo: { uid: "u1" } });
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "回复内容" } }],
        }),
      });

      store.posts = new Map();
      store.posts.set("p1", {
        _id: "p1",
        title: "测试",
        body: "内容",
        answerList: [{ id: "a1", content: "原回答", comments: [] }],
      });

      const res = await main(
        {
          postId: "p1",
          postTitle: "测试",
          replyType: "comment",
          answerId: "nonexistent",
          answerContent: "原回答",
          userComment: "谢谢",
        },
        ctx("u1")
      );

      expect(res.ok).toBe(false);
      expect(res.error).toContain("未找到目标回答");
    });
  });

  describe("sanitizeReply", () => {
    it("移除 script 标签", async () => {
      mockAuth.getEndUserInfo.mockResolvedValue({ userInfo: { uid: "u1" } });
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '<script>alert(1)</script>安全内容' } }],
        }),
      });

      store.posts = new Map();
      store.posts.set("p1", { _id: "p1", title: "t", body: "b", answerList: [], answersCount: 0 });

      const res = await main({ postId: "p1", postTitle: "t", postBody: "b" }, ctx("u1"));
      expect(res.ok).toBe(true);
      expect(res.reply).toBe("安全内容");
    });

    it("移除 HTML 标签", async () => {
      mockAuth.getEndUserInfo.mockResolvedValue({ userInfo: { uid: "u1" } });
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '<b>粗体</b>文本<img src="x">' } }],
        }),
      });

      store.posts = new Map();
      store.posts.set("p1", { _id: "p1", title: "t", body: "b", answerList: [], answersCount: 0 });

      const res = await main({ postId: "p1", postTitle: "t", postBody: "b" }, ctx("u1"));
      expect(res.reply).toBe("粗体文本");
    });

    it("移除 javascript: 协议", async () => {
      mockAuth.getEndUserInfo.mockResolvedValue({ userInfo: { uid: "u1" } });
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '点击 javascript:alert(1) 这里' } }],
        }),
      });

      store.posts = new Map();
      store.posts.set("p1", { _id: "p1", title: "t", body: "b", answerList: [], answersCount: 0 });

      const res = await main({ postId: "p1", postTitle: "t", postBody: "b" }, ctx("u1"));
      // sanitizeReply 只移除 javascript: 协议本身（防止 href="javascript:..."），
      // 不移除后续内容
      expect(res.reply).toBe("点击 alert(1) 这里");
    });

    it("截断超长内容", async () => {
      mockAuth.getEndUserInfo.mockResolvedValue({ userInfo: { uid: "u1" } });
      const longText = "A".repeat(1500);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: longText } }],
        }),
      });

      store.posts = new Map();
      store.posts.set("p1", { _id: "p1", title: "t", body: "b", answerList: [], answersCount: 0 });

      const res = await main({ postId: "p1", postTitle: "t", postBody: "b" }, ctx("u1"));
      expect(res.reply.length).toBe(1000);
    });
  });
});
