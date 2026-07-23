import { useState, useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import StarField from "./StarField";
import AuthModal from "./AuthModal";
import { useAuthStore } from "@/stores/auth";
import { useThemeStore } from "@/stores/theme";
import { resolvePendingAction, usePendingAction } from "@/lib/pending-action";

/** 全局布局：深空背景 + 星点 + 导航 + 内容 + 页脚 + 登录弹窗。 */
export default function Layout() {
  const [authOpen, setAuthOpen] = useState(false);
  const initSession = useAuthStore((s) => s.initSession);
  const initTheme = useThemeStore((s) => s.initTheme);
  const themeMode = useThemeStore((s) => s.mode);
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
    <div className="grain relative min-h-screen bg-void-radial text-parchment-200">
      {/* 固定背景星点 - 浅色模式不渲染，移动端减少数量 */}
      {themeMode === "dark" && (
        <div className="pointer-events-none fixed inset-0 z-0">
          <StarField count={typeof window !== "undefined" && window.innerWidth < 768 ? 30 : 70} />
        </div>
      )}
      {/* 顶部辉光 */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[480px]"
        style={{
          background:
            themeMode === "dark"
              ? "radial-gradient(ellipse at 50% -20%, rgba(27,39,94,0.6), transparent 70%)"
              : "radial-gradient(ellipse at 50% -20%, rgba(180,190,240,0.4), transparent 70%)",
        }}
      />

      <div className="relative z-10 flex min-h-screen flex-col">
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
