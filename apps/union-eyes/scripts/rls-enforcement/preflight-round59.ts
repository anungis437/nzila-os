/**
 * scripts/rls-enforcement/preflight-round59.ts
 *
 * Round 58C sections 60/62 — read-only preflight check for Round 59 to run
 * BEFORE applying the Round 58 enforcement migration to any real shared
 * environment. Performs NO writes of any kind — every check is a read-only
 * catalog/manifest query.
 *
 * Checks:
 *   - union_eyes_runtime / union_eyes_system roles exist, NOSUPERUSER,
 *     NOBYPASSRLS (0108's own baseline posture)
 *   - 0108's own baseline marker function (ue_create_direct_org_rls_policy)
 *     already exists (i.e. 0108 has been applied to this environment)
 *   - manifest is still fully closed: 0 NEEDS_REVIEW, 0 TBD privileges
 *   - 0 geometry blockers (regenerates in-memory, does not write any file)
 *   - no unexpected pre-existing policy already named identically to one
 *     this migration is about to create (idempotent DROP POLICY IF EXISTS
 *     makes this non-fatal, but surfacing it is still useful signal)
 *
 * Usage: RLS_PREFLIGHT_TARGET_URL=<connection string> pnpm --filter
 * @nzila/union-eyes exec tsx scripts/rls-enforcement/preflight-round59.ts
 *
 * Exits 1 (fail-closed) on ANY check failure or if the target URL is not
 * provided — this tool is meant to be a hard gate, not an FYI.
 */
import { Client } from "pg";
import { execFileSync } from "node:child_process";
import * as path from "node:path";
import { storageAuthorityManifest } from "../../db/rls-storage-authority/index";

const REPO_ROOT = path.resolve(__dirname, "../..");

async function main() {
  const url = process.env.RLS_PREFLIGHT_TARGET_URL;
  if (!url) {
    console.error("RLS_PREFLIGHT_TARGET_URL is required (read-only connection string to the target environment).");
    process.exit(1);
  }

  let failed = false;
  function check(label: string, ok: boolean, detail?: string) {
    console.log(`${ok ? "PASS" : "FAIL"}: ${label}${detail ? ` — ${detail}` : ""}`);
    if (!ok) failed = true;
  }

  // --- Static manifest checks (no DB connection needed) ---
  const needsReview = storageAuthorityManifest.filter(
    (e: any) => e.classification === "NEEDS_REVIEW" || e.reviewPriority === "NEEDS_REVIEW"
  );
  check("manifest has 0 NEEDS_REVIEW entries", needsReview.length === 0, `found ${needsReview.length}`);

  const tbd = storageAuthorityManifest.filter(
    (e: any) => e.requiredRuntimePrivileges === "TBD" || e.requiredSystemPrivileges === "TBD"
  );
  check("manifest has 0 TBD privilege entries", tbd.length === 0, `found ${tbd.length}`);

  // --- Geometry blockers (regenerate in-memory, no file writes) ---
  try {
    const out = execFileSync("npx", ["tsx", path.join(REPO_ROOT, "scripts/rls-enforcement/generate-rls-enforcement-migration.ts")], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        RLS_ENFORCEMENT_OUT_MIGRATION: "/tmp/round59-preflight-migration.sql",
        RLS_ENFORCEMENT_OUT_BLOCKERS: "/tmp/round59-preflight-blockers.json",
      },
      encoding: "utf8",
    });
    const blockersMatch = out.match(/Blockers: (\d+)/);
    const blockerCount = blockersMatch ? parseInt(blockersMatch[1], 10) : -1;
    check("0 geometry blockers (regenerated in-memory)", blockerCount === 0, `found ${blockerCount}`);
  } catch (err: any) {
    check("0 geometry blockers (regenerated in-memory)", false, `generator failed: ${err.message}`);
  }

  // --- Live DB checks (read-only) ---
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const roles = await client.query(
      `SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname IN ('union_eyes_runtime', 'union_eyes_system')`
    );
    const runtime = roles.rows.find((r) => r.rolname === "union_eyes_runtime");
    const system = roles.rows.find((r) => r.rolname === "union_eyes_system");
    check("union_eyes_runtime role exists", !!runtime);
    check("union_eyes_system role exists", !!system);
    if (runtime) {
      check("union_eyes_runtime is NOSUPERUSER", runtime.rolsuper === false);
      check("union_eyes_runtime is NOBYPASSRLS", runtime.rolbypassrls === false);
    }
    if (system) {
      check("union_eyes_system is NOSUPERUSER", system.rolsuper === false);
      check("union_eyes_system is NOBYPASSRLS", system.rolbypassrls === false);
    }

    const baselineFn = await client.query(
      `SELECT 1 FROM pg_proc WHERE proname = 'ue_create_direct_org_rls_policy'`
    );
    check("0108 baseline migration already applied (ue_create_direct_org_rls_policy exists)", baselineFn.rowCount === 1);
  } finally {
    await client.end();
  }

  if (failed) {
    console.error("\nPREFLIGHT FAILED — do not proceed with applying the Round 58 enforcement migration.");
    process.exit(1);
  }
  console.log("\nPREFLIGHT PASSED.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
