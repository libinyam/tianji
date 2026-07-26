import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: false,
    environment: "node",
    // #425 environmentMatchGlobs 在 Vitest 4 已移除（此前是不生效的死配置）。
    // 组件/页面测试切 jsdom 依赖每个 .tsx 测试文件顶部的
    // `// @vitest-environment jsdom` docblock 注释——新增测试务必带上。
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
