// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import Avatar from "./Avatar";

afterEach(() => {
  cleanup();
});

describe("Avatar（#323）", () => {
  it("渲染首字符", () => {
    render(<Avatar name="张三" />);
    expect(screen.getByText("张")).toBeInTheDocument();
  });

  it("title 属性为完整 name", () => {
    render(<Avatar name="李四" />);
    const el = screen.getByTitle("李四");
    expect(el).toBeInTheDocument();
  });

  it("应用默认 color #7cc4ff 到 background 渐变", () => {
    const { container } = render(<Avatar name="x" />);
    const el = container.firstChild as HTMLElement;
    // jsdom 会把 hex 转为 rgb 格式
    expect(el.style.background).toContain("linear-gradient");
    expect(el.style.background).toContain("124, 196, 255");
  });

  it("自定义 color 应用到 background", () => {
    const { container } = render(<Avatar name="x" color="#ff0000" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.background).toContain("255, 0, 0");
  });

  it("size 应用到 width/height/fontSize", () => {
    const { container } = render(<Avatar name="x" size={48} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe("48px");
    expect(el.style.height).toBe("48px");
    // fontSize = size * 0.42
    expect(el.style.fontSize).toBe("20.16px");
  });

  it("默认 size=32", () => {
    const { container } = render(<Avatar name="x" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe("32px");
  });

  it("空字符串 name 渲染空首字符", () => {
    const { container } = render(<Avatar name="" />);
    // 不会抛错，DOM 中存在 span
    expect(container.firstChild).not.toBeNull();
  });

  it("合并外部 className", () => {
    const { container } = render(<Avatar name="x" className="ml-2" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("ml-2");
  });
});
