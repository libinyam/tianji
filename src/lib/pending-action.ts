import { create } from "zustand";

export interface PendingAction {
  intent: string;
  targetId?: string;
  createdAt: number;
}

interface PendingActionState {
  pending: PendingAction | null;
  setPending: (action: PendingAction | null) => void;
  clear: () => void;
}

export const usePendingAction = create<PendingActionState>((set) => ({
  pending: null,
  setPending: (action) => set({ pending: action }),
  clear: () => set({ pending: null }),
}));

const INTENT_ROUTES: Record<string, string> = {
  "create-post": "/discussion/new",
  "upload-resource": "/library/upload",
  "share-idea": "/ideas/new",
  "create-workshop": "/workshop/new",
};

/** 登录弹窗事件名（Layout 监听）。#427 组件请勿直接 dispatch 魔法字符串——
 *  无续接需求用 openAuthModal()，登录后要继续原操作用 dispatchAuthWithIntent() */
export const OPEN_AUTH_EVENT = "tianji:open-auth";

/** 打开登录弹窗 */
export function openAuthModal() {
  window.dispatchEvent(new CustomEvent(OPEN_AUTH_EVENT));
}

export function dispatchAuthWithIntent(intent: string, targetId?: string) {
  usePendingAction.getState().setPending({ intent, targetId, createdAt: Date.now() });
  openAuthModal();
}

export function resolvePendingAction(): string | null {
  const { pending, clear } = usePendingAction.getState();
  if (!pending) return null;
  clear();
  const route = INTENT_ROUTES[pending.intent];
  if (route) return route;
  return null;
}
