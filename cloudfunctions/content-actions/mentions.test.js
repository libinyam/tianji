import { describe, it, expect, beforeEach } from "vitest";
import { main, __setTestDb } from "./index.js";

// #154 @提及测试:回答/评论/灵感评论中 @线程参与者昵称 → mention 通知。
// fake db 与 index.test.js 同构(独立副本)。

let store;

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
  __setTestDb(makeFakeDb());
});

function ctx(uid) {
  return { userInfo: { uid } };
}

function mentionNotifs() {
  return Array.from(store.notifications?.values() ?? []).filter((n) => n.type === "mention");
}

function seedPost() {
  store.posts = new Map([
    [
      "p1",
      {
        _id: "p1",
        title: "帖子标题",
        author: "楼主",
        authorUid: "op-uid",
        locked: false,
        answersCount: 1,
        answerList: [
          {
            id: "a1",
            author: "回答者甲",
            authorUid: "answerer-uid",
            content: "既有回答",
            comments: [{ id: "c1", author: "评论者乙", authorUid: "commenter-uid", content: "x" }],
          },
        ],
      },
    ],
  ]);
}

describe("@提及（issue #154）", () => {
  it("回答中 @既有评论者 → 该用户收到 mention 通知", async () => {
    seedPost();
    const res = await main(
      {
        action: "submitAnswer",
        postId: "p1",
        content: "同意 @评论者乙 的看法",
        author: "新回答者",
      },
      ctx("new-uid"),
    );
    expect(res.ok).toBe(true);

    const mentions = mentionNotifs();
    expect(mentions).toHaveLength(1);
    expect(mentions[0]).toMatchObject({
      uid: "commenter-uid",
      actorUid: "new-uid",
      actor: "新回答者",
      type: "mention",
      title: "帖子标题",
      link: "/discussion/p1",
    });
  });

  it("回答中 @帖子作者 → 不发 mention(已有 answer 直接通知,避免重复)", async () => {
    seedPost();
    await main(
      { action: "submitAnswer", postId: "p1", content: "@楼主 看这里", author: "新回答者" },
      ctx("new-uid"),
    );
    expect(mentionNotifs()).toHaveLength(0);
    // answer 直接通知仍然存在
    const answers = Array.from(store.notifications.values()).filter((n) => n.type === "answer");
    expect(answers).toHaveLength(1);
  });

  it("@自己 → 不通知", async () => {
    seedPost();
    await main(
      { action: "submitAnswer", postId: "p1", content: "@回答者甲 补充一下", author: "回答者甲" },
      ctx("answerer-uid"),
    );
    expect(mentionNotifs()).toHaveLength(0);
  });

  it("内容未提及任何参与者 → 不通知", async () => {
    seedPost();
    await main(
      { action: "submitAnswer", postId: "p1", content: "无提及内容 @路人丙", author: "新回答者" },
      ctx("new-uid"),
    );
    expect(mentionNotifs()).toHaveLength(0);
  });

  it("评论中 @帖子作者 → 发 mention;@所评论回答的作者 → 不发(客户端已发 comment 通知)", async () => {
    seedPost();
    const res = await main(
      {
        action: "submitComment",
        postId: "p1",
        answerId: "a1",
        content: "@楼主 @回答者甲 都看看",
        author: "评论者丙",
      },
      ctx("c3-uid"),
    );
    expect(res.ok).toBe(true);

    const mentions = mentionNotifs();
    expect(mentions).toHaveLength(1);
    expect(mentions[0].uid).toBe("op-uid");
  });

  it("灵感评论 @既有评论者 → mention 指向 /ideas 链接", async () => {
    store.ideas = new Map([
      [
        "i1",
        {
          _id: "i1",
          title: "灵感标题",
          author: "灵感作者",
          authorUid: "idea-op",
          replies: 1,
          comments: [{ id: "c1", author: "评论者乙", authorUid: "commenter-uid", content: "x" }],
        },
      ],
    ]);
    const res = await main(
      { action: "addIdeaComment", ideaId: "i1", content: "回应 @评论者乙", author: "评论者丁" },
      ctx("c4-uid"),
    );
    expect(res.ok).toBe(true);

    const mentions = mentionNotifs();
    expect(mentions).toHaveLength(1);
    expect(mentions[0]).toMatchObject({ uid: "commenter-uid", link: "/ideas/i1" });
  });

  it("昵称为匿名用户的参与者不参与匹配", async () => {
    store.posts = new Map([
      [
        "p1",
        {
          _id: "p1",
          title: "帖子",
          author: "匿名用户",
          authorUid: "anon-op",
          locked: false,
          answerList: [],
        },
      ],
    ]);
    await main(
      {
        action: "submitComment",
        postId: "p1",
        answerId: "missing",
        content: "@匿名用户",
        author: "x",
      },
      ctx("u1"),
    );
    // (回答不存在会先失败,换用 submitAnswer 验证)
    await main(
      { action: "submitAnswer", postId: "p1", content: "@匿名用户 你好", author: "新回答者" },
      ctx("new-uid"),
    );
    expect(mentionNotifs()).toHaveLength(0);
  });
});
