import { app } from "@/lib/cloudbase";

const db = app.database();

/** 用户的创作内容概览 */
export interface UserContent {
  posts: Array<{ id: string; title: string; createdAt: string; views: number; answersCount: number }>;
  ideas: Array<{ id: string; title: string; createdAt: string; resonance: number }>;
  books: Array<{ id: string; title: string; createdAt: string; category: string }>;
  workshops: Array<{ id: string; title: string; createdAt: string; type: string }>;
}

/** 获取用户在各个集合中的内容 */
export async function fetchUserContent(uid: string): Promise<UserContent> {
  const empty: UserContent = { posts: [], ideas: [], books: [], workshops: [] };
  try {
    const [postsRes, ideasRes, booksRes, workshopsRes] = await Promise.all([
      db.collection("posts").where({ authorUid: uid }).orderBy("createdAt", "desc").limit(50).get(),
      db.collection("ideas").where({ authorUid: uid }).orderBy("createdAt", "desc").limit(50).get(),
      db.collection("books").where({ authorUid: uid }).orderBy("createdAt", "desc").limit(50).get(),
      db.collection("workshops").where({ authorUid: uid }).orderBy("createdAt", "desc").limit(50).get(),
    ]);

    return {
      posts: (postsRes.data || []).map((d: Record<string, unknown>) => ({
        id: String(d._id ?? ""),
        title: String(d.title ?? ""),
        createdAt: String(d.createdAt ?? ""),
        views: Number(d.views ?? 0),
        answersCount: Number(d.answersCount ?? 0),
      })),
      ideas: (ideasRes.data || []).map((d: Record<string, unknown>) => ({
        id: String(d._id ?? ""),
        title: String(d.title ?? ""),
        createdAt: String(d.createdAt ?? ""),
        resonance: Number(d.resonance ?? 0),
      })),
      books: (booksRes.data || []).map((d: Record<string, unknown>) => ({
        id: String(d._id ?? ""),
        title: String(d.title ?? ""),
        createdAt: String(d.createdAt ?? ""),
        category: String(d.category ?? ""),
      })),
      workshops: (workshopsRes.data || []).map((d: Record<string, unknown>) => ({
        id: String(d._id ?? ""),
        title: String(d.title ?? ""),
        createdAt: String(d.createdAt ?? ""),
        type: String(d.type ?? ""),
      })),
    };
  } catch {
    return empty;
  }
}
