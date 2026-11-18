/** Source-compiled SQL-engine ACL proof. Not a native, deployed or HTTP/API disclosure verdict. */
import { PGlite } from '@electric-sql/pglite'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { compileSyntheticAuthFixtureSql } from '../../scripts/bootstrap-v2/auth-fixture'
import { inspectAuthPrivilegeExpectations } from '../../scripts/bootstrap-v2/auth-privileges'
import { CANONICAL_AUTH_QUERIES } from '../../lib/operations/canonical-catalog-admission'
import { admissionQueries } from '../../lib/operations/catalog-admission-core.mjs'
import { CURRENT_SECURITY_QUERIES } from '../../../../tooling/scripts/lib/union-eyes-current-security-installer'
import { compileAuthBootstrapSql } from '../../../../packages/db/src/auth-storage-authority/bootstrap-sql'
import { authStorageAuthorityEntries } from '../../../../packages/db/src/auth-storage-authority/entries'
import { AUTH_EXECUTION_ROLES as roles, authContextSettings, authExecutionRole, type AuthExecutionContext } from '../../../../packages/db/src/auth-storage-authority/execution-boundary'
import { compileCanonicalMembershipGrant } from '../../../../packages/db/src/auth-storage-authority/membership-semantics'
import { AUTH_PRIVILEGE_EXPECTATIONS } from '../../../../packages/db/src/auth-storage-authority/privilege-expectations'
import { authColumnPrivilegeAllowed, authSystemColumnPrivilegeAllowed, authTablePrivilegeAllowed } from '../../../../packages/db/src/auth-storage-authority/source-columns'

const retained = ['phone_verified_at', 'two_factor_secret', 'two_factor_backup_codes', 'encrypted_sin', 'encrypted_ssn', 'encrypted_bank_account']
const target = 'source-columns-target'
const foreign = 'source-columns-foreign'
const email = 'source-columns-target@example.invalid'
const identity: AuthExecutionContext = { phase: 'identity', userId: target }
const lookup: AuthExecutionContext = { phase: 'lookup', selector: { kind: 'email', email } }
let db: PGlite

async function scoped<T>(context: AuthExecutionContext, action: () => Promise<T>) {
  await db.exec(`SET SESSION AUTHORIZATION auth_source_columns_login; BEGIN; SET LOCAL ROLE "${authExecutionRole(context)}"`)
  try {
    for (const [key, value] of Object.entries(authContextSettings(context)))
      await db.query('SELECT set_config($1,$2,true)', [key, value])
    expect((await db.query(`SELECT current_user AS role,session_user AS login,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user`)).rows)
      .toEqual([{ role: authExecutionRole(context), login: 'auth_source_columns_login', rolsuper: false, rolbypassrls: false }])
    const result = await action()
    await db.exec('COMMIT')
    return result
  } catch (error) {
    await db.exec('ROLLBACK')
    throw error
  } finally { await db.exec('RESET ROLE; SET SESSION AUTHORIZATION postgres; RESET ROLE') }
}

const query = (context: AuthExecutionContext, sql: string, parameters: unknown[] = []) =>
  scoped(context, () => db.query(sql, parameters))

beforeAll(async () => {
  db = new PGlite()
  await db.exec(compileSyntheticAuthFixtureSql())
  // Synthetic retained fields exist BEFORE compilation; all other auth tables
  // also get an unknown field to prevent a users-only allowlist repair.
  for (const entry of authStorageAuthorityEntries) {
    const table = entry.table.split('.')[1]!
    await db.exec(`ALTER TABLE user_management."${table}" ADD COLUMN future_physical_column text`)
  }
  for (const column of retained)
    await db.exec(`ALTER TABLE user_management.users ADD COLUMN "${column}" text DEFAULT 'synthetic-retained-marker'`)
  await db.exec(`CREATE ROLE union_eyes_runtime NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS;
    CREATE ROLE union_eyes_system NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS;
    CREATE ROLE nzila_auth_identity NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS;
    GRANT SELECT (encrypted_sin, xmin), UPDATE (encrypted_sin) ON user_management.users TO nzila_auth_identity;`)
  await db.exec(compileAuthBootstrapSql())
  await db.exec(`CREATE ROLE auth_source_columns_login LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    ${compileCanonicalMembershipGrant('auth_source_columns_login', [roles.gateway], { inherit: false, set: true, memberRoleInherit: false }, 16)}`)
  await db.query(`INSERT INTO user_management.users(user_id,email,password_hash,is_active,lifecycle_state)
    VALUES($1,$3,'synthetic-unusable-password',true,'active'),($2,'source-columns-foreign@example.invalid','synthetic-unusable-password',true,'active')`, [target, foreign, email])
}, 30000)
afterAll(async () => { await db?.close() })

