/** Trusted metadata and production session factory for one owned disposable DB.
 * Creates no awards, role, grant, derived authority or provider connection. */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import { withAuthContext } from '../../../../packages/platform-auth/src/auth-db'
import { withBearerOrgBinding } from '../../../../packages/platform-auth/src/org-binding'
import {
  createSession,
  revokeSession,
} from '../../../../packages/platform-auth/src/password/session'
import { closeAuthClients } from '../../../../packages/db/src/auth-client'
import {
  COLUMN_ACTOR_CLASSES,
  type RuntimeColumnActor,
  type RuntimeColumnFixture,
} from './runtime-column-security'
import type { RuntimeBindingRunner } from './runtime-session-proof'
export const RUNTIME_COLUMN_PRODUCER_PATHS = [
  'apps/union-eyes/scripts/bootstrap-v2/runtime-session-proof.ts',
  'apps/union-eyes/scripts/bootstrap-v2/runtime-column-fixtures.ts',
  'apps/union-eyes/scripts/bootstrap-v2/runtime-column-security.ts',
  'apps/union-eyes/scripts/bootstrap-v2/module-admission-runtime-security.ts',
] as const
let activeFactory = false
export function assertOwnedAuthUrl(
  value: string,
  operator: Pick<pg.Client, 'host' | 'port' | 'database'>,
) {
  const database = operator.database
  assert.ok(typeof database === 'string' && database.length > 0, 'OWNED_DATABASE_NAME_REQUIRED')
  assert.match(database, /^ue_[a-zA-Z0-9_]+$/)
  const url = new URL(value)
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol), 'POSTGRES_AUTH_URL_REQUIRED')
  assert.ok(
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname),
    'OWNED_LOOPBACK_AUTH_REQUIRED',
  )
  assert.equal(url.hostname.replace(/^\[|\]$/g, ''), operator.host, 'SAME_AUTH_SERVER_REQUIRED')
  assert.equal(Number(url.port || 5432), operator.port, 'SAME_AUTH_PORT_REQUIRED')
  assert.equal(decodeURIComponent(url.pathname.slice(1)), database, 'SAME_AUTH_DATABASE_REQUIRED')
  assert.ok(url.username && url.password, 'RESTRICTED_AUTH_CREDENTIAL_REQUIRED')
}
/** One factory per isolated qualification process. Never expose session tokens. */
export function openRuntimeSessionFactory(
  operator: pg.Client,
  authUrl: string,
  authSystemUrl?: string,
) {
  assertOwnedAuthUrl(authUrl, operator)
  if (authSystemUrl) {
    assertOwnedAuthUrl(authSystemUrl, operator)
    assert.notEqual(
      new URL(authUrl).username,
      new URL(authSystemUrl).username,
      'DISTINCT_AUTH_GATEWAYS_REQUIRED',
    )
  }
  assert.equal(activeFactory, false, 'NESTED_RUNTIME_SESSION_FACTORY_FORBIDDEN')
  const values: Record<string, string | undefined> = {
    UE_CANONICAL_BOOTSTRAP_V2: '1',
    AUTH_DATABASE_URL: authUrl,
    AUTH_SYSTEM_DATABASE_URL: authSystemUrl,
    AUTH_DB_POOL_MAX: '2',
    AUTH_SYSTEM_DB_POOL_MAX: '2',
  }
  const before = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]))
  for (const [key, value] of Object.entries(values))
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  activeFactory = true
  let disposed = false
  const sessions = new Map<string, Awaited<ReturnType<typeof createSession>>>()
  const pending = new Map<string, Promise<Awaited<ReturnType<typeof createSession>>>>()
  const runner =
    (userId: string, organizationId: string): RuntimeBindingRunner =>
    async (callback) => {
      assert.equal(disposed, false, 'RUNTIME_SESSION_FACTORY_DISPOSED')
      const key = JSON.stringify([userId, organizationId])
      let session = sessions.get(key)
      if (!session) {
        let issuance = pending.get(key)
        if (!issuance) {
          issuance = withAuthContext({ phase: 'identity', userId }, () =>
            createSession({ userId, organizationId }),
          )
          pending.set(key, issuance)
        }
        try {
          session = await issuance
          sessions.set(key, session)
        } finally {
          pending.delete(key)
        }
      }
      return withBearerOrgBinding(
        session.token,
        { organizationId, expectedActorUserId: userId },
        callback,
      )
    }
  return {
    withActor: runner,
    async dispose() {
      if (disposed) return
      disposed = true
      const errors: unknown[] = []
      try {
        for (const session of sessions.values())
          try {
            await withAuthContext({ phase: 'identity', userId: session.session.userId }, () =>
              revokeSession(session.session.sessionId),
            )
          } catch (error) {
            errors.push(error)
          }
        try {
          await closeAuthClients()
        } catch (error) {
          errors.push(error)
        }
      } finally {
        sessions.clear()
        pending.clear()
        activeFactory = false
        for (const [key, value] of Object.entries(before))
          if (value === undefined) delete process.env[key]
          else process.env[key] = value
      }
      if (errors.length) throw new AggregateError(errors, 'RUNTIME_SESSION_CLEANUP_FAILED')
    },
  }
}
export type RuntimeSessionFactory = ReturnType<typeof openRuntimeSessionFactory>
export async function prepareRuntimeColumnActors(input: {
  operator: pg.Client
  sessions: RuntimeSessionFactory
  organizations: readonly [string, string]
  programs: readonly [string, string]
  types: readonly [string, string]
}) {
  const create = async (org: string, role: 'member' | 'admin', systemAdmin = false) => {
    const id = randomUUID()
    await input.operator.query(
      'INSERT INTO user_management.users(user_id,email,is_system_admin) VALUES($1,$2,$3)',
      [id, `ue-column-${id}@example.invalid`, systemAdmin],
    )
    await input.operator.query(
      'INSERT INTO user_management.organization_users(user_id,organization_id,role,is_active) VALUES($1,$2,$3,true)',
      [id, org, role],
    )
    return id
  }
  const actors: RuntimeColumnActor[] = []
  let foreign: RuntimeColumnFixture
  await input.operator.query('BEGIN')
  try {
    for (const actorClass of COLUMN_ACTOR_CLASSES) {
      const user = await create(
        input.organizations[0],
        actorClass === 'MEMBER' ? 'member' : 'admin',
        actorClass === 'PLATFORM_ADMIN',
      )
      actors.push({
        actorClass,
        recipientUserId: await create(input.organizations[0], 'member'),
        probeRecipientUserId: await create(input.organizations[0], 'member'),
        programId: input.programs[0],
        awardTypeId: input.types[0],
        withBinding: input.sessions.withActor(user, input.organizations[0]),
      })
    }
    const user = await create(input.organizations[1], 'member')
    foreign = {
      recipientUserId: await create(input.organizations[1], 'member'),
      programId: input.programs[1],
      awardTypeId: input.types[1],
      withBinding: input.sessions.withActor(user, input.organizations[1]),
    }
    await input.operator.query('COMMIT')
  } catch (error) {
    await input.operator.query('ROLLBACK')
    throw error
  }
  return { actors, foreign }
}
