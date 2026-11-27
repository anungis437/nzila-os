/** Owned native test clones and real canonical sessions; never a deployed authority or QA auth bypass. */
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import pg from 'pg'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import { sanitizedBindingError } from '../../lib/db/binding-error'
import { canonicalPostgresMajor, compileCanonicalMembershipGrant, membershipCatalogProjectionSql,
  type CanonicalPostgresMajor } from '../../../../packages/db/src/auth-storage-authority/membership-semantics'
import type { AuthenticatedOrgBinding } from '../../../../packages/platform-auth/src/org-binding'
import type { SqlExecutor } from '../../lib/authority/store/executor'

const identifier = (value: string) => {
  assert.match(value, /^[A-Za-z0-9_]+$/)
  assert.ok(value.length <= 63)
  return `"${value}"`
}
const loginRoles = { runtime: 'union_eyes_runtime', system: 'union_eyes_system',
  auth: 'nzila_auth_gateway', authSystem: 'nzila_auth_system_gateway' } as const
type Principal = keyof typeof loginRoles

export function nativeCloneConfiguration(templateUrl: string) {
  const template = new URL(templateUrl)
  assert.ok(['postgres:', 'postgresql:'].includes(template.protocol))
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(template.hostname), 'Native clone must be owned loopback')
  assert.ok(template.username && template.password && !template.search && !template.hash)
  const templateName = decodeURIComponent(template.pathname.slice(1))
  identifier(templateName)
  const database = `ue_native_${process.pid}_${Date.now().toString(36)}_${randomBytes(6).toString('hex')}`
  const maintenance = new URL(template); maintenance.pathname = '/postgres'
  const operator = new URL(template); operator.pathname = `/${database}`
  const logins = Object.fromEntries(Object.entries(loginRoles).map(([principal, role]) => {
    const username = `${database}_${principal.toLowerCase()}`
    identifier(username)
    const password = randomBytes(24).toString('hex')
    const url = new URL(operator); url.username = username; url.password = password
    return [principal, { username, password, role, url: url.toString() }]
  })) as Record<Principal, { username: string; password: string; role: string; url: string }>
  return { templateName, database, maintenanceUrl: maintenance.toString(), operatorUrl: operator.toString(), logins }
}

export function nativeCloneLoginSql(configuration: ReturnType<typeof nativeCloneConfiguration>, postgresMajor: CanonicalPostgresMajor) {
  return Object.values(configuration.logins).map(({ username, password, role }) => {
    assert.match(password, /^[a-f0-9]{48}$/)
    return `CREATE ROLE ${identifier(username)} LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '${password}';\n` +
      compileCanonicalMembershipGrant(username, [role], { inherit: false, set: true, memberRoleInherit: false }, postgresMajor) +
      `\nGRANT CONNECT ON DATABASE ${identifier(configuration.database)} TO ${identifier(username)};`
  }).join('\n')
}

export async function verifyNativeClonePrincipals(executor: SqlExecutor,
  configuration: ReturnType<typeof nativeCloneConfiguration>, major: CanonicalPostgresMajor) {
  const names = Object.values(configuration.logins).map((login) => login.username)
  const attributes = (await executor.query(`SELECT rolname,rolcanlogin,rolinherit,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole
    FROM pg_roles WHERE rolname=ANY($1::text[]) ORDER BY rolname`, [names])).rows
  assert.deepEqual(attributes, names.slice().sort().map((rolname) => ({ rolname, rolcanlogin: true,
    rolinherit: false, rolsuper: false, rolbypassrls: false, rolcreatedb: false, rolcreaterole: false })))
  const projection = membershipCatalogProjectionSql(major)
  const edges = (await executor.query(`SELECT member.rolname AS member,parent.rolname AS role,
    ${projection.adminOption} AS admin,${projection.inheritOption} AS inherit,${projection.setOption} AS set
    FROM pg_auth_members m JOIN pg_roles member ON member.oid=m.member JOIN pg_roles parent ON parent.oid=m.roleid
    WHERE member.rolname=ANY($1::text[]) OR parent.rolname=ANY($1::text[]) ORDER BY member.rolname,parent.rolname`, [names])).rows
  assert.deepEqual(edges, Object.values(configuration.logins).map((login) => ({ member: login.username,
    role: login.role, admin: false, inherit: false, set: true })).sort((a, b) => a.member.localeCompare(b.member)))
}

