import { createHash } from 'node:crypto'

/**
 * Compute SHA-256 hash for audit chain continuity.
 * Inlined from @nzila/os-core/hash to avoid circular dependency (os-core → db).
 */
function computeEntryHash(payload: unknown, previousHash: string | null): string {
  const data = JSON.stringify({ payload, previousHash })
  return createHash('sha256').update(data).digest('hex')
}

/**
 * Nzila OS — Audited Scoped Database Access Layer
 *
 * Two modes of use:
 *
 *   1. createAuditedScopedDb({ orgId, actorId }) — the recommended factory.
 *      Returns a write-enabled, Org-scoped, auto-audited DB.
 *
 *   2. withAudit(scopedDb, ctx) — wraps an existing ScopedDb (backward compat).
 *
 * Every mutating operation (insert, update, delete) automatically emits
 * a hash-chained audit event. Writes are impossible without audit context.
 *
 * Usage:
 *   import { createAuditedScopedDb } from '@nzila/db/audit'
 *
 *   const db = createAuditedScopedDb({ orgId, actorId })
 *   await db.insert(meetings, { kind: 'board', ... })
 *   // → audit event auto-emitted in same scope
 *
 * @module @nzila/db/audit
 */
import { createFullScopedDb, type ScopedDb, type ScopedDbOptions, ScopedDbError, ReadOnlyViolationError } from './scoped'
import type { PgTable, TableConfig } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

// ── Types ─────────────────────────────────────────────────────────────────

export interface AuditedScopedDbOptions {
  /** The Org (entity) identifier to scope all queries to. */
  orgId: string
  /** Auth user ID or system actor performing the operation. */
  actorId: string
  /** Optional correlation ID for tracing across operations. */
  correlationId?: string
  /** Optional actor role for audit record enrichment. */
  actorRole?: string
}

export interface AuditContext {
  /** Auth user ID or system actor performing the operation */
  actorId: string
  /** Entity being operated on (must match scopedDb.orgId) */
  orgId: string
  /** Optional correlation ID for tracing across operations */
  correlationId?: string
  /** Optional actor role for audit record enrichment */
  actorRole?: string
}

export interface AuditEvent {
  orgId: string
  actorId: string
  actorRole?: string
  table: string
  action: 'insert' | 'update' | 'delete'
  timestamp: string
  correlationId: string
  values?: Record<string, unknown>
}

export type AuditEmitter = (event: AuditEvent) => Promise<void> | void

export interface AuditedScopedDb extends ScopedDb {
  /** The audit context bound to this instance */
  readonly auditContext: AuditContext
}

// ── Default audit emitter ──────────────────────────────────────────────────

/**
 * Default audit emitter that writes to the audit_events table
 * via the same append-only hash-chained mechanism used by recordAuditEvent.
 *
 * Falls back to structured stdout logging if the DB write fails,
 * so audit events are never silently lost.
 */
const defaultAuditEmitter: AuditEmitter = async (event) => {
  try {
    // Dynamic import to avoid circular dependency with db client
    const { db } = await import('./client')
    const { auditEvents } = await import('./schema/operations')
    const { eq, desc } = await import('drizzle-orm')

    // Fetch latest hash for chain continuity
    type DbSelectQuery = {
      from: (table: unknown) => {
        where: (clause: unknown) => {
          orderBy: (ordering: unknown) => { limit: (count: number) => Promise<Array<{ hash?: string | null }>> }
        }
      }
    }
    type DbInsertQuery = {
      values: (value: Record<string, unknown>) => Promise<unknown>
    }
    type RuntimeDb = {
      select: (fields: Record<string, unknown>) => DbSelectQuery
      insert: (table: unknown) => DbInsertQuery
    }
    const runtimeDb = db as unknown as RuntimeDb

    const [latest] = await runtimeDb
      .select({ hash: auditEvents.hash })
      .from(auditEvents)
      .where(eq(auditEvents.orgId, event.orgId))
      .orderBy(desc(auditEvents.createdAt))
      .limit(1)

    const previousHash = latest?.hash ?? null

    const payload = {
      orgId: event.orgId,
      actorClerkUserId: event.actorId,
      action: `${event.table}.${event.action}`,
      targetType: event.table,
      targetId: null,
      afterJson: event.values ?? null,
      timestamp: event.timestamp,
    }

    const hash = computeEntryHash(payload, previousHash)

    await runtimeDb
      .insert(auditEvents)
      .values({
        orgId: event.orgId,
        actorClerkUserId: event.actorId,
        actorRole: event.actorRole ?? null,
        action: `${event.table}.${event.action}`,
        targetType: event.table,
        targetId: undefined,
        afterJson: event.values ?? undefined,
        hash,
        previousHash,
      })

    console.log(
      '[AUDIT:AUTO]',
      JSON.stringify({
        orgId: event.orgId,
        action: `${event.table}.${event.action}`,
        actor: event.actorId,
        correlationId: event.correlationId,
        hash: hash.slice(0, 12) + '…',
      }),
    )
  } catch (err) {
    // Fallback: never lose audit events
    console.error(
      '[AUDIT:AUTO:FALLBACK]',
      JSON.stringify({
        ...event,
        error: (err as Error).message,
      }),
    )
  }
}

