import type { PostDoc } from "@/lib/posts";
import type { IdeaDoc } from "@/lib/ideas";
import type { BookDoc } from "@/lib/books";

const DEFAULT_AVATAR_COLOR = "#7cc4ff";
const DEFAULT_BOOK_CATEGORY = "编程基础" as const;

/** 把可能残缺/旧版的 PostDoc 文档补齐为完整的 PostDoc（防御性读取，#163） */
export function normalizePost(doc: Partial<PostDoc> | null | undefined): PostDoc {
  return {
    _id: doc?._id ?? "",
    title: doc?.title ?? "",
    excerpt: doc?.excerpt ?? "",
    body: doc?.body ?? "",
    tags: doc?.tags ?? [],
    author: doc?.author ?? "",
    authorUid: doc?.authorUid ?? "",
    avatarColor: doc?.avatarColor ?? DEFAULT_AVATAR_COLOR,
    bounty: doc?.bounty,
    category: doc?.category,
    subCategory: doc?.subCategory,
    views: doc?.views ?? 0,
    votes: doc?.votes ?? 0,
    answersCount: doc?.answersCount ?? 0,
    answerList: doc?.answerList ?? [],
    createdAt: doc?.createdAt ?? new Date().toISOString(),
    isMock: doc?.isMock,
    pinned: doc?.pinned ?? false,
    locked: doc?.locked ?? false,
    featured: doc?.featured ?? false,
  };
}

/** 把可能残缺/旧版的 IdeaDoc 文档补齐为完整的 IdeaDoc（防御性读取，#163） */
export function normalizeIdea(doc: Partial<IdeaDoc> | null | undefined): IdeaDoc {
  return {
    _id: doc?._id ?? "",
    title: doc?.title ?? "",
    summary: doc?.summary ?? "",
    author: doc?.author ?? "",
    authorUid: doc?.authorUid ?? "",
    avatarColor: doc?.avatarColor ?? DEFAULT_AVATAR_COLOR,
    topic: doc?.topic ?? "",
    tags: doc?.tags ?? [],
    resonance: doc?.resonance ?? 0,
    replies: doc?.replies ?? 0,
    createdAt: doc?.createdAt ?? new Date().toISOString(),
    resonatedBy: doc?.resonatedBy ?? [],
    comments: doc?.comments ?? [],
  };
}

/** 把可能残缺/旧版的 BookDoc 文档补齐为完整的 BookDoc（防御性读取，#163） */
export function normalizeBook(doc: Partial<BookDoc> | null | undefined): BookDoc {
  return {
    _id: doc?._id ?? "",
    title: doc?.title ?? "",
    author: doc?.author ?? "",
    category: doc?.category ?? DEFAULT_BOOK_CATEGORY,
    difficulty: doc?.difficulty ?? 3,
    tags: doc?.tags ?? [],
    accent: doc?.accent ?? DEFAULT_AVATAR_COLOR,
    summary: doc?.summary ?? "",
    favorites: doc?.favorites ?? 0,
    downloads: doc?.downloads ?? 0,
    rating: doc?.rating ?? 0,
    year: doc?.year ?? new Date().getFullYear(),
    pages: doc?.pages ?? 0,
    toc: doc?.toc ?? [],
    reviews: doc?.reviews ?? [],
    authorUid: doc?.authorUid ?? "",
    link: doc?.link,
    fileUrl: doc?.fileUrl,
    fileName: doc?.fileName,
    createdAt: doc?.createdAt ?? new Date().toISOString(),
  };
}
