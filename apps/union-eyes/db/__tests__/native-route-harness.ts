/**
 * Harness for native route tests: the unmodified route handlers and services run against a real PostgreSQL database as the real roles.
 *
 * Only the request boundary is replaced, and it is replaced with the behaviour production gives it:
 *   - `emulatedWithApi` applies the role floor from ROLE_HIERARCHY and, for a route that asks for `rlsOrgContext`, runs the handler inside a tenant
 *     transaction (the runtime role with app.current_org_id and app.current_user_id set), as lib/api/with-api does;
 *   - `rlsContextModule` opens the same tenant transaction for `withRLSContext`, and a system transaction for `withSystemContext`;
 *   - `ambientDb` is the handle a service reads with: the tenant transaction when there is one, otherwise the runtime role with no organization;
 *   - the audit boundary records what a committed transaction audited and discards it when the transaction rolls back, so a test can state that an
 *     audit and its mutation commit or fail together. `harness.failNextAudit()` makes the next audit throw to prove that.
 * Everything a statement sends is what PostgreSQL receives; nothing in the data path is mocked.
 *
 * A test file wires it with vi.mock factories that import this module, then calls `harness.start()` in beforeAll and `harness.stop()` in afterAll.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import assert from 'node:assert/strict'
import { nativeActionUrl, setNativeBusinessContext, withNativeCanonicalActor } from '../../scripts/runtime/native-canonical-fixture'
import type { AuthenticatedOrgBinding } from '../../../../packages/platform-auth/src/org-binding'
import { requireLiveCanonicalMembership, seedDeclaredCanonicalActor } from './native-declared-actor'

export { seedDeclaredCanonicalActor }

export type RouteDb = ReturnType<typeof drizzle<Record<string, unknown>, pg.PoolClient>>

export const RUNTIME_ROLE = 'union_eyes_runtime'
export const SYSTEM_ROLE = 'union_eyes_system'

export interface AuditRecord {
  organizationId?: string | null
  userId?: string | null
  action: string
  resourceType?: string
  resourceId?: string
  details?: Record<string, unknown>
}

interface Scope {
  db: RouteDb
  pendingAudits: AuditRecord[]
}

const scopes = new AsyncLocalStorage<Scope>()
/** The authenticated caller of the request being handled, as production's auth() / canonical request scope answers it inside a route. */
const callers = new AsyncLocalStorage<{ userId: string }>()

let pool: pg.Pool | null = null
let systemPool: pg.Pool | null = null
let runtimePool: pg.Pool | null = null
let ambient: ReturnType<typeof drizzle> | null = null
let schema: Record<string, unknown> | null = null
let operatorPool: pg.Pool | null = null
let auditFailure: Error | null = null
// ga-check:exempt test-harness state: one process per native test file, holding the roles a test assigned to its own callers.
const roles = new Map<string, string>()
// ga-check:exempt test-harness state: the declared caller who opens an organization's pages outside a handled request.
const pageCallers = new Map<string, string>()
// ga-check:exempt test-harness state: the operator seeds of declared actors, settled before any canonical session is opened.
let declarations: Promise<void> = Promise.resolve()

/** Every declaration made so far has reached the database (or its failure is raised here, at the first use, not lost). */
async function declaredActorsSettled(): Promise<void> {
  await declarations
}

