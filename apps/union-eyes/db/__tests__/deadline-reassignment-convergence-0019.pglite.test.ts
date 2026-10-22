/**
 * Scoped 0019 closes deadline_reassignment_convergence.
 *
 * Root 0049 creates the table with a PUBLIC policy that treats an empty
 * app.current_org_id as "every organization". The assign route inserts as
 * union_eyes_runtime and needs SELECT plus INSERT for RETURNING. The cron
 * sweep updates as union_eyes_system and needs SELECT plus UPDATE. This test
 * uses a disposable PGlite database. It is not a staging isolation pass.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { evaluateDeadlineEngineRlsClosure } from '../../scripts/rls-verify';

const APP_ROOT = resolve(__dirname, '..', '..');
const REPO_ROOT = resolve(APP_ROOT, '..', '..');
const SQL_0019 = readFileSync(resolve(APP_ROOT, 'db/migrations-cache/0019_deadline_reassignment_convergence.sql'), 'utf8');
const SQL_0017 = readFileSync(resolve(APP_ROOT, 'db/migrations-cache/0017_snapshot_authority_reconciliation.sql'));
const SQL_0049 = readFileSync(resolve(REPO_ROOT, 'migrations/0049_union_eyes_deadline_convergence_tasks.sql'), 'utf8');
const HELPER = readFileSync(resolve(APP_ROOT, 'db/migrations-cache/0010_tenant_isolation_rls_foundation.sql'), 'utf8')
  .match(/CREATE OR REPLACE FUNCTION ue_create_direct_org_rls_policy\([\s\S]*?\$\$ LANGUAGE plpgsql;/)?.[0];

const ORG_A = '00000000-0000-0000-0000-00000000000a';
const ORG_B = '00000000-0000-0000-0000-00000000000b';
const APPLIERS = [
  'apps/union-eyes/db/migrations-cache/meta/_journal.json',
  'tooling/scripts/lib/union-eyes-bootstrap-stages.mjs',
  'tooling/scripts/lib/union-eyes-catalog-authority.mjs',
  'tooling/scripts/run-union-eyes-schema-lineage-cleanroom.mjs',
  'tooling/scripts/run-union-eyes-drizzle-bootstrap.mjs',
  'tooling/scripts/lib/union-eyes-platform-migrations.mjs',
  'reports/union-eyes/runtime-schema-lineage/SCHEMA_LINEAGE_MANIFEST.json',
  '.github/workflows/deploy-union-eyes.yml',
];

if (!HELPER) throw new Error('ue_create_direct_org_rls_policy not found');

async function baseDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE union_eyes_runtime NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS INHERIT NOLOGIN;
    CREATE ROLE union_eyes_system  NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS INHERIT NOLOGIN;
    CREATE ROLE union_eyes_nobody  NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS INHERIT NOLOGIN;
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

async function asRole(db: PGlite, role: 'union_eyes_runtime' | 'union_eyes_system' | 'union_eyes_nobody', org: string | null) {
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

async function grantsFor(db: PGlite, grantee: string): Promise<string[]> {
  const rows = await db.query<{ privilege_type: string }>(
    `SELECT privilege_type FROM information_schema.role_table_grants
     WHERE table_schema = 'public'
       AND table_name = 'deadline_reassignment_convergence'
       AND grantee = $1
     ORDER BY privilege_type`,
    [grantee],
  );
  return rows.rows.map((row) => row.privilege_type);
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
      `SELECT policyname FROM pg_policies WHERE tablename = 'deadline_reassignment_convergence' ORDER BY policyname`,
    );
    expect(policies.rows.map((row) => row.policyname)).toEqual([
      'ue_org_isolation_delete',
      'ue_org_isolation_insert',
      'ue_org_isolation_select',
      'ue_org_isolation_update',
      'ue_system_full_access',
    ]);
    expect(await grantsFor(db, 'union_eyes_runtime')).toEqual(['INSERT', 'SELECT']);
    expect(await grantsFor(db, 'union_eyes_system')).toEqual(['SELECT', 'UPDATE']);

    await asRole(db, 'union_eyes_runtime', null);
    expect(await countVisible(db)).toBe(0);

    await asRole(db, 'union_eyes_runtime', ORG_A);
    expect(await countVisible(db)).toBe(1);
    const seen = await db.query<{ organization_id: string }>('SELECT organization_id::text AS organization_id FROM deadline_reassignment_convergence');
    expect(seen.rows.map((row) => row.organization_id)).toEqual([ORG_A]);

    const returned = await db.query<{ id: string }>(
      `INSERT INTO deadline_reassignment_convergence (organization_id, grievance_id, new_assignee_id, correlation_id)
       VALUES ($1, '10000000-0000-0000-0000-000000000003', 'steward', 'returning')
       RETURNING id::text AS id`,
      [ORG_A],
    );
    expect(returned.rows[0].id).toMatch(/^[0-9a-f-]{36}$/);

    await db.exec('BEGIN');
    await expect(
      db.query(
        `INSERT INTO deadline_reassignment_convergence (organization_id, grievance_id, new_assignee_id, correlation_id)
         VALUES ($1, '10000000-0000-0000-0000-000000000004', 'other', 'forged')`,
        [ORG_B],
      ),
    ).rejects.toThrow(/row-level security/);
    await db.exec('ROLLBACK');

    await expect(
      db.query(`UPDATE deadline_reassignment_convergence SET attempt_count = 9 WHERE organization_id = $1`, [ORG_A]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.query(`UPDATE deadline_reassignment_convergence SET attempt_count = 9 WHERE organization_id = $1`, [ORG_B]),
    ).rejects.toThrow(/permission denied/);

    await asRole(db, 'union_eyes_system', null);
    expect(await countVisible(db)).toBe(3);
    const systemUpdate = await db.query(
      `UPDATE deadline_reassignment_convergence SET attempt_count = attempt_count + 1 WHERE organization_id = $1`,
      [ORG_B],
    );
    expect(systemUpdate.affectedRows).toBe(1);
    await expect(
      db.query(
        `INSERT INTO deadline_reassignment_convergence (organization_id, grievance_id, new_assignee_id, correlation_id)
         VALUES ($1, '10000000-0000-0000-0000-000000000005', 'system', 'system-insert')`,
        [ORG_A],
      ),
    ).rejects.toThrow(/permission denied/);

    await asRole(db, 'union_eyes_nobody', ORG_A);
    await expect(countVisible(db)).rejects.toThrow(/permission denied/);

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

    await expect(db.exec(SQL_0049)).rejects.toThrow(/canonical closure/);
    const afterReplay = await db.query<{ policyname: string }>(
      `SELECT policyname FROM pg_policies WHERE tablename = 'deadline_reassignment_convergence'`,
    );
    expect(afterReplay.rows.map((row) => row.policyname)).not.toContain('deadline_reassignment_convergence_tenant_isolation');
    await expect(
      db.exec(`CREATE POLICY deadline_reassignment_convergence_extra ON deadline_reassignment_convergence USING (true)`),
    ).rejects.toThrow(/canonical closure/);
    await db.exec(`CREATE TABLE ue_unrelated_rls_probe (id int); ALTER TABLE ue_unrelated_rls_probe ENABLE ROW LEVEL SECURITY; CREATE POLICY ue_unrelated_rls_probe_read ON ue_unrelated_rls_probe USING (true);`);
  });

  it('refuses a drifted table before installing policies', async () => {
    const cases: Array<{ name: string; sql: string; legacy?: boolean }> = [
      { name: 'wrong column type', sql: `CREATE TABLE deadline_reassignment_convergence (organization_id text)` },
      {
        name: 'missing primary key',
        legacy: true,
        sql: `ALTER TABLE deadline_reassignment_convergence DROP CONSTRAINT deadline_reassignment_convergence_pkey`,
      },
      {
        name: 'missing terminal check',
        legacy: true,
        sql: `ALTER TABLE deadline_reassignment_convergence DROP CONSTRAINT deadline_reassignment_convergence_terminal`,
      },
      {
        name: 'optional column made mandatory',
        legacy: true,
        sql: `ALTER TABLE deadline_reassignment_convergence ALTER COLUMN previous_assignee_id SET NOT NULL`,
      },
      {
        name: 'extra column',
        legacy: true,
        sql: `ALTER TABLE deadline_reassignment_convergence ADD COLUMN leaked text`,
      },
      {
        name: 'status default removed',
        legacy: true,
        sql: `ALTER TABLE deadline_reassignment_convergence ALTER COLUMN status DROP DEFAULT`,
      },
      {
        name: 'shorter identifier',
        legacy: true,
        sql: `ALTER TABLE deadline_reassignment_convergence ALTER COLUMN new_assignee_id TYPE varchar(32)`,
      },
      {
        name: 'pending index replaced',
        legacy: true,
        sql: `DROP INDEX deadline_reassignment_convergence_pending_idx;
              CREATE INDEX deadline_reassignment_convergence_pending_idx ON deadline_reassignment_convergence (organization_id)`,
      },
    ];

    for (const drift of cases) {
      const db = await baseDb();
      if (drift.legacy) await db.exec(SQL_0049);
      await db.exec(drift.sql);
      await expect(db.exec(SQL_0019), drift.name).rejects.toThrow(/drifted table/);
      const policies = await db.query<{ policyname: string }>(
        `SELECT policyname FROM pg_policies WHERE tablename = 'deadline_reassignment_convergence'`,
      );
      expect(policies.rows.map((row) => row.policyname), drift.name).not.toContain('ue_org_isolation_select');
      if (drift.legacy) {
        expect(policies.rows.map((row) => row.policyname), drift.name).toContain('deadline_reassignment_convergence_tenant_isolation');
      }
    }
  });

  it('rolls back a partial apply and then closes a fresh table', async () => {
    const db = await baseDb();
    const statements = SQL_0019.split('--> statement-breakpoint').map((statement) => statement.trim()).filter(Boolean);
    await db.exec('BEGIN');
    await db.exec(statements[2]);
    await db.exec('ROLLBACK');
    const absent = await db.query<{ name: string | null }>(`SELECT to_regclass('public.deadline_reassignment_convergence')::text AS name`);
    expect(absent.rows[0].name).toBeNull();
    await db.exec(SQL_0019);
    const countRelations = async () => {
      const relations = await db.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = 'deadline_reassignment_convergence' AND c.relkind = 'r'`,
      );
      return relations.rows[0].n;
    };
    expect(await countRelations()).toBe('1');
    await db.exec(SQL_0019);
    expect(await countRelations()).toBe('1');
  });

  it('preserves the applied 0017 bytes and keeps 0049 out of supported appliers', () => {
    expect(SQL_0017.length).toBe(24003);
    expect(createHash('sha256').update(SQL_0017).digest('hex')).toBe(
      '1b383028f528daa86b079662688d072e9c60ac9e96ce607810449b9148c27f48',
    );
    for (const relativePath of APPLIERS) {
      const text = readFileSync(resolve(REPO_ROOT, relativePath), 'utf8');
      expect(text, relativePath).not.toContain('0049_union_eyes_deadline_convergence_tasks');
    }
    const manifest = JSON.parse(readFileSync(resolve(REPO_ROOT, 'migrations/migration-manifest.json'), 'utf8')) as {
      lockedThrough: string;
    };
    expect(manifest.lockedThrough).toBe('0049_union_eyes_deadline_convergence_tasks.sql');
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
