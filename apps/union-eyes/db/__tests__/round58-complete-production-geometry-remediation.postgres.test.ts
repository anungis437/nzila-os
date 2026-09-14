/**
 * db/__tests__/round58-complete-production-geometry-remediation.postgres.test.ts
 *
 * P4_ROUND58_COMPLETE_GEOMETRY_REMEDIATION — permanent, committed PG16
 * regression suite (P4_ROUND58_COMPLETE_GEOMETRY_PR_TEST_HARDENING gate).
 *
 * Formalizes, as durable CI-verifiable evidence, what an earlier session's
 * ad-hoc (now-deleted) disposable-Postgres proof script demonstrated only
 * once and then discarded. Unlike
 * db/__tests__/round58-production-geometry-remediation.test.ts (which
 * proves ONLY the original 6-root-table prerequisite,
 * 20260913_round58_production_geometry_prerequisites.sql, in isolation),
 * THIS suite proves the full three-file combined apply exactly the way
 * scripts/apply-authority-enforcement-migration.ts applies it in
 * production:
 *
 *   20260913_round58_production_geometry_prerequisites.sql
 *   + 20260914_round58_complete_production_geometry_prerequisites.sql
 *   + 20260910_rls_enforcement_expansion_round58.sql
 *
 * concatenated into ONE statement batch, covering the additional 14
 * tables discovered by the full production census
 * (P4_ROUND58_COMPLETE_GEOMETRY_REMEDIATION) plus the two geometry-override
 * fixes (automation_rules EXPLICIT_DIRECT_COLUMN_OVERRIDE, settlements
 * TENANT_VIA_PARENT) captured in
 * scripts/rls-enforcement/enforcement-geometry-overrides.ts.
 *
 * Named test cases (per P4_ROUND58_COMPLETE_GEOMETRY_PR_TEST_HARDENING):
 *   - PRE_JOB5_PRODUCTION_SHAPE_FULL_CHAIN
 *   - AUTOMATION_RULES_ORGANIZATION_ID_VARCHAR
 *   - AUTOMATION_RULES_STALE_ORG_ID_ONLY
 *   - SETTLEMENTS_PARENT_GEOMETRY
 *   - PILOT_METRICS_NONEMPTY_MISSING_ORG
 *   - GEOFENCES_NONEMPTY_MISSING_UNION_LOCAL
 *   - STRIKE_FUND_NONEMPTY_MISSING_ORG
 *   - ORIGINAL_SIX_ROOT_NONEMPTY_CASE
 *   - IDEMPOTENT_PREREQUISITE_REAPPLY
 *   - ATOMIC_ROLLBACK_TEST (deliberate later-stage failure -> rollback ->
 *     chat_sessions.organization_id / pilot_metrics.organization_id /
 *     geofences.union_local_id all ABSENT)
 *   - ROUND58_GEOMETRY_MISMATCH_TABLE_COUNT_AFTER / MISSING_COLUMN_COUNT_AFTER
 *     (programmatic re-census of 20260910's RAISE EXCEPTION geometry gates
 *     for every table this suite creates, required to be 0/0 after a
 *     successful full-chain apply)
 *
 * Provide RLS_ENFORCEMENT_TEST_URL (a superuser connection string to a
 * disposable postgres:16, e.g.
 * `docker run -d -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:16-alpine`)
 * to run this suite — matches the repo's existing convention (see
 * db/__tests__/round58-production-geometry-remediation.test.ts and
 * db/__tests__/rls-enforcement-helpers-behavioral.test.ts). Skipped (not
 * failed) when absent. Never touches staging/production.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { Client } from "pg";
import * as fs from "node:fs";
import * as path from "node:path";

const TEST_URL = process.env.RLS_ENFORCEMENT_TEST_URL;
const describeOrSkip = TEST_URL ? describe : describe.skip;

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const PREREQUISITE_0913_PATH = path.join(
  REPO_ROOT,
  "db/migrations/20260913_round58_production_geometry_prerequisites.sql"
);
const PREREQUISITE_0914_PATH = path.join(
  REPO_ROOT,
  "db/migrations/20260914_round58_complete_production_geometry_prerequisites.sql"
);
const ROUND58_PATH = path.join(REPO_ROOT, "db/migrations/20260910_rls_enforcement_expansion_round58.sql");
const BASELINE_PATH = path.join(REPO_ROOT, "db/migrations/0108_rls_tenant_isolation_foundation.sql");

// The 6 original root tables (0913) + the 14 companion tables (0914) +
// automation_rules/settlements (override-fixed, no DDL of their own) +
// their parent/child dependents referenced by Round58's policy calls.
const ORIGINAL_SIX_ROOT_TABLES = [
  "chat_sessions",
  "board_packets",
  "policy_rules",
  "voting_sessions",
  "congress_memberships",
  "shared_clause_library",
] as const;

const COMPANION_FOURTEEN_TABLES = [
  "bargaining_notes",
  "budget_pool",
  "calendar_events",
  "clause_comparisons",
  "clc_sync_log",
  "consent_records",
  "cookie_consents",
  "defensibility_packs",
  "geofences",
  "mobile_devices",
  "pilot_metrics",
  "reward_wallet_ledger",
  "strike_fund_disbursements",
  "user_consents",
] as const;

const ALL_TABLES_INCLUDING_DEPENDENTS = [
  ...ORIGINAL_SIX_ROOT_TABLES,
  ...COMPANION_FOURTEEN_TABLES,
  "chat_messages",
  "clause_library_tags",
  "automation_rules",
  "settlements",
  "grievances",
] as const;

function extractBaselineHelperFunction(sql: string): string {
  const start = sql.indexOf("CREATE OR REPLACE FUNCTION ue_create_direct_org_rls_policy");
  const end = sql.indexOf("-- =", start + 10);
  if (start === -1 || end === -1) {
    throw new Error("Could not locate ue_create_direct_org_rls_policy in 0108 migration");
  }
  return sql.slice(start, end);
}

/**
 * Programmatic re-census of 20260910's fail-closed geometry gates: parses
 * every `RAISE EXCEPTION 'RLS enforcement geometry incomplete for table %:
 * helper % requires column(s) [%] ...', '<table>', '<helper>', '<cols>'`
 * block and returns, for each table this suite actually creates, the list
 * of required "table.column" pairs the Round58 SQL itself expects to find.
 */
