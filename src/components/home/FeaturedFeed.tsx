import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { MessageCircle, BookOpen, Lightbulb, ArrowUpRight, Eye, ThumbsUp, Star } from "lucide-react";
import { questions } from "@/data/questions";
import { books } from "@/data/books";
import { ideas } from "@/data/ideas";
import Avatar from "@/components/Avatar";
import DifficultyDots from "@/components/DifficultyDots";

type Tab = "discussion" | "resource" | "idea";

const TABS: { key: Tab; label: string; icon: typeof MessageCircle; to: string }[] = [
  { key: "discussion", label: "最新讨论", icon: MessageCircle, to: "/discussion" },
  { key: "resource", label: "热门资源", icon: BookOpen, to: "/library" },
  { key: "idea", label: "新灵感", icon: Lightbulb, to: "/ideas" },
];

export default function FeaturedFeed() {
  const [tab, setTab] = useState<Tab>("discussion");

  return (
    <section className="container-tj py-20">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="h-px w-8 bg-gradient-to-r from-transparent to-star-400" />
            <span className="font-mono text-xs uppercase tracking-[0.25em] text-star-300">
              星河流转 · 精选内容
            </span>
          </div>
          <h2 className="heading-display text-3xl text-parchment-50 sm:text-4xl">
            社区最新动态
          </h2>
        </div>
        {/* Tabs */}
        <div className="flex items-center gap-1 rounded-lg border border-void-600/50 bg-void-800/40 p-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`relative inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors ${
                  active ? "text-void-900" : "text-mist-300 hover:text-parchment-100"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="feedTab"
                    className="absolute inset-0 rounded-md bg-gold-sheen"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <Icon size={13} className="relative" />
                <span className="relative">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="card-surface overflow-hidden">
        <AnimatePresence mode="wait">
          {tab === "discussion" && (
            <motion.div
              key="discussion"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {questions.slice(0, 4).map((q) => (
                <Link
                  key={q.id}
                  to={`/discussion/${q.id}`}
                  className="group flex items-start gap-4 border-b border-void-600/30 p-5 transition-colors last:border-0 hover:bg-void-700/30"
                >
                  <div className="flex w-16 shrink-0 flex-col items-center border-r border-void-600/30 pr-4 text-center">
                    <span className="heading-display text-lg text-tian-300">{q.answers}</span>
                    <span className="text-[10px] text-mist-500">回答</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm text-parchment-100 transition-colors group-hover:text-star-200">
                      {q.title}
                    </h3>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mist-400">
                      {q.bounty && (
                        <span className="pill-gold">
                          <Star size={10} /> 悬赏 {q.bounty}
                        </span>
                      )}
                      {q.tags.slice(0, 2).map((t) => (
                        <span key={t} className="pill">
                          {t}
                        </span>
                      ))}
                      <span className="flex items-center gap-1">
                        <ThumbsUp size={11} /> {q.votes}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye size={11} /> {q.views}
                      </span>
                    </div>
                  </div>
                  <Avatar name={q.author} color={q.avatarColor} size={28} />
                </Link>
              ))}
            </motion.div>
          )}

          {tab === "resource" && (
            <motion.div
              key="resource"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {books.slice(0, 4).map((b) => (
                <Link
                  key={b.id}
                  to={`/library/${b.id}`}
                  className="group flex items-center gap-4 border-b border-void-600/30 p-5 transition-colors last:border-0 hover:bg-void-700/30"
                >
                  <div
                    className="flex h-16 w-12 shrink-0 items-end justify-center rounded-md border p-1.5"
                    style={{ borderColor: `${b.accent}55`, background: `${b.accent}12` }}
                  >
                    <BookOpen size={16} style={{ color: b.accent }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm text-parchment-100 transition-colors group-hover:text-star-200">
                      {b.title}
                    </h3>
                    <p className="mt-0.5 text-xs text-mist-400">{b.author}</p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-mist-400">
                      <span className="pill">{b.category}</span>
                      <DifficultyDots level={b.difficulty} />
                      <span className="flex items-center gap-1">
                        <Star size={11} className="text-star-400" /> {b.rating}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-mist-500">{b.favorites} 收藏</span>
                </Link>
              ))}
            </motion.div>
          )}

          {tab === "idea" && (
            <motion.div
              key="idea"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {ideas.slice(0, 4).map((idea) => (
                <Link
                  key={idea.id}
                  to="/ideas"
                  className="group flex items-start gap-4 border-b border-void-600/30 p-5 transition-colors last:border-0 hover:bg-void-700/30"
                >
                  <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-star-400/30 bg-star-400/10 text-star-300">
                    <Lightbulb size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm text-parchment-100 transition-colors group-hover:text-star-200">
                      {idea.title}
                    </h3>
                    <p className="mt-1 line-clamp-1 text-xs text-mist-400">{idea.summary}</p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-mist-400">
                      <span className="pill-blue">{idea.topic}</span>
                      <span className="flex items-center gap-1">
                        <ThumbsUp size={11} /> 共鸣 {idea.resonance}
                      </span>
                    </div>
                  </div>
                  <Avatar name={idea.author} color={idea.avatarColor} size={28} />
                </Link>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <Link
          to={TABS.find((t) => t.key === tab)!.to}
          className="flex items-center justify-center gap-1.5 border-t border-void-600/30 py-3.5 text-xs text-mist-300 transition-colors hover:bg-void-700/30 hover:text-star-200"
        >
          查看全部 <ArrowUpRight size={13} />
        </Link>
      </div>
    </section>
  );
}
