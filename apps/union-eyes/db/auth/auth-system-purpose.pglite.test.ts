/** Actual source-compiled auth RLS under the system executor. PGlite SQL-engine proof, not a native/login/deployment verdict. */
import { PGlite } from '@electric-sql/pglite'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { compileSyntheticAuthFixtureSql } from '../../scripts/bootstrap-v2/auth-fixture'
import { compileAuthBootstrapSql } from '../../../../packages/db/src/auth-storage-authority/bootstrap-sql'
import {
  AUTH_EXECUTION_ROLES, authContextSettings, type AuthExecutionContext,
} from '../../../../packages/db/src/auth-storage-authority/execution-boundary'

const ORG = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG = '22222222-2222-4222-8222-222222222222'
const ACTIVE_SESSION = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
const INACTIVE_SESSION = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
const FOREIGN_SESSION = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'
const TARGET = 'auth-purpose-target'
const FOREIGN = 'auth-purpose-foreign'
const ACTOR = 'auth-purpose-operator'
let db: PGlite

type SystemContext = Extract<AuthExecutionContext, { phase: 'system' }>
const context = (operation: SystemContext['operation'] = 'revoke-sessions'): SystemContext => ({
  phase: 'system', actorUserId: ACTOR, targetUserId: TARGET, operation,
  ...(operation === 'membership-state' ? { organizationId: ORG } : {}),
  reason: 'Owned synthetic purpose-boundary regression',
})

async function system(statement: string, values: unknown[] = [], purpose = context()) {
  await db.exec('BEGIN')
  try {
    await db.exec(`SET LOCAL ROLE "${AUTH_EXECUTION_ROLES.system}"`)
    for (const [key, value] of Object.entries(authContextSettings(purpose)))
      await db.query('SELECT set_config($1,$2,true)', [key, value])
    const principal = await db.query<{ role: string; superuser: boolean; bypass: boolean }>(
      'SELECT current_user AS role,rolsuper AS superuser,rolbypassrls AS bypass FROM pg_roles WHERE rolname=current_user',
    )
    expect(principal.rows).toEqual([{ role: AUTH_EXECUTION_ROLES.system, superuser: false, bypass: false }])
    const result = await db.query<Record<string, unknown>>(statement, values)
    await db.exec('COMMIT')
    return result.rows
  } catch (error) {
    await db.exec('ROLLBACK')
    throw error
  }
}

beforeAll(async () => {
  db = new PGlite()
  const bootstrap = compileAuthBootstrapSql()
  process.stdout.write(JSON.stringify({
    proof: 'AUTH_SYSTEM_PURPOSE_BOUNDARY', engine: 'PGlite', nativeVerdict: 'UNEXECUTED',
    compilerSourceSha256: createHash('sha256').update(readFileSync(new URL(
      '../../../../packages/db/src/auth-storage-authority/bootstrap-sql.ts', import.meta.url,
    ))).digest('hex'),
    compiledSqlSha256: createHash('sha256').update(bootstrap).digest('hex'),
  }) + '\n')
  await db.exec(compileSyntheticAuthFixtureSql())
  await db.exec(`CREATE ROLE union_eyes_runtime NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS;
    CREATE ROLE union_eyes_system NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS;`)
  await db.exec(bootstrap)
  await db.query(`INSERT INTO user_management.users(user_id,email,is_active,lifecycle_state)
    VALUES ($1,'purpose-target@example.invalid',true,'active'),
      ($2,'purpose-foreign@example.invalid',true,'active'),
      ($3,'purpose-operator@example.invalid',true,'active')`, [TARGET, FOREIGN, ACTOR])
  await db.query(`INSERT INTO user_management.organization_users(user_id,organization_id,role,is_active)
    VALUES ($1,$3,'member',true),($1,$4,'member',true),($2,$3,'member',true),($5,$3,'admin',true)`,
    [TARGET, FOREIGN, ORG, OTHER_ORG, ACTOR])
  await db.query(`INSERT INTO user_management.user_sessions(session_id,user_id,session_token,session_token_hash,expires_at,is_active)
    VALUES ($1,$4,'synthetic-target-active',repeat('a',64),now()+interval '1 hour',true),
      ($2,$4,'synthetic-target-inactive',repeat('b',64),now()+interval '1 hour',false),
      ($3,$5,'synthetic-foreign-active',repeat('c',64),now()+interval '1 hour',true)`,
    [ACTIVE_SESSION, INACTIVE_SESSION, FOREIGN_SESSION, TARGET, FOREIGN])
}, 30000)

beforeEach(async () => {
  await db.query('UPDATE user_management.user_sessions SET is_active=(session_id<>$1::uuid)', [INACTIVE_SESSION])
  await db.exec('UPDATE user_management.organization_users SET is_active=true')
})
afterAll(async () => { await db?.close() })

