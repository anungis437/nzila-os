/**
 * Integration Tests — Automatic Audit Emission (withAudit)
 *
 * Validates that:
 *   1. Insert → audit event emitted automatically
 *   2. Update → audit event emitted automatically
 *   3. Delete → audit event emitted automatically
 *   4. Select → no audit event (reads are not audited)
 *   5. Audit context validation (orgId mismatch → throw)
 *   6. Correlation ID propagation
 *   7. Audit immutability contract preserved
 */
import { describe, it, expect, vi } from 'vitest'
import {
  withAudit,
  createAuditedScopedDb,
  type AuditEvent,
  type AuditEmitter,
} from '../audit'
import { createScopedDb, type ScopedDb } from '../scoped'

// ── Test Constants ──────────────────────────────────────────────────────────

const ENTITY_ID = '550e8400-e29b-41d4-a716-446655440000'
const ACTOR_ID = 'user_2abc123'

// ── Mock ScopedDb ──────────────────────────────────────────────────────────

function createMockScopedDb(orgId: string): ScopedDb {
  return {
    orgId,
    select: vi.fn().mockReturnValue(Promise.resolve([])),
    insert: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
    update: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
    delete: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
    transaction: vi.fn().mockImplementation(async (fn) => fn(createMockScopedDb(orgId))),
  }
}

// ── Mock table ──────────────────────────────────────────────────────────────

const mockTable = {
  [Symbol.for('drizzle:Name')]: 'meetings',
  id: { name: 'id' },
  orgId: { name: 'org_id' },
}

// ── 1. Audit emission on mutations ──────────────────────────────────────────

describe('withAudit — automatic audit emission', () => {
  it('emits audit event on insert', async () => {
    const emitted: AuditEvent[] = []
    const emitter: AuditEmitter = async (event) => { emitted.push(event) }

    const scopedDb = createMockScopedDb(ENTITY_ID)
    const auditedDb = withAudit(scopedDb, { actorId: ACTOR_ID, orgId: ENTITY_ID }, emitter)

    auditedDb.insert(mockTable as any, { kind: 'board' })

    expect(emitted).toHaveLength(1)
    expect(emitted[0].action).toBe('insert')
    expect(emitted[0].table).toBe('meetings')
    expect(emitted[0].orgId).toBe(ENTITY_ID)
    expect(emitted[0].actorId).toBe(ACTOR_ID)
    expect(emitted[0].correlationId).toBeTruthy()
    expect(emitted[0].timestamp).toBeTruthy()
  })

  it('emits audit event on update', async () => {
    const emitted: AuditEvent[] = []
    const emitter: AuditEmitter = async (event) => { emitted.push(event) }

    const scopedDb = createMockScopedDb(ENTITY_ID)
    const auditedDb = withAudit(scopedDb, { actorId: ACTOR_ID, orgId: ENTITY_ID }, emitter)

    auditedDb.update(mockTable as any, { status: 'held' })

    expect(emitted).toHaveLength(1)
    expect(emitted[0].action).toBe('update')
    expect(emitted[0].table).toBe('meetings')
    expect(emitted[0].values).toEqual({ status: 'held' })
  })

  it('emits audit event on delete', async () => {
    const emitted: AuditEvent[] = []
    const emitter: AuditEmitter = async (event) => { emitted.push(event) }

    const scopedDb = createMockScopedDb(ENTITY_ID)
    const auditedDb = withAudit(scopedDb, { actorId: ACTOR_ID, orgId: ENTITY_ID }, emitter)

    auditedDb.delete(mockTable as any)

    expect(emitted).toHaveLength(1)
    expect(emitted[0].action).toBe('delete')
    expect(emitted[0].table).toBe('meetings')
  })

  it('does NOT emit audit event on select', async () => {
    const emitted: AuditEvent[] = []
    const emitter: AuditEmitter = async (event) => { emitted.push(event) }

    const scopedDb = createMockScopedDb(ENTITY_ID)
    const auditedDb = withAudit(scopedDb, { actorId: ACTOR_ID, orgId: ENTITY_ID }, emitter)

    auditedDb.select(mockTable as any)

    expect(emitted).toHaveLength(0)
  })
})

