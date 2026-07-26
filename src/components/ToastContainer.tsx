import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { useToastStore, type ToastType } from "@/stores/toast";

const ICONS: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const STYLES: Record<ToastType, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-red-200 bg-red-50 text-red-800",
  info: "border-void-600 bg-void-900 text-parchment-100",
};

const ICON_COLORS: Record<ToastType, string> = {
  success: "text-emerald-500",
  error: "text-red-500",
  info: "text-tian-500",
};

export default function ToastContainer() {
  const { toasts, dismiss } = useToastStore();

  return (
    // #422 aria-live 让读屏用户听到操作反馈；容器级 status 覆盖所有 toast 的进出
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-6 right-6 z-[9999] flex flex-col gap-2"
    >
      {/* #424 进场动画由 CSS keyframes 实现，替代 motion 依赖 */}
      {toasts.map((t) => {
        const Icon = ICONS[t.type];
        return (
          <div
            key={t.id}
            role={t.type === "error" ? "alert" : undefined}
            className={`tj-animate-toast-in pointer-events-auto flex items-center gap-2.5 rounded-lg border px-4 py-3 text-sm shadow-sm ${STYLES[t.type]}`}
          >
            <Icon size={16} className={`shrink-0 ${ICON_COLORS[t.type]}`} />
            <span className="max-w-xs">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="关闭通知"
              className="ml-2 shrink-0 opacity-50 transition-opacity hover:opacity-100"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
