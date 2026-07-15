// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import {
  Skeleton,
  PostCardSkeleton,
  BookCardSkeleton,
  IdeaCardSkeleton,
  WorkshopCardSkeleton,
  PostDetailSkeleton,
  ListSkeleton,
} from "./Skeleton";

afterEach(() => {
  cleanup();
});

describe("Skeleton（#323）", () => {
  it("Skeleton 渲染基础块并合并 className", () => {
    const { container } = render(<Skeleton className="h-4 w-20" />);
    const el = container.firstChild as HTMLElement;
    expect(el).toBeInTheDocument();
    expect(el.className).toContain("animate-pulse");
    expect(el.className).toContain("h-4");
    expect(el.className).toContain("w-20");
  });

  it("PostCardSkeleton 渲染多个占位块", () => {
    const { container } = render(<PostCardSkeleton />);
    const skeletons = container.querySelectorAll(".animate-pulse");
    // 头像/标题/副标题/标签 + 4 行正文 + 3 个底部 stat = ≥8
    expect(skeletons.length).toBeGreaterThanOrEqual(8);
  });

  it("BookCardSkeleton 渲染封面 + 文本占位", () => {
    const { container } = render(<BookCardSkeleton />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("IdeaCardSkeleton 渲染占位", () => {
    const { container } = render(<IdeaCardSkeleton />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("WorkshopCardSkeleton 渲染占位", () => {
    const { container } = render(<WorkshopCardSkeleton />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("PostDetailSkeleton 渲染长页面骨架", () => {
    const { container } = render(<PostDetailSkeleton />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(5);
  });

  it("ListSkeleton 按 count 重复渲染子元素", () => {
    render(
      <ListSkeleton count={3}>
        <div data-testid="item">x</div>
      </ListSkeleton>
    );
    expect(screen.getAllByTestId("item")).toHaveLength(3);
  });

  it("ListSkeleton 默认 count=4", () => {
    render(
      <ListSkeleton>
        <div data-testid="item">x</div>
      </ListSkeleton>
    );
    expect(screen.getAllByTestId("item")).toHaveLength(4);
  });
});
