import path from "node:path";

/**
 * Test files that start containers or child processes, or scan the whole repository.
 *
 * They are correct in isolation and slow under contention with ~1,400 ordinary files, which is how they
 * produced load-dependent hook and child-process timeouts. They run in their own project, after the main
 * project has finished, with a single worker. Timeouts are NOT the control: a hang here still fails.
 */
export const heavyTests = [
  "**/*postgres.test.ts",
  "**/*.native.test.ts",
  "scripts/bootstrap-v2/**/*.test.ts",
  "scripts/__tests__/generate-*.test.ts",
  "scripts/__tests__/canonical-schema-map.test.ts",
  "scripts/__tests__/runtime-schema-authority-oracle.test.ts",
  "scripts/__tests__/rls-storage-reachability-audit.test.ts",
  "scripts/__tests__/rls-verify-deadline-engine-policies.pglite.test.ts",
  "db/__tests__/scoped-migrations-existing-env.test.ts",
  "db/__tests__/convergence-p0-contracts.test.ts",
  "lib/member-integrity/__tests__/member-query-importers.test.ts",
];

/**
 * The repository-scan census tests (response-shape-census, untyped-read-census) walk the whole
 * app with the TypeScript compiler API. They need a raised heap ceiling (see vitest.census.config.ts)
 * and, unlike the rest of heavyTests, they do not tolerate sharing a long-lived worker process with
 * whatever ran before them: observed one taking 44 minutes (vs. ~70s alone) and the other timing out
 * when run after the docker- and postgres-dependent heavy tests in the same sequential worker, even
 * with the raised ceiling, apparently from heap fragmentation carried over between files in that worker.
 * They get their own project, after the heavy project, so they always start from a clean process.
 */
export const censusTests = ["scripts/__tests__/response-shape-census.test.ts", "scripts/__tests__/untyped-read-census.test.ts"];

/** Runs in every worker before its test file: the tests resolve application files from the application directory (see the file). */
export const sharedSetupFiles = [path.resolve(__dirname, "vitest.working-directory.ts")];

export const sharedResolve = {
  alias: {
    "@": path.resolve(__dirname, "."),
    // Stub next-auth + platform-auth server in unit tests — next-auth
    // tries to import next/server at load time which crashes in vitest
    "next-auth": path.resolve(__dirname, "./__mocks__/next-auth.ts"),
    "next-auth/providers/microsoft-entra-id": path.resolve(
      __dirname,
      "./__mocks__/next-auth-microsoft-entra-id.ts",
    ),
    "@nzila/cupe-vocabulary/types": path.resolve(
      __dirname,
      "../../packages/cupe-vocabulary/src/types.ts",
    ),
    "@nzila/cupe-vocabulary": path.resolve(
      __dirname,
      "../../packages/cupe-vocabulary/src/index.ts",
    ),
    "@nzila/platform-auth/entra/server": path.resolve(__dirname, "./__mocks__/platform-auth-server.ts"),
  },
};

export const sharedExclude = [
  "**/node_modules/**",
  "**/.git/**",
  "**/.next/**",
  "e2e/**",
  "tests/e2e/**",
  "services/financial-service/**",
];
