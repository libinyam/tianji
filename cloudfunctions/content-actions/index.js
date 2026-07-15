const cloudbase = require("@cloudbase/node-sdk");
const { withTiming, logError, logInfo } = require("./logger");

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
  // #315 测试模式下注入 mock app，moderateText 调用 callFunction 时返回放行
  app = {
    callFunction: async () => ({ result: { ok: true, suggestion: "pass" } }),
  };
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

/**
 * 调用 content-moderation 云函数进行文本审核（#289）
 * #315 fail-closed：审核服务异常时拒绝，防止通过制造服务故障绕过 UGC 审核
 * 返回 { passed: boolean, suggestion, label, score, error? }
 */
async function moderateText(text, uid, source) {
  // 先做本地敏感词快筛（零延迟兜底）
  const sc = containsSensitiveWord(text);
  if (sc.found) {
    return { passed: false, suggestion: "block", label: "LocalFilter", score: 100, words: sc.words };
  }

  // 调用数据万象 CI 文本审核
  try {
    const res = await app.callFunction({
      name: "content-moderation",
      data: { text: String(text).slice(0, 50000), uid: uid || "", source: source || "" },
    });
    const r = (res && res.result) || {};
    return {
      passed: r.ok !== false,
      suggestion: r.suggestion || "pass",
      label: r.label || "",
      score: r.score || 0,
      requestId: r.requestId || "",
      failOpen: r.failOpen || false,
    };
  } catch (err) {
    // #315 审核服务不可用时拒绝，要求用户稍后重试
    return { passed: false, suggestion: "block", label: "ServiceError", score: 0, error: err.message, failOpen: false };
  }
}

/**
 * 记录审核日志到 moderation_logs 集合（#289）
 * 保留 ≥ 60 天供监管调取
 */
async function logModeration(entry) {
  try {
    await db.collection("moderation_logs").add({
      ...entry,
      timestamp: Date.now(),
      createdAt: new Date().toISOString(),
    });
  } catch {
    // 日志记录失败不阻断主流程
  }
}

