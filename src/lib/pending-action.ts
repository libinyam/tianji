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

export function dispatchAuthWithIntent(intent: string, targetId?: string) {
  usePendingAction.getState().setPending({ intent, targetId, createdAt: Date.now() });
  window.dispatchEvent(new CustomEvent("tianji:open-auth"));
}

export function resolvePendingAction(): string | null {
  const { pending, clear } = usePendingAction.getState();
  if (!pending) return null;
  clear();
  const route = INTENT_ROUTES[pending.intent];
  if (route) return route;
  return null;
}
