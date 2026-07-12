const cloudbase = require("@cloudbase/node-sdk");

// 延迟初始化：真实运行时首次使用才连接 CloudBase；测试可通过
// __setTestDb 注入假数据库，避免加载真实 SDK（缺凭据会失败）。
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

// 仅供测试注入假数据库，生产代码不应调用
exports.__setTestDb = (fakeDb) => {
  db = fakeDb;
};

const ADMIN_UIDS = (process.env.ADMIN_UIDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const COLLECTIONS_TO_BACKUP = [
  "posts",
  "ideas",
  "books",
  "workshops",
  "votes",
  "favorites",
  "reputation_events",
  "notifications",
  "reports",
  "tags",
  "announcements",
  "user_roles",
];

const MAX_BATCH = 1000;
// 备份保留组数：仅保留最近 N 组备份，避免 _backups 无限膨胀
const MAX_BACKUPS_TO_KEEP = 7;

// 判断调用来源是否可信：定时触发器（event.Type === "Timer"）或管理员调用。
// 返回 { allowed, source }，source 用于审计日志。
async function resolveCaller(event, context, appInst) {
  // 1. 定时触发器：SCF/CloudBase 定时触发的 event.Type 固定为 "Timer"
  if (event && event.Type === "Timer") {
    return { allowed: true, source: `timer:${event.TriggerName || "unknown"}` };
  }

  // 2. 管理员手动调用
  let uid = "";
  if (appInst) {
    try {
      const info = await appInst.auth().getEndUserInfo(context);
      uid = info?.userInfo?.uid || info?.uid || "";
    } catch {}
  }
  if (!uid && context?.userInfo) {
    uid = context.userInfo.uid || "";
  }
  if (!uid && context?.identifier) {
    uid = context.identifier;
  }

  if (uid && ADMIN_UIDS.includes(uid)) {
    return { allowed: true, source: `admin:${uid}`, uid };
  }

  return { allowed: false, source: uid ? `user:${uid}` : "anonymous", uid };
}

// 清理旧备份：按备份批次前缀（backup-<ts>，字典序即时间序）保留最近若干组
async function pruneOldBackups() {
  try {
    const all = [];
    let offset = 0;
    while (true) {
      const { data } = await db
        .collection("_backups")
        .skip(offset)
        .limit(MAX_BATCH)
        .get();
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < MAX_BATCH) break;
      offset += MAX_BATCH;
    }

    // 仅统计数据备份文档（backup-<ts>_<collection>），审计日志 audit-* 不计入
    const batches = new Set();
    for (const doc of all) {
      const id = doc._id || "";
      if (!id.startsWith("backup-")) continue;
      const sep = id.lastIndexOf("_");
      if (sep > 0) batches.add(id.slice(0, sep));
    }

    const sorted = [...batches].sort(); // 时间戳字典序升序，旧的在前
    const toDelete = new Set(
      sorted.slice(0, Math.max(0, sorted.length - MAX_BACKUPS_TO_KEEP))
    );
    if (toDelete.size === 0) return { pruned: 0 };

    let pruned = 0;
    for (const doc of all) {
      const id = doc._id || "";
      if (!id.startsWith("backup-")) continue;
      const sep = id.lastIndexOf("_");
      const prefix = sep > 0 ? id.slice(0, sep) : "";
      if (toDelete.has(prefix)) {
        await db.collection("_backups").doc(id).remove();
        pruned++;
      }
    }
    return { pruned };
  } catch (err) {
    return { pruned: 0, pruneError: err.message };
  }
}

async function writeAuditLog(entry) {
  try {
    await db.collection("_backups").doc(entry._id).set(entry);
  } catch {}
}

exports.main = async (event = {}, context = {}) => {
  const appInst = ensureApp();

  const caller = await resolveCaller(event, context, appInst);
  if (!caller.allowed) {
    // 非授权调用直接拒绝，不产生任何 _backups 写入
    return {
      ok: false,
      error: "无权限：仅管理员或定时任务可触发备份",
      source: caller.source,
    };
  }

  const startedAt = Date.now();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupId = `backup-${timestamp}`;
  const results = [];

  for (const collectionName of COLLECTIONS_TO_BACKUP) {
    try {
      const allDocs = [];
      let offset = 0;

      while (true) {
        const { data } = await db
          .collection(collectionName)
          .skip(offset)
          .limit(MAX_BATCH)
          .get();

        if (!data || data.length === 0) break;
        allDocs.push(...data);
        if (data.length < MAX_BATCH) break;
        offset += MAX_BATCH;
      }

      const backupDoc = {
        _id: `${backupId}_${collectionName}`,
        collection: collectionName,
        count: allDocs.length,
        data: allDocs,
        createdAt: new Date().toISOString(),
      };

      await db.collection("_backups").doc(backupDoc._id).set(backupDoc);

      results.push({
        collection: collectionName,
        count: allDocs.length,
        status: "ok",
      });
    } catch (err) {
      results.push({
        collection: collectionName,
        status: "error",
        error: err.message,
      });
    }
  }

  const totalDocs = results
    .filter((r) => r.status === "ok")
    .reduce((sum, r) => sum + r.count, 0);

  const prune = await pruneOldBackups();
  const durationMs = Date.now() - startedAt;

  // 审计日志：记录触发者、来源、结果、耗时
  await writeAuditLog({
    _id: `audit-${backupId}`,
    type: "backup-audit",
    backupId,
    source: caller.source,
    triggeredAt: new Date(startedAt).toISOString(),
    durationMs,
    totalDocs,
    collections: results.map((r) => ({
      collection: r.collection,
      count: r.count,
      status: r.status,
    })),
    pruned: prune.pruned,
  });

  return {
    ok: true,
    backupId,
    timestamp,
    totalDocs,
    durationMs,
    source: caller.source,
    pruned: prune.pruned,
    collections: results,
  };
};
