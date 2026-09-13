/**
 * db/__tests__/round58-production-geometry-remediation.test.ts
 *
 * P4 Round58 Production Geometry Compatibility Remediation.
 *
 * Proves, against a REAL disposable PostgreSQL server, the exact scenario
 * that crashed production rollout run 34765974431: the 6 root tables
 * (chat_sessions, board_packets, policy_rules, voting_sessions,
 * congress_memberships, shared_clause_library) recreated with the SAME
 * minimal Django-lineage shape production actually had (missing
 * organization_id / congress_id / sharing_level / shared_with_org_ids),
 * then applies the combined prerequisite + Round58 SQL exactly the way
 * scripts/apply-authority-enforcement-migration.ts applies it in production
 * (both files concatenated into ONE statement batch).
 *
 * Unlike full-migration-transactional-proof.ts (which proves the ENTIRE
 * 795-table migration is transactionally atomic against a synthetic, already
 * -complete geometry) and the generator-level unit test
 * (scripts/rls-enforcement/__tests__/generator-guarded-call-emission.test.ts,
 * which proves the guard SQL's *shape* without a database), THIS test proves
 * the specific forward-only prerequisite migration:
 *   (a) succeeds and is idempotent when the 6 tables are empty (matching the
 *       real Phase A production census: all 6 confirmed 0 rows), and
 *   (b) hard-fails closed — aborting the ENTIRE combined transaction,
 *       leaving NO column/policy/grant side effects — the instant any of
 *       the 6 tables unexpectedly contains a row, per the explicit "never
 *       synthesize/reinterpret an authority value" mandate.
 *
 * The prerequisite migration hardcodes `table_schema = 'public'` (matching
 * production reality), so this test uses the real `public` schema directly
 * (not an isolated schema like the other RLS proofs) — with uniquely named,
 * fully torn-down tables so it never collides with anything else on the
 * disposable server.
 *
 * Provide RLS_ENFORCEMENT_TEST_URL to run this suite. Skipped (not failed)
 * when absent — never touches staging/production.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { Client } from "pg";
import * as fs from "node:fs";
import * as path from "node:path";

const TEST_URL = process.env.RLS_ENFORCEMENT_TEST_URL;
const describeOrSkip = TEST_URL ? describe : describe.skip;

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const PREREQUISITE_PATH = path.join(
  REPO_ROOT,
  "db/migrations/20260913_round58_production_geometry_prerequisites.sql"
);
const ROUND58_PATH = path.join(REPO_ROOT, "db/migrations/20260910_rls_enforcement_expansion_round58.sql");
const BASELINE_PATH = path.join(REPO_ROOT, "db/migrations/0108_rls_tenant_isolation_foundation.sql");

const ROOT_TABLES = [
  "chat_sessions",
  "board_packets",
  "policy_rules",
  "voting_sessions",
  "congress_memberships",
  "shared_clause_library",
] as const;

function extractBaselineHelperFunction(sql: string): string {
  const start = sql.indexOf("CREATE OR REPLACE FUNCTION ue_create_direct_org_rls_policy");
  const end = sql.indexOf("-- =", start + 10);
  if (start === -1 || end === -1) {
    throw new Error("Could not locate ue_create_direct_org_rls_policy in 0108 migration");
  }
  return sql.slice(start, end);
}

describeOrSkip(
  "P4 Round58 production geometry prerequisite + combined apply (disposable PostgreSQL)",
  () => {
    let client: Client;
    const prerequisiteSql = fs.readFileSync(PREREQUISITE_PATH, "utf8");
    const round58Sql = fs.readFileSync(ROUND58_PATH, "utf8");
    const combinedSql = `${prerequisiteSql}\n\n${round58Sql}`;
    const baselineHelper = extractBaselineHelperFunction(fs.readFileSync(BASELINE_PATH, "utf8"));

    async function recreatePreRemediationSchema() {
      await client.query(`SET search_path TO public`);
      for (const t of [...ROOT_TABLES, "chat_messages", "clause_library_tags"]) {
        await client.query(`DROP TABLE IF EXISTS ${t} CASCADE`);
      }
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

      // Pre-remediation (Django-lineage-minimal) shape: no authority columns.
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

      for (const t of [...ROOT_TABLES, "chat_messages", "clause_library_tags"]) {
        await client.query(`GRANT ALL ON TABLE ${t} TO union_eyes_runtime, union_eyes_system`);
      }
      await client.query(baselineHelper);
    }

    async function authorityColumnsPresent(): Promise<Record<string, boolean>> {
      const checks = [
        ["chat_sessions", "organization_id"],
        ["board_packets", "organization_id"],
        ["policy_rules", "organization_id"],
        ["voting_sessions", "organization_id"],
        ["congress_memberships", "congress_id"],
        ["shared_clause_library", "sharing_level"],
        ["shared_clause_library", "shared_with_org_ids"],
      ] as const;
      const out: Record<string, boolean> = {};
      for (const [table, column] of checks) {
        const r = await client.query(
          `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
          [table, column]
        );
        out[`${table}.${column}`] = (r.rowCount ?? 0) > 0;
      }
      return out;
    }

    async function policyCountOn(table: string): Promise<number> {
      const r = await client.query(`SELECT count(*)::int AS n FROM pg_policies WHERE schemaname = 'public' AND tablename = $1`, [
        table,
      ]);
      return r.rows[0].n;
    }

    beforeEach(async () => {
      client = new Client({ connectionString: TEST_URL });
      await client.connect();
      await recreatePreRemediationSchema();
    });

    afterAll(async () => {
      const cleanupClient = new Client({ connectionString: TEST_URL });
      await cleanupClient.connect();
      for (const t of [...ROOT_TABLES, "chat_messages", "clause_library_tags"]) {
        await cleanupClient.query(`DROP TABLE IF EXISTS ${t} CASCADE`);
      }
      await cleanupClient.end();
    });

    it("empty tables (matches Phase A production census): combined apply succeeds and adds every authority column", async () => {
      await client.query(combinedSql);
      const present = await authorityColumnsPresent();
      for (const [key, ok] of Object.entries(present)) {
        expect(ok, `${key} should exist after combined apply`).toBe(true);
      }
      // The 12 previously-mismatched call sites now succeed (root cause of
      // production run 34765974431 was a RAISE EXCEPTION / crash here).
      expect(await policyCountOn("chat_sessions")).toBeGreaterThan(0);
      expect(await policyCountOn("chat_messages")).toBeGreaterThan(0);
      expect(await policyCountOn("congress_memberships")).toBeGreaterThan(0);
      expect(await policyCountOn("shared_clause_library")).toBeGreaterThan(0);
      expect(await policyCountOn("clause_library_tags")).toBeGreaterThan(0);
      await client.end();
    });

    it("re-applying the combined migration a second time is idempotent (safe re-run after a prior successful apply)", async () => {
      await client.query(combinedSql);
      const firstCount = await policyCountOn("chat_sessions");
      await client.query(combinedSql);
      const secondCount = await policyCountOn("chat_sessions");
      expect(secondCount).toBe(firstCount);
      const present = await authorityColumnsPresent();
      for (const ok of Object.values(present)) expect(ok).toBe(true);
      await client.end();
    });

    it.each(ROOT_TABLES)(
      "fail-closed: if %s unexpectedly has a row, the ENTIRE combined apply aborts and adds NO columns or policies anywhere",
      async (table) => {
        if (table === "congress_memberships") {
          const org = await client.query(`INSERT INTO organizations DEFAULT VALUES RETURNING id`);
          await client.query(`INSERT INTO congress_memberships (organization_id) VALUES ($1)`, [org.rows[0].id]);
        } else if (table === "shared_clause_library") {
          const org = await client.query(`INSERT INTO organizations DEFAULT VALUES RETURNING id`);
          await client.query(`INSERT INTO shared_clause_library (source_organization_id) VALUES ($1)`, [org.rows[0].id]);
        } else {
          await client.query(`INSERT INTO ${table} DEFAULT VALUES`);
        }

        await expect(client.query(combinedSql)).rejects.toThrow(/Refusing to (invent|synthesize|reinterpret|guess)/);

        // No partial application: none of the 6 authority columns exist,
        // and no Round58 policies were created on any of the 6 chains.
        const present = await authorityColumnsPresent();
        for (const [key, ok] of Object.entries(present)) {
          expect(ok, `${key} must NOT exist after an aborted apply`).toBe(false);
        }
        expect(await policyCountOn("chat_sessions")).toBe(0);
        expect(await policyCountOn("chat_messages")).toBe(0);
        expect(await policyCountOn("congress_memberships")).toBe(0);
        expect(await policyCountOn("shared_clause_library")).toBe(0);
        expect(await policyCountOn("clause_library_tags")).toBe(0);
        await client.end();
      }
    );
  }
);
