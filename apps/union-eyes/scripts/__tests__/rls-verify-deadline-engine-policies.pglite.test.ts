/**
 * Regression: the deployment-time rls-verify preflight must reject unexpected permissive / PUBLIC policies on the
 * three deadline-engine tables, including when RLS + FORCE are enabled and the expected role policies exist.
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
  return db;
}

async function verdicts(db: PGlite) {
  const tables = (await db.query(DEADLINE_ENGINE_TABLES_QUERY)).rows as never[];
  const policies = (await db.query(DEADLINE_ENGINE_POLICIES_QUERY)).rows as never[];
  const results = evaluateDeadlineEngineRlsClosure({ tables, policies });
  return { results, failed: results.filter((r) => !r.pass) };
}

describe('rls-verify preflight: deadline-engine policy closure', () => {
  it('covers exactly the three protected deadline-engine tables', () => {
    expect([...DEADLINE_ENGINE_TABLES].sort()).toEqual(['deadline_audit_events', 'deadline_reminder_executions', 'deadline_reminders']);
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
      expect(rows).toHaveLength(3);
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
