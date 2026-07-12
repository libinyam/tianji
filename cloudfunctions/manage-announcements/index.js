const cloudbase = require("@cloudbase/node-sdk");

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();

const ADMIN_UIDS = (process.env.ADMIN_UIDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

async function getCallerUid(context) {
  try {
    const info = await app.auth().getEndUserInfo();
    if (info?.userInfo?.uid) return info.userInfo.uid;
  } catch {}
  if (context?.userInfo?.uid) return context.userInfo.uid;
  if (context?.identifier) return context.identifier;
  return "";
}

function ok(data) {
  return { ok: true, data };
}

function fail(error) {
  return { ok: false, error };
}

function sanitizeText(text, maxLen = 5000) {
  return String(text || "").trim().slice(0, maxLen);
}

async function createAnnouncement(event, uid) {
  const { title, content } = event;
  if (!title || !content) return fail("标题和内容不能为空");

  const cleanTitle = sanitizeText(title, 200);
  const cleanContent = sanitizeText(content, 5000);
  if (!cleanTitle || !cleanContent) return fail("标题和内容不能为空");

  const doc = {
    title: cleanTitle,
    content: cleanContent,
    authorUid: uid,
    authorName: event.authorName || "管理员",
    createdAt: new Date().toISOString(),
    active: true,
  };

  const res = await db.collection("announcements").add(doc);
  const resObj = res || {};
  const newId = resObj.id || resObj._id || "";

  return ok({
    id: newId,
    ...doc,
  });
}

async function toggleAnnouncement(event) {
  const { id, active } = event;
  if (!id) return fail("缺少公告 ID");

  await db.collection("announcements").doc(id).update({
    active: !!active,
  });

  return ok({ id, active: !!active });
}

async function deleteAnnouncement(event) {
  const { id } = event;
  if (!id) return fail("缺少公告 ID");

  await db.collection("announcements").doc(id).remove();

  return ok({ id, deleted: true });
}

async function listAnnouncements() {
  const { data } = await db
    .collection("announcements")
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();

  const list = (data || []).map((d) => ({
    id: d._id,
    title: d.title,
    content: d.content,
    authorUid: d.authorUid || "",
    authorName: d.authorName || "管理员",
    createdAt: d.createdAt,
    active: d.active !== false,
  }));

  return ok(list);
}

exports.main = async (event, context) => {
  const { action } = event;
  if (!action) return fail("缺少 action 参数");

  const uid = await getCallerUid(context);
  const isAdmin = !!uid && ADMIN_UIDS.includes(uid);

  switch (action) {
    case "list":
      return await listAnnouncements();

    case "create":
    case "toggle":
    case "delete":
      if (!isAdmin) return fail("无权限：仅管理员可操作公告");
      if (action === "create") return await createAnnouncement(event, uid);
      if (action === "toggle") return await toggleAnnouncement(event);
      if (action === "delete") return await deleteAnnouncement(event);
      break;

    default:
      return fail(`未知 action: ${action}`);
  }
};
