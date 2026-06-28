import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  MessageSquare,
  Lightbulb,
  BookOpen,
  Users,
  Eye,
  ThumbsUp,
  Loader2,
} from "lucide-react";
import { fetchPublicUser, fetchUserContent, type UserContent, type PublicUser } from "@/lib/profile";
import { useAuthStore } from "@/stores/auth";

function formatDate(s: string) {
  if (!s) return "";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function UserProfile() {
  const { uid } = useParams();
  const { user: currentUser } = useAuthStore();
  const [profile, setProfile] = useState<PublicUser | null>(null);
  const [content, setContent] = useState<UserContent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      const [pub, cont] = await Promise.all([
        fetchPublicUser(uid),
        fetchUserContent(uid),
      ]);
      if (mounted) {
        setProfile(pub);
        setContent(cont);
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [uid]);

  // 如果是自己，跳转到个人主页
  if (currentUser?.uid === uid) {
    return (
      <div className="container-tj py-40 text-center">
        <p className="text-mist-400">正在跳转到你的个人主页…</p>
        <Link to="/profile" className="btn-gold mt-6 inline-flex">前往个人主页</Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-40 text-mist-400">
        <Loader2 size={20} className="mr-2 animate-spin" /> 加载中…
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container-tj py-40 text-center">
        <p className="heading-display text-2xl text-parchment-50">未找到该用户</p>
        <p className="mt-2 text-sm text-mist-400">该用户可能不存在或尚未发布任何内容。</p>
        <Link to="/" className="btn-ghost mt-6 inline-flex">
          <ArrowLeft size={15} /> 返回首页
        </Link>
      </div>
    );
  }

  const displayName = profile.nickname || "匿名用户";
  const avatar = profile.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${uid}&backgroundColor=1a1a2e,16213e,0f3460`;

  const tabs = [
    { label: "帖子", icon: MessageSquare, items: content?.posts, linkBase: "/discussion", emptyText: "还没有发表过讨论" },
    { label: "灵感", icon: Lightbulb, items: content?.ideas, linkBase: "/ideas", emptyText: "还没有分享过灵感" },
    { label: "资源", icon: BookOpen, items: content?.books, linkBase: "/library", emptyText: "还没有上传过资源" },
    { label: "协作", icon: Users, items: content?.workshops, linkBase: "/workshop", emptyText: "还没有发起过协作" },
  ];

  return (
    <div className="min-h-screen pb-20">
      {/* 头部 */}
      <div className="relative overflow-hidden border-b border-void-600/40">
        <div className="absolute inset-0 bg-gradient-to-br from-void-900 via-void-950 to-void-900" />
        <div className="absolute -top-20 right-20 h-64 w-64 rounded-full bg-star-400/5 blur-3xl" />
        <div className="container-tj relative py-12">
          <Link
            to="/"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-mist-400 transition-colors hover:text-star-300"
          >
            <ArrowLeft size={15} /> 返回首页
          </Link>
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            {/* 头像 */}
            <div className="relative">
              <img
                src={avatar}
                alt={displayName}
                className="h-24 w-24 rounded-2xl border-2 border-star-400/30 bg-void-800 object-cover"
              />
            </div>
            {/* 信息 */}
            <div className="flex-1">
              <h1 className="heading-display text-3xl text-parchment-50">{displayName}</h1>
              <div className="mt-2 flex items-center gap-2">
                <span className="pill">公开主页</span>
              </div>
            </div>
          </div>

          {/* 统计 */}
          {content && (
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "帖子", value: content.posts.length, icon: MessageSquare },
                { label: "灵感", value: content.ideas.length, icon: Lightbulb },
                { label: "资源", value: content.books.length, icon: BookOpen },
                { label: "协作", value: content.workshops.length, icon: Users },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border border-void-600/40 bg-void-800/30 px-4 py-3"
                >
                  <div className="flex items-center gap-2 text-mist-400">
                    <s.icon size={14} />
                    <span className="text-xs">{s.label}</span>
                  </div>
                  <p className="mt-1 heading-display text-2xl text-parchment-50">{s.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 内容区域 */}
      <div className="container-tj mt-8">
        {content && (
          <div className="grid gap-6 lg:grid-cols-2">
            {tabs.map((tab) => {
              const items = tab.items ?? [];
              return (
                <div
                  key={tab.label}
                  className="rounded-2xl border border-void-600/40 bg-void-900/40 p-5"
                >
                  <div className="mb-4 flex items-center gap-2">
                    <tab.icon size={16} className="text-star-400" />
                    <h2 className="heading-display text-lg text-parchment-50">{tab.label}</h2>
                    <span className="ml-auto text-xs text-mist-500">{items.length} 条</span>
                  </div>

                  {items.length === 0 ? (
                    <p className="py-6 text-center text-sm text-mist-500">{tab.emptyText}</p>
                  ) : (
                    <ul className="space-y-2">
                      {items.map((item) => (
                        <li key={item.id}>
                          <Link
                            to={`${tab.linkBase}/${item.id}`}
                            className="group flex items-center justify-between rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:border-void-600/40 hover:bg-void-800/40"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-parchment-100 group-hover:text-star-200">
                                {item.title}
                              </p>
                              <div className="mt-0.5 flex items-center gap-3 text-xs text-mist-500">
                                <span>{formatDate(item.createdAt)}</span>
                                {"views" in item && (
                                  <span className="flex items-center gap-0.5">
                                    <Eye size={11} /> {item.views}
                                  </span>
                                )}
                                {"answersCount" in item && item.answersCount > 0 && (
                                  <span className="flex items-center gap-0.5">
                                    <MessageSquare size={11} /> {item.answersCount}
                                  </span>
                                )}
                                {"resonance" in item && item.resonance > 0 && (
                                  <span className="flex items-center gap-0.5">
                                    <ThumbsUp size={11} /> {item.resonance}
                                  </span>
                                )}
                                {"category" in item && (
                                  <span className="rounded bg-void-700/50 px-1.5 py-0.5">
                                    {item.category}
                                  </span>
                                )}
                                {"type" in item && (
                                  <span className="rounded bg-void-700/50 px-1.5 py-0.5">
                                    {item.type}
                                  </span>
                                )}
                              </div>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
