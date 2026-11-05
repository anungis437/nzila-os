import { defineProject } from "vitest/config";
import react from "@vitejs/plugin-react";
import { heavyTests, sharedExclude, sharedResolve, sharedSetupFiles } from "./vitest.shared";

export default defineProject({
  plugins: [react()],
  resolve: sharedResolve,
  test: {
    name: "union-eyes",
    setupFiles: sharedSetupFiles,
    // Route-matrix smoke and import-matrix tests dynamically import hundreds
    // of Next.js API route modules; cold module resolution on Windows +
    // monorepo-scale parallel runners can occasionally push individual
    // per-route imports past 60s. 120s gives comfortable headroom.
    testTimeout: 120_000,
    hookTimeout: 60_000,
    // Container and child-process suites run in the union-eyes-heavy project (vitest.heavy.config.ts).
    sequence: { groupOrder: 1 },
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
    exclude: [...sharedExclude, ...heavyTests],
  },
} as unknown as Parameters<typeof defineProject>[0]);
