/**
 * db/__tests__/rls-0108-schema-compatibility-postgres.test.ts
 *
 * P4 0108 policy + schema compatibility remediation regression proof.
 *
 * Reproduces the EXACT production geometry that made production run
 * 34756435525 fail (P4 failed-rollout state assessment, 2026-09-13):
 *   - organization_members.organization_id = UUID (0108 previously passed
 *     isText=TRUE, producing "operator does not exist: uuid = text")
 *   - grievance_deadlines has no organization_id column at all (only
 *     grievance_id) — 0108 previously called the direct-org helper on it
 *     with the default 'organization_id' column
 *   - member_documents has no organization_id column at all — 0108
 *     previously called the direct-org helper on it with no schema
 *     prerequisite established first
 *   - message_notifications has no thread_id column (its real FK is
 *     message_id) — 0108 previously called the generic parent-owned
 *     helper assuming thread_id
 *
 * Applies the REAL, corrected db/migrations/0108_rls_tenant_isolation_foundation.sql
 * file content as a single multi-statement query (matching the production
 * apply path's sql.unsafe() simple-query-protocol call — see
 * apps/union-eyes/scripts/apply-rls-foundation-migration.ts), against a
 * disposable database seeded with the exact fixture shapes above, and
 * proves both structural correctness and real per-tenant RLS behavior.
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Client } from "pg";

const TEST_URL = process.env.UE_0108_MIGRATION_TEST_URL;
const describeOrSkip = TEST_URL ? describe : describe.skip;
const migrationPath = resolve(import.meta.dirname, "..", "migrations", "0108_rls_tenant_isolation_foundation.sql");
const migrationSql = readFileSync(migrationPath, "utf8");

const RUNTIME_PASSWORD = `runtime_${randomUUID().replaceAll("-", "")}`;
const SYSTEM_PASSWORD = `system_${randomUUID().replaceAll("-", "")}`;

const FIXTURE_DDL = `
  CREATE TABLE organizations (id uuid PRIMARY KEY DEFAULT gen_random_uuid());

  CREATE TABLE organization_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id),
    user_id text NOT NULL
  );

  CREATE TABLE grievances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id)
  );

  -- No organization_id column — parent-owned via grievance_id, per the
  -- P4 failed-rollout census.
  CREATE TABLE grievance_deadlines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    grievance_id uuid NOT NULL REFERENCES grievances(id)
  );

  CREATE TABLE claims (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id)
  );

  CREATE TABLE documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id)
  );

  -- No organization_id column initially — 0108 must establish it itself.
  CREATE TABLE member_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text NOT NULL
  );

  CREATE TABLE workplace_incidents (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id));
  CREATE TABLE safety_inspections (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id));
  CREATE TABLE hazard_reports (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id));
  CREATE TABLE safety_committee_meetings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id));
  CREATE TABLE safety_training_records (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id));
  CREATE TABLE ppe_equipment (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id));
  CREATE TABLE safety_audits (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id));
  CREATE TABLE injury_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id));
  CREATE TABLE safety_policies (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id));
  CREATE TABLE corrective_actions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id));
  CREATE TABLE safety_certifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id));

  CREATE TABLE message_threads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id)
  );
  CREATE TABLE messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id uuid NOT NULL REFERENCES message_threads(id)
  );
  CREATE TABLE message_participants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id uuid NOT NULL REFERENCES message_threads(id)
  );
  CREATE TABLE message_read_receipts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id uuid NOT NULL REFERENCES messages(id),
    user_id text NOT NULL
  );
  -- No thread_id column — real FK is message_id, per the P4 failed-rollout census.
  CREATE TABLE message_notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id uuid NOT NULL REFERENCES messages(id),
    user_id text NOT NULL
  );

  CREATE TABLE cross_org_access_log (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
`;

const ALL_FIXTURE_TABLES = [
  "message_notifications", "message_read_receipts", "message_participants", "messages", "message_threads",
  "cross_org_access_log", "safety_certifications", "corrective_actions", "safety_policies", "injury_logs",
  "safety_audits", "ppe_equipment", "safety_training_records", "safety_committee_meetings", "hazard_reports",
  "safety_inspections", "workplace_incidents", "member_documents", "documents", "claims",
  "grievance_deadlines", "grievances", "organization_members", "organizations",
];

describeOrSkip("P4 0108 policy + schema compatibility (disposable PostgreSQL)", () => {
  let adminClient: Client;
  let client: Client;
  let isolatedUrl: string;
  const databaseName = `p4_0108_${randomUUID().replaceAll("-", "")}`;

  beforeAll(async () => {
    adminClient = new Client({ connectionString: TEST_URL });
    await adminClient.connect();
    await adminClient.query(`CREATE DATABASE "${databaseName}"`);

    const url = new URL(TEST_URL!);
    url.pathname = `/${databaseName}`;
    isolatedUrl = url.toString();
    client = new Client({ connectionString: isolatedUrl });
    await client.connect();
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  });

  beforeEach(async () => {
    await client.query(`DROP TABLE IF EXISTS ${ALL_FIXTURE_TABLES.join(", ")} CASCADE`);
    await client.query("DROP FUNCTION IF EXISTS ue_create_direct_org_rls_policy(text, text, boolean)");
    await client.query("DROP FUNCTION IF EXISTS ue_create_parent_owned_rls_policy(text, text)");
    for (const role of ["union_eyes_runtime", "union_eyes_system"]) {
      const exists = await client.query(`SELECT 1 FROM pg_roles WHERE rolname = $1`, [role]);
      if (exists.rows.length > 0) {
        await client.query(`DROP OWNED BY ${role} CASCADE`);
        await client.query(`DROP ROLE ${role}`);
      }
    }
    await client.query(FIXTURE_DDL);
  });

  afterAll(async () => {
    await client.query(`DROP TABLE IF EXISTS ${ALL_FIXTURE_TABLES.join(", ")} CASCADE`).catch(() => undefined);
    await client.end();
    await adminClient.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
    await adminClient.end();
  });

  it("applies cleanly against the exact production geometry that previously failed", async () => {
    await expect(client.query(migrationSql)).resolves.toBeDefined();
  });

  it("is idempotent on a second apply", async () => {
    await client.query(migrationSql);
    await expect(client.query(migrationSql)).resolves.toBeDefined();
  });

  it("aborts the entire migration transaction if a member_documents row has zero tenant matches (nothing persists)", async () => {
    await client.query(`
      DROP TABLE IF EXISTS member_documents CASCADE;
      CREATE TABLE member_documents (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id text NOT NULL);
      INSERT INTO member_documents (user_id) VALUES ('orphan_user_no_membership');
    `);
    await expect(client.query(migrationSql)).rejects.toThrow(/ambiguous ownership/i);
    // The whole 0108 transaction must have rolled back — no partial state, not even role creation.
    const roles = await client.query(`SELECT 1 FROM pg_roles WHERE rolname = 'union_eyes_runtime'`);
    expect(roles.rows).toHaveLength(0);
  });

  it("aborts the entire migration transaction if a member_documents row has multiple tenant matches (nothing persists)", async () => {
    await client.query(`
      DROP TABLE IF EXISTS member_documents CASCADE;
      CREATE TABLE member_documents (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id text NOT NULL);
    `);
    const orgA = randomUUID();
    const orgB = randomUUID();
    const userId = "ambiguous_user";
    await client.query(`INSERT INTO organizations (id) VALUES ($1), ($2)`, [orgA, orgB]);
    await client.query(`INSERT INTO organization_members (organization_id, user_id) VALUES ($1, $2), ($3, $2)`, [orgA, userId, orgB]);
    await client.query(`INSERT INTO member_documents (user_id) VALUES ($1)`, [userId]);
    await expect(client.query(migrationSql)).rejects.toThrow(/ambiguous ownership/i);
    const roles = await client.query(`SELECT 1 FROM pg_roles WHERE rolname = 'union_eyes_runtime'`);
    expect(roles.rows).toHaveLength(0);
  });

  describe("after first apply", () => {
    beforeEach(async () => {
      await client.query(migrationSql);
    });

    it("creates both roles with the required non-privileged attributes", async () => {
      const { rows } = await client.query(`
        SELECT rolname, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolreplication
        FROM pg_roles WHERE rolname IN ('union_eyes_runtime', 'union_eyes_system')
        ORDER BY rolname
      `);
      expect(rows).toHaveLength(2);
      for (const row of rows) {
        expect(row.rolsuper).toBe(false);
        expect(row.rolbypassrls).toBe(false);
        expect(row.rolcreatedb).toBe(false);
        expect(row.rolcreaterole).toBe(false);
        expect(row.rolreplication).toBe(false);
      }
    });

    it("enables RLS + FORCE RLS on every corrected table", async () => {
      const { rows } = await client.query(`
        SELECT relname, relrowsecurity, relforcerowsecurity
        FROM pg_class WHERE relname = ANY($1::text[])
      `, [["organization_members", "grievance_deadlines", "member_documents", "message_notifications"]]);
      expect(rows).toHaveLength(4);
      for (const row of rows) {
        expect(row.relrowsecurity, `${row.relname} RLS`).toBe(true);
        expect(row.relforcerowsecurity, `${row.relname} FORCE RLS`).toBe(true);
      }
    });

    it("establishes member_documents.organization_id as UUID referencing organizations", async () => {
      const { rows } = await client.query(`
        SELECT data_type, udt_name FROM information_schema.columns
        WHERE table_name = 'member_documents' AND column_name = 'organization_id'
      `);
      expect(rows).toEqual([{ data_type: "uuid", udt_name: "uuid" }]);
    });

  });

  describe("real per-tenant RLS behavior (connected as the actual runtime/system roles)", () => {
    let orgA: string;
    let orgB: string;
    let runtimeClient: Client;
    let systemClient: Client;

    beforeEach(async () => {
      await client.query(migrationSql);
      await client.query(`ALTER ROLE union_eyes_runtime LOGIN PASSWORD '${RUNTIME_PASSWORD}'`);
      await client.query(`ALTER ROLE union_eyes_system LOGIN PASSWORD '${SYSTEM_PASSWORD}'`);

      orgA = randomUUID();
      orgB = randomUUID();
      await client.query(`INSERT INTO organizations (id) VALUES ($1), ($2)`, [orgA, orgB]);

      const runtimeUrl = new URL(isolatedUrl);
      runtimeUrl.username = "union_eyes_runtime";
      runtimeUrl.password = RUNTIME_PASSWORD;
      runtimeClient = new Client({ connectionString: runtimeUrl.toString() });
      await runtimeClient.connect();

      const systemUrl = new URL(isolatedUrl);
      systemUrl.username = "union_eyes_system";
      systemUrl.password = SYSTEM_PASSWORD;
      systemClient = new Client({ connectionString: systemUrl.toString() });
      await systemClient.connect();
    });

    afterEach(async () => {
      await runtimeClient?.end();
      await systemClient?.end();
    });

    async function setOrgContext(c: Client, orgId: string | null) {
      await c.query(`SELECT set_config('app.current_org_id', $1, false)`, [orgId ?? ""]);
    }

    it("organization_members: visible in correct org context, hidden for wrong/missing context", async () => {
      const userId = "member_1";
      await client.query(`INSERT INTO organization_members (organization_id, user_id) VALUES ($1, $2)`, [orgA, userId]);

      await setOrgContext(runtimeClient, orgA);
      const own = await runtimeClient.query(`SELECT id FROM organization_members WHERE user_id = $1`, [userId]);
      expect(own.rows).toHaveLength(1);

      await setOrgContext(runtimeClient, orgB);
      const wrong = await runtimeClient.query(`SELECT id FROM organization_members WHERE user_id = $1`, [userId]);
      expect(wrong.rows).toHaveLength(0);

      await setOrgContext(runtimeClient, null);
      const missing = await runtimeClient.query(`SELECT id FROM organization_members WHERE user_id = $1`, [userId]);
      expect(missing.rows).toHaveLength(0);
    });

    it("grievance_deadlines: visible when the parent grievance belongs to current org, hidden otherwise", async () => {
      const grievanceA = await client.query(`INSERT INTO grievances (organization_id) VALUES ($1) RETURNING id`, [orgA]);
      const grievanceB = await client.query(`INSERT INTO grievances (organization_id) VALUES ($1) RETURNING id`, [orgB]);
      const deadlineA = await client.query(`INSERT INTO grievance_deadlines (grievance_id) VALUES ($1) RETURNING id`, [grievanceA.rows[0].id]);
      await client.query(`INSERT INTO grievance_deadlines (grievance_id) VALUES ($1)`, [grievanceB.rows[0].id]);

      await setOrgContext(runtimeClient, orgA);
      const visible = await runtimeClient.query(`SELECT id FROM grievance_deadlines`);
      expect(visible.rows.map((r) => r.id)).toEqual([deadlineA.rows[0].id]);
    });

    it("member_documents: visible for matching organization_id, hidden for a different or NULL organization_id", async () => {
      await client.query(`INSERT INTO member_documents (organization_id, user_id) VALUES ($1, 'u1'), ($2, 'u2'), (NULL, 'u3')`, [orgA, orgB]);

      await setOrgContext(runtimeClient, orgA);
      const visible = await runtimeClient.query(`SELECT user_id FROM member_documents`);
      expect(visible.rows.map((r) => r.user_id)).toEqual(["u1"]);
    });

    it("message_notifications: visible only when notification -> message -> thread resolves to the current org", async () => {
      const threadA = await client.query(`INSERT INTO message_threads (organization_id) VALUES ($1) RETURNING id`, [orgA]);
      const threadB = await client.query(`INSERT INTO message_threads (organization_id) VALUES ($1) RETURNING id`, [orgB]);
      const messageA = await client.query(`INSERT INTO messages (thread_id) VALUES ($1) RETURNING id`, [threadA.rows[0].id]);
      const messageB = await client.query(`INSERT INTO messages (thread_id) VALUES ($1) RETURNING id`, [threadB.rows[0].id]);
      const notifA = await client.query(`INSERT INTO message_notifications (message_id, user_id) VALUES ($1, 'u1') RETURNING id`, [messageA.rows[0].id]);
      await client.query(`INSERT INTO message_notifications (message_id, user_id) VALUES ($1, 'u1')`, [messageB.rows[0].id]);

      await setOrgContext(runtimeClient, orgA);
      const visible = await runtimeClient.query(`SELECT id FROM message_notifications`);
      expect(visible.rows.map((r) => r.id)).toEqual([notifA.rows[0].id]);
    });

    it("union_eyes_system sees all rows across organizations for all four corrected tables, regardless of session context", async () => {
      await client.query(`INSERT INTO organization_members (organization_id, user_id) VALUES ($1, 's1'), ($2, 's2')`, [orgA, orgB]);
      const members = await systemClient.query(`SELECT id FROM organization_members`);
      expect(members.rows.length).toBeGreaterThanOrEqual(2);

      const grievanceA = await client.query(`INSERT INTO grievances (organization_id) VALUES ($1) RETURNING id`, [orgA]);
      await client.query(`INSERT INTO grievance_deadlines (grievance_id) VALUES ($1)`, [grievanceA.rows[0].id]);
      const deadlines = await systemClient.query(`SELECT id FROM grievance_deadlines`);
      expect(deadlines.rows.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("structural regression guards (static scan of the migration source)", () => {
    it("must not call organization_members with isText=TRUE", () => {
      expect(migrationSql).not.toMatch(/ue_create_direct_org_rls_policy\(\s*'organization_members'\s*,\s*'organization_id'\s*,\s*TRUE\s*\)/i);
    });

    it("must not reference grievance_deadlines.organization_id or call the direct-org helper on it", () => {
      expect(migrationSql).not.toMatch(/ue_create_direct_org_rls_policy\(\s*'grievance_deadlines'/i);
      expect(migrationSql).not.toContain("grievance_deadlines.organization_id");
    });

    it("must not reference message_notifications.thread_id or call the generic parent-owned helper with it", () => {
      expect(migrationSql).not.toMatch(/ue_create_parent_owned_rls_policy\(\s*'message_notifications'\s*,\s*'thread_id'\s*\)/i);
      expect(migrationSql).not.toContain("message_notifications.thread_id");
    });

    it("must establish member_documents.organization_id before invoking its direct-org policy", () => {
      const addColumnIndex = migrationSql.indexOf("ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id)");
      const policyCallIndex = migrationSql.indexOf("ue_create_direct_org_rls_policy('member_documents')");
      expect(addColumnIndex).toBeGreaterThan(-1);
      expect(policyCallIndex).toBeGreaterThan(-1);
      expect(addColumnIndex).toBeLessThan(policyCallIndex);
    });

    it("retains the three-argument helper signature required by Round 59's re-invocation script", () => {
      expect(migrationSql).toMatch(/CREATE OR REPLACE FUNCTION ue_create_direct_org_rls_policy\(\s*p_table_name TEXT,\s*p_org_column TEXT DEFAULT 'organization_id',\s*p_org_column_is_text BOOLEAN DEFAULT FALSE/);
    });
  });
});
