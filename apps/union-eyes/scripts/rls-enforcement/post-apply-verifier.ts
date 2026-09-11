/**
 * scripts/rls-enforcement/post-apply-verifier.ts
 *
 * Round 58C section 61 — read-only post-apply verifier for Round 59 to run
 * AFTER applying the Round 58 enforcement migration to a real shared
 * environment. Performs NO writes — every check is a read-only catalog
 * query against the REAL tables in that environment (not synthetic stubs;
 * see policy-oracle.ts for the synthetic-stub-schema equivalent used
 * during this round's own disposable-Postgres validation).
 *
 * For every manifest entry this round resolved (rlsExpected), checks — if
 * the real table exists in the target's public schema — that:
 *   - RLS is enabled and FORCE RLS is enabled
 *   - union_eyes_system has an unconditional ALL policy
 *   - union_eyes_runtime has policies covering the expected commands
 *   - the exact GRANT set (requiredRuntimePrivileges/requiredSystemPrivileges)
 *     matches has_table_privilege exactly (missing=0, extra=0)
 *
 * Tables that do not yet exist in the target environment are reported as
 * SKIPPED (not failed) — Round 59 decides whether that is itself a
 * blocker for that specific environment.
 *
 * Usage: RLS_POST_APPLY_TARGET_URL=<connection string> pnpm --filter
 * @nzila/union-eyes exec tsx scripts/rls-enforcement/post-apply-verifier.ts
 */
import { Client } from "pg";
import { storageAuthorityManifest, type RuntimeOperation } from "../../db/rls-storage-authority/index";
import { ENFORCEMENT_GEOMETRY_OVERRIDES } from "./enforcement-geometry-overrides";

const BASELINE_0108_TABLES = new Set([
  "organization_members", "organizations", "grievances", "claims", "grievance_deadlines",
  "documents", "member_documents", "workplace_incidents", "safety_inspections", "hazard_reports",
  "safety_committee_meetings", "safety_training_records", "ppe_equipment", "safety_audits",
  "injury_logs", "safety_policies", "corrective_actions", "safety_certifications",
  "message_threads", "messages", "message_participants", "message_read_receipts",
  "message_notifications", "cross_org_access_log",
]);

const NO_RLS_CLASSIFICATIONS = new Set([
  "GLOBAL_REFERENCE_DATA", "APP_SCOPED_NON_SENSITIVE", "SEPARATE_DATABASE_BOUNDARY",
  "LATENT_UNREACHABLE", "CONTAINED_NO_AUTHORITY",
]);

