import { app } from "@/lib/cloudbase";

const db = app.database();

export interface TagInfo {
  name: string;
  count: number;
  category?: string;
}

export interface TagContentItem {
  id: string;
  type: "post" | "idea" | "book" | "workshop";
  title: string;
  excerpt: string;
  author: string;
  createdAt: string;
  link: string;
}

/** 获取热门标签（按使用次数降序） */
export async function fetchHotTags(limit = 30): Promise<TagInfo[]> {
  try {
    const { data } = await db
      .collection("tags")
      .orderBy("count", "desc")
      .limit(limit)
      .get();
    return (data as TagInfo[]).map((d) => ({
      name: d.name,
      count: d.count ?? 0,
      category: d.category,
    }));
  } catch {
    return [];
  }
}

/** 搜索标签（自动补全） */
export async function searchTags(keyword: string, limit = 10): Promise<TagInfo[]> {
  if (!keyword.trim()) return [];
  try {
    const { data } = await db
      .collection("tags")
      .where({ name: db.RegExp({ regexp: `.*${escapeRegex(keyword)}.*`, options: "i" }) })
      .orderBy("count", "desc")
      .limit(limit)
      .get();
    return (data as TagInfo[]).map((d) => ({
      name: d.name,
      count: d.count ?? 0,
      category: d.category,
    }));
  } catch {
    return [];
  }
}

/** 确保标签存在，新标签插入并 count=1，已有标签 count+1 */
export async function ensureTags(names: string[]): Promise<void> {
  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    try {
      const { data } = await db.collection("tags").where({ name: trimmed }).get();
      if (data && data.length > 0) {
        // 已存在，count + 1
        const doc = data[0];
        await db
          .collection("tags")
          .doc(doc._id)
          .update({ count: db.command.inc(1) });
      } else {
        // 新标签
        await db.collection("tags").add({
          name: trimmed,
          count: 1,
          createdAt: new Date().toISOString(),
        });
      }
    } catch {
      // 静默
    }
  }
}

/** 跨内容类型聚合：查询某个标签下的所有内容 */
export async function fetchContentByTag(tagName: string): Promise<{
  posts: TagContentItem[];
  ideas: TagContentItem[];
  books: TagContentItem[];
  workshops: TagContentItem[];
}> {
  const escaped = escapeRegex(tagName);
  const regex = db.RegExp({ regexp: escaped, options: "i" });

  const [postsRes, ideasRes, booksRes, workshopsRes] = await Promise.allSettled([
    db.collection("posts").where({ tags: regex }).orderBy("createdAt", "desc").limit(50).get(),
    db.collection("ideas").where({ tags: regex }).orderBy("createdAt", "desc").limit(50).get(),
    db.collection("books").where({ tags: regex }).orderBy("createdAt", "desc").limit(50).get(),
    db.collection("workshops").where({ tags: regex }).orderBy("createdAt", "desc").limit(50).get(),
  ]);

  const extract = (
    res: PromiseSettledResult<{ data: Record<string, unknown>[] }>,
    type: "post" | "idea" | "book" | "workshop"
  ): TagContentItem[] => {
    if (res.status !== "fulfilled") return [];
    return (res.value.data || []).map((d) => {
      const id = String(d._id ?? "");
      if (type === "post") {
        return {
          id,
          type,
          title: String(d.title ?? ""),
          excerpt: String(d.excerpt ?? d.body ?? "").slice(0, 120),
          author: String(d.author ?? "匿名"),
          createdAt: String(d.createdAt ?? ""),
          link: `/discussion/${id}`,
        };
      }
      if (type === "idea") {
        return {
          id,
          type,
          title: String(d.title ?? ""),
          excerpt: String(d.summary ?? "").slice(0, 120),
          author: String(d.author ?? "匿名"),
          createdAt: String(d.createdAt ?? ""),
          link: `/ideas`,
        };
      }
      if (type === "book") {
        return {
          id,
          type,
          title: String(d.title ?? ""),
          excerpt: String(d.summary ?? "").slice(0, 120),
          author: String(d.author ?? "匿名"),
          createdAt: String(d.createdAt ?? ""),
          link: `/library/${id}`,
        };
      }
      return {
        id,
        type,
        title: String(d.title ?? ""),
        excerpt: String(d.description ?? "").slice(0, 120),
        author: String(d.creator ?? "匿名"),
        createdAt: String(d.createdAt ?? ""),
        link: `/workshop/${id}`,
      };
    });
  };

  return {
    posts: extract(postsRes as PromiseSettledResult<{ data: Record<string, unknown>[] }>, "post"),
    ideas: extract(ideasRes as PromiseSettledResult<{ data: Record<string, unknown>[] }>, "idea"),
    books: extract(booksRes as PromiseSettledResult<{ data: Record<string, unknown>[] }>, "book"),
    workshops: extract(workshopsRes as PromiseSettledResult<{ data: Record<string, unknown>[] }>, "workshop"),
  };
}

/** 获取标签使用总数 */
export async function fetchTagCount(tagName: string): Promise<number> {
  try {
    const { data } = await db.collection("tags").where({ name: tagName }).get();
    if (data && data.length > 0) return (data[0] as TagInfo).count ?? 0;
    return 0;
  } catch {
    return 0;
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
