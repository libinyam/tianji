import { app } from "@/lib/cloudbase";
import { awardReputation, REPUTATION_RULES } from "@/lib/reputation";
import { sanitizeInput, sanitizeTitle, sanitizeTag } from "@/lib/sanitize";
import { checkCurrentUserBanned } from "@/lib/ban";
import { containsSensitiveWord } from "@/lib/sensitive-words";
import type { Question, Answer, Comment } from "@/types";

const db = app.database();
const POSTS_COLLECTION = "posts";

/** 数据库中存储的帖子文档结构 */
export type PostCategory = "academic" | "casual";

/** 闲聊区子分类 */
export type CasualSubCategory = "灌水" | "动态" | "新闻" | "其他";
export const CASUAL_SUB_CATEGORIES: CasualSubCategory[] = ["灌水", "动态", "新闻", "其他"];

export interface PostDoc {
  _id?: string;
  title: string;
  excerpt: string;
  body: string;
  tags: string[];
  author: string;
  authorUid: string;
  avatarColor: string;
  bounty?: number;
  category?: PostCategory; // "academic"(学术区) | "casual"(闲聊区)
  subCategory?: CasualSubCategory; // 闲聊区子分类
  // 统计字段
  views: number;
  votes: number;
  answersCount: number;
  answerList: Answer[];
  createdAt: string;
  isMock?: boolean; // 标记 Mock 帖子
  pinned?: boolean; // 置顶
  locked?: boolean; // 锁定
  featured?: boolean; // 加精
}

/** 把 PostDoc 转成前端 Question 类型 */
function toQuestion(doc: PostDoc): Question {
  return {
    id: doc._id ?? "",
    title: doc.title,
    excerpt: doc.excerpt,
    author: doc.author,
    authorUid: doc.authorUid,
    avatarColor: doc.avatarColor,
    tags: doc.tags ?? [],
    answers: doc.answersCount ?? doc.answerList?.length ?? 0,
    views: doc.views ?? 0,
    votes: doc.votes ?? 0,
    bounty: doc.bounty,
    createdAt: doc.createdAt,
    body: doc.body,
    answerList: doc.answerList ?? [],
    category: doc.category ?? "academic",
    subCategory: doc.subCategory,
    pinned: doc.pinned,
    locked: doc.locked,
    featured: doc.featured,
  };
}

/** 获取当前登录用户的显示名 */
function getCurrentUserName(): string {
  const user = useAuthStore.getState().user;
  return user?.nickname || user?.username || user?.email || "匿名用户";
}

function getCurrentUid(): string {
  return useAuthStore.getState().user?.uid ?? "";
}

// 延迟引入避免循环依赖
import { useAuthStore } from "@/stores/auth";

const AVATAR_COLORS = ["#7cc4ff", "#f3c969", "#5aa6f0", "#a78bfa", "#34d399", "#fb923c"];

/** 结构化查询结果，区分「无数据」和「加载失败」（#106） */
export interface PostsResult {
  data: Question[];
  error: string | null;
}

/** 获取所有帖子，可按分区和子分类筛选，按时间倒序。
 *  返回 {data, error} 结构，调用方可区分「无数据」和「请求失败」 */
export async function fetchPosts(
  category?: PostCategory,
  subCategory?: CasualSubCategory
): Promise<PostsResult> {
  try {
    const col = db.collection(POSTS_COLLECTION);
    const whereCond: Record<string, string> = {};
    if (category) whereCond.category = category;
    if (subCategory) whereCond.subCategory = subCategory;
    const { data } = Object.keys(whereCond).length
      ? await col.where(whereCond).orderBy("pinned", "desc").orderBy("createdAt", "desc").limit(100).get()
      : await col.orderBy("pinned", "desc").orderBy("createdAt", "desc").limit(100).get();

    const realPosts = ((data as PostDoc[]) ?? []).map(toQuestion);
    return { data: realPosts, error: null };
  } catch (err) {
    // 不再把错误吞成空数组，让 UI 能区分「无数据」和「请求失败」
    const msg = err instanceof Error ? err.message : "加载讨论失败";
    return { data: [], error: msg };
  }
}

