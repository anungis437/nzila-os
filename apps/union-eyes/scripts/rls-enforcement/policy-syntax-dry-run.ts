/**
 * scripts/rls-enforcement/policy-syntax-dry-run.ts
 *
 * Round 58 Phase 1+ — broad syntax/semantic dry-run of PART B (the actual
 * 291 generated `SELECT ue_create_*_rls_policy(...)` calls) from
 * db/migrations/20260910_rls_enforcement_expansion_round58.sql, against a
 * disposable PostgreSQL server.
 *
 * For every resolved manifest entry, creates a minimal synthetic stub table
 * with exactly the column(s) reports/union-eyes-rls-geometry.json says that
 * table has (organization_id / user_id / the multi-party pair / a parent FK
 * column + a real parent stub table), then applies PART A (helper function
 * definitions) + PART B (every generated policy call) verbatim from the
 * committed migration file. A clean run with zero SQL errors proves the
 * compiler's generated SQL is syntactically and semantically valid at the
 * full 291-table scale — not just for the four representative fixtures the
 * behavioral test (rls-enforcement-helpers-behavioral.test.ts) exercises.
 *
 * This is a SYNTAX/APPLICATION proof, not a behavioral-isolation proof (the
 * stub tables are empty and structurally minimal) — see that separate test
 * file for the actual row-visibility behavioral assertions.
 *
 * Requires RLS_ENFORCEMENT_TEST_URL. Never touches staging/production.
 */
import { Client } from "pg";
import * as fs from "node:fs";
import * as path from "node:path";
import { storageAuthorityManifest } from "../../db/rls-storage-authority/index";

const REPO_ROOT = path.resolve(__dirname, "../..");
const MIGRATION_PATH = path.join(REPO_ROOT, "db/migrations/20260910_rls_enforcement_expansion_round58.sql");
const BASELINE_MIGRATION_PATH = path.join(REPO_ROOT, "db/migrations/0108_rls_tenant_isolation_foundation.sql");
const GEOMETRY_PATH = path.join(REPO_ROOT, "reports/union-eyes-rls-geometry.json");

