/**
 * scripts/rls-enforcement/acl-oracle-dry-run.ts
 *
 * Round 58 Phase 1+ — independent ACL oracle (step G).
 *
 * Applies ONLY Part C (the exact-GRANT compiler output) of
 * db/migrations/20260910_rls_enforcement_expansion_round58.sql against a
 * disposable PostgreSQL server, against a synthetic one-column stub table
 * created for EVERY one of the 700 storageAuthorityManifest entries — then
 * independently re-derives, from raw `information_schema.role_table_grants`
 * (NOT from re-reading the migration file — a genuinely independent catalog
 * query), the actual privileges union_eyes_runtime/union_eyes_system hold on
 * each table, and diffs that against the manifest's own
 * requiredRuntimePrivileges/requiredSystemPrivileges. Reports missing/extra
 * counts; exits 1 if either is nonzero.
 *
 * Requires RLS_ENFORCEMENT_TEST_URL (a superuser connection string to a
 * disposable, non-shared postgres:16+). Never touches staging/production.
 */
import { Client } from "pg";
import * as fs from "node:fs";
import * as path from "node:path";
import { storageAuthorityManifest } from "../../db/rls-storage-authority/index";

const REPO_ROOT = path.resolve(__dirname, "../..");
const MIGRATION_PATH = path.join(REPO_ROOT, "db/migrations/20260910_rls_enforcement_expansion_round58.sql");

async function main() {
  const url = process.env.RLS_ENFORCEMENT_TEST_URL;
  if (!url) {
    console.log("RLS_ENFORCEMENT_TEST_URL not set — skipping ACL oracle dry-run.");
    process.exit(0);
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    await client.query(`DROP SCHEMA IF EXISTS round58_acl_oracle CASCADE`);
    await client.query(`CREATE SCHEMA round58_acl_oracle`);
    await client.query(`SET search_path TO round58_acl_oracle, public`);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'union_eyes_runtime') THEN
          CREATE ROLE union_eyes_runtime NOSUPERUSER NOBYPASSRLS NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'union_eyes_system') THEN
          CREATE ROLE union_eyes_system NOSUPERUSER NOBYPASSRLS NOLOGIN;
        END IF;
      END $$;
    `);

    // Create one minimal stub table per manifest entry, granted ALL by
    // default (mirrors the pre-Round-58 blanket grant this migration is
    // meant to eventually replace) so REVOKE ALL + targeted GRANT below has
    // something real to narrow.
    for (const entry of storageAuthorityManifest) {
      await client.query(`CREATE TABLE ${quoteIdent(entry.table)} (id uuid primary key)`);
      await client.query(
        `GRANT ALL ON TABLE ${quoteIdent(entry.table)} TO union_eyes_runtime, union_eyes_system`
      );
    }

    // Extract and apply ONLY Part C from the real, committed migration file.
    const migrationSql = fs.readFileSync(MIGRATION_PATH, "utf8");
    const partCMarker = "-- PART C — exact GRANT compiler";
    const idx = migrationSql.indexOf(partCMarker);
    if (idx === -1) throw new Error("PART C marker not found in migration file");
    const partC = migrationSql.slice(idx);
    await client.query(partC);

    // Independently re-derive actual grants from the catalog.
    const grantRows = await client.query<{ table_name: string; grantee: string; privilege_type: string }>(
      `SELECT table_name, grantee, privilege_type
       FROM information_schema.role_table_grants
       WHERE table_schema = 'round58_acl_oracle'
         AND grantee IN ('union_eyes_runtime', 'union_eyes_system')`
    );

    const actual: Record<string, { runtime: Set<string>; system: Set<string> }> = {};
    for (const row of grantRows.rows) {
      actual[row.table_name] ??= { runtime: new Set(), system: new Set() };
      if (row.grantee === "union_eyes_runtime") actual[row.table_name].runtime.add(row.privilege_type);
      else actual[row.table_name].system.add(row.privilege_type);
    }

    let missing = 0;
    let extra = 0;
    const diffs: string[] = [];

    for (const entry of storageAuthorityManifest) {
      const expectedRuntime = new Set(entry.requiredRuntimePrivileges ?? []);
      const expectedSystem = new Set(entry.requiredSystemPrivileges ?? []);
      const gotRuntime = actual[entry.table]?.runtime ?? new Set<string>();
      const gotSystem = actual[entry.table]?.system ?? new Set<string>();

      for (const priv of expectedRuntime) {
        if (!gotRuntime.has(priv)) {
          missing++;
          diffs.push(`MISSING runtime ${priv} on ${entry.table}`);
        }
      }
      for (const priv of gotRuntime) {
        if (!expectedRuntime.has(priv)) {
          extra++;
          diffs.push(`EXTRA runtime ${priv} on ${entry.table}`);
        }
      }
      for (const priv of expectedSystem) {
        if (!gotSystem.has(priv)) {
          missing++;
          diffs.push(`MISSING system ${priv} on ${entry.table}`);
        }
      }
      for (const priv of gotSystem) {
        if (!expectedSystem.has(priv)) {
          extra++;
          diffs.push(`EXTRA system ${priv} on ${entry.table}`);
        }
      }
    }

    console.log(`Tables checked: ${storageAuthorityManifest.length}`);
    console.log(`Missing grants: ${missing}`);
    console.log(`Extra grants: ${extra}`);
    if (diffs.length > 0) {
      console.log(diffs.slice(0, 40).join("\n"));
      if (diffs.length > 40) console.log(`... and ${diffs.length - 40} more`);
    }

    await client.query(`DROP SCHEMA IF EXISTS round58_acl_oracle CASCADE`);

    if (missing > 0 || extra > 0) {
      process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
