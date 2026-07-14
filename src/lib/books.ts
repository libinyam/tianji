import { app, auth } from "@/lib/cloudbase";
import { sanitizeInput, sanitizeTitle, sanitizeTag } from "@/lib/sanitize";
import { checkCurrentUserBanned } from "@/lib/ban";
import { containsSensitiveWord } from "@/lib/sensitive-words";
import { awardReputation } from "@/lib/reputation";
import { useAuthStore } from "@/stores/auth";
import { ensureTags } from "@/lib/tags";
import type { Book, BookCategory } from "@/types";

const db = app.database();
const BOOKS_COLLECTION = "books";

export interface BookDoc {
  _id?: string;
  title: string;
  author: string;
  category: BookCategory;
  difficulty: 1 | 2 | 3 | 4 | 5;
  tags: string[];
  accent: string;
  summary: string;
  favorites: number;
  downloads: number;
  rating: number;
  year: number;
  pages: number;
  toc: string[];
  reviews: { author: string; authorUid: string; rating: number; content: string; date: string }[];
  authorUid: string;
  link?: string; // 外部链接（如 GitHub、电子书地址）
  fileUrl?: string; // 上传文件的临时下载 URL
  fileName?: string; // 上传文件的原始文件名
  createdAt: string;
}

const ACCENT_COLORS = ["#7cc4ff", "#f3c969", "#5aa6f0", "#a78bfa", "#34d399", "#fb923c"];

function toBook(doc: BookDoc): Book {
  // rating 从 reviews 实时计算，彻底避免并发评价时的均分漂移（#114）
  const reviews = doc.reviews ?? [];
  const rating = reviews.length > 0
    ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
    : 0;
  return {
    id: doc._id ?? "",
    title: doc.title,
    author: doc.author,
    category: doc.category,
    difficulty: doc.difficulty,
    tags: doc.tags ?? [],
    accent: doc.accent,
    summary: doc.summary,
    favorites: doc.favorites ?? 0,
    downloads: doc.downloads ?? 0, // #96 透出下载数
    rating,
    year: doc.year ?? new Date().getFullYear(),
    pages: doc.pages ?? 0,
    toc: doc.toc ?? [],
    reviews,
    link: doc.link,
    fileUrl: doc.fileUrl,
    fileName: doc.fileName,
    createdAt: doc.createdAt ?? new Date().toISOString(), // #96 透出创建时间
  };
}

/** 资源被下载时，下载数 +1 */
export async function incrementBookDownloads(id: string): Promise<void> {
  try {
    await app.callFunction({
      name: "content-actions",
      data: { action: "incrementBookDownloads", bookId: id },
    });
  } catch {
    void 0;
  }
}

/** 添加读者评价（按 uid 去重，已评过则更新原评价） */
export async function addReview(bookId: string, review: { author: string; authorUid: string; rating: number; content: string }): Promise<{ avgRating: number; updated: boolean } | null> {
  const res = await app.callFunction({
    name: "content-actions",
    data: { action: "addBookReview", bookId, ...review },
  });
  const result = (res?.result ?? {}) as { ok?: boolean; data?: { avgRating: number; updated: boolean }; error?: string };
  if (!result.ok) throw new Error(result.error || "评价失败");
  return result.data ?? null;
}

function getCurrentUid(): string {
  return useAuthStore.getState().user?.uid ?? "";
}

/** 获取所有用户上传的书籍 */
export async function fetchBooks(): Promise<{ data: Book[]; error: boolean }> {
  const doFetch = async (): Promise<Book[]> => {
    const { data } = await db
      .collection(BOOKS_COLLECTION)
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();
    return (data as BookDoc[]).map(toBook);
  };

  try {
    const books = await doFetch();
    return { data: books, error: false };
  } catch (firstErr) {
    // token 过期等错误：尝试刷新登录态后重试一次
    try {
      await auth.signInAnonymously();
      const books = await doFetch();
      return { data: books, error: false };
    } catch {
      // 重试也失败，返回错误标记而非静默空数组
      console.error("fetchBooks 失败:", firstErr);
      return { data: [], error: true };
    }
  }
}

/** 获取单本书籍详情 */
export async function fetchBookById(id: string): Promise<Book | null> {
  try {
    const { data } = await db
      .collection(BOOKS_COLLECTION)
      .doc(id)
      .get();
    if (!data || data.length === 0) return null;
    return toBook(data[0] as BookDoc);
  } catch {
    return null;
  }
}

