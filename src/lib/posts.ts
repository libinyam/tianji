import { app } from "@/lib/cloudbase";
import { createNotification } from "@/lib/notifications";
import type { Question, Answer, Comment } from "@/types";

const db = app.database();
const POSTS_COLLECTION = "posts";

/** 数据库中存储的帖子文档结构 */
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
    avatarColor: doc.avatarColor,
    tags: doc.tags,
    answers: doc.answersCount ?? doc.answerList?.length ?? 0,
    views: doc.views,
    votes: doc.votes,
    bounty: doc.bounty,
    createdAt: doc.createdAt,
    body: doc.body,
    answerList: doc.answerList ?? [],
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

/** 获取所有帖子（Mock + 真实），按时间倒序 */
export async function fetchPosts(): Promise<Question[]> {
  try {
    const { data } = await db
      .collection(POSTS_COLLECTION)
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    const realPosts = (data as PostDoc[]).map(toQuestion);
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
    views: 0,
    votes: 0,
    answersCount: 0,
    answerList: [],
    createdAt: new Date().toISOString().slice(0, 10),
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
    avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    votes: 0,
    accepted: false,
    content,
    date: new Date().toISOString().slice(0, 10),
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
    id: `c_${Date.now()}`,
    author: getCurrentUserName(),
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

  return comment;
}
