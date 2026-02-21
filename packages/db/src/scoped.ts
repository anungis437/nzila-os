/**
 * Nzila OS — Scoped Database Access Layer (Scoped DAL)
 *
 * Provides entity-isolated database access.
 * Every query executed through a ScopedDb is automatically filtered
 * to the given entityId — making cross-entity data access
 * structurally impossible.
 *
 * Usage:
 *   import { createScopedDb } from '@nzila/db/scoped'
 *
 *   const scopedDb = createScopedDb(entityId)
 *   const meetings = await scopedDb.select(tables.meetings)
 *   // → automatically WHERE entity_id = entityId
 *
 * @module @nzila/db/scoped
 */
import { db, type Database } from './client'
import { eq, and, type SQL } from 'drizzle-orm'
import type { PgTable, TableConfig } from 'drizzle-orm/pg-core'

// ── Types ─────────────────────────────────────────────────────────────────

export interface ScopedDb {
  /**
   * The entityId this scoped DB is bound to.
   * Exposed for audit and logging — never mutable.
   */
  readonly entityId: string

  /**
   * SELECT from a table, auto-scoped to entityId.
   * Throws if the table lacks an `entity_id` column.
   */
  select<T extends PgTable<TableConfig>>(
    table: T,
    extraWhere?: SQL,
  ): ReturnType<Database['select']>

  /**
   * INSERT into a table, auto-injecting entityId into every row.
   * Throws if the table lacks an `entity_id` column.
   */
  insert<T extends PgTable<TableConfig>>(
    table: T,
    values: Record<string, unknown> | Record<string, unknown>[],
  ): ReturnType<Database['insert']>

  /**
   * UPDATE a table, auto-scoped to entityId.
   * Throws if the table lacks an `entity_id` column.
   */
  update<T extends PgTable<TableConfig>>(
    table: T,
    values: Record<string, unknown>,
    extraWhere?: SQL,
  ): ReturnType<Database['update']>

  /**
   * DELETE from a table, auto-scoped to entityId.
   * Throws if the table lacks an `entity_id` column.
   */
  delete<T extends PgTable<TableConfig>>(
    table: T,
    extraWhere?: SQL,
  ): ReturnType<Database['delete']>

  /**
   * Access to the underlying raw database for transaction support.
   * The transaction callback receives this same ScopedDb interface
   * so entity isolation is maintained inside transactions.
   */
  transaction<TResult>(
    fn: (tx: ScopedDb) => Promise<TResult>,
  ): Promise<TResult>
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Resolves the `entity_id` column from a Drizzle table definition.
 * Throws with an explicit error if the column does not exist —
 * this is a structural enforcement, not a soft warning.
 */
function getEntityIdColumn(table: PgTable<TableConfig>): any {
  const tableColumns = (table as any)
  // Drizzle exposes columns as direct properties on the table object
  const col = tableColumns['entityId'] ?? tableColumns['entity_id']
  if (!col) {
    const tableName =
      (table as any)[Symbol.for('drizzle:Name')] ??
      (table as any)['_'] ?.name ??
      Object.getOwnPropertySymbols(table)
        .map((s) => (table as any)[s])
        .find((v) => typeof v === 'string') ??
      'unknown'
    throw new ScopedDbError(
      `Table "${tableName}" does not have an entity_id column. ` +
        'All tables accessed via ScopedDb must include entity_id for entity isolation. ' +
        'Use rawDb (from @nzila/db/raw) only in the OS platform layer for unscoped tables.',
    )
  }
  return col
}

// ── Error class ────────────────────────────────────────────────────────────

export class ScopedDbError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ScopedDbError'
  }
}

// ── Factory ────────────────────────────────────────────────────────────────

/**
 * Create an entity-scoped database access layer.
 *
 * @param entityId — The UUID of the entity to scope all queries to.
 *   Must be a non-empty string. Throws immediately if missing.
 *
 * @returns A ScopedDb instance that enforces entity isolation on every operation.
 *
 * @example
 * ```ts
 * const scopedDb = createScopedDb(ctx.entityId)
 * const meetings = await scopedDb.select(tables.meetings)
 * ```
 */
export function createScopedDb(entityId: string): ScopedDb
export function createScopedDb(entityId: string, txClient?: any): ScopedDb
export function createScopedDb(entityId: string, txClient?: any): ScopedDb {
  // ── Fail fast on missing entityId ──────────────────────────────────────
  if (!entityId || typeof entityId !== 'string') {
    throw new ScopedDbError(
      'createScopedDb() requires a non-empty entityId string. ' +
        'Entity isolation cannot be guaranteed without a valid entity scope.',
    )
  }

  const client: Database = txClient ?? db

  const scopedDb: ScopedDb = {
    entityId,

    select(table, extraWhere) {
      const entityCol = getEntityIdColumn(table)
      const entityFilter = eq(entityCol, entityId)
      const where = extraWhere ? and(entityFilter, extraWhere) : entityFilter
      return (client as any).select().from(table).where(where)
    },

    insert(table, values) {
      const _entityCol = getEntityIdColumn(table) // validate column exists
      const rows = Array.isArray(values) ? values : [values]
      const injected = rows.map((row) => ({
        ...row,
        entityId, // force entityId on every row
      }))
      const toInsert = injected.length === 1 ? injected[0] : injected
      return (client as any).insert(table).values(toInsert)
    },

    update(table, values, extraWhere) {
      const entityCol = getEntityIdColumn(table)
      const entityFilter = eq(entityCol, entityId)
      const where = extraWhere ? and(entityFilter, extraWhere) : entityFilter
      return (client as any).update(table).set(values).where(where)
    },

    delete(table, extraWhere) {
      const entityCol = getEntityIdColumn(table)
      const entityFilter = eq(entityCol, entityId)
      const where = extraWhere ? and(entityFilter, extraWhere) : entityFilter
      return (client as any).delete(table).where(where)
    },

    async transaction<TResult>(fn: (tx: ScopedDb) => Promise<TResult>): Promise<TResult> {
      return (client as any).transaction(async (tx: any) => {
        const txScopedDb = createScopedDb(entityId, tx)
        return fn(txScopedDb)
      })
    },
  }

  return scopedDb
}