function deriveRequiredColumnsFromRound58(sql: string, tablesOfInterest: readonly string[]): Map<string, string[]> {
  const regex =
    /RAISE EXCEPTION 'RLS enforcement geometry incomplete for table %: helper % requires column\(s\) \[%\] which are not all present in this environment', '([\w]+)', '[\w]+', '([\w.,\s]+)'/g;
  const result = new Map<string, string[]>();
  let match: RegExpExecArray | null;
  const wanted = new Set(tablesOfInterest);
  while ((match = regex.exec(sql)) !== null) {
    const table = match[1];
    if (!wanted.has(table)) continue;
    const cols = match[2].split(",").map((c) => c.trim());
    result.set(table, cols);
  }
  return result;
}

describeOrSkip(
  "P4_ROUND58_COMPLETE_GEOMETRY_REMEDIATION — combined 0913+0914+Round58 apply (disposable PostgreSQL)",
  () => {
    let client: Client;
    const prerequisite0913Sql = fs.readFileSync(PREREQUISITE_0913_PATH, "utf8");
    const prerequisite0914Sql = fs.readFileSync(PREREQUISITE_0914_PATH, "utf8");
    const round58Sql = fs.readFileSync(ROUND58_PATH, "utf8");
    const combinedSql = `${prerequisite0913Sql}\n\n${prerequisite0914Sql}\n\n${round58Sql}`;
    const baselineHelper = extractBaselineHelperFunction(fs.readFileSync(BASELINE_PATH, "utf8"));

    async function dropAllTestTables() {
      for (const t of ALL_TABLES_INCLUDING_DEPENDENTS) {
        await client.query(`DROP TABLE IF EXISTS ${t} CASCADE`);
      }
    }

    /**
     * Recreates the pre-job5, pre-remediation production shape for all 20
     * primary tables (6 root + 14 companion) plus automation_rules
     * (already-correct varchar organization_id, per the override comment)
     * and settlements/grievances (parent-owned geometry).
     */
    async function recreatePreRemediationSchema(opts?: { automationRulesHasOrganizationId?: boolean }) {
      await client.query(`SET search_path TO public`);
      await dropAllTestTables();
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
      await client.query(`CREATE TABLE IF NOT EXISTS organizations (id uuid primary key default gen_random_uuid())`);

      // --- Original 6 root tables: pre-remediation (Django-lineage-minimal) shape.
      await client.query(`CREATE TABLE chat_sessions (id uuid primary key default gen_random_uuid())`);
      await client.query(
        `CREATE TABLE chat_messages (id uuid primary key default gen_random_uuid(), session_id uuid not null references chat_sessions(id))`
      );
      await client.query(`CREATE TABLE board_packets (id uuid primary key default gen_random_uuid())`);
      await client.query(`CREATE TABLE policy_rules (id uuid primary key default gen_random_uuid())`);
      await client.query(`CREATE TABLE voting_sessions (id uuid primary key default gen_random_uuid())`);
      await client.query(
        `CREATE TABLE congress_memberships (id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id))`
      );
      await client.query(
        `CREATE TABLE shared_clause_library (id uuid primary key default gen_random_uuid(), source_organization_id uuid not null references organizations(id))`
      );
      await client.query(
        `CREATE TABLE clause_library_tags (id uuid primary key default gen_random_uuid(), clause_id uuid not null references shared_clause_library(id))`
      );

      // --- 14 companion tables: pre-remediation shape (no authority column yet).
      await client.query(`CREATE TABLE bargaining_notes (id uuid primary key default gen_random_uuid())`);
      await client.query(`CREATE TABLE budget_pool (id uuid primary key default gen_random_uuid())`);
      await client.query(`CREATE TABLE calendar_events (id uuid primary key default gen_random_uuid())`);
      await client.query(`CREATE TABLE clause_comparisons (id uuid primary key default gen_random_uuid())`);
      await client.query(`CREATE TABLE clc_sync_log (id uuid primary key default gen_random_uuid())`);
      await client.query(`CREATE TABLE consent_records (id uuid primary key default gen_random_uuid())`);
      await client.query(`CREATE TABLE cookie_consents (id uuid primary key default gen_random_uuid())`);
      await client.query(`CREATE TABLE defensibility_packs (id uuid primary key default gen_random_uuid())`);
      await client.query(`CREATE TABLE geofences (id uuid primary key default gen_random_uuid())`);
      await client.query(`CREATE TABLE mobile_devices (id uuid primary key default gen_random_uuid())`);
      await client.query(`CREATE TABLE pilot_metrics (id uuid primary key default gen_random_uuid())`);
      await client.query(`CREATE TABLE reward_wallet_ledger (id uuid primary key default gen_random_uuid())`);
      await client.query(`CREATE TABLE strike_fund_disbursements (id uuid primary key default gen_random_uuid())`);
      await client.query(`CREATE TABLE user_consents (id uuid primary key default gen_random_uuid())`);

      // --- automation_rules: neither prerequisite file touches this table
      // (per its EXPLICIT_DIRECT_COLUMN_OVERRIDE — production already has
      // organization_id varchar(255)). Default fixture matches production
      // reality (column present); the AUTOMATION_RULES_STALE_ORG_ID_ONLY
      // case overrides this to reproduce the pre-fix bug shape.
      if (opts?.automationRulesHasOrganizationId === false) {
        await client.query(`CREATE TABLE automation_rules (id uuid primary key default gen_random_uuid(), org_id uuid)`);
      } else {
        await client.query(
          `CREATE TABLE automation_rules (id uuid primary key default gen_random_uuid(), organization_id varchar(255) not null)`
        );
      }

      // --- settlements: TENANT_VIA_PARENT override (grievance_id -> grievances.organization_id).
      await client.query(
        `CREATE TABLE grievances (id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id))`
      );
      await client.query(
        `CREATE TABLE settlements (id uuid primary key default gen_random_uuid(), grievance_id uuid not null references grievances(id))`
      );

      for (const t of ALL_TABLES_INCLUDING_DEPENDENTS) {
        await client.query(`GRANT ALL ON TABLE ${t} TO union_eyes_runtime, union_eyes_system`);
      }
      await client.query(baselineHelper);
    }

    async function columnExists(table: string, column: string): Promise<boolean> {
      const r = await client.query(
        `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
        [table, column]
      );
      return (r.rowCount ?? 0) > 0;
    }

    async function policyCountOn(table: string): Promise<number> {
      const r = await client.query(`SELECT count(*)::int AS n FROM pg_policies WHERE schemaname = 'public' AND tablename = $1`, [
        table,
      ]);
      return r.rows[0].n;
    }

    async function totalPolicyCount(): Promise<number> {
      const r = await client.query(`SELECT count(*)::int AS n FROM pg_policies WHERE schemaname = 'public'`);
      return r.rows[0].n;
    }

    beforeEach(async () => {
      client = new Client({ connectionString: TEST_URL });
      await client.connect();
    });

    afterAll(async () => {
      const cleanupClient = new Client({ connectionString: TEST_URL });
      await cleanupClient.connect();
      for (const t of ALL_TABLES_INCLUDING_DEPENDENTS) {
        await cleanupClient.query(`DROP TABLE IF EXISTS ${t} CASCADE`);
      }
      await cleanupClient.end();
    });

    it("PRE_JOB5_PRODUCTION_SHAPE_FULL_CHAIN: combined 0913+0914+Round58 apply succeeds against the exact pre-remediation shape and adds every authority column", async () => {
      await recreatePreRemediationSchema();
      await client.query(combinedSql);

      const columnChecks: Array<[string, string]> = [
        ["chat_sessions", "organization_id"],
        ["board_packets", "organization_id"],
        ["policy_rules", "organization_id"],
        ["voting_sessions", "organization_id"],
        ["congress_memberships", "congress_id"],
        ["shared_clause_library", "sharing_level"],
        ["bargaining_notes", "organization_id"],
        ["budget_pool", "organization_id"],
        ["calendar_events", "organization_id"],
        ["clause_comparisons", "organization_id"],
        ["clc_sync_log", "organization_id"],
        ["consent_records", "organization_id"],
        ["cookie_consents", "organization_id"],
        ["defensibility_packs", "organization_id"],
        ["geofences", "union_local_id"],
        ["mobile_devices", "organization_id"],
        ["pilot_metrics", "organization_id"],
        ["reward_wallet_ledger", "org_id"],
        ["strike_fund_disbursements", "organization_id"],
        ["user_consents", "organization_id"],
      ];
      for (const [table, column] of columnChecks) {
        expect(await columnExists(table, column), `${table}.${column} should exist after combined apply`).toBe(true);
      }

      for (const table of [...ORIGINAL_SIX_ROOT_TABLES, ...COMPANION_FOURTEEN_TABLES, "automation_rules", "settlements"]) {
        expect(await policyCountOn(table), `${table} should have >0 RLS policies after combined apply`).toBeGreaterThan(0);
      }
      await client.end();
    });

    it("AUTOMATION_RULES_ORGANIZATION_ID_VARCHAR: automation_rules already has production varchar(255) organization_id (no DDL needed) and the direct-org policy applies", async () => {
      await recreatePreRemediationSchema({ automationRulesHasOrganizationId: true });
      await client.query(combinedSql);

      const r = await client.query(
        `SELECT data_type, character_maximum_length FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'automation_rules' AND column_name = 'organization_id'`
      );
      expect(r.rowCount).toBe(1);
      expect(r.rows[0].data_type).toBe("character varying");
      expect(r.rows[0].character_maximum_length).toBe(255);
      expect(await policyCountOn("automation_rules")).toBeGreaterThan(0);
      await client.end();
    });

    it("AUTOMATION_RULES_STALE_ORG_ID_ONLY: automation_rules with only a stale org_id column (no organization_id) fails closed — Round58's own geometry gate rejects, no partial application", async () => {
      await recreatePreRemediationSchema({ automationRulesHasOrganizationId: false });
      await expect(client.query(combinedSql)).rejects.toThrow(/RLS enforcement geometry incomplete for table %: automation_rules|geometry incomplete/i);

      expect(await policyCountOn("automation_rules")).toBe(0);
      // Cross-table atomicity: none of the other 19 tables' columns/policies
      // landed either, even though their own prerequisite DDL would have
      // succeeded in isolation.
      expect(await columnExists("chat_sessions", "organization_id")).toBe(false);
      expect(await columnExists("pilot_metrics", "organization_id")).toBe(false);
      expect(await totalPolicyCount()).toBe(0);
      await client.end();
    });

    it("SETTLEMENTS_PARENT_GEOMETRY: settlements (grievance_id -> grievances.organization_id) TENANT_VIA_PARENT geometry applies successfully", async () => {
      await recreatePreRemediationSchema();
      await client.query(combinedSql);
      expect(await policyCountOn("settlements")).toBeGreaterThan(0);
      await client.end();
    });

    it.each(["pilot_metrics", "geofences", "strike_fund_disbursements"] as const)(
      "%s non-empty with missing authority column fails closed: the ENTIRE combined apply aborts and adds NO columns or policies anywhere",
      async (table) => {
        await recreatePreRemediationSchema();
        await client.query(`INSERT INTO ${table} DEFAULT VALUES`);

        await expect(client.query(combinedSql)).rejects.toThrow(/Refusing to invent/);

        expect(await columnExists("chat_sessions", "organization_id")).toBe(false);
        expect(await columnExists("pilot_metrics", "organization_id")).toBe(false);
        expect(await columnExists("geofences", "union_local_id")).toBe(false);
        expect(await columnExists("strike_fund_disbursements", "organization_id")).toBe(false);
        expect(await totalPolicyCount()).toBe(0);
        await client.end();
      }
    );
    // Named per P4_ROUND58_COMPLETE_GEOMETRY_PR_TEST_HARDENING:
    //   PILOT_METRICS_NONEMPTY_MISSING_ORG / GEOFENCES_NONEMPTY_MISSING_UNION_LOCAL
    //   / STRIKE_FUND_NONEMPTY_MISSING_ORG — see it.each above.

    it("ORIGINAL_SIX_ROOT_NONEMPTY_CASE: a non-empty original 0913 root table (chat_sessions) fails closed and blocks the 0914 companion + Round58 stages too (single combined transaction)", async () => {
      await recreatePreRemediationSchema();
      await client.query(`INSERT INTO chat_sessions DEFAULT VALUES`);

      await expect(client.query(combinedSql)).rejects.toThrow(/Refusing to invent/);

      expect(await columnExists("chat_sessions", "organization_id")).toBe(false);
      // Proves cross-file atomicity: the LATER 0914 file's changes did not
      // land even though 0914's own tables were empty and would have
      // succeeded in isolation.
      expect(await columnExists("pilot_metrics", "organization_id")).toBe(false);
      expect(await columnExists("geofences", "union_local_id")).toBe(false);
      expect(await totalPolicyCount()).toBe(0);
      await client.end();
    });

    it("IDEMPOTENT_PREREQUISITE_REAPPLY: re-applying the full combined 0913+0914+Round58 batch a second time on an already-remediated schema is a safe no-op", async () => {
      await recreatePreRemediationSchema();
      await client.query(combinedSql);
      const firstTotal = await totalPolicyCount();

      await client.query(combinedSql);
      const secondTotal = await totalPolicyCount();

      expect(secondTotal).toBe(firstTotal);
      expect(await columnExists("pilot_metrics", "organization_id")).toBe(true);
      expect(await columnExists("geofences", "union_local_id")).toBe(true);
      await client.end();
    });

    it("ATOMIC_ROLLBACK_TEST: a deliberate later-stage failure after the prerequisites succeed rolls back the ENTIRE transaction — chat_sessions/pilot_metrics/geofences authority columns are all ABSENT", async () => {
      await recreatePreRemediationSchema();

      // Deliberately corrupt the tail of the batch (after both prerequisite
      // files' DDL has already executed within the same implicit
      // transaction) to force a later-stage failure, proving no prerequisite
      // DDL survives when a downstream Round58 statement fails.
      const deliberatelyBrokenCombinedSql = `${prerequisite0913Sql}\n\n${prerequisite0914Sql}\n\nSELECT 1/0; -- deliberate induced failure (ATOMIC_ROLLBACK_TEST)\n\n${round58Sql}`;

      await expect(client.query(deliberatelyBrokenCombinedSql)).rejects.toThrow();

      expect(await columnExists("chat_sessions", "organization_id")).toBe(false);
      expect(await columnExists("pilot_metrics", "organization_id")).toBe(false);
      expect(await columnExists("geofences", "union_local_id")).toBe(false);
      expect(await totalPolicyCount()).toBe(0);
      await client.end();
    });

    it("ROUND58_GEOMETRY_MISMATCH_TABLE_COUNT_AFTER=0 / MISSING_COLUMN_COUNT_AFTER=0: programmatic re-census of Round58's own fail-closed geometry gates finds zero mismatches after a successful full-chain apply", async () => {
      await recreatePreRemediationSchema();
      await client.query(combinedSql);

      const tablesOfInterest = [...ORIGINAL_SIX_ROOT_TABLES, ...COMPANION_FOURTEEN_TABLES, "automation_rules", "settlements"];
      const required = deriveRequiredColumnsFromRound58(round58Sql, tablesOfInterest);
      expect(required.size, "expected the census regex to find at least one geometry gate for our tables").toBeGreaterThan(0);

      let mismatchTableCount = 0;
      let missingColumnCount = 0;
      for (const [table, cols] of required) {
        let tableHasMismatch = false;
        for (const qualified of cols) {
          const [t, c] = qualified.includes(".") ? qualified.split(".") : [table, qualified];
          const exists = await columnExists(t, c);
          if (!exists) {
            missingColumnCount += 1;
            tableHasMismatch = true;
          }
        }
        if (tableHasMismatch) mismatchTableCount += 1;
      }

      expect(mismatchTableCount, "ROUND58_GEOMETRY_MISMATCH_TABLE_COUNT_AFTER").toBe(0);
      expect(missingColumnCount, "ROUND58_GEOMETRY_MISSING_COLUMN_COUNT_AFTER").toBe(0);
      await client.end();
    });
  }
);
