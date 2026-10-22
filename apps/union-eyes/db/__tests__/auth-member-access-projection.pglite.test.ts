import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { compileMemberAccessProjectionSql } from '../auth/member-access-projection';

const ORG_A = '10000000-0000-4000-8000-000000000001';
const ORG_B = '20000000-0000-4000-8000-000000000002';
const OWN = '30000000-0000-4000-8000-000000000003';
const FOREIGN_ORG = '40000000-0000-4000-8000-000000000004';
const FOREIGN_USER = '50000000-0000-4000-8000-000000000005';
let db: PGlite;

beforeEach(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE union_eyes_runtime NOLOGIN;
    CREATE ROLE union_eyes_system NOLOGIN;
    CREATE ROLE nzila_auth_system_mutation NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    CREATE TABLE organization_members(id uuid PRIMARY KEY,user_id text NOT NULL,organization_id uuid NOT NULL,status text NOT NULL,updated_at timestamptz DEFAULT now(),email text);
    INSERT INTO organization_members(id,user_id,organization_id,status,email) VALUES
      ('${OWN}','target-a','${ORG_A}','inactive','private-a@example.test'),
      ('${FOREIGN_ORG}','target-a','${ORG_B}','inactive','private-b@example.test'),
      ('${FOREIGN_USER}','target-b','${ORG_A}','inactive','private-c@example.test');
    ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
    ALTER TABLE organization_members FORCE ROW LEVEL SECURITY;
  `);
});
afterEach(async () => { await db.close(); });

async function scoped<T>(callback: () => Promise<T>, overrides: Record<string, string> = {}): Promise<T> {
  await db.exec('BEGIN; SET LOCAL ROLE nzila_auth_system_mutation');
  const settings = {
    'nzila.auth_phase': 'system', 'nzila.auth_operation': 'membership-state',
    'nzila.auth_user_id': 'target-a', 'nzila.auth_org_id': ORG_A,
    'nzila.auth_actor_id': 'authenticated-admin', 'nzila.auth_reason': 'Approved membership reactivation',
    ...overrides,
  };
  try {
    for (const [key, value] of Object.entries(settings)) await db.query('SELECT set_config($1,$2,true)', [key, value]);
    return await callback();
  } finally { await db.exec('ROLLBACK'); }
}

describe('canonical auth membership projection — actual PostgreSQL policy execution', () => {
  it('exposes only the exact target user and organization', async () => {
    await db.exec(compileMemberAccessProjectionSql());
    const result = await scoped(() => db.query('SELECT id FROM organization_members ORDER BY id'));
    expect(result.rows).toEqual([{ id: OWN }]);
  });

  it('reactivates the exact row without changing another user or organization', async () => {
    await db.exec(compileMemberAccessProjectionSql());
    const result = await scoped(() => db.query("UPDATE organization_members SET status='active',updated_at=now() RETURNING id"));
    expect(result.rows).toEqual([{ id: OWN }]);
  });

  for (const id of [FOREIGN_ORG, FOREIGN_USER]) it(`cannot reactivate a foreign target ${id}`, async () => {
    await db.exec(compileMemberAccessProjectionSql());
    const result = await scoped(() => db.query("UPDATE organization_members SET status='active' WHERE id=$1 RETURNING id", [id]));
    expect(result.rows).toEqual([]);
  });

  for (const setting of ['nzila.auth_actor_id', 'nzila.auth_reason', 'nzila.auth_org_id']) it(`fails closed without ${setting}`, async () => {
    await db.exec(compileMemberAccessProjectionSql());
    const result = await scoped(() => db.query('SELECT id FROM organization_members'), { [setting]: '' });
    expect(result.rows).toEqual([]);
  });

  it('refuses a different auth operation', async () => {
    await db.exec(compileMemberAccessProjectionSql());
    const result = await scoped(() => db.query('SELECT id FROM organization_members'), { 'nzila.auth_operation': 'revoke-sessions' });
    expect(result.rows).toEqual([]);
  });

  it('cannot read private contact columns', async () => {
    await db.exec(compileMemberAccessProjectionSql());
    await expect(scoped(() => db.query('SELECT email FROM organization_members'))).rejects.toMatchObject({ code: '42501' });
  });

  it('cannot retarget membership ownership', async () => {
    await db.exec(compileMemberAccessProjectionSql());
    await expect(scoped(() => db.query("UPDATE organization_members SET user_id='target-b' WHERE id=$1", [OWN]))).rejects.toMatchObject({ code: '42501' });
  });

  it('cannot use the reactivation grant for a different status', async () => {
    await db.exec(compileMemberAccessProjectionSql());
    await expect(scoped(() => db.query("UPDATE organization_members SET status='deleted' WHERE id=$1", [OWN]))).rejects.toMatchObject({ code: '42501' });
  });

  it('refuses an unsafe existing auth executor', async () => {
    await db.exec('ALTER ROLE nzila_auth_system_mutation LOGIN');
    await expect(db.exec(compileMemberAccessProjectionSql())).rejects.toThrow(/non-login auth system role required/);
  });

  it('refuses a membership table without forced RLS', async () => {
    await db.exec('ALTER TABLE organization_members NO FORCE ROW LEVEL SECURITY');
    await expect(db.exec(compileMemberAccessProjectionSql())).rejects.toThrow(/Forced RLS/);
  });

  it('refuses unexplained pre-existing column grants', async () => {
    await db.exec('GRANT SELECT(email) ON organization_members TO nzila_auth_system_mutation');
    await expect(db.exec(compileMemberAccessProjectionSql())).rejects.toThrow(/explicit reconciliation/);
  });

  it('refuses a second application rather than silently replacing authority', async () => {
    await db.exec(compileMemberAccessProjectionSql());
    await expect(db.exec(compileMemberAccessProjectionSql())).rejects.toThrow(/explicit reconciliation/);
  });
});