export const harness = {
  /** Every audit entry a committed tenant transaction recorded, oldest first. */
  audits: [] as AuditRecord[],

  /** The options each wrapped route declared, in the order the routes were loaded, so a test can state what a route asks of the wrapper. */
  configs: [] as EmulatedConfig[],

  /** Opens the pools against an ADMIN connection to a disposable, fully bootstrapped database and returns the admin client for seeding and inspection. */
  async start(url: string): Promise<pg.Client> {
    schema = (await import('@/db/schema')) as unknown as Record<string, unknown>
    pool = new pg.Pool({ connectionString: nativeActionUrl(RUNTIME_ROLE, url), max: 4 })
    systemPool = new pg.Pool({ connectionString: nativeActionUrl(SYSTEM_ROLE, url), max: 4 })
    // The handle a service reads with outside a tenant transaction is the runtime role, which row-level security applies to.
    runtimePool = new pg.Pool({ connectionString: nativeActionUrl(RUNTIME_ROLE, url), max: 4, options: `-c role=${RUNTIME_ROLE}` })
    ambient = drizzle(runtimePool, { schema: schema as never })
    operatorPool = new pg.Pool({ connectionString: url, max: 1 })
    declarations = Promise.resolve()
    pageCallers.clear()
    const admin = new pg.Client({ connectionString: url })
    await admin.connect()
    return admin
  },

  async stop(): Promise<void> {
    await pool?.end()
    await systemPool?.end()
    await runtimePool?.end()
    await declarations.catch(() => undefined)
    await operatorPool?.end()
    pool = null
    systemPool = null
    runtimePool = null
    operatorPool = null
    ambient = null
  },

  /**
   * Declares a fixture actor: the operator seeds its canonical user and membership (seedDeclaredCanonicalActor). The role the routes see is still
   * the one the live canonical membership read returns through a real session; this only puts the declared membership where that read looks.
   * Seeds run in declaration order; the first tenant transaction or membership read waits for them. Declare after the organization exists.
   */
  setRole(userId: string, organizationId: string, role: string, options: { systemAdmin?: boolean } = {}): Promise<void> {
    if (!operatorPool) throw new Error('route harness not started: declare actors after harness.start()')
    const operator = operatorPool
    roles.set(`${userId}|${organizationId}`, role)
    declarations = declarations.then(() => seedDeclaredCanonicalActor(operator, userId, organizationId, role, options))
    const settled = declarations
    settled.catch(() => undefined)
    return settled
  },

  /**
   * Declares the authenticated user who opens an organization's pages outside a handled request (a page or service that passes only
   * { organizationId } to withRLSContext, which production resolves to the signed-in user). Seeds the actor like setRole.
   */
  declareCaller(userId: string, organizationId: string, role: string): Promise<void> {
    pageCallers.set(organizationId, userId)
    return harness.setRole(userId, organizationId, role)
  },

  /**
   * A request of this caller outside a wrapped route (a page, a server action), as production serves it in canonical mode: the canonical
   * request scope of withCanonicalApiContext, held for the request. Someone with no live canonical membership there is refused as the
   * binder refuses them (MEMBERSHIP_REQUIRED), and no scope is established.
   */
  async asCanonicalRequest<T>(userId: string, organizationId: string, work: () => Promise<T>): Promise<T> {
    if (!operatorPool) throw new Error('route harness not started')
    await declaredActorsSettled()
    await requireLiveCanonicalMembership(operatorPool, userId, organizationId)
    const [{ withCanonicalRequestScope }, { canonicalMembershipRole }] = await Promise.all([
      import('@/lib/auth/canonical-request-scope'), import('@/lib/auth/canonical-membership-role')])
    return withNativeCanonicalActor(userId, organizationId, (binding) => withCanonicalRequestScope(binding, {
      userId: binding.userId, organizationId: binding.organizationId, role: canonicalMembershipRole(binding.role, binding.isSystemAdmin),
      email: `${binding.userId}@example.test`, firstName: null, lastName: null, isSystemAdmin: binding.isSystemAdmin,
    }, () => callers.run({ userId }, work)))
  },

  failNextAudit(error: Error = new Error('audit sink unavailable')): void {
    auditFailure = error
  },

  async tenant<T>(role: string, organizationId: string | null, userId: string | null, work: (tx: RouteDb) => Promise<T>): Promise<T> {
    assert.ok(role === RUNTIME_ROLE || role === SYSTEM_ROLE, 'Native action role must be declared')
    const selectedPool = role === SYSTEM_ROLE ? systemPool : pool
    if (!selectedPool || !schema) throw new Error('route harness not started')
    await declaredActorsSettled()
    const execute = async (binding?: AuthenticatedOrgBinding) => {
      const client = await selectedPool.connect()
      try {
        // A drizzle transaction object, as production's withRLSContext hands out: a transaction a handler opens on it is a savepoint inside
        // this one, never a second BEGIN whose COMMIT would end this transaction (and its role and settings) early.
        const scope: Scope = { db: null as unknown as RouteDb, pendingAudits: [] }
        const result = await drizzle(client, { schema: schema as never }).transaction(async (tx) => {
          await client.query(`SET LOCAL ROLE ${role}`)
          await client.query('SET LOCAL search_path=pg_catalog,public,pg_temp')
          await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [userId ?? ''])
          await client.query(`SELECT set_config('app.current_org_id', $1, true)`, [organizationId ?? ''])
          if (binding) await setNativeBusinessContext(client, binding)
          scope.db = tx as unknown as RouteDb
          return scopes.run(scope, () => work(scope.db))
        })
        harness.audits.push(...scope.pendingAudits)
        return result
      } finally {
        client.release()
      }
    }
    // A tenant handle of an organization with no named user acts as that organization's declared page caller, if it has one.
    // Missing actor/organization remains an explicitly unauthenticated negative SQL probe.
    const actor = userId ?? (role === RUNTIME_ROLE && organizationId ? pageCallers.get(organizationId) ?? null : null)
    return role === RUNTIME_ROLE && actor && organizationId
      ? withNativeCanonicalActor(actor, organizationId, execute)
      : execute()
  },
}

