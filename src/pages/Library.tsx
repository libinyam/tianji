import { useMemo, useState, useEffect } from "react";
import { Search, SlidersHorizontal, BookOpen, Plus, Loader2 } from "lucide-react";
import PageHero from "@/components/PageHero";
import BookCard from "@/components/BookCard";
import BookUploadModal from "@/components/BookUploadModal";
import { books as mockBooks } from "@/data/books";
import { fetchBooks } from "@/lib/books";
import { useAuthStore } from "@/stores/auth";
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
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"全部" | BookCategory>("全部");
  const [sort, setSort] = useState<SortKey>("热度");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [realBooks, setRealBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();

  // 加载真实书籍
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const books = await fetchBooks();
      if (mounted) {
        setRealBooks(books);
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // 真实书籍在前，Mock 在后
  const allBooks = useMemo(() => {
    const mockIds = new Set(realBooks.map((b) => b.id));
    return [...realBooks, ...mockBooks.filter((b) => !mockIds.has(b.id))];
  }, [realBooks]);

  const filtered = useMemo(() => {
    let list = allBooks.filter((b) => {
      const matchCat = category === "全部" || b.category === category;
      const q = query.trim().toLowerCase();
      const matchQ =
        !q ||
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.tags.some((t) => t.toLowerCase().includes(q));
      return matchCat && matchQ;
    });
    list = [...list].sort((a, b) => {
      if (sort === "热度") return b.favorites - a.favorites;
      if (sort === "最新") return b.year - a.year;
      return b.difficulty - a.difficulty;
    });
    return list;
  }, [allBooks, query, category, sort]);

  const handleUploadClick = () => {
    if (!user) {
      window.dispatchEvent(new CustomEvent("tianji:open-auth"));
      return;
    }
    setUploadOpen(true);
  };

  const handleNewBook = (book: Book) => {
    setRealBooks((prev) => [book, ...prev]);
  };

  return (
    <>
      <PageHero
        eyebrow="Resource Library · 学习资源库"
        title={
          <>
            从理论到<span className="text-star-400">工具实战</span>的资源星图
          </>
        }
        subtitle="从机器学习理论到 GitHub、AI 编程工具与项目部署——按学习阶段系统整理的资源库，为跨专业转型者铺就从知识到作品的路径。"
      >
        <div className="flex items-center gap-4 text-sm text-mist-400">
          <span className="flex items-center gap-1.5">
            <BookOpen size={14} className="text-star-400" /> {allBooks.length} 份精选资源
          </span>
          <span className="text-void-600">|</span>
          <button
            onClick={handleUploadClick}
            className="btn-gold inline-flex"
          >
            <Plus size={14} /> 上传资源
          </button>
        </div>
      </PageHero>

      <section className="container-tj py-12">
        {/* 检索筛选栏 */}
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-md flex-1">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mist-500"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索书名、作者或标签…"
              className="w-full rounded-lg border border-void-600/50 bg-void-800/40 py-2.5 pl-10 pr-4 text-sm text-parchment-100 placeholder:text-mist-500 focus:border-star-400/50 focus:outline-none focus:ring-1 focus:ring-star-400/30"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-full border px-3.5 py-1.5 text-xs transition-all ${
                  category === c
                    ? "border-star-400/60 bg-star-400/15 text-star-200"
                    : "border-void-600/50 bg-void-800/40 text-mist-300 hover:border-mist-400/40"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* 排序 + 结果数 */}
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-mist-400">
            共 <span className="text-star-300">{filtered.length}</span> 部书目
          </p>
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={14} className="text-mist-500" />
            {SORTS.map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`text-xs transition-colors ${
                  sort === s ? "text-star-300" : "text-mist-500 hover:text-mist-300"
                }`}
              >
                {s}
                {sort === s && <span className="ml-1">·</span>}
              </button>
            ))}
          </div>
        </div>

        {/* 书卡网格 */}
        {!loading && filtered.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((b, i) => (
              <BookCard key={b.id} book={b} index={i} />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
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
