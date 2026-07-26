import { describe, it, expect, beforeEach } from "vitest";
import { main, __setTestDb } from "./index.js";

// 通过 __setTestDb 注入可控的假数据库，验证声望加分的幂等性（issue #243）。
// 关键：reputation_events 集合以 eventId 为唯一键，doc().set() 首次返回
// upserted，重放时返回 replaced，据此判断是否为新事件。
// 当前登录用户通过 context.userInfo.uid 注入（main 中 auth 会失败并回退到它）。

let store;
let db;

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
                } else if (v && typeof v === "object" && v.__addToSet !== undefined) {
                  const arr = Array.isArray(next[k]) ? next[k] : [];
                  if (!arr.includes(v.__addToSet)) arr.push(v.__addToSet);
                  next[k] = arr;
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
              const existed = col.has(id);
              col.delete(id);
              return { deleted: existed ? 1 : 0 };
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

beforeEach(() => {
  store = {};
  db = makeFakeDb();
  __setTestDb(db);
});

function ctx(uid) {
  return { userInfo: { uid } };
}

function repOf(uid) {
  return store.users_v2?.get(uid)?.reputation || 0;
}

describe("声望加分幂等（issue #243）", () => {
  it("同一回答被采纳重复触发只加分一次", async () => {
    store.posts = new Map([
      [
        "p1",
        {
          _id: "p1",
          authorUid: "asker",
          answerList: [{ id: "a1", authorUid: "answerer", accepted: false }],
        },
      ],
    ]);
    store.users_v2 = new Map();

    const event = { action: "acceptAnswer", postId: "p1", answerId: "a1", accept: true };
    await main(event, ctx("asker"));
    await main(event, ctx("asker"));
    await main(event, ctx("asker"));

    expect(repOf("answerer")).toBe(15);
    expect(store.reputation_events.size).toBe(1);
  });

  it("投票取消后重新投票不会重复加分", async () => {
    store.posts = new Map([
      [
        "p1",
        {
          _id: "p1",
          authorUid: "asker",
          answerList: [{ id: "a1", authorUid: "answerer", votes: 0 }],
        },
      ],
    ]);
    store.users_v2 = new Map();

    const up = { action: "voteAnswer", postId: "p1", answerId: "a1", isUpvote: true };
    const down = { action: "voteAnswer", postId: "p1", answerId: "a1", isUpvote: false };

    await main(up, ctx("voter-1"));
    await main(down, ctx("voter-1"));
    await main(up, ctx("voter-1"));
    await main(up, ctx("voter-1"));

    expect(repOf("answerer")).toBe(10);
  });

  it("提交回答加分并按 answerId 记录唯一事件", async () => {
    store.posts = new Map([["p1", { _id: "p1", authorUid: "asker", locked: false }]]);
    store.users_v2 = new Map();

    // answerId 含时间戳+随机串，每次提交都是不同的回答/事件
    const event = { action: "submitAnswer", postId: "p1", content: "答案内容" };
    const res = await main(event, ctx("answerer"));
    const answerId = res.data.id;

    expect(repOf("answerer")).toBe(5);
    expect(store.reputation_events.size).toBe(1);
    expect(store.reputation_events.has(`answer:create:${answerId}`)).toBe(true);
  });

  it("同一采纳事件的重放请求不重复登记", async () => {
    // 直接模拟事件重放：先手动写入事件，再触发采纳，验证不再加分
    store.posts = new Map([
      [
        "p1",
        {
          _id: "p1",
          authorUid: "asker",
          answerList: [{ id: "a1", authorUid: "answerer", accepted: false }],
        },
      ],
    ]);
    store.users_v2 = new Map();
    store.reputation_events = new Map([
      ["accept:answer:p1:a1", { eventId: "accept:answer:p1:a1", uid: "answerer", points: 15 }],
    ]);

    await main({ action: "acceptAnswer", postId: "p1", answerId: "a1", accept: true }, ctx("asker"));

    // 事件已存在，不应再加分
    expect(repOf("answerer")).toBe(0);
    expect(store.reputation_events.size).toBe(1);
  });

  it("awardCreateReputation 带 entityId 时重复提交只加分一次", async () => {
    store.posts = new Map([["post-123", { _id: "post-123", authorUid: "author-1" }]]);
    store.users_v2 = new Map();

    const event = {
      action: "awardCreateReputation",
      reason: "createPost",
      entityId: "post-123",
    };
    await main(event, ctx("author-1"));
    await main(event, ctx("author-1"));

    expect(repOf("author-1")).toBe(2);
    expect(store.reputation_events.size).toBe(1);
  });

  it("投票者给自己的回答点赞不加分", async () => {
    store.posts = new Map([
      [
        "p1",
        {
          _id: "p1",
          authorUid: "asker",
          answerList: [{ id: "a1", authorUid: "voter-1", votes: 0 }],
        },
      ],
    ]);
    store.users_v2 = new Map();

    await main({ action: "voteAnswer", postId: "p1", answerId: "a1", isUpvote: true }, ctx("voter-1"));

    expect(repOf("voter-1")).toBe(0);
  });
});

describe("awardCreateReputation", () => {
  it("正常加分：作者创建内容后获得声望", async () => {
    store.users_v2 = new Map();
    await db.collection("posts").doc("p1").set({ authorUid: "user1" });

    const res = await main(
      { action: "awardCreateReputation", reason: "createPost", entityId: "p1" },
      ctx("user1")
    );

    expect(res.ok).toBe(true);
    expect(res.data.awarded).toBe(true);
    expect(repOf("user1")).toBe(2);
  });

  it("内容不存在时返回失败", async () => {
    store.users_v2 = new Map();

    const res = await main(
      { action: "awardCreateReputation", reason: "createPost", entityId: "no-exist" },
      ctx("user1")
    );

    expect(res.ok).toBe(false);
    expect(res.error).toContain("内容不存在");
  });

  it("非作者调用返回失败", async () => {
    store.users_v2 = new Map();
    await db.collection("posts").doc("p1").set({ authorUid: "user1" });

    const res = await main(
      { action: "awardCreateReputation", reason: "createPost", entityId: "p1" },
      ctx("user2")
    );

    expect(res.ok).toBe(false);
  });

  it("缺少 entityId 时返回失败", async () => {
    store.users_v2 = new Map();

    const res = await main(
      { action: "awardCreateReputation", reason: "createPost" },
      ctx("user1")
    );

    expect(res.ok).toBe(false);
  });

  it("同一 entityId 重复调用只加分一次", async () => {
    store.users_v2 = new Map();
    await db.collection("posts").doc("p1").set({ authorUid: "user1" });

    const event = { action: "awardCreateReputation", reason: "createPost", entityId: "p1" };
    const r1 = await main(event, ctx("user1"));
    const r2 = await main(event, ctx("user1"));

    expect(r1.data.awarded).toBe(true);
    expect(r2.data.awarded).toBe(false);
    expect(repOf("user1")).toBe(2);
  });

  it("createBook reason 为书籍上传者加分", async () => {
    store.users_v2 = new Map();
    await db.collection("books").doc("b1").set({ uploaderUid: "user1" });

    const res = await main(
      { action: "awardCreateReputation", reason: "createBook", entityId: "b1" },
      ctx("user1")
    );

    expect(res.ok).toBe(true);
    expect(res.data.awarded).toBe(true);
    expect(repOf("user1")).toBe(3);
  });
});

describe("服务端限流（issue #277）", () => {
  it("超过阈值后操作被拒绝", async () => {
    store.posts = new Map([["p1", { _id: "p1", authorUid: "asker", locked: false }]]);
    store.users_v2 = new Map();

    for (let i = 0; i < 15; i++) {
      const res = await main({ action: "submitAnswer", postId: "p1", content: `回答${i}` }, ctx("user1"));
      expect(res.ok).toBe(true);
    }

    const res = await main({ action: "submitAnswer", postId: "p1", content: "超限" }, ctx("user1"));
    expect(res.ok).toBe(false);
    expect(res.error).toContain("操作过于频繁");
  });

  it("不同用户互不影响", async () => {
    store.posts = new Map([["p1", { _id: "p1", authorUid: "asker", locked: false }]]);
    store.users_v2 = new Map();

    for (let i = 0; i < 14; i++) {
      await main({ action: "submitAnswer", postId: "p1", content: `u1-${i}` }, ctx("user1"));
    }

    const res = await main({ action: "submitAnswer", postId: "p1", content: "user2回答" }, ctx("user2"));
    expect(res.ok).toBe(true);
  });

  it("不同 action 独立计数", async () => {
    store.posts = new Map([["p1", { _id: "p1", authorUid: "asker", locked: false }]]);
    store.users_v2 = new Map();

    for (let i = 0; i < 14; i++) {
      await main({ action: "submitAnswer", postId: "p1", content: `回答${i}` }, ctx("user1"));
    }

    store.posts.set("p2", { _id: "p2", authorUid: "user1" });
    const res = await main(
      { action: "awardCreateReputation", reason: "createPost", entityId: "p2" },
      ctx("user1")
    );
    expect(res.ok).toBe(true);
  });
});

describe("灵感评论（issue #400）", () => {
  // 核心回归：评论走直写 DB 时曾被安全规则（ideas update 仅作者）拒绝，
  // 迁移到云函数后非作者必须能正常评论他人灵感。
  function seedIdea(overrides = {}) {
    store.ideas = new Map([
      [
        "i1",
        {
          _id: "i1",
          authorUid: "author1",
          title: "灵感标题",
          comments: [],
          replies: 0,
          ...overrides,
        },
      ],
    ]);
  }

  it("非作者可以评论他人灵感，并返回作者信息供发通知", async () => {
    seedIdea();

    const res = await main(
      { action: "addIdeaComment", ideaId: "i1", content: "很有启发", author: "评论者" },
      ctx("commenter")
    );

    expect(res.ok).toBe(true);
    expect(res.data.comment).toMatchObject({
      author: "评论者",
      authorUid: "commenter",
      content: "很有启发",
    });
    expect(res.data.ideaAuthorUid).toBe("author1");
    expect(res.data.ideaTitle).toBe("灵感标题");

    const idea = store.ideas.get("i1");
    expect(idea.comments).toHaveLength(1);
    expect(idea.comments[0].authorUid).toBe("commenter");
    expect(idea.replies).toBe(1);
  });

  it("内容含敏感词被本地快筛拦截，数据未写入", async () => {
    seedIdea();

    const res = await main(
      { action: "addIdeaComment", ideaId: "i1", content: "这是广告内容", author: "评论者" },
      ctx("commenter")
    );

    expect(res.ok).toBe(false);
    expect(res.error).toContain("敏感词");
    expect(store.ideas.get("i1").comments).toHaveLength(0);
  });

  it("被封禁用户评论被拒", async () => {
    seedIdea();
    store.users_v2 = new Map([["banned-user", { _id: "banned-user", banned: true }]]);

    const res = await main(
      { action: "addIdeaComment", ideaId: "i1", content: "评论", author: "封禁者" },
      ctx("banned-user")
    );

    expect(res.ok).toBe(false);
    expect(res.error).toContain("封禁");
    expect(store.ideas.get("i1").comments).toHaveLength(0);
  });

  it("未登录被拒", async () => {
    seedIdea();

    const res = await main({ action: "addIdeaComment", ideaId: "i1", content: "评论" }, {});

    expect(res.ok).toBe(false);
    expect(res.error).toContain("请先登录");
  });

  it("灵感不存在返回失败", async () => {
    store.ideas = new Map();

    const res = await main(
      { action: "addIdeaComment", ideaId: "missing", content: "评论", author: "评论者" },
      ctx("commenter")
    );

    expect(res.ok).toBe(false);
    expect(res.error).toBe("灵感不存在");
  });

  it("评论作者可删除自己的评论，replies 相应减一", async () => {
    seedIdea({
      comments: [
        { id: "c1", authorUid: "commenter", content: "我的评论" },
        { id: "c2", authorUid: "other", content: "别人的评论" },
      ],
      replies: 2,
    });

    const res = await main(
      { action: "deleteIdeaComment", ideaId: "i1", commentId: "c1" },
      ctx("commenter")
    );

    expect(res.ok).toBe(true);
    const idea = store.ideas.get("i1");
    expect(idea.comments).toHaveLength(1);
    expect(idea.comments[0].id).toBe("c2");
    expect(idea.replies).toBe(1);
  });

  it("非评论作者删除被拒且数据未变", async () => {
    seedIdea({
      comments: [{ id: "c1", authorUid: "commenter", content: "评论" }],
      replies: 1,
    });

    const res = await main(
      { action: "deleteIdeaComment", ideaId: "i1", commentId: "c1" },
      ctx("intruder")
    );

    expect(res.ok).toBe(false);
    expect(res.error).toBe("无权删除他人评论");
    const idea = store.ideas.get("i1");
    expect(idea.comments).toHaveLength(1);
    expect(idea.replies).toBe(1);
  });
});
