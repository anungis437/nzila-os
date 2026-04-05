import { defineProject } from "vitest/config";
import path from "node:path";

export default defineProject({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // Stub next-auth + platform-auth server in unit tests — next-auth
      // tries to import next/server at load time which crashes in vitest
      "next-auth": path.resolve(__dirname, "./__mocks__/next-auth.ts"),
      "@nzila/platform-auth/entra/server": path.resolve(__dirname, "./__mocks__/platform-auth-server.ts"),
    },
  },
  test: {
    name: "union-eyes",
    exclude: [
      "**/node_modules/**",
      "**/.git/**",
      "e2e/**",
      "services/financial-service/**",
    ],

  },
});
