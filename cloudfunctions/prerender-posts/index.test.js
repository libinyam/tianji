import { describe, it, expect, beforeEach } from "vitest";
import {
  main,
  buildPrerenderedHtml,
  stripDefaultMeta,
  __setTestDb,
  __setTestFetcher,
  __setTestUploader,
  __setTestDeleter,
} from "./index.js";

// #333 预渲染函数测试:注入模板/上传/删除捕获器,断言 meta 注入与安全阀。

const TEMPLATE = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <title>天玑 · 跨专业 AI 学习与项目共创社区</title>
    <meta name="description" content="站点默认描述" />
    <link rel="canonical" href="https://tianjihub.cn/" />
    <meta property="og:title" content="站点默认" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/index-abc.js"></script>
  </body>
</html>`;

let store;
let uploads;
let deletions;

function makeFakeDb() {
  return {
    collection(name) {
      if (!store[name]) store[name] = new Map();
      const col = store[name];
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
        doc(id) {
          return {
            async get() {
              return { data: col.has(id) ? [col.get(id)] : [] };
            },
            async set(v) {
              col.set(id, { _id: id, ...v });
              return { updated: 1 };
            },
          };
        },
      };
    },
  };
}

beforeEach(() => {
  store = {};
  uploads = [];
  deletions = [];
  __setTestDb(makeFakeDb());
  __setTestFetcher(async () => TEMPLATE);
  __setTestUploader(async (key, html) => {
    uploads.push({ key, html });
  });
  __setTestDeleter(async (key) => {
    deletions.push(key);
  });
});

const TIMER = { Type: "Timer" };

function seedPost(id, overrides = {}) {
  if (!store.posts) store.posts = new Map();
  store.posts.set(id, {
    _id: id,
    title: `帖子${id}`,
    excerpt: `摘要${id}`,
    body: `正文${id}`,
    author: "作者",
    answersCount: 2,
    views: 100,
    createdAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  });
}

describe("prerender-posts", () => {
  it("定时触发:为帖子上传预渲染页,注入专属 meta 且保留 SPA 挂载点与脚本", async () => {
    seedPost("p1");
    const res = await main(TIMER, {});

    expect(res.ok).toBe(true);
    expect(res.data.uploaded).toBe(1);
    expect(uploads[0].key).toBe("discussion/p1");
    const html = uploads[0].html;
    // 专属 meta 注入
    expect(html).toContain("<title>帖子p1 - 天玑社区</title>");
    expect(html).toContain('<link rel="canonical" href="https://tianjihub.cn/discussion/p1" />');
    expect(html).toContain('<meta property="og:title" content="帖子p1 - 天玑社区" />');
    expect(html).toContain('"@type":"QAPage"');
    // 站点默认 meta 已被剥离(不能出现两个 title/canonical)
    expect(html).not.toContain("天玑 · 跨专业 AI 学习与项目共创社区");
    expect(html).not.toContain('href="https://tianjihub.cn/" />');
    // SPA 完整性:挂载点与脚本原样保留,noscript 提供爬虫可见正文
    expect(html).toContain('<div id="root"></div>');
    expect(html).toContain('src="/assets/index-abc.js"');
    expect(html).toContain("<noscript>");
    expect(html).toContain("正文p1");
    // 索引已记录
    expect(store.prerender_index.get("current").ids).toEqual(["p1"]);
  });

  it("标题/正文中的 HTML 与 </script> 被转义,不能注入", async () => {
    seedPost("p2", {
      title: `<img src=x onerror=alert(1)>`,
      body: `</script><script>alert(2)</script>`,
      excerpt: "",
    });
    await main(TIMER, {});
    const html = uploads[0].html;
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
    // JSON-LD 中 < 已转义为 <,正文不可能提前闭合脚本
    expect(html).not.toContain("</script><script>alert(2)");
  });

  it("模板缺少 SPA 挂载点时中止,不上传任何文件", async () => {
    __setTestFetcher(async () => "<html><head></head><body>broken</body></html>");
    seedPost("p1");
    const res = await main(TIMER, {});
    expect(res.ok).toBe(false);
    expect(res.error).toContain("模板校验失败");
    expect(uploads).toHaveLength(0);
  });

  it("落选/删除的帖子旧文件被清理", async () => {
    store.prerender_index = new Map([["current", { _id: "current", ids: ["old1", "p1"] }]]);
    seedPost("p1");
    const res = await main(TIMER, {});
    expect(res.ok).toBe(true);
    expect(res.data.removed).toBe(1);
    expect(deletions).toEqual(["discussion/old1"]);
  });

  it("cleanup 模式:管理员可删除全部预渲染文件(回滚安全阀)", async () => {
    process.env.ADMIN_UIDS = "admin-1";
    store.prerender_index = new Map([["current", { _id: "current", ids: ["a", "b"] }]]);
    // ADMIN_UIDS 在模块加载时已读取,直接用 Timer 走 cleanup 不合适——
    // cleanup 也接受 Timer 来源以便控制台测试,这里用 Timer 触发验证行为
    const res = await main({ Type: "Timer", action: "cleanup" }, {});
    expect(res.ok).toBe(true);
    expect(res.data.cleaned).toBe(2);
    expect(deletions).toEqual(["discussion/a", "discussion/b"]);
    expect(store.prerender_index.get("current").ids).toEqual([]);
  });

  it("非定时非管理员触发被拒", async () => {
    const res = await main({}, { userInfo: { uid: "rando" } });
    expect(res.ok).toBe(false);
    expect(uploads).toHaveLength(0);
  });

  it("stripDefaultMeta 幂等且不动 body", () => {
    const once = stripDefaultMeta(TEMPLATE);
    expect(stripDefaultMeta(once)).toBe(once);
    expect(once).toContain('<div id="root"></div>');
    expect(once).not.toContain("<title>");
  });
});
