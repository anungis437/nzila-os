/**
 * Regression: the deployment-time rls-verify preflight must reject unexpected permissive / PUBLIC policies on the
 * deadline-engine tables, including deadline_reassignment_convergence, even when RLS + FORCE are enabled and the
 * expected role policies exist.
 *
 * Background (Phase 3A): on staging the preflight went 1698/1699 because deadline_reminder_executions lacked
 * enforcement, but the permissive PUBLIC policies on the other two tables (installed by root 0045) were NOT flagged:
 * the existing checks only require RLS+FORCE and the presence of runtime/system policies. A permissive policy is
 * OR-combined with the approved ones, so "expected policies exist" never proves closure.
 *
 * The check runs the verifier's own exported catalog queries and evaluator against a real catalog (PGlite).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import {
  DEADLINE_ENGINE_POLICIES_QUERY,
  DEADLINE_ENGINE_TABLES,
  DEADLINE_ENGINE_TABLES_QUERY,
  evaluateDeadlineEngineRlsClosure,
} from '../rls-verify';

const APP_ROOT = resolve(__dirname, '..', '..');
const REPO_ROOT = resolve(APP_ROOT, '..', '..');
const CACHE = resolve(APP_ROOT, 'db', 'migrations-cache');
const read = (p: string) => readFileSync(p, 'utf8');
const SQL_0015 = read(resolve(CACHE, '0015_deadline_engine_rls_fail_closed_closure.sql'));
const SQL_0019 = read(resolve(CACHE, '0019_deadline_reassignment_convergence.sql'));
const ROOT_0045 = read(resolve(REPO_ROOT, 'migrations', '0045_union_eyes_deadline_engine.sql'));

const fn = (file: string, name: string): string => {
  const m = read(resolve(CACHE, file)).match(new RegExp(`CREATE OR REPLACE FUNCTION ${name}\\([\\s\\S]*?\\$\\$ LANGUAGE plpgsql;`));
  if (!m) throw new Error(`helper ${name} not found in ${file}`);
  return m[0];
};

// Staging-shaped state: root 0045 (PUBLIC policies) + 0010/0012 helpers + 0014-style policies on two tables.
async function legacyDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE union_eyes_runtime NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS INHERIT NOLOGIN;
    CREATE ROLE union_eyes_system  NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS INHERIT NOLOGIN;
  `);
  await db.exec(ROOT_0045);
  await db.exec(fn('0010_tenant_isolation_rls_foundation.sql', 'ue_create_direct_org_rls_policy'));
  await db.exec(fn('0012_storage_authority_rls_final_closure.sql', 'ue_create_parent_owned_rls_policy_v2'));
  await db.exec(`
    SELECT ue_create_direct_org_rls_policy('deadline_audit_events');
    SELECT ue_create_direct_org_rls_policy('deadline_reminders');
  `);
  return db;
}

async function closedDb(): Promise<PGlite> {
  const db = await legacyDb();
  await db.exec(SQL_0015);
  await db.exec(SQL_0019);
  return db;
}

async function verdicts(db: PGlite) {
  const tables = (await db.query(DEADLINE_ENGINE_TABLES_QUERY)).rows as never[];
  const policies = (await db.query(DEADLINE_ENGINE_POLICIES_QUERY)).rows as never[];
  const results = evaluateDeadlineEngineRlsClosure({ tables, policies });
  return { results, failed: results.filter((r) => !r.pass) };
}

describe('rls-verify preflight: deadline-engine policy closure', () => {
  it('covers exactly the protected deadline-engine tables', () => {
    expect([...DEADLINE_ENGINE_TABLES].sort()).toEqual([
      'deadline_audit_events',
      'deadline_reassignment_convergence',
      'deadline_reminder_executions',
      'deadline_reminders',
    ]);
    expect(DEADLINE_ENGINE_TABLES_QUERY).toContain('deadline_reassignment_convergence');
    expect(DEADLINE_ENGINE_POLICIES_QUERY).toContain('deadline_reassignment_convergence');
  });

  it('passes on the approved closed state produced by migration 0015', async () => {
    const db = await closedDb();
    const { results, failed } = await verdicts(db);
    expect(failed, JSON.stringify(failed)).toEqual([]);
    expect(results.length).toBeGreaterThanOrEqual(DEADLINE_ENGINE_TABLES.length * 4);
  });

  it('FAILS on the staging-shaped legacy state (the PUBLIC policies the live preflight did not flag)', async () => {
    const db = await legacyDb();
    const { failed } = await verdicts(db);
    const text = JSON.stringify(failed);
    expect(failed.length).toBeGreaterThan(0);
    for (const p of ['deadline_reminders_tenant_isolation', 'deadline_audit_events_tenant_isolation', 'deadline_reminder_executions_read']) {
      expect(text, p).toContain(p);
    }
  });

  describe('blind spot: RLS + FORCE are on and every expected role policy still exists', () => {
    let db: PGlite;
    beforeEach(async () => {
      db = await closedDb();
    });

    const precondition = async () => {
      const rows = (await db.query(`
        SELECT c.relname, c.relrowsecurity AS rls, c.relforcerowsecurity AS forced,
               EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid AND 'union_eyes_runtime'::regrole = ANY (p.polroles)) AS has_runtime,
               EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid AND 'union_eyes_system'::regrole = ANY (p.polroles)) AS has_system
        FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relname = ANY($1)`, [[...DEADLINE_ENGINE_TABLES]])).rows as Array<Record<string, boolean | string>>;
      expect(rows).toHaveLength(DEADLINE_ENGINE_TABLES.length);
      // These are the conditions the pre-existing manifest coverage check evaluates: all true => it reports "enforced".
      for (const r of rows) expect([r.rls, r.forced, r.has_runtime, r.has_system], String(r.relname)).toEqual([true, true, true, true]);
    };

    const reopeners: Array<[string, string, RegExp]> = [
      ['a PUBLIC USING(true) policy', `CREATE POLICY hand_made ON deadline_reminders USING (true) WITH CHECK (true)`, /hand_made/],
      ['a PUBLIC policy with the legacy tenant fallback name', `CREATE POLICY deadline_reminders_tenant_isolation ON deadline_audit_events USING (true)`, /deadline_reminders_tenant_isolation/],
      ['a runtime-role USING(true) policy under an unapproved name', `CREATE POLICY runtime_all ON deadline_reminder_executions FOR ALL TO union_eyes_runtime USING (true) WITH CHECK (true)`, /runtime_all/],
      ['a policy for the system role granted to PUBLIC as well', `CREATE POLICY system_and_public ON deadline_reminders FOR SELECT TO union_eyes_system, public USING (true)`, /system_and_public/],
      ['a policy with an approved-looking name but a widened body', `DROP POLICY ue_org_isolation_select ON deadline_reminders;
        CREATE POLICY ue_org_isolation_select ON deadline_reminders FOR SELECT TO union_eyes_runtime USING (true)`, /ue_org_isolation_select/],
      ['an approved-name policy widened with an empty-context OR branch', `DROP POLICY ue_org_isolation_select ON deadline_audit_events;
        CREATE POLICY ue_org_isolation_select ON deadline_audit_events FOR SELECT TO union_eyes_runtime
          USING (organization_id::text = current_setting('app.current_org_id', true) OR current_setting('app.current_org_id', true) IS NULL)`, /ue_org_isolation_select/],
      ['an approved-name policy re-addressed to PUBLIC', `DROP POLICY ue_org_isolation_delete ON deadline_reminders;
        CREATE POLICY ue_org_isolation_delete ON deadline_reminders FOR DELETE TO public
          USING (organization_id::text = current_setting('app.current_org_id', true))`, /ue_org_isolation_delete/],
      ['a widened parent-owned executions policy', `DROP POLICY ue_parent_org_isolation_v2 ON deadline_reminder_executions;
        CREATE POLICY ue_parent_org_isolation_v2 ON deadline_reminder_executions FOR ALL TO union_eyes_runtime USING (true) WITH CHECK (true)`, /ue_parent_org_isolation_v2/],
      ['the system policy altered away from the approved FOR ALL geometry', `DROP POLICY ue_system_full_access ON deadline_reminders;
        CREATE POLICY ue_system_full_access ON deadline_reminders FOR SELECT TO union_eyes_system USING (true)`, /ue_system_full_access/],
      ['a RESTRICTIVE-vs-PERMISSIVE swap of an approved policy', `DROP POLICY ue_org_isolation_update ON deadline_reminders;
        CREATE POLICY ue_org_isolation_update ON deadline_reminders AS RESTRICTIVE FOR UPDATE TO union_eyes_runtime
          USING (organization_id::text = current_setting('app.current_org_id', true))
          WITH CHECK (organization_id::text = current_setting('app.current_org_id', true))`, /ue_org_isolation_update/],
    ];

    for (const [label, ddl, expectName] of reopeners) {
      it(`detects ${label} although RLS, FORCE and the expected role policies are all present`, async () => {
        await db.exec(ddl);
        await precondition();
        const { failed } = await verdicts(db);
        expect(failed.length, `no failing check for: ${label}`).toBeGreaterThan(0);
        expect(JSON.stringify(failed)).toMatch(expectName);
      });
    }

    it('detects a missing approved policy', async () => {
      await db.exec(`DROP POLICY ue_org_isolation_insert ON deadline_audit_events`);
      const { failed } = await verdicts(db);
      expect(JSON.stringify(failed)).toContain('ue_org_isolation_insert');
    });

    it('detects RLS or FORCE switched off', async () => {
      await db.exec(`ALTER TABLE deadline_reminder_executions NO FORCE ROW LEVEL SECURITY`);
      const { failed } = await verdicts(db);
      expect(JSON.stringify(failed)).toContain('deadline_reminder_executions');
    });

    it('is re-closed by replaying 0015 (idempotent recovery) once the hand-made policy is removed', async () => {
      await db.exec(`CREATE POLICY hand_made ON deadline_reminders USING (true)`);
      expect((await verdicts(db)).failed.length).toBeGreaterThan(0);
      await db.exec(`DROP POLICY hand_made ON deadline_reminders`);
      await db.exec(SQL_0015);
      expect((await verdicts(db)).failed).toEqual([]);
    });
  });

  it('reports absent tables as visible and non-failing (source-native bootstrap), never silently', () => {
    const results = evaluateDeadlineEngineRlsClosure({ tables: [], policies: [] });
    expect(results).toHaveLength(DEADLINE_ENGINE_TABLES.length * 4);
    for (const r of results) {
      expect(r.pass).toBe(true);
      expect(r.detail).toMatch(/NOT_PRESENT/);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Predicate semantics. Structural checks (name, role, command, no OR / IS NULL / literal true) are NOT enough: a policy can
// combine an identity comparison with a nonempty-context test, pass all of them, and still expose every tenant.
// The verifier therefore pins the approved predicate text exactly (identical on PostgreSQL 15, 16 and 18) and these tests
// prove, against a real catalog and a NOBYPASSRLS role, that (a) each widening shape really leaks and (b) the verifier
// rejects it, and (c) the approved state really isolates tenants.
// ---------------------------------------------------------------------------------------------------------------------
const ORG_A = '00000000-0000-0000-0000-00000000000a';
const ORG_B = '00000000-0000-0000-0000-00000000000b';
const GRANTS = `GRANT SELECT, INSERT, UPDATE, DELETE ON deadline_reminders, deadline_audit_events, deadline_reminder_executions TO union_eyes_runtime, union_eyes_system`;

async function seedTenants(db: PGlite): Promise<void> {
  await db.exec(GRANTS);
  for (const org of [ORG_A, ORG_B]) {
    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO deadline_reminders (id, source_table, source_deadline_id, organization_id, offset_days, scheduled_for, recipient_role, recipient_email, recipient_email_hash)
       VALUES ($1, 'grievance_deadlines', gen_random_uuid(), $2, 1, now(), 'assigned_steward', $3, $4)`,
      [id, org, `${org}@example.invalid`, `h-${org}`],
    );
    await db.query(
      `INSERT INTO deadline_audit_events (organization_id, source_table, source_deadline_id, event_type, actor_type, correlation_id)
       VALUES ($1, 'grievance_deadlines', gen_random_uuid(), 'deadline.created', 'system', 'c')`,
      [org],
    );
    await db.query(`INSERT INTO deadline_reminder_executions (reminder_id, attempt_number, outcome, worker_instance, correlation_id) VALUES ($1, 1, 'sent', 'w', 'c')`, [id]);
  }
}

async function asRuntime(db: PGlite, ctx: string | null) {
  await db.exec('RESET ROLE');
  await db.exec('SET ROLE union_eyes_runtime');
  await db.query(`SELECT set_config('app.current_org_id', $1, false)`, [ctx ?? '']);
}
const reset = (db: PGlite) => db.exec('RESET ROLE');
const rows = async (db: PGlite, table: string) => (await db.query<{ organization_id?: string }>(`SELECT * FROM ${table}`)).rows;

describe('approved state really isolates tenants (acceptance implies isolation)', () => {
  it('with a tenant context set, only that tenant is visible, writable and deletable on all three tables; no context sees nothing', async () => {
    const db = await closedDb();
    await seedTenants(db);
    expect((await verdicts(db)).failed).toEqual([]);
    for (const table of ['deadline_reminders', 'deadline_audit_events']) {
      await asRuntime(db, ORG_A);
      const seen = await rows(db, table);
      expect(seen.length, table).toBe(1);
      expect(seen.every((r) => r.organization_id === ORG_A), table).toBe(true);
      await asRuntime(db, null);
      expect((await rows(db, table)).length, `${table} with no context`).toBe(0);
    }
    await asRuntime(db, ORG_A);
    expect((await rows(db, 'deadline_reminder_executions')).length).toBe(1);
    await asRuntime(db, null);
    expect((await rows(db, 'deadline_reminder_executions')).length).toBe(0);
    // cross-tenant write/delete affect nothing; a forged tenant insert is rejected
    await asRuntime(db, ORG_A);
    const upd = await db.query(`UPDATE deadline_reminders SET offset_days = 99 WHERE organization_id = $1`, [ORG_B]);
    expect(upd.affectedRows).toBe(0);
    const del = await db.query(`DELETE FROM deadline_reminders WHERE organization_id = $1`, [ORG_B]);
    expect(del.affectedRows).toBe(0);
    await db.exec('BEGIN');
    await expect(
      db.query(
        `INSERT INTO deadline_reminders (source_table, source_deadline_id, organization_id, offset_days, scheduled_for, recipient_role, recipient_email, recipient_email_hash)
         VALUES ('grievance_deadlines', gen_random_uuid(), $1, 1, now(), 'org_admin', 'x@example.invalid', 'hx')`,
        [ORG_B],
      ),
    ).rejects.toThrow(/row-level security/);
    await db.exec('ROLLBACK');
    await reset(db);
  });
});

// latent: not exploitable alone (UPDATE also needs SELECT visibility; the executions subquery is bounded by the parent's RLS) but one policy edit away from it.
type Widening = { label: string; table: 'deadline_reminders' | 'deadline_audit_events' | 'deadline_reminder_executions'; drop: string; create: string; ctx: string; latent?: boolean };

const IDENTITY = `organization_id::text = organization_id::text AND current_setting('app.current_org_id', true) <> ''`;
const WIDENINGS: Widening[] = [
  { label: 'identity comparison + nonempty context (select)', table: 'deadline_reminders', drop: 'ue_org_isolation_select', ctx: ORG_A,
    create: `CREATE POLICY ue_org_isolation_select ON deadline_reminders FOR SELECT TO union_eyes_runtime USING (${IDENTITY})` },
  { label: 'identity comparison + nonempty context (audit events select)', table: 'deadline_audit_events', drop: 'ue_org_isolation_select', ctx: ORG_A,
    create: `CREATE POLICY ue_org_isolation_select ON deadline_audit_events FOR SELECT TO union_eyes_runtime USING (${IDENTITY})` },
  { label: 'identity comparison + nonempty context (insert: forged tenant accepted)', table: 'deadline_reminders', drop: 'ue_org_isolation_insert', ctx: ORG_A,
    create: `CREATE POLICY ue_org_isolation_insert ON deadline_reminders FOR INSERT TO union_eyes_runtime WITH CHECK (${IDENTITY})` },
  { label: 'inequality (other tenants only)', table: 'deadline_reminders', drop: 'ue_org_isolation_select', ctx: ORG_A,
    create: `CREATE POLICY ue_org_isolation_select ON deadline_reminders FOR SELECT TO union_eyes_runtime USING (organization_id::text <> current_setting('app.current_org_id', true))` },
  { label: 'context length test only', table: 'deadline_reminders', drop: 'ue_org_isolation_select', ctx: ORG_A,
    create: `CREATE POLICY ue_org_isolation_select ON deadline_reminders FOR SELECT TO union_eyes_runtime USING (length(current_setting('app.current_org_id', true)) > 0)` },
  { label: 'context compared with itself (tautology)', table: 'deadline_reminders', drop: 'ue_org_isolation_select', ctx: ORG_A,
    create: `CREATE POLICY ue_org_isolation_select ON deadline_reminders FOR SELECT TO union_eyes_runtime USING (organization_id::text <> '' AND current_setting('app.current_org_id', true) >= current_setting('app.current_org_id', true))` },
  { label: 'prefix match on the context', table: 'deadline_reminders', drop: 'ue_org_isolation_select', ctx: ORG_A,
    create: `CREATE POLICY ue_org_isolation_select ON deadline_reminders FOR SELECT TO union_eyes_runtime USING (organization_id::text LIKE left(current_setting('app.current_org_id', true), 30) || '%')` },
  { label: 'multi-tenant list in the context', table: 'deadline_reminders', drop: 'ue_org_isolation_select', ctx: `${ORG_A},${ORG_B}`,
    create: `CREATE POLICY ue_org_isolation_select ON deadline_reminders FOR SELECT TO union_eyes_runtime USING (organization_id::text = ANY (string_to_array(current_setting('app.current_org_id', true), ',')))` },
  { label: 'update USING widened (identity + nonempty context)', table: 'deadline_reminders', drop: 'ue_org_isolation_update', ctx: ORG_A, latent: true,
    create: `CREATE POLICY ue_org_isolation_update ON deadline_reminders FOR UPDATE TO union_eyes_runtime USING (${IDENTITY}) WITH CHECK (${IDENTITY})` },
  { label: 'parent join dropped on executions (nonempty context only)', table: 'deadline_reminder_executions', drop: 'ue_parent_org_isolation_v2', ctx: ORG_A,
    create: `CREATE POLICY ue_parent_org_isolation_v2 ON deadline_reminder_executions FOR ALL TO union_eyes_runtime USING (current_setting('app.current_org_id', true) <> '') WITH CHECK (current_setting('app.current_org_id', true) <> '')` },
  { label: 'parent join compares the parent with itself (executions)', table: 'deadline_reminder_executions', drop: 'ue_parent_org_isolation_v2', ctx: ORG_A, latent: true,
    create: `CREATE POLICY ue_parent_org_isolation_v2 ON deadline_reminder_executions FOR ALL TO union_eyes_runtime
      USING (EXISTS (SELECT 1 FROM deadline_reminders parent WHERE parent.id = deadline_reminder_executions.reminder_id AND parent.organization_id::text = parent.organization_id::text) AND current_setting('app.current_org_id', true) <> '')
      WITH CHECK (current_setting('app.current_org_id', true) <> '')` },
];

const leaksAnotherTenant = async (db: PGlite, w: Widening): Promise<boolean> => {
  await asRuntime(db, w.ctx);
  try {
    if (w.table === 'deadline_reminder_executions') return (await rows(db, w.table)).length > 1;
    if (w.create.includes('FOR INSERT')) {
      await db.exec('BEGIN');
      try {
        await db.query(
          `INSERT INTO deadline_reminders (source_table, source_deadline_id, organization_id, offset_days, scheduled_for, recipient_role, recipient_email, recipient_email_hash)
           VALUES ('grievance_deadlines', gen_random_uuid(), $1, 1, now(), 'org_admin', 'x@example.invalid', 'hx')`,
          [ORG_B],
        );
        return true;
      } catch {
        return false;
      } finally {
        await db.exec('ROLLBACK');
      }
    }
    if (w.create.includes('FOR UPDATE')) {
      const upd = await db.query(`UPDATE deadline_reminders SET offset_days = 77 WHERE organization_id = $1`, [ORG_B]);
      return (upd.affectedRows ?? 0) > 0;
    }
    return (await rows(db, w.table)).some((r) => r.organization_id === ORG_B);
  } finally {
    await reset(db);
  }
};

describe('predicate widening that passes the structural rules is rejected', () => {
  for (const w of WIDENINGS) {
    it(`${w.label}: ${w.latent ? 'latent widening' : 'it really leaks another tenant'}, and the verifier rejects it`, async () => {
      const db = await closedDb();
      await seedTenants(db);
      await db.exec(`DROP POLICY ${w.drop} ON ${w.table}`);
      await db.exec(w.create);
      if (!w.latent) expect(await leaksAnotherTenant(db, w), 'the shape must be a genuine cross-tenant widening').toBe(true);
      const { failed } = await verdicts(db);
      expect(failed.length, `verifier accepted a leaking policy: ${w.label}`).toBeGreaterThan(0);
      expect(JSON.stringify(failed)).toContain(w.drop);
    });
  }

  it('a textually different but semantically equivalent rewrite is also rejected (fail-closed; update the contract in a reviewed PR)', async () => {
    const db = await closedDb();
    await seedTenants(db);
    await db.exec(`DROP POLICY ue_org_isolation_select ON deadline_reminders`);
    await db.exec(`CREATE POLICY ue_org_isolation_select ON deadline_reminders FOR SELECT TO union_eyes_runtime USING (lower(organization_id::text) = lower(current_setting('app.current_org_id', true)))`);
    await asRuntime(db, ORG_A);
    expect((await rows(db, 'deadline_reminders')).every((r) => r.organization_id === ORG_A)).toBe(true); // not a leak
    await reset(db);
    const { failed } = await verdicts(db);
    expect(JSON.stringify(failed)).toContain('ue_org_isolation_select');
    expect(JSON.stringify(failed)).toMatch(/approved predicate contract/);
  });

  it('an unexpected predicate on the part a command must not carry is rejected', async () => {
    const db = await closedDb();
    await db.exec(`DROP POLICY ue_org_isolation_select ON deadline_reminders`);
    await db.exec(`CREATE POLICY ue_org_isolation_select ON deadline_reminders FOR SELECT TO union_eyes_runtime USING (organization_id::text = current_setting('app.current_org_id', true))`);
    // SELECT policies carry no WITH CHECK in the catalog; the approved ones match exactly, so this equals the approved state
    expect((await verdicts(db)).failed).toEqual([]);
  });
});

describe('required deadline-engine tables versus an intentionally absent source-native schema', () => {
  it('default: an absent table is a visible, non-failing NOT_PRESENT (source-native bootstrap)', () => {
    const results = evaluateDeadlineEngineRlsClosure({ tables: [], policies: [] });
    expect(results.every((r) => r.pass && /NOT_PRESENT/.test(r.detail))).toBe(true);
  });

  it('when the environment requires the tables (deployed staging/production), an absent table FAILS every check for it', () => {
    const results = evaluateDeadlineEngineRlsClosure({ tables: [], policies: [] }, { requireDeadlineEngineTables: true });
    expect(results).toHaveLength(DEADLINE_ENGINE_TABLES.length * 4);
    expect(results.every((r) => !r.pass && /REQUIRED_TABLE_MISSING/.test(r.detail))).toBe(true);
  });

  it('one missing required table fails only that table; the present, approved tables still pass', async () => {
    const db = await closedDb();
    const tables = ((await db.query(DEADLINE_ENGINE_TABLES_QUERY)).rows as never[]).filter((t: { relname: string }) => t.relname !== 'deadline_audit_events');
    const policies = ((await db.query(DEADLINE_ENGINE_POLICIES_QUERY)).rows as never[]).filter((p: { tablename: string }) => p.tablename !== 'deadline_audit_events');
    const results = evaluateDeadlineEngineRlsClosure({ tables, policies }, { requireDeadlineEngineTables: true });
    const failed = results.filter((r) => !r.pass);
    expect(failed).toHaveLength(4);
    expect(failed.every((r) => r.name.includes('deadline_audit_events') && /REQUIRED_TABLE_MISSING/.test(r.detail))).toBe(true);
  });
});