export const ambientDb = new Proxy({}, {
  get(_target, property) {
    const store = (scopes.getStore()?.db ?? ambient) as unknown as Record<PropertyKey, unknown> | null
    if (!store) throw new Error('route harness not started')
    const value = store[property]
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(store) : value
  },
})

export const rlsContextModule = {
  withSystemContext: <T>(work: (tx: RouteDb) => Promise<T>) => harness.tenant(SYSTEM_ROLE, null, null, work),
  // Production's withRLSContext takes the actor from the authenticated request (resolveRLSActor), never from the context map; inside a handled
  // request the harness does the same. Outside one (a test's own probe) there is no caller, and no actor unless the probe names one.
  withRLSContext: <T>(context: { organizationId: string; userId?: string }, work: (tx: RouteDb) => Promise<T>) =>
    harness.tenant(RUNTIME_ROLE, context.organizationId,
      context.userId ?? callers.getStore()?.userId ?? pageCallers.get(context.organizationId) ?? null, work),
}

/**
 * The audit boundary. It records what a committed transaction audited (and discards it on rollback), and, as production's persistAtomicAudit
 * does in canonical mode, it also appends the real canonical record (lib/audit/mandatory-audit.ts) in the same transaction: the canonical
 * database's own guards (for example GRIEVANCE_TRANSITION_HISTORY_AUDIT_REQUIRED) require that record before the change may commit.
 * failNextAudit() makes the next audit throw before anything is written.
 */
export async function recordAudit(tx: unknown, entry: AuditRecord): Promise<void> {
  if (auditFailure) {
    const failure = auditFailure
    auditFailure = null
    throw failure
  }
  const scope = scopes.getStore()
  if (!scope) throw new Error('an audit was written outside a transaction')
  const { appendMandatoryAudit } = await import('@/lib/audit/mandatory-audit')
  await appendMandatoryAudit(tx as never, entry as never)
  scope.pendingAudits.push(entry)
}

export async function roleInOrganization(userId: string, organizationId: string): Promise<string | null> {
  await declaredActorsSettled()
  // Inside a handled request the role is the established canonical request's, as production's lookups answer from it: no second binding
  // (which would also wait on the case locks the request's own transaction holds for that principal).
  const { currentCanonicalRequest } = await import('@/lib/auth/canonical-request-scope')
  const established = (() => { try { return currentCanonicalRequest() } catch { return null } })()
  if (established && established.binding.userId === userId && established.binding.organizationId.toLowerCase() === organizationId.toLowerCase())
    return established.binding.role
  // As production's binder: someone with no live canonical membership is MEMBERSHIP_REQUIRED before any session is issued.
  try {
    if (operatorPool) await requireLiveCanonicalMembership(operatorPool, userId, organizationId)
    return await withNativeCanonicalActor(userId, organizationId, async (binding) => binding.role)
  }
  catch (error) {
    if (error && typeof error === 'object' && 'code' in error &&
      ['UNAUTHENTICATED', 'MEMBERSHIP_REQUIRED', 'SESSION_AUTHORITY_REQUIRED'].includes(String(error.code))) return null
    throw error
  }
}

