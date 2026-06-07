/**
 * Nzila OS — Scoped Database Access Layer (Scoped DAL)
 *
 * Provides Org-isolated database access.
 * Every query executed through a ScopedDb is automatically filtered
 * to the given orgId — making cross-Org data access
 * structurally impossible.
 *
 * Two API surfaces:
 *   - createScopedDb({ orgId })          → READ-ONLY by default
 *   - createAuditedScopedDb(...)         → write-enabled, auto-audited (see audit.ts)
 *
 * Legacy string-form createScopedDb(orgId) is preserved for backward
 * compatibility but returns full CRUD and is deprecated.
 *
 * Usage:
 *   import { createScopedDb } from '@nzila/db/scoped'
 *
 *   const db = createScopedDb({ orgId: ctx.orgId })
 *   const meetings = await db.select(tables.meetings)
 *   // → automatically WHERE org_id = orgId
 *
 * @module @nzila/db/scoped
 */
import { db, type Database } from './client'
import { eq, and, type SQL, type InferSelectModel, type SQLWrapper } from 'drizzle-orm'
import type { PgTable, TableConfig } from 'drizzle-orm/pg-core'

// ── Types ─────────────────────────────────────────────────────────────────

/**
 * Options for creating an Org-scoped database.
 */
export interface ScopedDbOptions {
  /** The Org (entity) identifier to scope all queries to. */
  orgId: string
  /** Optional correlation ID for request tracing. */
  correlationId?: string
  /** Optional actor ID for logging context (not enforced on reads). */
  actorId?: string
}

/**
 * Read-only Org-scoped database surface.
 *
 * Returned by createScopedDb({ orgId }). Cannot perform writes.
 * To write, use createAuditedScopedDb() from @nzila/db/audit.
 */
export interface ReadOnlyScopedDb {
  /**
   * The orgId this scoped DB is bound to.
   * Exposed for audit and logging — never mutable.
   */
  readonly orgId: string

  /** Optional correlation ID for this scope. */
  readonly correlationId?: string

  /**
   * SELECT from a table, auto-scoped to orgId.
   * Throws if the table lacks an `org_id` column.
   */
  select<T extends PgTable<TableConfig>>(
    table: T,
    extraWhere?: SQL,
  ): Promise<InferSelectModel<T>[]>

  /**
   * Transaction with read-only access inside Org scope.
   */
  transaction<TResult>(
    fn: (tx: ReadOnlyScopedDb) => Promise<TResult>,
  ): Promise<TResult>
}

/**
 * Full CRUD Org-scoped database surface.
 * Extends ReadOnlyScopedDb with write operations.
 *
 * @internal — App code should use ReadOnlyScopedDb (read-only) or AuditedScopedDb (audited writes).
 * This type exists for the platform layer (os-core, db internals) and backward compatibility.
 */
export interface ScopedDb extends ReadOnlyScopedDb {
  /**
   * INSERT into a table, auto-injecting orgId into every row.
   * Throws if the table lacks an `org_id` column.
   */
  insert<T extends PgTable<TableConfig>>(
    table: T,
    values: Record<string, unknown> | Record<string, unknown>[],
  ): ReturnType<Database['insert']>

  /**
   * UPDATE a table, auto-scoped to orgId.
   * Throws if the table lacks an `org_id` column.
   */
  update<T extends PgTable<TableConfig>>(
    table: T,
    values: Record<string, unknown>,
    extraWhere?: SQL,
  ): ReturnType<Database['update']>

  /**
   * DELETE from a table, auto-scoped to orgId.
   * Throws if the table lacks an `org_id` column.
   */
  delete<T extends PgTable<TableConfig>>(
    table: T,
    extraWhere?: SQL,
  ): ReturnType<Database['delete']>

