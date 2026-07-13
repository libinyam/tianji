const cloudbase = require("@cloudbase/node-sdk");

// 延迟初始化：真实运行时首次使用才连接 CloudBase；测试可通过
// __setTestDb 注入假数据库，避免加载真实 SDK（缺凭据会失败）。
let app;
let db;
let _;

function ensureApp() {
  // 测试注入 db 后跳过真实初始化
  if (!app && !db) {
    app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
    db = app.database();
    _ = db.command;
  }
  return app;
}

// 仅供测试注入假数据库，生产代码不应调用
exports.__setTestDb = (fakeDb) => {
  db = fakeDb;
  _ = fakeDb.command;
};

const SENSITIVE_WORDS = [
  "垃圾", "广告", "色情", "赌博", "毒品", "诈骗",
  "fuck", "shit", "bitch",
];

function containsSensitiveWord(text) {
  const lower = String(text || "").toLowerCase();
  const found = [];
  for (const word of SENSITIVE_WORDS) {
    if (lower.includes(word.toLowerCase())) {
      found.push(word);
    }
  }
  return { found: found.length > 0, words: found };
}

async function isBanned(uid) {
  try {
    const { data } = await db.collection("users_v2").doc(uid).get();
    if (!data || data.length === 0) return false;
    const user = data[0];
    if (!user.banned) return false;
    if (user.bannedUntil) {
      const until = new Date(user.bannedUntil).getTime();
      if (Date.now() > until) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function ok(data) {
  return { ok: true, data };
}

function fail(error) {
  return { ok: false, error };
}

// 幂等加分：以 eventId 为唯一键先登记事件，仅首次登记成功时才加分。
// 重试、取消后重投、重复采纳等重放请求不会重复加分。
// 沿用本文件 voteAnswer 中的 set().upserted 检测模式，保持一致。
async function awardReputationOnce(uid, points, eventId, reason) {
  if (!uid || !points || !eventId) return false;

  let isNewEvent = false;
  try {
    const result = await db.collection("reputation_events").doc(eventId).set({
      eventId,
      uid,
      points,
      reason: reason || "",
      createdAt: Date.now(),
    });
    const r = result || {};
    // 首次写入为 upsert；重放请求命中已存在文档会是 replaced/updated
    isNewEvent =
      (r.upserted || 0) > 0 && (r.replaced || 0) === 0 && (r.updated || 0) === 0;
  } catch {
    // 事件登记失败时不加分，避免无记录的加分
    return false;
  }

  if (!isNewEvent) return false;

  try {
    await db.collection("users_v2").doc(uid).update({
      reputation: _.inc(points),
    });
  } catch {}

  return true;
}

async function submitAnswer(event, uid) {
  const { postId, content } = event;
  if (!postId || !content) return fail("缺少参数");

  if (await isBanned(uid)) return fail("您的账号已被封禁");
  const sc = containsSensitiveWord(content);
  if (sc.found) return fail(`内容包含敏感词: ${sc.words.join(", ")}`);

  const docRef = db.collection("posts").doc(postId);
  const { data } = await docRef.get();
  if (!data || data.length === 0) return fail("帖子不存在");

  const post = data[0];
  if (post.locked) return fail("该帖子已被锁定，无法回答");

  const answer = {
    id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    author: post.author || "",
    authorUid: uid,
    avatarColor: "#7cc4ff",
    votes: 0,
    accepted: false,
    content: String(content).slice(0, 10000),
    date: new Date().toISOString(),
  };

  await docRef.update({
    answerList: _.push([answer]),
    answersCount: _.inc(1),
  });

  await awardReputationOnce(uid, 5, `answer:create:${answer.id}`, "createAnswer");

  if (post.authorUid && post.authorUid !== uid) {
    try {
      await db.collection("notifications").add({
        uid: post.authorUid,
        type: "answer",
        title: post.title || "",
        link: `/discussion/${postId}`,
        read: false,
        createdAt: new Date().toISOString(),
      });
    } catch {}
  }

  return ok(answer);
}

async function submitComment(event, uid) {
  const { postId, answerId, content, replyTo } = event;
  if (!postId || !answerId || !content) return fail("缺少参数");

  if (await isBanned(uid)) return fail("您的账号已被封禁");
  const sc = containsSensitiveWord(content);
  if (sc.found) return fail(`内容包含敏感词: ${sc.words.join(", ")}`);

  const docRef = db.collection("posts").doc(postId);
  const { data } = await docRef.get();
  if (!data || data.length === 0) return fail("帖子不存在");

  const post = data[0];
  if (post.locked) return fail("该帖子已被锁定，无法评论");

  const answerList = post.answerList || [];
  const idx = answerList.findIndex((a) => a.id === answerId);
  if (idx === -1) return fail("回答不存在");

  const comment = {
    id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    author: "",
    authorUid: uid,
    avatarColor: "#7cc4ff",
    content: String(content).slice(0, 5000),
    date: new Date().toISOString(),
    replyTo: replyTo || null,
  };

  const fieldPath = `answerList.${idx}.comments`;
  await docRef.update({
    [fieldPath]: _.push([comment]),
  });

  return ok(comment);
}

async function voteAnswer(event, uid) {
  const { postId, answerId, isUpvote } = event;
  if (!postId || !answerId) return fail("缺少参数");

  const voteDocId = `${uid}_${answerId}`;
  const votesCol = db.collection("votes");

  let shouldInc = false;

  if (isUpvote) {
    const result = await votesCol.doc(voteDocId).set({
      answerId, uid, postId, createdAt: Date.now(),
    });
    const resultObj = result || {};
    const upserted = resultObj.upserted || 0;
    const replaced = resultObj.replaced || 0;
    shouldInc = upserted > 0 && replaced === 0;
  } else {
    try {
      const result = await votesCol.doc(voteDocId).remove();
      const resultObj = result || {};
      const deleted = resultObj.deleted || 1;
      shouldInc = deleted > 0;
    } catch {
      return ok({ changed: false });
    }
  }

  if (!shouldInc) return ok({ changed: false });

  const docRef = db.collection("posts").doc(postId);
  const { data } = await docRef.get();
  if (!data || data.length === 0) return fail("帖子不存在");

  const post = data[0];
  const answerList = post.answerList || [];
  const idx = answerList.findIndex((a) => a.id === answerId);
  if (idx === -1) return fail("回答不存在");

  const fieldPath = `answerList.${idx}.votes`;
  await docRef.update({
    [fieldPath]: _.inc(isUpvote ? 1 : -1),
  });

  if (isUpvote) {
    const answerAuthor = answerList[idx]?.authorUid;
    // eventId 以「投票者+回答」为唯一键：取消后重新投票不会重复加分
    if (answerAuthor && answerAuthor !== uid) {
      await awardReputationOnce(
        answerAuthor,
        10,
        `vote:answer:${answerId}:${uid}:up`,
        "answerVoted"
      );
    }
  }

  return ok({ changed: true });
}

async function acceptAnswer(event, uid) {
  const { postId, answerId, accept } = event;
  if (!postId || !answerId) return fail("缺少参数");

  const docRef = db.collection("posts").doc(postId);
  const { data } = await docRef.get();
  if (!data || data.length === 0) return fail("帖子不存在");

  const post = data[0];
  if (post.authorUid !== uid) return fail("只有提问者可以采纳回答");

  const answerList = post.answerList || [];
  const idx = answerList.findIndex((a) => a.id === answerId);
  if (idx === -1) return fail("回答不存在");

  const newAnswerList = answerList.map((a) => ({ ...a, accepted: false }));
  if (accept) {
    newAnswerList[idx] = { ...newAnswerList[idx], accepted: true };
    const answerAuthor = answerList[idx]?.authorUid;
    // eventId 以「帖子+回答」为唯一键：重复采纳同一回答不会重复加分
    if (answerAuthor) {
      await awardReputationOnce(
        answerAuthor,
        15,
        `accept:answer:${postId}:${answerId}`,
        "answerAccepted"
      );
    }
  }

  await docRef.update({ answerList: newAnswerList });
  return ok({ accepted: !!accept });
}

async function incrementPostViews(event) {
  const { postId } = event;
  if (!postId) return fail("缺少参数");
  await db.collection("posts").doc(postId).update({
    views: _.inc(1),
  });
  return ok({ incremented: true });
}

async function incrementBookDownloads(event) {
  const { bookId } = event;
  if (!bookId) return fail("缺少参数");
  await db.collection("books").doc(bookId).update({
    downloads: _.inc(1),
  });
  return ok({ incremented: true });
}

async function adjustBookFavorites(event, uid) {
  const { bookId, delta } = event;
  if (!bookId) return fail("缺少参数");
  const d = Number(delta);
  if (d !== 1 && d !== -1) return fail("delta 只能为 1 或 -1");

  const favDocId = `${uid}_${bookId}`;
  const favCol = db.collection("favorites");

  if (d === 1) {
    await favCol.doc(favDocId).set({
      uid, bookId, createdAt: Date.now(),
    });
  } else {
    try {
      await favCol.doc(favDocId).remove();
    } catch {}
  }

  await db.collection("books").doc(bookId).update({
    favorites: _.inc(d),
  });

  return ok({ adjusted: true });
}

async function resonanceIdea(event, uid) {
  const { id } = event;
  if (!id) return fail("缺少参数");

  if (await isBanned(uid)) return fail("您的账号已被封禁");

  const docRef = db.collection("ideas").doc(id);
  const { data } = await docRef.get();
  if (!data || data.length === 0) return fail("灵感不存在");

  const doc = data[0];
  const resonatedBy = doc.resonatedBy || [];
  if (resonatedBy.includes(uid)) return fail("已共鸣过此灵感");

  await docRef.update({
    resonance: _.inc(1),
    resonatedBy: _.addToSet(uid),
  });

  // eventId 以「灵感+共鸣者」为唯一键，与上方 resonatedBy 去重双重保险
  if (doc.authorUid && doc.authorUid !== uid) {
    await awardReputationOnce(
      doc.authorUid,
      1,
      `resonate:idea:${id}:${uid}`,
      "ideaResonated"
    );
  }

  return ok({ resonated: true });
}

const REPUTATION_RULES = {
  createPost: 2,
  createAnswer: 5,
  answerAccepted: 15,
  answerVoted: 10,
  bookFavorited: 3,
  ideaResonated: 1,
};

async function awardCreateReputation(event, uid) {
  const { reason, entityId } = event;
  if (!reason) return fail("缺少 reason 参数");

  const points = REPUTATION_RULES[reason];
  if (typeof points !== "number") return fail("无效的 reason");

  // 传入 entityId 时按「reason+实体」做幂等，重复提交同一创建事件只加分一次；
  // 未传时退回到直接加分（兼容旧客户端）
  if (entityId) {
    const awarded = await awardReputationOnce(
      uid,
      points,
      `create:${reason}:${entityId}`,
      reason
    );
    return ok({ awarded });
  }

  try {
    await db.collection("users_v2").doc(uid).update({
      reputation: _.inc(points),
    });
  } catch {}

  return ok({ awarded: true });
}

exports.main = async (event, context) => {
  const { action } = event;
  if (!action) return fail("缺少 action 参数");

  const appInst = ensureApp();

  let uid = "";
  // 测试注入 db 时 appInst 为空，直接走 context.userInfo 回退
  if (appInst) {
    try {
      const info = await appInst.auth().getEndUserInfo();
      uid = info?.userInfo?.uid || "";
    } catch {}
  }
  if (!uid && context?.userInfo) {
    uid = context.userInfo.uid || "";
  }
  if (!uid && context?.identifier) {
    uid = context.identifier;
  }

  const PUBLIC_ACTIONS = ["incrementPostViews", "incrementBookDownloads"];
  if (!uid && !PUBLIC_ACTIONS.includes(action)) {
    return fail("请先登录");
  }

  try {
    switch (action) {
      case "submitAnswer":
        return await submitAnswer(event, uid);
      case "submitComment":
        return await submitComment(event, uid);
      case "voteAnswer":
        return await voteAnswer(event, uid);
      case "acceptAnswer":
        return await acceptAnswer(event, uid);
      case "incrementPostViews":
        return await incrementPostViews(event);
      case "incrementBookDownloads":
        return await incrementBookDownloads(event);
      case "adjustBookFavorites":
        return await adjustBookFavorites(event, uid);
      case "resonanceIdea":
        return await resonanceIdea(event, uid);
      case "awardCreateReputation":
        return await awardCreateReputation(event, uid);
      default:
        return fail(`未知 action: ${action}`);
    }
  } catch (err) {
    return fail(err.message || "操作失败");
  }
};
