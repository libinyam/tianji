// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import DifficultyDots from "./DifficultyDots";

afterEach(() => {
  cleanup();
});

describe("DifficultyDots（#323）", () => {
  it("渲染指定 max 个圆点", () => {
    const { container } = render(<DifficultyDots level={3} max={5} />);
    const dots = container.querySelectorAll("span > span");
    expect(dots).toHaveLength(5);
  });

  it("aria-label 标注难度等级", () => {
    render(<DifficultyDots level={2} max={5} />);
    expect(screen.getByLabelText("难度 2/5")).toBeInTheDocument();
  });

  it("默认 max=5", () => {
    const { container } = render(<DifficultyDots level={4} />);
    const dots = container.querySelectorAll("span > span");
    expect(dots).toHaveLength(5);
  });

  it("已点亮圆点为金色 #f3c969", () => {
    const { container } = render(<DifficultyDots level={3} max={5} />);
    const dots = container.querySelectorAll("span > span");
    // jsdom 会把 hex 转为 rgb 格式
    const gold = "rgb(243, 201, 105)";
    expect((dots[0] as HTMLElement).style.background).toBe(gold);
    expect((dots[1] as HTMLElement).style.background).toBe(gold);
    expect((dots[2] as HTMLElement).style.background).toBe(gold);
  });

  it("未点亮圆点为暗蓝 #1b275e", () => {
    const { container } = render(<DifficultyDots level={2} max={5} />);
    const dots = container.querySelectorAll("span > span");
    const dark = "rgb(27, 39, 94)";
    expect((dots[2] as HTMLElement).style.background).toBe(dark);
    expect((dots[3] as HTMLElement).style.background).toBe(dark);
    expect((dots[4] as HTMLElement).style.background).toBe(dark);
  });

  it("点亮圆点带 boxShadow 光晕", () => {
    const { container } = render(<DifficultyDots level={1} max={5} />);
    const dots = container.querySelectorAll("span > span");
    expect((dots[0] as HTMLElement).style.boxShadow).not.toBe("none");
    expect((dots[1] as HTMLElement).style.boxShadow).toBe("none");
  });

  it("level=0 时全部不点亮", () => {
    const { container } = render(<DifficultyDots level={0} max={3} />);
    const dots = container.querySelectorAll("span > span");
    dots.forEach((d) => {
      expect((d as HTMLElement).style.background).toBe("rgb(27, 39, 94)");
    });
  });

  it("level=max 时全部点亮", () => {
    const { container } = render(<DifficultyDots level={5} max={5} />);
    const dots = container.querySelectorAll("span > span");
    dots.forEach((d) => {
      expect((d as HTMLElement).style.background).toBe("rgb(243, 201, 105)");
    });
  });

  it("合并外部 className", () => {
    const { container } = render(<DifficultyDots level={1} className="mt-2" />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain("mt-2");
  });
});
