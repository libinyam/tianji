const cloudbase = require("@cloudbase/node-sdk");

const app = cloudbase.init({
  env: cloudbase.SYMBOL_CURRENT_ENV,
});

const db = app.database();

const ADMIN_UIDS = ["2068674931977097216"];

exports.main = async (event, context) => {
  const { collection, docId, action } = event;

  // 打印 context 结构，便于调试身份获取
  console.log("context keys:", Object.keys(context || {}));
  console.log("context.userInfo:", JSON.stringify(context?.userInfo));

  // 尝试多种方式获取用户身份
  let uid = "";

  // 方式1: getEndUserInfo（node-sdk v4 中可能不可用）
  try {
    const info = await app.auth().getEndUserInfo(context);
    uid = info?.userInfo?.uid || info?.uid || "";
  } catch (e) {
    console.warn("getEndUserInfo 失败:", e.message);
  }

  // 方式2: 从 context.userInfo 获取
  if (!uid && context?.userInfo) {
    uid = context.userInfo.uid || "";
  }

  // 方式3: 从 context.identifier 获取
  if (!uid && context?.identifier) {
    uid = context.identifier;
  }

  // 方式4: 前端传入 uid（验证 context 中有 openid 确认用户已登录）
  const clientUid = event._callerUid || "";
  const isOpenid = context?.userInfo?.openid || context?.openid;
  if (!uid && clientUid && isOpenid) {
    uid = clientUid;
  }

  console.log("admin-delete 调用, uid:", uid, "clientUid:", clientUid, "isAdmin:", ADMIN_UIDS.includes(uid));

  if (!uid || !ADMIN_UIDS.includes(uid)) {
    return { ok: false, error: "无管理员权限" };
  }

  if (!collection || !docId) {
    return { ok: false, error: "缺少参数" };
  }

  const allowedCollections = ["posts", "ideas", "books", "workshops", "reports"];
  if (!allowedCollections.includes(collection)) {
    return { ok: false, error: "不允许操作的集合" };
  }

  try {
    if (action === "delete") {
      // 删除文档
      await db.collection(collection).doc(docId).remove();

      // 级联清理关联数据（仅 posts/ideas）
      if (collection === "posts" || collection === "ideas") {
        try {
          await db.collection("favorites").where({ targetId: docId }).remove();
        } catch (e) {
          console.warn("清理 favorites 失败:", e);
        }
        try {
          await db.collection("reports").where({ targetId: docId }).remove();
        } catch (e) {
          console.warn("清理 reports 失败:", e);
        }
      }

      return { ok: true };
    }

    return { ok: false, error: "未知操作" };
  } catch (err) {
    console.error("admin-delete error:", err);
    return { ok: false, error: err.message || "操作失败" };
  }
};
