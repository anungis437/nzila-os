/**
 * Tenant and system contexts for native tests of code that opens its own transactions inside a context (a service that runs
 * `db.transaction(...)` while the caller's withRLSContext is open).
 *
 * native-route-harness.ts opens its context with a manual BEGIN on a plain drizzle handle, so a nested `db.transaction(...)` would issue a second
 * BEGIN and then COMMIT the outer transaction, dropping the role and the organization setting for every later statement. The application's
 * withRLSContext hands out a drizzle TRANSACTION object, where a nested transaction is a savepoint. This harness does the same: the context is
 * `drizzle(client).transaction(...)`, `SET LOCAL ROLE`, then the organization and the user as transaction-local settings.
 *
 *   - `ambientDb` is the handle a service reads with: the open context's transaction, otherwise the runtime role with NO organization set;
 *   - the raw `execute` of a context's transaction, of the ambient handle, and of every transaction (or savepoint) opened on either, returns the rows as an array, as the application's postgres-js driver does (node-postgres returns { rows });
 *   - `recordAudit` stands in for persistAtomicAudit: what a committed context audited is kept in `audits`, what a rolled-back one audited is discarded,
 *     and `failNextAudit()` makes the next audit throw, to prove that a mutation and its audit commit or fail together.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql } from 'drizzle-orm'
import { RUNTIME_ROLE, SYSTEM_ROLE, type AuditRecord } from './native-route-harness'
import assert from 'node:assert/strict'
import { nativeActionUrl, installNativeBusinessContext, withNativeCanonicalActor } from '../../scripts/runtime/native-canonical-fixture'
import type { AuthenticatedOrgBinding } from '../../../../packages/platform-auth/src/org-binding'
import { requireLiveCanonicalMembership, seedDeclaredCanonicalActor } from './native-declared-actor'

export { RUNTIME_ROLE, SYSTEM_ROLE }
export type { AuditRecord }

type Db = ReturnType<typeof drizzle>

interface Scope {
  pending: AuditRecord[]
  tx: Db
}

const scopes = new AsyncLocalStorage<Scope>()
/** The authenticated caller of the request being handled, as production's auth() answers it inside a route. */
const callers = new AsyncLocalStorage<{ userId: string }>()
let pool: pg.Pool | null = null
let systemPool: pg.Pool | null = null
let runtimePool: pg.Pool | null = null
let ambient: Db | null = null
let schema: Record<string, unknown> | null = null
let auditFailure: Error | null = null
let operatorPool: pg.Pool | null = null
// ga-check:exempt test-harness state: operator seeds of declared actors, settled before any canonical session is opened.
let declarations: Promise<void> = Promise.resolve()
// ga-check:exempt test-harness state: the declared caller who opens an organization's pages (the authenticated user production's auth() answers).
const pageCallers = new Map<string, string>()

/**
 * The application's postgres-js driver returns the rows of a raw `execute` as an array; node-postgres returns `{ rows }`. A handle, and every transaction (a savepoint, when it is
 * opened on a transaction) opened on it, answers here as the application's driver does.
 */
function emulateDriver(handle: Db): Db {
  const execute = handle.execute.bind(handle)
  ;(handle as unknown as { execute: unknown }).execute = async (query: never) => (await execute(query)).rows
  const transaction = handle.transaction.bind(handle)
  ;(handle as unknown as { transaction: unknown }).transaction = (work: (tx: Db) => Promise<unknown>, config?: never) =>
    transaction((inner) => work(emulateDriver(inner as unknown as Db)), config)
  return handle
}

