import { defineConfig } from "vitest/config";
import path from "node:path";

// Self-contained config so the financial-service package can be unit-tested in
// isolation. Without this, vitest walks up to apps/union-eyes/vitest.config.ts
// and inherits that project's hardcoded coverage.include + 99% thresholds and
// the "@" -> union-eyes alias, none of which apply to this standalone service.
export default defineConfig({
  resolve: {
    alias: {
      // The financial-service references '@/lib/email-service', which only
      // physically exists in the parent union-eyes app. Alias it to a local
      // stub so the package can be unit-tested in isolation. This MUST be
      // listed before the broader "@" alias so it takes precedence.
      "@/lib/email-service": path.resolve(
        __dirname,
        "./src/tests/__mocks__/email-service.ts",
      ),
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    name: "financial-service",
    environment: "node",
    testTimeout: 30000,
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/db/schema*.ts",
        "src/**/types.ts",
        "src/**/*.d.ts",
      ],
    },
  },
});
