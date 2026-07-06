const cloudbase = require("@cloudbase/node-sdk");

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });

// 管理员 uid 列表（仅服务端持有，不暴露到前端 bundle）
const ADMIN_UIDS = ["2068674931977097216"];

exports.main = async (event, context) => {
  let uid = "";
  let uidSource = "";
  let debug = {};

  // 1. 优先从 getEndUserInfo 获取（最可靠）
  try {
    const info = await app.auth().getEndUserInfo(context);
    uid = info?.userInfo?.uid || info?.uid || "";
    uidSource = uid ? "getEndUserInfo" : "";
    debug.endUserInfo = JSON.stringify(info)?.slice(0, 200);
  } catch (e) {
    debug.getEndUserInfoError = e.message;
  }

  // 2. 回退到 context.userInfo
  if (!uid && context?.userInfo) {
    uid = context.userInfo.uid || "";
    uidSource = uid ? "context.userInfo" : "";
    debug.contextUserInfo = JSON.stringify(context.userInfo)?.slice(0, 200);
  }

  // 3. 回退到 context.identifier
  if (!uid && context?.identifier) {
    uid = context.identifier;
    uidSource = "context.identifier";
  }

  // 4. 最后回退到前端传入的 uid（accessKey 模式下 getEndUserInfo 可能不可用）
  //    注：此路径安全性较低，仅用于 UI 显示。实际管理员操作（删除等）
  //    走 admin-delete 云函数，有独立的 getEndUserInfo 校验。
  if (!uid && event?.callerUid) {
    uid = event.callerUid;
    uidSource = "event.callerUid";
  }

  const isAdmin = !!uid && ADMIN_UIDS.includes(uid);

  return {
    ok: true,
    isAdmin,
    uid: uid ? uid.slice(0, 8) + "..." : "(empty)",
    uidSource,
    debug,
  };
};
