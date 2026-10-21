/**
 * Scoped 0019 closes deadline_reassignment_convergence.
 *
 * Root 0049 creates the table with a PUBLIC policy that treats an empty
 * app.current_org_id as "every organization". The assign route inserts as
 * union_eyes_runtime. The cron sweep updates as union_eyes_system. This test
 * uses a disposable PGlite database. It is not a staging isolation pass.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { evaluateDeadlineEngineRlsClosure } from '../../scripts/rls-verify';

const APP_ROOT = resolve(__dirname, '..', '..');
const REPO_ROOT = resolve(APP_ROOT, '..', '..');
const SQL_0019 = readFileSync(resolve(APP_ROOT, 'db/migrations-cache/0019_deadline_reassignment_convergence.sql'), 'utf8');
const SQL_0049 = readFileSync(resolve(REPO_ROOT, 'migrations/0049_union_eyes_deadline_convergence_tasks.sql'), 'utf8');
const HELPER = readFileSync(resolve(APP_ROOT, 'db/migrations-cache/0010_tenant_isolation_rls_foundation.sql'), 'utf8')
  .match(/CREATE OR REPLACE FUNCTION ue_create_direct_org_rls_policy\([\s\S]*?\$\$ LANGUAGE plpgsql;/)?.[0];

const ORG_A = '00000000-0000-0000-0000-00000000000a';
const ORG_B = '00000000-0000-0000-0000-00000000000b';

if (!HELPER) throw new Error('ue_create_direct_org_rls_policy not found');

async function baseDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE union_eyes_runtime NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS INHERIT NOLOGIN;
    CREATE ROLE union_eyes_system  NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS INHERIT NOLOGIN;
    CREATE OR REPLACE FUNCTION ue_set_updated_at() RETURNS trigger AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);
  await db.exec(HELPER);
  return db;
}

async function asRole(db: PGlite, role: 'union_eyes_runtime' | 'union_eyes_system', org: string | null) {
  await db.exec('RESET ROLE');
  await db.exec(`SET ROLE ${role}`);
  await db.query(`SELECT set_config('app.current_org_id', $1, false)`, [org ?? '']);
}

const countVisible = async (db: PGlite) =>
  Number((await db.query<{ n: string }>('SELECT count(*)::text AS n FROM deadline_reassignment_convergence')).rows[0].n);

async function insertTask(db: PGlite, org: string, grievance: string) {
  await db.query(
    `INSERT INTO deadline_reassignment_convergence
       (organization_id, grievance_id, new_assignee_id, correlation_id)
     VALUES ($1, $2, 'steward', $3)`,
    [org, grievance, `c-${org}`],
  );
}

describe('scoped 0019 deadline_reassignment_convergence', () => {
  it('removes the 0049 fail-open policy and isolates tenants', async () => {
    const db = await baseDb();
    await db.exec(SQL_0049);
    await db.exec(`GRANT SELECT, INSERT, UPDATE ON deadline_reassignment_convergence TO union_eyes_runtime`);
    await db.exec('RESET ROLE');
    await insertTask(db, ORG_A, '10000000-0000-0000-0000-000000000001');
    await insertTask(db, ORG_B, '10000000-0000-0000-0000-000000000002');

    await asRole(db, 'union_eyes_runtime', null);
    expect(await countVisible(db)).toBe(2);

    await db.exec('RESET ROLE');
    await db.exec(SQL_0019);

    const policies = await db.query<{ policyname: string }>(
      `SELECT policyname FROM pg_policies WHERE tablename = 'deadline_reassignment_convergence'`,
    );
    expect(policies.rows.map((row) => row.policyname)).not.toContain('deadline_reassignment_convergence_tenant_isolation');

    await asRole(db, 'union_eyes_runtime', null);
    expect(await countVisible(db)).toBe(0);

    await asRole(db, 'union_eyes_runtime', ORG_A);
    expect(await countVisible(db)).toBe(1);
    const seen = await db.query<{ organization_id: string }>('SELECT organization_id::text AS organization_id FROM deadline_reassignment_convergence');
    expect(seen.rows.map((row) => row.organization_id)).toEqual([ORG_A]);

    await db.exec('BEGIN');
    await expect(
      db.query(
        `INSERT INTO deadline_reassignment_convergence (organization_id, grievance_id, new_assignee_id, correlation_id)
         VALUES ($1, '10000000-0000-0000-0000-000000000003', 'other', 'forged')`,
        [ORG_B],
      ),
    ).rejects.toThrow(/row-level security/);
    await db.exec('ROLLBACK');

    const crossUpdate = await db.query(
      `UPDATE deadline_reassignment_convergence SET attempt_count = 9 WHERE organization_id = $1`,
      [ORG_B],
    );
    expect(crossUpdate.affectedRows).toBe(0);

    await asRole(db, 'union_eyes_system', null);
    expect(await countVisible(db)).toBe(2);

    await db.exec('RESET ROLE');
    await db.exec(SQL_0019);
    await asRole(db, 'union_eyes_runtime', ORG_B);
    expect(await countVisible(db)).toBe(1);

    await db.exec('RESET ROLE');
    const tables = (await db.query(
      `SELECT c.relname AS relname, c.relrowsecurity AS relrowsecurity, c.relforcerowsecurity AS relforcerowsecurity
       FROM pg_class c
       WHERE c.relname = 'deadline_reassignment_convergence'`,
    )).rows;
    const policyRows = (await db.query(
      `SELECT tablename, policyname, permissive, roles::text[] AS roles, cmd, qual, with_check
       FROM pg_policies WHERE tablename = 'deadline_reassignment_convergence'`,
    )).rows;
    const failed = evaluateDeadlineEngineRlsClosure(
      { tables: tables as never[], policies: policyRows as never[] },
      { requireDeadlineEngineTables: true },
    ).filter((result) => !result.pass && result.name.includes('deadline_reassignment_convergence'));
    expect(failed, JSON.stringify(failed)).toEqual([]);
  });

  it('refuses a drifted table before installing policies', async () => {
    const db = await baseDb();
    await db.exec(`CREATE TABLE deadline_reassignment_convergence (organization_id text)`);
    await expect(db.exec(SQL_0019)).rejects.toThrow(/drifted table/);
    const policies = await db.query(`SELECT policyname FROM pg_policies WHERE tablename = 'deadline_reassignment_convergence'`);
    expect(policies.rows).toEqual([]);
  });

  it('is registered once at journal idx 19', () => {
    const journal = JSON.parse(readFileSync(resolve(APP_ROOT, 'db/migrations-cache/meta/_journal.json'), 'utf8')) as {
      entries: Array<{ idx: number; tag: string }>;
    };
    expect(journal.entries.filter((entry) => entry.tag === '0019_deadline_reassignment_convergence')).toEqual([
      expect.objectContaining({ idx: 19, tag: '0019_deadline_reassignment_convergence' }),
    ]);
  });
});
