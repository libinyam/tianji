import { app } from "@/lib/cloudbase";

const db = app.database();

/** 搜索结果统一结构 */
export interface SearchResult {
  id: string;
  title: string;
  excerpt: string;
  type: "帖子" | "灵感" | "资源" | "协作";
  link: string;
  hot: number; // 热度分
  tags: string[];
  author: string;
  createdAt: string;
}

/** 热门内容条目 */
export interface HotItem {
  id: string;
  title: string;
  type: "帖子" | "灵感" | "资源" | "协作";
  link: string;
  hot: number;
}

/** 用正则做模糊匹配（CloudBase NoSQL 支持 db.RegExp） */
function buildRegex(keyword: string) {
  return db.RegExp({ regexp: keyword, options: "i" });
}

/** 跨四个集合搜索，返回统一结构并按热度排序 */
export async function searchAll(keyword: string): Promise<SearchResult[]> {
  if (!keyword.trim()) return [];
  const regex = buildRegex(keyword.trim());
  const results: SearchResult[] = [];

  const tasks: Promise<void>[] = [
    // 帖子
    db
      .collection("posts")
      .where({
        title: regex,
      })
      .limit(20)
      .get()
      .then(({ data }) => {
        (data as Record<string, unknown>[]).forEach((d) => {
          const views = Number(d.views ?? 0);
          const votes = Number(d.votes ?? 0);
          const answers = Number(d.answersCount ?? 0);
          results.push({
            id: String(d._id ?? ""),
            title: String(d.title ?? ""),
            excerpt: String(d.excerpt ?? ""),
            type: "帖子",
            link: `/discussion/${d._id}`,
            hot: views + votes * 5 + answers * 3,
            tags: (d.tags as string[]) ?? [],
            author: String(d.author ?? ""),
            createdAt: String(d.createdAt ?? ""),
          });
        });
      })
      .catch(() => {}),

    // 灵感
    db
      .collection("ideas")
      .where({
        title: regex,
      })
      .limit(20)
      .get()
      .then(({ data }) => {
        (data as Record<string, unknown>[]).forEach((d) => {
          const resonance = Number(d.resonance ?? 0);
          const replies = Number(d.replies ?? 0);
          results.push({
            id: String(d._id ?? ""),
            title: String(d.title ?? ""),
            excerpt: String(d.summary ?? ""),
            type: "灵感",
            link: `/ideas`,
            hot: resonance * 4 + replies * 2,
            tags: (d.tags as string[]) ?? [],
            author: String(d.author ?? ""),
            createdAt: String(d.createdAt ?? ""),
          });
        });
      })
      .catch(() => {}),

    // 书籍
    db
      .collection("books")
      .where({
        title: regex,
      })
      .limit(20)
      .get()
      .then(({ data }) => {
        (data as Record<string, unknown>[]).forEach((d) => {
          const favorites = Number(d.favorites ?? 0);
          const rating = Number(d.rating ?? 0);
          results.push({
            id: String(d._id ?? ""),
            title: String(d.title ?? ""),
            excerpt: String(d.summary ?? ""),
            type: "资源",
            link: `/library/${d._id}`,
            hot: favorites * 3 + rating * 10,
            tags: (d.tags as string[]) ?? [],
            author: String(d.author ?? ""),
            createdAt: String(d.createdAt ?? ""),
          });
        });
      })
      .catch(() => {}),

    // 协作工坊
    db
      .collection("workshops")
      .where({
        title: regex,
      })
      .limit(20)
      .get()
      .then(({ data }) => {
        (data as Record<string, unknown>[]).forEach((d) => {
          const participants = (d.participants as string[]) ?? [];
          const contributions = (d.contributions as unknown[]) ?? [];
          results.push({
            id: String(d._id ?? ""),
            title: String(d.title ?? ""),
            excerpt: String(d.description ?? ""),
            type: "协作",
            link: `/workshop/${d._id}`,
            hot: participants.length * 5 + contributions.length * 3,
            tags: (d.tags as string[]) ?? [],
            author: String(d.creator ?? ""),
            createdAt: String(d.createdAt ?? ""),
          });
        });
      })
      .catch(() => {}),
  ];

  await Promise.all(tasks);

  // 按热度降序
  results.sort((a, b) => b.hot - a.hot);
  return results;
}

/** 获取全站热门内容榜单（按热度排序，取前 10） */
export async function fetchHotList(): Promise<HotItem[]> {
  const items: HotItem[] = [];

  const tasks: Promise<void>[] = [
    db
      .collection("posts")
      .orderBy("views", "desc")
      .limit(10)
      .get()
      .then(({ data }) => {
        (data as Record<string, unknown>[]).forEach((d) => {
          items.push({
            id: String(d._id ?? ""),
            title: String(d.title ?? ""),
            type: "帖子",
            link: `/discussion/${d._id}`,
            hot: Number(d.views ?? 0) + Number(d.votes ?? 0) * 5 + Number(d.answersCount ?? 0) * 3,
          });
        });
      })
      .catch(() => {}),

    db
      .collection("ideas")
      .orderBy("resonance", "desc")
      .limit(10)
      .get()
      .then(({ data }) => {
        (data as Record<string, unknown>[]).forEach((d) => {
          items.push({
            id: String(d._id ?? ""),
            title: String(d.title ?? ""),
            type: "灵感",
            link: `/ideas`,
            hot: Number(d.resonance ?? 0) * 4 + Number(d.replies ?? 0) * 2,
          });
        });
      })
      .catch(() => {}),

    db
      .collection("books")
      .orderBy("favorites", "desc")
      .limit(10)
      .get()
      .then(({ data }) => {
        (data as Record<string, unknown>[]).forEach((d) => {
          items.push({
            id: String(d._id ?? ""),
            title: String(d.title ?? ""),
            type: "资源",
            link: `/library/${d._id}`,
            hot: Number(d.favorites ?? 0) * 3 + Number(d.rating ?? 0) * 10,
          });
        });
      })
      .catch(() => {}),

    db
      .collection("workshops")
      .orderBy("createdAt", "desc")
      .limit(10)
      .get()
      .then(({ data }) => {
        (data as Record<string, unknown>[]).forEach((d) => {
          const participants = (d.participants as string[]) ?? [];
          const contributions = (d.contributions as unknown[]) ?? [];
          items.push({
            id: String(d._id ?? ""),
            title: String(d.title ?? ""),
            type: "协作",
            link: `/workshop/${d._id}`,
            hot: participants.length * 5 + contributions.length * 3,
          });
        });
      })
      .catch(() => {}),
  ];

  await Promise.all(tasks);
  items.sort((a, b) => b.hot - a.hot);
  return items.slice(0, 10);
}
