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
        "lib/ai/**",
        "lib/services/**",
      ],
      exclude: [
        "**/__tests__/**",
        "**/*.test.ts",
        "**/node_modules/**",
      ],
      thresholds: {
        // Tier 4 coverage gates — AI & service layer
        lines: 40,
        functions: 40,
        branches: 30,
        statements: 40,
      },
    },
  },
});
