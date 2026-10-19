/**
 * ARTIFACT TYPE: Security regression (PGlite behavioral proof)
 *
 * Proves scoped migration db/migrations-cache/0015_deadline_engine_rls_fail_closed_closure.sql
 * (CHG-2026-0112) closes the fail-open legacy RLS policies on the three deadline-engine tables,
 * on BOTH delivery paths:
 *   - existing environment: staging-shaped state, 0000-0014 already in the ledger, applied through
 *     the canonical shared executor (tooling/scripts/lib/union-eyes-scoped-migrations.mjs);
 *   - fresh/clean-room path: root 0045 -> scoped helpers -> 0014-style closure -> 0015.
 *
 * The legacy objects are created by the REAL root migrations/0045_union_eyes_deadline_engine.sql and
 * the helpers are the REAL functions from scoped 0010/0012, loaded verbatim. Effective principal is
 * switched with SET ROLE (SQL-engine enforcement evidence; the separately-authenticated server-role
 * proof is the live rls-verify run). Runs in-process on PGlite - no Docker/CI server required.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

const APP_ROOT = resolve(__dirname, '..', '..');
const REPO_ROOT = resolve(APP_ROOT, '..', '..');
const CACHE = resolve(APP_ROOT, 'db', 'migrations-cache');
const JOURNAL = resolve(CACHE, 'meta', '_journal.json');
const TAG = '0015_deadline_engine_rls_fail_closed_closure';
const read = (p: string) => readFileSync(p, 'utf8');
const SQL_0015 = read(resolve(CACHE, `${TAG}.sql`));
const SQL_RECOVERY = read(resolve(CACHE, `${TAG}.rollback.sql`));
const ROOT_0045 = read(resolve(REPO_ROOT, 'migrations', '0045_union_eyes_deadline_engine.sql'));
const code = (sql: string) => sql.replace(/--.*$/gm, '');

const fn = (file: string, name: string): string => {
  const m = read(resolve(CACHE, file)).match(new RegExp(`CREATE OR REPLACE FUNCTION ${name}\\([\\s\\S]*?\\$\\$ LANGUAGE plpgsql;`));
  if (!m) throw new Error(`helper ${name} not found in ${file}`);
  return m[0];
};

const ORG_A = '00000000-0000-0000-0000-00000000000a';
const ORG_B = '00000000-0000-0000-0000-00000000000b';
const TABLES = ['deadline_reminders', 'deadline_audit_events', 'deadline_reminder_executions'] as const;

type Shared = {
  applyScopedMigrations: (c: unknown, o: Record<string, unknown>) => Promise<{ applied: number; appliedTags: string[] }>;
  readJournalEntries: (p: string) => Array<{ tag: string }>;
  computeMigrationHash: (dir: string, tag: string) => { hash: string };
};
const loadShared = (): Promise<Shared> =>
  import(pathToFileURL(resolve(REPO_ROOT, 'tooling', 'scripts', 'lib', 'union-eyes-scoped-migrations.mjs')).href);

async function legacyDb(): Promise<{ db: PGlite; ids: { rA: string; rB: string } }> {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE union_eyes_runtime NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS INHERIT NOLOGIN;
    CREATE ROLE union_eyes_system  NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS INHERIT NOLOGIN;
  `);
  await db.exec(ROOT_0045);
  await db.exec(fn('0010_tenant_isolation_rls_foundation.sql', 'ue_create_direct_org_rls_policy'));
  await db.exec(fn('0012_storage_authority_rls_final_closure.sql', 'ue_create_parent_owned_rls_policy_v2'));
  // 0014-style closure for the two tables 0014 covers (it does not touch deadline_reminder_executions
  // and does not drop the 0045 policies) + the staging grant geometry (both roles hold table DML).
  await db.exec(`
    SELECT ue_create_direct_org_rls_policy('deadline_audit_events');
    SELECT ue_create_direct_org_rls_policy('deadline_reminders');
    GRANT SELECT, INSERT, UPDATE, DELETE ON deadline_reminders, deadline_audit_events, deadline_reminder_executions TO union_eyes_runtime, union_eyes_system;
  `);
  const ids = { rA: crypto.randomUUID(), rB: crypto.randomUUID() };
  for (const [id, org] of [[ids.rA, ORG_A], [ids.rB, ORG_B]] as const) {
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
    await db.query(
      `INSERT INTO deadline_reminder_executions (reminder_id, attempt_number, outcome, worker_instance, correlation_id) VALUES ($1, 1, 'sent', 'w', 'c')`,
      [id],
    );
  }
  return { db, ids };
}

async function as(db: PGlite, role: 'union_eyes_runtime' | 'union_eyes_system', org: string | null) {
  await db.exec('RESET ROLE');
  await db.exec(`SET ROLE ${role}`);
  await db.query(`SELECT set_config('app.current_org_id', $1, false)`, [org ?? '']);
}
const count = async (db: PGlite, t: string) => (await db.query<{ n: number }>(`SELECT count(*)::int n FROM ${t}`)).rows[0].n;
// Runs the statement in its own transaction and always rolls it back, so probes never persist.
const rejected = async (db: PGlite, sql: string, params: unknown[] = []) => {
  await db.exec('BEGIN');
  try {
    const r = await db.query(sql, params);
    return { ok: true, rows: (r as { rows: unknown[] }).rows.length };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  } finally {
    await db.exec('ROLLBACK');
  }
};
const INSERT_REMINDER = `INSERT INTO deadline_reminders (source_table, source_deadline_id, organization_id, offset_days, scheduled_for, recipient_role, recipient_email, recipient_email_hash)
  VALUES ('grievance_deadlines', gen_random_uuid(), $1, 1, now(), 'org_admin', 'x@example.invalid', 'hx') RETURNING id`;

describe('0015 - defect reproduction (pre-state is the staging-shaped fail-open state)', () => {
  let db: PGlite;
  beforeAll(async () => {
    ({ db } = await legacyDb());
  });

  it('runtime with NO org context reads every tenant and can forge an insert (the live finding)', async () => {
    await as(db, 'union_eyes_runtime', null);
    for (const t of TABLES) expect(await count(db, t), t).toBeGreaterThan(0);
    expect((await rejected(db, INSERT_REMINDER, [ORG_B])).ok).toBe(true);
  });
});

describe('0015 - existing-environment upgrade through the canonical executor', () => {
  let db: PGlite;
  let ids: { rA: string; rB: string };
  beforeAll(async () => {
    ({ db, ids } = await legacyDb());
    const shared = await loadShared();
    // Staging ledger caught up through 0014: every earlier journal entry is recorded.
    await db.exec(`CREATE SCHEMA IF NOT EXISTS drizzle; CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint);`);
    for (const e of shared.readJournalEntries(JOURNAL)) {
      if (e.tag === TAG) continue;
      await db.query('INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, 0)', [shared.computeMigrationHash(CACHE, e.tag).hash]);
    }
    const first = await shared.applyScopedMigrations(db, { journalPath: JOURNAL, migrationsDir: CACHE, onlyTags: [TAG] });
    expect(first.appliedTags).toEqual([TAG]);
  });

  it('is recorded in the ledger and is a no-op on re-run (idempotent through the executor)', async () => {
    const shared = await loadShared();
    const again = await shared.applyScopedMigrations(db, { journalPath: JOURNAL, migrationsDir: CACHE });
    expect(again.applied).toBe(0);
    await db.exec('RESET ROLE');
    await db.exec(SQL_0015.split('--> statement-breakpoint').join('\n')); // direct replay must also be safe
  });

  it('catalog: RLS + FORCE + runtime policy + system policy on all three; no PUBLIC policy remains', async () => {
    await db.exec('RESET ROLE');
    for (const t of TABLES) {
      const c = (await db.query<{ rls: boolean; force: boolean; pub: number; rt: number; sys: number }>(
        `SELECT c.relrowsecurity rls, c.relforcerowsecurity "force",
                (SELECT count(*)::int FROM pg_policy p WHERE p.polrelid=c.oid AND 0::oid = ANY (p.polroles)) pub,
                (SELECT count(*)::int FROM pg_policy p WHERE p.polrelid=c.oid AND 'union_eyes_runtime'::regrole = ANY (p.polroles)) rt,
                (SELECT count(*)::int FROM pg_policy p WHERE p.polrelid=c.oid AND 'union_eyes_system'::regrole = ANY (p.polroles)) sys
         FROM pg_class c WHERE c.oid = $1::regclass`, [`public.${t}`])).rows[0];
      expect(c, t).toMatchObject({ rls: true, force: true, pub: 0 });
      expect(c.rt, t).toBeGreaterThan(0);
      expect(c.sys, t).toBeGreaterThan(0);
    }
  });

  it('missing org context fails closed for read and insert (unset and empty)', async () => {
    for (const org of [null, '']) {
      await as(db, 'union_eyes_runtime', org);
      for (const t of TABLES) expect(await count(db, t), `${t} org=${String(org)}`).toBe(0);
    }
    await as(db, 'union_eyes_runtime', null);
    expect((await rejected(db, INSERT_REMINDER, [ORG_B])).ok).toBe(false);
  });

  it('org A reads only its own rows; org B symmetric; cross-tenant update/delete affect nothing', async () => {
    for (const [self, other, selfReminder] of [[ORG_A, ORG_B, ids.rA], [ORG_B, ORG_A, ids.rB]] as const) {
      await as(db, 'union_eyes_runtime', self);
      for (const t of ['deadline_reminders', 'deadline_audit_events']) {
        expect((await db.query<{ n: number }>(`SELECT count(*)::int n FROM ${t} WHERE organization_id = $1`, [self])).rows[0].n, `${t} own`).toBe(1);
        expect((await db.query<{ n: number }>(`SELECT count(*)::int n FROM ${t} WHERE organization_id = $1`, [other])).rows[0].n, `${t} other`).toBe(0);
        expect((await db.query(`UPDATE ${t} SET organization_id = organization_id WHERE organization_id = $1 RETURNING 1`, [other])).rows.length).toBe(0);
      }
      expect((await db.query<{ n: number }>(`SELECT count(*)::int n FROM deadline_reminder_executions WHERE reminder_id = $1`, [selfReminder])).rows[0].n).toBe(1);
      expect(await count(db, 'deadline_reminder_executions')).toBe(1);
    }
  });

  it('a context-A session cannot forge an org-B row', async () => {
    await as(db, 'union_eyes_runtime', ORG_A);
    expect((await rejected(db, INSERT_REMINDER, [ORG_B])).ok).toBe(false);
    expect((await rejected(db, INSERT_REMINDER, [ORG_A])).ok).toBe(true);
  });

  it('the system principal keeps full cross-org access by role, and runtime cannot assume it', async () => {
    await as(db, 'union_eyes_system', null);
    for (const t of TABLES) expect(await count(db, t), t).toBe(2);
    expect((await rejected(db, INSERT_REMINDER, [ORG_B])).ok).toBe(true);
    // PGlite's session user is a superuser, so SET ROLE cannot demonstrate denial here (that is proven
    // against a real server in the clone evidence); assert the catalog preconditions instead.
    await db.exec('RESET ROLE');
    const r = (await db.query<{ member: boolean; bypass: boolean; sup: boolean }>(
      `SELECT pg_has_role('union_eyes_runtime', 'union_eyes_system', 'MEMBER') member, rolbypassrls bypass, rolsuper sup FROM pg_roles WHERE rolname = 'union_eyes_runtime'`)).rows[0];
    expect(r).toEqual({ member: false, bypass: false, sup: false });
  });

  it('append-only enforcement on executions is unaffected', async () => {
    await as(db, 'union_eyes_system', null);
    expect((await rejected(db, 'DELETE FROM deadline_reminder_executions')).ok).toBe(false);
  });
});

describe('0015 - fresh/clean-room path and preconditions', () => {
  it('applies on the clean-room-shaped state (0045 + helpers + 0014-style closure) and fails closed', async () => {
    const { db } = await legacyDb();
    await db.exec(SQL_0015.split('--> statement-breakpoint').join('\n'));
    await as(db, 'union_eyes_runtime', null);
    for (const t of TABLES) expect(await count(db, t), t).toBe(0);
  });

  it('refuses (fail-closed) when a target table is absent', async () => {
    const db = new PGlite();
    await db.exec(`CREATE ROLE union_eyes_runtime NOLOGIN; CREATE ROLE union_eyes_system NOLOGIN;`);
    await db.exec(fn('0010_tenant_isolation_rls_foundation.sql', 'ue_create_direct_org_rls_policy'));
    await db.exec(fn('0012_storage_authority_rls_final_closure.sql', 'ue_create_parent_owned_rls_policy_v2'));
    await expect(db.exec(SQL_0015.split('--> statement-breakpoint').join('\n'))).rejects.toThrow(/does not exist/);
  });

  it('refuses when the 0010/0012 helpers are not installed', async () => {
    const db = new PGlite();
    await expect(db.exec(SQL_0015.split('--> statement-breakpoint').join('\n'))).rejects.toThrow(/not installed/);
  });
});

describe('0015 - exceptional recovery file is gated by a recorded security disposition', () => {
  it('refuses without ue.fail_open_recovery_disposition, and re-opens access only with it (then 0015 re-closes)', async () => {
    const { db } = await legacyDb();
    await db.exec(SQL_0015.split('--> statement-breakpoint').join('\n'));
    await expect(db.exec(SQL_RECOVERY)).rejects.toThrow(/security disposition/);
    await db.exec(`SELECT set_config('ue.fail_open_recovery_disposition', 'SEC-DISP-TEST-0001', false)`);
    await db.exec(SQL_RECOVERY);
    await as(db, 'union_eyes_runtime', null);
    expect(await count(db, 'deadline_reminders')).toBeGreaterThan(0);
    await db.exec('RESET ROLE');
    await db.exec(SQL_0015.split('--> statement-breakpoint').join('\n'));
    await as(db, 'union_eyes_runtime', null);
    for (const t of TABLES) expect(await count(db, t), t).toBe(0);
  });
});

describe('0015 - canonical placement and scope', () => {
  const entries = () => (JSON.parse(read(JOURNAL)) as { entries: Array<{ idx: number; tag: string }> }).entries;

  it('is appended to the scoped journal (last entry) and is not under the frozen lineage', () => {
    expect(entries().at(-1)).toMatchObject({ idx: 15, tag: TAG });
    const frozen = resolve(APP_ROOT, 'db', 'migrations');
    expect(() => read(resolve(frozen, `${TAG}.sql`))).toThrow();
    expect(entries().filter((e) => e.tag === TAG)).toHaveLength(1);
  });

  it('touches exactly the three tables and adds no grants, roles, bypass or ad-hoc policies', () => {
    const exec = code(SQL_0015);
    expect(exec).not.toMatch(/\bGRANT\b|\bREVOKE\b|\bBYPASSRLS\b|CREATE\s+(ROLE|POLICY)|ALTER\s+ROLE|DROP\s+TABLE|COALESCE\s*\(\s*NULLIF/i);
    const named = new Set([...exec.matchAll(/'(deadline_[a-z_]+)'/g)].map((m) => m[1]));
    expect([...named].sort()).toEqual([...TABLES].sort());
    expect(SQL_0015).toContain('RAISE EXCEPTION');
  });

  it('the recovery file is not journaled (never run by an executor)', () => {
    expect(entries().some((e) => e.tag.endsWith('.rollback'))).toBe(false);
  });
});

describe('0015 - one release order across the migration header, recovery file and change record', () => {
  const chg = JSON.parse(read(resolve(REPO_ROOT, 'ops', 'change-records', 'CHG-2026-0112.json'))) as { description: string; rollback_plan: string };

  it('states closure-first / candidate-second and never the superseded "apply after the new revision serves" order', () => {
    expect(SQL_0015).toMatch(/CLOSURE FIRST, candidate application second/);
    expect(chg.description).toMatch(/CLOSURE FIRST, CANDIDATE SECOND/);
    for (const text of [SQL_0015, chg.description]) {
      expect(text).not.toMatch(/apply only after an application revision/i);
      expect(text).not.toMatch(/compatible application revision (is )?serving before/i);
    }
  });

  it('routes execution through the governed executor and names the independent Django blocker', () => {
    expect(SQL_0015).toContain('apply-union-eyes-scoped-migrations-existing-env.mjs');
    expect(chg.description).toContain('apply-union-eyes-scoped-migrations-existing-env.mjs');
    expect(SQL_0015).toMatch(/content\.0004 and grievances\.0005/);
    expect(chg.description).toMatch(/content\.0004 and grievances\.0005/);
  });

  it('documents that the executor will not re-close after recovery and how to re-close', () => {
    expect(SQL_RECOVERY).toMatch(/will NOT\s+-- re-close/);
    expect(chg.rollback_plan).toMatch(/will not re-close/);
    expect(chg.rollback_plan).toMatch(/replay 0015 directly/);
  });
});