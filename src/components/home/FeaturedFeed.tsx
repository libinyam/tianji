import { useState } from "react";
import { Link } from "react-router-dom";
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
    <section className="container-tj py-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="heading-display text-2xl text-parchment-50 sm:text-3xl">
            社区最新动态
          </h2>
        </div>
        {/* Tabs - 精简为纯文字切换 */}
        <div className="flex items-center gap-1 rounded-lg border border-void-600/30 bg-void-800/30 p-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors ${
                  active ? "bg-void-700/60 text-parchment-100" : "text-mist-400 hover:text-mist-300"
                }`}
              >
                <Icon size={13} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="card-surface overflow-hidden">
        {tab === "discussion" && (
          <div>
            {questions.slice(0, 4).map((q) => (
              <Link
                key={q.id}
                to={`/discussion/${q.id}`}
                className="group flex items-start gap-4 border-b border-void-600/30 px-5 py-4 transition-colors last:border-0 hover:bg-void-700/30"
              >
                <div className="flex w-14 shrink-0 flex-col items-center border-r border-void-600/30 pr-3 text-center">
                  <span className="heading-display text-base text-tian-300">{q.answers}</span>
                  <span className="text-[10px] text-mist-500">回答</span>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm text-parchment-100 transition-colors group-hover:text-star-200">
                    {q.title}
                  </h3>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mist-400">
                    {q.bounty && (
                      <span className="pill-gold">
                        <Star size={10} /> 悬赏 {q.bounty}
                      </span>
                    )}
                    {q.tags.slice(0, 2).map((t) => (
                      <span key={t} className="pill">{t}</span>
                    ))}
                    <span className="flex items-center gap-1">
                      <ThumbsUp size={11} /> {q.votes}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye size={11} /> {q.views}
                    </span>
                  </div>
                </div>
                <Avatar name={q.author} color={q.avatarColor} size={26} />
              </Link>
            ))}
          </div>
        )}

        {tab === "resource" && (
          <div>
            {books.slice(0, 4).map((b) => (
              <Link
                key={b.id}
                to={`/library/${b.id}`}
                className="group flex items-center gap-4 border-b border-void-600/30 px-5 py-4 transition-colors last:border-0 hover:bg-void-700/30"
              >
                <div
                  className="flex h-14 w-10 shrink-0 items-end justify-center rounded-md border p-1"
                  style={{ borderColor: `${b.accent}44`, background: `${b.accent}10` }}
                >
                  <BookOpen size={14} style={{ color: b.accent }} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm text-parchment-100 transition-colors group-hover:text-star-200">
                    {b.title}
                  </h3>
                  <p className="mt-0.5 text-xs text-mist-400">{b.author}</p>
                  <div className="mt-1.5 flex items-center gap-3 text-xs text-mist-400">
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
          </div>
        )}

        {tab === "idea" && (
          <div>
            {ideas.slice(0, 4).map((idea) => (
              <Link
                key={idea.id}
                to="/ideas"
                className="group flex items-start gap-4 border-b border-void-600/30 px-5 py-4 transition-colors last:border-0 hover:bg-void-700/30"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-star-400/30 bg-star-400/10 text-star-300">
                  <Lightbulb size={13} />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm text-parchment-100 transition-colors group-hover:text-star-200">
                    {idea.title}
                  </h3>
                  <p className="mt-1 line-clamp-1 text-xs text-mist-400">{idea.summary}</p>
                  <div className="mt-1.5 flex items-center gap-3 text-xs text-mist-400">
                    <span className="pill-blue">{idea.topic}</span>
                    <span className="flex items-center gap-1">
                      <ThumbsUp size={11} /> 共鸣 {idea.resonance}
                    </span>
                  </div>
                </div>
                <Avatar name={idea.author} color={idea.avatarColor} size={26} />
              </Link>
            ))}
          </div>
        )}

        <Link
          to={TABS.find((t) => t.key === tab)!.to}
          className="flex items-center justify-center gap-1.5 border-t border-void-600/30 px-5 py-3 text-xs text-mist-300 transition-colors hover:bg-void-700/30 hover:text-star-200"
        >
          查看全部 <ArrowUpRight size={13} />
        </Link>
      </div>
    </section>
  );
}
