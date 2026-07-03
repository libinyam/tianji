import { app } from "@/lib/cloudbase";
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
    rating: doc.rating ?? 0,
    year: doc.year ?? new Date().getFullYear(),
    pages: doc.pages ?? 0,
    toc: doc.toc ?? [],
    reviews: doc.reviews ?? [],
    link: doc.link,
    fileUrl: doc.fileUrl,
    fileName: doc.fileName,
  };
}

/** 资源被下载时，下载数 +1 */
export async function incrementBookDownloads(id: string): Promise<void> {
  try {
    await db
      .collection(BOOKS_COLLECTION)
      .doc(id)
      .update({ downloads: db.command.inc(1) });
  } catch {
    // 静默
  }
}

/** 添加读者评价 */
export async function addReview(bookId: string, review: { author: string; authorUid: string; rating: number; content: string }): Promise<{ avgRating: number } | null> {
  const docRef = db.collection(BOOKS_COLLECTION).doc(bookId);
  const { data } = await docRef.get();
  if (!data || data.length === 0) return null;

  const book = data[0] as BookDoc;
  const newReview = { ...review, date: new Date().toISOString().slice(0, 10) };

  // 原子追加评论，避免并发丢失
  await docRef.update({
    reviews: db.command.push([newReview]),
  });

  // 计算新平均评分并更新
  const allReviews = [...(book.reviews ?? []), newReview];
  const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
  const avgRating = allReviews.length > 0 ? Math.round((totalRating / allReviews.length) * 10) / 10 : 0;
  await docRef.update({ rating: avgRating });

  return { avgRating };
}

function getCurrentUid(): string {
  return useAuthStore.getState().user?.uid ?? "";
}

/** 获取所有用户上传的书籍 */
export async function fetchBooks(): Promise<Book[]> {
  try {
    const { data } = await db
      .collection(BOOKS_COLLECTION)
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();
    return (data as BookDoc[]).map(toBook);
  } catch {
    return [];
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

  const doc: Omit<BookDoc, "_id"> = {
    title: params.title,
    author: params.author,
    category: params.category,
    difficulty: params.difficulty,
    tags: params.tags,
    accent: ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)],
    summary: params.summary,
    favorites: 0,
    downloads: 0,
    rating: 0,
    year: new Date().getFullYear(),
    pages: 0,
    toc: params.toc ?? [],
    reviews: [],
    authorUid: uid,
    link: params.link,
    fileUrl: params.fileUrl,
    fileName: params.fileName,
    createdAt: new Date().toISOString(),
  };

  const res = await db.collection(BOOKS_COLLECTION).add(doc);
  const resObj = res as unknown as Record<string, unknown>;
  const newId = (resObj.id as string) ?? (resObj._id as string) ?? "";

  // 登记标签计数（需等待完成）
  await ensureTags(params.tags);

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
