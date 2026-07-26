import { describe, it, expect, beforeEach } from "vitest";
import { main, buildSitemapXml, __setTestDb, __setTestUploader } from "./index.js";

// #333 sitemap 生成器测试:注入假数据库与上传捕获器,断言 XML 内容与鉴权。

let store;
let uploaded;

function makeFakeDb() {
  return {
    collection(name) {
      const col = store[name] || new Map();
      return {
        field() {
          return this;
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
      };
    },
  };
}

beforeEach(() => {
  store = {};
  uploaded = null;
  __setTestDb(makeFakeDb());
  __setTestUploader(async (xml) => {
    uploaded = xml;
  });
});

const TIMER = { Type: "Timer" };

describe("sitemap-generator", () => {
  it("定时触发生成含静态页与四类详情页的 sitemap 并上传", async () => {
    store.posts = new Map([
      ["p1", { _id: "p1", createdAt: "2026-07-01T00:00:00.000Z" }],
      [
        "p2",
        { _id: "p2", createdAt: "2026-07-20T00:00:00.000Z", updatedAt: "2026-07-25T00:00:00.000Z" },
      ],
    ]);
    store.ideas = new Map([["i1", { _id: "i1", createdAt: "2026-07-10T00:00:00.000Z" }]]);
    store.books = new Map([["b1", { _id: "b1", createdAt: "2026-07-11T00:00:00.000Z" }]]);
    store.workshops = new Map([["w1", { _id: "w1", createdAt: "2026-07-12T00:00:00.000Z" }]]);

    const res = await main(TIMER, {});

    expect(res.ok).toBe(true);
    expect(res.data.urls).toBe(8 + 5);
    expect(uploaded).toContain("<loc>https://tianjihub.cn/</loc>");
    expect(uploaded).toContain("<loc>https://tianjihub.cn/discussion/p1</loc>");
    expect(uploaded).toContain("<loc>https://tianjihub.cn/discussion/p2</loc>");
    expect(uploaded).toContain("<loc>https://tianjihub.cn/ideas/i1</loc>");
    expect(uploaded).toContain("<loc>https://tianjihub.cn/library/b1</loc>");
    expect(uploaded).toContain("<loc>https://tianjihub.cn/workshop/w1</loc>");
    // lastmod 取 updatedAt 优先,并裁剪为 W3C 日期
    expect(uploaded).toContain("<lastmod>2026-07-25</lastmod>");
  });

  it("非定时且非管理员触发被拒,不上传", async () => {
    const res = await main({}, { userInfo: { uid: "random-user" } });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("无权限");
    expect(uploaded).toBeNull();
  });

  it("单集合查询失败不阻断整体生成", async () => {
    store.posts = new Map([["p1", { _id: "p1", createdAt: "2026-07-01T00:00:00.000Z" }]]);
    const failingDb = makeFakeDb();
    const origCollection = failingDb.collection.bind(failingDb);
    failingDb.collection = (name) => {
      if (name === "ideas") {
        return {
          field() {
            return this;
          },
          orderBy() {
            return this;
          },
          limit() {
            return this;
          },
          async get() {
            throw new Error("db error");
          },
        };
      }
      return origCollection(name);
    };
    __setTestDb(failingDb);

    const res = await main(TIMER, {});
    expect(res.ok).toBe(true);
    expect(res.data.ideas).toBe(0);
    expect(uploaded).toContain("/discussion/p1");
  });

  it("buildSitemapXml 转义特殊字符且无效 lastmod 被省略", () => {
    const xml = buildSitemapXml([
      {
        loc: "https://x.cn/a?b=1&c=2",
        lastmod: "not-a-date",
        changefreq: "weekly",
        priority: "0.5",
      },
    ]);
    expect(xml).toContain("<loc>https://x.cn/a?b=1&amp;c=2</loc>");
    expect(xml).not.toContain("<lastmod>");
  });
});
