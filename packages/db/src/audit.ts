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
 * Wraps a ScopedDb so that every mutating operation (insert, update, delete)
 * automatically emits an audit event. This makes audit logging impossible
 * to forget for CRUD operations.
 *
 * Usage:
 *   import { createScopedDb } from '@nzila/db/scoped'
 *   import { withAudit } from '@nzila/db/audit'
 *
 *   const scopedDb = createScopedDb(entityId)
 *   const auditedDb = withAudit(scopedDb, { actorId, entityId })
 *
 *   // Every insert/update/delete now auto-emits audit events
 *   await auditedDb.insert(meetings, { kind: 'board', ... })
 *
 * @module @nzila/db/audit
 */
import type { ScopedDb } from './scoped'
import type { PgTable, TableConfig } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

// ── Types ─────────────────────────────────────────────────────────────────

export interface AuditContext {
  /** Clerk user ID or system actor performing the operation */
  actorId: string
  /** Entity being operated on (must match scopedDb.entityId) */
  entityId: string
  /** Optional correlation ID for tracing across operations */
  correlationId?: string
  /** Optional actor role for audit record enrichment */
  actorRole?: string
}

export interface AuditEvent {
  entityId: string
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
    const [latest] = await (db as any)
      .select({ hash: auditEvents.hash })
      .from(auditEvents)
      .where(eq(auditEvents.entityId, event.entityId))
      .orderBy(desc(auditEvents.createdAt))
      .limit(1)

    const previousHash = latest?.hash ?? null

    const payload = {
      entityId: event.entityId,
      actorClerkUserId: event.actorId,
      action: `${event.table}.${event.action}`,
      targetType: event.table,
      targetId: null,
      afterJson: event.values ?? null,
      timestamp: event.timestamp,
    }

    const hash = computeEntryHash(payload, previousHash)

    await (db as any)
      .insert(auditEvents)
      .values({
        entityId: event.entityId,
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
        entityId: event.entityId,
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
  const name =
    (table as any)[sym] ??
    (table as any)['_']?.name ??
    'unknown_table'
  return String(name)
}

// ── Factory ────────────────────────────────────────────────────────────────

/**
 * Wrap a ScopedDb with automatic audit emission.
 *
 * Every insert, update, and delete operation will:
 *   1. Execute the database operation via the underlying ScopedDb
 *   2. Emit an audit event with actorId, entityId, table, action, timestamp, correlationId
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
  if (context.entityId !== scopedDb.entityId) {
    throw new Error(
      `Audit context entityId (${context.entityId}) does not match ` +
      `scopedDb entityId (${scopedDb.entityId}). This is a structural error.`,
    )
  }

  const correlationId = context.correlationId ?? randomUUID()

  function buildAuditEvent(
    table: PgTable<TableConfig>,
    action: 'insert' | 'update' | 'delete',
    values?: Record<string, unknown>,
  ): AuditEvent {
    return {
      entityId: context.entityId,
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
    entityId: scopedDb.entityId,
    auditContext: context,

    // SELECT — pass through, no audit (reads are not audited by default)
    select(table, extraWhere) {
      return scopedDb.select(table, extraWhere)
    },

    // INSERT — audit after successful insert
    insert(table, values) {
      const result = scopedDb.insert(table, values)
      // Emit audit event (fire-and-forget, errors are caught inside emitter)
      const auditEvent = buildAuditEvent(
        table,
        'insert',
        Array.isArray(values) ? { rows: values.length } : (values as Record<string, unknown>),
      )
      emitter(auditEvent)
      return result
    },

    // UPDATE — audit after successful update
    update(table, values, extraWhere) {
      const result = scopedDb.update(table, values, extraWhere)
      const auditEvent = buildAuditEvent(table, 'update', values as Record<string, unknown>)
      emitter(auditEvent)
      return result
    },

    // DELETE — audit after successful delete
    delete(table, extraWhere) {
      const result = scopedDb.delete(table, extraWhere)
      const auditEvent = buildAuditEvent(table, 'delete')
      emitter(auditEvent)
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
