import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import ScrollToTop from "@/components/ScrollToTop";
import Home from "@/pages/Home";

// 路由级懒加载 — 首屏只加载 Home，其余按需加载
const Library = lazy(() => import("@/pages/Library"));
const BookDetail = lazy(() => import("@/pages/BookDetail"));
const Discussion = lazy(() => import("@/pages/Discussion"));
const DiscussionDetail = lazy(() => import("@/pages/DiscussionDetail"));
const Ideas = lazy(() => import("@/pages/Ideas"));
const Workshop = lazy(() => import("@/pages/Workshop"));
const WorkshopDetail = lazy(() => import("@/pages/WorkshopDetail"));
const Profile = lazy(() => import("@/pages/Profile"));
const UserProfile = lazy(() => import("@/pages/UserProfile"));
const TagDetail = lazy(() => import("@/pages/TagDetail"));
const Admin = lazy(() => import("@/pages/Admin"));

// 页面加载骨架
function PageFallback() {
  return (
    <div className="container-tj flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-mist-700 border-t-star-400" />
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
    </Router>
  );
}
