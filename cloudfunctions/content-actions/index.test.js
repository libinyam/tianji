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
