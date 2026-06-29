import { create } from "zustand";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastState {
  toasts: ToastItem[];
  show: (type: ToastType, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  dismiss: (id: string) => void;
}

let counter = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show: (type, message) => {
    const id = `toast-${++counter}-${Date.now()}`;
    set((state) => ({ toasts: [...state.toasts, { id, type, message }] }));
    // 3秒后自动消失
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 3000);
  },
  success: (message) => useToastStore.getState().show("success", message),
  error: (message) => useToastStore.getState().show("error", message),
  info: (message) => useToastStore.getState().show("info", message),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/** 便捷函数：无需 hook 即可调用 */
export const toast = {
  success: (msg: string) => useToastStore.getState().success(msg),
  error: (msg: string) => useToastStore.getState().error(msg),
  info: (msg: string) => useToastStore.getState().info(msg),
};