describe('current-source auth columns at the physical SQL boundary', () => {
  for (const context of [identity, lookup]) {
    it(`${context.phase} preserves canonical identity/password reads and foreign-row denial`, async () => {
      const own = await query(context, 'SELECT user_id,password_hash IS NOT NULL AS has_password FROM user_management.users WHERE user_id=$1', [target])
      expect(own.rows).toEqual([{ user_id: target, has_password: true }])
      expect((await query(context, 'SELECT user_id FROM user_management.users WHERE user_id=$1', [foreign])).rows).toEqual([])
    })
    it.each(retained)(`${context.phase} denies retained field %s without changing it`, async column => {
      const before = (await db.query(`SELECT "${column}" IS NOT NULL AS populated FROM user_management.users WHERE user_id=$1`, [target])).rows
      await expect(query(context, `SELECT "${column}" IS NOT NULL FROM user_management.users WHERE user_id=$1`, [target]))
        .rejects.toMatchObject({ code: '42501' })
      expect((await db.query(`SELECT "${column}" IS NOT NULL AS populated FROM user_management.users WHERE user_id=$1`, [target])).rows).toEqual(before)
    })
  }

  it('limits the explicit transaction-marker read to issuance users.xmin', async () => {
    for (const context of [identity, lookup])
      await expect(query(context, 'SELECT xmin IS NOT NULL FROM user_management.users WHERE user_id=$1', [target]))
        .rejects.toMatchObject({ code: '42501' })
    const issuance: AuthExecutionContext = { phase: 'issuance', operation: 'signup', email }
    expect((await query(issuance, 'SELECT xmin IS NOT NULL AS has_marker FROM user_management.users WHERE user_id=$1', [target])).rows)
      .toEqual([{ has_marker: true }])
    await expect(query(issuance, 'SELECT xmax IS NOT NULL FROM user_management.users WHERE user_id=$1', [target]))
      .rejects.toMatchObject({ code: '42501' })
    await expect(query(issuance, 'SELECT xmin FROM user_management.user_sessions'))
      .rejects.toMatchObject({ code: '42501' })
  })

  it('matches the independent privilege contract on all physical columns and all table powers', async () => {
    const principals = [...Object.values(roles), 'union_eyes_runtime', 'union_eyes_system']
    const columns = (await db.query<{ role: string; table_name: string; column_name: string; attribute_number: number; privilege: string; allowed: boolean }>(`
      SELECT r.role,c.relname AS table_name,a.attname AS column_name,a.attnum AS attribute_number,v.privilege,has_column_privilege(r.role,c.oid,a.attname,v.privilege) AS allowed
      FROM unnest($1::text[]) r(role) CROSS JOIN pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','REFERENCES']) v(privilege)
      WHERE n.nspname='user_management' AND c.relkind='r' AND a.attnum<>0 AND NOT a.attisdropped`, [principals])).rows
    expect(columns.length).toBeGreaterThan(1000)
    for (const row of columns)
      expect(row.allowed, `${row.role}:${row.table_name}.${row.column_name}:${row.privilege}`)
        .toBe(row.attribute_number < 0 ? authSystemColumnPrivilegeAllowed(row.role, row.table_name, row.column_name, row.privilege)
          : authColumnPrivilegeAllowed(row.table_name, row.column_name, AUTH_PRIVILEGE_EXPECTATIONS[row.role]?.[row.table_name]?.[row.privilege]))
    const tables = (await db.query<{ role: string; table_name: string; privilege: string; allowed: boolean }>(`
      SELECT r.role,c.relname AS table_name,v.privilege,has_table_privilege(r.role,c.oid,v.privilege) AS allowed
      FROM unnest($1::text[]) r(role) CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','REFERENCES','DELETE','TRUNCATE','TRIGGER']) v(privilege)
      WHERE n.nspname='user_management' AND c.relkind='r'`, [principals])).rows
    for (const row of tables)
      expect(row.allowed, `${row.role}:${row.table_name}:${row.privilege}`)
        .toBe(authTablePrivilegeAllowed(row.privilege, AUTH_PRIVILEGE_EXPECTATIONS[row.role]?.[row.table_name]?.[row.privilege]))
    process.stdout.write(JSON.stringify({
      proof: 'AUTH_SOURCE_COLUMN_EFFECTIVE_ACL_CENSUS', engine: 'PGlite', nativeVerdict: 'UNEXECUTED',
      effectiveColumnChecks: columns.length, tablePrivilegeChecks: tables.length,
      sourceFiles: Object.fromEntries(['bootstrap-sql.ts', 'privilege-expectations.ts', 'source-columns.ts'].map(file => [file,
        createHash('sha256').update(readFileSync(new URL(`../../../../packages/db/src/auth-storage-authority/${file}`, import.meta.url))).digest('hex')])),
      compiledSqlSha256: createHash('sha256').update(compileAuthBootstrapSql()).digest('hex'),
    }) + '\n')
  })

  it('keeps session creation and MFA enrollment/challenge operations under the live identity', async () => {
    expect((await query(identity, `INSERT INTO user_management.user_sessions(user_id,session_token,expires_at)
      VALUES($1,'synthetic-source-columns-session',now()+interval '1 hour') RETURNING user_id`, [target])).rows).toEqual([{ user_id: target }])
    expect((await query(identity, `INSERT INTO user_management.mfa_totp(user_id,secret_encrypted) VALUES($1,'synthetic-unusable-mfa') RETURNING user_id`, [target])).rows)
      .toEqual([{ user_id: target }])
    expect((await query(identity, `UPDATE user_management.mfa_totp SET enabled_at=now() WHERE user_id=$1 RETURNING user_id`, [target])).rows).toEqual([{ user_id: target }])
    expect((await query(identity, `INSERT INTO user_management.mfa_challenges(user_id,token_hash,expires_at)
      VALUES($1,repeat('a',64),now()+interval '5 minutes') RETURNING user_id`, [target])).rows).toEqual([{ user_id: target }])
    await expect(query(identity, `UPDATE user_management.users SET encrypted_sin='attempt' WHERE user_id=$1`, [target])).rejects.toMatchObject({ code: '42501' })
    expect((await db.query(`SELECT encrypted_sin='synthetic-retained-marker' AS unchanged FROM user_management.users WHERE user_id=$1`, [target])).rows)
      .toEqual([{ unchanged: true }])
    await expect(query(identity, `INSERT INTO user_management.user_sessions(user_id,session_token,expires_at,future_physical_column)
      VALUES($1,'synthetic-denied-session',now()+interval '1 hour','attempt')`, [target])).rejects.toMatchObject({ code: '42501' })
  })

  it('preserves signup and its same-transaction session without granting retained fields', async () => {
    const signup: AuthExecutionContext = { phase: 'issuance', operation: 'signup', email: 'source-columns-signup@example.invalid' }
    await scoped(signup, async () => {
      expect((await db.query(`INSERT INTO user_management.users(user_id,email,password_hash) VALUES('source-columns-signup',$1,'synthetic-unusable-password') RETURNING user_id`, [signup.email])).rows)
        .toEqual([{ user_id: 'source-columns-signup' }])
      expect((await db.query(`INSERT INTO user_management.user_sessions(user_id,session_token,expires_at)
        VALUES('source-columns-signup','synthetic-signup-session',now()+interval '1 hour') RETURNING user_id`)).rows).toEqual([{ user_id: 'source-columns-signup' }])
      return {}
    })
  })

  it('preserves live password-reset redemption and rejects a foreign user mutation', async () => {
    await db.query(`INSERT INTO user_management.password_reset_tokens(user_id,token_hash,expires_at) VALUES($1,repeat('b',64),now()+interval '1 hour')`, [target])
    const reset: AuthExecutionContext = { phase: 'redemption', selector: { kind: 'reset', tokenHash: 'b'.repeat(64) } }
    expect((await query(reset, 'UPDATE user_management.users SET password_hash=$1 WHERE user_id=$2 RETURNING user_id', ['synthetic-replacement-password', target])).rows)
      .toEqual([{ user_id: target }])
    expect((await query(reset, 'UPDATE user_management.users SET password_hash=$1 WHERE user_id=$2 RETURNING user_id', ['synthetic-denied-password', foreign])).rows).toEqual([])
    expect((await query(reset, 'UPDATE user_management.password_reset_tokens SET used_at=now() WHERE token_hash=$1 RETURNING user_id', ['b'.repeat(64)])).rows).toEqual([{ user_id: target }])
  })

  it('keeps the signup transaction-origin restriction for an existing account', async () => {
    const signup: AuthExecutionContext = { phase: 'issuance', operation: 'signup', email }
    await expect(query(signup, `INSERT INTO user_management.user_sessions(user_id,session_token,expires_at)
      VALUES($1,'synthetic-existing-account-denied',now()+interval '1 hour') RETURNING user_id`, [target]))
      .rejects.toMatchObject({ code: '42501' })
    expect((await db.query(`SELECT count(*)::int AS sessions FROM user_management.user_sessions WHERE session_token='synthetic-existing-account-denied'`)).rows)
      .toEqual([{ sessions: 0 }])
  })

  it('preserves invitation redemption through account, membership, session and final consumption', async () => {
    const org = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    await db.query(`INSERT INTO user_management.organization_users(user_id,organization_id,role,is_active) VALUES($1,$2,'admin',true)`, [target, org])
    await db.query(`INSERT INTO user_management.invites(email,organization_id,role,token_hash,invited_by,expires_at)
      VALUES('source-columns-invited@example.invalid',$1,'member',repeat('c',64),$2,now()+interval '1 hour')`, [org, target])
    await scoped({ phase: 'redemption', selector: { kind: 'invite', tokenHash: 'c'.repeat(64) } }, async () => {
      expect((await db.query(`SELECT id FROM user_management.invites WHERE token_hash=repeat('c',64) FOR UPDATE`)).rows).toHaveLength(1)
      expect((await db.query(`INSERT INTO user_management.users(user_id,email,email_verified) VALUES('source-columns-invited','source-columns-invited@example.invalid',true) RETURNING user_id`)).rows)
        .toEqual([{ user_id: 'source-columns-invited' }])
      expect((await db.query(`INSERT INTO user_management.organization_users(user_id,organization_id,role,invited_by)
        VALUES('source-columns-invited',$1,'member',$2) RETURNING user_id`, [org, target])).rows).toEqual([{ user_id: 'source-columns-invited' }])
      expect((await db.query(`INSERT INTO user_management.user_sessions(user_id,organization_id,session_token,expires_at)
        VALUES('source-columns-invited',$1,'synthetic-invited-session',now()+interval '1 hour') RETURNING user_id`, [org])).rows).toEqual([{ user_id: 'source-columns-invited' }])
      expect((await db.query(`UPDATE user_management.invites SET accepted_at=now(),accepted_user_id='source-columns-invited' WHERE token_hash=repeat('c',64) RETURNING accepted_user_id`)).rows)
        .toEqual([{ accepted_user_id: 'source-columns-invited' }])
      return {}
    })
    expect((await db.query(`SELECT accepted_at IS NOT NULL AS consumed FROM user_management.invites WHERE token_hash=repeat('c',64)`)).rows)
      .toEqual([{ consumed: true }])
  })

  it('makes the actual inspector reject a broad table grant instead of learning authority from physical columns', async () => {
    // Real engine adapter; no canned query results. The core-only fixture has
    // documented missing later UE companion contracts, captured as the baseline.
    const client = { query: db.query.bind(db) } as unknown as pg.Client
    const before = await inspectAuthPrivilegeExpectations(client)
    await db.exec(`GRANT SELECT ON user_management.users TO "${roles.identity}"`)
    try {
      const after = await inspectAuthPrivilegeExpectations(client)
      const added = after.failures.filter(failure => !before.failures.includes(failure))
      expect(after.result).toBe('FAIL')
      expect(added).toContain(`${roles.identity}:users:SELECT: unsafe grant/RLS/ownership`)
      for (const column of retained)
        expect(added).toContain(`${roles.identity}:users.${column}:SELECT expected=false`)
    } finally { await db.exec(`REVOKE SELECT ON user_management.users FROM "${roles.identity}"`) }
  })

  it('observes explicit technical ACLs without inventing column ACLs from an approved public table read', async () => {
    const statement = admissionQueries.find(entry => entry.name === 'columnGrants')!
    const acl = (await db.query<{ table_name: string; schema_name: string; column_name: string; role_name: string; privilege_type: string }>(statement.sql)).rows
    expect(acl.filter(row => row.column_name === 'xmin')).toEqual([expect.objectContaining({
      schema_name: 'user_management', table_name: 'users', column_name: 'xmin', role_name: roles.issuance, privilege_type: 'SELECT',
    })])
    await db.exec('CREATE TABLE public.source_column_acl_probe(id int); GRANT SELECT ON public.source_column_acl_probe TO union_eyes_runtime')
    try {
      expect((await db.query<{ table_name: string }>(statement.sql)).rows.some(row => row.table_name === 'source_column_acl_probe')).toBe(false)
      expect((await db.query(`SELECT has_table_privilege('union_eyes_runtime','public.source_column_acl_probe','SELECT') AS allowed`)).rows)
        .toEqual([{ allowed: true }])
    } finally { await db.exec('DROP TABLE public.source_column_acl_probe') }
  })

  it('keeps schema columns positive-only while canonical admission and cleanup see system-column ACLs', async () => {
    const relations = (await db.query<{ schema: string; table: string; columns: string[]; acl_columns: string[] }>(CURRENT_SECURITY_QUERIES.relations)).rows
    const users = relations.find(row => row.schema === 'user_management' && row.table === 'users')!
    expect(users.columns).not.toContain('xmin')
    expect(users.acl_columns).toContain('xmin')
    expect(users.acl_columns).toEqual(expect.arrayContaining(users.columns))
    const columns = (await db.query<{ role: string; table_name: string; privilege: string; all_columns: string[]; allowed_columns: string[] }>(CANONICAL_AUTH_QUERIES.columns)).rows
    const issuance = columns.find(row => row.role === roles.issuance && row.table_name === 'users' && row.privilege === 'SELECT')!
    expect(issuance.allowed_columns).toContain('xmin')
    expect(issuance.allowed_columns).not.toContain('encrypted_sin')
    const own = columns.find(row => row.role === roles.identity && row.table_name === 'users' && row.privilege === 'SELECT')!
    expect(own.allowed_columns).not.toContain('xmin')
    const tables = (await db.query<{ role: string; table_name: string; privilege: string; allowed: boolean }>(CANONICAL_AUTH_QUERIES.tables)).rows
    expect(tables.find(row => row.role === roles.issuance && row.table_name === 'users' && row.privilege === 'SELECT')?.allowed).toBe(false)
  })
})
