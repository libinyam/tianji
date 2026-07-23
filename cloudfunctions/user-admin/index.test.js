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
        _skip: 0,
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
        skip(n) {
          return { ...chain, _skip: n };
        },
        limit(n) {
          const skip = this._skip || 0;
          return {
            async get() {
              const rows = [...col.values()];
              return { data: rows.slice(skip, skip + n) };
            },
          };
        },
        async get() {
          return { data: [...col.values()] };
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

describe("user-admin 用户管理", () => {
  it("listUsers 返回用户列表", async () => {
    store.users_v2 = new Map([
      ["user-0001", { _id: "user-0001", displayName: "Alice" }],
      ["user-0002", { _id: "user-0002", displayName: "Bob" }],
    ]);

    const res = await main({ action: "listUsers", page: 1, pageSize: 20 }, ctx("admin-001"));

    expect(res.ok).toBe(true);
    expect(res.data.length).toBe(2);
    expect(res.page).toBe(1);
  });

  it("banUser 成功封禁用户并设置 bannedUntil", async () => {
    store.users_v2 = new Map([
      ["user-0001", { _id: "user-0001", displayName: "Alice", banned: false }],
    ]);

    const res = await main(
      { action: "banUser", uid: "user-0001", reason: "违规", days: 7 },
      ctx("admin-001")
    );

    expect(res.ok).toBe(true);
    const user = store.users_v2.get("user-0001");
    expect(user.banned).toBe(true);
    expect(user.bannedReason).toBe("违规");
    expect(user.bannedUntil).toBeTruthy();
  });

  it("unbanUser 成功解封用户", async () => {
    store.users_v2 = new Map([
      [
        "user-0001",
        {
          _id: "user-0001",
          displayName: "Alice",
          banned: true,
          bannedReason: "违规",
          bannedUntil: "2026-12-31T00:00:00.000Z",
        },
      ],
    ]);

    const res = await main({ action: "unbanUser", uid: "user-0001" }, ctx("admin-001"));

    expect(res.ok).toBe(true);
    const user = store.users_v2.get("user-0001");
    expect(user.banned).toBe(false);
    expect(user.bannedReason).toBe("");
    expect(user.bannedUntil).toBe("");
  });

  it("非管理员调用被拒绝", async () => {
    store.users_v2 = new Map();

    const res = await main({ action: "listUsers" }, ctx("normal-user"));

    expect(res.ok).toBe(false);
    expect(res.error).toContain("无管理员权限");
  });

  it("封禁已封禁用户会覆盖原封禁信息", async () => {
    store.users_v2 = new Map([
      [
        "user-0001",
        {
          _id: "user-0001",
          banned: true,
          bannedReason: "old",
          bannedUntil: "2026-12-31T00:00:00.000Z",
        },
      ],
    ]);

    const res = await main(
      { action: "banUser", uid: "user-0001", reason: "new-reason", days: 3 },
      ctx("admin-001")
    );

    expect(res.ok).toBe(true);
    const user = store.users_v2.get("user-0001");
    expect(user.banned).toBe(true);
    expect(user.bannedReason).toBe("new-reason");
  });
});