describe('system auth mutation purpose at the physical write boundary', () => {
  it('allows the declared revoke-sessions purpose to revoke an active target session', async () => {
    expect(await system('UPDATE user_management.user_sessions SET is_active=false WHERE session_id=$1 RETURNING session_id,is_active',
      [ACTIVE_SESSION])).toEqual([{ session_id: ACTIVE_SESSION, is_active: false }])
    expect((await db.query('SELECT is_active FROM user_management.user_sessions WHERE session_id=$1', [ACTIVE_SESSION])).rows)
      .toEqual([{ is_active: false }])
  })

  it.each([true, null])('refuses inactive target session revival or indeterminate state %s and leaves the row unchanged', async (value) => {
    let failureCode: string | null = null
    try {
      await system('UPDATE user_management.user_sessions SET is_active=$1 WHERE session_id=$2 RETURNING session_id,is_active',
        [value, INACTIVE_SESSION])
    } catch (error) { failureCode = (error as { code?: string }).code ?? 'UNKNOWN' }
    const persisted = (await db.query('SELECT is_active FROM user_management.user_sessions WHERE session_id=$1', [INACTIVE_SESSION])).rows
    expect({ failureCode, persisted }).toEqual({ failureCode: '42501', persisted: [{ is_active: false }] })
  })

  it('denies a foreign-user session without changing it', async () => {
    expect(await system('UPDATE user_management.user_sessions SET is_active=false WHERE session_id=$1 RETURNING session_id',
      [FOREIGN_SESSION])).toEqual([])
    expect((await db.query('SELECT is_active FROM user_management.user_sessions WHERE session_id=$1', [FOREIGN_SESSION])).rows)
      .toEqual([{ is_active: true }])
  })

  it('preserves legitimate membership-state deactivation and reactivation for the selected target organization', async () => {
    for (const active of [false, true]) {
      expect(await system(`UPDATE user_management.organization_users SET is_active=$1,updated_at=clock_timestamp()
        WHERE user_id=$2 AND organization_id=$3 RETURNING is_active`, [active, TARGET, ORG], context('membership-state')))
        .toEqual([{ is_active: active }])
      expect((await db.query('SELECT is_active FROM user_management.organization_users WHERE user_id=$1 AND organization_id=$2',
        [TARGET, ORG])).rows).toEqual([{ is_active: active }])
    }
  })

  it('cannot use membership-state to write sessions or revoke-sessions to change membership state', async () => {
    expect(await system('UPDATE user_management.user_sessions SET is_active=false WHERE session_id=$1 RETURNING session_id',
      [ACTIVE_SESSION], context('membership-state'))).toEqual([])
    expect(await system('UPDATE user_management.organization_users SET is_active=false WHERE user_id=$1 AND organization_id=$2 RETURNING organization_user_id',
      [TARGET, ORG])).toEqual([])
    expect((await db.query('SELECT is_active FROM user_management.user_sessions WHERE session_id=$1', [ACTIVE_SESSION])).rows)
      .toEqual([{ is_active: true }])
    expect((await db.query('SELECT is_active FROM user_management.organization_users WHERE user_id=$1 AND organization_id=$2', [TARGET, ORG])).rows)
      .toEqual([{ is_active: true }])
  })

  it('does not let membership-state cross the target user or selected organization', async () => {
    expect(await system('UPDATE user_management.organization_users SET is_active=false WHERE user_id=$1 AND organization_id=$2 RETURNING organization_user_id',
      [TARGET, OTHER_ORG], context('membership-state'))).toEqual([])
    expect(await system('UPDATE user_management.organization_users SET is_active=false WHERE user_id=$1 AND organization_id=$2 RETURNING organization_user_id',
      [FOREIGN, ORG], context('membership-state'))).toEqual([])
    expect((await db.query(`SELECT is_active FROM user_management.organization_users
      WHERE (user_id=$1 AND organization_id=$3) OR (user_id=$2 AND organization_id=$4)`,
      [TARGET, FOREIGN, OTHER_ORG, ORG])).rows).toEqual([{ is_active: true }, { is_active: true }])
  })

  it('does not grant the system executor raw bearer reads or membership-role mutation', async () => {
    await expect(system('SELECT session_token FROM user_management.user_sessions WHERE session_id=$1', [ACTIVE_SESSION]))
      .rejects.toMatchObject({ code: '42501' })
    await expect(system("UPDATE user_management.organization_users SET role='admin' WHERE user_id=$1 AND organization_id=$2",
      [TARGET, ORG], context('membership-state'))).rejects.toMatchObject({ code: '42501' })
  })
})