/** 创建新书籍资源 */
export async function createBook(params: {
  title: string;
  author: string;
  category: BookCategory;
  difficulty: 1 | 2 | 3 | 4 | 5;
  tags: string[];
  summary: string;
  link?: string;
  fileUrl?: string;
  fileName?: string;
  toc?: string[];
}): Promise<Book | null> {
  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");

  const banStatus = await checkCurrentUserBanned();
  if (banStatus) throw new Error("您的账号已被封禁");

  // Sanitize inputs
  const cleanTitle = sanitizeTitle(params.title);
  const cleanAuthor = sanitizeInput(params.author, 200);
  const cleanSummary = sanitizeInput(params.summary);
  const cleanTags = params.tags.map(sanitizeTag);
  const cleanToc = (params.toc ?? []).map((t) => sanitizeInput(t, 500));
  const cleanLink = params.link ? sanitizeInput(params.link, 2000) : undefined;

  const sensitiveCheck = containsSensitiveWord(cleanTitle + cleanSummary);
  if (sensitiveCheck.found) {
    throw new Error(`内容包含敏感词: ${sensitiveCheck.words.join(", ")}`);
  }

  const doc: Omit<BookDoc, "_id"> = {
    title: cleanTitle,
    author: cleanAuthor,
    category: params.category,
    difficulty: params.difficulty,
    tags: cleanTags,
    accent: ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)],
    summary: cleanSummary,
    favorites: 0,
    downloads: 0,
    rating: 0,
    year: new Date().getFullYear(),
    pages: 0,
    toc: cleanToc,
    reviews: [],
    authorUid: uid,
    link: cleanLink,
    fileUrl: params.fileUrl,
    fileName: params.fileName,
    createdAt: new Date().toISOString(),
  };

  const res = await db.collection(BOOKS_COLLECTION).add(doc);
  const resObj = res as unknown as Record<string, unknown>;
  const newId = (resObj.id as string) ?? (resObj._id as string) ?? "";

  // 登记标签计数（需等待完成）
  await ensureTags(cleanTags);

  await awardReputation("createBook", newId);

  return {
    id: newId,
    title: doc.title,
    author: doc.author,
    category: doc.category,
    difficulty: doc.difficulty,
    tags: doc.tags,
    accent: doc.accent,
    summary: doc.summary,
    favorites: 0,
    downloads: 0,
    rating: 0,
    year: doc.year,
    pages: 0,
    toc: doc.toc,
    reviews: [],
    link: doc.link,
    fileUrl: doc.fileUrl,
    fileName: doc.fileName,
    createdAt: doc.createdAt,
    authorUid: doc.authorUid,
  };
}

/**
 * #96 查询相关推荐（按 category 从数据库查，不再只查 mock）
 * 排除当前资源，按收藏数倒序取前 limit 条
 */
export async function fetchRelatedBooks(category: BookCategory, excludeId: string, limit = 3): Promise<Book[]> {
  try {
    const _ = db.command;
    const { data } = await db
      .collection(BOOKS_COLLECTION)
      .where({ category, _id: _.neq(excludeId) })
      .orderBy("favorites", "desc")
      .limit(limit)
      .get();
    return (data as BookDoc[]).map(toBook);
  } catch {
    return [];
  }
}

/**
 * #96 编辑资源（仅上传者可改）
 */
export async function updateBook(
  id: string,
  params: {
    title?: string;
    author?: string;
    summary?: string;
    tags?: string[];
    difficulty?: 1 | 2 | 3 | 4 | 5;
    link?: string;
  }
): Promise<boolean> {
  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");

  const docRef = db.collection(BOOKS_COLLECTION).doc(id);
  const { data } = await docRef.get();
  if (!data || data.length === 0) return false;

  const book = data[0] as BookDoc;
  if (book.authorUid !== uid) throw new Error("无权编辑他人资源");

  const updateFields: Record<string, unknown> = {};
  if (params.title !== undefined) updateFields.title = sanitizeTitle(params.title);
  if (params.author !== undefined) updateFields.author = sanitizeInput(params.author, 200);
  if (params.summary !== undefined) updateFields.summary = sanitizeInput(params.summary);
  if (params.tags !== undefined) updateFields.tags = params.tags.map(sanitizeTag);
  if (params.difficulty !== undefined) updateFields.difficulty = params.difficulty;
  if (params.link !== undefined) updateFields.link = params.link ? sanitizeInput(params.link, 2000) : undefined;

  if (Object.keys(updateFields).length === 0) return true;
  await docRef.update(updateFields);
  return true;
}

/**
 * #96 删除资源（仅上传者可删）
 */
export async function deleteBook(id: string): Promise<boolean> {
  const uid = getCurrentUid();
  if (!uid) throw new Error("请先登录");

  const docRef = db.collection(BOOKS_COLLECTION).doc(id);
  const { data } = await docRef.get();
  if (!data || data.length === 0) return false;

  const book = data[0] as BookDoc;
  if (book.authorUid !== uid) throw new Error("无权删除他人资源");

  await docRef.remove();
  return true;
}
