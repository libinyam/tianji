import type { Answer, Comment, Review } from "@/types";
import { AVATAR_COLORS } from "@/lib/avatar-colors";

const DEFAULT_DATE = "2024-01-01T00:00:00.000Z";

interface Overrides {
  [key: string]: unknown;
}

function pick(overrides?: Overrides): Record<string, unknown> {
  return overrides ?? {};
}

export function createUser(overrides?: Overrides) {
  return {
    uid: "test-uid",
    nickname: "Tester",
    username: "tester",
    email: "test@example.com",
    avatarUrl: "https://example.com/avatar.png",
    avatarColor: "#7cc4ff",
    reputation: 0,
    ...pick(overrides),
  };
}

export function createPost(overrides?: Overrides) {
  return {
    _id: "post-1",
    title: "测试帖子",
    excerpt: "测试摘要",
    body: "测试正文内容",
    tags: ["测试"],
    author: "Tester",
    authorUid: "test-uid",
    avatarColor: "#7cc4ff",
    views: 0,
    votes: 0,
    answersCount: 0,
    answerList: [] as Answer[],
    createdAt: DEFAULT_DATE,
    category: "academic" as const,
    ...pick(overrides),
  };
}

export function createQuestion(overrides?: Overrides) {
  return {
    id: "post-1",
    title: "测试帖子",
    excerpt: "测试摘要",
    author: "Tester",
    authorUid: "test-uid",
    avatarColor: "#7cc4ff",
    tags: ["测试"],
    answers: 0,
    views: 0,
    votes: 0,
    bounty: undefined as number | undefined,
    category: "academic" as const,
    subCategory: undefined,
    createdAt: DEFAULT_DATE,
    body: "测试正文内容",
    answerList: [] as Answer[],
    pinned: undefined as boolean | undefined,
    locked: undefined as boolean | undefined,
    featured: undefined as boolean | undefined,
    ...pick(overrides),
  };
}

export function createAnswer(overrides?: Overrides) {
  return {
    id: "answer-1",
    author: "Tester",
    authorUid: "test-uid",
    avatarColor: AVATAR_COLORS[0],
    votes: 0,
    accepted: false,
    content: "测试回答内容",
    date: DEFAULT_DATE,
    comments: [] as Comment[],
    ...pick(overrides),
  };
}

export function createComment(overrides?: Overrides) {
  return {
    id: "comment-1",
    author: "Tester",
    authorUid: "test-uid",
    avatarColor: AVATAR_COLORS[0],
    content: "测试评论内容",
    date: DEFAULT_DATE,
    ...pick(overrides),
  };
}

export function createBook(overrides?: Overrides) {
  return {
    id: "book-1",
    title: "测试书籍",
    author: "Test Author",
    category: "AI工具实战" as const,
    difficulty: 3 as 1 | 2 | 3 | 4 | 5,
    tags: ["AI"],
    accent: "#7cc4ff",
    summary: "测试书籍摘要",
    favorites: 0,
    rating: 4.5,
    year: 2024,
    pages: 200,
    toc: [],
    reviews: [] as Review[],
    ...pick(overrides),
  };
}