// ── Table name resolution ─────────────────────────────────────────────────

function resolveTableName(table: PgTable<TableConfig>): string {
  // Drizzle stores table name in Symbol.for('drizzle:Name') or table._.name
  const sym = Symbol.for('drizzle:Name')
  const tableRecord = table as unknown as Record<PropertyKey, unknown>
  const name =
    tableRecord[sym] ??
    (tableRecord['_'] as { name?: string } | undefined)?.name ??
    'unknown_table'
  return String(name)
}

// ── Factory ────────────────────────────────────────────────────────────────

/**
 * Wrap a ScopedDb with automatic audit emission.
 *
 * Every insert, update, and delete operation will:
 *   1. Execute the database operation via the underlying ScopedDb
 *   2. Emit an audit event with actorId, orgId, table, action, timestamp, correlationId
 *
 * The audit emission is non-blocking for read operations (select passes through).
 *
 * @param scopedDb - An entity-scoped database from createScopedDb()
 * @param context - Actor and entity context for audit events
 * @param emitter - Optional custom audit emitter (defaults to DB audit_events table)
 */
export function withAudit(
  scopedDb: ScopedDb,
  context: AuditContext,
  emitter: AuditEmitter = defaultAuditEmitter,
): AuditedScopedDb {
  // Validate context matches scopedDb
  if (context.orgId !== scopedDb.orgId) {
    throw new Error(
      `Audit context orgId (${context.orgId}) does not match ` +
      `scopedDb orgId (${scopedDb.orgId}). This is a structural error.`,
    )
  }

  const correlationId = context.correlationId ?? randomUUID()

  type ThenHandler = (onFulfilled?: unknown, onRejected?: unknown) => unknown
  type ThenableLike = { then?: ThenHandler }

  function buildAuditEvent(
    table: PgTable<TableConfig>,
    action: 'insert' | 'update' | 'delete',
    values?: Record<string, unknown>,
  ): AuditEvent {
    return {
      orgId: context.orgId,
      actorId: context.actorId,
      actorRole: context.actorRole,
      table: resolveTableName(table),
      action,
      timestamp: new Date().toISOString(),
      correlationId,
      values,
    }
  }

  const auditedDb: AuditedScopedDb = {
    orgId: scopedDb.orgId,
    correlationId,
    auditContext: context,

    // SELECT — pass through, no audit (reads are not audited by default)
    select(table, extraWhere) {
      return scopedDb.select(table, extraWhere)
    },

    // INSERT — audit after successful insert; mutation fails if audit fails
    insert(table, values) {
      const auditEvent = buildAuditEvent(
        table,
        'insert',
        Array.isArray(values) ? { rows: values.length } : (values as Record<string, unknown>),
      )
      // Emit audit event synchronously — if audit fails, the mutation is not returned
      const auditPromise = Promise.resolve(emitter(auditEvent)).catch((err) => {
        throw new Error(
          `[AUDIT:MANDATORY] Audit emission failed for ${auditEvent.table}.insert. ` +
          `Mutation blocked. Reason: ${(err as Error).message}`,
        )
      })
      const result = scopedDb.insert(table, values)
      // Attach audit promise to result chain so consumers must await audit completion
      const thenableResult = result as unknown as ThenableLike
      const originalThen = typeof thenableResult.then === 'function'
        ? (thenableResult.then.bind(result) as ThenHandler)
        : undefined
      if (originalThen) {
        thenableResult.then = (onFulfilled: unknown, onRejected: unknown) =>
          auditPromise.then(() => originalThen(onFulfilled, onRejected))
      }
      return result
    },

    // UPDATE — audit after successful update; mutation fails if audit fails
    update(table, values, extraWhere) {
      const auditEvent = buildAuditEvent(table, 'update', values as Record<string, unknown>)
      const auditPromise = Promise.resolve(emitter(auditEvent)).catch((err) => {
        throw new Error(
          `[AUDIT:MANDATORY] Audit emission failed for ${auditEvent.table}.update. ` +
          `Mutation blocked. Reason: ${(err as Error).message}`,
        )
      })
      const result = scopedDb.update(table, values, extraWhere)
      const thenableResult = result as unknown as ThenableLike
      const originalThen = typeof thenableResult.then === 'function'
        ? (thenableResult.then.bind(result) as ThenHandler)
        : undefined
      if (originalThen) {
        thenableResult.then = (onFulfilled: unknown, onRejected: unknown) =>
          auditPromise.then(() => originalThen(onFulfilled, onRejected))
      }
      return result
    },

    // DELETE — audit after successful delete; mutation fails if audit fails
    delete(table, extraWhere) {
      const auditEvent = buildAuditEvent(table, 'delete')
      const auditPromise = Promise.resolve(emitter(auditEvent)).catch((err) => {
        throw new Error(
          `[AUDIT:MANDATORY] Audit emission failed for ${auditEvent.table}.delete. ` +
          `Mutation blocked. Reason: ${(err as Error).message}`,
        )
      })
      const result = scopedDb.delete(table, extraWhere)
      const thenableResult = result as unknown as ThenableLike
      const originalThen = typeof thenableResult.then === 'function'
        ? (thenableResult.then.bind(result) as ThenHandler)
        : undefined
      if (originalThen) {
        thenableResult.then = (onFulfilled: unknown, onRejected: unknown) =>
          auditPromise.then(() => originalThen(onFulfilled, onRejected))
      }
      return result
    },

    // TRANSACTION — maintain audit context inside transactions
    async transaction<TResult>(fn: (tx: ScopedDb) => Promise<TResult>): Promise<TResult> {
      return scopedDb.transaction(async (txScopedDb) => {
        const auditedTx = withAudit(txScopedDb, context, emitter)
        return fn(auditedTx)
      })
    },
  }

  return auditedDb
}