async function main() {
  const url = process.env.RLS_POST_APPLY_TARGET_URL;
  if (!url) {
    console.error("RLS_POST_APPLY_TARGET_URL is required (connection string to the target environment).");
    process.exit(1);
  }

  const overridesByTable = new Map(ENFORCEMENT_GEOMETRY_OVERRIDES.map((o) => [o.table, o]));
  const client = new Client({ connectionString: url });
  await client.connect();

  let missing = 0;
  let extra = 0;
  let skipped = 0;
  const diffs: string[] = [];

  try {
    const existingTables = new Set(
      (
        await client.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`)
      ).rows.map((r) => r.tablename)
    );

    for (const entry of storageAuthorityManifest) {
      if (BASELINE_0108_TABLES.has(entry.table)) continue;
      if (NO_RLS_CLASSIFICATIONS.has(entry.classification)) continue;
      if (!existingTables.has(entry.table)) {
        skipped++;
        continue;
      }

      const override = overridesByTable.get(entry.table);
      let expectedRuntimeCommands = new Set<string>();
      if (entry.classification === "MULTI_PARTY_RLS_REQUIRED") {
        expectedRuntimeCommands =
          override?.kind === "SHARED_LIBRARY_ROOT" || override?.kind === "SHARED_LIBRARY_CHILD"
            ? new Set(["SELECT", "INSERT", "UPDATE", "DELETE"])
            : new Set(["SELECT"]);
      } else if (entry.classification === "SYSTEM_ONLY") {
        expectedRuntimeCommands = new Set();
      } else {
        expectedRuntimeCommands = new Set(["SELECT", "INSERT", "UPDATE", "DELETE"]);
      }

      const catalog = await client.query(
        `SELECT c.relrowsecurity, c.relforcerowsecurity FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = $1`,
        [entry.table]
      );
      if (catalog.rowCount !== 1) {
        diffs.push(`MISSING: ${entry.table} not found in pg_class`);
        missing++;
        continue;
      }
      if (!catalog.rows[0].relrowsecurity) {
        diffs.push(`MISSING: ${entry.table} RLS not enabled`);
        missing++;
      }
      if (!catalog.rows[0].relforcerowsecurity) {
        diffs.push(`MISSING: ${entry.table} FORCE RLS not enabled`);
        missing++;
      }

      const policies = await client.query(
        `SELECT polname, polroles::regrole[]::text[] AS roles,
                CASE polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT' WHEN 'w' THEN 'UPDATE'
                            WHEN 'd' THEN 'DELETE' WHEN '*' THEN 'ALL' END AS cmd
         FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = $1`,
        [entry.table]
      );
      const systemAll = policies.rows.some((r) => r.roles?.includes("union_eyes_system") && r.cmd === "ALL");
      if (!systemAll) {
        diffs.push(`MISSING: ${entry.table} has no unconditional ALL policy for union_eyes_system`);
        missing++;
      }
      const runtimeCovered = new Set<string>();
      for (const r of policies.rows) {
        if (!r.roles?.includes("union_eyes_runtime")) continue;
        if (r.cmd === "ALL") ["SELECT", "INSERT", "UPDATE", "DELETE"].forEach((c) => runtimeCovered.add(c));
        else if (r.cmd) runtimeCovered.add(r.cmd);
      }
      for (const cmd of expectedRuntimeCommands) {
        if (!runtimeCovered.has(cmd)) {
          diffs.push(`MISSING: ${entry.table} runtime policy for ${cmd}`);
          missing++;
        }
      }

      // Exact ACL check via has_table_privilege (effective privilege,
      // includes role inheritance/PUBLIC per mandate section 51).
      const runtimePrivs = new Set(entry.requiredRuntimePrivileges === "TBD" ? [] : entry.requiredRuntimePrivileges ?? []);
      const systemPrivs = new Set(entry.requiredSystemPrivileges === "TBD" ? [] : entry.requiredSystemPrivileges ?? []);
      for (const priv of ["SELECT", "INSERT", "UPDATE", "DELETE"] as const satisfies readonly RuntimeOperation[]) {
        const runtimeHas = (
          await client.query(`SELECT has_table_privilege('union_eyes_runtime', $1, $2) AS ok`, [entry.table, priv])
        ).rows[0].ok;
        if (runtimePrivs.has(priv) && !runtimeHas) {
          diffs.push(`MISSING: union_eyes_runtime ${priv} on ${entry.table}`);
          missing++;
        }
        if (!runtimePrivs.has(priv) && runtimeHas) {
          diffs.push(`EXTRA: union_eyes_runtime ${priv} on ${entry.table}`);
          extra++;
        }
        const systemHas = (
          await client.query(`SELECT has_table_privilege('union_eyes_system', $1, $2) AS ok`, [entry.table, priv])
        ).rows[0].ok;
        if (systemPrivs.has(priv) && !systemHas) {
          diffs.push(`MISSING: union_eyes_system ${priv} on ${entry.table}`);
          missing++;
        }
        if (!systemPrivs.has(priv) && systemHas) {
          diffs.push(`EXTRA: union_eyes_system ${priv} on ${entry.table}`);
          extra++;
        }
      }
    }
  } finally {
    await client.end();
  }

  console.log(`Skipped (table does not yet exist in target): ${skipped}`);
  console.log(`Missing: ${missing}`);
  console.log(`Extra: ${extra}`);
  if (diffs.length > 0) {
    console.log(diffs.slice(0, 80).join("\n"));
    if (diffs.length > 80) console.log(`... and ${diffs.length - 80} more`);
  }
  if (missing > 0 || extra > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
