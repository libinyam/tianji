import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import ScrollToTop from "@/components/ScrollToTop";
import Home from "@/pages/Home";
import Library from "@/pages/Library";
import BookDetail from "@/pages/BookDetail";
import Discussion from "@/pages/Discussion";
import DiscussionDetail from "@/pages/DiscussionDetail";
import Ideas from "@/pages/Ideas";
import Workshop from "@/pages/Workshop";
import WorkshopDetail from "@/pages/WorkshopDetail";
import Profile from "@/pages/Profile";
import UserProfile from "@/pages/UserProfile";

export default function App() {
  return (
    <Router>
      <ScrollToTop />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/library" element={<Library />} />
          <Route path="/library/:id" element={<BookDetail />} />
          <Route path="/discussion" element={<Discussion />} />
          <Route path="/discussion/:id" element={<DiscussionDetail />} />
          <Route path="/ideas" element={<Ideas />} />
          <Route path="/workshop" element={<Workshop />} />
          <Route path="/workshop/:id" element={<WorkshopDetail />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/user/:uid" element={<UserProfile />} />
          <Route
            path="*"
            element={
              <div className="container-tj py-40 text-center">
                <p className="heading-display text-3xl text-parchment-50">迷失在星海</p>
                <p className="mt-3 text-mist-400">你访问的页面不存在，或许它还在被某个星辰书写。</p>
              </div>
            }
          />
        </Route>
      </Routes>
    </Router>
  );
}
