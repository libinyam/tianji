// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import ErrorBoundary from "./ErrorBoundary";

// vi.mock 会被提升到顶部，必须用 vi.hoisted 才能在工厂中引用
const { captureException } = vi.hoisted(() => ({
  captureException: vi.fn(),
}));

vi.mock("@/lib/sentry", () => ({
  Sentry: {
    captureException,
  },
}));

// 制造错误子组件（return null 让 TS 推断为合法 ReactNode 返回类型）
function Boom({ message }: { message: string }) {
  throw new Error(message);
  return null; // unreachable — 仅为满足 TS 返回类型推断
}

beforeEach(() => {
  captureException.mockClear();
  // 隔离 console.error，避免测试输出被 React 错误日志污染
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe("ErrorBoundary（#191）", () => {
  it("无错误时正常渲染 children", () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">正常内容</div>
      </ErrorBoundary>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("子组件抛错时渲染兜底 UI", () => {
    render(
      <ErrorBoundary>
        <Boom message="渲染失败" />
      </ErrorBoundary>
    );
    expect(screen.getByText("页面出错了")).toBeInTheDocument();
    expect(screen.getByText("渲染失败")).toBeInTheDocument();
  });

  it("崩溃时调用 Sentry.captureException", () => {
    render(
      <ErrorBoundary>
        <Boom message="sentinel-error" />
      </ErrorBoundary>
    );
    expect(captureException).toHaveBeenCalledTimes(1);
    const captured = captureException.mock.calls[0][0] as Error;
    expect(captured.message).toBe("sentinel-error");
  });

  it("非 chunk 错误显示刷新按钮", () => {
    render(
      <ErrorBoundary>
        <Boom message="普通错误" />
      </ErrorBoundary>
    );
    expect(screen.getByRole("button", { name: "刷新页面" })).toBeInTheDocument();
  });

  it("点击刷新按钮触发 window.location.reload", () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { reload } as unknown as Location);
    render(
      <ErrorBoundary>
        <Boom message="x" />
      </ErrorBoundary>
    );
    fireEvent.click(screen.getByRole("button", { name: "刷新页面" }));
    expect(reload).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it("chunk 加载错误显示“正在刷新页面…”", () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { reload } as unknown as Location);
    render(
      <ErrorBoundary>
        <Boom message="Failed to fetch dynamically imported module: /foo.js" />
      </ErrorBoundary>
    );
    expect(screen.getByText("正在刷新页面…")).toBeInTheDocument();
    expect(screen.getByText("网站已更新，正在加载最新版本")).toBeInTheDocument();
    // chunk 错误不显示刷新按钮（自动刷新中）
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("Loading chunk 错误也触发自动刷新逻辑", () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { reload } as unknown as Location);
    render(
      <ErrorBoundary>
        <Boom message="Loading chunk 42 failed." />
      </ErrorBoundary>
    );
    expect(reload).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it("10 秒内不重复刷新（sessionStorage 防抖）", () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { reload } as unknown as Location);
    // 第一次崩溃：应刷新
    const { unmount } = render(
      <ErrorBoundary>
        <Boom message="Loading CSS chunk 1 failed." />
      </ErrorBoundary>
    );
    expect(reload).toHaveBeenCalledTimes(1);
    unmount();

    // 第二次崩溃（在 10s 内）：不应再次刷新
    render(
      <ErrorBoundary>
        <Boom message="Loading CSS chunk 2 failed." />
      </ErrorBoundary>
    );
    expect(reload).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it("超过 10 秒后允许再次刷新", () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { reload } as unknown as Location);
    // 模拟 11 秒前已刷新过
    sessionStorage.setItem("tianji:reloaded", String(Date.now() - 11000));
    render(
      <ErrorBoundary>
        <Boom message="Loading chunk 99 failed." />
      </ErrorBoundary>
    );
    expect(reload).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
