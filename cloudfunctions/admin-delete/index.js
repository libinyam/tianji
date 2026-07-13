const cloudbase = require("@cloudbase/node-sdk");
const { withTiming, logError, logInfo } = require("./logger");

let app;
let db;
let _;

function ensureApp() {
  if (!app && !db) {
    app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
    db = app.database();
    _ = db.command;
  }
  return app;
}

exports.__setTestDb = (fakeDb) => {
  db = fakeDb;
  _ = fakeDb.command;
};

const ADMIN_UIDS = (process.env.ADMIN_UIDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const ALLOWED_COLLECTIONS = ["posts", "ideas", "books", "workshops", "reports"];

// CloudBase 文档 ID 格式不固定（可能是 24 位 hex 或其他格式），
// 用宽松正则拒绝明显非法输入（空字符串、特殊字符等）
const DOC_ID_PATTERN = /^[a-zA-Z0-9_-]{8,64}$/;

/** 校验 docId 格式是否合法 */
function isValidDocId(docId) {
  return typeof docId === "string" && DOC_ID_PATTERN.test(docId);
}

exports.main = async (event, context) => {
  const { collection, docId, action } = event;

  // --- 1. 身份验证（仅接受服务端身份源） ---
  let uid = "";

  const appInst = ensureApp();

  if (appInst) {
    try {
      const info = await appInst.auth().getEndUserInfo();
      uid = info?.userInfo?.uid || "";
    } catch (e) {
    }
  }

  if (!uid && context?.userInfo) {
    uid = context.userInfo.uid || "";
  }

  if (!uid && context?.identifier) {
    uid = context.identifier;
  }

  if (!uid || !ADMIN_UIDS.includes(uid)) {
    logInfo("admin-delete", uid, "unauthorized", { collection, docId });
    return { ok: false, error: "无管理员权限" };
  }

  const timer = withTiming(`admin-delete:${action}`, uid);

  // --- 2. 参数校验 ---
  if (typeof collection !== "string" || typeof docId !== "string") {
    return { ok: false, error: "参数类型错误" };
  }

  if (!collection || !docId || !action) {
    return { ok: false, error: "缺少参数" };
  }

  if (!ALLOWED_COLLECTIONS.includes(collection)) {
    return { ok: false, error: "不允许操作的集合" };
  }

  if (!isValidDocId(docId)) {
    return { ok: false, error: "文档 ID 格式不合法" };
  }

  // --- 3. 执行操作 ---
  try {
    if (action === "delete") {
      // 删除文档
      await db.collection(collection).doc(docId).remove();

      // 级联清理关联数据（所有内容类型）
      try {
        await db.collection("favorites").where({ targetId: docId }).remove();
      } catch (e) {
        logInfo("admin-delete", uid, "cleanup favorites failed", { docId, error: e.message });
      }
      try {
        await db.collection("reports").where({ targetId: docId }).remove();
      } catch (e) {
        logInfo("admin-delete", uid, "cleanup reports failed", { docId, error: e.message });
      }

      timer.end("success", { collection, docId });
      return { ok: true };
    }

    return { ok: false, error: "未知操作" };
  } catch (err) {
    logError(`admin-delete:${action}`, uid, err);
    return { ok: false, error: err.message || "操作失败" };
  }
};
