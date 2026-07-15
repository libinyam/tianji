// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import Dialog from "./Dialog";

// 包装组件用于测试 open/close 状态切换
function DialogWrapper({ initialOpen = false }: { initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <>
      <button data-testid="trigger" onClick={() => setOpen(true)}>
        打开
      </button>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <button data-testid="inner-btn-1">第一个按钮</button>
        <button data-testid="inner-btn-2">第二个按钮</button>
      </Dialog>
    </>
  );
}

describe("Dialog（#323 a11y）", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.body.style.overflow = "";
  });

  afterEach(() => {
    document.body.style.overflow = "";
  });

  it("open=false 时不渲染弹窗内容", () => {
    render(<DialogWrapper />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("open=true 时渲染 role=dialog + aria-modal=true", () => {
    render(<DialogWrapper initialOpen />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("打开时 body 滚动锁定（overflow=hidden）", () => {
    render(<DialogWrapper initialOpen />);
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("关闭时恢复 body 滚动（overflow=''）", () => {
    const { rerender } = render(
      <Dialog open={true} onClose={() => {}}>
        <div>x</div>
      </Dialog>
    );
    expect(document.body.style.overflow).toBe("hidden");

    rerender(
      <Dialog open={false} onClose={() => {}}>
        <div>x</div>
      </Dialog>
    );
    expect(document.body.style.overflow).toBe("");
  });

  it("点击背景遮罩触发 onClose", () => {
    const onClose = vi.fn();
    render(
      <Dialog open={true} onClose={onClose}>
        <div>内容</div>
      </Dialog>
    );
    // 点击内容容器（背景遮罩层）
    const overlay = screen.getByRole("dialog").parentElement?.parentElement;
    expect(overlay).not.toBeNull();
    if (overlay) {
      fireEvent.mouseDown(overlay);
      fireEvent.click(overlay);
    }
    expect(onClose).toHaveBeenCalled();
  });

  it("preventClose=true 时点击背景不关闭", () => {
    const onClose = vi.fn();
    render(
      <Dialog open={true} onClose={onClose} preventClose>
        <div>内容</div>
      </Dialog>
    );
    const overlay = screen.getByRole("dialog").parentElement?.parentElement;
    if (overlay) fireEvent.click(overlay);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("按 Escape 触发 onClose", () => {
    const onClose = vi.fn();
    render(
      <Dialog open={true} onClose={onClose}>
        <div>内容</div>
      </Dialog>
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("preventClose=true 时按 Escape 不关闭", () => {
    const onClose = vi.fn();
    render(
      <Dialog open={true} onClose={onClose} preventClose>
        <div>内容</div>
      </Dialog>
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("aria-labelledby / aria-describedby 透传", () => {
    render(
      <Dialog
        open={true}
        onClose={() => {}}
        labelledById="dialog-title"
        describedById="dialog-desc"
      >
        <div>内容</div>
      </Dialog>
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-labelledby", "dialog-title");
    expect(dialog).toHaveAttribute("aria-describedby", "dialog-desc");
  });

  it("tabIndex=-1 使 dialog 可编程聚焦", () => {
    render(
      <Dialog open={true} onClose={() => {}}>
        <div>内容</div>
      </Dialog>
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("tabindex", "-1");
  });

  it("合并 maxWidthClass / paddingClass / opaque", () => {
    render(
      <Dialog
        open={true}
        onClose={() => {}}
        maxWidthClass="max-w-2xl"
        paddingClass="p-4"
        opaque
      >
        <div>内容</div>
      </Dialog>
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("max-w-2xl");
    expect(dialog.className).toContain("p-4");
    // opaque 时应用背景色 style
    expect(dialog.style.backgroundColor).not.toBe("");
  });
});
