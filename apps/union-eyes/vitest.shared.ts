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
