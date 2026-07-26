import { useEffect, useRef, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** 弹窗标题，用于 aria-labelledby */
  labelledById?: string;
  /** 弹窗描述，用于 aria-describedby */
  describedById?: string;
  /** 加载中时禁止关闭 */
  preventClose?: boolean;
  /** 最大宽度 class，如 max-w-lg / max-w-2xl */
  maxWidthClass?: string;
  /** 内边距 class，默认 p-7 */
  paddingClass?: string;
  /** 是否强制不透明背景（card-surface 已是实色，此项仅作兼容保留） */
  opaque?: boolean;
  children: ReactNode;
}

/**
 * 共享无障碍弹窗组件
 *
 * 特性：
 * - role="dialog" + aria-modal="true"
 * - Tab/Shift+Tab 焦点陷阱
 * - Escape 关闭
 * - 打开时焦点移入弹窗，关闭时焦点恢复到触发元素
 * - body 滚动锁定
 */
export default function Dialog({
  open,
  onClose,
  labelledById,
  describedById,
  preventClose = false,
  maxWidthClass = "max-w-lg",
  paddingClass = "p-7",
  opaque = false,
  children,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // 打开时记录触发元素 + 锁定滚动
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement;
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // 打开时焦点移入弹窗
  useEffect(() => {
    if (open && dialogRef.current) {
      // 找到第一个可聚焦元素
      const focusable = dialogRef.current.querySelector<HTMLElement>(
        'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
      );
      // 延迟一帧确保 DOM 已渲染
      requestAnimationFrame(() => {
        focusable?.focus();
      });
    }
  }, [open]);

  // 关闭时焦点恢复
  const restoreFocus = useCallback(() => {
    if (triggerRef.current) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, []);

  // #424 motion 移除后无 onExitComplete 钩子，关闭即恢复焦点
  useEffect(() => {
    if (!open) restoreFocus();
  }, [open, restoreFocus]);

  // Escape 关闭
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !preventClose) {
        e.stopPropagation();
        onClose();
      }
      // 焦点陷阱
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [open, onClose, preventClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (preventClose) return;
    // 如果点击的不是弹窗内容本身，就关闭
    if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  if (!open) return null;

  // #424 进场动画由 CSS keyframes 实现（见 index.css），替代 motion 依赖（43KB gzip 首屏）
  return createPortal(
    <>
      {/* 背景遮罩：独立 fixed 元素，始终全屏覆盖 */}
      <div className="tj-animate-fade-in fixed inset-0 z-[100] bg-black/40" aria-hidden />
      {/* 内容容器：可滚动，内容短时居中，长时从顶部开始 */}
      <div className="fixed inset-0 z-[101] overflow-y-auto" onClick={handleBackdropClick}>
        <div className="flex min-h-full items-start justify-center px-4 py-8 sm:items-center sm:py-12">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledById}
            aria-describedby={describedById}
            tabIndex={-1}
            className={`tj-animate-dialog-in card-surface relative w-full ${maxWidthClass} ${paddingClass} outline-none ${opaque ? "!bg-void-900" : ""}`}
          >
            {children}
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
