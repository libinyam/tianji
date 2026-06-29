import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { BookOpen, Star, Bookmark } from "lucide-react";
import type { Book } from "@/types";
import DifficultyDots from "./DifficultyDots";

export default function BookCard({ book, index = 0 }: { book: Book; index?: number }) {
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.45, delay: (index % 4) * 0.08 }}
    >
      <div
        onClick={() => navigate(`/library/${book.id}`)}
        className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border border-void-600/50 bg-void-800/40 transition-all duration-300 hover:-translate-y-1 hover:border-star-400/40 hover:shadow-card"
      >
        {/* 封面 */}
        <div
          className="relative flex h-44 items-center justify-center overflow-hidden border-b border-void-600/40"
          style={{
            background: `linear-gradient(150deg, ${book.accent}22, ${book.accent}05 60%, transparent)`,
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.15), transparent 50%)",
            }}
          />
          {/* 装饰星点 */}
          {[
            { t: "12%", l: "82%", s: 2 },
            { t: "70%", l: "14%", s: 1.5 },
            { t: "40%", l: "70%", s: 1 },
          ].map((p, i) => (
            <span
              key={i}
              className="absolute rounded-full animate-twinkle"
              style={{
                top: p.t,
                left: p.l,
                width: p.s,
                height: p.s,
                background: book.accent,
              }}
            />
          ))}
          <BookOpen
            size={40}
            strokeWidth={1}
            style={{ color: book.accent }}
            className="transition-transform duration-500 group-hover:scale-110"
          />
          <span className="absolute bottom-3 left-3 rounded-md bg-void-950/70 px-2 py-0.5 font-mono text-[10px] text-mist-300 backdrop-blur-sm">
            {book.year}
          </span>
          <span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-md bg-void-950/70 px-2 py-0.5 font-mono text-[10px] text-star-300 backdrop-blur-sm">
            <Star size={9} /> {book.rating}
          </span>
        </div>

        {/* 内容 */}
        <div className="flex flex-1 flex-col p-5">
          <span className="pill mb-3 self-start" style={{ borderColor: `${book.accent}55`, color: book.accent }}>
            {book.category}
          </span>
          <h3 className="heading-display text-lg leading-snug text-parchment-50 transition-colors group-hover:text-star-200">
            {book.title}
          </h3>
          <p className="mt-1 text-xs text-mist-400">{book.author}</p>
          <p className="mt-3 line-clamp-2 flex-1 text-sm leading-relaxed text-mist-300">
            {book.summary}
          </p>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {book.tags.slice(0, 3).map((t) => (
              <Link key={t} to={`/tags/${encodeURIComponent(t)}`} className="pill transition-colors hover:border-star-400/40 hover:text-star-200" onClick={(e) => e.stopPropagation()}>
                {t}
              </Link>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-void-600/30 pt-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-mist-500">难度</span>
              <DifficultyDots level={book.difficulty} />
            </div>
            <span className="flex items-center gap-1 text-xs text-mist-400">
              <Bookmark size={12} /> {book.favorites}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