interface EmulatedConfig {
  auth?: { required?: boolean; minRole?: string; cron?: boolean }
  rlsOrgContext?: boolean
  requireOrg?: boolean
  openapi?: { summary?: string }
}

type Context = { organizationId?: string | null; userId?: string | null; role?: string; [key: string]: unknown }

/**
 * The wrapper's observable contract for a handler: the role floor, then a tenant transaction for a route that asks for one.
 * Canonical membership is read when the first request arrives, not when this module loads: the harness is imported from vi.mock factories, and a static
 * import of the auth guard from here would wait on the very mocks that are waiting on this module.
 */
export function emulatedWithApi(config: EmulatedConfig, handler: (ctx: Context) => Promise<unknown>) {
  harness.configs.push(config)
  return async (ctx: Context) => {
    const required = config.auth?.minRole
    const held = ctx.userId && ctx.organizationId ? await roleInOrganization(ctx.userId, ctx.organizationId) : null
    if (required) {
      const { ROLE_HIERARCHY } = await import('@/lib/api-auth-guard')
      const level = (name: string | null | undefined) => (name ? (ROLE_HIERARCHY as Record<string, number>)[name] ?? 0 : 0)
      if (level(held) < level(required)) {
        const { ApiError } = await import('@/lib/api/errors')
        throw ApiError.forbidden()
      }
    }
    // As lib/api/with-api.ts does in canonical mode (the mode of every native clone): an authenticated, organization-bound route runs in
    // the caller's tenant transaction unless it opts out (rlsOrgContext: false); requireOrg defaults to requiring authentication.
    const requireAuth = config.auth?.required !== false && !config.auth?.cron
    const requireOrg = config.requireOrg ?? requireAuth
    const tenantTransaction = config.rlsOrgContext === true || (config.rlsOrgContext !== false && requireAuth && requireOrg)
    const handle = () => {
      if (tenantTransaction && ctx.organizationId && !scopes.getStore()) {
        return harness.tenant(RUNTIME_ROLE, ctx.organizationId, ctx.userId ?? null, () => handler({ ...ctx, role: held ?? undefined }))
      }
      return handler({ ...ctx, role: held ?? undefined })
    }
    if (!ctx.userId) return handle()
    const userId = ctx.userId
    // A live member's request runs inside the canonical request scope production's withCanonicalApiContext establishes from the session:
    // one live binding held for the whole request, with the profile read from the canonical user, so in-handler role and organization
    // reads answer from it. A caller with no live membership gets no scope, exactly as the binder refuses to establish one.
    if (held && ctx.organizationId) {
      const organizationId = ctx.organizationId
      const [{ withCanonicalRequestScope }, { canonicalMembershipRole }] = await Promise.all([
        import('@/lib/auth/canonical-request-scope'), import('@/lib/auth/canonical-membership-role')])
      return withNativeCanonicalActor(userId, organizationId, async (binding) => {
        let role: ReturnType<typeof canonicalMembershipRole>
        try { role = canonicalMembershipRole(binding.role, binding.isSystemAdmin) }
        catch {
          // Production's binder refuses an ordinary membership that carries an elevated platform role (ROLE_REQUIRED): no request scope.
          const { ApiError } = await import('@/lib/api/errors')
          throw ApiError.forbidden()
        }
        return withCanonicalRequestScope(binding, {
        userId: binding.userId, organizationId: binding.organizationId,
        role,
        email: `${binding.userId}@example.test`, firstName: null, lastName: null, isSystemAdmin: binding.isSystemAdmin,
      }, () => callers.run({ userId }, handle))
      })
    }
    return callers.run({ userId }, handle)
  }
}