export async function openNativeCanonicalClone(templateUrl: string) {
  const configuration = nativeCloneConfiguration(templateUrl)
  const admin = new pg.Client({ connectionString: configuration.maintenanceUrl })
  let databaseCreated = false, loginsCreated = false
  const dispose = async () => {
    if (!databaseCreated && !loginsCreated) return
    const cleaner = new pg.Client({ connectionString: configuration.maintenanceUrl })
    await cleaner.connect()
    try {
      if (databaseCreated) {
        await cleaner.query(`DROP DATABASE ${identifier(configuration.database)} WITH (FORCE)`)
        databaseCreated = false
      }
      if (loginsCreated) {
        for (const { username } of Object.values(configuration.logins))
          await cleaner.query(`DROP ROLE IF EXISTS ${identifier(username)}`)
        loginsCreated = false
      }
    } finally { await cleaner.end() }
  }
  try {
    await admin.connect()
    const major = canonicalPostgresMajor((await admin.query('SHOW server_version_num')).rows[0].server_version_num)
    await admin.query(`CREATE DATABASE ${identifier(configuration.database)} TEMPLATE ${identifier(configuration.templateName)}`)
    databaseCreated = true
    await admin.query('BEGIN')
    try {
      const names = Object.values(configuration.logins).map((login) => login.username)
      assert.equal((await admin.query('SELECT rolname FROM pg_roles WHERE rolname=ANY($1::text[])', [names])).rowCount, 0,
        'Fresh owned native role names required')
      loginsCreated = true
      await admin.query(nativeCloneLoginSql(configuration, major))
      await admin.query('COMMIT')
      await verifyNativeClonePrincipals(admin, configuration, major)
    } catch (error) { await admin.query('ROLLBACK'); throw error }
  } catch (error) {
    try { await dispose() } catch (cleanup) { throw new AggregateError([error, cleanup], 'Native clone setup and cleanup failed', { cause: error }) }
    throw error
  } finally { await admin.end() }
  return { operatorUrl: configuration.operatorUrl, runtimeUrl: configuration.logins.runtime.url,
    systemUrl: configuration.logins.system.url, authUrl: configuration.logins.auth.url,
    authSystemUrl: configuration.logins.authSystem.url, dispose }
}

export function installNativeCloneEnvironment(fixture: Awaited<ReturnType<typeof openNativeCanonicalClone>>) {
  const environment = { UE_AUTHORITY_COMBINED_URL: fixture.operatorUrl, UE_CENSUS_URL: fixture.operatorUrl,
    UE_NATIVE_OPERATOR_URL: fixture.operatorUrl, UE_NATIVE_RUNTIME_URL: fixture.runtimeUrl,
    UE_NATIVE_SYSTEM_URL: fixture.systemUrl, DATABASE_URL: fixture.runtimeUrl, SYSTEM_DATABASE_URL: fixture.systemUrl,
    AUTH_DATABASE_URL: fixture.authUrl, AUTH_SYSTEM_DATABASE_URL: fixture.authSystemUrl, UE_CANONICAL_BOOTSTRAP_V2: '1' }
  const prior = Object.fromEntries(Object.keys(environment).map((key) => [key, process.env[key]]))
  Object.assign(process.env, environment)
  return () => { for (const [key, value] of Object.entries(prior)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  } }
}

export function nativeActionUrl(role: 'union_eyes_runtime' | 'union_eyes_system', operatorUrl = process.env.UE_AUTHORITY_COMBINED_URL) {
  const value = process.env[role === 'union_eyes_runtime' ? 'UE_NATIVE_RUNTIME_URL' : 'UE_NATIVE_SYSTEM_URL']
  assert.ok(operatorUrl && value, 'Per-clone restricted native credentials required; operator fallback is forbidden')
  const operator = new URL(operatorUrl), restricted = new URL(value)
  assert.ok(['postgres:', 'postgresql:'].includes(restricted.protocol))
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(operator.hostname))
  assert.equal(restricted.host, operator.host)
  assert.equal(restricted.pathname, operator.pathname)
  assert.notEqual(restricted.username, operator.username)
  assert.match(decodeURIComponent(restricted.pathname.slice(1)), /^ue_native_[A-Za-z0-9_]+$/)
  assert.equal(process.env.UE_CANONICAL_BOOTSTRAP_V2, '1')
  return value
}

