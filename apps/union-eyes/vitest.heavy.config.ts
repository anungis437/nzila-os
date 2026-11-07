import { defineProject } from "vitest/config";
import react from "@vitejs/plugin-react";
import { heavyTests, sharedExclude, sharedResolve, sharedSetupFiles } from "./vitest.shared";

// Container-, child-process- and repository-scan tests (see vitest.shared.ts). They run after the main project,
// one file at a time, so a hook timeout means the test is slow or hung, not that it was starved.
export default defineProject({
  plugins: [react()],
  resolve: sharedResolve,
  test: {
    name: "union-eyes-heavy",
    setupFiles: sharedSetupFiles,
    include: heavyTests,
    exclude: sharedExclude,
    testTimeout: 240_000,
    hookTimeout: 180_000,
    fileParallelism: false,
    sequence: { groupOrder: 2 },
    // The repository-scan census tests (response-shape-census, untyped-read-census)
    // walk the whole app with the TypeScript compiler API and can exceed the default
    // per-worker heap even running alone (observed SIGABRT with the default limit).
    // A single heavy file already runs in its own forked process, so raising its
    // ceiling costs nothing for the other, smaller heavy tests.
    execArgv: ["--max-old-space-size=8192"],
  },
} as unknown as Parameters<typeof defineProject>[0]);
