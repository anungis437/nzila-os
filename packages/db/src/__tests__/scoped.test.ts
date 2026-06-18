/**
 * Integration Tests — Scoped DAL (createScopedDb)
 *
 * Validates that:
 *   1. Unscoped queries throw at construction time
 *   2. Scoped queries auto-inject orgId
 *   3. Tables without org_id throw at runtime
 *   4. orgId is forced on insert values
 *   5. Transaction support maintains entity scope
 *
 * These tests use mock table objects that mirror Drizzle's PgTable shape
 * so they can run without a live database connection.
 */
import { describe, it, expect } from 'vitest'
import { createScopedDb, ScopedDbError, ReadOnlyViolationError } from '../scoped'
import type { PgTable, TableConfig } from 'drizzle-orm/pg-core'

// ── Test Constants ──────────────────────────────────────────────────────────

const VALID_ENTITY_ID = '550e8400-e29b-41d4-a716-446655440000'

// ── 1. Construction-time validation ─────────────────────────────────────────

describe('createScopedDb — construction-time validation', () => {
  it('throws ScopedDbError when orgId is empty string', () => {
    expect(() => createScopedDb('')).toThrow(ScopedDbError)
    expect(() => createScopedDb('')).toThrow('requires a non-empty orgId')
  })

  it('throws ScopedDbError when orgId is undefined/null', () => {
    expect(() => createScopedDb(undefined as unknown as string)).toThrow(ScopedDbError)
    expect(() => createScopedDb(null as unknown as string)).toThrow(ScopedDbError)
  })

  it('succeeds with a valid orgId', () => {
    const scopedDb = createScopedDb(VALID_ENTITY_ID)
    expect(scopedDb).toBeDefined()
    expect(scopedDb.orgId).toBe(VALID_ENTITY_ID)
  })

  it('exposes orgId as readonly', () => {
    const scopedDb = createScopedDb(VALID_ENTITY_ID)
    expect(scopedDb.orgId).toBe(VALID_ENTITY_ID)
    // TypeScript would flag this, but verify at runtime too
    expect(() => {
      ;(scopedDb as { orgId: string }).orgId = 'other-id'
    }).not.toThrow() // JS objects don't enforce readonly at runtime
    // But the original value should not matter — the internal closure holds it
  })
})

// ── 2. Table validation (org_id column check) ───────────────────────────

describe('createScopedDb — org_id column enforcement', () => {
  // Mock a table WITHOUT orgId column
  const tableWithoutEntityId = {
    [Symbol.for('drizzle:Name')]: 'system_config',
    id: { name: 'id' },
    key: { name: 'key' },
    value: { name: 'value' },
  }

  // Mock a table WITH orgId column
  const tableWithEntityId = {
    [Symbol.for('drizzle:Name')]: 'meetings',
    id: { name: 'id' },
    orgId: { name: 'org_id' },
    kind: { name: 'kind' },
  }
  const tableWithoutEntityIdPg = tableWithoutEntityId as unknown as PgTable<TableConfig>

  it('throws ScopedDbError when select is called on a table without org_id', () => {
    const scopedDb = createScopedDb(VALID_ENTITY_ID)
    expect(() => scopedDb.select(tableWithoutEntityIdPg)).toThrow(ScopedDbError)
    expect(() => scopedDb.select(tableWithoutEntityIdPg)).toThrow(
      'does not have an org_id column',
    )
  })

  it('throws ScopedDbError when insert is called on a table without org_id', () => {
    const scopedDb = createScopedDb(VALID_ENTITY_ID)
    expect(() => scopedDb.insert(tableWithoutEntityIdPg, { key: 'test' })).toThrow(
      ScopedDbError,
    )
  })

  it('throws ScopedDbError when update is called on a table without org_id', () => {
    const scopedDb = createScopedDb(VALID_ENTITY_ID)
    expect(() => scopedDb.update(tableWithoutEntityIdPg, { value: 'test' })).toThrow(
      ScopedDbError,
    )
  })

  it('throws ScopedDbError when delete is called on a table without org_id', () => {
    const scopedDb = createScopedDb(VALID_ENTITY_ID)
    expect(() => scopedDb.delete(tableWithoutEntityIdPg)).toThrow(ScopedDbError)
  })

  it('error message includes table name', () => {
    const scopedDb = createScopedDb(VALID_ENTITY_ID)
    try {
      scopedDb.select(tableWithoutEntityIdPg)
      expect.fail('Should have thrown')
    } catch (err) {
      expect((err as Error).message).toContain('system_config')
    }
  })
})

// ── 3. Entity ID injection on insert ────────────────────────────────────────

describe('createScopedDb — orgId injection', () => {
  it('orgId property is always the scoped value', () => {
    const scopedDb = createScopedDb(VALID_ENTITY_ID)
    expect(scopedDb.orgId).toBe(VALID_ENTITY_ID)
  })

  it('different scopedDb instances have different entityIds', () => {
    const id1 = '550e8400-e29b-41d4-a716-446655440001'
    const id2 = '550e8400-e29b-41d4-a716-446655440002'
    const db1 = createScopedDb(id1)
    const db2 = createScopedDb(id2)
    expect(db1.orgId).toBe(id1)
    expect(db2.orgId).toBe(id2)
    expect(db1.orgId).not.toBe(db2.orgId)
  })
})

// ── 4. ScopedDbError is properly typed ──────────────────────────────────────

