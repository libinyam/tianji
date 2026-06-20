import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import StarField from "./StarField";

/** 全局布局：深空背景 + 星点 + 导航 + 内容 + 页脚。 */
export default function Layout() {
  return (
    <div className="grain relative min-h-screen bg-void-radial text-parchment-200">
      {/* 固定背景星点 */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <StarField count={70} />
      </div>
      {/* 顶部冷蓝辉光 */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[480px] bg-[radial-gradient(ellipse_at_50%_-20%,rgba(27,39,94,0.6),transparent_70%)]" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
}