/** 按浏览量取热门帖子（首页侧栏榜单用），失败时返回空数组不阻塞页面 */
export async function fetchHotPosts(limit = 5): Promise<Question[]> {
  try {
    const { data } = await db
      .collection(POSTS_COLLECTION)
      .orderBy("views", "desc")
      .limit(limit)
      .get();
    return ((data as PostDoc[]) ?? []).map(toQuestion);
  } catch {
    return [];
  }
}

/** 获取单个帖子详情 */
export async function fetchPostById(id: string): Promise<Question | null> {
  try {
    const { data } = await db
      .collection(POSTS_COLLECTION)
      .doc(id)
      .get();

    if (!data || data.length === 0) return null;
    return toQuestion(data[0] as PostDoc);
  } catch {
    return null;
  }
}

/** 创建新帖子 */
export async function createPost(params: {
  title: string;
  body: string;
  tags: string[];
  bounty?: number;
  category?: PostCategory;
  subCategory?: CasualSubCategory;
}): Promise<Question | null> {
  const cleanTitle = sanitizeTitle(params.title);
  const cleanBody = sanitizeInput(params.body);
  const cleanTags = params.tags.map(sanitizeTag);

  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");

  const banStatus = await checkCurrentUserBanned();
  if (banStatus) throw new Error("您的账号已被封禁");

  const sensitiveCheck = containsSensitiveWord(cleanTitle + cleanBody);
  if (sensitiveCheck.found) {
    throw new Error(`内容包含敏感词: ${sensitiveCheck.words.join(", ")}`);
  }

  const excerpt =
    cleanBody.length > 120 ? cleanBody.slice(0, 120) + "…" : cleanBody;

  const doc: Omit<PostDoc, "_id"> = {
    title: cleanTitle,
    excerpt,
    body: cleanBody,
    tags: cleanTags,
    author: getCurrentUserName(),
    authorUid: uid,
    avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    bounty: params.bounty,
    category: params.category ?? "academic",
    subCategory: params.subCategory,
    views: 0,
    votes: 0,
    answersCount: 0,
    answerList: [],
    createdAt: new Date().toISOString(),
  };

  const res = await db.collection(POSTS_COLLECTION).add(doc);
  const resObj = res as unknown as Record<string, unknown>;
  const newId = (resObj.id as string) ?? (resObj._id as string) ?? "";
  await awardReputation(uid, REPUTATION_RULES.createPost);
  return {
    id: newId,
    title: doc.title,
    excerpt: doc.excerpt,
    author: doc.author,
    authorUid: uid,
    avatarColor: doc.avatarColor,
    tags: doc.tags,
    category: doc.category,
    subCategory: doc.subCategory,
    answers: 0,
    views: 0,
    votes: 0,
    bounty: doc.bounty,
    createdAt: doc.createdAt,
    body: doc.body,
    answerList: [],
  };
}

/** 增加浏览量 */
export async function incrementViews(id: string): Promise<void> {
  try {
    const docRef = db.collection(POSTS_COLLECTION).doc(id);
    await docRef.update({ views: db.command.inc(1) });
  } catch {
    // 静默失败，浏览量不影响核心体验
  }
}

/** 提交回答 */
export async function submitAnswer(
  postId: string,
  content: string
): Promise<Answer | null> {
  const cleanContent = sanitizeInput(content);

  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");

  const banStatus = await checkCurrentUserBanned();
  if (banStatus) throw new Error("您的账号已被封禁");

  const sensitiveCheck = containsSensitiveWord(cleanContent);
  if (sensitiveCheck.found) {
    throw new Error(`内容包含敏感词: ${sensitiveCheck.words.join(", ")}`);
  }

  const res = await app.callFunction({
    name: "content-actions",
    data: { action: "submitAnswer", postId, content: cleanContent },
  });
  const result = (res?.result ?? {}) as { ok?: boolean; data?: Answer; error?: string };
  if (!result.ok) throw new Error(result.error || "操作失败");
  return result.data ?? null;
}