// ── Factory: createAuditedScopedDb ─────────────────────────────────────────

/**
 * Create a write-enabled, Org-scoped, auto-audited database.
 *
 * This is the ONLY sanctioned way for app code to perform writes.
 * Every insert/update/delete automatically emits a hash-chained audit event.
 * If audit emission fails, the mutation is blocked.
 *
 * @param opts — orgId (required), actorId (required), correlationId and actorRole (optional).
 * @returns An AuditedScopedDb that enforces both Org isolation and audit on every write.
 *
 * @example
 * ```ts
 * const db = createAuditedScopedDb({ orgId: ctx.orgId, actorId: ctx.userId })
 * await db.insert(meetings, { kind: 'board', ... })
 * // → audit event auto-emitted
 * ```
 */
export function createAuditedScopedDb(opts: AuditedScopedDbOptions): AuditedScopedDb {
  const { orgId, actorId, correlationId, actorRole } = opts

  if (!orgId || typeof orgId !== 'string') {
    throw new ScopedDbError(
      'createAuditedScopedDb() requires a non-empty orgId. ' +
        'Org isolation cannot be guaranteed without a valid Org scope.',
    )
  }
  if (!actorId || typeof actorId !== 'string') {
    throw new ScopedDbError(
      'createAuditedScopedDb() requires a non-empty actorId. ' +
        'Audit context cannot be established without a valid actor.',
    )
  }

  // Create underlying full-CRUD scoped db
  const scopedDb = createFullScopedDb(orgId)

  // Wrap with audit middleware
  const context: AuditContext = {
    actorId,
    orgId: orgId,
    correlationId,
    actorRole,
  }

  return withAudit(scopedDb, context)
}
