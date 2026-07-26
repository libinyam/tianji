import { describe, it, expect, beforeEach } from "vitest";
import { main, __setTestDb } from "./index.js";

// #404/#40/#415 安全统一批测试：
// - createIdea/updateIdea/createWorkshop/updateWorkshopMeta/updateWorkshopContent
//   迁入云函数并接入服务端审核后的行为
// - createNotification 服务端化（actorUid 取自登录态防冒充）
// - __setTestDb 第二参数注入 callFunction，覆盖审核 block/fail-closed 分支（#315/#415）
// fake db 与 index.test.js 保持同构（独立副本，避免并行分支冲突，后续可抽公共 test-utils）。

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

function setupDb(opts) {
  store = {};
  __setTestDb(makeFakeDb(), opts);
}

beforeEach(() => {
  setupDb();
});

function ctx(uid) {
  return { userInfo: { uid } };
}

describe("createIdea（issue #404）", () => {
  it("成功：文档落库，authorUid 取自登录态", async () => {
    const res = await main(
      {
        action: "createIdea",
        title: "标题",
        summary: "摘要",
        topic: "话题",
        tags: ["t1"],
        author: "作者名",
      },
      ctx("u1"),
    );

    expect(res.ok).toBe(true);
    expect(res.data.id).toBe("gen_1");
    const doc = store.ideas.get("gen_1");
    expect(doc).toMatchObject({
      title: "标题",
      summary: "摘要",
      author: "作者名",
      authorUid: "u1",
      topic: "话题",
      tags: ["t1"],
      resonance: 0,
      replies: 0,
    });
  });

  it("敏感词被本地快筛拦截，未落库", async () => {
    const res = await main(
      { action: "createIdea", title: "标题", summary: "这是广告", author: "a" },
      ctx("u1"),
    );
    expect(res.ok).toBe(false);
    expect(res.error).toContain("敏感词");
    expect(store.ideas?.size ?? 0).toBe(0);
  });

  it("被封禁用户被拒", async () => {
    store.users_v2 = new Map([["banned", { _id: "banned", banned: true }]]);
    const res = await main({ action: "createIdea", title: "标题", summary: "摘要" }, ctx("banned"));
    expect(res.ok).toBe(false);
    expect(res.error).toContain("封禁");
  });

  it("未登录被拒", async () => {
    const res = await main({ action: "createIdea", title: "标题", summary: "摘要" }, {});
    expect(res.ok).toBe(false);
    expect(res.error).toContain("请先登录");
  });
});

describe("updateIdea（issue #404）", () => {
  function seedIdea() {
    store.ideas = new Map([
      ["i1", { _id: "i1", authorUid: "owner", title: "旧标题", summary: "旧摘要", tags: [] }],
    ]);
  }

  it("非作者编辑被拒且内容不变", async () => {
    seedIdea();
    const res = await main(
      { action: "updateIdea", ideaId: "i1", title: "篡改", summary: "篡改" },
      ctx("intruder"),
    );
    expect(res.ok).toBe(false);
    expect(res.error).toBe("无权编辑他人灵感");
    expect(store.ideas.get("i1").title).toBe("旧标题");
  });

  it("作者编辑成功", async () => {
    seedIdea();
    const res = await main(
      { action: "updateIdea", ideaId: "i1", title: "新标题", summary: "新摘要", tags: ["t"] },
      ctx("owner"),
    );
    expect(res.ok).toBe(true);
    const doc = store.ideas.get("i1");
    expect(doc.title).toBe("新标题");
    expect(doc.summary).toBe("新摘要");
    expect(doc.tags).toEqual(["t"]);
  });

  it("审核返回 block 时编辑被拒（#415 注入 callFunction）", async () => {
    setupDb({
      callFunction: async () => ({
        result: { ok: false, suggestion: "block", label: "Porn", score: 99 },
      }),
    });
    seedIdea();
    const res = await main(
      { action: "updateIdea", ideaId: "i1", title: "新标题", summary: "新摘要" },
      ctx("owner"),
    );
    expect(res.ok).toBe(false);
    expect(res.error).toContain("涉黄");
    expect(store.ideas.get("i1").title).toBe("旧标题");
  });
});