// ── 2. Context validation ──────────────────────────────────────────────────

describe('withAudit — context validation', () => {
  it('throws when orgId mismatch between scopedDb and context', () => {
    const scopedDb = createMockScopedDb(ENTITY_ID)
    const differentEntityId = '550e8400-e29b-41d4-a716-446655440099'

    expect(() =>
      withAudit(scopedDb, { actorId: ACTOR_ID, orgId: differentEntityId }),
    ).toThrow('does not match')
  })

  it('accepts matching entityIds', () => {
    const scopedDb = createMockScopedDb(ENTITY_ID)
    expect(() =>
      withAudit(scopedDb, { actorId: ACTOR_ID, orgId: ENTITY_ID }),
    ).not.toThrow()
  })
})

// ── 3. Correlation ID ──────────────────────────────────────────────────────

describe('withAudit — correlation ID', () => {
  it('uses provided correlationId', () => {
    const emitted: AuditEvent[] = []
    const emitter: AuditEmitter = async (event) => { emitted.push(event) }
    const correlationId = 'corr-123-456'

    const scopedDb = createMockScopedDb(ENTITY_ID)
    const auditedDb = withAudit(
      scopedDb,
      { actorId: ACTOR_ID, orgId: ENTITY_ID, correlationId },
      emitter,
    )

    auditedDb.insert(mockTable as any, { kind: 'board' })
    expect(emitted[0].correlationId).toBe(correlationId)
  })

  it('generates correlationId when not provided', () => {
    const emitted: AuditEvent[] = []
    const emitter: AuditEmitter = async (event) => { emitted.push(event) }

    const scopedDb = createMockScopedDb(ENTITY_ID)
    const auditedDb = withAudit(
      scopedDb,
      { actorId: ACTOR_ID, orgId: ENTITY_ID },
      emitter,
    )

    auditedDb.insert(mockTable as any, { kind: 'board' })
    expect(emitted[0].correlationId).toBeTruthy()
    expect(typeof emitted[0].correlationId).toBe('string')
  })

  it('uses consistent correlationId across multiple operations', () => {
    const emitted: AuditEvent[] = []
    const emitter: AuditEmitter = async (event) => { emitted.push(event) }

    const scopedDb = createMockScopedDb(ENTITY_ID)
    const auditedDb = withAudit(
      scopedDb,
      { actorId: ACTOR_ID, orgId: ENTITY_ID },
      emitter,
    )

    auditedDb.insert(mockTable as any, { kind: 'board' })
    auditedDb.update(mockTable as any, { status: 'held' })
    auditedDb.delete(mockTable as any)

    expect(emitted).toHaveLength(3)
    expect(emitted[0].correlationId).toBe(emitted[1].correlationId)
    expect(emitted[1].correlationId).toBe(emitted[2].correlationId)
  })
})

// ── 4. Actor role propagation ──────────────────────────────────────────────

describe('withAudit — actor role', () => {
  it('includes actorRole in audit event when provided', () => {
    const emitted: AuditEvent[] = []
    const emitter: AuditEmitter = async (event) => { emitted.push(event) }

    const scopedDb = createMockScopedDb(ENTITY_ID)
    const auditedDb = withAudit(
      scopedDb,
      { actorId: ACTOR_ID, orgId: ENTITY_ID, actorRole: 'org_admin' },
      emitter,
    )

    auditedDb.insert(mockTable as any, { kind: 'board' })
    expect(emitted[0].actorRole).toBe('org_admin')
  })

  it('omits actorRole when not provided', () => {
    const emitted: AuditEvent[] = []
    const emitter: AuditEmitter = async (event) => { emitted.push(event) }

    const scopedDb = createMockScopedDb(ENTITY_ID)
    const auditedDb = withAudit(
      scopedDb,
      { actorId: ACTOR_ID, orgId: ENTITY_ID },
      emitter,
    )

    auditedDb.insert(mockTable as any, { kind: 'board' })
    expect(emitted[0].actorRole).toBeUndefined()
  })
})

