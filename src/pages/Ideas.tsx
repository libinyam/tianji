import { useMemo, useState, useEffect } from "react";
import { motion } from "motion/react";
import { Lightbulb, ThumbsUp, MessageCircle, Sparkles, Plus, Loader2, Bookmark } from "lucide-react";
import PageHero from "@/components/PageHero";
import Avatar from "@/components/Avatar";
import IdeaModal from "@/components/IdeaModal";
import { ideas as mockIdeas } from "@/data/ideas";
import { fetchIdeas, resonanceIdea } from "@/lib/ideas";
import { toggleFavorite, getFavoritedIds } from "@/lib/favorites";
import { useAuthStore } from "@/stores/auth";
import type { Idea } from "@/types";

export default function Ideas() {
  const [topic, setTopic] = useState("全部");
  const [ideaModalOpen, setIdeaModalOpen] = useState(false);
  const [realIdeas, setRealIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [resonated, setResonated] = useState<Record<string, boolean>>({});
  const [favedIdeas, setFavedIdeas] = useState<Set<string>>(new Set());
  const { user } = useAuthStore();

  // 加载真实灵感
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const ideas = await fetchIdeas();
      if (mounted) {
        setRealIdeas(ideas);
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // 加载收藏状态
  useEffect(() => {
    if (!user || realIdeas.length === 0) return;
    getFavoritedIds(realIdeas.map((i) => i.id)).then(setFavedIdeas);
  }, [user, realIdeas]);

  // 真实灵感在前，Mock 在后
  const allIdeas = useMemo(() => {
    const mockIds = new Set(realIdeas.map((i) => i.id));
    return [...realIdeas, ...mockIdeas.filter((i) => !mockIds.has(i.id))];
  }, [realIdeas]);

  const TOPICS = useMemo(
    () => ["全部", ...Array.from(new Set(allIdeas.map((i) => i.topic)))],
    [allIdeas]
  );

  const filtered = useMemo(
    () =>
      allIdeas
        .filter((i) => topic === "全部" || i.topic === topic)
        .sort((a, b) => b.resonance - a.resonance),
    [allIdeas, topic]
  );

  const handleNewIdea = (idea: Idea) => {
    setRealIdeas((prev) => [idea, ...prev]);
  };

  const handleIdeaClick = () => {
    if (!user) {
      window.dispatchEvent(new CustomEvent("tianji:open-auth"));
      return;
    }
    setIdeaModalOpen(true);
  };

  const handleResonance = async (idea: Idea) => {
    if (!user) {
      window.dispatchEvent(new CustomEvent("tianji:open-auth"));
      return;
    }
    if (resonated[idea.id]) return;

    // 本地先 +1
    setResonated((v) => ({ ...v, [idea.id]: true }));
    setRealIdeas((prev) =>
      prev.map((i) => (i.id === idea.id ? { ...i, resonance: i.resonance + 1 } : i))
    );

    // 远程更新
    await resonanceIdea(idea.id);
  };

  const handleFav = async (idea: Idea) => {
    if (!user) {
      window.dispatchEvent(new CustomEvent("tianji:open-auth"));
      return;
    }
    try {
      const fav = await toggleFavorite({
        targetId: idea.id,
        type: "idea",
        title: idea.title,
        excerpt: idea.summary,
        link: `/ideas`,
      });
      setFavedIdeas((prev) => {
        const next = new Set(prev);
        if (fav) next.add(idea.id);
        else next.delete(idea.id);
        return next;
      });
    } catch {
      // 静默
    }
  };

  return (
    <>
      <PageHero
        eyebrow="Ideas · 灵感广场"
        title={
          <>
            让思维的<span className="text-star-400">星火</span>，落地成真实作品
          </>
        }
        subtitle="项目创意与研究思路的交流星图。把数学、物理、金融、算法与领域知识做成可展示的作品，让每一个萌芽的念头，都可能长成一个能分享的 Demo。"
      >
        <button onClick={handleIdeaClick} className="btn-gold">
          <Plus size={15} /> 分享灵感
        </button>
      </PageHero>

      <section className="container-tj py-12">
        {/* 主题筛选 */}
        <div className="mb-10 flex flex-wrap items-center gap-2">
          {TOPICS.map((t) => (
            <button
              key={t}
              onClick={() => setTopic(t)}
              className={`rounded-full border px-3.5 py-1.5 text-xs transition-all ${
                topic === t
                  ? "border-star-400/60 bg-star-400/15 text-star-200"
                  : "border-void-600/50 bg-void-800/40 text-mist-300 hover:border-mist-400/40"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* 加载状态 */}
        {loading && (
          <div className="flex items-center justify-center py-20 text-mist-400">
            <Loader2 size={20} className="mr-2 animate-spin" /> 加载灵感中…
          </div>
        )}

        {/* 星图陈列：交错网格 + 装饰连线 */}
        {!loading && (
          <div className="relative">
            {/* 背景星座连线 */}
            <svg
              className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block"
              aria-hidden
            >
              <defs>
                <linearGradient id="ideaLine" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#7cc4ff" stopOpacity="0" />
                  <stop offset="50%" stopColor="#f3c969" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#7cc4ff" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[
                [15, 18, 55, 42],
                [55, 42, 85, 12],
                [30, 68, 70, 78],
              ].map(([x1, y1, x2, y2], i) => (
                <line
                  key={i}
                  x1={`${x1}%`}
                  y1={`${y1}%`}
                  x2={`${x2}%`}
                  y2={`${y2}%`}
                  stroke="url(#ideaLine)"
                  strokeWidth="1"
                  strokeDasharray="4 6"
                />
              ))}
            </svg>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((idea, i) => (
                <motion.article
                  key={idea.id}
                  initial={{ opacity: 0, y: 24, scale: 0.97 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.5, delay: (i % 3) * 0.1 }}
                  className={`group relative flex flex-col rounded-xl border border-void-600/40 bg-void-800/40 p-6 backdrop-blur-sm transition-all duration-300 hover:border-star-400/40 hover:bg-void-700/40 ${
                    i % 3 === 1 ? "xl:translate-y-8" : ""
                  }`}
                >
                  {/* 星点装饰 */}
                  <Sparkles
                    size={14}
                    className="absolute right-5 top-5 text-star-400/30 transition-colors group-hover:text-star-400/70"
                    strokeWidth={1.5}
                  />

                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-star-400/30 bg-star-400/10 text-star-300">
                      <Lightbulb size={17} />
                    </span>
                    <span className="pill-blue">{idea.topic}</span>
                  </div>

                  <h3 className="mt-4 heading-display text-lg leading-snug text-parchment-50 transition-colors group-hover:text-star-200">
                    {idea.title}
                  </h3>
                  <p className="mt-2.5 flex-1 text-sm leading-relaxed text-mist-300">
                    {idea.summary}
                  </p>

                  <div className="mt-5 flex items-center justify-between border-t border-void-600/30 pt-4">
                    <div className="flex items-center gap-2">
                      <Avatar name={idea.author} color={idea.avatarColor} size={24} />
                      <span className="text-xs text-mist-300">{idea.author}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-mist-400">
                      <button
                        onClick={() => handleResonance(idea)}
                        className={`flex items-center gap-1 transition-colors hover:text-star-300 ${
                          resonated[idea.id] ? "text-star-300" : ""
                        }`}
                        title="共鸣"
                      >
                        <ThumbsUp
                          size={12}
                          className={resonated[idea.id] ? "fill-star-400" : ""}
                        />{" "}
                        {idea.resonance}
                      </button>
                      <button
                        onClick={() => handleFav(idea)}
                        className={`flex items-center gap-1 transition-colors hover:text-star-300 ${
                          favedIdeas.has(idea.id) ? "text-star-300" : ""
                        }`}
                        title="收藏"
                      >
                        <Bookmark
                          size={12}
                          className={favedIdeas.has(idea.id) ? "fill-star-400" : ""}
                        />
                      </button>
                      <span className="flex items-center gap-1">
                        <MessageCircle size={12} /> {idea.replies}
                      </span>
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        )}
      </section>

      <IdeaModal
        open={ideaModalOpen}
        onClose={() => setIdeaModalOpen(false)}
        onCreated={handleNewIdea}
      />
    </>
  );
}