describe("createWorkshop（issue #404）", () => {
  it("成功：文档落库，creatorUid/participants 取自登录态，outline 清洗", async () => {
    const res = await main(
      {
        action: "createWorkshop",
        title: "项目",
        type: "教材",
        description: "描述",
        content: "内容",
        outline: [{ id: "ch1", title: "第一章", brief: "简介" }],
        tags: ["AI"],
        creator: "创建者",
      },
      ctx("u1"),
    );

    expect(res.ok).toBe(true);
    const doc = store.workshops.get("gen_1");
    expect(doc).toMatchObject({
      title: "项目",
      creator: "创建者",
      creatorUid: "u1",
      participants: ["u1"],
      status: "招募中",
    });
    expect(doc.outline).toEqual([{ id: "ch1", title: "第一章", brief: "简介" }]);
  });

  it("敏感词（含大纲文本）被拦截，未落库", async () => {
    const res = await main(
      {
        action: "createWorkshop",
        title: "项目",
        description: "描述",
        outline: [{ id: "ch1", title: "赌博攻略", brief: "x" }],
      },
      ctx("u1"),
    );
    expect(res.ok).toBe(false);
    expect(res.error).toContain("敏感词");
    expect(store.workshops?.size ?? 0).toBe(0);
  });
});

describe("updateWorkshopMeta（issue #404）", () => {
  function seedWorkshop() {
    store.workshops = new Map([
      [
        "w1",
        {
          _id: "w1",
          creatorUid: "creator",
          participants: ["creator", "p1"],
          title: "旧标题",
          description: "旧描述",
          status: "招募中",
        },
      ],
    ]);
  }

  it("非创建者被拒且数据未变", async () => {
    seedWorkshop();
    const res = await main(
      { action: "updateWorkshopMeta", workshopId: "w1", title: "篡改" },
      ctx("p1"),
    );
    expect(res.ok).toBe(false);
    expect(res.error).toContain("仅创建者");
    expect(store.workshops.get("w1").title).toBe("旧标题");
  });

  it("创建者更新标题与状态成功", async () => {
    seedWorkshop();
    const res = await main(
      { action: "updateWorkshopMeta", workshopId: "w1", title: "新标题", status: "创作中" },
      ctx("creator"),
    );
    expect(res.ok).toBe(true);
    const doc = store.workshops.get("w1");
    expect(doc.title).toBe("新标题");
    expect(doc.status).toBe("创作中");
    expect(doc.description).toBe("旧描述");
    expect(doc.updatedAt).toEqual(expect.any(String));
  });
});

describe("updateWorkshopContent 接入审核（issue #404）", () => {
  function seedWorkshop() {
    store.workshops = new Map([
      [
        "w1",
        { _id: "w1", creatorUid: "creator", participants: ["creator", "p1"], content: "旧内容" },
      ],
    ]);
  }

  it("参与者更新正文成功", async () => {
    seedWorkshop();
    const res = await main(
      { action: "updateWorkshopContent", workshopId: "w1", content: "新内容" },
      ctx("p1"),
    );
    expect(res.ok).toBe(true);
    expect(store.workshops.get("w1").content).toBe("新内容");
  });

  it("非参与者被拒", async () => {
    seedWorkshop();
    const res = await main(
      { action: "updateWorkshopContent", workshopId: "w1", content: "x" },
      ctx("outsider"),
    );
    expect(res.ok).toBe(false);
    expect(res.error).toContain("请先加入项目");
  });

  it("正文含敏感词被拦截且内容不变", async () => {
    seedWorkshop();
    const res = await main(
      { action: "updateWorkshopContent", workshopId: "w1", content: "这是诈骗内容" },
      ctx("p1"),
    );
    expect(res.ok).toBe(false);
    expect(res.error).toContain("敏感词");
    expect(store.workshops.get("w1").content).toBe("旧内容");
  });
});