  /**
   * Transaction with full CRUD inside Org scope.
   */
  transaction<TResult>(
    fn: (tx: ScopedDb) => Promise<TResult>,
  ): Promise<TResult>
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Resolves the `org_id` column from a Drizzle table definition.
 * Throws with an explicit error if the column does not exist —
 * this is a structural enforcement, not a soft warning.
 */
function getOrgIdColumn(table: PgTable<TableConfig>): SQLWrapper {
  const tableColumns = table as unknown as Record<string, unknown>
  // Drizzle exposes columns as direct properties on the table object
  const col = tableColumns['orgId'] ?? tableColumns['org_id']
  if (!col) {
    const tableRecord = table as unknown as Record<PropertyKey, unknown>
    const tableName =
      tableRecord[Symbol.for('drizzle:Name')] ??
      ((tableRecord['_'] as { name?: string } | undefined)?.name) ??
      Object.getOwnPropertySymbols(table)
        .map((s) => tableRecord[s])
        .find((v) => typeof v === 'string') ??
      'unknown'
    throw new ScopedDbError(
      `Table "${tableName}" does not have an org_id column. ` +
        'All tables accessed via ScopedDb must include org_id for Org isolation. ' +
        'Use rawDb (from @nzila/db/raw) only in the OS platform layer for unscoped tables.',
    )
  }
  return col as SQLWrapper
}

// ── Error classes ──────────────────────────────────────────────────────────

export class ScopedDbError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ScopedDbError'
  }
}

/**
 * Thrown when a read-only scoped DB attempts a write operation.
 * This is a structural enforcement — writes MUST go through
 * createAuditedScopedDb() to ensure automatic audit trails.
 */
export class ReadOnlyViolationError extends ScopedDbError {
  constructor(operation: string) {
    super(
      `[SECURITY] Write operation "${operation}" blocked on read-only ScopedDb. ` +
        'All writes MUST use createAuditedScopedDb() which automatically records audit events. ' +
        'See docs/architecture/ORG_SCOPED_TABLES.md.',
    )
    this.name = 'ReadOnlyViolationError'
  }
}

// ── Factory: Read-Only (default — object form) ────────────────────────────

/**
 * Create an Org-scoped database access layer.
 *
 * **Object form** (recommended):
 *   Returns a ReadOnlyScopedDb. Writes are structurally blocked.
 *   Use createAuditedScopedDb() for writes.
 *
 * **String form** (deprecated / backward compat):
 *   Returns a full CRUD ScopedDb. Preserved for existing code.
 *
 * @example
 * ```ts
 * const db = createScopedDb({ orgId: ctx.orgId })
 * const meetings = await db.select(tables.meetings)
 * ```
 */
export function createScopedDb(opts: ScopedDbOptions): ReadOnlyScopedDb
/** @deprecated Use object form: createScopedDb({ orgId }) */
export function createScopedDb(orgId: string): ScopedDb
/** @internal */
export function createScopedDb(orgId: string, txClient: unknown): ScopedDb
export function createScopedDb(
  optsOrOrgId: ScopedDbOptions | string,
  txClient?: unknown,
): ReadOnlyScopedDb | ScopedDb {
  // ── Guard: null/undefined always throws ScopedDbError ─────────────────
  if (optsOrOrgId === null || optsOrOrgId === undefined) {
    throw new ScopedDbError(
      'createScopedDb() requires a non-empty orgId or ScopedDbOptions. ' +
        'Org isolation cannot be guaranteed without a valid Org scope.',
    )
  }

  // ── Backward compat: string form returns full ScopedDb (deprecated) ────
  if (typeof optsOrOrgId === 'string') {
    return createFullScopedDb(optsOrOrgId, txClient)
  }

  // ── Object form: returns read-only surface ─────────────────────────────
  const { orgId, correlationId } = optsOrOrgId

  if (!orgId || typeof orgId !== 'string') {
    throw new ScopedDbError(
      'createScopedDb() requires a non-empty orgId string. ' +
        'Org isolation cannot be guaranteed without a valid Org scope.',
    )
  }

  const client = txClient ?? db

  function scopedSelect<T extends PgTable<TableConfig>>(c: unknown, table: T, extraWhere?: SQL): Promise<InferSelectModel<T>[]> {
    const orgCol = getOrgIdColumn(table)
    const orgFilter = eq(orgCol, orgId)
    const where = extraWhere ? and(orgFilter, extraWhere) : orgFilter
    const queryClient = c as {
      select: () => {
        from: (tbl: T) => { where: (clause: unknown) => Promise<InferSelectModel<T>[]> }
      }
    }
    return queryClient.select().from(table).where(where)
  }

  const readOnlyDb: ReadOnlyScopedDb = {
    orgId,
    correlationId,

    select(table, extraWhere) {
      return scopedSelect(client, table, extraWhere)
    },

    async transaction<TResult>(fn: (tx: ReadOnlyScopedDb) => Promise<TResult>): Promise<TResult> {
      const txClient = client as unknown as { transaction: <R>(cb: (tx: unknown) => Promise<R>) => Promise<R> }
      return txClient.transaction(async (tx: unknown) => {
        const txReadOnly: ReadOnlyScopedDb = {
          orgId,
          correlationId,
          select(table, extraWhere) {
            return scopedSelect(tx, table, extraWhere)
          },
          async transaction<R>(innerFn: (innerTx: ReadOnlyScopedDb) => Promise<R>): Promise<R> {
            const nestedClient = tx as { transaction: <X>(cb: (nested: unknown) => Promise<X>) => Promise<X> }
            return nestedClient.transaction(async (nested: unknown) => {
              const nestedReadOnly: ReadOnlyScopedDb = {
                orgId,
                correlationId,
                select(t, ew) { return scopedSelect(nested, t, ew) },
                transaction: () => { throw new ScopedDbError('Nested transactions beyond 2 levels not supported') },
              }
              return innerFn(nestedReadOnly)
            })
          },
        }
        return fn(txReadOnly)
      })
    },
  }

  return readOnlyDb
}

