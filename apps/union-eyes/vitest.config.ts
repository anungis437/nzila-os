import { defineProject } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineProject({
  plugins: [react()],
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
    testTimeout: 20000,
    exclude: [
      "**/node_modules/**",
      "**/.git/**",
      "**/.next/**",
      "e2e/**",
      "tests/e2e/**",
      "services/financial-service/**",
    ],
  },
});
