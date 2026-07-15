import { vi } from "vitest";
import "@testing-library/jest-dom/vitest";

const store: Record<string, string> = {};

vi.stubGlobal("localStorage", {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    for (const key of Object.keys(store)) delete store[key];
  },
});

// jsdom 不实现 matchMedia，组件中若用到需提供 stub
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
}));

// jsdom 不实现 ResizeObserver
vi.stubGlobal("ResizeObserver", class {
  observe() {}
  unobserve() {}
  disconnect() {}
});

// jsdom 不实现 requestAnimationFrame 的下一帧
vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
  return setTimeout(() => cb(Date.now()), 0) as unknown as number;
});

vi.stubGlobal("cancelAnimationFrame", (id: number) => {
  clearTimeout(id);
});

export function resetLocalStorage() {
  for (const key of Object.keys(store)) delete store[key];
}
