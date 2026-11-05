/**
 * scripts/rls-enforcement/post-apply-verifier.ts
 *
 * Read-only post-apply verifier, run AFTER an enforcement or later migration has been applied to a real environment.
 * Performs NO writes: every check is a catalog query against the real tables in the target's public schema
 * (not synthetic stubs; policy-oracle.ts is the synthetic-stub equivalent).
 *
 * For every in-scope manifest entry whose table exists, checks that
 *   - RLS is enabled and forced (classes that own an RLS contract);
 *   - every command union_eyes_runtime / union_eyes_system is privileged to run is covered by a permissive policy;
 *   - the effective privileges of both roles equal requiredRuntimePrivileges / requiredSystemPrivileges exactly.
 * The rules live in post-apply-verifier-core.ts, where they are unit-tested and proven against a real database.
 *
 * Tables that do not exist in the target are reported as skipped, not failed; the decision whether that is itself a
 * blocker belongs to the operator (set RLS_POST_APPLY_LIST_SKIPPED=1 to list them).
 *
 * A database that has only the frozen 2026-09 enforcement chain applied cannot pass this: later migrations add the
 * policies and grants the current manifest requires (see db/__tests__/p4-authority-state-attest.postgres.test.ts).
 *
 * Usage: RLS_POST_APPLY_TARGET_URL=<connection string> pnpm --filter
 * @nzila/union-eyes exec tsx scripts/rls-enforcement/post-apply-verifier.ts
 */
import { Client } from "pg";
import { storageAuthorityManifest } from "../../db/rls-storage-authority/index";
import { verifyEntries } from "./post-apply-verifier-core";

const MAX_DIFFS_PRINTED = 500;

async function main() {
  const url = process.env.RLS_POST_APPLY_TARGET_URL;
  if (!url) {
    console.error("RLS_POST_APPLY_TARGET_URL is required (connection string to the target environment).");
    process.exit(1);
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  const report = await (async () => {
    try {
      return await verifyEntries(client, storageAuthorityManifest);
    } finally {
      await client.end();
    }
  })();

  console.log(`Skipped (table does not yet exist in target): ${report.skipped.length}`);
  console.log(`Missing: ${report.missing}`);
  console.log(`Extra: ${report.extra}`);
  if (process.env.RLS_POST_APPLY_LIST_SKIPPED === "1" && report.skipped.length > 0) {
    console.log(`Skipped tables: ${report.skipped.join(", ")}`);
  }
  if (report.diffs.length > 0) {
    console.log(report.diffs.slice(0, MAX_DIFFS_PRINTED).map((d) => `${d.kind}: ${d.text}`).join("\n"));
    if (report.diffs.length > MAX_DIFFS_PRINTED) console.log(`... and ${report.diffs.length - MAX_DIFFS_PRINTED} more`);
  }
  if (report.missing > 0 || report.extra > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