export const savepointHarness = {
  /** Every audit entry a committed context recorded, oldest first. */
  audits: [] as AuditRecord[],

  /** Opens the pools against an ADMIN connection to a disposable, fully bootstrapped database and returns the admin client for seeding and inspection. */
  async start(url: string): Promise<pg.Client> {
    schema = (await import('@/db/schema')) as unknown as Record<string, unknown>
    pool = new pg.Pool({ connectionString: nativeActionUrl(RUNTIME_ROLE, url), max: 4 })
    systemPool = new pg.Pool({ connectionString: nativeActionUrl(SYSTEM_ROLE, url), max: 4 })
    runtimePool = new pg.Pool({ connectionString: nativeActionUrl(RUNTIME_ROLE, url), max: 4, options: `-c role=${RUNTIME_ROLE}` })
    ambient = emulateDriver(drizzle(runtimePool, { schema: schema as never }))
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
   * Declares a fixture actor: the operator seeds its canonical user and active membership with the role (native-declared-actor.ts). The session
   * it acts through is still issued by the production auth gateway and re-read by the policies. Declare after the organization exists.
   */
  declare(userId: string, organizationId: string, role: string): Promise<void> {
    if (!operatorPool) throw new Error('savepoint harness not started: declare actors after start()')
    const operator = operatorPool
    declarations = declarations.then(() => seedDeclaredCanonicalActor(operator, userId, organizationId, role))
    const settled = declarations
    settled.catch(() => undefined)
    return settled
  },

  /**
   * Declares the authenticated user who opens the organization's pages: production's withRLSContext takes the actor from auth(), never from
   * the context map, so a service that passes only { organizationId } acts as this caller. An organization with no declared caller gets no
   * session, and the runtime role sees nothing of it.
   */
  declareCaller(userId: string, organizationId: string, role: string): Promise<void> {
    pageCallers.set(organizationId, userId)
    return savepointHarness.declare(userId, organizationId, role)
  },

  failNextAudit(error: Error = new Error('audit sink unavailable')): void {
    auditFailure = error
  },

  /** Runs a handled request of this authenticated caller: a withRLSContext that names no user acts as them (see contextModule). */
  asCaller<T>(userId: string | null | undefined, work: () => Promise<T>): Promise<T> {
    return userId ? callers.run({ userId }, work) : work()
  },

  /**
   * A page or route request of a live member, as production serves it in canonical mode: one live binding held for the request and the
   * canonical request scope established from it (lib/auth/canonical-context.ts withCanonicalApiContext), so in-request organization and role
   * reads (getOrganizationIdForUser, hasRoleInOrganization, ...) answer from the session. The member must have been declared.
   */
  async asCanonicalRequest<T>(userId: string, organizationId: string, work: () => Promise<T>): Promise<T> {
    await declarations
    if (!operatorPool) throw new Error('savepoint harness not started')
    await requireLiveCanonicalMembership(operatorPool, userId, organizationId)
    const [{ withCanonicalRequestScope }, { canonicalMembershipRole }] = await Promise.all([
      import('@/lib/auth/canonical-request-scope'), import('@/lib/auth/canonical-membership-role')])
    return withNativeCanonicalActor(userId, organizationId, (binding) => withCanonicalRequestScope(binding, {
      userId: binding.userId, organizationId: binding.organizationId, role: canonicalMembershipRole(binding.role, binding.isSystemAdmin),
      email: `${binding.userId}@example.test`, firstName: null, lastName: null, isSystemAdmin: binding.isSystemAdmin,
    }, work))
  },

  /** One context: the role, the organization and the user the policies read, in a transaction whose nested transactions are savepoints. */
  async context<T>(role: string, organizationId: string | null, userId: string | null, work: (tx: Db) => Promise<T>): Promise<T> {
    assert.ok(role === RUNTIME_ROLE || role === SYSTEM_ROLE, 'Native action role must be declared')
    const selectedPool = role === SYSTEM_ROLE ? systemPool : pool
    if (!selectedPool || !schema) throw new Error('savepoint harness not started')
    await declarations
    const execute = async (binding?: AuthenticatedOrgBinding) => {
      const client = await selectedPool.connect()
      const scope: Scope = { pending: [], tx: null as unknown as Db }
      try {
        const result = await drizzle(client, { schema: schema as never }).transaction(async (tx) => {
          await tx.execute(sql.raw(`SET LOCAL ROLE ${role}`))
          await tx.execute(sql`SET LOCAL search_path=pg_catalog,public,pg_temp`)
          await tx.execute(sql`SELECT set_config('app.current_user_id', ${userId ?? ''}, true)`)
          await tx.execute(sql`SELECT set_config('app.current_org_id', ${organizationId ?? ''}, true)`)
          if (binding) await installNativeBusinessContext((statement) => tx.execute(statement), binding)
          scope.tx = emulateDriver(tx as unknown as Db)
          return scopes.run(scope, () => work(scope.tx))
        })
        savepointHarness.audits.push(...scope.pending)
        return result
      } finally {
        client.release()
      }
    }
    // A tenant context of an organization with no named user acts as that organization's declared page caller, if it has one.
    const actor = userId ?? (role === RUNTIME_ROLE && organizationId ? pageCallers.get(organizationId) ?? null : null)
    return role === RUNTIME_ROLE && actor && organizationId
      ? withNativeCanonicalActor(actor, organizationId, execute)
      : execute()
  },
}

export const ambientDb = new Proxy({}, {
  get(_target, property) {
    const store = (scopes.getStore()?.tx ?? ambient) as unknown as Record<PropertyKey, unknown> | null
    if (!store) throw new Error('savepoint harness not started')
    const value = store[property]
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(store) : value
  },
})

export const contextModule = {
  withSystemContext: <T>(work: (tx: Db) => Promise<T>) => savepointHarness.context(SYSTEM_ROLE, null, null, work),
  withRLSContext: <T>(context: { organizationId: string; userId?: string }, work: (tx: Db) => Promise<T>) =>
    savepointHarness.context(RUNTIME_ROLE, context.organizationId,
      context.userId ?? callers.getStore()?.userId ?? pageCallers.get(context.organizationId) ?? null, work),
  /** The runtime role as one named user (and organization): what a claimant of a workbook, a person with no organization, acts as. */
  withExplicitUserContext: <T>(userId: string, work: () => Promise<T>, organizationId?: string) =>
    savepointHarness.context(RUNTIME_ROLE, organizationId ?? null, userId, () => work()),
}

export async function recordAudit(_tx: unknown, entry: AuditRecord): Promise<void> {
  if (auditFailure) {
    const failure = auditFailure
    auditFailure = null
    throw failure
  }
  const scope = scopes.getStore()
  if (!scope) throw new Error('an audit was written outside a transaction')
  scope.pending.push(entry)
}
