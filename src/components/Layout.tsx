import { useState, useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import AuthModal from "./AuthModal";
import { useAuthStore } from "@/stores/auth";
import { useThemeStore } from "@/stores/theme";
import { resolvePendingAction, usePendingAction, OPEN_AUTH_EVENT } from "@/lib/pending-action";

/** 全局布局：导航 + 内容 + 页脚 + 登录弹窗。 */
export default function Layout() {
  const [authOpen, setAuthOpen] = useState(false);
  const initSession = useAuthStore((s) => s.initSession);
  const initTheme = useThemeStore((s) => s.initTheme);
  const user = useAuthStore((s) => s.user);
  const pending = usePendingAction((s) => s.pending);
  const navigate = useNavigate();

  useEffect(() => {
    void initSession();
    initTheme();
  }, [initSession, initTheme]);

  useEffect(() => {
    const openAuth = () => setAuthOpen(true);
    window.addEventListener(OPEN_AUTH_EVENT, openAuth);
    return () => window.removeEventListener(OPEN_AUTH_EVENT, openAuth);
  }, []);

  useEffect(() => {
    if (user && pending) {
      const route = resolvePendingAction();
      if (route) {
        navigate(route);
      }
    }
  }, [user, pending, navigate]);

  return (
    <div className="min-h-screen bg-void-950 text-parchment-200">
      {/* #422 skip link：键盘用户跳过整个导航直达正文，仅聚焦时可见 */}
      <a
        href="#main"
        className="sr-only z-[10000] rounded-md bg-tian-500 px-3 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        跳到主内容
      </a>
      <div className="flex min-h-screen flex-col">
        <Navbar onLoginClick={() => setAuthOpen(true)} />
        <main id="main" className="flex-1">
          <Outlet />
        </main>
        <Footer />
      </div>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
