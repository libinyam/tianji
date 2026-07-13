import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/lib/**/*.ts"],
      exclude: ["**/*.test.ts", "src/lib/sentry.ts", "src/lib/cloudbase.ts"],
      thresholds: {
        lines: 20,
        branches: 12,
        functions: 15,
      },
    },
  },
});