// ── 5. AuditedScopedDb properties ──────────────────────────────────────────

describe('withAudit — AuditedScopedDb interface', () => {
  it('exposes orgId from wrapped scopedDb', () => {
    const scopedDb = createMockScopedDb(ENTITY_ID)
    const auditedDb = withAudit(scopedDb, { actorId: ACTOR_ID, orgId: ENTITY_ID })
    expect(auditedDb.orgId).toBe(ENTITY_ID)
  })

  it('exposes auditContext', () => {
    const scopedDb = createMockScopedDb(ENTITY_ID)
    const context = { actorId: ACTOR_ID, orgId: ENTITY_ID, actorRole: 'org_admin' }
    const auditedDb = withAudit(scopedDb, context)

    expect(auditedDb.auditContext).toEqual(context)
  })
})

describe('withAudit — mandatory audit failures for thenable writes', () => {
  function createThenableResult() {
    return {
      then: (onFulfilled?: (v: string) => unknown, _onRejected?: (e: unknown) => unknown) =>
        Promise.resolve('ok').then((v) => (onFulfilled ? onFulfilled(v) : v)),
    }
  }

  function createThenableScopedDb(orgId: string): ScopedDb {
    return {
      orgId,
      select: vi.fn().mockReturnValue(Promise.resolve([])),
      insert: vi.fn().mockReturnValue(createThenableResult()),
      update: vi.fn().mockReturnValue(createThenableResult()),
      delete: vi.fn().mockReturnValue(createThenableResult()),
      transaction: vi.fn().mockImplementation(async (fn) => fn(createThenableScopedDb(orgId))),
    }
  }

  it('rejects insert chain when emitter fails', async () => {
    const scopedDb = createThenableScopedDb(ENTITY_ID)
    const emitter: AuditEmitter = async () => {
      throw new Error('audit sink unavailable')
    }
    const auditedDb = withAudit(scopedDb, { actorId: ACTOR_ID, orgId: ENTITY_ID }, emitter)

    await expect((auditedDb.insert(mockTable as any, { kind: 'board' }) as any).then(() => 'ok')).rejects
      .toThrow('[AUDIT:MANDATORY] Audit emission failed for meetings.insert')
  })

  it('rejects update chain when emitter fails', async () => {
    const scopedDb = createThenableScopedDb(ENTITY_ID)
    const emitter: AuditEmitter = async () => {
      throw new Error('audit sink unavailable')
    }
    const auditedDb = withAudit(scopedDb, { actorId: ACTOR_ID, orgId: ENTITY_ID }, emitter)

    await expect((auditedDb.update(mockTable as any, { status: 'held' }) as any).then(() => 'ok')).rejects
      .toThrow('[AUDIT:MANDATORY] Audit emission failed for meetings.update')
  })

  it('rejects delete chain when emitter fails', async () => {
    const scopedDb = createThenableScopedDb(ENTITY_ID)
    const emitter: AuditEmitter = async () => {
      throw new Error('audit sink unavailable')
    }
    const auditedDb = withAudit(scopedDb, { actorId: ACTOR_ID, orgId: ENTITY_ID }, emitter)

    await expect((auditedDb.delete(mockTable as any) as any).then(() => 'ok')).rejects
      .toThrow('[AUDIT:MANDATORY] Audit emission failed for meetings.delete')
  })
})

describe('createAuditedScopedDb — input validation', () => {
  it('throws when orgId is missing', () => {
    expect(() => createAuditedScopedDb({ orgId: '' as any, actorId: ACTOR_ID })).toThrow(
      'requires a non-empty orgId',
    )
  })

  it('throws when actorId is missing', () => {
    expect(() => createAuditedScopedDb({ orgId: ENTITY_ID, actorId: '' as any })).toThrow(
      'requires a non-empty actorId',
    )
  })

  it('creates audited db with valid options', () => {
    const db = createAuditedScopedDb({ orgId: ENTITY_ID, actorId: ACTOR_ID })
    expect(db.orgId).toBe(ENTITY_ID)
    expect(db.auditContext.actorId).toBe(ACTOR_ID)
  })
})
