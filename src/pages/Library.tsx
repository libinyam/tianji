import { useMemo, useState, useEffect } from "react";
import { Search, Plus } from "lucide-react";
import BookCard from "@/components/BookCard";
import { BookCardSkeleton } from "@/components/Skeleton";
import BookUploadModal from "@/components/BookUploadModal";

import { fetchBooks } from "@/lib/books";
import { useAuthStore } from "@/stores/auth";
import { dispatchAuthWithIntent } from "@/lib/pending-action";
import { useSEO } from "@/hooks/useSEO";
import type { Book, BookCategory } from "@/types";

const CATEGORIES: ("全部" | BookCategory)[] = [
  "全部",
  "基础理论",
  "AI工具实战",
  "项目实战",
  "编程基础",
];

type SortKey = "热度" | "最新" | "难度";

const SORTS: SortKey[] = ["热度", "最新", "难度"];

export default function Library() {
  // #150 SEO
  useSEO({
    title: "资源库",
    description: "天玑学习资源库 -- 精选 AI 工具实战、编程基础、项目实战与基础理论书单，支持上传分享与社区评价。",
    canonical: "https://tianjihub.cn/library",
  });
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"全部" | BookCategory>("全部");
  const [sort, setSort] = useState<SortKey>("热度");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [realBooks, setRealBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const { user } = useAuthStore();

  // 加载真实书籍
  const loadBooks = async () => {
    setLoading(true);
    setLoadError(false);
    const { data, error } = await fetchBooks();
    if (error) {
      setLoadError(true);
    } else {
      setRealBooks(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setLoadError(false);
      const { data, error } = await fetchBooks();
      if (!mounted) return;
      if (error) {
        setLoadError(true);
      } else {
        setRealBooks(data);
      }
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const allBooks = realBooks;

  const filtered = useMemo(() => {
    let list = allBooks.filter((b) => {
      const matchCat = category === "全部" || b.category === category;
      const q = query.trim().toLowerCase();
      // #96 搜索覆盖 summary 字段
      const matchQ =
        !q ||
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.summary.toLowerCase().includes(q) ||
        b.tags.some((t) => t.toLowerCase().includes(q));
      return matchCat && matchQ;
    });
    list = [...list].sort((a, b) => {
      if (sort === "热度") return b.favorites - a.favorites;
      // #96 "最新"排序改用 createdAt（之前用 year，用户上传资源 year 都是当前年，排序随机）
      if (sort === "最新") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return b.difficulty - a.difficulty;
    });
    return list;
  }, [allBooks, query, category, sort]);

  const handleUploadClick = () => {
    if (!user) {
      dispatchAuthWithIntent("upload-resource");
      return;
    }
    setUploadOpen(true);
  };

  const handleNewBook = (book: Book) => {
    setRealBooks((prev) => [book, ...prev]);
  };

  return (
    <>
      {/* 顶部工具栏 */}
      <div className="border-b border-void-600/30 bg-void-900/20">
        <div className="container-tj flex h-12 items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-medium text-parchment-100">学习资源库</h1>
            <span className="text-xs text-mist-500">{filtered.length} 份资源{filtered.length !== allBooks.length && ` / 共 ${allBooks.length} 份`}</span>
          </div>
          <button onClick={handleUploadClick} className="inline-flex items-center gap-1.5 rounded-md bg-star-400/10 px-3 py-1.5 text-xs font-medium text-star-300 transition-colors hover:bg-star-400/20">
            <Plus size={13} /> 上传资源
          </button>
        </div>
      </div>

      <section className="container-tj py-6">
        {/* 搜索 + 分类 + 排序，单行紧凑 */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-xs flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mist-500" />
            <input
              name="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索书名、作者或标签…"
              className="w-full rounded-md border border-void-600/30 bg-void-800/20 py-1.5 pl-8 pr-3 text-xs text-parchment-100 placeholder:text-mist-500 focus:border-void-600/60 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-0.5">
              {CATEGORIES.map((c) => (
                <button key={c} onClick={() => setCategory(c)} className={`rounded px-2 py-1 transition-colors ${category === c ? "text-parchment-100" : "text-mist-500 hover:text-mist-300"}`}>
                  {c}
                </button>
              ))}
            </div>
            <span className="text-mist-600">|</span>
            <div className="flex items-center gap-1">
              {SORTS.map((s) => (
                <button key={s} onClick={() => setSort(s)} className={`rounded px-2 py-1 transition-colors ${sort === s ? "text-parchment-100" : "text-mist-500 hover:text-mist-300"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 书卡网格 */}
        {loading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <BookCardSkeleton key={i} />
            ))}
          </div>
        )}

        {!loading && loadError && (
          <div className="rounded-xl border border-dashed border-red-400/40 py-20 text-center">
            <p className="text-mist-300">资源加载失败，可能是网络或登录态过期</p>
            <button
              onClick={loadBooks}
              className="mt-4 rounded-lg border border-star-400/40 bg-star-400/10 px-6 py-2 text-sm text-star-300 transition-colors hover:bg-star-400/20"
            >
              重新加载
            </button>
          </div>
        )}

        {!loading && !loadError && filtered.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((b, i) => (
              <BookCard key={b.id} book={b} index={i} />
            ))}
          </div>
        )}

        {!loading && !loadError && filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-void-600/50 py-20 text-center text-mist-400">
            未找到匹配的书目，试试其他关键词。
          </div>
        )}
      </section>

      <BookUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onCreated={handleNewBook}
      />
    </>
  );
}
