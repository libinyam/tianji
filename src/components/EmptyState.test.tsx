// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import EmptyState from "./EmptyState";

afterEach(() => {
  cleanup();
});

describe("EmptyState（#323）", () => {
  it("渲染默认 icon（Sparkles）+ title + description", () => {
    render(<EmptyState title="暂无数据" description="还没有任何内容" />);
    expect(screen.getByText("暂无数据")).toBeInTheDocument();
    expect(screen.getByText("还没有任何内容")).toBeInTheDocument();
  });

  it("渲染自定义 icon", () => {
    render(
      <EmptyState
        title="空"
        description="d"
        icon={<span data-testid="custom-icon">ICON</span>}
      />
    );
    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
  });

  it("不传 actionText/onAction 时不渲染按钮", () => {
    render(<EmptyState title="t" description="d" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("传 actionText + onAction 时渲染按钮并响应点击", () => {
    const onAction = vi.fn();
    render(
      <EmptyState title="t" description="d" actionText="新增" onAction={onAction} />
    );
    const btn = screen.getByRole("button", { name: "新增" });
    fireEvent.click(btn);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("只传 actionText 不传 onAction 时不渲染按钮", () => {
    // actionText && onAction 必须同时存在
    render(<EmptyState title="t" description="d" actionText="新增" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
