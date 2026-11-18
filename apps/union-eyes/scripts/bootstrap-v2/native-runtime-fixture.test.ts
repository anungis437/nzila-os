/** Actual SQL role/context proof in PGlite; native fixture/login execution remains separate. */
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { nativeFixtureLoginSql } from './native-runtime-fixture'
import { runOwnedRuntimeAuthorityTransaction } from './authenticated-casework-load'
import { compileSyntheticAuthFixtureSql } from './auth-fixture'
import { compileAuthBootstrapSql, AUTH_EXECUTION_ROLES, authContextSettings } from './auth-sql'
import type { SqlExecutor } from '../../lib/authority/store/executor'

const org = '11111111-1111-4111-8111-111111111111'
const foreign = '22222222-2222-4222-8222-222222222222'
const context = { organizationId: org, userId: 'owned-fixture-president' }
let db: PGlite
const executor: SqlExecutor = {
  query: async <T>(text: string, params?: unknown[]) => ({ rows: (await db.query<T>(text, params)).rows }),
}

async function asLogin<T>(login: string, operation: () => Promise<T>) {
  if (!/^ue_v2_mutation_(?:runtime|auth|auth_system)$/.test(login)) throw new Error('Owned fixture login required')
  // Unlike SET ROLE from the owner, this also exercises session_user membership restrictions.
  await db.exec(`SET SESSION AUTHORIZATION ${login}`)
  try {
    expect((await db.query('SELECT session_user AS actor')).rows).toEqual([{ actor: login }])
    return await operation()
  } finally {
    // Explicitly restore both session authorization and the role GUC in this shared SQL engine.
    await db.exec('RESET ROLE; SET SESSION AUTHORIZATION postgres; RESET ROLE')
    expect((await db.query('SELECT session_user AS session,current_user AS actor')).rows)
      .toEqual([{ session: 'postgres', actor: 'postgres' }])
  }
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(compileSyntheticAuthFixtureSql())
  await db.exec(`CREATE ROLE union_eyes_runtime NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS;
    CREATE ROLE union_eyes_system NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS;`)
  await db.exec(compileAuthBootstrapSql())
  await db.exec(nativeFixtureLoginSql('1'.repeat(48), true))
  await db.exec(`CREATE TABLE public.owned_assignment_role_probe(organization_id uuid PRIMARY KEY, label text);
    INSERT INTO public.owned_assignment_role_probe VALUES ('${org}','owned'),('${foreign}','foreign');
    ALTER TABLE public.owned_assignment_role_probe ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.owned_assignment_role_probe FORCE ROW LEVEL SECURITY;
    GRANT SELECT,UPDATE,INSERT ON public.owned_assignment_role_probe TO union_eyes_runtime;
    CREATE POLICY fixture_assignment_scope ON public.owned_assignment_role_probe TO union_eyes_runtime
      USING (organization_id::text=current_setting('app.current_org_id',true))
      WITH CHECK (organization_id::text=current_setting('app.current_org_id',true));
    INSERT INTO user_management.users(user_id,email,is_active,lifecycle_state)
      VALUES ('owned-fixture-target','owned-fixture-target@example.invalid',true,'active');
    INSERT INTO user_management.user_sessions(session_id,user_id,session_token,session_token_hash,expires_at,is_active)
      VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','owned-fixture-target','synthetic-never-a-live-bearer',repeat('a',64),now()+interval '1 hour',true);`)
}, 30000)
afterAll(async () => { await db?.close() })

