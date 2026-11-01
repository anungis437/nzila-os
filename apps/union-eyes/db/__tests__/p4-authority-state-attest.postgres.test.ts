/**
 * db/__tests__/p4-authority-state-attest.postgres.test.ts
 *
 * P4_ROUND58_COMPLETE_GEOMETRY_PR_FINAL_EVIDENCE_CLOSURE — durable,
 * committed end-to-end regression proof of the full disposable apply
 * chain, exercising the REAL scripts (not a manual SQL-equivalence
 * substitute):
 *
 *   scripts/apply-authority-enforcement-migration.ts (0913+0914+0910)
 *   -> scripts/apply-round58-grant-order-fix.ts
 *   -> scripts/apply-round59-rls-geometry-gap-closure.ts
 *   -> scripts/p4-authority-state.ts --mode=attest
 *   -> scripts/rls-enforcement/post-apply-verifier.ts (historical invariants only: the frozen chain predates the
 *      current manifest, so full conformance is proven on the combined database in
 *      post-apply-verifier.postgres.test.ts; see the assertions below and R-37)
 *
 * Runs each script as a real child process (via `tsx`) against a
 * freshly-created, disposable, production-shape `public` schema fixture
 * (scripts/rls-enforcement/p4-disposable-fixture.ts) — p4-authority-
 * state.ts hardcodes `table_schema = 'public'` in its queries, so this
 * fixture must live in an actual `public` schema, not an isolated proof
 * schema (unlike full-migration-transactional-proof.ts). A dedicated,
 * throwaway database is created per run (and dropped in afterAll) so this
 * suite never contends with db/__tests__/round58-complete-production-
 * geometry-remediation.postgres.test.ts's own use of the shared test
 * database's `public` schema.
 *
 * Provide RLS_ENFORCEMENT_TEST_URL (a superuser connection string to a
 * disposable postgres:16) to run this suite. Skipped (not failed) when
 * absent. Never touches staging/production.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import postgres from "postgres";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { buildP4DisposableFixture } from "../../scripts/rls-enforcement/p4-disposable-fixture";

const TEST_URL = process.env.RLS_ENFORCEMENT_TEST_URL;
const describeOrSkip = TEST_URL ? describe : describe.skip;

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const ENFORCEMENT_SQL = "db/migrations/20260910_rls_enforcement_expansion_round58.sql";

/** The tables the frozen enforcement migration itself puts under row-level security. */
function tablesGovernedBy(sql: string): Set<string> {
  return new Set([...sql.matchAll(/PERFORM ue_create_[a-z_]+_rls_policy\('([a-z0-9_]+)'/g)].map((m) => m[1]));
}
// p4-authority-state.ts hardcodes EXPECTED_DATABASE = 'nzila_os_prod' — the
// disposable database MUST use this exact name for --mode=attest to pass
// its own database-identity check. Dropped and recreated at the start of
// this run (and dropped again in afterAll) so it never persists as a
// stale artifact between runs.
const DB_NAME = "nzila_os_prod";

function disposableUrlFor(dbName: string): string {
  const url = new URL(TEST_URL!);
  url.pathname = `/${dbName}`;
  return url.toString();
}

function runScript(scriptRelPath: string, extraArgs: string[], extraEnv: Record<string, string>): { status: number; output: string } {
  try {
    const output = execFileSync(
      "npx",
      ["tsx", scriptRelPath, ...extraArgs],
      {
        cwd: REPO_ROOT,
        env: { ...process.env, ...extraEnv },
        encoding: "utf8",
        stdio: "pipe",
        // npx is a .cmd shim on Windows and cannot be launched without a shell.
        shell: process.platform === "win32",
      }
    );
    return { status: 0, output };
  } catch (error: any) {
    return { status: typeof error?.status === "number" ? error.status : 1, output: `${error?.stdout ?? ""}${error?.stderr ?? ""}` };
  }
}

describeOrSkip("P4_ROUND58_COMPLETE_GEOMETRY_PR_FINAL_EVIDENCE_CLOSURE (real disposable apply chain)", () => {
  // NOTE: describe.skip still executes this describe body synchronously
  // (only `it` bodies are skipped), so nothing here may dereference
  // TEST_URL eagerly. adminSql/disposableUrl are constructed lazily in
  // beforeAll, which vitest does not invoke for a skipped suite.
  let adminSql: postgres.Sql;
  let disposableUrl: string;

  beforeAll(() => {
    adminSql = postgres(TEST_URL!, { ssl: TEST_URL!.includes("localhost") ? false : "require", max: 1, prepare: false });
    disposableUrl = disposableUrlFor(DB_NAME);
  });

  afterAll(async () => {
    try {
      const fixtureSql = postgres(disposableUrl, { ssl: false, max: 1, prepare: false });
      await fixtureSql.end({ timeout: 2 });
      await adminSql.unsafe(`DROP DATABASE IF EXISTS ${DB_NAME} WITH (FORCE)`);
    } catch {
      // best-effort disposable cleanup; never touches staging/production
    } finally {
      await adminSql.end({ timeout: 2 });
    }
  });

  it(
    "combined Round58 apply -> grant-order fix -> Round59 geometry closure -> p4-authority-state attest -> post-apply-verifier historical invariants",
    async () => {
      await adminSql.unsafe(`DROP DATABASE IF EXISTS ${DB_NAME} WITH (FORCE)`);
      await adminSql.unsafe(`CREATE DATABASE ${DB_NAME}`);
      const fixtureSql = postgres(disposableUrl, { ssl: false, max: 1, prepare: false });
      try {
        await fixtureSql.unsafe(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
        await buildP4DisposableFixture(fixtureSql);
      } finally {
        await fixtureSql.end({ timeout: 2 });
      }

      const adminEnv = { RLS_ENFORCEMENT_ADMIN_DATABASE_URL: disposableUrl };

      const applyEnforcement = runScript("scripts/apply-authority-enforcement-migration.ts", [], adminEnv);
      expect(applyEnforcement.status, applyEnforcement.output).toBe(0);

      const grantOrderFix = runScript("scripts/apply-round58-grant-order-fix.ts", [], adminEnv);
      expect(grantOrderFix.status, grantOrderFix.output).toBe(0);

      const geometryGapClosure = runScript("scripts/apply-round59-rls-geometry-gap-closure.ts", [], adminEnv);
      expect(geometryGapClosure.status, geometryGapClosure.output).toBe(0);

      const attest = runScript("scripts/p4-authority-state.ts", ["--", "--mode=attest"], {
        NODE_ENV: "test",
        UE_P4_ALLOW_DISPOSABLE_TEST_TARGET: "1",
        UE_P4_MIGRATION_ADMIN_DATABASE_URL: disposableUrl,
      });
      expect(attest.status, attest.output).toBe(0);
      expect(attest.output).toContain('"result": "PASS"');

      const postApplyVerifier = runScript("scripts/rls-enforcement/post-apply-verifier.ts", [], {
        RLS_POST_APPLY_TARGET_URL: disposableUrl,
      });
      // The frozen 2026-09 chain cannot satisfy today's manifest: later migrations add the policies and grants it now
      // requires (R-37). The verifier is proven against the current combined database in
      // post-apply-verifier.postgres.test.ts. What the frozen chain must still guarantee is asserted here: it never
      // grants beyond the manifest, and every table its own SQL governs ends with RLS enabled and forced.
      expect(postApplyVerifier.output).toMatch(/^Skipped \(table does not yet exist in target\): \d+$/m);
      expect(postApplyVerifier.output).toContain("Extra: 0");
      expect(postApplyVerifier.output, "the verifier output was truncated").not.toMatch(/^\.\.\. and \d+ more$/m);

      const governed = tablesGovernedBy(readFileSync(path.join(REPO_ROOT, ENFORCEMENT_SQL), "utf8"));
      expect(governed.size).toBeGreaterThan(200);
      const withoutRls = postApplyVerifier.output
        .split("\n")
        .map((line) => line.match(/^MISSING: (\S+) (?:FORCE )?RLS not enabled$/)?.[1])
        .filter((table): table is string => Boolean(table));
      expect(withoutRls.filter((table) => governed.has(table))).toEqual([]);
    },
    120_000
  );
});