describe("createNotification 服务端化（issue #40）", () => {
  it("成功：actorUid 取自登录态，接收者/类型/链接落库", async () => {
    const res = await main(
      {
        action: "createNotification",
        targetUid: "target",
        type: "answer",
        title: "新回答",
        link: "/discussion/p1",
        actor: "触发者",
      },
      ctx("actor-uid"),
    );

    expect(res.ok).toBe(true);
    const doc = store.notifications.get("gen_1");
    expect(doc).toMatchObject({
      uid: "target",
      actor: "触发者",
      actorUid: "actor-uid",
      type: "answer",
      title: "新回答",
      link: "/discussion/p1",
      read: false,
    });
  });

  it("绝对 URL 外链被拒（防钓鱼）", async () => {
    const res = await main(
      {
        action: "createNotification",
        targetUid: "target",
        type: "answer",
        title: "x",
        link: "https://evil.example.com",
      },
      ctx("actor-uid"),
    );
    expect(res.ok).toBe(false);
    expect(res.error).toBe("非法链接");
    expect(store.notifications?.size ?? 0).toBe(0);
  });

  it("协议相对链接 // 被拒", async () => {
    const res = await main(
      {
        action: "createNotification",
        targetUid: "t",
        type: "answer",
        title: "x",
        link: "//evil.com",
      },
      ctx("actor-uid"),
    );
    expect(res.ok).toBe(false);
    expect(res.error).toBe("非法链接");
  });

  it("白名单外的通知类型被拒", async () => {
    const res = await main(
      { action: "createNotification", targetUid: "t", type: "hacked", title: "x", link: "/p" },
      ctx("actor-uid"),
    );
    expect(res.ok).toBe(false);
    expect(res.error).toBe("非法通知类型");
  });

  it("给自己发通知被静默跳过", async () => {
    const res = await main(
      { action: "createNotification", targetUid: "me", type: "answer", title: "x", link: "/p" },
      ctx("me"),
    );
    expect(res.ok).toBe(true);
    expect(res.data.skipped).toBe(true);
    expect(store.notifications?.size ?? 0).toBe(0);
  });

  it("未登录被拒", async () => {
    const res = await main(
      { action: "createNotification", targetUid: "t", type: "answer", title: "x", link: "/p" },
      {},
    );
    expect(res.ok).toBe(false);
    expect(res.error).toContain("请先登录");
  });
});

describe("审核 fail-closed（issue #315/#415）", () => {
  it("审核服务抛错时发帖被拒并提示稍后重试，未落库", async () => {
    setupDb({
      callFunction: async () => {
        throw new Error("service down");
      },
    });

    const res = await main(
      { action: "createPost", title: "标题", body: "正文", author: "a" },
      ctx("u1"),
    );

    expect(res.ok).toBe(false);
    expect(res.error).toContain("稍后重试");
    expect(store.posts?.size ?? 0).toBe(0);
  });

  it("审核返回 block 时发帖被拒并映射违规类别", async () => {
    setupDb({
      callFunction: async () => ({
        result: { ok: false, suggestion: "block", label: "Ad", score: 95 },
      }),
    });

    const res = await main(
      { action: "createPost", title: "标题", body: "正文", author: "a" },
      ctx("u1"),
    );

    expect(res.ok).toBe(false);
    expect(res.error).toContain("广告");
    expect(store.posts?.size ?? 0).toBe(0);
  });

  it("默认注入仍为放行，兼容既有测试", async () => {
    const res = await main(
      { action: "createPost", title: "标题", body: "正文", author: "a" },
      ctx("u1"),
    );
    expect(res.ok).toBe(true);
    expect(store.posts.size).toBe(1);
  });
});
