import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Edit3,
  MessageSquare,
  Lightbulb,
  BookOpen,
  Users,
  Save,
  X,
  Eye,
  ThumbsUp,
  Upload,
  Loader2,
  Bookmark,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/stores/toast";
import { fetchUserContent, type UserContent } from "@/lib/profile";
import { fetchMyFavorites, type FavoriteItem } from "@/lib/favorites";
import { app } from "@/lib/cloudbase";

// 星辰风格头像，契合天玑主题
const DEFAULT_AVATARS = [
  "https://api.dicebear.com/7.x/identicon/svg?seed=StarNova&backgroundColor=1a1a2e,16213e,0f3460",
  "https://api.dicebear.com/7.x/identicon/svg?seed=Orion&backgroundColor=0f3460,533483,1a1a2e",
  "https://api.dicebear.com/7.x/identicon/svg?seed=Lyra&backgroundColor=533483,1a1a2e,0f3460",
  "https://api.dicebear.com/7.x/identicon/svg?seed=Vega&backgroundColor=16213e,0f3460,e94560",
  "https://api.dicebear.com/7.x/identicon/svg?seed=Sirius&backgroundColor=0f3460,1a1a2e,e94560",
  "https://api.dicebear.com/7.x/identicon/svg?seed=Polaris&backgroundColor=1a1a2e,533483,e94560",
];

