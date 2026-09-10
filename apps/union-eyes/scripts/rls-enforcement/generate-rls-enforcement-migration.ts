/**
 * scripts/rls-enforcement/generate-rls-enforcement-migration.ts
 *
 * Round 58 Phase 1+ — RLS Policy Compiler (step B) + Exact-GRANT Compiler
 * (step C), driven entirely by:
 *   - db/rls-storage-authority/index.ts's `storageAuthorityManifest` (the
 *     canonical, human-reviewed, per-table authority disposition — 700
 *     entries as of round 58a), and
 *   - reports/union-eyes-rls-geometry.json (the machine-derived physical
 *     column geometry from derive-table-geometry.ts, step A).
 *
 * OUTPUT: a single forward-only SQL migration file (never edits 0108 or any
 * historical migration) containing:
 *   PART A — four NEW generalized policy-helper functions, for policy
 *            shapes 0108 never needed (0108 only ever needed direct-org and
 *            a SINGLE hardcoded parent, message_threads):
 *     ue_create_parent_owned_rls_policy_v2(table, fk_column, parent_table,
 *       parent_org_column, parent_org_is_text) — like 0108's
 *       ue_create_parent_owned_rls_policy, but the parent table/column are
 *       parameters instead of being hardcoded to message_threads, so it can
 *       serve any of the (many) different parent tables in the manifest.
 *     ue_create_user_rls_policy(table, user_column) — scopes on
 *       app.current_user_id instead of app.current_org_id.
 *     ue_create_mixed_global_tenant_rls_policy(table, org_column) — read:
 *       global (NULL) OR own-org; insert/update/delete: own-org rows only,
 *       and WITH CHECK re-verifies org_column so a tenant can never author
 *       or reassign a row into the global (NULL) class.
 *     ue_create_multi_party_rls_policy(table, org_column_a, org_column_b) —
 *       read: either party's org matches; insert/update/delete: NO tenant
 *       policy at all (system-authority-only, per this classification's own
 *       doctrine in types.ts — "writes require a genuinely separate
 *       system/platform authority not assumed from ordinary tenant
 *       authentication").
 *   PART B — one `SELECT ue_create_*_rls_policy(...)` (or, for SYSTEM_ONLY,
 *            inline ENABLE/FORCE RLS + a system-only policy, matching
 *            0108's own cross_org_access_log precedent) per manifest entry
 *            whose classification requires RLS AND whose geometry was
 *            resolved with HIGH confidence. Entries already covered by 0108
 *            (classification-tagged baseline-0108 entries) are skipped here
 *            — 0108 remains their sole source of policy truth.
 *   PART C — exact GRANT compiler: for EVERY entry in the manifest (all
 *            700), REVOKE ALL then grant exactly
 *            requiredRuntimePrivileges/requiredSystemPrivileges to
 *            union_eyes_runtime/union_eyes_system respectively. This is
 *            what finally lets a follow-up migration remove 0108's
 *            predecessor blanket `GRANT ALL ON ALL TABLES IN SCHEMA public`
 *            (NOT done in this migration — see the blockers report; the
 *            blanket grant is left in place until 100% of the 700 tables
 *            have a resolved geometry or an explicit hand-authored
 *            exception, so removing it now would be a silent regression for
 *            the ~170 unresolved/blocked tables).
 *
 * Every table the compiler could NOT confidently resolve (unresolved
 * geometry, ambiguous multi-column, or a PARENT_OWNED chain whose parent
 * itself lacks resolved geometry) is recorded — NOT silently skipped or
 * guessed — in reports/union-eyes-rls-enforcement-blockers.json.
 *
 * See db/__tests__/rls-enforcement-helpers-behavioral.test.ts for the
 * disposable-PostgreSQL behavioral proof of the four new helper functions,
 * scripts/rls-enforcement/policy-syntax-dry-run.ts for the PART A+B
 * syntax/application dry-run against a broad synthetic-stub schema (all 291
 * generated policy calls), and scripts/rls-enforcement/acl-oracle-dry-run.ts
 * for the independent PART C GRANT oracle (all 700 manifest entries).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { storageAuthorityManifest, type StorageAuthorityEntry } from "../../db/rls-storage-authority/index";
import { ENFORCEMENT_GEOMETRY_OVERRIDES } from "./enforcement-geometry-overrides";

const REPO_ROOT = path.resolve(__dirname, "../..");
const GEOMETRY_PATH = path.join(REPO_ROOT, "reports/union-eyes-rls-geometry.json");
// Overridable via env vars so scripts/rls-enforcement/check-enforcement-drift.ts
// can regenerate into a disposable temp location instead of overwriting the
// committed files, without needing any CLI-arg parsing here.
const OUTPUT_MIGRATION_PATH = process.env.RLS_ENFORCEMENT_OUT_MIGRATION
  ? path.resolve(process.env.RLS_ENFORCEMENT_OUT_MIGRATION)
  : path.join(REPO_ROOT, "db/migrations/20260910_rls_enforcement_expansion_round58.sql");
const BLOCKERS_PATH = process.env.RLS_ENFORCEMENT_OUT_BLOCKERS
  ? path.resolve(process.env.RLS_ENFORCEMENT_OUT_BLOCKERS)
  : path.join(REPO_ROOT, "reports/union-eyes-rls-enforcement-blockers.json");

// Tables whose RLS policy is already fully owned by 0108 — never re-declare
// here (0108 remains sole source of truth for these).
const BASELINE_0108_TABLES = new Set([
  "organization_members",
  "organizations",
  "grievances",
  "claims",
  "grievance_deadlines",
  "documents",
  "member_documents",
  "workplace_incidents",
  "safety_inspections",
  "hazard_reports",
  "safety_committee_meetings",
  "safety_training_records",
  "ppe_equipment",
  "safety_audits",
  "injury_logs",
  "safety_policies",
  "corrective_actions",
  "safety_certifications",
  "message_threads",
  "messages",
  "message_participants",
  "message_read_receipts",
  "message_notifications",
  "cross_org_access_log",
]);

type Geometry = {
  physicalTable: string;
  sourceFile: string;
  directOrgColumns: string[];
  directUserColumns: string[];
  otherForeignKeys: Array<{ column: string; referencesImportName: string }>;
  confidence: "HIGH_CONFIDENCE_DIRECT" | "CANDIDATE_MULTI_PARTY" | "NO_DIRECT_ORG_COLUMN" | "UNRESOLVED";
  userConfidence: "HIGH_CONFIDENCE_USER" | "CANDIDATE_MULTI_USER" | "NO_USER_COLUMN";
};

type GeometryFile = {
  tables: Record<string, Geometry>;
  exportNameToPhysicalTable: Record<string, string>;
};

type Blocker = { table: string; classification: string; reason: string };

const RLS_HELPER_FUNCTIONS_SQL = `
-- =============================================================================
-- Round 58 Phase 1+ — generalized policy-helper functions for classification
-- shapes 0108 did not need. Each mirrors 0108's own ue_create_direct_org_rls_
-- policy / ue_create_parent_owned_rls_policy pattern: idempotent (DROP POLICY
-- IF EXISTS before CREATE), fail-closed (no policy => union_eyes_runtime sees
-- zero rows), and grants union_eyes_system unconditional access via a
-- separate, role-membership-gated policy (never inferred from session state).
-- =============================================================================

CREATE OR REPLACE FUNCTION ue_create_parent_owned_rls_policy_v2(
  p_table_name TEXT,
  p_fk_column TEXT,
  p_parent_table TEXT,
  p_parent_org_column TEXT DEFAULT 'organization_id',
  p_parent_org_is_text BOOLEAN DEFAULT FALSE
) RETURNS VOID AS $$
DECLARE
  v_cast TEXT := CASE WHEN p_parent_org_is_text THEN '' ELSE '::text' END;
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', p_table_name);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', p_table_name);

  EXECUTE format('DROP POLICY IF EXISTS ue_parent_org_isolation_v2 ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', p_table_name);

  EXECUTE format(
    'CREATE POLICY ue_parent_org_isolation_v2 ON %I FOR ALL TO union_eyes_runtime ' ||
    'USING (EXISTS (SELECT 1 FROM %I parent WHERE parent.id = %I.%I ' ||
    '  AND parent.%I%s = current_setting(''app.current_org_id'', true))) ' ||
    'WITH CHECK (EXISTS (SELECT 1 FROM %I parent WHERE parent.id = %I.%I ' ||
    '  AND parent.%I%s = current_setting(''app.current_org_id'', true)))',
    p_table_name, p_parent_table, p_table_name, p_fk_column, p_parent_org_column, v_cast,
    p_parent_table, p_table_name, p_fk_column, p_parent_org_column, v_cast
  );
  EXECUTE format(
    'CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)',
    p_table_name
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION ue_create_user_rls_policy(
  p_table_name TEXT,
  p_user_column TEXT DEFAULT 'user_id'
) RETURNS VOID AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', p_table_name);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', p_table_name);

  EXECUTE format('DROP POLICY IF EXISTS ue_user_isolation_select ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_user_isolation_insert ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_user_isolation_update ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_user_isolation_delete ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', p_table_name);

  -- Round 59 staging proof fix: ai_copilot_sessions.user_id is UUID (not
  -- every user_id column in this codebase is TEXT like the Clerk-to-Entra
  -- id columns), and Postgres has no uuid = text operator. Cast the column
  -- to text unconditionally (a no-op for columns already TEXT) — same
  -- defensive pattern every other policy-helper function in this file
  -- already uses for its org_id comparisons.
  EXECUTE format(
    'CREATE POLICY ue_user_isolation_select ON %I FOR SELECT TO union_eyes_runtime ' ||
    'USING (%I::text = current_setting(''app.current_user_id'', true))',
    p_table_name, p_user_column
  );
  EXECUTE format(
    'CREATE POLICY ue_user_isolation_insert ON %I FOR INSERT TO union_eyes_runtime ' ||
    'WITH CHECK (%I::text = current_setting(''app.current_user_id'', true))',
    p_table_name, p_user_column
  );
  EXECUTE format(
    'CREATE POLICY ue_user_isolation_update ON %I FOR UPDATE TO union_eyes_runtime ' ||
    'USING (%I::text = current_setting(''app.current_user_id'', true)) ' ||
    'WITH CHECK (%I::text = current_setting(''app.current_user_id'', true))',
    p_table_name, p_user_column, p_user_column
  );
  EXECUTE format(
    'CREATE POLICY ue_user_isolation_delete ON %I FOR DELETE TO union_eyes_runtime ' ||
    'USING (%I::text = current_setting(''app.current_user_id'', true))',
    p_table_name, p_user_column
  );
  EXECUTE format(
    'CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)',
    p_table_name
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION ue_create_mixed_global_tenant_rls_policy(
  p_table_name TEXT,
  p_org_column TEXT DEFAULT 'organization_id'
) RETURNS VOID AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', p_table_name);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', p_table_name);

  EXECUTE format('DROP POLICY IF EXISTS ue_mixed_global_select ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_mixed_global_insert ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_mixed_global_update ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_mixed_global_delete ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', p_table_name);

  -- Reads: global (NULL) rows OR the caller's own org's rows.
  EXECUTE format(
    'CREATE POLICY ue_mixed_global_select ON %I FOR SELECT TO union_eyes_runtime ' ||
    'USING (%I IS NULL OR %I::text = current_setting(''app.current_org_id'', true))',
    p_table_name, p_org_column, p_org_column
  );
  -- Writes: a tenant may only author/mutate/delete ITS OWN rows — never a
  -- NULL/global row, and WITH CHECK re-verifies the same predicate so a
  -- tenant cannot reassign a row into (or out of) the global class.
  EXECUTE format(
    'CREATE POLICY ue_mixed_global_insert ON %I FOR INSERT TO union_eyes_runtime ' ||
    'WITH CHECK (%I::text = current_setting(''app.current_org_id'', true))',
    p_table_name, p_org_column
  );
  EXECUTE format(
    'CREATE POLICY ue_mixed_global_update ON %I FOR UPDATE TO union_eyes_runtime ' ||
    'USING (%I::text = current_setting(''app.current_org_id'', true)) ' ||
    'WITH CHECK (%I::text = current_setting(''app.current_org_id'', true))',
    p_table_name, p_org_column, p_org_column
  );
  EXECUTE format(
    'CREATE POLICY ue_mixed_global_delete ON %I FOR DELETE TO union_eyes_runtime ' ||
    'USING (%I::text = current_setting(''app.current_org_id'', true))',
    p_table_name, p_org_column
  );
  EXECUTE format(
    'CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)',
    p_table_name
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION ue_create_multi_party_rls_policy(
  p_table_name TEXT,
  p_org_column_a TEXT,
  p_org_column_b TEXT
) RETURNS VOID AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', p_table_name);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', p_table_name);

  EXECUTE format('DROP POLICY IF EXISTS ue_multi_party_select ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', p_table_name);

  -- Reads: either named party may see the row. NO tenant-facing INSERT/
  -- UPDATE/DELETE policy is created at all — per this classification's own
  -- doctrine (types.ts), writes require a genuinely separate system/
  -- platform authority, never assumed from ordinary tenant authentication.
  -- Falling through with no policy means union_eyes_runtime's writes are
  -- fail-closed-denied by RLS (FORCE RLS + no permissive write policy).
  EXECUTE format(
    'CREATE POLICY ue_multi_party_select ON %I FOR SELECT TO union_eyes_runtime ' ||
    'USING (%I::text = current_setting(''app.current_org_id'', true) ' ||
    '    OR %I::text = current_setting(''app.current_org_id'', true))',
    p_table_name, p_org_column_a, p_org_column_b
  );
  EXECUTE format(
    'CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)',
    p_table_name
  );
END;
$$ LANGUAGE plpgsql;

-- Round 58C additions ---------------------------------------------------

CREATE OR REPLACE FUNCTION ue_create_parent_owned_via_user_rls_policy_v2(
  p_table_name TEXT,
  p_fk_column TEXT,
  p_parent_table TEXT,
  p_parent_user_column TEXT DEFAULT 'user_id'
) RETURNS VOID AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', p_table_name);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', p_table_name);

  EXECUTE format('DROP POLICY IF EXISTS ue_parent_user_isolation_v2 ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', p_table_name);

  -- Same shape as ue_create_parent_owned_rls_policy_v2, but the parent's
  -- own authority column is a USER identity (app.current_user_id), not an
  -- organization (e.g. workbooks' claimed_by_user_id) — used for tables
  -- whose USER_RLS_REQUIRED authority is only reachable through a parent.
  -- Round 59 staging proof fix: cast the parent's user column to text
  -- unconditionally (no-op if already TEXT) — see ue_create_user_rls_policy.
  EXECUTE format(
    'CREATE POLICY ue_parent_user_isolation_v2 ON %I FOR ALL TO union_eyes_runtime ' ||
    'USING (EXISTS (SELECT 1 FROM %I parent WHERE parent.id = %I.%I ' ||
    '  AND parent.%I::text = current_setting(''app.current_user_id'', true))) ' ||
    'WITH CHECK (EXISTS (SELECT 1 FROM %I parent WHERE parent.id = %I.%I ' ||
    '  AND parent.%I::text = current_setting(''app.current_user_id'', true)))',
    p_table_name, p_parent_table, p_table_name, p_fk_column, p_parent_user_column,
    p_parent_table, p_table_name, p_fk_column, p_parent_user_column
  );
  EXECUTE format(
    'CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)',
    p_table_name
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION ue_create_shared_library_rls_policy(
  p_table_name TEXT,
  p_org_column TEXT,
  p_sharing_level_column TEXT,
  p_shared_with_column TEXT
) RETURNS VOID AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', p_table_name);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', p_table_name);

  EXECUTE format('DROP POLICY IF EXISTS ue_shared_library_select ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_shared_library_insert ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_shared_library_update ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_shared_library_delete ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', p_table_name);

  -- Reads: owner org, OR explicitly shared-with org, OR sharing_level =
  -- 'public'. 'federation'/'congress' sharing levels are deliberately NOT
  -- given any additional visibility beyond owner/shared-with/public — no
  -- federation/congress-membership table exists in this schema to resolve
  -- them against (round 58c finding); this is a safe, under-permissive
  -- default, not a broadening of access.
  EXECUTE format(
    'CREATE POLICY ue_shared_library_select ON %I FOR SELECT TO union_eyes_runtime ' ||
    'USING (%I::text = current_setting(''app.current_org_id'', true) ' ||
    '    OR current_setting(''app.current_org_id'', true)::uuid = ANY(%I) ' ||
    '    OR %I = ''public'')',
    p_table_name, p_org_column, p_shared_with_column, p_sharing_level_column
  );
  -- Writes: owner org only — shared/public readability never confers
  -- source mutation authority.
  EXECUTE format(
    'CREATE POLICY ue_shared_library_insert ON %I FOR INSERT TO union_eyes_runtime ' ||
    'WITH CHECK (%I::text = current_setting(''app.current_org_id'', true))',
    p_table_name, p_org_column
  );
  EXECUTE format(
    'CREATE POLICY ue_shared_library_update ON %I FOR UPDATE TO union_eyes_runtime ' ||
    'USING (%I::text = current_setting(''app.current_org_id'', true)) ' ||
    'WITH CHECK (%I::text = current_setting(''app.current_org_id'', true))',
    p_table_name, p_org_column, p_org_column
  );
  EXECUTE format(
    'CREATE POLICY ue_shared_library_delete ON %I FOR DELETE TO union_eyes_runtime ' ||
    'USING (%I::text = current_setting(''app.current_org_id'', true))',
    p_table_name, p_org_column
  );
  EXECUTE format(
    'CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)',
    p_table_name
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION ue_create_shared_library_child_rls_policy(
  p_table_name TEXT,
  p_fk_column TEXT
) RETURNS VOID AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', p_table_name);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', p_table_name);

  EXECUTE format('DROP POLICY IF EXISTS ue_shared_library_child_select ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_shared_library_child_write ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', p_table_name);

  -- A child row (e.g. clause_library_tags) is visible/writable exactly
  -- when the parent shared_clause_library row it tags would itself be
  -- visible/writable under ue_create_shared_library_rls_policy's own
  -- predicate — hardcoded here because there is exactly one such parent
  -- table in this schema.
  EXECUTE format(
    'CREATE POLICY ue_shared_library_child_select ON %I FOR SELECT TO union_eyes_runtime ' ||
    'USING (EXISTS (SELECT 1 FROM shared_clause_library parent WHERE parent.id = %I.%I ' ||
    '  AND (parent.source_organization_id::text = current_setting(''app.current_org_id'', true) ' ||
    '    OR current_setting(''app.current_org_id'', true)::uuid = ANY(parent.shared_with_org_ids) ' ||
    '    OR parent.sharing_level = ''public'')))',
    p_table_name, p_table_name, p_fk_column
  );
  EXECUTE format(
    'CREATE POLICY ue_shared_library_child_write ON %I FOR ALL TO union_eyes_runtime ' ||
    'USING (EXISTS (SELECT 1 FROM shared_clause_library parent WHERE parent.id = %I.%I ' ||
    '  AND parent.source_organization_id::text = current_setting(''app.current_org_id'', true))) ' ||
    'WITH CHECK (EXISTS (SELECT 1 FROM shared_clause_library parent WHERE parent.id = %I.%I ' ||
    '  AND parent.source_organization_id::text = current_setting(''app.current_org_id'', true)))',
    p_table_name, p_table_name, p_fk_column, p_table_name, p_fk_column
  );
  EXECUTE format(
    'CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)',
    p_table_name
  );
END;
$$ LANGUAGE plpgsql;
`;

function sqlQuoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function resolveParentGeometry(
  entry: StorageAuthorityEntry,
  geometryFile: GeometryFile,
  blockers: Blocker[]
): { parentTable: string; parentOrgColumn: string; parentOrgIsText: boolean; fkColumn: string } | null {
  const g = geometryFile.tables[entry.table];
  if (!g || g.otherForeignKeys.length === 0) {
    blockers.push({ table: entry.table, classification: entry.classification, reason: "NO_FK_CANDIDATE_FOUND" });
    return null;
  }
  if (g.otherForeignKeys.length > 1) {
    blockers.push({
      table: entry.table,
      classification: entry.classification,
      reason: `AMBIGUOUS_PARENT_CANDIDATES: ${g.otherForeignKeys.map((f) => f.column).join(", ")}`,
    });
    return null;
  }
  const fk = g.otherForeignKeys[0];
  const parentPhysicalTable = geometryFile.exportNameToPhysicalTable[fk.referencesImportName];
  if (!parentPhysicalTable) {
    blockers.push({
      table: entry.table,
      classification: entry.classification,
      reason: `PARENT_EXPORT_NOT_RESOLVED: ${fk.referencesImportName}`,
    });
    return null;
  }
  // organization_members/organizations are themselves special-cased in 0108
  // (their "org column" is `id`/a TEXT organization_id) — reuse that here
  // rather than requiring a HIGH_CONFIDENCE_DIRECT match for them.
  if (parentPhysicalTable === "organizations") {
    return { parentTable: "organizations", parentOrgColumn: "id", parentOrgIsText: false, fkColumn: fk.column };
  }
  const parentGeom = geometryFile.tables[parentPhysicalTable];
  if (!parentGeom || parentGeom.confidence !== "HIGH_CONFIDENCE_DIRECT") {
    blockers.push({
      table: entry.table,
      classification: entry.classification,
      reason: `PARENT_OF_PARENT_UNRESOLVED: parent=${parentPhysicalTable} confidence=${parentGeom?.confidence ?? "MISSING"}`,
    });
    return null;
  }
  return {
    parentTable: parentPhysicalTable,
    parentOrgColumn: parentGeom.directOrgColumns[0],
    parentOrgIsText: false,
    fkColumn: fk.column,
  };
}

function main() {
  const geometryFile: GeometryFile = JSON.parse(fs.readFileSync(GEOMETRY_PATH, "utf8"));
  const blockers: Blocker[] = [];
  const policyStatements: string[] = [];
  const grantStatements: string[] = [];
  let policiesGenerated = 0;
  let grantsGenerated = 0;

  const overridesByTable = new Map<string, typeof ENFORCEMENT_GEOMETRY_OVERRIDES[number]>();
  for (const override of ENFORCEMENT_GEOMETRY_OVERRIDES) {
    if (overridesByTable.has(override.table)) {
      throw new Error(`Duplicate ENFORCEMENT_GEOMETRY_OVERRIDES entry for table "${override.table}"`);
    }
    overridesByTable.set(override.table, override);
  }

  // Contradiction checks (Round 58C section 6): an override's kind must be
  // compatible with the manifest's own classification for that table. This
  // registry never makes a privilege or classification decision — it only
  // describes geometry already implied by the classification.
  const manifestByTable = new Map(storageAuthorityManifest.map((e) => [e.table, e]));
  const KIND_TO_ALLOWED_CLASSIFICATIONS: Record<string, string[]> = {
    EXPLICIT_DIRECT_COLUMN_OVERRIDE: ["TENANT_RLS_REQUIRED"],
    USER_DIRECT_COLUMN_OVERRIDE: ["USER_RLS_REQUIRED"],
    TENANT_VIA_PARENT: ["TENANT_RLS_REQUIRED"],
    PARENT: ["PARENT_OWNED_RLS_REQUIRED"],
    PARENT_VIA_USER: ["PARENT_OWNED_RLS_REQUIRED"],
    MULTI_PARTY: ["MULTI_PARTY_RLS_REQUIRED"],
    SHARED_LIBRARY_ROOT: ["MULTI_PARTY_RLS_REQUIRED"],
    SHARED_LIBRARY_CHILD: ["MULTI_PARTY_RLS_REQUIRED"],
  };
  for (const override of ENFORCEMENT_GEOMETRY_OVERRIDES) {
    const manifestEntry = manifestByTable.get(override.table);
    if (!manifestEntry) {
      throw new Error(
        `ENFORCEMENT_GEOMETRY_OVERRIDES references table "${override.table}" which does not exist in storageAuthorityManifest`
      );
    }
    const allowed = KIND_TO_ALLOWED_CLASSIFICATIONS[override.kind] ?? [];
    if (!allowed.includes(manifestEntry.classification)) {
      throw new Error(
        `ENFORCEMENT_GEOMETRY_OVERRIDES contradiction: table "${override.table}" has override kind ` +
          `"${override.kind}" but manifest classification is "${manifestEntry.classification}" ` +
          `(expected one of: ${allowed.join(", ")}). Fix the override or the manifest — never guess.`
      );
    }
  }

  for (const entry of storageAuthorityManifest) {
    // --- PART B: RLS policy generation ---
    if (BASELINE_0108_TABLES.has(entry.table)) {
      // Already governed by 0108 — GRANTs below still apply to it.
    } else if (entry.classification === "TENANT_RLS_REQUIRED") {
      const override = overridesByTable.get(entry.table);
      if (override?.kind === "EXPLICIT_DIRECT_COLUMN_OVERRIDE") {
        policyStatements.push(
          `SELECT ue_create_direct_org_rls_policy(${sqlQuoteLiteral(entry.table)}, ${sqlQuoteLiteral(
            override.orgColumn
          )}, FALSE);`
        );
        policiesGenerated++;
      } else if (override?.kind === "TENANT_VIA_PARENT") {
        const parentGeom = geometryFile.tables[override.parentTable];
        if (!parentGeom || parentGeom.confidence !== "HIGH_CONFIDENCE_DIRECT") {
          blockers.push({
            table: entry.table,
            classification: entry.classification,
            reason: `OVERRIDE_PARENT_UNRESOLVED: parent=${override.parentTable} confidence=${parentGeom?.confidence ?? "MISSING"}`,
          });
        } else {
          policyStatements.push(
            `SELECT ue_create_parent_owned_rls_policy_v2(${sqlQuoteLiteral(entry.table)}, ${sqlQuoteLiteral(
              override.fkColumn
            )}, ${sqlQuoteLiteral(override.parentTable)}, ${sqlQuoteLiteral(parentGeom.directOrgColumns[0])}, FALSE);`
          );
          policiesGenerated++;
        }
      } else {
        const g = geometryFile.tables[entry.table];
        if (g && g.confidence === "HIGH_CONFIDENCE_DIRECT") {
          policyStatements.push(
            `SELECT ue_create_direct_org_rls_policy(${sqlQuoteLiteral(entry.table)}, ${sqlQuoteLiteral(
              g.directOrgColumns[0]
            )}, FALSE);`
          );
          policiesGenerated++;
        } else {
          blockers.push({
            table: entry.table,
            classification: entry.classification,
            reason: `UNRESOLVED_DIRECT_ORG_GEOMETRY: confidence=${g?.confidence ?? "MISSING"}`,
          });
        }
      }
    } else if (entry.classification === "PARENT_OWNED_RLS_REQUIRED") {
      const override = overridesByTable.get(entry.table);
      if (override?.kind === "PARENT") {
        const parentGeom = geometryFile.tables[override.parentTable];
        if (!parentGeom || parentGeom.confidence !== "HIGH_CONFIDENCE_DIRECT") {
          blockers.push({
            table: entry.table,
            classification: entry.classification,
            reason: `OVERRIDE_PARENT_UNRESOLVED: parent=${override.parentTable} confidence=${parentGeom?.confidence ?? "MISSING"}`,
          });
        } else {
          policyStatements.push(
            `SELECT ue_create_parent_owned_rls_policy_v2(${sqlQuoteLiteral(entry.table)}, ${sqlQuoteLiteral(
              override.fkColumn
            )}, ${sqlQuoteLiteral(override.parentTable)}, ${sqlQuoteLiteral(parentGeom.directOrgColumns[0])}, FALSE);`
          );
          policiesGenerated++;
        }
      } else if (override?.kind === "PARENT_VIA_USER") {
        policyStatements.push(
          `SELECT ue_create_parent_owned_via_user_rls_policy_v2(${sqlQuoteLiteral(
            entry.table
          )}, ${sqlQuoteLiteral(override.fkColumn)}, ${sqlQuoteLiteral(override.parentTable)}, ${sqlQuoteLiteral(
            override.parentUserColumn
          )});`
        );
        policiesGenerated++;
      } else {
        const parent = resolveParentGeometry(entry, geometryFile, blockers);
        if (parent) {
          policyStatements.push(
            `SELECT ue_create_parent_owned_rls_policy_v2(${sqlQuoteLiteral(entry.table)}, ${sqlQuoteLiteral(
              parent.fkColumn
            )}, ${sqlQuoteLiteral(parent.parentTable)}, ${sqlQuoteLiteral(parent.parentOrgColumn)}, ${
              parent.parentOrgIsText ? "TRUE" : "FALSE"
            });`
          );
          policiesGenerated++;
        }
      }
    } else if (entry.classification === "USER_RLS_REQUIRED") {
      const override = overridesByTable.get(entry.table);
      if (override?.kind === "USER_DIRECT_COLUMN_OVERRIDE") {
        policyStatements.push(
          `SELECT ue_create_user_rls_policy(${sqlQuoteLiteral(entry.table)}, ${sqlQuoteLiteral(
            override.userColumn
          )});`
        );
        policiesGenerated++;
      } else {
        const g = geometryFile.tables[entry.table];
        if (g && g.userConfidence === "HIGH_CONFIDENCE_USER") {
          policyStatements.push(
            `SELECT ue_create_user_rls_policy(${sqlQuoteLiteral(entry.table)}, ${sqlQuoteLiteral(
              g.directUserColumns[0]
            )});`
          );
          policiesGenerated++;
        } else {
          blockers.push({
            table: entry.table,
            classification: entry.classification,
            reason: `UNRESOLVED_USER_GEOMETRY: userConfidence=${g?.userConfidence ?? "MISSING"}`,
          });
        }
      }
    } else if (entry.classification === "MIXED_GLOBAL_TENANT_RLS_REQUIRED") {
      const g = geometryFile.tables[entry.table];
      if (g && g.confidence === "HIGH_CONFIDENCE_DIRECT") {
        policyStatements.push(
          `SELECT ue_create_mixed_global_tenant_rls_policy(${sqlQuoteLiteral(entry.table)}, ${sqlQuoteLiteral(
            g.directOrgColumns[0]
          )});`
        );
        policiesGenerated++;
      } else {
        blockers.push({
          table: entry.table,
          classification: entry.classification,
          reason: `UNRESOLVED_MIXED_GLOBAL_GEOMETRY: confidence=${g?.confidence ?? "MISSING"}`,
        });
      }
    } else if (entry.classification === "MULTI_PARTY_RLS_REQUIRED") {
      const override = overridesByTable.get(entry.table);
      if (override?.kind === "MULTI_PARTY") {
        policyStatements.push(
          `SELECT ue_create_multi_party_rls_policy(${sqlQuoteLiteral(entry.table)}, ${sqlQuoteLiteral(
            override.orgColumnA
          )}, ${sqlQuoteLiteral(override.orgColumnB)});`
        );
        policiesGenerated++;
      } else if (override?.kind === "SHARED_LIBRARY_ROOT") {
        policyStatements.push(
          `SELECT ue_create_shared_library_rls_policy(${sqlQuoteLiteral(entry.table)}, ${sqlQuoteLiteral(
            override.orgColumn
          )}, ${sqlQuoteLiteral(override.sharingLevelColumn)}, ${sqlQuoteLiteral(override.sharedWithColumn)});`
        );
        policiesGenerated++;
      } else if (override?.kind === "SHARED_LIBRARY_CHILD") {
        policyStatements.push(
          `SELECT ue_create_shared_library_child_rls_policy(${sqlQuoteLiteral(entry.table)}, ${sqlQuoteLiteral(
            override.fkColumn
          )});`
        );
        policiesGenerated++;
      } else {
        const g = geometryFile.tables[entry.table];
        if (g && g.confidence === "CANDIDATE_MULTI_PARTY" && g.directOrgColumns.length === 2) {
          policyStatements.push(
            `SELECT ue_create_multi_party_rls_policy(${sqlQuoteLiteral(entry.table)}, ${sqlQuoteLiteral(
              g.directOrgColumns[0]
            )}, ${sqlQuoteLiteral(g.directOrgColumns[1])});`
          );
          policiesGenerated++;
        } else {
          blockers.push({
            table: entry.table,
            classification: entry.classification,
            reason: `UNRESOLVED_MULTI_PARTY_GEOMETRY: confidence=${g?.confidence ?? "MISSING"} orgColumns=${JSON.stringify(
              g?.directOrgColumns ?? []
            )}`,
          });
        }
      }
    } else if (entry.classification === "SYSTEM_ONLY") {
      // Round 59 staging proof fix: guard on table existence, same as every
      // other classification's emission below — 795 manifest entries include
      // many not yet physically deployed to every environment (financial-
      // service LATENT_UNREACHABLE tables, feature-gated CBA-intelligence/
      // payroll/voting tables not yet migrated to a given target, etc). A
      // fixed SQL statement referencing a table that doesn't exist in THIS
      // environment must not hard-fail the whole migration.
      policyStatements.push(
        `DO $$ BEGIN\n` +
          `  IF to_regclass('public.' || ${sqlQuoteLiteral(entry.table)}) IS NOT NULL THEN\n` +
          `    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', ${sqlQuoteLiteral(entry.table)});\n` +
          `    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', ${sqlQuoteLiteral(entry.table)});\n` +
          `    EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', ${sqlQuoteLiteral(entry.table)});\n` +
          `    EXECUTE format('CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)', ${sqlQuoteLiteral(entry.table)});\n` +
          `  END IF;\n` +
          `END $$;`
      );
      policiesGenerated++;
    }
    // GLOBAL_REFERENCE_DATA, APP_SCOPED_NON_SENSITIVE, SEPARATE_DATABASE_BOUNDARY,
    // LATENT_UNREACHABLE, CONTAINED_NO_AUTHORITY: no RLS by classification doctrine.

    // --- PART C: exact GRANT generation (every entry, unconditionally) ---
    // requiredRuntimePrivileges/requiredSystemPrivileges can be the literal
    // sentinel "TBD" for manifest entries the human reviewers haven't yet
    // finalized a privilege set for — treat that as "no privileges" (REVOKE
    // ALL only, no GRANT), matching the compiler's fail-closed doctrine of
    // never guessing an un-finalized authority decision.
    const runtimePrivs = entry.requiredRuntimePrivileges === "TBD" ? [] : entry.requiredRuntimePrivileges ?? [];
    const systemPrivs = entry.requiredSystemPrivileges === "TBD" ? [] : entry.requiredSystemPrivileges ?? [];
    // Round 59 staging proof fix: guard the whole per-table GRANT/REVOKE
    // block on table existence (to_regclass), same rationale as the
    // SYSTEM_ONLY policy guard above — discovered live against staging
    // (171 of 795 manifest tables not physically present there; a fixed
    // REVOKE/GRANT on a nonexistent relation previously hard-failed the
    // entire atomic migration instead of being a no-op for that table).
    const lines: string[] = [];
    lines.push(`DO $$ BEGIN`);
    lines.push(`  IF to_regclass('public.' || ${sqlQuoteLiteral(entry.table)}) IS NOT NULL THEN`);
    lines.push(
      `    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', ${sqlQuoteLiteral(entry.table)});`
    );
    lines.push(
      `    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', ${sqlQuoteLiteral(entry.table)});`
    );
    if (runtimePrivs.length > 0) {
      lines.push(
        `    EXECUTE format('GRANT ${runtimePrivs.join(
          ", "
        )} ON TABLE %I TO union_eyes_runtime', ${sqlQuoteLiteral(entry.table)});`
      );
    }
    if (systemPrivs.length > 0) {
      lines.push(
        `    EXECUTE format('GRANT ${systemPrivs.join(
          ", "
        )} ON TABLE %I TO union_eyes_system', ${sqlQuoteLiteral(entry.table)});`
      );
    }
    lines.push(`  END IF;`);
    lines.push(`END $$;`);
    grantStatements.push(lines.join("\n"));
    grantsGenerated++;
  }

  // --- PART D: targeted one-off cleanup (round 58C section 48) ---
  // ai_budgets is CONTAINED_NO_AUTHORITY (zero required privileges either
  // side) but round 35 found it has RLS enabled with a stale CREATE POLICY
  // referencing a nonexistent auth.user_id() function (db/rls-storage-
  // authority/finance.ts's own "RESIDUAL NOTE"). Drop any such policy by
  // definition text (not by a specific guessed name) so this table reaches
  // a clean fail-closed FORCE-RLS-with-zero-policies state, consistent
  // with its zero required privileges (Part C's REVOKE ALL already removes
  // ACL access; this removes the stale, broken RLS policy object itself).
  const aiBudgetsCleanupSql = `
DO $$
DECLARE
  pol RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_budgets') THEN
    FOR pol IN
      SELECT polname FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      WHERE c.relname = 'ai_budgets' AND pg_get_expr(p.polqual, p.polrelid) ILIKE '%auth.user_id%'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON ai_budgets', pol.polname);
    END LOOP;
    ALTER TABLE ai_budgets ENABLE ROW LEVEL SECURITY;
    ALTER TABLE ai_budgets FORCE ROW LEVEL SECURITY;
  END IF;
END $$;
`.trim();

  // --- PART E: blanket grant removal (round 58D sections 42/44/48-51) ---
  // 0108's blanket `GRANT ... ON ALL TABLES IN SCHEMA public` may ONLY be
  // narrowed once every gating condition this generator can mechanically
  // verify is actually true — computed fresh on every run, never assumed,
  // so a future manifest regression (e.g. a new pgTable(...) declaration
  // that isn't yet in the manifest) automatically re-widens back to the
  // safe blanket-grant-retained state instead of silently shipping a
  // narrowed grant that no longer covers every real table.
  const allPrivilegesResolved = storageAuthorityManifest.every(
    (e) => e.requiredRuntimePrivileges !== "TBD" && e.requiredSystemPrivileges !== "TBD"
  );
  const blanketGrantRemovalGateOk = blockers.length === 0 && allPrivilegesResolved;
  const blanketGrantRemovalSql = blanketGrantRemovalGateOk
    ? [
        "-- Every gating condition was true at generation time (0 geometry blockers,",
        "-- 0 TBD privilege entries). 0108's blanket table/sequence grants are narrowed",
        "-- to the exact per-table GRANTs already issued above in PART C. Schema USAGE",
        "-- and database CONNECT are retained (baseline connection-level access, not",
        "-- per-table data access). No PostgreSQL sequences exist in this schema (every",
        "-- table uses a UUID default, not serial/bigserial), so the sequence grant is",
        "-- removed with no replacement.",
        "REVOKE SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM union_eyes_runtime, union_eyes_system;",
        "REVOKE USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public FROM union_eyes_runtime, union_eyes_system;",
      ].join("\n")
    : [
        "-- BLANKET GRANT REMOVAL GATE NOT SATISFIED AT GENERATION TIME:",
        `--   blockers = ${blockers.length} (must be 0)`,
        `--   all privileges resolved (no TBD) = ${allPrivilegesResolved} (must be true)`,
        "-- 0108's blanket table/sequence grants are deliberately LEFT IN PLACE.",
      ].join("\n");

  // Round 59 staging proof fix: every `SELECT ue_create_*_rls_policy(table, ...)`
  // call generated above assumes the table physically exists in the target
  // environment. 795 manifest entries span many environments/feature areas
  // that are not all deployed everywhere at once (financial-service
  // LATENT_UNREACHABLE tables, feature-gated CBA-intelligence/payroll/
  // voting/pension surfaces not yet migrated to a given target, etc) —
  // discovered live against staging (171 of 795 referenced tables absent).
  // Wrap each such call in an existence guard so a table missing from THIS
  // environment is a no-op for that table, not a hard failure for the
  // entire atomic migration. The table name is the call's first argument
  // and is always the literal produced by sqlQuoteLiteral(entry.table)
  // above, so it can be extracted directly from the generated SQL text
  // without threading a parallel table-tracking array through every call
  // site. Statements that don't match this shape (the SYSTEM_ONLY DO block,
  // already self-guarded above) pass through unchanged.
  const guardedPolicyStatements = policyStatements.map((stmt) => {
    const match = stmt.match(/^SELECT (ue_create_\w+)\('((?:[^'\\]|\\.)*)'(.*)\);$/);
    if (!match) return stmt;
    const [, fnName, tableName, restArgs] = match;
    return (
      `DO $$ BEGIN\n` +
      `  IF to_regclass('public.' || '${tableName}') IS NOT NULL THEN\n` +
      `    PERFORM ${fnName}('${tableName}'${restArgs});\n` +
      `  END IF;\n` +
      `END $$;`
    );
  });

  const migrationSql = [
    "-- =============================================================================",
    "-- 20260910_rls_enforcement_expansion_round58.sql",
    "--",
    "-- Round 58 Phase 1+ — GENERATED, do not hand-edit. Regenerate via",
    "-- `pnpm --filter @nzila/union-eyes rls:generate-enforcement` (which runs",
    "-- scripts/rls-enforcement/generate-rls-enforcement-migration.ts) and commit",
    "-- the result. `pnpm --filter @nzila/union-eyes rls:check-enforcement` fails",
    "-- CI if a regeneration would produce different bytes than what is committed",
    "-- (drift ratchet) — see scripts/rls-enforcement/check-enforcement-drift.ts.",
    "--",
    "-- Forward-only: this migration NEVER edits 0108 or any historical",
    "-- migration. It is idempotent (every generated statement is itself",
    "-- idempotent — DROP POLICY IF EXISTS / CREATE OR REPLACE FUNCTION /",
    "-- REVOKE ALL then explicit GRANT).",
    "--",
    "-- COVERAGE (see reports/union-eyes-rls-enforcement-blockers.json for the",
    "-- full list of tables this generation run could NOT confidently resolve):",
    `--   Policies generated this run: ${policiesGenerated}`,
    `--   Tables blocked (geometry unresolved / ambiguous): ${blockers.length}`,
    `--   GRANT blocks generated (covers all ${grantsGenerated} manifest entries): ${grantsGenerated}`,
    "--",
    `-- Blanket grant removal gate satisfied at generation time: ${blanketGrantRemovalGateOk}`,
    blanketGrantRemovalGateOk
      ? "-- 0108's predecessor blanket GRANT is narrowed by PART E below (see reports/"
      : "-- 0108's predecessor blanket GRANT is INTENTIONALLY NOT revoked this run (see reports/",
    "-- union-eyes-authority-enforcement-round58.md for the full finding).",
    "-- =============================================================================",
    "",
    RLS_HELPER_FUNCTIONS_SQL.trim(),
    "",
    "-- =============================================================================",
    "-- PART B — policy application (one call per resolved manifest entry)",
    "-- =============================================================================",
    "",
    guardedPolicyStatements.join("\n"),
    "",
    "-- =============================================================================",
    "-- PART C — exact GRANT compiler (every manifest entry, all 700 tables)",
    "-- =============================================================================",
    "",
    grantStatements.join("\n\n"),
    "",
    "-- =============================================================================",
    "-- PART D — targeted cleanup (ai_budgets stale auth.user_id() policy)",
    "-- =============================================================================",
    "",
    aiBudgetsCleanupSql,
    "",
    "-- =============================================================================",
    "-- PART E — blanket grant removal (gated, see header)",
    "-- =============================================================================",
    "",
    blanketGrantRemovalSql,
    "",
  ].join("\n");

  fs.writeFileSync(OUTPUT_MIGRATION_PATH, migrationSql);
  fs.writeFileSync(BLOCKERS_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), blockers }, null, 2) + "\n");

  console.log(`Policies generated: ${policiesGenerated}`);
  console.log(`Grant blocks generated: ${grantsGenerated}`);
  console.log(`Blockers: ${blockers.length}`);
  console.log(`Blanket grant removal gate: ${blanketGrantRemovalGateOk}`);
  console.log(`Migration written to ${path.relative(REPO_ROOT, OUTPUT_MIGRATION_PATH)}`);
  console.log(`Blockers written to ${path.relative(REPO_ROOT, BLOCKERS_PATH)}`);

  // Round 58C section 33: a "deployable" generation run must refuse to
  // produce an artifact that looks complete while blockers remain. Regular
  // (diagnostic) runs still emit the migration + blockers report so
  // developers can inspect exactly what's unresolved; only
  // RLS_ENFORCEMENT_DEPLOYABLE=1 enforces the hard failure, so this never
  // breaks the ordinary iterative `rls:generate-enforcement` workflow.
  if (process.env.RLS_ENFORCEMENT_DEPLOYABLE === "1" && blockers.length > 0) {
    console.error(
      `RLS_ENFORCEMENT_DEPLOYABLE=1 refuses to produce a deployable cutover artifact with ${blockers.length} unresolved blocker(s).`
    );
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}
