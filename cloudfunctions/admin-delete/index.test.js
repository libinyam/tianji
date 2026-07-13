import { describe, it, expect, beforeEach, vi } from "vitest";

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
      const chain = {
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
        where(filter) {
          const entries = Object.entries(filter);
          const match = (doc) => entries.every(([k, v]) => doc[k] === v);
          return {
            async remove() {
              let deleted = 0;
              for (const [id, doc] of [...col.entries()]) {
                if (match(doc)) {
                  col.delete(id);
                  deleted++;
                }
              }
              return { deleted };
            },
            async get() {
              return { data: [...col.values()].filter(match) };
            },
          };
        },
      };
      return chain;
    },
  };
}

let main;
let __setTestDb;

beforeEach(async () => {
  store = {};
  process.env.ADMIN_UIDS = "admin-001";
  vi.resetModules();
  const mod = await import("./index.js");
  main = mod.main;
  __setTestDb = mod.__setTestDb;
  __setTestDb(makeFakeDb());
});

function ctx(uid) {
  return { userInfo: { uid } };
}

describe("admin-delete 内容删除", () => {
  it("deletePost 成功删除帖子并级联清理关联数据", async () => {
    store.posts = new Map([
      ["post0000000001", { _id: "post0000000001", title: "测试帖" }],
    ]);
    store.favorites = new Map([
      ["f1", { _id: "f1", targetId: "post0000000001" }],
    ]);
    store.reports = new Map([
      ["r1", { _id: "r1", targetId: "post0000000001" }],
    ]);

    const res = await main(
      { action: "delete", collection: "posts", docId: "post0000000001" },
      ctx("admin-001")
    );

    expect(res.ok).toBe(true);
    expect(store.posts.has("post0000000001")).toBe(false);
    expect(store.favorites.size).toBe(0);
    expect(store.reports.size).toBe(0);
  });

  it("deleteIdea 成功删除灵感", async () => {
    store.ideas = new Map([
      ["idea0000000001", { _id: "idea0000000001", content: "灵感" }],
    ]);

    const res = await main(
      { action: "delete", collection: "ideas", docId: "idea0000000001" },
      ctx("admin-001")
    );

    expect(res.ok).toBe(true);
    expect(store.ideas.has("idea0000000001")).toBe(false);
  });

  it("deleteBook 成功删除资源", async () => {
    store.books = new Map([
      ["book0000000001", { _id: "book0000000001", title: "书" }],
    ]);

    const res = await main(
      { action: "delete", collection: "books", docId: "book0000000001" },
      ctx("admin-001")
    );

    expect(res.ok).toBe(true);
    expect(store.books.has("book0000000001")).toBe(false);
  });

  it("非管理员调用被拒绝且不删除文档", async () => {
    store.posts = new Map([
      ["post0000000001", { _id: "post0000000001", title: "测试帖" }],
    ]);

    const res = await main(
      { action: "delete", collection: "posts", docId: "post0000000001" },
      ctx("normal-user")
    );

    expect(res.ok).toBe(false);
    expect(res.error).toContain("无管理员权限");
    expect(store.posts.has("post0000000001")).toBe(true);
  });

  it("删除不存在的文档不抛错并返回 ok", async () => {
    store.posts = new Map();

    const res = await main(
      { action: "delete", collection: "posts", docId: "post0000000001" },
      ctx("admin-001")
    );

    expect(res.ok).toBe(true);
    expect(store.posts.size).toBe(0);
  });
});
