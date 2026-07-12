import { describe, it, expect, beforeEach, vi } from "vitest";
import { main, __setTestDb } from "./index.js";

// 通过 __setTestDb 注入可控的假数据库，验证 db-backup 的调用者鉴权（issue #246）。
// 鉴权来源：定时触发器（event.Type === "Timer"）或管理员（context.userInfo.uid ∈ ADMIN_UIDS）。
// ADMIN_UIDS 在模块加载时从环境变量读取，测试前先设好再动态导入。

let store;

function makeFakeDb() {
  return {
    collection(name) {
      if (!store[name]) store[name] = new Map();
      const col = store[name];
      const chain = {
        _skip: 0,
        _limit: Infinity,
        skip(n) {
          return { ...chain, _skip: n, __col: col };
        },
        limit(n) {
          const skip = this._skip || 0;
          const rows = [...col.values()];
          return {
            async get() {
              return { data: rows.slice(skip, skip + n) };
            },
          };
        },
        async get() {
          return { data: [...col.values()] };
        },
        doc(id) {
          return {
            async set(v) {
              const existed = col.has(id);
              col.set(id, { _id: id, ...v });
              return existed ? { replaced: 1 } : { upserted: 1 };
            },
            async remove() {
              const existed = col.has(id);
              col.delete(id);
              return { deleted: existed ? 1 : 0 };
            },
          };
        },
      };
      return chain;
    },
  };
}

beforeEach(() => {
  store = {};
  __setTestDb(makeFakeDb());
});

function seedSomeData() {
  store.posts = new Map([["p1", { _id: "p1", title: "帖子" }]]);
  store.books = new Map([["b1", { _id: "b1", title: "书" }]]);
}

describe("db-backup 调用者鉴权（issue #246）", () => {
  it("匿名调用被拒绝且不产生 _backups 写入", async () => {
    seedSomeData();

    const res = await main({}, {});

    expect(res.ok).toBe(false);
    expect(res.error).toContain("无权限");
    // 没有任何备份/审计文档写入
    expect(store._backups === undefined || store._backups.size === 0).toBe(true);
  });

  it("普通登录用户（非管理员）被拒绝", async () => {
    seedSomeData();

    const res = await main({}, { userInfo: { uid: "normal-user" } });

    expect(res.ok).toBe(false);
    expect(res.error).toContain("无权限");
    expect(store._backups === undefined || store._backups.size === 0).toBe(true);
  });

  it("定时触发器（Type=Timer）可执行备份并写审计日志", async () => {
    seedSomeData();

    const res = await main({ Type: "Timer", TriggerName: "daily" }, {});

    expect(res.ok).toBe(true);
    expect(res.source).toBe("timer:daily");
    expect(res.totalDocs).toBe(2);
    // 写入了各集合备份 + 一条审计日志
    expect(store._backups.has(`${res.backupId}_posts`)).toBe(true);
    const audit = store._backups.get(`audit-${res.backupId}`);
    expect(audit).toBeDefined();
    expect(audit.type).toBe("backup-audit");
    expect(audit.source).toBe("timer:daily");
    expect(typeof audit.durationMs).toBe("number");
  });

  it("超过保留份数时清理最旧的备份组", async () => {
    // 预置 8 组旧备份（每组 1 个集合文档），保留上限为 7
    store._backups = new Map();
    for (let i = 1; i <= 8; i++) {
      const ts = `backup-2026-01-0${i}`;
      store._backups.set(`${ts}_posts`, { _id: `${ts}_posts`, collection: "posts" });
    }
    store.posts = new Map([["p1", { _id: "p1" }]]);

    const res = await main({ Type: "Timer", TriggerName: "daily" }, {});

    expect(res.ok).toBe(true);
    // 本次新增一组 -> 共 9 组数据备份，清理到 7 组
    const dataBatches = new Set();
    for (const id of store._backups.keys()) {
      if (!id.startsWith("backup-")) continue;
      dataBatches.add(id.slice(0, id.lastIndexOf("_")));
    }
    expect(dataBatches.size).toBe(7);
    // 最旧的 backup-2026-01-01 应被清理
    expect(store._backups.has("backup-2026-01-01_posts")).toBe(false);
    expect(res.pruned).toBeGreaterThan(0);
  });
});
