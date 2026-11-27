/** Clone lifecycle doubles and actual PGlite role/session SQL; not a native PostgreSQL/socket verdict. */
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Database } from '../../../../packages/db/src/client'
import { authContextSettings, authExecutionRole, type AuthExecutionContext } from '../../../../packages/db/src/auth-storage-authority/execution-boundary'
import { compileAuthBootstrapSql } from '../../../../packages/db/src/auth-storage-authority/bootstrap-sql'
import { compileSyntheticAuthFixtureSql } from '../bootstrap-v2/auth-fixture'
import { kit } from '../../db/__tests__/authority-kernel-testkit'
import type { SqlExecutor } from '../../lib/authority/store/executor'

const h = vi.hoisted(() => ({ queries: [] as string[], failQuery: null as string | null,
  closed: 0, executeAuth: vi.fn(), closeAuth: vi.fn(async () => undefined) }))
vi.mock('pg', () => ({ default: { Client: class {
  async connect() {}
  async end() { h.closed++ }
  async query(text: string, params?: unknown[]) {
    h.queries.push(text)
    if (h.failQuery && text.includes(h.failQuery)) throw new Error('Owned synthetic lifecycle fault')
    if (text === 'SHOW server_version_num') return { rows: [{ server_version_num: '160006' }], rowCount: 1 }
    const names = (params?.[0] ?? []) as string[]
    if (text.startsWith('SELECT rolname,rolcanlogin')) return { rows: names.slice().sort().map((rolname) => ({
      rolname, rolcanlogin: true, rolinherit: false, rolsuper: false, rolbypassrls: false, rolcreatedb: false, rolcreaterole: false })), rowCount: names.length }
    if (text.includes('FROM pg_auth_members')) return { rows: names.slice().sort().map((member) => ({ member,
      role: member.endsWith('_authsystem') ? 'nzila_auth_system_gateway' : member.endsWith('_auth') ? 'nzila_auth_gateway'
        : member.endsWith('_system') ? 'union_eyes_system' : 'union_eyes_runtime', admin: false, inherit: false, set: true })), rowCount: names.length }
    return { rows: [], rowCount: 0 }
  }
} } }))
// Only the socket transport is adapted; the production auth context/session/binder and compiled RLS execute below.
vi.mock('@nzila/db/auth-client', () => ({ executeAuthContext: h.executeAuth, closeAuthClients: h.closeAuth,
  lockInviterAuthority: () => { throw new Error('Unexpected inviter operation in session fixture test') } }))

import { closeNativeCanonicalSessions, createNativeCanonicalSession, installNativeCloneEnvironment,
  nativeActionUrl, nativeCloneConfiguration, nativeCloneLoginSql, openNativeCanonicalClone, installNativeBusinessContext,
  setNativeBusinessContext, verifyNativeClonePrincipals, withNativeCanonicalActor } from './native-canonical-fixture'

const template = 'postgresql://owned_operator:synthetic-operator-only@127.0.0.1:54321/pristine_template'
const org = '11111111-1111-4111-8111-111111111111'
const foreign = '22222222-2222-4222-8222-222222222222'
const actor = 'native-fixture-member'
beforeEach(() => { h.queries = []; h.failQuery = null; h.closed = 0 })
afterEach(async () => { await closeNativeCanonicalSessions(); vi.unstubAllEnvs() })

