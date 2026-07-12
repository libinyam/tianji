import { app, auth } from "@/lib/cloudbase";
import { sanitizeInput, sanitizeTitle, sanitizeTag } from "@/lib/sanitize";
import { checkCurrentUserBanned } from "@/lib/ban";
import { containsSensitiveWord } from "@/lib/sensitive-words";
import { awardReputation, REPUTATION_RULES } from "@/lib/reputation";
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
    rating,
    year: doc.year ?? new Date().getFullYear(),
    pages: doc.pages ?? 0,
    toc: doc.toc ?? [],
    reviews,
    link: doc.link,
    fileUrl: doc.fileUrl,
    fileName: doc.fileName,
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
  const docRef = db.collection(BOOKS_COLLECTION).doc(bookId);
  const { data } = await docRef.get();
  if (!data || data.length === 0) return null;

  const book = data[0] as BookDoc;
  const reviews = book.reviews ?? [];
  const existingIdx = reviews.findIndex((r) => r.authorUid === review.authorUid);

  // Sanitize review inputs
  const cleanAuthor = sanitizeInput(review.author, 200);
  const cleanContent = sanitizeInput(review.content);
  const sanitizedReview = { ...review, author: cleanAuthor, content: cleanContent };

  const newReview = { ...sanitizedReview, date: new Date().toISOString() };
  const updated = existingIdx >= 0;

  // 基于去重后的完整数组计算 avgRating（toBook 读取时会从 reviews 实时重算，此字段仅作兼容缓存）
  const updatedReviews = updated
    ? reviews.map((r, i) => (i === existingIdx ? newReview : r))
    : [...reviews, newReview];
  const totalRating = updatedReviews.reduce((sum, r) => sum + r.rating, 0);
  const avgRating = updatedReviews.length > 0 ? Math.round((totalRating / updatedReviews.length) * 10) / 10 : 0;

  // 单次 update 同时写入 reviews 与 rating 缓存，避免两次更新中途失败导致不一致
  if (updated) {
    // 已评过：只更新自己的那条评价，不影响他人（路径更新避免并发覆盖）
    await docRef.update({
      [`reviews.${existingIdx}`]: newReview,
      rating: avgRating,
    });
  } else {
    // 未评过：原子追加，避免并发丢失
    await docRef.update({
      reviews: db.command.push([newReview]),
      rating: avgRating,
    });
  }

  return { avgRating, updated };
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

  await awardReputation(uid, REPUTATION_RULES.createPost);

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
    rating: 0,
    year: doc.year,
    pages: 0,
    toc: doc.toc,
    reviews: [],
    link: doc.link,
    fileUrl: doc.fileUrl,
    fileName: doc.fileName,
  };
}
