import { lazy, Suspense, type ComponentType } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import ScrollToTop from "@/components/ScrollToTop";
import ToastContainer from "@/components/ToastContainer";
import Home from "@/pages/Home";

/**
 * 包装 lazy，捕获动态 import 失败（新部署后旧 chunk hash 失效）自动刷新页面。
 * 刷新后浏览器获取最新 index.html，引用正确的 chunk 文件名。
 */
function lazyWithReload<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(() =>
    factory().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes("Failed to fetch dynamically imported module") ||
        msg.includes("Importing a module script failed") ||
        msg.includes("error loading dynamically imported module")
      ) {
        window.location.reload();
      }
      throw err;
    })
  );
}

// 路由级懒加载 — 首屏只加载 Home，其余按需加载
const Library = lazyWithReload(() => import("@/pages/Library"));
const BookDetail = lazyWithReload(() => import("@/pages/BookDetail"));
const Discussion = lazyWithReload(() => import("@/pages/Discussion"));
const DiscussionDetail = lazyWithReload(() => import("@/pages/DiscussionDetail"));
const Ideas = lazyWithReload(() => import("@/pages/Ideas"));
const Workshop = lazyWithReload(() => import("@/pages/Workshop"));
const WorkshopDetail = lazyWithReload(() => import("@/pages/WorkshopDetail"));
const Profile = lazyWithReload(() => import("@/pages/Profile"));
const UserProfile = lazyWithReload(() => import("@/pages/UserProfile"));
const TagDetail = lazyWithReload(() => import("@/pages/TagDetail"));
const Admin = lazyWithReload(() => import("@/pages/Admin"));

// 页面加载骨架
function PageFallback() {
  return (
    <div className="container-tj py-8">
      <div className="space-y-4">
        <div className="animate-pulse rounded bg-void-700/50 h-8 w-64" />
        <div className="animate-pulse rounded bg-void-700/50 h-4 w-full" />
        <div className="animate-pulse rounded bg-void-700/50 h-4 w-5/6" />
        <div className="mt-6 space-y-3">
          <div className="animate-pulse rounded-xl bg-void-700/50 h-28 w-full" />
          <div className="animate-pulse rounded-xl bg-void-700/50 h-28 w-full" />
          <div className="animate-pulse rounded-xl bg-void-700/50 h-28 w-full" />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <ScrollToTop />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route
            path="*"
            element={
              <Suspense fallback={<PageFallback />}>
                <Routes>
                  <Route path="/library" element={<Library />} />
                  <Route path="/library/:id" element={<BookDetail />} />
                  <Route path="/discussion" element={<Discussion />} />
                  <Route path="/discussion/:id" element={<DiscussionDetail />} />
                  <Route path="/ideas" element={<Ideas />} />
                  <Route path="/workshop" element={<Workshop />} />
                  <Route path="/workshop/:id" element={<WorkshopDetail />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/user/:uid" element={<UserProfile />} />
                  <Route path="/tags/:name" element={<TagDetail />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route
                    path="*"
                    element={
                      <div className="container-tj py-40 text-center">
                        <p className="heading-display text-3xl text-parchment-50">迷失在星海</p>
                        <p className="mt-3 text-mist-400">你访问的页面不存在，或许它还在被某个星辰书写。</p>
                      </div>
                    }
                  />
                </Routes>
              </Suspense>
            }
          />
        </Route>
      </Routes>
      <ToastContainer />
    </Router>
  );
}
