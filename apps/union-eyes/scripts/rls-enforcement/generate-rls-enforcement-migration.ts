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

  EXECUTE format(
    'CREATE POLICY ue_user_isolation_select ON %I FOR SELECT TO union_eyes_runtime ' ||
    'USING (%I = current_setting(''app.current_user_id'', true))',
    p_table_name, p_user_column
  );
  EXECUTE format(
    'CREATE POLICY ue_user_isolation_insert ON %I FOR INSERT TO union_eyes_runtime ' ||
    'WITH CHECK (%I = current_setting(''app.current_user_id'', true))',
    p_table_name, p_user_column
  );
  EXECUTE format(
    'CREATE POLICY ue_user_isolation_update ON %I FOR UPDATE TO union_eyes_runtime ' ||
    'USING (%I = current_setting(''app.current_user_id'', true)) ' ||
    'WITH CHECK (%I = current_setting(''app.current_user_id'', true))',
    p_table_name, p_user_column, p_user_column
  );
  EXECUTE format(
    'CREATE POLICY ue_user_isolation_delete ON %I FOR DELETE TO union_eyes_runtime ' ||
    'USING (%I = current_setting(''app.current_user_id'', true))',
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

  for (const entry of storageAuthorityManifest) {
    // --- PART B: RLS policy generation ---
    if (BASELINE_0108_TABLES.has(entry.table)) {
      // Already governed by 0108 — GRANTs below still apply to it.
    } else if (entry.classification === "TENANT_RLS_REQUIRED") {
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
    } else if (entry.classification === "PARENT_OWNED_RLS_REQUIRED") {
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
    } else if (entry.classification === "USER_RLS_REQUIRED") {
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
    } else if (entry.classification === "SYSTEM_ONLY") {
      policyStatements.push(
        `ALTER TABLE ${quoteIdent(entry.table)} ENABLE ROW LEVEL SECURITY;\n` +
          `ALTER TABLE ${quoteIdent(entry.table)} FORCE ROW LEVEL SECURITY;\n` +
          `DROP POLICY IF EXISTS ue_system_full_access ON ${quoteIdent(entry.table)};\n` +
          `CREATE POLICY ue_system_full_access ON ${quoteIdent(
            entry.table
          )} FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);`
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
    const lines: string[] = [];
    lines.push(`REVOKE ALL ON TABLE ${quoteIdent(entry.table)} FROM union_eyes_runtime;`);
    lines.push(`REVOKE ALL ON TABLE ${quoteIdent(entry.table)} FROM union_eyes_system;`);
    if (runtimePrivs.length > 0) {
      lines.push(
        `GRANT ${runtimePrivs.join(", ")} ON TABLE ${quoteIdent(entry.table)} TO union_eyes_runtime;`
      );
    }
    if (systemPrivs.length > 0) {
      lines.push(`GRANT ${systemPrivs.join(", ")} ON TABLE ${quoteIdent(entry.table)} TO union_eyes_system;`);
    }
    grantStatements.push(lines.join("\n"));
    grantsGenerated++;
  }

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
    "-- NOTE: 0108's predecessor blanket `GRANT ALL ON ALL TABLES IN SCHEMA",
    "-- public` is intentionally NOT revoked by this migration — the exact",
    "-- GRANTs below are additive/idempotent-narrowing per table, but removing",
    "-- the blanket grant is deferred until the blockers list above reaches",
    "-- zero (otherwise a currently-unresolved table would silently lose its",
    "-- runtime grant the moment the blanket grant is dropped).",
    "-- =============================================================================",
    "",
    RLS_HELPER_FUNCTIONS_SQL.trim(),
    "",
    "-- =============================================================================",
    "-- PART B — policy application (one call per resolved manifest entry)",
    "-- =============================================================================",
    "",
    policyStatements.join("\n"),
    "",
    "-- =============================================================================",
    "-- PART C — exact GRANT compiler (every manifest entry, all 700 tables)",
    "-- =============================================================================",
    "",
    grantStatements.join("\n\n"),
    "",
  ].join("\n");

  fs.writeFileSync(OUTPUT_MIGRATION_PATH, migrationSql);
  fs.writeFileSync(BLOCKERS_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), blockers }, null, 2) + "\n");

  console.log(`Policies generated: ${policiesGenerated}`);
  console.log(`Grant blocks generated: ${grantsGenerated}`);
  console.log(`Blockers: ${blockers.length}`);
  console.log(`Migration written to ${path.relative(REPO_ROOT, OUTPUT_MIGRATION_PATH)}`);
  console.log(`Blockers written to ${path.relative(REPO_ROOT, BLOCKERS_PATH)}`);
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

if (require.main === module) {
  main();
}
