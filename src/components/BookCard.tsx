import { Link, useNavigate } from "react-router-dom";
import { BookOpen, Star, Bookmark } from "lucide-react";
import type { Book } from "@/types";
import DifficultyDots from "./DifficultyDots";

export default function BookCard({ book }: { book: Book; index?: number }) {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => navigate(`/library/${book.id}`)}
      className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-lg border border-void-600/30 bg-void-800/20 transition-colors hover:bg-void-800/40"
    >
      {/* 封面 */}
      <div
        className="relative flex h-36 items-center justify-center overflow-hidden border-b border-void-600/20"
        style={{
          background: `linear-gradient(150deg, ${book.accent}15, ${book.accent}05 60%, transparent)`,
        }}
      >
        <BookOpen
          size={32}
          strokeWidth={1}
          style={{ color: book.accent }}
        />
        <span className="absolute bottom-2 left-2.5 rounded bg-void-950/60 px-1.5 py-0.5 font-mono text-[10px] text-mist-400 backdrop-blur-sm">
          {book.year}
        </span>
        <span className="absolute bottom-2 right-2.5 flex items-center gap-1 rounded bg-void-950/60 px-1.5 py-0.5 font-mono text-[10px] text-star-300 backdrop-blur-sm">
          <Star size={9} /> {book.rating}
        </span>
      </div>

      {/* 内容 */}
      <div className="flex flex-1 flex-col p-4">
        <span className="mb-2 text-[11px] text-mist-500">{book.category}</span>
        <h3 className="heading-display text-sm leading-snug text-parchment-50 transition-colors group-hover:text-star-300">
          {book.title}
        </h3>
        <p className="mt-1 text-xs text-mist-500">{book.author}</p>
        <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-mist-400">
          {book.summary}
        </p>

        <div className="mt-3 flex flex-wrap gap-1">
          {book.tags.slice(0, 3).map((t) => (
            <Link key={t} to={`/tags/${encodeURIComponent(t)}`} className="pill transition-colors hover:border-star-400/40 hover:text-star-200" onClick={(e) => e.stopPropagation()}>
              {t}
            </Link>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-void-600/20 pt-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-mist-500">难度</span>
            <DifficultyDots level={book.difficulty} />
          </div>
          <span className="flex items-center gap-1 text-xs text-mist-400">
            <Bookmark size={11} /> {book.favorites}
          </span>
        </div>
      </div>
    </div>
  );
}
