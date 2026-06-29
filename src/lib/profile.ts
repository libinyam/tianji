import { app } from "@/lib/cloudbase";

const db = app.database();

/** 用户的创作内容概览 */
export interface UserContent {
  posts: Array<{ id: string; title: string; createdAt: string; views: number; answersCount: number }>;
  ideas: Array<{ id: string; title: string; createdAt: string; resonance: number; link: string }>;
  books: Array<{ id: string; title: string; createdAt: string; category: string }>;
  workshops: Array<{ id: string; title: string; createdAt: string; type: string }>;
}

/** 公开用户信息 */
export interface PublicUser {
  uid: string;
  nickname: string;
  avatarUrl: string;
  email: string | null;
}

/** 通过 uid 获取用户公开信息（从帖子中提取，因为 CloudBase Auth 无公开查询 API） */
export async function fetchPublicUser(uid: string): Promise<PublicUser | null> {
  try {
    // 尝试从 posts 集合获取作者信息
    const { data } = await db
      .collection("posts")
      .where({ authorUid: uid })
      .limit(1)
      .get();

    if (data && data.length > 0) {
      const post = data[0] as Record<string, unknown>;
      return {
        uid,
        nickname: String(post.author ?? "匿名用户"),
        avatarUrl: "",
        email: null,
      };
    }

    // 如果帖子中没有，尝试 ideas
    const { data: ideaData } = await db
      .collection("ideas")
      .where({ authorUid: uid })
      .limit(1)
      .get();

    if (ideaData && ideaData.length > 0) {
      const idea = ideaData[0] as Record<string, unknown>;
      return {
        uid,
        nickname: String(idea.author ?? "匿名用户"),
        avatarUrl: "",
        email: null,
      };
    }

    // 尝试 workshops
    const { data: wsData } = await db
      .collection("workshops")
      .where({ creatorUid: uid })
      .limit(1)
      .get();

    if (wsData && wsData.length > 0) {
      const ws = wsData[0] as Record<string, unknown>;
      return {
        uid,
        nickname: String(ws.creator ?? "匿名用户"),
        avatarUrl: "",
        email: null,
      };
    }

    return null;
  } catch {
    return null;
  }
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
        link: "/ideas",
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
