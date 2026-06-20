import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X, Sparkles } from "lucide-react";

const NAV = [
  { to: "/", label: "首页", end: true },
  { to: "/library", label: "书籍资源库" },
  { to: "/discussion", label: "讨论区" },
  { to: "/ideas", label: "灵感广场" },
  { to: "/workshop", label: "协作工坊" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `relative text-sm transition-colors ${
      isActive ? "text-star-200" : "text-mist-300 hover:text-parchment-100"
    }`;

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
          <button className="text-sm text-mist-300 transition-colors hover:text-parchment-100">
            登录
          </button>
          <Link to="/workshop" className="btn-gold">
            加入星辰
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-void-600/60 text-mist-300 lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="切换菜单"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
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
            <Link
              to="/workshop"
              onClick={() => setOpen(false)}
              className="btn-gold mt-3"
            >
              加入星辰
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
