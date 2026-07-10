const cloudbase = require("@cloudbase/node-sdk");

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });

// 管理员 uid 列表从环境变量读取，逗号分隔；未配置时为空数组（fail-safe：无人是管理员）
const ADMIN_UIDS = (process.env.ADMIN_UIDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

exports.main = async (event, context) => {
  let uid = "";
  let uidSource = "";

  // 1. 优先从 getEndUserInfo 获取（最可靠）
  try {
    const info = await app.auth().getEndUserInfo(context);
    uid = info?.userInfo?.uid || info?.uid || "";
    uidSource = uid ? "getEndUserInfo" : "";
  } catch (e) {
    // getEndUserInfo 不可用
  }

  // 2. 回退到 context.userInfo
  if (!uid && context?.userInfo) {
    uid = context.userInfo.uid || "";
    uidSource = uid ? "context.userInfo" : "";
  }

  // 3. 回退到 context.identifier
  if (!uid && context?.identifier) {
    uid = context.identifier;
    uidSource = "context.identifier";
  }

  // 安全策略：如果所有服务端身份源均无法获取 uid，一律视为非管理员。
  // 不再接受前端传入的 callerUid 作为回退，防止攻击者伪造身份。

  const isAdmin = !!uid && ADMIN_UIDS.includes(uid);

  return {
    ok: true,
    isAdmin,
    uid: uid ? uid.slice(0, 8) + "..." : "(empty)",
    uidSource,
  };
};
