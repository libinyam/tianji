import { create } from "zustand";

type ThemeMode = "dark" | "light";

interface ThemeState {
  mode: ThemeMode;
  toggle: () => void;
  setMode: (mode: ThemeMode) => void;
  initTheme: () => void;
}

const STORAGE_KEY = "tianji-theme";

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === "light") {
    root.classList.add("light");
  } else {
    root.classList.remove("light");
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: "light",

  initTheme: () => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    const mode = saved ?? "light";
    applyTheme(mode);
    set({ mode });
  },

  toggle: () => {
    const next = get().mode === "dark" ? "light" : "dark";
    applyTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    set({ mode: next });
  },

  setMode: (mode) => {
    applyTheme(mode);
    localStorage.setItem(STORAGE_KEY, mode);
    set({ mode });
  },
}));