export interface NativeCanonicalSession {
  readonly userId: string
  readonly organizationId: string
  readonly sessionId: string
  withBinding<T>(operation: (binding: AuthenticatedOrgBinding) => Promise<T>): Promise<T>
  revoke(): Promise<void>
}
// ga-check:exempt — native test fixture: sessions it created this run, revoked on teardown; not persistence.
const sessions = new Map<string, NativeCanonicalSession>()

/** Call after operator seeds commit: the production auth gateway uses a separate connection.
 * This never creates a user, membership, role, grant or relationship. */
export async function createNativeCanonicalSession(userId: string, organizationId: string): Promise<NativeCanonicalSession> {
  assert.equal(process.env.UE_CANONICAL_BOOTSTRAP_V2, '1', 'Native actions require canonical mode')
  const authUrl = process.env.AUTH_DATABASE_URL, operatorUrl = process.env.UE_AUTHORITY_COMBINED_URL
  assert.ok(authUrl && operatorUrl, 'Per-clone auth/operator URLs required')
  const auth = new URL(authUrl), operator = new URL(operatorUrl)
  assert.ok(['postgres:', 'postgresql:'].includes(auth.protocol))
  assert.equal(auth.host, operator.host, 'Auth authority must belong to this test server')
  assert.equal(auth.pathname, operator.pathname, 'Auth authority must belong to this test clone')
  assert.notEqual(auth.username, operator.username, 'Auth operator fallback is forbidden')
  assert.match(decodeURIComponent(auth.pathname.slice(1)), /^ue_native_[A-Za-z0-9_]+$/)
  const { withAuthContext } = await import('../../../../packages/platform-auth/src/auth-db')
  const { createSession, revokeSession } = await import('../../../../packages/platform-auth/src/password/session')
  const { withBearerOrgBinding } = await import('../../../../packages/platform-auth/src/org-binding')
  const issued = await withAuthContext({ phase: 'identity', userId }, () => createSession({ userId, organizationId }))
  // Closure-held bearer: no cookie stub, deterministic token, raw credential field or serialized token.
  return Object.freeze({ userId, organizationId, sessionId: issued.session.sessionId,
    withBinding: <T>(operation: (binding: AuthenticatedOrgBinding) => Promise<T>) =>
      withBearerOrgBinding(issued.token, { organizationId, expectedActorUserId: userId }, operation),
    revoke: () => withAuthContext({ phase: 'identity', userId }, () => revokeSession(issued.session.sessionId)) })
}

export async function withNativeCanonicalActor<T>(userId: string, organizationId: string,
  operation: (binding: AuthenticatedOrgBinding) => Promise<T>) {
  const key = JSON.stringify([userId, organizationId])
  let session = sessions.get(key)
  if (!session) { session = await createNativeCanonicalSession(userId, organizationId); sessions.set(key, session) }
  return session.withBinding(operation)
}

export async function nativeBusinessContextSql(binding: AuthenticatedOrgBinding) {
  const { authenticatedOrgBindingSql } = await import('../../../../packages/platform-auth/src/org-binding')
  return authenticatedOrgBindingSql(binding)
}

export async function setNativeBusinessContext(executor: SqlExecutor, binding: AuthenticatedOrgBinding) {
  const compiled = new PgDialect().sqlToQuery(await nativeBusinessContextSql(binding))
  try { await executor.query(compiled.sql, compiled.params) }
  catch (error) { throw sanitizedBindingError(error) }
}

export async function installNativeBusinessContext(execute: (statement: SQL) => Promise<unknown>, binding: AuthenticatedOrgBinding) {
  try { await execute(await nativeBusinessContextSql(binding)) }
  catch (error) { throw sanitizedBindingError(error) }
}

export async function closeNativeCanonicalSessions() {
  sessions.clear()
  const { closeAuthClients } = await import('../../../../packages/db/src/auth-client')
  await closeAuthClients()
}
