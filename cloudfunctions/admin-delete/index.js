const cloudbase = require("@cloudbase/node-sdk");

const app = cloudbase.init({
  env: cloudbase.SYMBOL_CURRENT_ENV,
});

const db = app.database();

const ADMIN_UIDS = ["2068674931977097216"];

exports.main = async (event, context) => {
  const { collection, docId, action } = event;

  let uid = "";

  try {
    const info = await app.auth().getEndUserInfo(context);
    uid = info?.userInfo?.uid || info?.uid || "";
  } catch (e) {
    // getEndUserInfo 不可用时，回退到 context
  }

  if (!uid && context?.userInfo) {
    uid = context.userInfo.uid || "";
  }

  if (!uid && context?.identifier) {
    uid = context.identifier;
  }

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

      // 级联清理关联数据（所有内容类型）
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

      return { ok: true };
    }

    return { ok: false, error: "未知操作" };
  } catch (err) {
    console.error("admin-delete error:", err);
    return { ok: false, error: err.message || "操作失败" };
  }
};
