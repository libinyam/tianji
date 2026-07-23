import { Component, type ReactNode } from "react";
import { Sentry } from "../lib/sentry";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

// 检测是否为资源加载失败导致的崩溃
function isChunkLoadError(error: Error): boolean {
  const msg = error.message || "";
  return (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Importing a module script failed") ||
    msg.includes("error loading dynamically imported module") ||
    msg.includes("Loading chunk") ||
    msg.includes("Loading CSS chunk")
  );
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error("应用崩溃:", error, info);

    Sentry.captureException(error, { extra: { reactInfo: info } });

    // 资源加载失败 -> 自动刷新（10 秒内只刷新一次，防止无限循环）
    if (isChunkLoadError(error)) {
      const KEY = "tianji:reloaded";
      const now = Date.now();
      const last = parseInt(sessionStorage.getItem(KEY) || "0", 10);
      if (now - last > 10000) {
        sessionStorage.setItem(KEY, String(now));
        window.location.reload();
      }
    }
  }

  render() {
    if (this.state.hasError) {
      const isChunkError = this.state.error && isChunkLoadError(this.state.error);

      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-void-950 text-parchment-100">
          <h1 className="text-2xl font-bold">
            {isChunkError ? "正在刷新页面…" : "页面出错了"}
          </h1>
          <p className="text-mist-400">
            {isChunkError
              ? "网站已更新，正在加载最新版本"
              : this.state.error?.message || "发生未知错误"}
          </p>
          {!isChunkError && (
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg bg-star-400 px-6 py-2 text-sm font-medium text-void-950 transition hover:bg-star-300"
            >
              刷新页面
            </button>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
