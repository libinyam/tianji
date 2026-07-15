// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { useDocumentTitle, buildPageTitle, BASE_TITLE } from "./useDocumentTitle";

afterEach(() => {
  cleanup();
  document.title = "";
});

function HookHost({ title }: { title?: string }) {
  useDocumentTitle(title);
  return null;
}

describe("buildPageTitle（#353）", () => {
  it("无 title 时返回站点默认标题", () => {
    expect(buildPageTitle(undefined)).toBe(BASE_TITLE);
    expect(buildPageTitle("")).toBe(BASE_TITLE);
  });

  it("普通 title 追加「 · 天玑」后缀", () => {
    expect(buildPageTitle("成长路径")).toBe("成长路径 · 天玑");
    expect(buildPageTitle("讨论标题")).toBe("讨论标题 · 天玑");
  });

  it("title 已包含「天玑」时不重复追加品牌名", () => {
    expect(buildPageTitle("天玑使用指南")).toBe("天玑使用指南");
    expect(buildPageTitle("天玑 · 学习路径")).toBe("天玑 · 学习路径");
  });

  it("title 包含部分「天玑」子串也算重复（如「天玑社区」）", () => {
    expect(buildPageTitle("天玑社区问答")).toBe("天玑社区问答");
  });
});

describe("useDocumentTitle hook（#353）", () => {
  it("设置 document.title 为「页面名 · 天玑」", () => {
    render(<HookHost title="个人主页" />);
    expect(document.title).toBe("个人主页 · 天玑");
  });

  it("不传 title 时设置默认站点标题", () => {
    render(<HookHost />);
    expect(document.title).toBe(BASE_TITLE);
  });

  it("title 已包含「天玑」时不重复追加", () => {
    render(<HookHost title="天玑成长路径" />);
    expect(document.title).toBe("天玑成长路径");
    expect(document.title).not.toContain("天玑 · 天玑");
  });

  it("title 切换后 document.title 同步更新", () => {
    const { rerender } = render(<HookHost title="页面A" />);
    expect(document.title).toBe("页面A · 天玑");
    rerender(<HookHost title="天玑页面B" />);
    expect(document.title).toBe("天玑页面B");
  });

  it("组件卸载后还原默认站点标题", () => {
    const { unmount } = render(<HookHost title="临时页面" />);
    expect(document.title).toBe("临时页面 · 天玑");
    unmount();
    expect(document.title).toBe(BASE_TITLE);
  });
});
