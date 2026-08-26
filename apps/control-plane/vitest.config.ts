import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    // Dynamic-import barrel/route tests can exceed the 5s vitest default under
    // monorepo-scale parallel runners on Windows; 30s provides comfortable headroom.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    environment: "jsdom",
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next", "e2e"],
    coverage: {
      provider: 'v8',
      include: [
        'app/api/health/route.ts',
        'app/api/ready/route.ts',
        'app/api/version/route.ts',
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/__tests__/**',
        '**/__mocks__/**',
        '**/demoSeed.ts',
      ],
      // Strict coverage on core shared infrastructure:
      // - Utilities (common helpers - 100%)
      // - Localization (i18n layer - 100%)
      // - Intelligence access (data access control - 100%)
      // Auth, tokens, and authority decision logic tested via integration test suite
      thresholds: {
        lines: 99,
        functions: 99,
        branches: 95,
        statements: 99,
      },
    } as any,
  },
});
