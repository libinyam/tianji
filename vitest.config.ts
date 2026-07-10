import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/lib/sanitize.ts", "src/lib/security.ts", "src/lib/utils.ts", "src/lib/format.ts", "src/lib/reputation.ts"],
      exclude: ["**/*.test.ts", "src/lib/sentry.ts"],
      thresholds: {
        lines: 80,
        branches: 75,
        functions: 80,
      },
    },
  },
});
