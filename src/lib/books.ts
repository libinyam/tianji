import { app } from "@/lib/cloudbase";
import { useAuthStore } from "@/stores/auth";
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
  rating: number;
  year: number;
  pages: number;
  toc: string[];
  reviews: { author: string; rating: number; content: string; date: string }[];
  authorUid: string;
  link?: string; // 外部链接（如 GitHub、电子书地址）
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
    tags: doc.tags,
    accent: doc.accent,
    summary: doc.summary,
    favorites: doc.favorites,
    rating: doc.rating,
    year: doc.year,
    pages: doc.pages,
    toc: doc.toc,
    reviews: doc.reviews,
  };
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

/** 创建新书籍资源 */
export async function createBook(params: {
  title: string;
  author: string;
  category: BookCategory;
  difficulty: 1 | 2 | 3 | 4 | 5;
  tags: string[];
  summary: string;
  link?: string;
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
    rating: 0,
    year: new Date().getFullYear(),
    pages: 0,
    toc: [],
    reviews: [],
    authorUid: uid,
    link: params.link,
    createdAt: new Date().toISOString(),
  };

  const res = await db.collection(BOOKS_COLLECTION).add(doc);
  const resObj = res as unknown as Record<string, unknown>;
  const newId = (resObj.id as string) ?? (resObj._id as string) ?? "";

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
    toc: [],
    reviews: [],
  };
}
