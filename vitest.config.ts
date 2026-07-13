import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    setupFiles: ["src/test/setup.ts"],
    exclude: ["node_modules", ".claude/**", ".agents/**", ".closed-loop-workspace/**", "dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/lib/**/*.ts"],
      exclude: ["**/*.test.ts", "src/lib/sentry.ts", "src/lib/cloudbase.ts"],
      thresholds: {
        lines: 12,
        branches: 8,
        functions: 10,
      },
    },
  },
});
