import { useEffect, useRef, useCallback, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";

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
        'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
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
          'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
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
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <AnimatePresence onExitComplete={restoreFocus}>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={handleBackdropClick}
        >
          <div
            className="absolute inset-0 bg-void-950/80 backdrop-blur-sm"
            onClick={handleBackdropClick}
          />

          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledById}
            aria-describedby={describedById}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.25 }}
            className={`card-surface grain relative w-full ${maxWidthClass} ${paddingClass} outline-none`}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
