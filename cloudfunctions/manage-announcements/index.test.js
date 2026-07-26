import { describe, it, expect, beforeEach } from "vitest";

// #416 公告管理测试：此前顶层同步 cloudbase.init() 导致无凭据环境 require
// 即抛错、无法测试。改为延迟初始化 + __setTestDb 注入后补齐 admin 门控用例。
// ADMIN_UIDS 在模块首次 import 时读取，须在 import 前设置（与 user-admin 同模式）。

let store;
let main;
let __setTestDb;

function makeFakeDb() {
  return {
    collection(name) {
      if (!store[name]) store[name] = new Map();
      const col = store[name];
      return {
        doc(id) {
          return {
            async get() {
              return { data: col.has(id) ? [col.get(id)] : [] };
            },
            async update(patch) {
              const cur = col.get(id) || {};
              col.set(id, { ...cur, ...patch });
              return { updated: 1 };
            },
            async remove() {
              const existed = col.has(id);
              col.delete(id);
              return { deleted: existed ? 1 : 0 };
            },
          };
        },
        orderBy() {
          return this;
        },
        limit() {
          return this;
        },
        async get() {
          return { data: Array.from(col.values()) };
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

beforeEach(async () => {
  store = {};
  process.env.ADMIN_UIDS = "admin-001";
  const mod = await import("./index.js");
  main = mod.main;
  __setTestDb = mod.__setTestDb;
  __setTestDb(makeFakeDb());
});

function ctx(uid) {
  return { userInfo: { uid } };
}

describe("manage-announcements admin 门控（issue #416）", () => {
  it("非管理员 create 被拒且未落库", async () => {
    const res = await main(
      { action: "create", title: "公告", content: "内容" },
      ctx("normal-user")
    );
    expect(res.ok).toBe(false);
    expect(res.error).toContain("仅管理员");
    expect(store.announcements?.size ?? 0).toBe(0);
  });

  it("非管理员 toggle 被拒", async () => {
    store.announcements = new Map([["a1", { _id: "a1", title: "x", active: true }]]);
    const res = await main({ action: "toggle", id: "a1", active: false }, ctx("normal-user"));
    expect(res.ok).toBe(false);
    expect(store.announcements.get("a1").active).toBe(true);
  });

  it("非管理员 delete 被拒", async () => {
    store.announcements = new Map([["a1", { _id: "a1", title: "x" }]]);
    const res = await main({ action: "delete", id: "a1" }, ctx("normal-user"));
    expect(res.ok).toBe(false);
    expect(store.announcements.has("a1")).toBe(true);
  });

  it("未登录操作被拒", async () => {
    const res = await main({ action: "create", title: "公告", content: "内容" }, {});
    expect(res.ok).toBe(false);
    expect(res.error).toContain("仅管理员");
  });

  it("管理员 create 成功", async () => {
    const res = await main(
      { action: "create", title: "新公告", content: "正文", authorName: "站长" },
      ctx("admin-001")
    );
    expect(res.ok).toBe(true);
    expect(res.data.id).toBe("gen_1");
    const doc = store.announcements.get("gen_1");
    expect(doc).toMatchObject({
      title: "新公告",
      content: "正文",
      authorUid: "admin-001",
      authorName: "站长",
      active: true,
    });
  });

  it("管理员 toggle/delete 成功", async () => {
    store.announcements = new Map([["a1", { _id: "a1", title: "x", active: true }]]);

    const t = await main({ action: "toggle", id: "a1", active: false }, ctx("admin-001"));
    expect(t.ok).toBe(true);
    expect(store.announcements.get("a1").active).toBe(false);

    const d = await main({ action: "delete", id: "a1" }, ctx("admin-001"));
    expect(d.ok).toBe(true);
    expect(store.announcements.has("a1")).toBe(false);
  });

  it("list 无需登录即可读取", async () => {
    store.announcements = new Map([
      ["a1", { _id: "a1", title: "公告一", content: "c", createdAt: "2026-07-01", active: true }],
    ]);
    const res = await main({ action: "list" }, {});
    expect(res.ok).toBe(true);
    expect(res.data).toHaveLength(1);
    expect(res.data[0].title).toBe("公告一");
  });

  it("create 对超长标题/正文截断", async () => {
    const res = await main(
      { action: "create", title: "长".repeat(300), content: "文".repeat(6000) },
      ctx("admin-001")
    );
    expect(res.ok).toBe(true);
    const doc = store.announcements.get("gen_1");
    expect(doc.title).toHaveLength(200);
    expect(doc.content).toHaveLength(5000);
  });
});
