import { useState, useEffect } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X, Sparkles, LogOut, User as UserIcon, Search, Sun, Moon, Shield } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { useThemeStore } from "@/stores/theme";
import { useIsAdmin } from "@/lib/admin";
import SearchModal from "./SearchModal";
import NotificationBell from "./NotificationBell";

const NAV = [
  { to: "/", label: "首页", end: true },
  { to: "/library", label: "资源库" },
  { to: "/discussion", label: "讨论区" },
  { to: "/ideas", label: "灵感广场" },
  { to: "/workshop", label: "协作工坊" },
];

interface NavbarProps {
  onLoginClick: () => void;
}

export default function Navbar({ onLoginClick }: NavbarProps) {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { user, signOut } = useAuthStore();
  const { mode, toggle } = useThemeStore();
  const isAdmin = useIsAdmin();

  // 全局快捷键 Cmd/Ctrl + K 打开搜索
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `relative text-sm transition-colors ${
      isActive ? "text-star-200" : "text-mist-300 hover:text-parchment-100"
    }`;

  const displayName = user?.nickname || user?.username || user?.email || "成员";

  const handleSignOut = async () => {
    await signOut();
    setOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-void-600/40 bg-void-950/70 backdrop-blur-xl">
      <nav className="container-tj flex h-16 items-center justify-between">
        {/* Logo */}
        <Link to="/" className="group flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="relative flex h-8 w-8 items-center justify-center">
            <span className="absolute inset-0 rounded-lg bg-star-glow opacity-60 blur-md transition-opacity group-hover:opacity-100" />
            <Sparkles className="relative h-5 w-5 text-star-400" strokeWidth={1.5} />
          </span>
          <span className="heading-display text-xl text-parchment-50">
            天<span className="text-star-400">玑</span>
          </span>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.3em] text-mist-500 sm:inline">
            Tianji
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-7 lg:flex">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
              {({ isActive }) => (
                <>
                  {item.label}
                  {isActive && (
                    <span className="absolute -bottom-1 left-0 h-px w-full bg-gradient-to-r from-transparent via-star-400 to-transparent" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          {/* 搜索按钮 */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-void-600/50 bg-void-800/40 px-3 py-1.5 text-xs text-mist-500 transition-colors hover:border-star-400/40 hover:text-mist-300"
            title="搜索 (Ctrl+K)"
          >
            <Search size={14} />
            <span className="hidden xl:inline">搜索…</span>
            <kbd className="hidden rounded border border-void-600 px-1 font-mono text-[9px] xl:inline">
              ⌘K
            </kbd>
          </button>

          {/* 主题切换 */}
          <button
            onClick={toggle}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-void-600/50 bg-void-800/40 text-mist-400 transition-colors hover:border-star-400/40 hover:text-star-300"
            title={mode === "dark" ? "切换到浅色模式" : "切换到深色模式"}
          >
            {mode === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* 通知铃铛 */}
          {user && <NotificationBell />}
          {isAdmin && (
            <Link
              to="/admin"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-tian-400/30 bg-tian-400/10 text-tian-300 transition-colors hover:bg-tian-400/20"
              title="管理后台"
            >
              <Shield size={16} />
            </Link>
          )}

          {user ? (
            <div className="flex items-center gap-3">
              <Link
                to="/profile"
                className="flex items-center gap-2 rounded-lg border border-void-600/50 bg-void-800/40 px-3 py-1.5 transition-colors hover:border-star-400/40"
                title="个人主页"
              >
                <UserIcon size={14} className="text-star-400" />
                <span className="max-w-[140px] truncate text-xs text-parchment-100">
                  {displayName}
                </span>
              </Link>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 text-xs text-mist-400 transition-colors hover:text-red-300"
                title="退出登录"
              >
                <LogOut size={14} /> 退出
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={onLoginClick}
                className="text-sm text-mist-300 transition-colors hover:text-parchment-100"
              >
                登录
              </button>
              <button onClick={onLoginClick} className="btn-gold">
                加入星辰
              </button>
            </>
          )}
        </div>

        {/* Mobile: theme + search + menu toggle */}
        <div className="flex items-center gap-2 lg:hidden">
          <button
            onClick={toggle}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-void-600/60 text-mist-300"
            aria-label="切换主题"
          >
            {mode === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            onClick={() => setSearchOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-void-600/60 text-mist-300"
            aria-label="搜索"
          >
            <Search size={18} />
          </button>
          {user && <NotificationBell />}
          <button
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-void-600/60 text-mist-300"
            onClick={() => setOpen((v) => !v)}
            aria-label="切换菜单"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {open && (
        <div className="border-t border-void-600/40 bg-void-950/95 lg:hidden">
          <div className="container-tj flex flex-col gap-1 py-4">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    isActive
                      ? "bg-star-400/10 text-star-200"
                      : "text-mist-300 hover:bg-void-800/60"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            {user ? (
              <>
                <NavLink
                  to="/profile"
                  end
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2.5 text-sm transition-colors ${
                      isActive
                        ? "bg-star-400/10 text-star-200"
                        : "text-mist-300 hover:bg-void-800/60"
                    }`
                  }
                >
                  <span className="flex items-center gap-2">
                    <UserIcon size={14} /> 个人主页
                  </span>
                </NavLink>
                {isAdmin && (
                  <NavLink
                    to="/admin"
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                        isActive
                          ? "bg-tian-400/15 text-tian-200"
                          : "text-mist-300 hover:bg-void-800/50 hover:text-parchment-100"
                      }`
                    }
                  >
                    <Shield size={14} /> 管理后台
                  </NavLink>
                )}
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-void-600/50 bg-void-800/40 px-3 py-2.5">
                  <UserIcon size={14} className="text-star-400" />
                  <span className="truncate text-sm text-parchment-100">{displayName}</span>
                </div>
                <button
                  onClick={handleSignOut}
                  className="mt-1 flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm text-mist-400 transition-colors hover:text-red-300"
                >
                  <LogOut size={14} /> 退出登录
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setOpen(false);
                  onLoginClick();
                }}
                className="btn-gold mt-3"
              >
                登录 / 注册
              </button>
            )}
          </div>
        </div>
      )}
      
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
