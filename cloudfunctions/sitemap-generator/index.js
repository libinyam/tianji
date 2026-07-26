const cloudbase = require("@cloudbase/node-sdk");

// #333 动态 sitemap 生成器：定时(每日 04:00)查询全部内容详情页,生成
// sitemap.xml 写入静态托管根目录,让搜索引擎能发现帖子/资源/灵感/工坊详情页。
// 此前 public/sitemap.xml 只含 6 个静态路由,内容页对爬虫不存在。
//
// 延迟初始化 + __setTestDb/__setTestUploader 注入(与 content-actions 同模式)。

let app;
let db;

function ensureApp() {
  // 测试注入 db 后跳过真实初始化
  if (!app && !db) {
    app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
    db = app.database();
  }
  return app;
}

// 仅供测试注入,生产代码不应调用
exports.__setTestDb = (fakeDb) => {
  db = fakeDb;
};

// 上传器可注入:生产走 @cloudbase/manager-node 写静态托管,测试捕获 XML
let uploadOverride = null;
exports.__setTestUploader = (fn) => {
  uploadOverride = fn;
};

const ADMIN_UIDS = (process.env.ADMIN_UIDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// 与 db-backup 一致:定时触发器(event.Type === "Timer")或管理员可触发
function isTrusted(event, context) {
  if (event && event.Type === "Timer") return true;
  const uid = context?.userInfo?.uid || context?.identifier || "";
  return !!uid && ADMIN_UIDS.includes(uid);
}

const SITE = "https://tianjihub.cn";

const STATIC_PAGES = [
  { loc: `${SITE}/`, changefreq: "daily", priority: "1.0" },
  { loc: `${SITE}/library`, changefreq: "weekly", priority: "0.8" },
  { loc: `${SITE}/ideas`, changefreq: "daily", priority: "0.8" },
  { loc: `${SITE}/workshop`, changefreq: "weekly", priority: "0.8" },
  { loc: `${SITE}/portfolio`, changefreq: "weekly", priority: "0.6" },
  { loc: `${SITE}/leaderboard`, changefreq: "daily", priority: "0.6" },
  { loc: `${SITE}/growth`, changefreq: "monthly", priority: "0.6" },
  { loc: `${SITE}/about`, changefreq: "monthly", priority: "0.6" },
];

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** 生成 sitemap XML(纯函数,供测试直接断言) */
function buildSitemapXml(entries) {
  const urls = entries
    .map((e) => {
      const lastmod =
        e.lastmod && /^\d{4}-\d{2}-\d{2}/.test(e.lastmod)
          ? `\n    <lastmod>${e.lastmod.slice(0, 10)}</lastmod>`
          : "";
      return `  <url>\n    <loc>${xmlEscape(e.loc)}</loc>${lastmod}\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
exports.buildSitemapXml = buildSitemapXml;

async function fetchEntries(collection, pathPrefix, priority) {
  try {
    const { data } = await db
      .collection(collection)
      .field({ _id: true, createdAt: true, updatedAt: true })
      .orderBy("createdAt", "desc")
      .limit(1000)
      .get();
    return (data || []).map((d) => ({
      loc: `${SITE}/${pathPrefix}/${d._id}`,
      lastmod: d.updatedAt || d.createdAt || "",
      changefreq: "weekly",
      priority,
    }));
  } catch {
    // 单集合失败不阻断整体生成
    return [];
  }
}

// 生产上传:云函数运行时自带临时密钥,无需额外配置凭据
async function defaultUpload(xml) {
  const fs = require("fs");
  const os = require("os");
  const path = require("path");
  const CloudBase = require("@cloudbase/manager-node");
  const manager = CloudBase.init({
    secretId: process.env.TENCENTCLOUD_SECRETID,
    secretKey: process.env.TENCENTCLOUD_SECRETKEY,
    token: process.env.TENCENTCLOUD_SESSIONTOKEN,
    envId: process.env.TCB_ENV || process.env.SCF_NAMESPACE,
  });
  const localPath = path.join(os.tmpdir(), "sitemap.xml");
  fs.writeFileSync(localPath, xml, "utf8");
  await manager.hosting.uploadFiles({
    files: [{ localPath, cloudPath: "sitemap.xml" }],
  });
}

exports.main = async (event, context) => {
  ensureApp();

  if (!isTrusted(event, context)) {
    return { ok: false, error: "无权限：仅管理员或定时任务可触发" };
  }

  const [posts, ideas, books, workshops] = await Promise.all([
    fetchEntries("posts", "discussion", "0.7"),
    fetchEntries("ideas", "ideas", "0.6"),
    fetchEntries("books", "library", "0.6"),
    fetchEntries("workshops", "workshop", "0.6"),
  ]);

  const entries = [...STATIC_PAGES, ...posts, ...ideas, ...books, ...workshops];
  const xml = buildSitemapXml(entries);

  await (uploadOverride || defaultUpload)(xml);

  return {
    ok: true,
    data: {
      urls: entries.length,
      posts: posts.length,
      ideas: ideas.length,
      books: books.length,
      workshops: workshops.length,
      generatedAt: new Date().toISOString(),
    },
  };
};