/** 对某个回答添加评论/回复 */
export async function submitComment(
  postId: string,
  answerId: string,
  content: string,
  replyTo?: string
): Promise<Comment | null> {
  const cleanContent = sanitizeInput(content);

  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");

  const banStatus = await checkCurrentUserBanned();
  if (banStatus) throw new Error("您的账号已被封禁");

  const sensitiveCheck = containsSensitiveWord(cleanContent);
  if (sensitiveCheck.found) {
    throw new Error(`内容包含敏感词: ${sensitiveCheck.words.join(", ")}`);
  }

  const res = await app.callFunction({
    name: "content-actions",
    data: { action: "submitComment", postId, answerId, content: cleanContent, replyTo },
  });
  const result = (res?.result ?? {}) as { ok?: boolean; data?: Comment; error?: string };
  if (!result.ok) throw new Error(result.error || "操作失败");
  return result.data ?? null;
}

/** 编辑帖子（仅作者） */
export async function updatePost(
  postId: string,
  params: { title: string; body: string; tags: string[] }
): Promise<boolean> {
  const cleanTitle = sanitizeTitle(params.title);
  const cleanBody = sanitizeInput(params.body);
  const cleanTags = params.tags.map(sanitizeTag);

  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");

  const docRef = db.collection(POSTS_COLLECTION).doc(postId);
  const { data } = await docRef.get();
  if (!data || data.length === 0) return false;

  const post = data[0] as PostDoc;
  if (post.authorUid !== uid) throw new Error("无权编辑他人帖子");

  const excerpt = cleanBody.length > 120 ? cleanBody.slice(0, 120) + "…" : cleanBody;
  await docRef.update({
    title: cleanTitle,
    body: cleanBody,
    excerpt,
    tags: cleanTags,
  });
  return true;
}

/** 删除帖子（仅作者） */
export async function deletePost(postId: string): Promise<boolean> {
  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");

  const docRef = db.collection(POSTS_COLLECTION).doc(postId);
  const { data } = await docRef.get();
  if (!data || data.length === 0) return false;

  const post = data[0] as PostDoc;
  if (post.authorUid !== uid) throw new Error("无权删除他人帖子");

  await docRef.remove();

  // 级联清理收藏、举报和投票（不阻塞主流程）
  try {
    await db.collection("favorites").where({ targetId: postId }).remove();
  } catch { /* 安全规则可能拦截，忽略 */ }
  try {
    await db.collection("reports").where({ targetId: postId }).remove();
  } catch { /* 安全规则可能拦截，忽略 */ }
  try {
    await db.collection("votes").where({ postId }).remove();
  } catch { /* 安全规则可能拦截，忽略 */ }

  return true;
}

/** 编辑回答（仅作者） */
export async function updateAnswer(
  postId: string,
  answerId: string,
  content: string
): Promise<boolean> {
  const cleanContent = sanitizeInput(content);

  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");

  const docRef = db.collection(POSTS_COLLECTION).doc(postId);
  const { data } = await docRef.get();
  if (!data || data.length === 0) return false;

  const post = data[0] as PostDoc;
  const answerList = post.answerList ?? [];
  const idx = answerList.findIndex((a) => a.id === answerId);
  if (idx === -1) return false;

  if (answerList[idx].authorUid !== uid) throw new Error("无权编辑他人回答");

  answerList[idx] = { ...answerList[idx], content: cleanContent };
  await docRef.update({ answerList });
  return true;
}

/** 删除回答（仅作者） */
export async function deleteAnswer(
  postId: string,
  answerId: string
): Promise<boolean> {
  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");

  const docRef = db.collection(POSTS_COLLECTION).doc(postId);
  const { data } = await docRef.get();
  if (!data || data.length === 0) return false;

  const post = data[0] as PostDoc;
  const answerList = post.answerList ?? [];
  const idx = answerList.findIndex((a) => a.id === answerId);
  if (idx === -1) return false;

  if (answerList[idx].authorUid !== uid) throw new Error("无权删除他人回答");

  answerList.splice(idx, 1);
  // answersCount 用 inc(-1) 原子递减，避免与 submitAnswer 的 inc(1) 混用导致计数漂移（#131）
  // answerList 数组移除仍为读-改-写（SDK 不支持位置 $ 操作符），根治见 #105
  await docRef.update({ answerList, answersCount: db.command.inc(-1) });

  // 级联清理该回答的投票记录（不阻塞主流程）
  try {
    await db.collection("votes").where({ answerId }).remove();
  } catch { /* 安全规则可能拦截，忽略 */ }

  return true;
}

