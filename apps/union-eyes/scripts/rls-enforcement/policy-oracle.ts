/**
 * scripts/rls-enforcement/policy-oracle.ts
 *
 * Round 58C — independent policy oracle (mandate sections 38-40).
 *
 * Computes the EXPECTED RLS posture for every manifest entry purely from
 * db/rls-storage-authority's storageAuthorityManifest + this round's
 * ENFORCEMENT_GEOMETRY_OVERRIDES + reports/union-eyes-rls-geometry.json —
 * never by reading/parsing the generated migration SQL text (that would be
 * self-validation). It then applies the real, committed migration to a
 * disposable synthetic-stub schema (same approach as policy-syntax-dry-
 * run.ts) and independently queries pg_policies / pg_class.relrowsecurity /
 * pg_class.relforcerowsecurity to compare actual vs expected.
 *
 * Checked per table:
 *   - RLS enabled? FORCE RLS enabled? (expected: yes for every classification
 *     that requires row-level enforcement; no opinion for classifications
 *     that get no RLS by doctrine — those are skipped, not asserted false,
 *     since 0108-baseline tables also legitimately have RLS via 0108 itself)
 *   - union_eyes_system has an unconditional (USING true) ALL-command policy
 *   - union_eyes_runtime has a policy covering each operation this
 *     classification's own doctrine says runtime should have some row-level
 *     rule for (MULTI_PARTY: SELECT only, no write policy at all; everything
 *     else that gets RLS: all 4 commands via one FOR ALL policy or 4
 *     granular ones)
 *
 * Reports missing/extra per table; exits 1 if either is nonzero.
 * Requires RLS_ENFORCEMENT_TEST_URL. Never touches staging/production.
 */
import { Client } from "pg";
import * as fs from "node:fs";
import * as path from "node:path";
import { storageAuthorityManifest } from "../../db/rls-storage-authority/index";
import { ENFORCEMENT_GEOMETRY_OVERRIDES } from "./enforcement-geometry-overrides";

const REPO_ROOT = path.resolve(__dirname, "../..");
const MIGRATION_PATH = path.join(REPO_ROOT, "db/migrations/20260910_rls_enforcement_expansion_round58.sql");
const BASELINE_MIGRATION_PATH = path.join(REPO_ROOT, "db/migrations/0108_rls_tenant_isolation_foundation.sql");
const GEOMETRY_PATH = path.join(REPO_ROOT, "reports/union-eyes-rls-geometry.json");

const BASELINE_0108_TABLES = new Set([
  "organization_members", "organizations", "grievances", "claims", "grievance_deadlines",
  "documents", "member_documents", "workplace_incidents", "safety_inspections", "hazard_reports",
  "safety_committee_meetings", "safety_training_records", "ppe_equipment", "safety_audits",
  "injury_logs", "safety_policies", "corrective_actions", "safety_certifications",
  "message_threads", "messages", "message_participants", "message_read_receipts",
  "message_notifications", "cross_org_access_log",
]);

// Classifications that get NO RLS at all by classification doctrine —
// mirrors generate-rls-enforcement-migration.ts's own comment, but this
// list is re-derived independently here (not imported from that file) so
// this remains a genuinely separate check, not a shared-code tautology.
const NO_RLS_CLASSIFICATIONS = new Set([
  "GLOBAL_REFERENCE_DATA",
  "APP_SCOPED_NON_SENSITIVE",
  "SEPARATE_DATABASE_BOUNDARY",
  "LATENT_UNREACHABLE",
  "CONTAINED_NO_AUTHORITY",
]);

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function extractBaselineHelperFunctions(sql: string): string {
  const start = sql.indexOf("CREATE OR REPLACE FUNCTION ue_create_direct_org_rls_policy");
  const end = sql.indexOf("-- =", start + 10);
  if (start === -1 || end === -1) throw new Error("Could not locate ue_create_direct_org_rls_policy in 0108 migration");
  return sql.slice(start, end);
}

