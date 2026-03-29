import { defineProject } from "vitest/config";
import path from "node:path";

export default defineProject({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    name: "union-eyes",
    exclude: [
      "**/node_modules/**",
      "**/.git/**",
      "e2e/**",
      "services/**",
    ],
    coverage: {
      provider: "v8",
      include: [
        "lib/**",
      ],
      exclude: [
        "**/__tests__/**",
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/node_modules/**",
        "lib/locales/**",
        "lib/shared-ui.*",
        "lib/console-wrapper.*",
        "lib/stripe-elements.*",
        "lib/public-routes.*",
      ],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 95,
        statements: 95,
      },
    },
  },
});
