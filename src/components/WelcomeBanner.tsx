import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, X } from "lucide-react";
import { useAuthStore } from "@/stores/auth";

const STORAGE_KEY = "tianji:welcome-dismissed";

/**
 * 首页帖子流顶部的新访客欢迎横幅（linux.do 式）。
 * 仅未登录且未关闭过时显示；登录成功后自动标记关闭，
 * 避免已登录用户在会话检查完成前看到横幅闪现。
 */
export default function WelcomeBanner() {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(STORAGE_KEY) === "1"
  );
  const { user } = useAuthStore();

  // 登录过的设备不再展示
  useEffect(() => {
    if (user && !dismissed) {
      localStorage.setItem(STORAGE_KEY, "1");
      setDismissed(true);
    }
  }, [user, dismissed]);

  if (dismissed || user) return null;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  };

  return (
    <div className="mb-4 flex items-start gap-3 rounded-md border border-star-400/20 bg-star-400/5 px-3 py-2.5 text-sm">
      <Sparkles size={14} className="mt-0.5 shrink-0 text-star-300" />
      <div className="min-w-0 flex-1">
        <span className="text-parchment-100">欢迎来到天玑</span>
        <span className="text-mist-400">
          {" "}
          — 跨专业 AI 学习与项目共创社区。在这里答疑解惑、交流灵感、协作产出。
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-3 text-xs">
          <Link to="/about" className="text-star-300 transition-colors hover:text-star-200">
            了解天玑 →
          </Link>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("tianji:open-auth"))}
            className="text-mist-400 transition-colors hover:text-parchment-100"
          >
            登录 / 注册
          </button>
        </span>
      </div>
      <button
        onClick={dismiss}
        className="shrink-0 text-mist-500 hover:text-mist-300"
        aria-label="关闭欢迎横幅"
      >
        <X size={12} />
      </button>
    </div>
  );
}
