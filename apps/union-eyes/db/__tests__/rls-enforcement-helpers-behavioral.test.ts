/**
 * db/__tests__/rls-enforcement-helpers-behavioral.test.ts
 *
 * Round 58 Phase 1+ — behavioral proof of the four NEW RLS policy-helper
 * functions introduced by
 * db/migrations/20260910_rls_enforcement_expansion_round58.sql:
 *   ue_create_parent_owned_rls_policy_v2
 *   ue_create_user_rls_policy
 *   ue_create_mixed_global_tenant_rls_policy
 *   ue_create_multi_party_rls_policy
 *
 * Runs against a REAL, disposable, non-shared PostgreSQL server (never
 * staging/production) — required because these policies are `TO
 * union_eyes_runtime` / `TO union_eyes_system` ROLE-scoped, and proving a
 * role-scoped policy actually denies a different role requires a real
 * multi-role Postgres server (matches the existing, established repo
 * convention: packages/sage-core/src/records-postgres-server.test.ts explains
 * exactly this "real non-owner roles + RLS" requirement in its own header).
 * PGlite (used for Round 58 Phase 0's provenance proof) is single-session and
 * cannot independently prove that ordinary role privilege separation itself
 * holds — it CAN prove SQL *shape* correctness (see
 * scripts/rls-enforcement/apply-enforcement-dry-run.ts for that), but not
 * "a session authenticated as union_eyes_runtime is denied by RLS."
 *
 * Provide RLS_ENFORCEMENT_TEST_URL (a superuser connection string to a
 * disposable postgres:16, e.g. `docker run -d -e POSTGRES_PASSWORD=postgres
 * -p 5432:5432 postgres:16`) to run this suite. It is SKIPPED (not failed)
 * when the variable is absent, exactly like sage-core's equivalent suite —
 * this is intentional so the ordinary `vitest run` used everywhere else in
 * this repo does not require Docker.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import * as fs from "node:fs";
import * as path from "node:path";

const TEST_URL = process.env.RLS_ENFORCEMENT_TEST_URL;

const describeOrSkip = TEST_URL ? describe : describe.skip;

describeOrSkip("Round 58 Phase 1+ — new RLS helper functions (disposable PostgreSQL)", () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: TEST_URL });
    await client.connect();

    // Fresh, isolated schema per run so this test never collides with
    // anything else that might exist on the disposable server.
    await client.query(`DROP SCHEMA IF EXISTS round58_phase1_proof CASCADE`);
    await client.query(`CREATE SCHEMA round58_phase1_proof`);
    await client.query(`SET search_path TO round58_phase1_proof, public`);

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
    await client.query(`GRANT ALL ON SCHEMA round58_phase1_proof TO union_eyes_runtime, union_eyes_system`);
    await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA round58_phase1_proof GRANT ALL ON TABLES TO union_eyes_runtime, union_eyes_system`);

    // Load the four new helper function definitions verbatim from the
    // actual generated migration file (never hand-copy — proves the exact
    // committed SQL, not a paraphrase of it).
    const migrationPath = path.resolve(
      __dirname,
      "../migrations/20260910_rls_enforcement_expansion_round58.sql"
    );
    const migrationSql = fs.readFileSync(migrationPath, "utf8");
    const helperSection = migrationSql.split("-- PART B —")[0];
    await client.query(helperSection);

    // Stub tables — one per new policy shape.
    await client.query(`
      CREATE TABLE parent_orgs (id uuid primary key, organization_id text not null);
      CREATE TABLE parent_owned_children (id uuid primary key, parent_id uuid not null);
      GRANT ALL ON parent_orgs, parent_owned_children TO union_eyes_runtime, union_eyes_system;

      CREATE TABLE user_scoped_rows (id uuid primary key, user_id text not null);
      GRANT ALL ON user_scoped_rows TO union_eyes_runtime, union_eyes_system;

      CREATE TABLE mixed_global_rows (id uuid primary key, organization_id text);
      GRANT ALL ON mixed_global_rows TO union_eyes_runtime, union_eyes_system;

      CREATE TABLE multi_party_rows (id uuid primary key, org_a text not null, org_b text not null);
      GRANT ALL ON multi_party_rows TO union_eyes_runtime, union_eyes_system;
    `);

    await client.query(
      `SELECT ue_create_parent_owned_rls_policy_v2('parent_owned_children', 'parent_id', 'parent_orgs', 'organization_id', TRUE)`
    );
    await client.query(`SELECT ue_create_user_rls_policy('user_scoped_rows', 'user_id')`);
    await client.query(`SELECT ue_create_mixed_global_tenant_rls_policy('mixed_global_rows', 'organization_id')`);
    await client.query(`SELECT ue_create_multi_party_rls_policy('multi_party_rows', 'org_a', 'org_b')`);

    // Seed fixture data as superuser (bypasses RLS).
    await client.query(`INSERT INTO parent_orgs VALUES ('11111111-1111-1111-1111-111111111111', 'org-a')`);
    await client.query(`INSERT INTO parent_owned_children VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111')`);
    await client.query(`INSERT INTO user_scoped_rows VALUES ('33333333-3333-3333-3333-333333333333', 'user-a')`);
    await client.query(`INSERT INTO user_scoped_rows VALUES ('44444444-4444-4444-4444-444444444444', 'user-b')`);
    await client.query(`INSERT INTO mixed_global_rows VALUES ('55555555-5555-5555-5555-555555555555', NULL)`); // global
    await client.query(`INSERT INTO mixed_global_rows VALUES ('66666666-6666-6666-6666-666666666666', 'org-a')`); // tenant-owned
    await client.query(`INSERT INTO multi_party_rows VALUES ('77777777-7777-7777-7777-777777777777', 'org-a', 'org-b')`);
  });

  afterAll(async () => {
    await client.query(`DROP SCHEMA IF EXISTS round58_phase1_proof CASCADE`);
    await client.end();
  });

  async function asRuntime<T>(orgId: string | null, userId: string | null, fn: () => Promise<T>): Promise<T> {
    await client.query("BEGIN");
    try {
      await client.query("SET ROLE union_eyes_runtime");
      await client.query(`SELECT set_config('app.current_org_id', $1, true)`, [orgId ?? ""]);
      await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [userId ?? ""]);
      return await fn();
    } finally {
      // ROLLBACK must come first: SET ROLE (unlike SET LOCAL ROLE) is
      // session-scoped, not transaction-scoped, but if fn() left the
      // transaction in an ABORTED state (e.g. an expected policy-denial
      // error), every subsequent statement including RESET ROLE is
      // rejected until the transaction ends — so end it before resetting.
      await client.query("ROLLBACK").catch(() => {});
      await client.query("RESET ROLE");
    }
  }

  it("PARENT_OWNED v2: child row visible only when the caller's org matches the parent row's org", async () => {
    const visible = await asRuntime("org-a", null, async () => {
      const r = await client.query(`SELECT * FROM parent_owned_children`);
      return r.rows;
    });
    expect(visible).toHaveLength(1);

    const hidden = await asRuntime("org-b", null, async () => {
      const r = await client.query(`SELECT * FROM parent_owned_children`);
      return r.rows;
    });
    expect(hidden).toHaveLength(0);
  });

  it("USER_RLS: a row is visible only to its own user_id, never another user", async () => {
    const own = await asRuntime(null, "user-a", async () => {
      const r = await client.query(`SELECT * FROM user_scoped_rows`);
      return r.rows;
    });
    expect(own).toHaveLength(1);
    expect(own[0].user_id).toBe("user-a");

    const other = await asRuntime(null, "user-b", async () => {
      const r = await client.query(`SELECT * FROM user_scoped_rows`);
      return r.rows;
    });
    expect(other).toHaveLength(1);
    expect(other[0].user_id).toBe("user-b");
  });

  it("MIXED_GLOBAL_TENANT: reads see global (NULL) rows plus own-org rows, never another org's rows", async () => {
    const rows = await asRuntime("org-a", null, async () => {
      const r = await client.query(`SELECT * FROM mixed_global_rows ORDER BY id`);
      return r.rows;
    });
    expect(rows).toHaveLength(2); // the global row + org-a's own row

    const otherOrgRows = await asRuntime("org-b", null, async () => {
      const r = await client.query(`SELECT * FROM mixed_global_rows ORDER BY id`);
      return r.rows;
    });
    expect(otherOrgRows).toHaveLength(1); // only the global row
    expect(otherOrgRows[0].organization_id).toBeNull();
  });

  it("MIXED_GLOBAL_TENANT: a tenant cannot author a global (NULL) row", async () => {
    await expect(
      asRuntime("org-a", null, async () => {
        await client.query(`INSERT INTO mixed_global_rows VALUES (gen_random_uuid(), NULL)`);
      })
    ).rejects.toThrow();
  });

  it("MIXED_GLOBAL_TENANT: a tenant cannot reassign its own row into the global class", async () => {
    await expect(
      asRuntime("org-a", null, async () => {
        await client.query(
          `UPDATE mixed_global_rows SET organization_id = NULL WHERE id = '66666666-6666-6666-6666-666666666666'`
        );
      })
    ).rejects.toThrow();
  });

  it("MULTI_PARTY: either named party can read the row", async () => {
    const asA = await asRuntime("org-a", null, async () => {
      const r = await client.query(`SELECT * FROM multi_party_rows`);
      return r.rows;
    });
    expect(asA).toHaveLength(1);

    const asB = await asRuntime("org-b", null, async () => {
      const r = await client.query(`SELECT * FROM multi_party_rows`);
      return r.rows;
    });
    expect(asB).toHaveLength(1);

    const asOutsider = await asRuntime("org-c", null, async () => {
      const r = await client.query(`SELECT * FROM multi_party_rows`);
      return r.rows;
    });
    expect(asOutsider).toHaveLength(0);
  });

  it("MULTI_PARTY: ordinary tenant runtime cannot write at all (system-authority-only by doctrine)", async () => {
    await expect(
      asRuntime("org-a", null, async () => {
        await client.query(
          `INSERT INTO multi_party_rows VALUES (gen_random_uuid(), 'org-a', 'org-x')`
        );
      })
    ).rejects.toThrow();
  });

  it("fail-closed: no org/user context set at all sees zero rows on every new policy shape", async () => {
    const noCtx = await asRuntime(null, null, async () => {
      const a = await client.query(`SELECT * FROM parent_owned_children`);
      const b = await client.query(`SELECT * FROM user_scoped_rows`);
      const c = await client.query(`SELECT * FROM multi_party_rows`);
      return [a.rows.length, b.rows.length, c.rows.length];
    });
    expect(noCtx).toEqual([0, 0, 0]);

    // Mixed-global is the one deliberate exception: the global (NULL) row
    // remains visible with no context, by design (it is not tenant data).
    const mixedNoCtx = await asRuntime(null, null, async () => {
      const r = await client.query(`SELECT * FROM mixed_global_rows`);
      return r.rows;
    });
    expect(mixedNoCtx).toHaveLength(1);
    expect(mixedNoCtx[0].organization_id).toBeNull();
  });

  it("union_eyes_system always sees every row on every new policy shape regardless of session context", async () => {
    await client.query("BEGIN");
    try {
      await client.query("SET ROLE union_eyes_system");
      const a = await client.query(`SELECT * FROM parent_owned_children`);
      const b = await client.query(`SELECT * FROM user_scoped_rows`);
      const c = await client.query(`SELECT * FROM mixed_global_rows`);
      const d = await client.query(`SELECT * FROM multi_party_rows`);
      expect(a.rows).toHaveLength(1);
      expect(b.rows).toHaveLength(2);
      expect(c.rows).toHaveLength(2);
      expect(d.rows).toHaveLength(1);
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      await client.query("RESET ROLE");
    }
  });
});
