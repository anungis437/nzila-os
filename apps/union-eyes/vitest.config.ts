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
      "next-auth/providers/microsoft-entra-id": path.resolve(
        __dirname,
        "./__mocks__/next-auth-microsoft-entra-id.ts",
      ),
      "@nzila/platform-auth/entra/server": path.resolve(__dirname, "./__mocks__/platform-auth-server.ts"),
    },
  },
  test: {
    name: "union-eyes",
    testTimeout: 60000,
    coverage: {
      provider: "v8",
      include: [
        "app/api/auth_core/health/route.ts",
        "app/api/version/route.ts",
      ],
      exclude: ["**/*.test.ts", "**/*.test.tsx"],
      thresholds: {
        lines: 99,
        functions: 99,
        branches: 99,
        statements: 99,
      },
    },
    exclude: [
      "**/node_modules/**",
      "**/.git/**",
      "**/.next/**",
      "e2e/**",
      "tests/e2e/**",
      "services/financial-service/**",
    ],
  },
} as unknown as Parameters<typeof defineProject>[0]);
