/**
 * scripts/rls-enforcement/p4-disposable-fixture.ts
 *
 * Round 59C — P4_ROUND58_COMPLETE_GEOMETRY_PR_FINAL_EVIDENCE_CLOSURE.
 *
 * Builds a production-shape disposable fixture, in the TARGET database's
 * own `public` schema (not an isolated proof schema), sufficient for the
 * REAL apply-authority-enforcement-migration.ts + apply-round58-grant-
 * order-fix.ts + apply-round59-rls-geometry-gap-closure.ts +
 * p4-authority-state.ts (--mode=attest) + post-apply-verifier.ts scripts
 * to run to completion against a disposable local Postgres, honoring
 * their real success/failure paths rather than a manual SQL-equivalence
 * substitute.
 *
 * Table-stub generation mirrors full-migration-transactional-proof.ts's
 * proven stub builder (every table in storageAuthorityManifest, every FK
 * parent it references, every override parentTable/shared-library root,
 * plus every table named in a PART B `ue_create_parent_owned*` call or
 * `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` statement) — that builder is
 * already validated to be a complete superset of every table PART C's 795
 * GRANT statements reference, since that proof applies the FULL migration
 * (PART A+B+C+D+E) against exactly this stub set without error.
 *
 * On top of that generic stub set, this module adds the specific physical
 * geometry p4-authority-state.ts's `--mode=attest` requires:
 *   - `automation_rules.organization_id` as `varchar(255) NOT NULL` with
 *     canonical index `idx_automation_rules_org` (matching the real
 *     Django migration core.0003_automation_rules_organization_id, not the
 *     generic uuid stub column the transactional proof uses — that proof
 *     only needs a column to exist, not an exact production type/index).
 *   - `organizations.auth_provider_org_id` present, no `clerk_organization_id`.
 *   - `pilot_applications` commercial-terms columns.
 *   - a `django_migrations` ledger table with the four required rows.
 *
 * Never touches staging/production — callers are responsible for pointing
 * at a disposable/local database only.
 */
import postgres from "postgres";
import * as fs from "node:fs";
import * as path from "node:path";
import { storageAuthorityManifest } from "../../db/rls-storage-authority/index";
import { ENFORCEMENT_GEOMETRY_OVERRIDES } from "./enforcement-geometry-overrides";

const REPO_ROOT = path.resolve(__dirname, "../..");
const GEOMETRY_PATH = path.join(REPO_ROOT, "reports/union-eyes-rls-geometry.json");
const MIGRATION_PATH = path.join(REPO_ROOT, "db/migrations/20260910_rls_enforcement_expansion_round58.sql");
const BASELINE_MIGRATION_PATH = path.join(REPO_ROOT, "db/migrations/0108_rls_tenant_isolation_foundation.sql");

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function extractBaselineHelperFunctions(sql: string): string {
  const start = sql.indexOf("CREATE OR REPLACE FUNCTION ue_create_direct_org_rls_policy");
  const end = sql.indexOf("-- =", start + 10);
  if (start === -1 || end === -1) throw new Error("Could not locate ue_create_direct_org_rls_policy in 0108 migration");
  return sql.slice(start, end);
}

export async function buildP4DisposableFixture(sql: postgres.Sql): Promise<void> {
  const geometryFile = JSON.parse(fs.readFileSync(GEOMETRY_PATH, "utf8"));
  const overridesByTable = new Map(ENFORCEMENT_GEOMETRY_OVERRIDES.map((o) => [o.table, o]));
  const fullMigrationSql = fs.readFileSync(MIGRATION_PATH, "utf8");
  const partB = fullMigrationSql.slice(
    fullMigrationSql.indexOf("-- PART B —"),
    fullMigrationSql.indexOf("-- PART C —"),
  );

  await sql.unsafe(`
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
  await sql.unsafe(`GRANT ALL ON SCHEMA public TO union_eyes_runtime, union_eyes_system`);

  const baselineHelper = extractBaselineHelperFunctions(fs.readFileSync(BASELINE_MIGRATION_PATH, "utf8"));
  await sql.unsafe(baselineHelper);

  // Same synthetic-stub generation as full-migration-transactional-proof.ts,
  // but writing into the caller's default (public) schema.
  const created = new Set<string>();
  function createStub(table: string): string[] {
    if (created.has(table)) return [];
    if (table === "automation_rules" || table === "organizations" || table === "pilot_applications") {
      created.add(table);
      return [];
    }
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

  const ddl: string[] = [];
  created.add("organizations");
  created.add("automation_rules");
  created.add("pilot_applications");
  ddl.push(`CREATE TABLE IF NOT EXISTS organizations (
    id uuid primary key default gen_random_uuid(),
    auth_provider_org_id varchar(255)
  );`);
  ddl.push(`CREATE TABLE IF NOT EXISTS pilot_applications (
    id uuid primary key default gen_random_uuid(),
    verified_organization_id uuid,
    verified_member_count integer,
    verified_pilot_amount numeric(12,2),
    verified_subscription_plan_id uuid,
    commercial_terms_approved_by uuid,
    commercial_terms_approved_at timestamptz
  );`);
  ddl.push(`CREATE TABLE IF NOT EXISTS automation_rules (
    id uuid primary key default gen_random_uuid(),
    organization_id varchar(255) NOT NULL
  );`);
  ddl.push(`CREATE UNIQUE INDEX IF NOT EXISTS placeholder_idx_never_used ON organizations (id) WHERE false;`);
  ddl.push(`DROP INDEX IF EXISTS placeholder_idx_never_used;`);
  ddl.push(`CREATE INDEX IF NOT EXISTS idx_automation_rules_org ON automation_rules (organization_id);`);

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
  await sql.unsafe(ddl.join("\n"));

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
  if (extraStubs.length > 0) await sql.unsafe(extraStubs.join("\n"));

  for (const t of created) {
    await sql.unsafe(`GRANT ALL ON TABLE ${quoteIdent(t)} TO union_eyes_runtime, union_eyes_system`);
  }

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS django_migrations (
      id serial primary key,
      app varchar(255) NOT NULL,
      name varchar(255) NOT NULL,
      applied timestamptz NOT NULL DEFAULT now()
    );
    INSERT INTO django_migrations (app, name) VALUES
      ('auth_core', '0003_rename_clerk_organization_id'),
      ('content', '0002_pilotapplications_verified_organization'),
      ('content', '0003_pilotapplications_commercial_terms'),
      ('core', '0003_automation_rules_organization_id')
    ON CONFLICT DO NOTHING;
  `);
}
