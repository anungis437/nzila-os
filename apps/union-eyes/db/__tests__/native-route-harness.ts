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

export type RouteDb = ReturnType<typeof drizzle>

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

let pool: pg.Pool | null = null
let runtimePool: pg.Pool | null = null
let ambient: RouteDb | null = null
let schema: Record<string, unknown> | null = null
let auditFailure: Error | null = null
// ga-check:exempt test-harness state: one process per native test file, holding the roles a test assigned to its own callers.
const roles = new Map<string, string>()

export const harness = {
  /** Every audit entry a committed tenant transaction recorded, oldest first. */
  audits: [] as AuditRecord[],

  /** The options each wrapped route declared, in the order the routes were loaded, so a test can state what a route asks of the wrapper. */
  configs: [] as EmulatedConfig[],

  /** Opens the pools against an ADMIN connection to a disposable, fully bootstrapped database and returns the admin client for seeding and inspection. */
  async start(url: string): Promise<pg.Client> {
    schema = (await import('@/db/schema')) as unknown as Record<string, unknown>
    pool = new pg.Pool({ connectionString: url, max: 4 })
    // The handle a service reads with outside a tenant transaction is the runtime role, which row-level security applies to.
    runtimePool = new pg.Pool({ connectionString: url, max: 4, options: `-c role=${RUNTIME_ROLE}` })
    ambient = drizzle(runtimePool, { schema: schema as never })
    const admin = new pg.Client({ connectionString: url })
    await admin.connect()
    return admin
  },

  async stop(): Promise<void> {
    await pool?.end()
    await runtimePool?.end()
    pool = null
    runtimePool = null
    ambient = null
  },

  /** The role a caller holds in an organization, as the membership lookup the CRUD factory consults would return it. */
  setRole(userId: string, organizationId: string, role: string): void {
    roles.set(`${userId}|${organizationId}`, role)
  },

  failNextAudit(error: Error = new Error('audit sink unavailable')): void {
    auditFailure = error
  },

  async tenant<T>(role: string, organizationId: string | null, userId: string | null, work: (tx: RouteDb) => Promise<T>): Promise<T> {
    if (!pool || !schema) throw new Error('route harness not started')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(`SET LOCAL ROLE ${role}`)
      await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [userId ?? ''])
      await client.query(`SELECT set_config('app.current_org_id', $1, true)`, [organizationId ?? ''])
      const db = drizzle(client, { schema: schema as never })
      const scope: Scope = { db, pendingAudits: [] }
      const result = await scopes.run(scope, () => work(db))
      await client.query('COMMIT')
      harness.audits.push(...scope.pendingAudits)
      return result
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    } finally {
      client.release()
    }
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
  withRLSContext: <T>(context: { organizationId: string; userId?: string }, work: (tx: RouteDb) => Promise<T>) =>
    harness.tenant(RUNTIME_ROLE, context.organizationId, context.userId ?? null, work),
}

export async function recordAudit(_tx: unknown, entry: AuditRecord): Promise<void> {
  if (auditFailure) {
    const failure = auditFailure
    auditFailure = null
    throw failure
  }
  const scope = scopes.getStore()
  if (!scope) throw new Error('an audit was written outside a transaction')
  scope.pendingAudits.push(entry)
}

export async function roleInOrganization(userId: string, organizationId: string): Promise<string | null> {
  return roles.get(`${userId}|${organizationId}`) ?? null
}

interface EmulatedConfig {
  auth?: { required?: boolean; minRole?: string }
  rlsOrgContext?: boolean
  openapi?: { summary?: string }
}

type Context = { organizationId?: string | null; userId?: string | null; role?: string; [key: string]: unknown }

/**
 * The wrapper's observable contract for a handler: the role floor, then a tenant transaction for a route that asks for one.
 * The role table is read when the first request arrives, not when this module loads: the harness is imported from vi.mock factories, and a static
 * import of the auth guard from here would wait on the very mocks that are waiting on this module.
 */
export function emulatedWithApi(config: EmulatedConfig, handler: (ctx: Context) => Promise<unknown>) {
  harness.configs.push(config)
  return async (ctx: Context) => {
    const required = config.auth?.minRole
    const held = ctx.role ?? (ctx.userId && ctx.organizationId ? roles.get(`${ctx.userId}|${ctx.organizationId}`) : undefined)
    if (required) {
      const { ROLE_HIERARCHY } = await import('@/lib/api-auth-guard')
      const level = (name: string | undefined) => (name ? (ROLE_HIERARCHY as Record<string, number>)[name] ?? 0 : 0)
      if (level(held) < level(required)) {
        const { ApiError } = await import('@/lib/api/errors')
        throw ApiError.forbidden()
      }
    }
    if (config.rlsOrgContext && ctx.organizationId && !scopes.getStore()) {
      return harness.tenant(RUNTIME_ROLE, ctx.organizationId, ctx.userId ?? null, () => handler(ctx))
    }
    return handler(ctx)
  }
}