// ── Factory: Full CRUD (internal / backward compat) ───────────────────────

/**
 * Create a full CRUD Org-scoped database. Internal — used by:
 * - Backward-compatible string-form createScopedDb(orgId)
 * - createAuditedScopedDb() in audit.ts (wraps this with audit middleware)
 *
 * @internal
 */
export function createFullScopedDb(orgId: string, txClient?: unknown): ScopedDb {
  if (!orgId || typeof orgId !== 'string') {
    throw new ScopedDbError(
      'createScopedDb() requires a non-empty orgId string. ' +
        'Org isolation cannot be guaranteed without a valid Org scope.',
    )
  }

  const client = txClient ?? db

  const scopedDb: ScopedDb = {
    orgId,
    correlationId: undefined,

    select(table, extraWhere) {
      const orgCol = getOrgIdColumn(table)
      const orgFilter = eq(orgCol, orgId)
      const where = extraWhere ? and(orgFilter, extraWhere) : orgFilter
      const queryClient = client as unknown as {
        select: () => { from: (tbl: PgTable<TableConfig>) => { where: (clause: unknown) => unknown } }
      }
      return queryClient.select().from(table).where(where) as Promise<InferSelectModel<typeof table>[]>
    },

    insert(table, values) {
      const _orgCol = getOrgIdColumn(table) // validate column exists
      const rows = Array.isArray(values) ? values : [values]
      const injected = rows.map((row) => ({
        ...row,
        orgId: orgId, // force orgId on every row
      }))
      const toInsert = injected.length === 1 ? injected[0] : injected
      const queryClient = client as unknown as {
        insert: (tbl: PgTable<TableConfig>) => { values: (rows: unknown) => ReturnType<Database['insert']> }
      }
      return queryClient.insert(table).values(toInsert)
    },

    update(table, values, extraWhere) {
      const orgCol = getOrgIdColumn(table)
      const orgFilter = eq(orgCol, orgId)
      const where = extraWhere ? and(orgFilter, extraWhere) : orgFilter
      const queryClient = client as unknown as {
        update: (tbl: PgTable<TableConfig>) => { set: (v: Record<string, unknown>) => { where: (clause: unknown) => ReturnType<Database['update']> } }
      }
      return queryClient.update(table).set(values).where(where)
    },

    delete(table, extraWhere) {
      const orgCol = getOrgIdColumn(table)
      const orgFilter = eq(orgCol, orgId)
      const where = extraWhere ? and(orgFilter, extraWhere) : orgFilter
      const queryClient = client as unknown as {
        delete: (tbl: PgTable<TableConfig>) => { where: (clause: unknown) => ReturnType<Database['delete']> }
      }
      return queryClient.delete(table).where(where)
    },

    async transaction<TResult>(fn: (tx: ScopedDb) => Promise<TResult>): Promise<TResult> {
      const txClient = client as unknown as { transaction: <R>(cb: (tx: unknown) => Promise<R>) => Promise<R> }
      return txClient.transaction(async (tx: unknown) => {
        const txScopedDb = createFullScopedDb(orgId, tx)
        return fn(txScopedDb)
      })
    },
  }

  return scopedDb
}
