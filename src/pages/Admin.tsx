import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { app } from "@/lib/cloudbase";
import { useIsAdmin } from "@/lib/admin";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/stores/toast";
import { fetchReports, resolveReport, type Report } from "@/lib/reports";

const db = app.database();
import {
  MessageSquare,
  Lightbulb,
  Book,
  Users,
  TrendingUp,
  Trash2,
  Shield,
  Activity,
  HardHat,
  Flag,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface Stats {
  posts: number;
  ideas: number;
  books: number;
  workshops: number;
  users: number;
  notifications: number;
}

interface PostItem {
  _id: string;
  title: string;
  author: string;
  authorUid: string;
  createdAt: string;
  views: number;
  tags: string[];
}

interface IdeaItem {
  _id: string;
  content: string;
  author: string;
  authorUid: string;
  resonance: number;
  topic: string;
}

interface BookItem {
  _id: string;
  title: string;
  author: string;
  authorUid: string;
  downloads: number;
  rating: number;
}

interface WorkshopItem {
  _id: string;
  title: string;
  creator: string;
  creatorUid: string;
  participants: number;
  status: string;
}

export default function Admin() {
  const isAdmin = useIsAdmin();
  const { user, loading } = useAuthStore();
  const [tab, setTab] = useState<"overview" | "posts" | "ideas" | "books" | "workshops" | "reports">("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [ideas, setIdeas] = useState<IdeaItem[]>([]);
  const [books, setBooks] = useState<BookItem[]>([]);
  const [workshops, setWorkshops] = useState<WorkshopItem[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    fetchStats();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    if (tab === "overview") fetchStats();
    else if (tab === "posts") fetchPosts();
    else if (tab === "ideas") fetchIdeas();
    else if (tab === "books") fetchBooks();
    else if (tab === "workshops") fetchWorkshops();
    else if (tab === "reports") fetchReportsData();
  }, [tab, isAdmin]);

  const fetchStats = async () => {
    setLoadingData(true);
    try {
      const collections = ["posts", "ideas", "books", "workshops", "users_v2", "notifications"];
      const results = await Promise.all(
        collections.map((col) => db.collection(col).count())
      );
      setStats({
        posts: results[0]?.total ?? 0,
        ideas: results[1]?.total ?? 0,
        books: results[2]?.total ?? 0,
        workshops: results[3]?.total ?? 0,
        users: results[4]?.total ?? 0,
        notifications: results[5]?.total ?? 0,
      });
    } catch (err) {
      console.error("fetchStats error:", err);
    } finally {
      setLoadingData(false);
    }
  };

  const fetchPosts = async () => {
    setLoadingData(true);
    try {
      const { data } = await db
        .collection("posts")
        .orderBy("createdAt", "desc")
        .limit(50)
        .get();
      setPosts(data as unknown as PostItem[]);
    } catch (err) {
      console.error("fetchPosts error:", err);
    } finally {
      setLoadingData(false);
    }
  };

  const fetchIdeas = async () => {
    setLoadingData(true);
    try {
      const { data } = await db
        .collection("ideas")
        .orderBy("createdAt", "desc")
        .limit(50)
        .get();
      setIdeas(data as unknown as IdeaItem[]);
    } catch (err) {
      console.error("fetchIdeas error:", err);
    } finally {
      setLoadingData(false);
    }
  };

  const fetchBooks = async () => {
    setLoadingData(true);
    try {
      const { data } = await db
        .collection("books")
        .orderBy("createdAt", "desc")
        .limit(50)
        .get();
      setBooks(data as unknown as BookItem[]);
    } catch (err) {
      console.error("fetchBooks error:", err);
    } finally {
      setLoadingData(false);
    }
  };

  const fetchWorkshops = async () => {
    setLoadingData(true);
    try {
      const { data } = await db
        .collection("workshops")
        .orderBy("createdAt", "desc")
        .limit(50)
        .get();
      setWorkshops(data as unknown as WorkshopItem[]);
    } catch (err) {
      console.error("fetchWorkshops error:", err);
    } finally {
      setLoadingData(false);
    }
  };

  const fetchReportsData = async () => {
    setLoadingData(true);
    try {
      const list = await fetchReports();
      setReports(list);
    } catch (err) {
      console.error("fetchReports error:", err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleResolveReport = async (
    report: Report,
    action: "resolved" | "dismissed"
  ) => {
    const confirmMsg =
      action === "resolved"
        ? "确定删除被举报的内容并标记为已处理？"
        : "确定忽略此举报？";
    if (!confirm(confirmMsg)) return;
    try {
      if (action === "resolved") {
        const colMap: Record<string, string> = {
          post: "posts",
          idea: "ideas",
          book: "books",
          workshop: "workshops",
        };
        const col = colMap[report.targetType];
        if (col) {
          try {
            const res = await app.callFunction({
              name: "admin-delete",
              data: { collection: col, docId: report.targetId, action: "delete", _callerUid: user?.uid || "" },
            });
            const result = res.result as { ok?: boolean; error?: string };
            if (!result?.ok) {
              toast.error(result?.error || "内容删除失败");
            }
          } catch (e) {
            console.warn("删除被举报内容失败：", e);
            toast.error("内容删除失败，可能需要手动处理");
          }
        } else if (report.targetType === "answer" || report.targetType === "comment") {
          toast.info("该举报涉及回答/评论，需在帖子详情页手动处理");
        }
      }
      await resolveReport(report.id, action);
      toast.success(action === "resolved" ? "举报已处理" : "举报已忽略");
      fetchReportsData();
    } catch (err) {
      toast.error("操作失败：" + (err as Error).message);
    }
  };

  const handleDelete = async (collection: string, id: string) => {
    if (!confirm("确定删除这条内容？此操作不可撤销。")) return;
    try {
      const res = await app.callFunction({
        name: "admin-delete",
        data: { collection, docId: id, action: "delete", _callerUid: user?.uid || "" },
      });
      const result = res.result as { ok?: boolean; error?: string };
      if (!result?.ok) {
        toast.error(result?.error || "删除失败");
        return;
      }
      toast.success("内容已删除");
      if (tab === "posts") fetchPosts();
      else if (tab === "ideas") fetchIdeas();
      else if (tab === "books") fetchBooks();
      else if (tab === "workshops") fetchWorkshops();
    } catch (err) {
      toast.error("删除失败：" + (err as Error).message);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-mist-400">加载中…</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-2xl py-20 text-center">
        <Shield size={48} className="mx-auto mb-4 text-mist-500" />
        <h1 className="mb-2 text-2xl font-bold text-star-100">权限不足</h1>
        <p className="text-mist-400">只有管理员可以访问此页面</p>
      </div>
    );
  }

  const statCards = [
    { label: "帖子", value: stats?.posts ?? 0, icon: MessageSquare, color: "text-blue-400", bg: "bg-blue-400/10" },
    { label: "灵感", value: stats?.ideas ?? 0, icon: Lightbulb, color: "text-yellow-400", bg: "bg-yellow-400/10" },
    { label: "资源", value: stats?.books ?? 0, icon: Book, color: "text-green-400", bg: "bg-green-400/10" },
    { label: "协作", value: stats?.workshops ?? 0, icon: HardHat, color: "text-purple-400", bg: "bg-purple-400/10" },
    { label: "用户", value: stats?.users ?? 0, icon: Users, color: "text-pink-400", bg: "bg-pink-400/10" },
    { label: "通知", value: stats?.notifications ?? 0, icon: Activity, color: "text-cyan-400", bg: "bg-cyan-400/10" },
  ];

  const tabs = [
    { key: "overview" as const, label: "数据概览", icon: TrendingUp },
    { key: "posts" as const, label: "帖子管理", icon: MessageSquare },
    { key: "ideas" as const, label: "灵感管理", icon: Lightbulb },
    { key: "books" as const, label: "资源管理", icon: Book },
    { key: "workshops" as const, label: "协作管理", icon: HardHat },
    { key: "reports" as const, label: "举报管理", icon: Flag },
  ];

  return (
    <div className="mx-auto max-w-6xl py-8">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-tian-400/30 bg-tian-400/10">
          <Shield className="text-tian-300" size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-star-100">管理后台</h1>
          <p className="text-sm text-mist-400">天玑社区管理中心</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-void-600/40 bg-void-800/30 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              tab === t.key
                ? "bg-tian-400/20 text-tian-200"
                : "text-mist-400 hover:text-mist-200"
            }`}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {loadingData && <p className="py-8 text-center text-mist-400">加载中…</p>}

      {/* Overview */}
      {tab === "overview" && !loadingData && stats && (
        <div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {statCards.map((card) => (
              <div
                key={card.label}
                className="rounded-xl border border-void-600/40 bg-void-800/30 p-5"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm text-mist-400">{card.label}</span>
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.bg}`}>
                    <card.icon size={16} className={card.color} />
                  </div>
                </div>
                <p className="text-3xl font-bold text-star-100">{card.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-void-600/40 bg-void-800/30 p-5">
            <h3 className="mb-3 text-sm font-medium text-star-200">快捷操作</h3>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setTab("posts")} className="btn-ghost text-sm">
                管理帖子
              </button>
              <button onClick={() => setTab("ideas")} className="btn-ghost text-sm">
                管理灵感
              </button>
              <button onClick={() => setTab("books")} className="btn-ghost text-sm">
                管理资源
              </button>
              <button onClick={() => setTab("workshops")} className="btn-ghost text-sm">
                管理协作
              </button>
              <button onClick={() => setTab("reports")} className="btn-ghost text-sm">
                管理举报
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Posts */}
      {tab === "posts" && !loadingData && (
        <div className="space-y-2">
          {posts.length === 0 && <p className="py-8 text-center text-mist-400">暂无帖子</p>}
          {posts.map((p) => (
            <div
              key={p._id}
              className="flex items-center justify-between rounded-xl border border-void-600/40 bg-void-800/30 p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-star-100">{p.title}</p>
                <div className="mt-1 flex items-center gap-3 text-xs text-mist-500">
                  <span>{p.author}</span>
                  <span>{p.createdAt}</span>
                  <span>浏览 {p.views}</span>
                  {p.tags?.map((t) => (
                    <span key={t} className="rounded bg-void-700/50 px-1.5 py-0.5">{t}</span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => handleDelete("posts", p._id)}
                className="ml-3 flex-shrink-0 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-red-400 transition-all hover:bg-red-500/20"
                title="删除"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Ideas */}
      {tab === "ideas" && !loadingData && (
        <div className="space-y-2">
          {ideas.length === 0 && <p className="py-8 text-center text-mist-400">暂无灵感</p>}
          {ideas.map((i) => (
            <div
              key={i._id}
              className="flex items-center justify-between rounded-xl border border-void-600/40 bg-void-800/30 p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-star-100">
                  {i.content.slice(0, 80)}
                  {i.content.length > 80 ? "…" : ""}
                </p>
                <div className="mt-1 flex items-center gap-3 text-xs text-mist-500">
                  <span>{i.author}</span>
                  <span>共鸣 {i.resonance}</span>
                  <span>{i.topic}</span>
                </div>
              </div>
              <button
                onClick={() => handleDelete("ideas", i._id)}
                className="ml-3 flex-shrink-0 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-red-400 transition-all hover:bg-red-500/20"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Books */}
      {tab === "books" && !loadingData && (
        <div className="space-y-2">
          {books.length === 0 && <p className="py-8 text-center text-mist-400">暂无资源</p>}
          {books.map((b) => (
            <div
              key={b._id}
              className="flex items-center justify-between rounded-xl border border-void-600/40 bg-void-800/30 p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-star-100">{b.title}</p>
                <div className="mt-1 flex items-center gap-3 text-xs text-mist-500">
                  <span>{b.author}</span>
                  <span>下载 {b.downloads ?? 0}</span>
                  <span>评分 {b.rating ?? "—"}</span>
                </div>
              </div>
              <button
                onClick={() => handleDelete("books", b._id)}
                className="ml-3 flex-shrink-0 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-red-400 transition-all hover:bg-red-500/20"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Workshops */}
      {tab === "workshops" && !loadingData && (
        <div className="space-y-2">
          {workshops.length === 0 && <p className="py-8 text-center text-mist-400">暂无协作</p>}
          {workshops.map((w) => (
            <div
              key={w._id}
              className="flex items-center justify-between rounded-xl border border-void-600/40 bg-void-800/30 p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-star-100">{w.title}</p>
                <div className="mt-1 flex items-center gap-3 text-xs text-mist-500">
                  <span>{w.creator}</span>
                  <span>参与 {w.participants ?? 0}</span>
                  <span>{w.status}</span>
                </div>
              </div>
              <button
                onClick={() => handleDelete("workshops", w._id)}
                className="ml-3 flex-shrink-0 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-red-400 transition-all hover:bg-red-500/20"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Reports */}
      {tab === "reports" && !loadingData && (
        <div className="space-y-2">
          {reports.length === 0 && <p className="py-8 text-center text-mist-400">暂无举报</p>}
          {reports.map((r) => {
            const typeLabel: Record<string, string> = {
              post: "帖子",
              idea: "灵感",
              book: "资源",
              answer: "回答",
              workshop: "协作",
              comment: "评论",
            };
            const statusLabel: Record<string, string> = {
              pending: "待处理",
              resolved: "已处理",
              dismissed: "已忽略",
            };
            const statusColor: Record<string, string> = {
              pending: "border-yellow-400/40 bg-yellow-400/10 text-yellow-300",
              resolved: "border-green-400/40 bg-green-400/10 text-green-300",
              dismissed: "border-void-600/50 bg-void-700/40 text-mist-400",
            };
            return (
              <div
                key={r.id}
                className="rounded-xl border border-void-600/40 bg-void-800/30 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-star-100">
                      {r.targetTitle || "（无标题）"}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mist-500">
                      <span className="rounded bg-void-700/50 px-1.5 py-0.5 text-mist-300">
                        {typeLabel[r.targetType] ?? r.targetType}
                      </span>
                      <span>举报人：{r.reporterName || r.reporterUid || "匿名"}</span>
                      <span>原因：{r.reason}</span>
                      <span className="font-mono">{r.createdAt}</span>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <span
                      className={`rounded-md border px-2 py-1 text-xs ${
                        statusColor[r.status] ?? statusColor.pending
                      }`}
                    >
                      {statusLabel[r.status] ?? r.status}
                    </span>
                    {r.status === "pending" && (
                      <>
                        <button
                          onClick={() => handleResolveReport(r, "resolved")}
                          className="flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs text-red-400 transition-all hover:bg-red-500/20"
                          title="删除内容并标记为已处理"
                        >
                          <Trash2 size={14} /> 处理
                        </button>
                        <button
                          onClick={() => handleResolveReport(r, "dismissed")}
                          className="flex items-center gap-1 rounded-lg border border-void-600/50 bg-void-800/40 px-2.5 py-1.5 text-xs text-mist-300 transition-all hover:border-mist-400/40"
                          title="忽略举报"
                        >
                          <XCircle size={14} /> 忽略
                        </button>
                      </>
                    )}
                    {r.status !== "pending" && (
                      <CheckCircle2 size={16} className="text-mist-600" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
