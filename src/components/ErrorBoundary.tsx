import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
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
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-void-950 text-parchment-100">
          <h1 className="text-2xl font-bold">页面出错了</h1>
          <p className="text-mist-400">
            {this.state.error?.message || "发生未知错误"}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-star-400 px-6 py-2 text-sm font-medium text-void-950 transition hover:bg-star-300"
          >
            刷新页面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
