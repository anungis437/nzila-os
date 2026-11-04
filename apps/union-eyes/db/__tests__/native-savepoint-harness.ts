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

export { RUNTIME_ROLE, SYSTEM_ROLE }
export type { AuditRecord }

type Db = ReturnType<typeof drizzle>

interface Scope {
  pending: AuditRecord[]
  tx: Db
}

const scopes = new AsyncLocalStorage<Scope>()
let pool: pg.Pool | null = null
let runtimePool: pg.Pool | null = null
let ambient: Db | null = null
let schema: Record<string, unknown> | null = null
let auditFailure: Error | null = null

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
    pool = new pg.Pool({ connectionString: url, max: 4 })
    runtimePool = new pg.Pool({ connectionString: url, max: 4, options: `-c role=${RUNTIME_ROLE}` })
    ambient = emulateDriver(drizzle(runtimePool, { schema: schema as never }))
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

  failNextAudit(error: Error = new Error('audit sink unavailable')): void {
    auditFailure = error
  },

  /** One context: the role, the organization and the user the policies read, in a transaction whose nested transactions are savepoints. */
  async context<T>(role: string, organizationId: string | null, userId: string | null, work: (tx: Db) => Promise<T>): Promise<T> {
    if (!pool || !schema) throw new Error('savepoint harness not started')
    const client = await pool.connect()
    const scope: Scope = { pending: [], tx: null as unknown as Db }
    try {
      const result = await drizzle(client, { schema: schema as never }).transaction(async (tx) => {
        await tx.execute(sql.raw(`SET LOCAL ROLE ${role}`))
        await tx.execute(sql`SELECT set_config('app.current_user_id', ${userId ?? ''}, true)`)
        await tx.execute(sql`SELECT set_config('app.current_org_id', ${organizationId ?? ''}, true)`)
        scope.tx = emulateDriver(tx as unknown as Db)
        return scopes.run(scope, () => work(scope.tx))
      })
      savepointHarness.audits.push(...scope.pending)
      return result
    } finally {
      client.release()
    }
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
    savepointHarness.context(RUNTIME_ROLE, context.organizationId, context.userId ?? null, work),
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
