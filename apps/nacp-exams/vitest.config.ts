import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "nacp-exams",
    exclude: [
      "**/node_modules/**",
      "**/.git/**",
    ],
  },
});
