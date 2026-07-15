import { app, authReady } from "@/lib/cloudbase";
import { awardReputation } from "@/lib/reputation";
import { sanitizeInput, sanitizeTitle, sanitizeTag } from "@/lib/sanitize";
import { checkCurrentUserBanned } from "@/lib/ban";
import { containsSensitiveWord } from "@/lib/sensitive-words";
import { getCurrentUid, getCurrentUserName } from "@/lib/current-user";
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

/** 结构化查询结果，区分「无数据」和「加载失败」（#106） */
export interface PostsResult {
  data: Question[];
  error: string | null;
  hasMore: boolean;
}

const POSTS_PAGE_SIZE = 20;

/** 获取帖子列表，可按分区和子分类筛选，按时间倒序。
 *  支持分页加载，通过 offset 指定起始位置（#278）。
 *  返回 {data, error, hasMore} 结构，调用方可区分「无数据」和「请求失败」 */
export async function fetchPosts(
  category?: PostCategory,
  subCategory?: CasualSubCategory,
  offset?: number,
  pageSize?: number,
): Promise<PostsResult> {
  try {
    await authReady; // #345 等匿名身份就绪，避免新访客首屏 401
    const page = pageSize ?? POSTS_PAGE_SIZE;
    const skip = offset ?? 0;
    const col = db.collection(POSTS_COLLECTION);
    const whereCond: Record<string, string> = {};
    if (category) whereCond.category = category;
    if (subCategory) whereCond.subCategory = subCategory;
    const { data } = Object.keys(whereCond).length
      ? await col.where(whereCond).orderBy("pinned", "desc").orderBy("createdAt", "desc").skip(skip).limit(page).get()
      : await col.orderBy("pinned", "desc").orderBy("createdAt", "desc").skip(skip).limit(page).get();

    const realPosts = ((data as PostDoc[]) ?? []).map(toQuestion);
    return { data: realPosts, error: null, hasMore: realPosts.length === page };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "加载讨论失败";
    return { data: [], error: msg, hasMore: false };
  }
}

/** 获取当前用户关注的人的帖子（个性化 Feed，#149）。
 *  未登录或未关注任何人时返回空 data，hasMore=false。 */
export async function fetchFollowingPosts(): Promise<PostsResult> {
  try {
    const uid = getCurrentUid();
    if (!uid) return { data: [], error: null, hasMore: false };
    // 延迟引入避免循环依赖（follows.ts 未引入 posts.ts，可安全静态引入，
    // 但保持动态 import 以隔离关注体系失败时不影响主流程）
    const { fetchFollowingUids } = await import("@/lib/follows");
    const uids = await fetchFollowingUids(uid);
    if (uids.length === 0) return { data: [], error: null, hasMore: false };
    const _ = db.command;
    const { data } = await db
      .collection(POSTS_COLLECTION)
      .where({ authorUid: _.in(uids) })
      .orderBy("createdAt", "desc")
      .limit(POSTS_PAGE_SIZE)
      .get();
    const realPosts = ((data as PostDoc[]) ?? []).map(toQuestion);
    return { data: realPosts, error: null, hasMore: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "加载关注动态失败";
    return { data: [], error: msg, hasMore: false };
  }
}

/** 按浏览量取热门帖子（首页侧栏榜单用），失败时返回空数组不阻塞页面 */
export async function fetchHotPosts(limit = 5): Promise<Question[]> {
  try {
    await authReady; // #345 等匿名身份就绪，避免新访客首屏 401
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

/** 创建新帖子（#289 走云函数，含文本审核） */
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

  // #289 调用云函数写入（含数据万象 CI 文本审核）
  const res = await app.callFunction({
    name: "content-actions",
    data: {
      action: "createPost",
      title: cleanTitle,
      body: cleanBody,
      tags: cleanTags,
      category: params.category,
      subCategory: params.subCategory,
      bounty: params.bounty,
      author: getCurrentUserName(),
    },
  });
  const result = (res?.result ?? {}) as { ok?: boolean; data?: PostDoc & { id: string }; error?: string };
  if (!result.ok) throw new Error(result.error || "发帖失败");

  const d = result.data!;
  await awardReputation("createPost", d.id);
  return {
    id: d.id,
    title: d.title,
    excerpt: d.excerpt,
    author: d.author,
    authorUid: d.authorUid,
    avatarColor: d.avatarColor,
    tags: d.tags ?? [],
    category: d.category ?? "academic",
    subCategory: d.subCategory,
    answers: 0,
    views: 0,
    votes: 0,
    bounty: d.bounty,
    createdAt: d.createdAt,
    body: d.body,
    answerList: [],
  };
}

/** 增加浏览量（#346 走云函数绕过安全规则：posts.update 仅限作者，
 *  非作者浏览时直接 update 会 403，改由 content-actions 云函数以 admin 权限自增） */
export async function incrementViews(id: string): Promise<void> {
  try {
    await app.callFunction({
      name: "content-actions",
      data: { action: "incrementPostViews", postId: id },
    });
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

  // 走云函数绕过安全规则（直写 DB 会被拦截 "Permission denied by security rules"）
  const res = await app.callFunction({
    name: "content-actions",
    data: { action: "deletePost", postId },
  });
  const result = (res?.result ?? {}) as { ok?: boolean; error?: string };
  if (!result.ok) {
    throw new Error(result.error || "删除失败，请稍后重试");
  }
  return true;
}

/** 编辑回答（仅作者，通过云函数绕过安全规则） */
export async function updateAnswer(
  postId: string,
  answerId: string,
  content: string
): Promise<boolean> {
  const cleanContent = sanitizeInput(content);

  const res = await app.callFunction({
    name: "content-actions",
    data: { action: "updateAnswer", postId, answerId, content: cleanContent },
  });
  if (!res?.result?.ok) throw new Error(res?.result?.error || "编辑失败");
  return true;
}

/** 删除回答（仅作者，通过云函数绕过安全规则） */
export async function deleteAnswer(
  postId: string,
  answerId: string
): Promise<boolean> {
  const res = await app.callFunction({
    name: "content-actions",
    data: { action: "deleteAnswer", postId, answerId },
  });
  if (!res?.result?.ok) throw new Error(res?.result?.error || "删除失败");
  return true;
}

/** 删除评论（仅作者，通过云函数绕过安全规则） */
export async function deleteComment(
  postId: string,
  answerId: string,
  commentId: string
): Promise<boolean> {
  const res = await app.callFunction({
    name: "content-actions",
    data: { action: "deleteComment", postId, answerId, commentId },
  });
  if (!res?.result?.ok) throw new Error(res?.result?.error || "删除失败");
  return true;
}

/** 编辑评论（仅作者，通过云函数绕过安全规则） */
export async function updateComment(
  postId: string,
  answerId: string,
  commentId: string,
  content: string
): Promise<boolean> {
  const cleanContent = sanitizeInput(content);

  const res = await app.callFunction({
    name: "content-actions",
    data: { action: "updateComment", postId, answerId, commentId, content: cleanContent },
  });
  if (!res?.result?.ok) throw new Error(res?.result?.error || "编辑失败");
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