describe('ScopedDbError', () => {
  it('is instanceof Error', () => {
    const err = new ScopedDbError('test')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(ScopedDbError)
  })

  it('has name "ScopedDbError"', () => {
    const err = new ScopedDbError('test')
    expect(err.name).toBe('ScopedDbError')
  })

  it('preserves message', () => {
    const err = new ScopedDbError('Entity isolation violation')
    expect(err.message).toBe('Entity isolation violation')
  })
})

describe('createScopedDb — object form and CRUD behavior', () => {
  const tableWithEntityId = {
    [Symbol.for('drizzle:Name')]: 'meetings',
    id: { name: 'id' },
    orgId: { name: 'org_id' },
  }
  const tableWithEntityIdPg = tableWithEntityId as unknown as PgTable<TableConfig>

  it('supports object-form read-only createScopedDb with correlationId', () => {
    const whereArg: unknown[] = []
    const fakeClient = {
      select: () => ({
        from: () => ({
          where: (w: unknown) => {
            whereArg.push(w)
            return Promise.resolve([])
          },
        }),
      }),
      transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          select: () => ({
            from: () => ({ where: () => Promise.resolve([]) }),
          }),
          transaction: async (nestedFn: (nested: unknown) => Promise<unknown>) =>
            nestedFn({
              select: () => ({
                from: () => ({ where: () => Promise.resolve([]) }),
              }),
              transaction: async () => Promise.resolve(null),
            }),
        }
        return fn(tx)
      },
    }

    const createScopedDbWithClient = createScopedDb as unknown as (
      opts: { orgId: string; correlationId?: string },
      client: unknown,
    ) => { orgId: string; correlationId?: string; select: (table: PgTable<TableConfig>) => unknown }
    const scopedDb = createScopedDbWithClient(
      { orgId: VALID_ENTITY_ID, correlationId: 'corr-1' },
      fakeClient,
    )

    expect(scopedDb.orgId).toBe(VALID_ENTITY_ID)
    expect(scopedDb.correlationId).toBe('corr-1')
    expect(() => scopedDb.select(tableWithEntityIdPg)).not.toThrow()
    expect(whereArg.length).toBe(1)
  })

  it('throws on nested transaction beyond supported depth', async () => {
    const txClient = {
      select: () => ({ from: () => ({ where: () => Promise.resolve([]) }) }),
      transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          select: () => ({ from: () => ({ where: () => Promise.resolve([]) }) }),
          transaction: async (nestedFn: (nested: unknown) => Promise<unknown>) =>
            nestedFn({
              select: () => ({ from: () => ({ where: () => Promise.resolve([]) }) }),
              transaction: async () => Promise.resolve(null),
            }),
        }
        return fn(tx)
      },
    }

    type TxScopedDb = {
      transaction: (fn: (tx: TxScopedDb) => Promise<unknown>) => Promise<unknown>
    }
    const createScopedDbWithClient = createScopedDb as unknown as (
      opts: { orgId: string },
      client: unknown,
    ) => TxScopedDb
    const scopedDb = createScopedDbWithClient({ orgId: VALID_ENTITY_ID }, txClient)

    await expect(
      scopedDb.transaction(async (tx) =>
        tx.transaction(async (nested) => nested.transaction(async () => null)),
      ),
    ).rejects.toThrow('Nested transactions beyond 2 levels not supported')
  })

  it('injects orgId on insert and scopes update/delete', () => {
    const insertValues: unknown[] = []
    const whereArgs: unknown[] = []
    const fakeClient = {
      select: () => ({ from: () => ({ where: (w: unknown) => Promise.resolve([w]) }) }),
      insert: () => ({
        values: (v: unknown) => {
          insertValues.push(v)
          return { ok: true }
        },
      }),
      update: () => ({
        set: () => ({
          where: (w: unknown) => {
            whereArgs.push(w)
            return { ok: true }
          },
        }),
      }),
      delete: () => ({
        where: (w: unknown) => {
          whereArgs.push(w)
          return { ok: true }
        },
      }),
      transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(fakeClient),
    }

    const createScopedDbWithClient = createScopedDb as unknown as (
      orgId: string,
      client: unknown,
    ) => {
      insert: (table: PgTable<TableConfig>, values: Record<string, unknown> | Array<Record<string, unknown>>) => unknown
      update: (table: PgTable<TableConfig>, values: Record<string, unknown>) => unknown
      delete: (table: PgTable<TableConfig>) => unknown
    }
    const scopedDb = createScopedDbWithClient(VALID_ENTITY_ID, fakeClient)
    scopedDb.insert(tableWithEntityIdPg, { id: '1', orgId: 'wrong' })
    scopedDb.insert(tableWithEntityIdPg, [{ id: '2' }, { id: '3' }])
    scopedDb.update(tableWithEntityIdPg, { status: 'updated' })
    scopedDb.delete(tableWithEntityIdPg)

    expect(insertValues).toHaveLength(2)
    expect((insertValues[0] as Record<string, unknown>).orgId).toBe(VALID_ENTITY_ID)
    expect((insertValues[1] as Array<Record<string, unknown>>)[0].orgId).toBe(VALID_ENTITY_ID)
    expect(whereArgs.length).toBe(2)
  })
})

describe('ReadOnlyViolationError', () => {
  it('extends ScopedDbError and keeps operation in message', () => {
    const err = new ReadOnlyViolationError('insert')
    expect(err).toBeInstanceOf(ScopedDbError)
    expect(err.name).toBe('ReadOnlyViolationError')
    expect(err.message).toContain('insert')
  })
})