/** 删除评论（仅作者） */
export async function deleteComment(
  postId: string,
  answerId: string,
  commentId: string
): Promise<boolean> {
  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");

  const docRef = db.collection(POSTS_COLLECTION).doc(postId);
  const { data } = await docRef.get();
  if (!data || data.length === 0) return false;

  const post = data[0] as PostDoc;
  const answerList = post.answerList ?? [];
  const aIdx = answerList.findIndex((a) => a.id === answerId);
  if (aIdx === -1) return false;

  const comments = answerList[aIdx].comments ?? [];
  const cIdx = comments.findIndex((c) => c.id === commentId);
  if (cIdx === -1) return false;

  if (comments[cIdx].authorUid !== uid) throw new Error("无权删除他人评论");

  comments.splice(cIdx, 1);
  answerList[aIdx] = { ...answerList[aIdx], comments };
  await docRef.update({ answerList });
  return true;
}

/** 编辑评论（仅作者） */
export async function updateComment(
  postId: string,
  answerId: string,
  commentId: string,
  content: string
): Promise<boolean> {
  const cleanContent = sanitizeInput(content);

  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");

  const docRef = db.collection(POSTS_COLLECTION).doc(postId);
  const { data } = await docRef.get();
  if (!data || data.length === 0) return false;

  const post = data[0] as PostDoc;
  const answerList = post.answerList ?? [];
  const aIdx = answerList.findIndex((a) => a.id === answerId);
  if (aIdx === -1) return false;

  const comments = answerList[aIdx].comments ?? [];
  const cIdx = comments.findIndex((c) => c.id === commentId);
  if (cIdx === -1) return false;

  if (comments[cIdx].authorUid !== uid) throw new Error("无权编辑他人评论");

  comments[cIdx] = { ...comments[cIdx], content: cleanContent };
  answerList[aIdx] = { ...answerList[aIdx], comments };
  await docRef.update({ answerList });
  return true;
}

/** 采纳回答（仅帖子作者可操作，每篇帖子只能有一个采纳回答） */
export async function acceptAnswer(
  postId: string,
  answerId: string,
  accept: boolean
): Promise<boolean> {
  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");

  const res = await app.callFunction({
    name: "content-actions",
    data: { action: "acceptAnswer", postId, answerId, accept },
  });
  const result = (res?.result ?? {}) as { ok?: boolean; error?: string };
  if (!result.ok) throw new Error(result.error || "操作失败");
  return true;
}

/** 检查用户是否已投票 */
export async function hasVoted(answerId: string): Promise<boolean> {
  const uid = getCurrentUid();
  if (!uid) return false;
  const { data } = await db
    .collection("votes")
    .where({ answerId, uid })
    .get();
  return (data ?? []).length > 0;
}

/** 获取用户已投票的回答ID列表 */
export async function getVotedAnswerIds(answerIds: string[]): Promise<Set<string>> {
  const uid = getCurrentUid();
  if (!uid || answerIds.length === 0) return new Set();
  const _ = db.command;
  const { data } = await db
    .collection("votes")
    .where({ uid, answerId: _.in(answerIds) })
    .get();
  return new Set((data ?? []).map((d: { answerId: string }) => d.answerId));
}

/** 给回答投票/取消投票（持久化到数据库 + 防重复） */
export async function voteAnswer(
  postId: string,
  answerId: string,
  isUpvote: boolean
): Promise<boolean> {
  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");

  const res = await app.callFunction({
    name: "content-actions",
    data: { action: "voteAnswer", postId, answerId, isUpvote },
  });
  const result = (res?.result ?? {}) as { ok?: boolean; error?: string };
  if (!result.ok) throw new Error(result.error || "操作失败");
  return true;
}
