import { defineProject } from "vitest/config";
import react from "@vitejs/plugin-react";
import { censusTests, sharedExclude, sharedResolve, sharedSetupFiles } from "./vitest.shared";

// The repository-scan census tests (see vitest.shared.ts) in their own project, after
// union-eyes-heavy, each starting from a clean process: they walk the whole app with the
// TypeScript compiler API and need a raised heap ceiling that only holds reliably when
// nothing else has run in the same worker first.
export default defineProject({
  plugins: [react()],
  resolve: sharedResolve,
  test: {
    name: "union-eyes-census",
    setupFiles: sharedSetupFiles,
    include: censusTests,
    exclude: sharedExclude,
    testTimeout: 240_000,
    hookTimeout: 180_000,
    fileParallelism: false,
    sequence: { groupOrder: 3 },
    execArgv: ["--max-old-space-size=8192"],
  },
} as unknown as Parameters<typeof defineProject>[0]);