function formatDate(s: string) {
  if (!s) return "";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Profile() {
  const navigate = useNavigate();
  const { user, updateProfile } = useAuthStore();
  const [content, setContent] = useState<UserContent | null>(null);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newAvatarFileId, setNewAvatarFileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }
    setNickname(user.nickname ?? "");
    setAvatarUrl(user.avatarUrl ?? "");
    Promise.all([fetchUserContent(user.uid), fetchMyFavorites()]).then(([c, favs]) => {
      setContent(c);
      setFavorites(favs);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, navigate]);

  const handleSave = async () => {
    setSaving(true);
    const ok = await updateProfile({ nickname, avatarUrl });
    setSaving(false);
    if (ok) {
      setEditing(false);
      setNewAvatarFileId(null);
      toast.success("资料已更新");
    } else {
      toast.error("保存失败，请重试");
    }
  };

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // 校验文件大小（最大 2MB）
    if (file.size > 2 * 1024 * 1024) {
      toast.error("图片大小不能超过 2MB");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const cloudPath = `avatars/${user.uid}-${Date.now()}.${ext}`;
      const res = await app.uploadFile({ cloudPath, filePath: file as unknown as string });
      // 获取可访问的下载链接（有效期 1 年）
      const urlRes = await app.getTempFileURL({
        fileList: [{ fileID: res.fileID, maxAge: 365 * 24 * 60 * 60 * 1000 }],
      });
      const url = urlRes.fileList?.[0]?.tempFileURL;
      if (url) {
        setAvatarUrl(url);
        setNewAvatarFileId(res.fileID);
      }
    } catch {
      toast.error("上传失败，请重试");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (!user) return null;

  const displayName = user.nickname || user.username || user.email || "成员";
  const avatar = user.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${user.uid}&backgroundColor=1a1a2e,16213e,0f3460`;

  const favItems = favorites.map((f) => ({
    id: f.targetId,
    title: f.title,
    createdAt: f.createdAt,
    link: f.link,
    type: f.type,
  }));

  const tabs = [
    { label: "帖子", icon: MessageSquare, items: content?.posts, linkBase: "/discussion", emptyText: "还没有发表过讨论" },
    { label: "灵感", icon: Lightbulb, items: content?.ideas, linkBase: "/ideas", emptyText: "还没有分享过灵感", useDirectLink: true, linkField: "link" },
    { label: "资源", icon: BookOpen, items: content?.books, linkBase: "/library", emptyText: "还没有上传过资源" },
    { label: "协作", icon: Users, items: content?.workshops, linkBase: "/workshop", emptyText: "还没有发起过协作" },
    { label: "收藏", icon: Bookmark, items: favItems, linkBase: "", emptyText: "还没有收藏过内容", useDirectLink: true },
  ];

  return (
    <div className="min-h-screen pb-20">
      {/* 头部 */}
      <div className="relative overflow-hidden border-b border-void-600/40">
        <div className="absolute inset-0 bg-gradient-to-br from-void-900 via-void-950 to-void-900" />
        <div className="absolute -top-20 right-20 h-64 w-64 rounded-full bg-star-400/5 blur-3xl" />
        <div className="container-tj relative py-12">
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            {/* 头像 */}
            <div className="relative">
              <img
                src={avatar}
                alt={displayName}
                className="h-24 w-24 rounded-2xl border-2 border-star-400/30 bg-void-800 object-cover"
              />
              <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-void-600 bg-void-900">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
              </span>
            </div>

            {/* 信息 */}
            <div className="flex-1">
              {editing ? (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs text-mist-400">昵称</label>
                    <input
                      name="nickname"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      maxLength={20}
                      placeholder="输入你的昵称"
                      className="w-full max-w-xs rounded-lg border border-void-600 bg-void-800/60 px-3 py-2 text-sm text-parchment-100 outline-none focus:border-star-400/50"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs text-mist-400">选择头像</label>
                    <div className="flex flex-wrap items-center gap-2">
                      {DEFAULT_AVATARS.map((url) => (
                        <button
                          key={url}
                          onClick={() => setAvatarUrl(url)}
                          className={`h-12 w-12 overflow-hidden rounded-xl border-2 transition-all ${
                            avatarUrl === url ? "border-star-400" : "border-transparent opacity-60 hover:opacity-100"
                          }`}
                        >
                          <img src={url} alt="" className="h-full w-full" />
                        </button>
                      ))}
                      {/* 上传按钮 */}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-dashed border-void-600 text-mist-400 transition-all hover:border-star-400/50 hover:text-star-400 disabled:opacity-50"
                        title="上传自定义头像"
                      >
                        {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                      </button>
                      <input
                        name="avatar"
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        onChange={handleUploadAvatar}
                        className="hidden"
                      />
                    </div>
                    {uploading && <p className="mt-1.5 text-xs text-mist-500">上传中...</p>}
                    {avatarUrl && !DEFAULT_AVATARS.includes(avatarUrl) && (
                      <p className="mt-1.5 text-xs text-emerald-400">已选择自定义头像</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-1.5 rounded-lg bg-star-400 px-4 py-2 text-xs font-medium text-void-950 transition-colors hover:bg-star-300 disabled:opacity-50"
                    >
                      <Save size={14} /> {saving ? "保存中..." : "保存"}
                    </button>
                    <button
                      onClick={() => {
                        // 清理已上传但未保存的头像
                        if (newAvatarFileId) {
                          app.deleteFile({ fileList: [newAvatarFileId] }).catch(() => {});
                        }
                        setNewAvatarFileId(null);
                        setEditing(false);
                        setNickname(user.nickname ?? "");
                        setAvatarUrl(user.avatarUrl ?? "");
                      }}
                      className="flex items-center gap-1.5 rounded-lg border border-void-600 px-4 py-2 text-xs text-mist-300 hover:text-parchment-100"
                    >
                      <X size={14} /> 取消
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="heading-display text-3xl text-parchment-50">{displayName}</h1>
                  <p className="mt-1 text-sm text-mist-400">{user.email}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => setEditing(true)}
                      className="flex items-center gap-1.5 rounded-lg border border-void-600/60 bg-void-800/40 px-3 py-1.5 text-xs text-mist-300 transition-colors hover:border-star-400/40 hover:text-parchment-100"
                    >
                      <Edit3 size={13} /> 编辑资料
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 统计 */}
          {!loading && content && (
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                { label: "帖子", value: content.posts.length, icon: MessageSquare },
                { label: "灵感", value: content.ideas.length, icon: Lightbulb },
                { label: "资源", value: content.books.length, icon: BookOpen },
                { label: "协作", value: content.workshops.length, icon: Users },
                { label: "收藏", value: favorites.length, icon: Bookmark },
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
        {loading ? (
          <div className="py-20 text-center text-mist-400">加载中...</div>
        ) : (
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
                            to={"useDirectLink" in tab && tab.useDirectLink ? (item as { link: string }).link : `${tab.linkBase}/${item.id}`}
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
