import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: false,
    environment: "node",
    // 支持 .tsx 测试文件按需切换到 jsdom（通过文件顶部 // @vitest-environment jsdom 注释）
    environmentMatchGlobs: [
      ["src/components/**/*.test.tsx", "jsdom"],
      ["src/pages/**/*.test.tsx", "jsdom"],
    ],
    setupFiles: ["src/test/setup.ts"],
    exclude: ["node_modules", "**/node_modules/**", ".claude/**", ".agents/**", ".closed-loop-workspace/**", "dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/lib/**/*.ts", "src/components/**/*.tsx"],
      exclude: ["**/*.test.ts", "**/*.test.tsx", "src/lib/sentry.ts", "src/lib/cloudbase.ts", "src/components/**/*.test.tsx"],
      thresholds: {
        lines: 20,
        branches: 15,
        functions: 13,
      },
    },
  },
});