describe('owned clone lifecycle and credential routing (transport double)', () => {
  it('keeps four independently credentialed restricted URLs on the exact owned clone', () => {
    const config = nativeCloneConfiguration(template)
    const urls = Object.values(config.logins).map((login) => new URL(login.url))
    expect(new Set(urls.map((url) => url.pathname))).toEqual(new Set(['/' + config.database]))
    expect(new Set(urls.map((url) => url.username)).size).toBe(4)
    expect(new Set(urls.map((url) => url.password)).size).toBe(4)
    expect(urls.every((url) => url.host === '127.0.0.1:54321')).toBe(true)
    expect(new URL(config.operatorUrl).username).toBe('owned_operator')
    expect(new URL(config.maintenanceUrl).pathname).toBe('/postgres')
    expect(nativeCloneConfiguration(template).database).not.toBe(config.database)
  })

  it.each(['https://external.invalid/db', 'postgresql://u:p@external.invalid/db',
    'postgresql://u:p@127.0.0.1:54321/db?options=unsafe', 'postgresql://u:p@127.0.0.1:54321/db%22unsafe'])
    ('refuses an unowned or malformed template %s', (url) => expect(() => nativeCloneConfiguration(url)).toThrow())

  it('requires clone-specific restricted action credentials and restores every environment value', async () => {
    const fixture = await openNativeCanonicalClone(template)
    vi.stubEnv('AUTH_DATABASE_URL', 'prior-test-value')
    const restore = installNativeCloneEnvironment(fixture)
    try {
      expect(process.env.UE_CANONICAL_BOOTSTRAP_V2).toBe('1')
      expect(process.env.AUTH_SYSTEM_DATABASE_URL).toBe(fixture.authSystemUrl)
      expect(nativeActionUrl('union_eyes_runtime')).toBe(fixture.runtimeUrl)
      process.env.UE_NATIVE_RUNTIME_URL = template
      expect(() => nativeActionUrl('union_eyes_runtime')).toThrow()
    } finally { restore(); await fixture.dispose() }
    expect(process.env.AUTH_DATABASE_URL).toBe('prior-test-value')
    expect(h.queries.some((query) => query.startsWith('DROP DATABASE'))).toBe(true)
    expect(h.queries.filter((query) => query.startsWith('DROP ROLE'))).toHaveLength(4)
    expect(h.closed).toBe(2)
  })

  it('cleans its own database and tentative roles after provisioning fails, without publishing URLs', async () => {
    h.failQuery = 'CREATE ROLE'
    await expect(openNativeCanonicalClone(template)).rejects.toThrow('Owned synthetic lifecycle fault')
    expect(h.queries).toContain('ROLLBACK')
    expect(h.queries.filter((query) => query.startsWith('DROP DATABASE'))).toHaveLength(1)
    expect(h.queries.filter((query) => query.startsWith('DROP ROLE'))).toHaveLength(4)
  })

  it('propagates owned cleanup failure instead of reporting successful disposal', async () => {
    const fixture = await openNativeCanonicalClone(template)
    h.failQuery = 'DROP DATABASE'
    await expect(fixture.dispose()).rejects.toThrow('Owned synthetic lifecycle fault')
    h.failQuery = null
    await fixture.dispose()
  })
})

