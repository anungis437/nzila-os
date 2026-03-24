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
  },
});