describe('owned qualification fixture credential boundaries', () => {
  it('provisions four distinct non-inheriting unprivileged logins with no cross-gateway memberships', async () => {
    const rows = await db.query(`SELECT rolname,rolinherit,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolcanlogin
      FROM pg_roles WHERE rolname LIKE 'ue_v2_mutation_%' ORDER BY rolname`)
    expect(rows.rows).toHaveLength(4)
    for (const row of rows.rows) expect(row).toMatchObject({ rolinherit: false, rolsuper: false,
      rolbypassrls: false, rolcreatedb: false, rolcreaterole: false, rolcanlogin: true })
    const memberships = await db.query(`SELECT
      pg_has_role('ue_v2_mutation_auth','nzila_auth_gateway','MEMBER') AS ordinary,
      pg_has_role('ue_v2_mutation_auth','nzila_auth_system_gateway','MEMBER') AS ordinary_system,
      pg_has_role('ue_v2_mutation_auth_system','nzila_auth_system_gateway','MEMBER') AS system,
      pg_has_role('ue_v2_mutation_auth_system','nzila_auth_gateway','MEMBER') AS system_ordinary,
      pg_has_role('ue_v2_mutation_runtime','union_eyes_runtime','USAGE') AS inherited_runtime`)
    expect(memberships.rows).toEqual([{ ordinary: true, ordinary_system: false, system: true,
      system_ordinary: false, inherited_runtime: false }])
  })

  it('enters the runtime role inside the authority transaction before its first scoped operation, without changing inheritance', async () => {
    await asLogin('ue_v2_mutation_runtime', async () => {
      await expect(db.query('SELECT * FROM public.owned_assignment_role_probe')).rejects.toMatchObject({ code: '42501' })
      const rows = await runOwnedRuntimeAuthorityTransaction(executor, context, async (tx) =>
        (await tx.query('SELECT current_user AS actor,organization_id,label FROM public.owned_assignment_role_probe')).rows)
      expect(rows).toEqual([{ actor: 'union_eyes_runtime', organization_id: org, label: 'owned' }])
      expect((await db.query('SELECT current_user AS actor')).rows).toEqual([{ actor: 'ue_v2_mutation_runtime' }])
      await expect(db.query('SELECT * FROM public.owned_assignment_role_probe')).rejects.toMatchObject({ code: '42501' })
    })
  })

  it('keeps the runtime helper tenant-scoped and rolls failed work and its role back', async () => {
    await asLogin('ue_v2_mutation_runtime', async () => {
      expect(await runOwnedRuntimeAuthorityTransaction(executor, context, async (tx) =>
        (await tx.query('UPDATE public.owned_assignment_role_probe SET label=$1 WHERE organization_id=$2 RETURNING label', ['forged', foreign])).rows)).toEqual([])
      await expect(runOwnedRuntimeAuthorityTransaction(executor, context, async (tx) => {
        await tx.query('UPDATE public.owned_assignment_role_probe SET label=$1 WHERE organization_id=$2', ['rollback', org])
        throw new Error('Owned operation fault')
      })).rejects.toThrow('Owned operation fault')
      expect((await db.query('SELECT current_user AS actor')).rows).toEqual([{ actor: 'ue_v2_mutation_runtime' }])
    })
    expect((await db.query('SELECT label FROM public.owned_assignment_role_probe ORDER BY label')).rows).toEqual([{ label: 'foreign' }, { label: 'owned' }])
  })

  it('cannot use ordinary authentication credentials to enter auth-system execution or read raw auth data', async () => {
    await asLogin('ue_v2_mutation_auth', async () => {
      await expect(db.exec(`SET ROLE ${AUTH_EXECUTION_ROLES.system}`)).rejects.toMatchObject({ code: '42501' })
      await expect(db.query('SELECT session_token FROM user_management.user_sessions')).rejects.toMatchObject({ code: '42501' })
      await db.exec('BEGIN')
      try {
        await db.exec(`SET LOCAL ROLE ${AUTH_EXECUTION_ROLES.identity}`)
        expect((await db.query('SELECT current_user AS actor')).rows).toEqual([{ actor: AUTH_EXECUTION_ROLES.identity }])
      } finally { await db.exec('ROLLBACK') }
    })
  })

  it('uses distinct auth-system credentials for a purpose-bound revocation and denies ordinary identity/raw-bearer access', async () => {
    await asLogin('ue_v2_mutation_auth_system', async () => {
      await expect(db.exec(`SET ROLE ${AUTH_EXECUTION_ROLES.identity}`)).rejects.toMatchObject({ code: '42501' })
      await db.exec('BEGIN')
      try {
        await db.exec(`SET LOCAL ROLE ${AUTH_EXECUTION_ROLES.system}`)
        for (const [key, value] of Object.entries(authContextSettings({ phase: 'system', actorUserId: 'owned-fixture-president',
          targetUserId: 'owned-fixture-target', operation: 'revoke-sessions', reason: 'Owned qualification fixture' })))
          await db.query('SELECT set_config($1,$2,true)', [key, value])
        const changed = await db.query('UPDATE user_management.user_sessions SET is_active=false RETURNING user_id,is_active')
        expect(changed.rows).toEqual([{ user_id: 'owned-fixture-target', is_active: false }])
        await db.exec('COMMIT')
      } catch (error) { await db.exec('ROLLBACK'); throw error }
      await expect(db.query('SELECT session_token FROM user_management.user_sessions')).rejects.toMatchObject({ code: '42501' })
    })
    expect((await db.query('SELECT is_active FROM user_management.user_sessions')).rows).toEqual([{ is_active: false }])
  })

  it('does not give the business runtime either auth gateway or an auth-system execution role', async () => {
    await asLogin('ue_v2_mutation_runtime', async () => {
      for (const role of [AUTH_EXECUTION_ROLES.gateway, AUTH_EXECUTION_ROLES.systemGateway, AUTH_EXECUTION_ROLES.system])
        await expect(db.exec(`SET ROLE ${role}`)).rejects.toMatchObject({ code: '42501' })
    })
  })
})
