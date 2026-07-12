const cloudbase = require("@cloudbase/node-sdk");

const app = cloudbase.init({
  env: cloudbase.SYMBOL_CURRENT_ENV,
});

const db = app.database();
const _ = db.command;

const ADMIN_UIDS = (process.env.ADMIN_UIDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const UID_PATTERN = /^[a-zA-Z0-9_-]{4,128}$/;

function isValidUid(uid) {
  return typeof uid === "string" && UID_PATTERN.test(uid);
}

exports.main = async (event, context) => {
  const { action } = event;

  let callerUid = "";

  try {
    const info = await app.auth().getEndUserInfo(context);
    callerUid = info?.userInfo?.uid || info?.uid || "";
  } catch (e) {
  }

  if (!callerUid && context?.userInfo) {
    callerUid = context.userInfo.uid || "";
  }

  if (!callerUid && context?.identifier) {
    callerUid = context.identifier;
  }

  const isAdmin = !!callerUid && ADMIN_UIDS.includes(callerUid);

  try {
    if (action === "banUser") {
      if (!isAdmin) {
        return { ok: false, error: "无管理员权限" };
      }
      const { uid, reason, days } = event;
      if (!isValidUid(uid)) {
        return { ok: false, error: "uid 不合法" };
      }
      if (typeof reason !== "string") {
        return { ok: false, error: "参数类型错误" };
      }
      const update = { banned: true, bannedReason: reason };
      if (typeof days === "number" && days > 0) {
        update.bannedUntil = new Date(
          Date.now() + days * 86400000
        ).toISOString();
      } else {
        update.bannedUntil = "";
      }
      await db.collection("users_v2").doc(uid).update(update);
      return { ok: true };
    }

    if (action === "unbanUser") {
      if (!isAdmin) {
        return { ok: false, error: "无管理员权限" };
      }
      const { uid } = event;
      if (!isValidUid(uid)) {
        return { ok: false, error: "uid 不合法" };
      }
      await db.collection("users_v2").doc(uid).update({
        banned: false,
        bannedReason: "",
        bannedUntil: "",
      });
      return { ok: true };
    }

    if (action === "listUsers") {
      if (!isAdmin) {
        return { ok: false, error: "无管理员权限" };
      }
      const page = Math.max(1, Number(event.page) || 1);
      const pageSize = Math.min(50, Math.max(1, Number(event.pageSize) || 20));
      const skip = (page - 1) * pageSize;
      const { data } = await db.collection("users_v2").skip(skip).limit(pageSize).get();
      return { ok: true, data: data || [], page, pageSize };
    }

    if (action === "searchUsers") {
      if (!isAdmin) {
        return { ok: false, error: "无管理员权限" };
      }
      const { keyword } = event;
      if (typeof keyword !== "string" || keyword.length > 100) {
        return { ok: false, error: "keyword 不合法" };
      }
      const { data } = await db.collection("users_v2").where({
        displayName: db.RegExp({ regexp: keyword, options: "i" })
      }).limit(20).get();
      return { ok: true, data: data || [] };
    }

    if (action === "setReputation") {
      if (!isAdmin) {
        return { ok: false, error: "无管理员权限" };
      }
      const { uid, value } = event;
      if (!isValidUid(uid)) {
        return { ok: false, error: "uid 不合法" };
      }
      if (typeof value !== "number" || !isFinite(value)) {
        return { ok: false, error: "参数类型错误" };
      }
      await db.collection("users_v2").doc(uid).update({
        reputation: value,
      });
      return { ok: true };
    }

    return { ok: false, error: "未知操作" };
  } catch (err) {
    console.error("user-admin error:", err);
    return { ok: false, error: err.message || "操作失败" };
  }
};