/** 审核拦截时的可读提示 */
function moderationRejectMessage(result) {
  if (result.words && result.words.length > 0) {
    return `内容包含敏感词: ${result.words.join(", ")}`;
  }
  // #315 服务故障时提示用户重试，而非判定为内容违规
  if (result.label === "ServiceError") {
    return "内容审核服务暂时不可用，请稍后重试";
  }
  const labelMap = {
    Porn: "涉黄", Ad: "广告", Illegal: "违法", Abuse: "辱骂", Polity: "涉政", Terrorist: "暴恐",
  };
  const label = labelMap[result.label] || result.label || "违规";
  return `内容包含${label}信息，请修改后重试`;
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
    // #313 fail-closed：DB 异常时视为封禁，避免被封禁用户因数据库故障绕过封禁
    return true;
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

/** 创建新帖子（#289 发帖走云函数，含文本审核） */
const AVATAR_COLORS = ["#7cc4ff", "#f3c969", "#5aa6f0", "#a78bfa", "#34d399", "#fb923c"];

async function createPost(event, uid) {
  const { title, body, tags, category, subCategory, bounty, author } = event;
  if (!title || !body) return fail("缺少标题或正文");

  if (await isBanned(uid)) return fail("您的账号已被封禁");

  // #289 文本审核（标题+正文一起审核）
  const fullText = title + "\n" + body;
  const modResult = await moderateText(fullText, uid, "createPost");
  await logModeration({ uid, action: "createPost", suggestion: modResult.suggestion, label: modResult.label, score: modResult.score, textPreview: String(fullText).slice(0, 200) });
  if (!modResult.passed) return fail(moderationRejectMessage(modResult));

  const cleanTitle = String(title).trim().slice(0, 200);
  const cleanBody = String(body).slice(0, 50000);
  const cleanTags = Array.isArray(tags)
    ? tags.map((t) => String(t).trim().slice(0, 20)).filter(Boolean).slice(0, 5)
    : [];
  const excerpt = cleanBody.length > 120 ? cleanBody.slice(0, 120) + "…" : cleanBody;

  const doc = {
    title: cleanTitle,
    excerpt,
    body: cleanBody,
    tags: cleanTags,
    author: author || "匿名用户",
    authorUid: uid,
    avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    bounty: bounty || undefined,
    category: category || "academic",
    subCategory: subCategory || undefined,
    views: 0,
    votes: 0,
    answersCount: 0,
    answerList: [],
    createdAt: new Date().toISOString(),
  };

  const res = await db.collection("posts").add(doc);
  const resObj = res || {};
  const newId = resObj.id || resObj._id || "";

  return ok({ id: newId, title: doc.title, excerpt: doc.excerpt, author: doc.author, authorUid: uid, avatarColor: doc.avatarColor, tags: doc.tags, category: doc.category, subCategory: doc.subCategory, bounty: doc.bounty, views: 0, votes: 0, answersCount: 0, answerList: [], createdAt: doc.createdAt, body: doc.body });
}

async function submitAnswer(event, uid) {
  const { postId, content } = event;
  if (!postId || !content) return fail("缺少参数");

  if (await isBanned(uid)) return fail("您的账号已被封禁");

  // #289 文本审核
  const modResult = await moderateText(content, uid, "submitAnswer");
  await logModeration({ uid, action: "submitAnswer", postId, suggestion: modResult.suggestion, label: modResult.label, score: modResult.score, textPreview: String(content).slice(0, 200) });
  if (!modResult.passed) return fail(moderationRejectMessage(modResult));

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

  // #289 文本审核
  const modResult = await moderateText(content, uid, "submitComment");
  await logModeration({ uid, action: "submitComment", postId, answerId, suggestion: modResult.suggestion, label: modResult.label, score: modResult.score, textPreview: String(content).slice(0, 200) });
  if (!modResult.passed) return fail(moderationRejectMessage(modResult));

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

/**
 * 删除帖子（仅作者，以 admin 权限绕过安全规则）
 * 级联清理收藏、举报、投票记录
 */
async function deletePost(event, uid) {
  const { postId } = event;
  if (!postId) return fail("缺少参数");

  const docRef = db.collection("posts").doc(postId);
  const { data } = await docRef.get();
  if (!data || data.length === 0) return fail("帖子不存在");

  const post = data[0];
  if (post.authorUid !== uid) return fail("无权删除他人帖子");

  await docRef.remove();

  // 级联清理收藏、举报和投票（不阻塞主流程）
  try { await db.collection("favorites").where({ targetId: postId }).remove(); } catch {}
  try { await db.collection("reports").where({ targetId: postId }).remove(); } catch {}
  try { await db.collection("votes").where({ postId }).remove(); } catch {}

  return ok({ deleted: true });
}

/** 删除回答（仅回答作者） */
async function deleteAnswer(event, uid) {
  const { postId, answerId } = event;
  if (!postId || !answerId) return fail("缺少参数");

  const docRef = db.collection("posts").doc(postId);
  const { data } = await docRef.get();
  if (!data || data.length === 0) return fail("帖子不存在");

  const post = data[0];
  const answerList = post.answerList || [];
  const idx = answerList.findIndex((a) => a.id === answerId);
  if (idx === -1) return fail("回答不存在");

  if (answerList[idx].authorUid !== uid) return fail("无权删除他人回答");

  answerList.splice(idx, 1);
  await docRef.update({
    answerList,
    answersCount: _.inc(-1),
  });

  // 级联清理该回答的投票记录
  try {
    await db.collection("votes").where({ answerId }).remove();
  } catch {}

  return ok({ deleted: true });
}

/** 删除评论（仅评论作者） */
async function deleteComment(event, uid) {
  const { postId, answerId, commentId } = event;
  if (!postId || !answerId || !commentId) return fail("缺少参数");

  const docRef = db.collection("posts").doc(postId);
  const { data } = await docRef.get();
  if (!data || data.length === 0) return fail("帖子不存在");

  const post = data[0];
  const answerList = post.answerList || [];
  const aIdx = answerList.findIndex((a) => a.id === answerId);
  if (aIdx === -1) return fail("回答不存在");

  const comments = answerList[aIdx].comments || [];
  const cIdx = comments.findIndex((c) => c.id === commentId);
  if (cIdx === -1) return fail("评论不存在");

  if (comments[cIdx].authorUid !== uid) return fail("无权删除他人评论");

  comments.splice(cIdx, 1);
  answerList[aIdx] = { ...answerList[aIdx], comments };
  await docRef.update({ answerList });

  return ok({ deleted: true });
}

/** 编辑回答（仅回答作者） */
async function updateAnswer(event, uid) {
  const { postId, answerId, content } = event;
  if (!postId || !answerId || !content) return fail("缺少参数");

  if (await isBanned(uid)) return fail("您的账号已被封禁");

  // #289 文本审核
  const modResult = await moderateText(content, uid, "updateAnswer");
  await logModeration({ uid, action: "updateAnswer", postId, answerId, suggestion: modResult.suggestion, label: modResult.label, score: modResult.score, textPreview: String(content).slice(0, 200) });
  if (!modResult.passed) return fail(moderationRejectMessage(modResult));

  const docRef = db.collection("posts").doc(postId);
  const { data } = await docRef.get();
  if (!data || data.length === 0) return fail("帖子不存在");

  const post = data[0];
  const answerList = post.answerList || [];
  const idx = answerList.findIndex((a) => a.id === answerId);
  if (idx === -1) return fail("回答不存在");

  if (answerList[idx].authorUid !== uid) return fail("无权编辑他人回答");

  answerList[idx] = { ...answerList[idx], content: String(content).slice(0, 10000) };
  await docRef.update({ answerList });

  return ok({ updated: true });
}

/** 编辑评论（仅评论作者） */
async function updateComment(event, uid) {
  const { postId, answerId, commentId, content } = event;
  if (!postId || !answerId || !commentId || !content) return fail("缺少参数");

  if (await isBanned(uid)) return fail("您的账号已被封禁");

  // #289 文本审核
  const modResult = await moderateText(content, uid, "updateComment");
  await logModeration({ uid, action: "updateComment", postId, answerId, commentId, suggestion: modResult.suggestion, label: modResult.label, score: modResult.score, textPreview: String(content).slice(0, 200) });
  if (!modResult.passed) return fail(moderationRejectMessage(modResult));

  const docRef = db.collection("posts").doc(postId);
  const { data } = await docRef.get();
  if (!data || data.length === 0) return fail("帖子不存在");

  const post = data[0];
  const answerList = post.answerList || [];
  const aIdx = answerList.findIndex((a) => a.id === answerId);
  if (aIdx === -1) return fail("回答不存在");

  const comments = answerList[aIdx].comments || [];
  const cIdx = comments.findIndex((c) => c.id === commentId);
  if (cIdx === -1) return fail("评论不存在");

  if (comments[cIdx].authorUid !== uid) return fail("无权编辑他人评论");

  comments[cIdx] = { ...comments[cIdx], content: String(content).slice(0, 5000) };
  answerList[aIdx] = { ...answerList[aIdx], comments };
  await docRef.update({ answerList });

  return ok({ updated: true });
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

/**
 * #344 取消收藏（绕过安全规则）
 * 生产环境安全规则可能未及时部署或 delete 规则未生效，导致客户端
 * favorites.doc(id).remove() 返回 deleted=0 / 403。此 action 以 admin
 * 权限删除当前用户自己的收藏记录，校验 doc.uid == auth.uid 防越权。
 */
async function removeFavorite(event, uid) {
  const { targetId } = event;
  if (!targetId) return fail("缺少参数");

  const favCol = db.collection("favorites");
  const { data } = await favCol.where({ uid, targetId }).get();
  const list = data || [];
  if (list.length === 0) return ok({ removed: false, reason: "not_found" });

  const docId = list[0]._id;
  await favCol.doc(docId).remove();
  return ok({ removed: true });
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
  createBook: 3,
  createIdea: 1,
  createWorkshop: 2,
};

const CREATE_REASON_TO_COLLECTION = {
  createPost: "posts",
  createBook: "books",
  createIdea: "ideas",
  createWorkshop: "workshops",
};

const CREATE_REASON_TO_OWNER_FIELD = {
  createPost: "authorUid",
  createBook: "uploaderUid",
  createIdea: "authorUid",
  createWorkshop: "creatorUid",
};

async function awardCreateReputation(event, uid) {
  const { reason, entityId } = event;
  if (!reason) return fail("缺少 reason 参数");
  if (!entityId) return fail("缺少 entityId 参数");

  const points = REPUTATION_RULES[reason];
  if (typeof points !== "number") return fail("无效的 reason");

  const collectionName = CREATE_REASON_TO_COLLECTION[reason];
  const ownerField = CREATE_REASON_TO_OWNER_FIELD[reason];
  if (!collectionName || !ownerField) return fail("该 reason 不支持创建奖励");

  let docExists = false;
  try {
    const { data } = await db.collection(collectionName).doc(entityId).get();
    if (data && data.length > 0) {
      const doc = data[0];
      if (doc[ownerField] === uid) {
        docExists = true;
      }
    }
  } catch {}

  if (!docExists) return fail("内容不存在或非作者");

  const awarded = await awardReputationOnce(
    uid,
    points,
    `create:${reason}:${entityId}`,
    reason
  );
  return ok({ awarded });
}

async function addBookReview(event, uid) {
  const { bookId, author, authorUid, rating, content } = event;
  if (!bookId) return fail("缺少参数");

  // #289 文本审核（仅审核有内容的情况）
  if (content) {
    const modResult = await moderateText(content, uid || authorUid, "addBookReview");
    await logModeration({ uid: uid || authorUid, action: "addBookReview", bookId, suggestion: modResult.suggestion, label: modResult.label, score: modResult.score, textPreview: String(content).slice(0, 200) });
    if (!modResult.passed) return fail(moderationRejectMessage(modResult));
  }

  const docRef = db.collection("books").doc(bookId);
  const { data } = await docRef.get();
  if (!data || data.length === 0) return fail("书籍不存在");

  const book = data[0];
  const reviews = book.reviews || [];
  const idx = reviews.findIndex((r) => r.authorUid === authorUid);

  const review = {
    author: author || "",
    authorUid: authorUid || "",
    rating: Number(rating) || 0,
    content: String(content || "").trim().slice(0, 5000),
    date: new Date().toISOString(),
  };

  let updated = false;
  if (idx >= 0) {
    reviews[idx] = { ...reviews[idx], ...review };
    updated = true;
  } else {
    reviews.push(review);
  }

  const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
  const avgRating = reviews.length > 0 ? sum / reviews.length : 0;

  await docRef.update({
    reviews,
    avgRating,
  });

  return ok({ avgRating, updated });
}

async function joinWorkshop(event, uid) {
  const { workshopId } = event;
  if (!workshopId) return fail("缺少参数");

  const docRef = db.collection("workshops").doc(workshopId);
  const { data } = await docRef.get();
  if (!data || data.length === 0) return fail("工坊不存在");

  const workshop = data[0];
  const participants = workshop.participants || [];
  if (participants.includes(uid)) return fail("已参与此工坊");

  await docRef.update({
    participants: _.addToSet(uid),
  });

  if (workshop.authorUid && workshop.authorUid !== uid) {
    try {
      await db.collection("notifications").add({
        uid: workshop.authorUid,
        type: "workshop",
        title: workshop.title || "",
        link: `/workshop/${workshopId}`,
        read: false,
        createdAt: new Date().toISOString(),
      });
    } catch {}
  }

  return ok({ joined: true });
}

async function submitWorkshopContribution(event, uid) {
  const { workshopId, chapterId, content } = event;
  if (!workshopId || !chapterId || !content) return fail("缺少参数");

  // #289 文本审核
  const modResult = await moderateText(content, uid, "submitWorkshopContribution");
  await logModeration({ uid, action: "submitWorkshopContribution", workshopId, suggestion: modResult.suggestion, label: modResult.label, score: modResult.score, textPreview: String(content).slice(0, 200) });
  if (!modResult.passed) return fail(moderationRejectMessage(modResult));

  const sanitized = String(content || "").trim().slice(0, 10000);

  const docRef = db.collection("workshops").doc(workshopId);
  const { data } = await docRef.get();
  if (!data || data.length === 0) return fail("工坊不存在");

  const workshop = data[0];

  const contribution = {
    id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    chapterId,
    authorUid: uid,
    content: sanitized,
    date: new Date().toISOString(),
  };

  await docRef.update({
    contributions: _.push([contribution]),
  });

  if (workshop.authorUid && workshop.authorUid !== uid) {
    try {
      await db.collection("notifications").add({
        uid: workshop.authorUid,
        type: "workshop",
        title: workshop.title || "",
        link: `/workshop/${workshopId}`,
        read: false,
        createdAt: new Date().toISOString(),
      });
    } catch {}
  }

  return ok(contribution);
}

async function addWorkshopAnnotation(event, uid) {
  const { workshopId, content, selectedText } = event;
  if (!workshopId || !content) return fail("缺少参数");

  // #289 文本审核
  const modResult = await moderateText(content, uid, "addWorkshopAnnotation");
  await logModeration({ uid, action: "addWorkshopAnnotation", workshopId, suggestion: modResult.suggestion, label: modResult.label, score: modResult.score, textPreview: String(content).slice(0, 200) });
  if (!modResult.passed) return fail(moderationRejectMessage(modResult));

  const sanitized = String(content || "").trim().slice(0, 5000);
  // #27 选中文本快照，截断到 200 字符
  const selectedSnapshot = String(selectedText || "").trim().slice(0, 200);

  const docRef = db.collection("workshops").doc(workshopId);
  const { data } = await docRef.get();
  if (!data || data.length === 0) return fail("工坊不存在");

  const annotation = {
    id: `an_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    authorUid: uid,
    content: sanitized,
    // #27 仅在有选中文本时存储，避免空字段
    ...(selectedSnapshot ? { selectedText: selectedSnapshot } : {}),
    resolved: false,
    date: new Date().toISOString(),
  };

  await docRef.update({
    annotations: _.push([annotation]),
  });

  return ok(annotation);
}

async function resolveWorkshopAnnotation(event, uid) {
  const { workshopId, annotationId } = event;
  if (!workshopId || !annotationId) return fail("缺少参数");

  const docRef = db.collection("workshops").doc(workshopId);
  const { data } = await docRef.get();
  if (!data || data.length === 0) return fail("工坊不存在");

  const workshop = data[0];
  const annotations = workshop.annotations || [];
  const idx = annotations.findIndex((a) => a.id === annotationId);
  if (idx === -1) return fail("批注不存在");

  const annotation = annotations[idx];
  if (workshop.authorUid !== uid && annotation.authorUid !== uid) {
    return fail("无权解决此批注");
  }

  annotations[idx] = { ...annotation, resolved: true };

  await docRef.update({ annotations });

  return ok({ resolved: true });
}

/**
 * #98 参与者退出工坊项目
 * 创建者不能退出（只能删除项目）；参与者从 participants 数组移除
 */
async function leaveWorkshop(event, uid) {
  const { workshopId } = event;
  if (!workshopId) return fail("缺少参数");

  const docRef = db.collection("workshops").doc(workshopId);
  const { data } = await docRef.get();
  if (!data || data.length === 0) return fail("工坊不存在");

  const workshop = data[0];
  if (workshop.creatorUid === uid) return fail("创建者不能退出，请删除项目");

  const participants = workshop.participants || [];
  if (!participants.includes(uid)) return fail("您未参与此项目");

  await docRef.update({
    participants: _.pull(uid),
  });

  return ok({ left: true });
}

/**
 * #98 删除批注（创建者或批注作者可删除）
 */
async function deleteWorkshopAnnotation(event, uid) {
  const { workshopId, annotationId } = event;
  if (!workshopId || !annotationId) return fail("缺少参数");

  const docRef = db.collection("workshops").doc(workshopId);
  const { data } = await docRef.get();
  if (!data || data.length === 0) return fail("工坊不存在");

  const workshop = data[0];
  const annotations = workshop.annotations || [];
  const annotation = annotations.find((a) => a.id === annotationId);
  if (!annotation) return fail("批注不存在");

  // 创建者或批注作者可删除
  if (workshop.creatorUid !== uid && annotation.authorUid !== uid) {
    return fail("无权删除此批注");
  }

  await docRef.update({
    annotations: _.pull({ id: annotationId }),
  });

  return ok({ deleted: true });
}

/**
 * #98 参与者编辑工坊文档正文（content 字段）
 * 创建者可编辑所有字段（title/description/content/status 走原有 updateWorkshop），
 * 参与者只能编辑 content，通过云函数绕过安全规则的 creatorUid 限制
 */
async function updateWorkshopContent(event, uid) {
  const { workshopId, content } = event;
  if (!workshopId) return fail("缺少参数");
  if (content === undefined) return fail("缺少 content");

  const sanitized = String(content).slice(0, 30000);

  const docRef = db.collection("workshops").doc(workshopId);
  const { data } = await docRef.get();
  if (!data || data.length === 0) return fail("工坊不存在");

  const workshop = data[0];
  const participants = workshop.participants || [];
  // 创建者或参与者可编辑 content
  if (workshop.creatorUid !== uid && !participants.includes(uid)) {
    return fail("无权编辑，请先加入项目");
  }

  await docRef.update({
    content: sanitized,
    updatedAt: new Date().toISOString(),
  });

  return ok({ updated: true });
}


const RATE_LIMIT_RULES = {
  voteAnswer: { max: 30, windowMs: 60_000 },
  acceptAnswer: { max: 20, windowMs: 60_000 },
  incrementPostViews: { max: 120, windowMs: 60_000 },
  incrementBookDownloads: { max: 60, windowMs: 60_000 },
  _default: { max: 15, windowMs: 60_000 },
};

async function checkRateLimit(uid, action) {
  if (!uid) return { allowed: true };
  const rule = RATE_LIMIT_RULES[action] || RATE_LIMIT_RULES._default;
  const now = Date.now();
  const windowStart = Math.floor(now / rule.windowMs) * rule.windowMs;
  const docId = `rl_${uid}_${action}_${windowStart}`;
  try {
    const { data } = await db.collection("rate_limits").doc(docId).get();
    if (data && data.length > 0) {
      const currentCount = data[0].count || 0;
      if (currentCount >= rule.max) {
        const retryAfter = Math.ceil((rule.windowMs - (now - windowStart)) / 1000);
        return { allowed: false, retryAfter };
      }
      await db.collection("rate_limits").doc(docId).update({
        count: _.inc(1),
        updatedAt: now,
      });
    } else {
      await db.collection("rate_limits").doc(docId).set({
        count: 1,
        uid,
        action,
        windowStart,
        updatedAt: now,
      });
    }
    return { allowed: true };
  } catch {
    return { allowed: true };
  }
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

  const timer = withTiming(action, uid);

  const PUBLIC_ACTIONS = ["incrementPostViews", "incrementBookDownloads"];
  if (!uid && !PUBLIC_ACTIONS.includes(action)) {
    timer.end("unauthorized");
    return fail("请先登录");
  }

  const rateLimit = await checkRateLimit(uid, action);
  if (!rateLimit.allowed) {
    timer.end("rate_limited", { retryAfter: rateLimit.retryAfter });
    return fail(`操作过于频繁，请 ${rateLimit.retryAfter} 秒后再试`);
  }

  try {
    const switchResult = await (async () => {
      switch (action) {
        case "createPost":
          return await createPost(event, uid);
        case "submitAnswer":
          return await submitAnswer(event, uid);
        case "submitComment":
          return await submitComment(event, uid);
        case "deleteAnswer":
          return await deleteAnswer(event, uid);
        case "deleteComment":
          return await deleteComment(event, uid);
        case "deletePost":
          return await deletePost(event, uid);
        case "updateAnswer":
          return await updateAnswer(event, uid);
        case "updateComment":
          return await updateComment(event, uid);
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
        case "removeFavorite":
          return await removeFavorite(event, uid);
        case "resonanceIdea":
          return await resonanceIdea(event, uid);
        case "awardCreateReputation":
          return await awardCreateReputation(event, uid);
        case "addBookReview":
          return await addBookReview(event, uid);
        case "joinWorkshop":
          return await joinWorkshop(event, uid);
        case "submitWorkshopContribution":
          return await submitWorkshopContribution(event, uid);
        case "addWorkshopAnnotation":
          return await addWorkshopAnnotation(event, uid);
        case "resolveWorkshopAnnotation":
          return await resolveWorkshopAnnotation(event, uid);
        case "leaveWorkshop":
          return await leaveWorkshop(event, uid);
        case "deleteWorkshopAnnotation":
          return await deleteWorkshopAnnotation(event, uid);
        case "updateWorkshopContent":
          return await updateWorkshopContent(event, uid);
        default:
          return fail(`未知 action: ${action}`);
      }
    })();
    timer.end(switchResult?.ok ? "success" : "fail", { action });
    return switchResult;
  } catch (err) {
    logError(action, uid, err);
    return fail(err.message || "操作失败");
  }
};
