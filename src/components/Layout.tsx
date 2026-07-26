import { useState, useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import AuthModal from "./AuthModal";
import { useAuthStore } from "@/stores/auth";
import { useThemeStore } from "@/stores/theme";
import { resolvePendingAction, usePendingAction } from "@/lib/pending-action";

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
    window.addEventListener("tianji:open-auth", openAuth);
    return () => window.removeEventListener("tianji:open-auth", openAuth);
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
      <div className="flex min-h-screen flex-col">
        <Navbar onLoginClick={() => setAuthOpen(true)} />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
      </div>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