function extractBaselineHelperFunctions(sql: string): string {
  // PART B calls 0108's own ue_create_direct_org_rls_policy — extract just
  // that CREATE OR REPLACE FUNCTION definition (not 0108's role
  // creation/grants/table-specific SELECT calls, which this dry-run's own
  // synthetic stub schema doesn't need).
  const start = sql.indexOf("CREATE OR REPLACE FUNCTION ue_create_direct_org_rls_policy");
  const end = sql.indexOf("-- =", start + 10);
  if (start === -1 || end === -1) {
    throw new Error("Could not locate ue_create_direct_org_rls_policy in 0108 migration");
  }
  return sql.slice(start, end);
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

async function main() {
  const url = process.env.RLS_ENFORCEMENT_TEST_URL;
  if (!url) {
    console.log("RLS_ENFORCEMENT_TEST_URL not set — skipping policy syntax dry-run.");
    process.exit(0);
  }

  const geometryFile = JSON.parse(fs.readFileSync(GEOMETRY_PATH, "utf8"));
  const migrationSql = fs.readFileSync(MIGRATION_PATH, "utf8");
  const baselineSql = fs.readFileSync(BASELINE_MIGRATION_PATH, "utf8");
  const baselineHelper = extractBaselineHelperFunctions(baselineSql);
  const partBStart = migrationSql.indexOf("-- PART B —");
  const partCStart = migrationSql.indexOf("-- PART C —");
  const partA = migrationSql.slice(0, partBStart);
  const partB = migrationSql.slice(partBStart, partCStart);

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    await client.query(`DROP SCHEMA IF EXISTS round58_policy_syntax CASCADE`);
    await client.query(`CREATE SCHEMA round58_policy_syntax`);
    await client.query(`SET search_path TO round58_policy_syntax, public`);
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
    await client.query(`GRANT ALL ON SCHEMA round58_policy_syntax TO union_eyes_runtime, union_eyes_system`);

    // Parse every table name this migration's Part B references, in
    // dependency order (parents before children), from the geometry file +
    // manifest, and create a minimal but STRUCTURALLY REAL stub for each.
    const created = new Set<string>();

    function createStub(table: string) {
      if (created.has(table)) return [];
      created.add(table);
      const g = geometryFile.tables[table];
      const cols: string[] = ["id uuid primary key default gen_random_uuid()"];
      if (g?.confidence === "HIGH_CONFIDENCE_DIRECT") cols.push(`${g.directOrgColumns[0]} uuid`);
      if (g?.confidence === "CANDIDATE_MULTI_PARTY") {
        for (const c of g.directOrgColumns) cols.push(`${c} uuid`);
      }
      if (g?.userConfidence === "HIGH_CONFIDENCE_USER") cols.push(`${g.directUserColumns[0]} text`);
      // Always add any FK columns too (a table can have BOTH a direct org
      // column and an FK to a parent — e.g. arbitrations has its own
      // organization_id AND a grievance_id FK, but the manifest still
      // classifies it PARENT_OWNED_RLS_REQUIRED, so the generated policy
      // references grievance_id, which must exist on the stub regardless
      // of which geometry "confidence" bucket the table fell into).
      for (const fk of g?.otherForeignKeys ?? []) {
        cols.push(`${fk.column} uuid`);
      }
      return [`CREATE TABLE IF NOT EXISTS ${quoteIdent(table)} (${cols.join(", ")});`];
    }

    const ddl: string[] = [];
    // organizations must exist for parent-owned chains that resolve there.
    ddl.push(`CREATE TABLE IF NOT EXISTS organizations (id uuid primary key default gen_random_uuid());`);
    created.add("organizations");

    for (const entry of storageAuthorityManifest) {
      const g = geometryFile.tables[entry.table];
      if (!g) continue;
      // Create any FK parent stub first (single-hop only, matching the compiler's own resolution).
      for (const fk of g.otherForeignKeys) {
        const parentPhysical = geometryFile.exportNameToPhysicalTable[fk.referencesImportName];
        if (parentPhysical) ddl.push(...createStub(parentPhysical));
      }
      ddl.push(...createStub(entry.table));
    }

    await client.query(ddl.join("\n"));

    // Belt-and-suspenders: some PARENT_OWNED_RLS_REQUIRED entries resolve to
    // a parent table not itself walked above (e.g. resolved via a different
    // FK-chain hop than the manifest-iteration order anticipated). Scan the
    // actual generated PART B text for every parent table name the v2
    // helper is called with, and ensure a stub exists for each.
    const parentCallRegex = /ue_create_parent_owned_rls_policy_v2\('([^']+)',\s*'([^']+)',\s*'([^']+)'/g;
    let match: RegExpExecArray | null;
    const extraStubs: string[] = [];
    while ((match = parentCallRegex.exec(partB)) !== null) {
      const parentTable = match[3];
      if (!created.has(parentTable)) {
        created.add(parentTable);
        extraStubs.push(`CREATE TABLE IF NOT EXISTS ${quoteIdent(parentTable)} (id uuid primary key default gen_random_uuid());`);
      }
    }
    // Also catch SYSTEM_ONLY and any other entries that emit direct
    // `ALTER TABLE "x" ENABLE ROW LEVEL SECURITY` SQL (not via a helper
    // function call) rather than a `ue_create_*` call.
    const alterTableRegex = /ALTER TABLE "([^"]+)" ENABLE ROW LEVEL SECURITY/g;
    while ((match = alterTableRegex.exec(partB)) !== null) {
      const t = match[1];
      if (!created.has(t)) {
        created.add(t);
        extraStubs.push(`CREATE TABLE IF NOT EXISTS ${quoteIdent(t)} (id uuid primary key default gen_random_uuid());`);
      }
    }
    if (extraStubs.length > 0) {
      await client.query(extraStubs.join("\n"));
    }

    for (const t of created) {
      await client.query(`GRANT ALL ON TABLE ${quoteIdent(t)} TO union_eyes_runtime, union_eyes_system`);
    }

    await client.query(baselineHelper);
    await client.query(partA);
    await client.query(partB);

    const policyCount = await client.query(
      `SELECT count(*)::int AS n FROM pg_policies WHERE schemaname = 'round58_policy_syntax'`
    );
    console.log(`Stub tables created: ${created.size}`);
    console.log(`Policies created: ${policyCount.rows[0].n}`);

    await client.query(`DROP SCHEMA IF EXISTS round58_policy_syntax CASCADE`);
    console.log("PART A + PART B applied with zero SQL errors.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("POLICY SYNTAX DRY-RUN FAILED:", err.message);
  process.exit(1);
});
