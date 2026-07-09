import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { PostDetailSkeleton } from "@/components/Skeleton";
import {
  ArrowLeft,
  BookOpen,
  Star,
  Bookmark,
  Download,
  ChevronDown,
  Calendar,
  FileText,
  Flag,
  Loader2,
  MessageCircle,
  Send,
} from "lucide-react";
import { books } from "@/data/books";
import { fetchBookById, incrementBookDownloads, addReview } from "@/lib/books";
import { app } from "@/lib/cloudbase";
import DifficultyDots from "@/components/DifficultyDots";
import Avatar from "@/components/Avatar";
import ReportModal from "@/components/ReportModal";
import RelatedContent from "@/components/RelatedContent";
import { toggleFavorite, isFavorited } from "@/lib/favorites";
import { rateLimiters } from "@/lib/security";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/stores/toast";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import LazyMathText from "@/components/LazyMathText";

export default function BookDetail() {
  const { id } = useParams();
  const mockBook = books.find((b) => b.id === id);
  const [book, setBook] = useState(mockBook || null);
  useDocumentTitle(book?.title);
  const [loading, setLoading] = useState(!mockBook);
  const [tocOpen, setTocOpen] = useState(true);
  const [favorited, setFavorited] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [resolvedFileUrl, setResolvedFileUrl] = useState<string | undefined>(undefined);
  const [resolvingUrl, setResolvingUrl] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const { user } = useAuthStore();
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [questionPage, setQuestionPage] = useState("");
  const [questionText, setQuestionText] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (mockBook) {
      setBook(mockBook);
      setLoading(false);
      return;
    }
    if (!id) return;
    let mounted = true;
    (async () => {
      const dbBook = await fetchBookById(id);
      if (mounted) {
        if (dbBook) setBook(dbBook);
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id, mockBook]);

  useEffect(() => {
    if (id) isFavorited(id).then(setFavorited);
  }, [id, user?.uid]);

  // 如果 fileUrl 是 cloud:// fileID，先换取临时下载链接
  useEffect(() => {
    const fileUrl = book?.fileUrl;
    if (!fileUrl) {
      setResolvedFileUrl(undefined);
      setResolvingUrl(false);
      return;
    }
    if (!fileUrl.startsWith("cloud://")) {
      setResolvedFileUrl(fileUrl);
      setResolvingUrl(false);
      return;
    }
    setResolvingUrl(true);
    let mounted = true;
    (async () => {
      try {
        const result = await app.getTempFileURL({ fileList: [fileUrl] });
        if (mounted) {
          const tempUrl = result?.fileList?.[0]?.tempFileURL;
          setResolvedFileUrl(tempUrl || fileUrl);
        }
      } catch {
        if (mounted) setResolvedFileUrl(fileUrl);
      } finally {
        if (mounted) setResolvingUrl(false);
      }
    })();
    return () => { mounted = false; };
  }, [book?.fileUrl]);

  // 真正触发下载：fetch 成 blob 后用 blob URL 下载，绕过跨域 download 属性失效问题
  const handleDownload = async () => {
    if (!book) return;
    const url = resolvedFileUrl ?? book.fileUrl;
    if (!url) return;
    setDownloading(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("下载失败");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = book.fileName || `${book.title}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      incrementBookDownloads(book.id);
    } catch {
      // fetch 失败（如 CORS），退回到直接打开链接
      window.open(url, "_blank");
    } finally {
      setDownloading(false);
    }
  };

  const handleFav = async () => {
    if (!user) {
      window.dispatchEvent(new CustomEvent("tianji:open-auth"));
      return;
    }
    if (!book) return;
    try {
      const fav = await toggleFavorite({
        targetId: book.id,
        type: "book",
        title: book.title,
        excerpt: book.summary,
        link: `/library/${book.id}`,
      });
      setFavorited(fav);
      toast.success(fav ? "已收藏" : "已取消收藏");
    } catch (e) {
      console.error("收藏操作失败:", e);
      toast.error("操作失败，请重试");
    }
  };

  const handleReviewSubmit = async () => {
    if (!user) {
      window.dispatchEvent(new CustomEvent("tianji:open-auth"));
      return;
    }
    if (!book || reviewRating === 0 || !reviewText.trim()) return;

    // 频率限制：先检查，成功后再记录
    const rl = rateLimiters.comment.check();
    if (!rl.allowed) {
      toast.error(`操作太快了，请等待 ${rl.remaining} 秒后再试`);
      return;
    }

    setReviewSubmitting(true);
    try {
      const author = user.nickname || user.username || user.email || "匿名用户";
      const result = await addReview(book.id, { author, authorUid: user.uid, rating: reviewRating, content: reviewText.trim() });
      if (!result) {
        toast.error("该资源可能已被删除，无法评价");
        return;
      }
      rateLimiters.comment.record();
      const newReview = { author, authorUid: user.uid, rating: reviewRating, content: reviewText.trim(), date: new Date().toISOString() };
      // 按 uid 去重：已评过则替换原评价，未评过则追加
      const existingIdx = book.reviews.findIndex((r) => r.authorUid === user.uid);
      const newReviews = existingIdx >= 0
        ? book.reviews.map((r, i) => (i === existingIdx ? newReview : r))
        : [...book.reviews, newReview];
      setBook({
        ...book,
        reviews: newReviews,
        rating: result.avgRating,
      });
      setReviewRating(0);
      setReviewText("");
      toast.success(result.updated ? "评价已更新" : "评价已提交");
    } catch {
      toast.error("提交失败，请重试");
    } finally {
      setReviewSubmitting(false);
    }
  };

  const openReport = () => {
    if (!user) {
      window.dispatchEvent(new CustomEvent("tianji:open-auth"));
      return;
    }
    setReportOpen(true);
  };

  if (loading) {
    return <PostDetailSkeleton />;
  }

  if (!book) {
    return (
      <div className="container-tj py-40 text-center">
        <p className="text-mist-400">未找到该书目。</p>
        <Link to="/library" className="btn-ghost mt-6 inline-flex">
          <ArrowLeft size={15} /> 返回资源库
        </Link>
      </div>
    );
  }

  const related = books.filter((b) => b.id !== book.id && b.category === book.category).slice(0, 3);

  return (
    <div className="container-tj py-10">
      <Link
        to="/library"
        className="inline-flex items-center gap-1.5 text-sm text-mist-400 transition-colors hover:text-star-300"
      >
        <ArrowLeft size={15} /> 返回资源库
      </Link>

      {/* 主体 */}
      <div className="mt-8 grid gap-10 lg:grid-cols-[320px_1fr]">
        {/* 左：封面 + 操作 */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="lg:sticky lg:top-24 lg:self-start"
        >
          <div
            className="relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-xl border"
            style={{
              borderColor: `${book.accent}44`,
              background: `linear-gradient(160deg, ${book.accent}26, ${book.accent}06 55%, transparent)`,
            }}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 25% 15%, rgba(255,255,255,0.18), transparent 55%)",
              }}
            />
            <BookOpen size={64} strokeWidth={0.8} style={{ color: book.accent }} />
            <span className="absolute bottom-4 font-display text-sm" style={{ color: book.accent }}>
              {book.title}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {book.fileUrl ? (
              resolvingUrl ? (
                <button className="btn-gold col-span-2 opacity-70" disabled>
                  <Loader2 size={15} className="animate-spin" /> 准备下载链接…
                </button>
              ) : (
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="btn-gold col-span-2 disabled:opacity-70"
                >
                  {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                  {downloading ? "下载中…" : "下载资源"}
                </button>
              )
            ) : book.link ? (
              <a
                href={book.link}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-gold col-span-2"
              >
                <Download size={15} /> 访问资源
              </a>
            ) : (
              <button className="btn-gold col-span-2 opacity-50" disabled>
                <Download size={15} /> 暂无下载
              </button>
            )}
            <button
              onClick={openReport}
              className="col-span-2 inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-5 py-2.5 text-sm font-medium text-red-300 transition-all hover:bg-red-500/20"
            >
              <Flag size={15} /> 举报资源
            </button>
            <button
              onClick={handleFav}
              className={`inline-flex items-center justify-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-medium transition-all ${
                favorited
                  ? "border-star-400/70 bg-star-400/15 text-star-200"
                  : "border-void-600/50 bg-void-800/40 text-mist-300 hover:border-mist-400/40"
              }`}
            >
              <Bookmark size={15} className={favorited ? "fill-star-400" : ""} />
              {favorited ? "已收藏" : "收藏"}
            </button>
          </div>

          <dl className="mt-5 space-y-2.5 rounded-xl border border-void-600/40 bg-void-800/30 p-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-mist-500">作者</dt>
              <dd className="text-parchment-100">{book.author}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-mist-500">出版年</dt>
              <dd className="flex items-center gap-1 text-parchment-100">
                <Calendar size={12} /> {book.year}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-mist-500">页数</dt>
              <dd className="flex items-center gap-1 text-parchment-100">
                <FileText size={12} /> {book.pages}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-mist-500">难度</dt>
              <dd>
                <DifficultyDots level={book.difficulty} />
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-mist-500">评分</dt>
              <dd className="flex items-center gap-1 text-star-300">
                <Star size={13} className="fill-star-400" /> {book.rating}
              </dd>
            </div>
          </dl>
        </motion.div>

        {/* 右：信息 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <span
            className="pill mb-4"
            style={{ borderColor: `${book.accent}55`, color: book.accent }}
          >
            {book.category}
          </span>
          <h1 className="heading-display text-3xl text-parchment-50 sm:text-4xl">
            {book.title}
          </h1>
          <p className="mt-2 text-mist-300">{book.author}</p>

          <p className="mt-6 text-base leading-relaxed text-mist-300">{book.summary}</p>

          <div className="mt-5 flex flex-wrap gap-2">
            {book.tags.map((t) => (
              <Link key={t} to={`/tags/${encodeURIComponent(t)}`} className="pill-blue transition-colors hover:border-tian-400/50 hover:text-tian-100">
                {t}
              </Link>
            ))}
          </div>

          {/* 目录 */}
          <div className="mt-8 rounded-xl border border-void-600/40 bg-void-800/30">
            <button
              onClick={() => setTocOpen((v) => !v)}
              className="flex w-full items-center justify-between p-4 text-left"
            >
              <span className="heading-display text-lg text-parchment-50">目录</span>
              <ChevronDown
                size={18}
                className={`text-mist-400 transition-transform ${tocOpen ? "rotate-180" : ""}`}
              />
            </button>
            {tocOpen && (
              <ol className="space-y-0.5 border-t border-void-600/30 p-4">
                {book.toc.map((c, i) => {
                  const depth = c.match(/^ */)?.[0].length ?? 0;
                  const indent = Math.floor(depth / 2);
                  const isChapter = indent === 0;
                  return (
                    <li
                      key={i}
                      className={`flex items-baseline gap-2 text-sm transition-colors hover:text-parchment-100 ${
                        isChapter
                          ? "mt-2 font-medium text-parchment-100"
                          : "text-mist-300"
                      }`}
                      style={indent > 0 ? { paddingLeft: `${indent * 1.5}rem` } : undefined}
                    >
                      {isChapter && (
                        <span className="font-mono text-xs text-star-400/70">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                      )}
                      <span>{c.trim()}</span>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {/* 读者评价 */}
          <div className="mt-8">
            <h2 className="heading-display text-xl text-parchment-50">读者评价</h2>

            {/* 评价表单（内置书目不支持评价） */}
            {mockBook ? (
              <div className="mt-4 rounded-xl border border-void-600/40 bg-void-800/30 p-5 text-center text-sm text-mist-500">
                内置资源暂不支持评价
              </div>
            ) : (
            <div className="mt-4 rounded-xl border border-void-600/40 bg-void-800/30 p-5">
              <div className="flex items-center gap-2">
                <span className="text-sm text-mist-400">我的评分：</span>
                {Array.from({ length: 5 }, (_, k) => (
                  <button
                    key={k}
                    onClick={() => setReviewRating(k + 1)}
                    aria-label={`评分 ${k + 1} 星`}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      size={18}
                      className={k < reviewRating ? "fill-star-400 text-star-400" : "text-void-600"}
                    />
                  </button>
                ))}
              </div>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="分享你对这本书的评价、收获或建议…"
                aria-label="评价内容"
                className="mt-3 w-full resize-none rounded-lg border border-void-600/50 bg-void-950/50 p-3 text-sm text-parchment-100 focus:border-star-400/50 focus:outline-none"
              />
              <div className="mt-3 flex justify-end">
                <button
                  onClick={handleReviewSubmit}
                  disabled={reviewSubmitting || reviewRating === 0 || !reviewText.trim()}
                  className="btn-gold text-sm disabled:opacity-50"
                >
                  {reviewSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  提交评价
                </button>
              </div>
            </div>
            )}

            {/* 评价列表 */}
            <div className="mt-4 space-y-4">
              {book.reviews.length === 0 ? (
                <p className="py-8 text-center text-sm text-mist-500">还没有评价，第一个来分享你的想法吧</p>
              ) : (
                book.reviews.map((r, i) => (
                  <div key={i} className="rounded-xl border border-void-600/40 bg-void-800/30 p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={r.author} size={30} />
                        <span className="text-sm text-parchment-100">{r.author}</span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }, (_, k) => (
                          <Star key={k} size={12} className={k < r.rating ? "fill-star-400 text-star-400" : "text-void-600"} />
                        ))}
                      </div>
                    </div>
                    <LazyMathText content={r.content} className="mt-3 text-sm leading-relaxed text-mist-300" />
                    <p className="mt-2 font-mono text-[10px] text-mist-500">{r.date.slice(0, 10)}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 疑问板块 */}
          <div className="mt-8 rounded-xl border border-void-600/40 bg-void-800/30 p-5">
            <h2 className="heading-display text-lg text-parchment-50 flex items-center gap-2">
              <MessageCircle size={18} className="text-star-400" /> 对内容有疑问？
            </h2>
            <p className="mt-2 text-sm text-mist-400">标注你有疑问的页码和问题，直接去讨论区发帖交流。</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                value={questionPage}
                onChange={(e) => setQuestionPage(e.target.value)}
                placeholder="页码（如 42 或 42-45）"
                aria-label="有疑问的页码"
                className="w-full rounded-lg border border-void-600/50 bg-void-950/50 px-3 py-2 text-sm text-parchment-100 focus:border-star-400/50 focus:outline-none sm:w-40"
              />
              <input
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="简要描述你的疑问…"
                aria-label="疑问描述"
                className="flex-1 rounded-lg border border-void-600/50 bg-void-950/50 px-3 py-2 text-sm text-parchment-100 focus:border-star-400/50 focus:outline-none"
              />
              <button
                onClick={() => {
                  if (!user) {
                    window.dispatchEvent(new CustomEvent("tianji:open-auth"));
                    return;
                  }
                  const pageStr = questionPage.trim() ? `第 ${questionPage.trim()} 页：` : "";
                  navigate("/", {
                    state: {
                      prefill: {
                        title: `关于《${book.title}》${pageStr}的疑问`,
                        body: questionText.trim() ? `${pageStr}${questionText.trim()}` : "",
                        tags: [book.title],
                      },
                    },
                  });
                }}
                className="btn-gold whitespace-nowrap text-sm"
              >
                <MessageCircle size={14} /> 去发帖
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* 相关推荐 */}
      {related.length > 0 && (
        <section className="mt-16 border-t border-void-600/30 pt-12">
          <h2 className="heading-display text-xl text-parchment-50">相关书目</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {related.map((b) => (
              <Link
                key={b.id}
                to={`/library/${b.id}`}
                className="group flex items-center gap-4 rounded-xl border border-void-600/40 bg-void-800/30 p-4 transition-all hover:border-star-400/40 hover:bg-void-700/30"
              >
                <div
                  className="flex h-16 w-12 shrink-0 items-center justify-center rounded-md border"
                  style={{ borderColor: `${b.accent}55`, background: `${b.accent}12` }}
                >
                  <BookOpen size={18} style={{ color: b.accent }} />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-sm text-parchment-100 transition-colors group-hover:text-star-200">
                    {b.title}
                  </h3>
                  <p className="mt-0.5 text-xs text-mist-400">{b.author}</p>
                  <p className="mt-1 text-xs text-mist-500">{b.category}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {book.tags.length > 0 && (
        <RelatedContent tags={book.tags} excludeId={book.id} />
      )}

      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="book"
        targetId={book.id}
        targetTitle={book.title}
      />
    </div>
  );
}
