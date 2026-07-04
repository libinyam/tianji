const cloudbase = require("@cloudbase/node-sdk");

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });

// 管理员 uid 列表（仅服务端持有，不暴露到前端 bundle）
const ADMIN_UIDS = ["2068674931977097216"];

exports.main = async (event, context) => {
  let uid = "";
  try {
    const info = await app.auth().getEndUserInfo(context);
    uid = info?.userInfo?.uid || info?.uid || "";
  } catch (e) {
    // getEndUserInfo 不可用时回退到 context
  }
  if (!uid && context?.userInfo) uid = context.userInfo.uid || "";
  if (!uid && context?.identifier) uid = context.identifier;

  return { ok: true, isAdmin: !!uid && ADMIN_UIDS.includes(uid) };
};
