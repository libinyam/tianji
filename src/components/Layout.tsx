import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import StarField from "./StarField";
import AuthModal from "./AuthModal";
import { useAuthStore } from "@/stores/auth";

/** 全局布局：深空背景 + 星点 + 导航 + 内容 + 页脚 + 登录弹窗。 */
export default function Layout() {
  const [authOpen, setAuthOpen] = useState(false);
  const initSession = useAuthStore((s) => s.initSession);

  // 应用启动时检查登录会话
  useEffect(() => {
    void initSession();
  }, [initSession]);

  // 监听全局登录事件（发帖、回答等场景触发）
  useEffect(() => {
    const openAuth = () => setAuthOpen(true);
    window.addEventListener("tianji:open-auth", openAuth);
    return () => window.removeEventListener("tianji:open-auth", openAuth);
  }, []);

  return (
    <div className="grain relative min-h-screen bg-void-radial text-parchment-200">
      {/* 固定背景星点 */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <StarField count={70} />
      </div>
      {/* 顶部冷蓝辉光 */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[480px] bg-[radial-gradient(ellipse_at_50%_-20%,rgba(27,39,94,0.6),transparent_70%)]" />

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