describe('actual source-compiled roles, opaque session factory and live bearer context (SQL engine)', () => {
  let engine: PGlite
  const config = nativeCloneConfiguration(template)
  const dialect = new PgDialect()
  const restoreOwner = () => engine.exec('RESET ROLE; SET SESSION AUTHORIZATION postgres; RESET ROLE')
  beforeAll(async () => {
    engine = new PGlite()
    await engine.exec(compileSyntheticAuthFixtureSql())
    await engine.exec(`CREATE ROLE union_eyes_runtime NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS;
      CREATE ROLE union_eyes_system NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS;`)
    await engine.exec(compileAuthBootstrapSql())
    await engine.exec(nativeCloneLoginSql({ ...config, database: 'postgres' }, 16))
    await engine.query(`INSERT INTO user_management.users(user_id,email,is_active,lifecycle_state)
      VALUES ($1,'native-fixture-member@example.invalid',true,'active')`, [actor])
    await engine.query(`INSERT INTO user_management.organization_users(user_id,organization_id,role,is_active)
      VALUES ($1,$2,'member',true)`, [actor, org])
    await engine.exec(`CREATE TABLE public.native_session_probe(organization_id uuid,label text);
      INSERT INTO public.native_session_probe VALUES('${org}','owned'),('${foreign}','foreign');
      ALTER TABLE public.native_session_probe ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.native_session_probe FORCE ROW LEVEL SECURITY;
      GRANT SELECT ON public.native_session_probe TO union_eyes_runtime;
      CREATE POLICY native_session_probe ON public.native_session_probe TO union_eyes_runtime
      USING(user_management.auth_business_org_authorized(organization_id,NULL::text[]));`)
    const driver = drizzle(engine)
    const executor = new Proxy(driver, {
      get(target, property) {
        if (property === 'execute') return async (statement: SQL) => {
          const query = dialect.sqlToQuery(statement)
          return (await engine.query(query.sql, query.params)).rows
        }
        const value = Reflect.get(target, property)
        return typeof value === 'function' ? value.bind(target) : value
      },
    }) as unknown as Database
    h.executeAuth.mockImplementation(async (context: AuthExecutionContext, callback: (tx: Database) => Promise<unknown>) => {
      const login = ['system', 'lifecycle', 'cleanup', 'mfa-admin'].includes(context.phase) ? config.logins.authSystem : config.logins.auth
      await engine.exec(`SET SESSION AUTHORIZATION "${login.username}"; BEGIN; SET LOCAL ROLE "${authExecutionRole(context)}"`)
      try {
        for (const [key, value] of Object.entries(authContextSettings(context))) await engine.query('SELECT set_config($1,$2,true)', [key, value])
        const result = await callback(executor)
        await engine.exec('COMMIT')
        return result
      } catch (error) { await engine.exec('ROLLBACK'); throw error }
      finally { await restoreOwner() }
    })
  }, 30000)
  beforeEach(() => {
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '1')
    vi.stubEnv('UE_AUTHORITY_COMBINED_URL', config.operatorUrl)
    vi.stubEnv('AUTH_DATABASE_URL', config.logins.auth.url)
    vi.stubEnv('AUTH_SYSTEM_DATABASE_URL', config.logins.authSystem.url)
  })
  afterAll(async () => { await engine?.close() })

  it('validates all real login attributes and incoming/outgoing membership edges', async () => {
    await verifyNativeClonePrincipals(engine, config, 16)
    await engine.exec('CREATE ROLE native_unexpected_member NOLOGIN')
    await engine.exec(`GRANT "${config.logins.runtime.username}" TO native_unexpected_member`)
    await expect(verifyNativeClonePrincipals(engine, config, 16)).rejects.toThrow()
    await engine.exec(`REVOKE "${config.logins.runtime.username}" FROM native_unexpected_member; DROP ROLE native_unexpected_member`)
    await engine.exec(`GRANT nzila_auth_system_gateway TO "${config.logins.runtime.username}" WITH INHERIT FALSE, SET TRUE`)
    await expect(verifyNativeClonePrincipals(engine, config, 16)).rejects.toThrow()
    await engine.exec(`REVOKE nzila_auth_system_gateway FROM "${config.logins.runtime.username}"`)
    await verifyNativeClonePrincipals(engine, config, 16)
  })

  const perform = async <T>(binding: Parameters<typeof setNativeBusinessContext>[1] | undefined,
    work: (executor: SqlExecutor) => Promise<T>) => {
    await engine.exec(`SET SESSION AUTHORIZATION "${config.logins.runtime.username}"; BEGIN; SET LOCAL ROLE union_eyes_runtime`)
    try {
      if (binding) await setNativeBusinessContext(engine, binding)
      else await engine.query(`SELECT set_config('app.current_user_id',$1,true),set_config('app.current_org_id',$2,true)`, [actor, org])
      const result = await work(engine)
      await engine.exec('COMMIT')
      return result
    } catch (error) { await engine.exec('ROLLBACK'); throw error }
    finally { await restoreOwner() }
  }
  const action = (binding?: Parameters<typeof setNativeBusinessContext>[1]) =>
    perform(binding, async (executor) => (await executor.query('SELECT label FROM public.native_session_probe')).rows)

  it('denies forged GUC-only identity, then uses a real opaque parent and revocable request bridge', async () => {
    expect(await action()).toEqual([])
    const session = await createNativeCanonicalSession(actor, org)
    expect(Reflect.has(session, 'token')).toBe(false)
    expect(JSON.stringify(session)).not.toContain('sessionToken')
    expect(await session.withBinding((binding) => action(binding))).toEqual([{ label: 'owned' }])
    const rows = (await engine.query<{ session_token: string; session_token_hash: string; is_active: boolean; device_info: { purpose?: string } }>(
      'SELECT session_token,session_token_hash,is_active,device_info FROM user_management.user_sessions')).rows
    expect(rows.every((row) => /^[a-f0-9]{64}$/.test(row.session_token_hash) && row.session_token === row.session_token_hash)).toBe(true)
    expect(rows.filter((row) => row.device_info?.purpose === 'business-org-binding').every((row) => !row.is_active)).toBe(true)
    await session.revoke()
    await expect(session.withBinding((binding) => action(binding))).rejects.toMatchObject({ code: 'SESSION_AUTHORITY_REQUIRED' })
  })

  it('does not remint a cached fixture parent after actual revocation', async () => {
    await withNativeCanonicalActor(actor, org, (binding) => action(binding))
    await engine.query('UPDATE user_management.user_sessions SET is_active=false WHERE user_id=$1', [actor])
    await expect(withNativeCanonicalActor(actor, org, (binding) => action(binding))).rejects.toMatchObject({ code: 'SESSION_AUTHORITY_REQUIRED' })
  })

  it('runs the existing authority testkit actor through its injected real session boundary', async () => {
    const authority = kit(engine, async () => [], (userId, organizationId, operation) =>
      withNativeCanonicalActor(userId, organizationId, (binding) => perform(binding, operation)))
    const rows = await authority.as(actor, org)(async (executor) =>
      (await executor.query('SELECT label FROM public.native_session_probe')).rows)
    expect(rows).toEqual([{ label: 'owned' }])
  })

  it('keeps raw bridge credentials out of both driver binding-failure errors', async () => {
    const session = await createNativeCanonicalSession(actor, org)
    for (const driver of ['raw', 'drizzle']) {
      let bridge = ''
      const error = await session.withBinding(async (binding) => {
        bridge = binding.sessionToken
        const failure = { code: '08006', message: `Private binding parameters ${bridge}`, params: [bridge] }
        if (driver === 'raw') return setNativeBusinessContext({ query: async () => { throw failure } }, binding)
        return installNativeBusinessContext(async () => { throw failure }, binding)
      }).then(() => null, (failure: unknown) => failure)
      expect(error instanceof Error).toBe(true)
      expect((error as Error).message.includes('SQLSTATE 08006')).toBe(true)
      expect((error as Error).message.includes(bridge)).toBe(false)
      expect(JSON.stringify(error).includes(bridge)).toBe(false)
      expect(Reflect.has(error as object, 'cause')).toBe(false)
    }
  })

  it('cannot issue a fixture parent to an inactive user or a foreign organization membership', async () => {
    await expect(createNativeCanonicalSession(actor, foreign)).rejects.toMatchObject({ cause: { code: '42501' } })
    await engine.query('UPDATE user_management.users SET is_active=false WHERE user_id=$1', [actor])
    try { await expect(createNativeCanonicalSession(actor, org)).rejects.toMatchObject({ cause: { code: '42501' } }) }
    finally { await engine.query('UPDATE user_management.users SET is_active=true WHERE user_id=$1', [actor]) }
  })

  it.each(['membership', 'user'])('rereads %s revocation against an already issued real parent before running business work', async (kind) => {
    const session = await createNativeCanonicalSession(actor, org)
    const table = kind === 'membership' ? 'organization_users' : 'users'
    await engine.query(`UPDATE user_management.${table} SET is_active=false WHERE user_id=$1`, [actor])
    const operation = vi.fn(action)
    try {
      await expect(session.withBinding(operation)).rejects.toMatchObject({ code: 'MEMBERSHIP_REQUIRED' })
      expect(operation).not.toHaveBeenCalled()
    } finally { await engine.query(`UPDATE user_management.${table} SET is_active=true WHERE user_id=$1`, [actor]) }
  })

  it('refuses a template/foreign-clone auth URL before any identity operation', async () => {
    vi.stubEnv('AUTH_DATABASE_URL', template)
    await expect(createNativeCanonicalSession(actor, org)).rejects.toThrow('Auth authority must belong to this test clone')
  })
})
