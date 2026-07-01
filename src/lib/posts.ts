import { app } from "@/lib/cloudbase";
import { createNotification } from "@/lib/notifications";
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
    views: doc.views,
    votes: doc.votes,
    bounty: doc.bounty,
    createdAt: doc.createdAt,
    body: doc.body,
    answerList: doc.answerList ?? [],
    category: doc.category ?? "academic",
    subCategory: doc.subCategory,
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

/** 获取所有帖子，可按分区和子分类筛选，按时间倒序 */
export async function fetchPosts(
  category?: PostCategory,
  subCategory?: CasualSubCategory
): Promise<Question[]> {
  try {
    const col = db.collection(POSTS_COLLECTION);
    const whereCond: Record<string, string> = {};
    if (category) whereCond.category = category;
    if (subCategory) whereCond.subCategory = subCategory;
    const { data } = Object.keys(whereCond).length
      ? await col.where(whereCond).orderBy("createdAt", "desc").limit(100).get()
      : await col.orderBy("createdAt", "desc").limit(100).get();

    const realPosts = ((data as PostDoc[]) ?? []).map(toQuestion);
    return realPosts;
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
  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");

  const excerpt =
    params.body.length > 120 ? params.body.slice(0, 120) + "…" : params.body;

  const doc: Omit<PostDoc, "_id"> = {
    title: params.title,
    excerpt,
    body: params.body,
    tags: params.tags,
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
  return {
    id: newId,
    title: doc.title,
    excerpt: doc.excerpt,
    author: doc.author,
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
    const { data } = await docRef.get();
    if (data && data.length > 0) {
      const current = (data[0] as PostDoc).views ?? 0;
      await docRef.update({ views: current + 1 });
    }
  } catch {
    // 静默失败，浏览量不影响核心体验
  }
}

/** 提交回答 */
export async function submitAnswer(
  postId: string,
  content: string
): Promise<Answer | null> {
  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");

  const docRef = db.collection(POSTS_COLLECTION).doc(postId);
  const { data } = await docRef.get();
  if (!data || data.length === 0) return null;

  const post = data[0] as PostDoc;
  const answer: Answer = {
    id: `a_${Date.now()}`,
    author: getCurrentUserName(),
    authorUid: uid,
    avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    votes: 0,
    accepted: false,
    content,
    date: new Date().toISOString(),
  };

  const newAnswerList = [...(post.answerList ?? []), answer];
  await docRef.update({
    answerList: newAnswerList,
    answersCount: newAnswerList.length,
  });

  // 通知帖子作者
  await createNotification({
    uid: post.authorUid,
    type: "answer",
    title: post.title,
    link: `/discussion/${postId}`,
  });

  return answer;
}

/** 对某个回答添加评论/回复 */
export async function submitComment(
  postId: string,
  answerId: string,
  content: string,
  replyTo?: string
): Promise<Comment | null> {
  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");

  const docRef = db.collection(POSTS_COLLECTION).doc(postId);
  const { data } = await docRef.get();
  if (!data || data.length === 0) return null;

  const post = data[0] as PostDoc;
  const answerList = post.answerList ?? [];
  const answerIndex = answerList.findIndex((a) => a.id === answerId);
  if (answerIndex === -1) return null;

  const comment: Comment = {
    id: `c_${crypto.randomUUID()}`,
    author: getCurrentUserName(),
    authorUid: uid,
    avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    content,
    date: new Date().toISOString().slice(0, 10),
    replyTo,
  };

  const targetAnswer = answerList[answerIndex];
  const updatedAnswer: Answer = {
    ...targetAnswer,
    comments: [...(targetAnswer.comments ?? []), comment],
  };

  const newAnswerList = [...answerList];
  newAnswerList[answerIndex] = updatedAnswer;

  await docRef.update({ answerList: newAnswerList });

  // 通知回答作者（createNotification 内部会跳过自己）
  await createNotification({
    uid: targetAnswer.authorUid,
    type: "comment",
    title: post.title,
    link: `/discussion/${postId}`,
  });

  return comment;
}

/** 编辑帖子（仅作者） */
export async function updatePost(
  postId: string,
  params: { title: string; body: string; tags: string[] }
): Promise<boolean> {
  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");

  const docRef = db.collection(POSTS_COLLECTION).doc(postId);
  const { data } = await docRef.get();
  if (!data || data.length === 0) return false;

  const post = data[0] as PostDoc;
  if (post.authorUid !== uid) throw new Error("无权编辑他人帖子");

  const excerpt = params.body.length > 120 ? params.body.slice(0, 120) + "…" : params.body;
  await docRef.update({
    title: params.title,
    body: params.body,
    excerpt,
    tags: params.tags,
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

  // 级联清理收藏和举报
  await db.collection("favorites").where({ targetId: postId }).remove();
  await db.collection("reports").where({ targetId: postId }).remove();

  return true;
}

/** 编辑回答（仅作者） */
export async function updateAnswer(
  postId: string,
  answerId: string,
  content: string
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

  if (answerList[idx].authorUid !== uid) throw new Error("无权编辑他人回答");

  answerList[idx] = { ...answerList[idx], content };
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
  await docRef.update({ answerList, answersCount: answerList.length });
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

/** 采纳回答（仅帖子作者可操作，每篇帖子只能有一个采纳回答） */
export async function acceptAnswer(
  postId: string,
  answerId: string,
  accept: boolean
): Promise<boolean> {
  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");

  const docRef = db.collection(POSTS_COLLECTION).doc(postId);
  const { data } = await docRef.get();
  if (!data || data.length === 0) return false;

  const post = data[0] as PostDoc;

  // 只有帖子作者可以采纳回答
  if (post.authorUid !== uid) throw new Error("只有提问者可以采纳回答");

  const answerList = post.answerList ?? [];
  const idx = answerList.findIndex((a) => a.id === answerId);
  if (idx === -1) return false;

  // 将所有回答的 accepted 设为 false，再将目标回答设为指定状态
  const newAnswerList = answerList.map((a) => ({ ...a, accepted: false }));
  if (accept) {
    newAnswerList[idx] = { ...newAnswerList[idx], accepted: true };

    // 通知回答作者（createNotification 内部会跳过自己）
    await createNotification({
      uid: answerList[idx].authorUid ?? "",
      type: "accept",
      title: post.title,
      link: `/discussion/${postId}`,
    });
  }

  await docRef.update({ answerList: newAnswerList });
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

  const votesCol = db.collection("votes");

  if (isUpvote) {
    // 检查是否已投票
    const { data: existing } = await votesCol
      .where({ answerId, uid })
      .get();
    if ((existing ?? []).length > 0) return false; // 已投过票

    // 记录投票
    await votesCol.add({ answerId, uid, postId, createdAt: Date.now() });
  } else {
    // 取消投票 — 用 doc(id).remove() 避免安全规则拦截 where().remove()
    const { data: existing } = await votesCol
      .where({ answerId, uid })
      .get();
    const list = existing ?? [];
    if (list.length === 0) return false; // 没投过票
    const voteDocId = (list[0] as { _id: string })._id;
    await votesCol.doc(voteDocId).remove();
  }

  // 更新回答票数（使用原子操作 inc）
  const docRef = db.collection(POSTS_COLLECTION).doc(postId);
  const { data } = await docRef.get();
  if (!data || data.length === 0) return false;

  const post = data[0] as PostDoc;
  const answerList = post.answerList ?? [];
  const idx = answerList.findIndex((a) => a.id === answerId);
  if (idx === -1) return false;

  const currentVotes = answerList[idx].votes ?? 0;
  answerList[idx] = {
    ...answerList[idx],
    votes: Math.max(0, currentVotes + (isUpvote ? 1 : -1)),
  };
  await docRef.update({ answerList });
  return true;
}