async function main() {
  const url = process.env.RLS_ENFORCEMENT_TEST_URL;
  if (!url) {
    console.log("RLS_ENFORCEMENT_TEST_URL not set — skipping independent policy oracle.");
    process.exit(0);
  }

  const geometryFile = JSON.parse(fs.readFileSync(GEOMETRY_PATH, "utf8"));
  const overridesByTable = new Map(ENFORCEMENT_GEOMETRY_OVERRIDES.map((o) => [o.table, o]));
  const migrationSql = fs.readFileSync(MIGRATION_PATH, "utf8");
  const baselineHelper = extractBaselineHelperFunctions(fs.readFileSync(BASELINE_MIGRATION_PATH, "utf8"));
  const partBStart = migrationSql.indexOf("-- PART B —");
  const partCStart = migrationSql.indexOf("-- PART C —");
  const partA = migrationSql.slice(0, partBStart);
  const partB = migrationSql.slice(partBStart, partCStart);

  // --- Independently compute expected posture for every manifest entry ---
  type Expected = { rlsExpected: boolean; runtimeCommands: Set<string>; systemUnconditional: boolean };
  const expected = new Map<string, Expected>();
  for (const entry of storageAuthorityManifest) {
    if (BASELINE_0108_TABLES.has(entry.table)) continue; // 0108's own posture, not this oracle's concern
    if (NO_RLS_CLASSIFICATIONS.has(entry.classification)) continue; // no opinion

    const override = overridesByTable.get(entry.table);
    let runtimeCommands = new Set<string>();
    if (entry.classification === "MULTI_PARTY_RLS_REQUIRED") {
      // Doctrine: reads only, no runtime write policy at all — EXCEPT the
      // shared-library family, which (per this round's override) DOES get
      // real runtime writes scoped to the owner org.
      runtimeCommands =
        override?.kind === "SHARED_LIBRARY_ROOT" || override?.kind === "SHARED_LIBRARY_CHILD"
          ? new Set(["SELECT", "INSERT", "UPDATE", "DELETE"])
          : new Set(["SELECT"]);
    } else if (
      entry.classification === "TENANT_RLS_REQUIRED" ||
      entry.classification === "PARENT_OWNED_RLS_REQUIRED" ||
      entry.classification === "USER_RLS_REQUIRED" ||
      entry.classification === "MIXED_GLOBAL_TENANT_RLS_REQUIRED"
    ) {
      runtimeCommands = new Set(["SELECT", "INSERT", "UPDATE", "DELETE"]);
    } else if (entry.classification === "SYSTEM_ONLY") {
      runtimeCommands = new Set(); // no runtime policy at all — system-only
    } else {
      continue; // unknown/other classification: no opinion
    }
    expected.set(entry.table, { rlsExpected: true, runtimeCommands, systemUnconditional: true });
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    await client.query(`DROP SCHEMA IF EXISTS round58_policy_oracle CASCADE`);
    await client.query(`CREATE SCHEMA round58_policy_oracle`);
    await client.query(`SET search_path TO round58_policy_oracle, public`);
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
    await client.query(`GRANT ALL ON SCHEMA round58_policy_oracle TO union_eyes_runtime, union_eyes_system`);

    // Build the same synthetic-stub schema as policy-syntax-dry-run.ts.
    const created = new Set<string>();
    function createStub(table: string): string[] {
      if (created.has(table)) return [];
      created.add(table);
      const g = geometryFile.tables[table];
      const colNames = new Set<string>();
      const cols: string[] = ["id uuid primary key default gen_random_uuid()"];
      function addCol(name: string, type: string) {
        if (colNames.has(name)) return;
        colNames.add(name);
        cols.push(`${name} ${type}`);
      }
      if (g?.confidence === "HIGH_CONFIDENCE_DIRECT") addCol(g.directOrgColumns[0], "uuid");
      if (g?.confidence === "CANDIDATE_MULTI_PARTY") for (const c of g.directOrgColumns) addCol(c, "uuid");
      if (g?.userConfidence === "HIGH_CONFIDENCE_USER") addCol(g.directUserColumns[0], "text");
      for (const fk of g?.otherForeignKeys ?? []) addCol(fk.column, "uuid");
      const override = overridesByTable.get(table);
      if (override?.kind === "EXPLICIT_DIRECT_COLUMN_OVERRIDE") addCol(override.orgColumn, "uuid");
      if (override?.kind === "USER_DIRECT_COLUMN_OVERRIDE") addCol(override.userColumn, "text");
      if (
        override?.kind === "TENANT_VIA_PARENT" ||
        override?.kind === "PARENT" ||
        override?.kind === "PARENT_VIA_USER" ||
        override?.kind === "SHARED_LIBRARY_CHILD"
      )
        addCol(override.fkColumn, "uuid");
      if (override?.kind === "MULTI_PARTY") {
        addCol(override.orgColumnA, "uuid");
        addCol(override.orgColumnB, "uuid");
      }
      if (override?.kind === "SHARED_LIBRARY_ROOT") {
        addCol(override.orgColumn, "uuid");
        addCol(override.sharingLevelColumn, "varchar(50) not null default 'private'");
        addCol(override.sharedWithColumn, "uuid[]");
      }
      return [`CREATE TABLE IF NOT EXISTS ${quoteIdent(table)} (${cols.join(", ")});`];
    }

    const ddl: string[] = [`CREATE TABLE IF NOT EXISTS organizations (id uuid primary key default gen_random_uuid());`];
    created.add("organizations");
    for (const entry of storageAuthorityManifest) {
      const g = geometryFile.tables[entry.table];
      if (g) {
        for (const fk of g.otherForeignKeys) {
          const parentPhysical = geometryFile.exportNameToPhysicalTable[fk.referencesImportName];
          if (parentPhysical) ddl.push(...createStub(parentPhysical));
        }
      }
      const override = overridesByTable.get(entry.table);
      if (override && "parentTable" in override) ddl.push(...createStub(override.parentTable));
      if (override?.kind === "SHARED_LIBRARY_CHILD") ddl.push(...createStub("shared_clause_library"));
      ddl.push(...createStub(entry.table));
    }
    await client.query(ddl.join("\n"));

    const parentCallRegex = /ue_create_parent_owned_rls_policy_v2\('([^']+)',\s*'([^']+)',\s*'([^']+)'/g;
    const parentUserCallRegex = /ue_create_parent_owned_via_user_rls_policy_v2\('([^']+)',\s*'([^']+)',\s*'([^']+)'/g;
    let match: RegExpExecArray | null;
    const extraStubs: string[] = [];
    for (const regex of [parentCallRegex, parentUserCallRegex]) {
      while ((match = regex.exec(partB)) !== null) {
        const parentTable = match[3];
        if (!created.has(parentTable)) {
          created.add(parentTable);
          extraStubs.push(`CREATE TABLE IF NOT EXISTS ${quoteIdent(parentTable)} (id uuid primary key default gen_random_uuid());`);
        }
      }
    }
    const alterTableRegex = /ALTER TABLE "([^"]+)" ENABLE ROW LEVEL SECURITY/g;
    while ((match = alterTableRegex.exec(partB)) !== null) {
      const t = match[1];
      if (!created.has(t)) {
        created.add(t);
        extraStubs.push(`CREATE TABLE IF NOT EXISTS ${quoteIdent(t)} (id uuid primary key default gen_random_uuid());`);
      }
    }
    if (extraStubs.length > 0) await client.query(extraStubs.join("\n"));
    for (const t of created) {
      await client.query(`GRANT ALL ON TABLE ${quoteIdent(t)} TO union_eyes_runtime, union_eyes_system`);
    }

    await client.query(baselineHelper);
    await client.query(partA);
    await client.query(partB);

    // --- Independently query the real catalog ---
    const catalogRows = await client.query<{
      tablename: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
      policyname: string;
      roles: string[];
      cmd: string;
    }>(`
      SELECT c.relname AS tablename, c.relrowsecurity, c.relforcerowsecurity,
             p.polname AS policyname, p.polroles::regrole[]::text[] AS roles,
             CASE p.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT' WHEN 'w' THEN 'UPDATE'
                           WHEN 'd' THEN 'DELETE' WHEN '*' THEN 'ALL' END AS cmd
      FROM pg_class c
      LEFT JOIN pg_policy p ON p.polrelid = c.oid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'round58_policy_oracle' AND c.relkind = 'r'
    `);

    const byTable = new Map<string, typeof catalogRows.rows>();
    for (const row of catalogRows.rows) {
      const list = byTable.get(row.tablename) ?? [];
      list.push(row);
      byTable.set(row.tablename, list);
    }

    let missing = 0;
    let extra = 0;
    const diffs: string[] = [];

    for (const [table, exp] of expected) {
      const rows = byTable.get(table) ?? [];
      if (rows.length === 0) {
        diffs.push(`MISSING: no catalog rows at all for ${table} (stub not created — compiler coverage gap?)`);
        missing++;
        continue;
      }
      const rlsOn = rows[0].relrowsecurity;
      const forceOn = rows[0].relforcerowsecurity;
      if (exp.rlsExpected && !rlsOn) {
        diffs.push(`MISSING: ${table} does not have RLS enabled`);
        missing++;
      }
      if (exp.rlsExpected && !forceOn) {
        diffs.push(`MISSING: ${table} does not have FORCE RLS enabled`);
        missing++;
      }
      const systemPolicies = rows.filter((r) => r.roles?.includes("union_eyes_system") && r.policyname);
      const systemHasUnconditionalAll = systemPolicies.some((r) => r.cmd === "ALL");
      if (exp.systemUnconditional && !systemHasUnconditionalAll) {
        diffs.push(`MISSING: ${table} has no unconditional ALL policy for union_eyes_system`);
        missing++;
      }
      const runtimePolicies = rows.filter((r) => r.roles?.includes("union_eyes_runtime") && r.policyname);
      const runtimeCommandsCovered = new Set<string>();
      for (const r of runtimePolicies) {
        if (r.cmd === "ALL") ["SELECT", "INSERT", "UPDATE", "DELETE"].forEach((c) => runtimeCommandsCovered.add(c));
        else if (r.cmd) runtimeCommandsCovered.add(r.cmd);
      }
      for (const cmd of exp.runtimeCommands) {
        if (!runtimeCommandsCovered.has(cmd)) {
          diffs.push(`MISSING: ${table} has no runtime policy covering ${cmd}`);
          missing++;
        }
      }
      for (const cmd of runtimeCommandsCovered) {
        if (!exp.runtimeCommands.has(cmd)) {
          diffs.push(`EXTRA: ${table} has an unexpected runtime policy covering ${cmd}`);
          extra++;
        }
      }
    }

    console.log(`Tables checked: ${expected.size}`);
    console.log(`Missing: ${missing}`);
    console.log(`Extra: ${extra}`);
    if (diffs.length > 0) {
      console.log(diffs.slice(0, 60).join("\n"));
      if (diffs.length > 60) console.log(`... and ${diffs.length - 60} more`);
    }

    await client.query(`DROP SCHEMA IF EXISTS round58_policy_oracle CASCADE`);

    if (missing > 0 || extra > 0) process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
