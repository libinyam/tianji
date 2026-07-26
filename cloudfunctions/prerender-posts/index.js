const cloudbase = require("@cloudbase/node-sdk");

// #333 热门帖子预渲染：CloudBase 静态托管没有边缘计算,无法做 UA 分流的
// meta 注入。本函数取活的 index.html 为模板,为 top-N 帖子注入专属
// title/description/OG/canonical/JSON-LD 与 <noscript> 正文摘录,以
// `discussion/{id}`(无扩展名,显式 text/html)上传到托管——文件命中优先于
// SPA rewrite,真实用户拿到的仍是完整 SPA(body/脚本未动),而微信/百度等
// 不执行 JS 的爬虫第一次能看到每篇帖子的真实元信息。
//
// 安全阀:上传清单记录在 prerender_index 集合;event.action === "cleanup"
// 一键删除全部预渲染文件,可随时回滚到纯 SPA 行为。

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
let fetchOverride = null;
let uploadOverride = null;
let deleteOverride = null;
exports.__setTestFetcher = (fn) => {
  fetchOverride = fn;
};
exports.__setTestUploader = (fn) => {
  uploadOverride = fn;
};
exports.__setTestDeleter = (fn) => {
  deleteOverride = fn;
};

const ADMIN_UIDS = (process.env.ADMIN_UIDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function isTrusted(event, context) {
  if (event && event.Type === "Timer") return true;
  if (event && event.action === "cleanup") {
    const uid = context?.userInfo?.uid || context?.identifier || "";
    return !!uid && ADMIN_UIDS.includes(uid);
  }
  const uid = context?.userInfo?.uid || context?.identifier || "";
  return !!uid && ADMIN_UIDS.includes(uid);
}

const SITE = "https://tianjihub.cn";
// 与 scripts/fix-charset.mjs 一致的托管桶(静态托管底层 COS)
const BUCKET = "4147-static-tianji-d3gozv3qr802e49cb-1445413468";
const REGION = "ap-shanghai";
const TOP_N = 100;
const INDEX_COLLECTION = "prerender_index";
const INDEX_DOC = "current";

function htmlEscape(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 去掉模板中站点级的 title/description/canonical/OG/Twitter 标签,为按帖注入让路 */
function stripDefaultMeta(html) {
  return html
    .replace(/<title>[\s\S]*?<\/title>\s*/, "")
    .replace(/<meta name="description"[^>]*\/>\s*/g, "")
    .replace(/<link rel="canonical"[^>]*\/>\s*/g, "")
    .replace(/<meta property="og:[^"]*"[^>]*\/>\s*/g, "")
    .replace(/<meta name="twitter:[^"]*"[^>]*\/>\s*/g, "");
}
exports.stripDefaultMeta = stripDefaultMeta;

/** 为单帖生成完整预渲染 HTML(纯函数,供测试断言) */
function buildPrerenderedHtml(template, post) {
  const title = `${post.title} - 天玑社区`;
  const desc = String(post.excerpt || post.body || "")
    .replace(/\s+/g, " ")
    .slice(0, 150);
  const url = `${SITE}/discussion/${post._id}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "QAPage",
    mainEntity: {
      "@type": "Question",
      name: post.title,
      text: desc,
      answerCount: post.answersCount || 0,
      dateCreated: post.createdAt || undefined,
      author: { "@type": "Person", name: post.author || "匿名用户" },
    },
  };

  const head = [
    `<title>${htmlEscape(title)}</title>`,
    `<meta name="description" content="${htmlEscape(desc)}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:title" content="${htmlEscape(title)}" />`,
    `<meta property="og:description" content="${htmlEscape(desc)}" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:site_name" content="天玑 Tianji" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${htmlEscape(title)}" />`,
    `<meta name="twitter:description" content="${htmlEscape(desc)}" />`,
    // </script> 序列须转义,防止帖子内容提前闭合脚本标签
    `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>`,
  ].join("\n    ");

  // 不执行 JS 的爬虫(百度/微信)可见的正文摘录;执行 JS 的环境不渲染 noscript
  const bodyText = String(post.body || "")
    .replace(/\s+/g, " ")
    .slice(0, 500);
  const noscript = `<noscript><article><h1>${htmlEscape(post.title)}</h1><p>${htmlEscape(bodyText)}</p><p>${post.answersCount || 0} 个回答 · <a href="${SITE}/">天玑社区</a></p></article></noscript>`;

  let html = stripDefaultMeta(template);
  html = html.replace("</head>", `${head}\n  </head>`);
  html = html.replace('<div id="root"></div>', `<div id="root"></div>\n    ${noscript}`);
  return html;
}
exports.buildPrerenderedHtml = buildPrerenderedHtml;

async function defaultFetchTemplate() {
  const https = require("https");
  return new Promise((resolve, reject) => {
    https
      .get(`${SITE}/index.html`, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`模板获取失败: HTTP ${res.statusCode}`));
          return;
        }
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve(data));
      })
      .on("error", reject);
  });
}

function makeCos() {
  const COS = require("cos-nodejs-sdk-v5");
  return new COS({
    SecretId: process.env.TENCENTCLOUD_SECRETID,
    SecretKey: process.env.TENCENTCLOUD_SECRETKEY,
    SecurityToken: process.env.TENCENTCLOUD_SESSIONTOKEN,
  });
}

async function defaultUpload(key, html) {
  const cos = makeCos();
  await new Promise((resolve, reject) => {
    cos.putObject(
      {
        Bucket: BUCKET,
        Region: REGION,
        Key: key,
        Body: Buffer.from(html, "utf8"),
        ContentType: "text/html; charset=utf-8",
        ContentDisposition: "",
        CacheControl: "no-cache",
      },
      (err, data) => (err ? reject(err) : resolve(data)),
    );
  });
}

async function defaultDelete(key) {
  const cos = makeCos();
  await new Promise((resolve, reject) => {
    cos.deleteObject({ Bucket: BUCKET, Region: REGION, Key: key }, (err, data) =>
      err ? reject(err) : resolve(data),
    );
  });
}

async function readIndex() {
  try {
    const { data } = await db.collection(INDEX_COLLECTION).doc(INDEX_DOC).get();
    if (data && data.length > 0 && Array.isArray(data[0].ids)) return data[0].ids;
  } catch {
    // 集合不存在等,视为空
  }
  return [];
}

async function writeIndex(ids) {
  try {
    await db.collection(INDEX_COLLECTION).doc(INDEX_DOC).set({
      ids,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    // 索引写失败不阻断(下次运行会重新上传全量,stale 清理延后)
  }
}

exports.main = async (event, context) => {
  ensureApp();

  if (!isTrusted(event, context)) {
    return { ok: false, error: "无权限：仅管理员或定时任务可触发" };
  }

  const doDelete = deleteOverride || defaultDelete;

  // 回滚模式:删除全部预渲染文件,恢复纯 SPA 行为
  if (event && event.action === "cleanup") {
    const ids = await readIndex();
    let deleted = 0;
    for (const id of ids) {
      try {
        await doDelete(`discussion/${id}`);
        deleted++;
      } catch {}
    }
    await writeIndex([]);
    return { ok: true, data: { cleaned: deleted } };
  }

  const template = await (fetchOverride || defaultFetchTemplate)();
  if (!template.includes('<div id="root"></div>')) {
    return { ok: false, error: "模板校验失败：未找到 SPA 挂载点,中止以免上传损坏页面" };
  }

  const { data } = await db
    .collection("posts")
    .field({
      _id: true,
      title: true,
      excerpt: true,
      body: true,
      author: true,
      answersCount: true,
      views: true,
      createdAt: true,
      updatedAt: true,
    })
    .orderBy("views", "desc")
    .limit(TOP_N)
    .get();
  const posts = (data || []).filter((p) => p && p._id && p.title);

  const doUpload = uploadOverride || defaultUpload;
  const uploadedIds = [];
  for (const post of posts) {
    try {
      const html = buildPrerenderedHtml(template, post);
      await doUpload(`discussion/${post._id}`, html);
      uploadedIds.push(post._id);
    } catch {
      // 单帖失败跳过,不阻断整体
    }
  }

  // 清理不再入选/已删除帖子的旧文件
  const prev = await readIndex();
  const current = new Set(uploadedIds);
  let removed = 0;
  for (const id of prev) {
    if (!current.has(id)) {
      try {
        await doDelete(`discussion/${id}`);
        removed++;
      } catch {}
    }
  }
  await writeIndex(uploadedIds);

  return {
    ok: true,
    data: { uploaded: uploadedIds.length, removed, generatedAt: new Date().toISOString() },
  };
};
