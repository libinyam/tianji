import { describe, it, expect, beforeEach } from "vitest";
import { main, __setTestDb } from "./index.js";

// #172 声望排行榜测试:公开只读、排序、封禁剔除、快照名解析与回退。

let store;

const command = {
  inc: (n) => ({ __inc: n }),
  push: (arr) => ({ __push: arr }),
  addToSet: (v) => ({ __addToSet: v }),
  in: (arr) => ({ __in: arr }),
};

function makeFakeDb() {
  return {
    command,
    collection(name) {
      if (!store[name]) store[name] = new Map();
      const col = store[name];
      return {
        field() {
          return this;
        },
        where() {
          return this;
        },
        orderBy(key, dir) {
          this._orderBy = { key, dir };
          return this;
        },
        limit() {
          return this;
        },
        async get() {
          let rows = Array.from(col.values());
          if (this._orderBy?.key === "reputation") {
            rows = rows.sort((a, b) => (b.reputation || 0) - (a.reputation || 0));
          }
          return { data: rows };
        },
        doc(id) {
          return {
            async get() {
              return { data: col.has(id) ? [col.get(id)] : [] };
            },
          };
        },
      };
    },
  };
}

beforeEach(() => {
  store = {};
  __setTestDb(makeFakeDb());
});

describe("getLeaderboard（issue #172）", () => {
  it("匿名可访问,按声望降序,封禁与零声望剔除,名字从内容快照解析", async () => {
    store.users_v2 = new Map([
      ["u1", { _id: "u1", reputation: 120 }],
      ["u2", { _id: "u2", reputation: 300 }],
      ["u3", { _id: "u3", reputation: 999, banned: true }],
      ["u4", { _id: "u4", reputation: 0 }],
    ]);
    store.posts = new Map([
      ["p1", { _id: "p1", author: "甲同学", authorUid: "u1", avatarColor: "#abc" }],
    ]);
    store.ideas = new Map([["i1", { _id: "i1", author: "乙同学", authorUid: "u2" }]]);

    // 匿名:无 uid 上下文
    const res = await main({ action: "getLeaderboard" }, {});

    expect(res.ok).toBe(true);
    const entries = res.data.entries;
    expect(entries.map((e) => e.uid)).toEqual(["u2", "u1"]);
    expect(entries[0].name).toBe("乙同学");
    expect(entries[1].name).toBe("甲同学");
    expect(entries[1].avatarColor).toBe("#abc");
  });

  it("无任何内容快照的用户回退为天玑成员", async () => {
    store.users_v2 = new Map([["u9", { _id: "u9", reputation: 66 }]]);

    const res = await main({ action: "getLeaderboard" }, {});
    expect(res.ok).toBe(true);
    expect(res.data.entries[0]).toMatchObject({ uid: "u9", name: "天玑成员", reputation: 66 });
  });

  it("快照昵称为匿名用户时不采用,继续回退", async () => {
    store.users_v2 = new Map([["u5", { _id: "u5", reputation: 80 }]]);
    store.posts = new Map([["p1", { _id: "p1", author: "匿名用户", authorUid: "u5" }]]);

    const res = await main({ action: "getLeaderboard" }, {});
    expect(res.data.entries[0].name).toBe("天玑成员");
  });

  it("空榜返回空数组而非报错", async () => {
    const res = await main({ action: "getLeaderboard" }, {});
    expect(res.ok).toBe(true);
    expect(res.data.entries).toEqual([]);
  });
});
