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
      reporter: ["text-summary", "json", "json-summary", "html"],
      // #425 把 src/pages 纳入统计：15 个页面此前不进覆盖率报告，
      // 最大的盲区在数字上是隐形的，容易造成"覆盖率还行"的错觉
      include: ["src/lib/**/*.ts", "src/components/**/*.tsx", "src/pages/**/*.tsx"],
      exclude: ["**/*.test.ts", "**/*.test.tsx", "src/lib/sentry.ts", "src/lib/cloudbase.ts", "src/components/**/*.test.tsx"],
      // #425 阈值定在略低于当前实际值(ratcheting):纳入 src/pages 后由
      // scripts/ratchet-coverage.mjs 依据 coverage-summary.json 自动回写,
      // 覆盖率大幅倒退时 CI 变红,随覆盖增长逐步抬高
      thresholds: {
        lines: 13,
        branches: 11,
        functions: 11,
      },
    },
  },
});
