import { afterEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  const loggerInfo = vi.fn()
  const computeEntryHashMock = vi.fn((payload: unknown, previousHash: string | null) => {
    const key = JSON.stringify(payload)
    return `hash:${previousHash ?? 'none'}:${key.length}`
  })

  const eqMock = vi.fn((...args: unknown[]) => ({ op: 'eq', args }))
  const andMock = vi.fn((...args: unknown[]) => ({ op: 'and', args }))
  const gteMock = vi.fn((...args: unknown[]) => ({ op: 'gte', args }))
  const lteMock = vi.fn((...args: unknown[]) => ({ op: 'lte', args }))
  const descMock = vi.fn((value: unknown) => ({ op: 'desc', value }))

  const platformDbMock = {
    select: vi.fn(),
    insert: vi.fn(),
  }

  return {
    loggerInfo,
    computeEntryHashMock,
    eqMock,
    andMock,
    gteMock,
    lteMock,
    descMock,
    platformDbMock,
  }
})

vi.mock('@nzila/db/platform', () => ({ platformDb: h.platformDbMock }))
vi.mock('@nzila/db/schema', () => ({
  auditEvents: {
    id: 'id',
    orgId: 'orgId',
    actorClerkUserId: 'actorClerkUserId',
    actorRole: 'actorRole',
    action: 'action',
    targetType: 'targetType',
    targetId: 'targetId',
    beforeJson: 'beforeJson',
    afterJson: 'afterJson',
    hash: 'hash',
    previousHash: 'previousHash',
    createdAt: 'createdAt',
  },
}))
vi.mock('@nzila/os-core/hash', () => ({ computeEntryHash: h.computeEntryHashMock }))
vi.mock('@nzila/os-core', () => ({ createLogger: () => ({ info: h.loggerInfo, warn: vi.fn(), error: vi.fn(), debug: vi.fn() }) }))
vi.mock('drizzle-orm', () => ({
  eq: h.eqMock,
  and: h.andMock,
  gte: h.gteMock,
  lte: h.lteMock,
  desc: h.descMock,
}))

import {
  exportAuditTrailBuffer,
  getAuditTrailForTarget,
  queryAuditEvents,
  recordAuditEvent,
  verifyEntityAuditChain,
} from '../audit-db'

function selectLatestHashChain(latestHash: string | null) {
  return {
    from: () => ({
      where: () => ({
        orderBy: () => ({
          limit: () => Promise.resolve(latestHash ? [{ hash: latestHash }] : []),
        }),
      }),
    }),
  }
}

function selectEventsChain(events: Array<unknown>) {
  return {
    from: () => ({
      where: () => ({
        orderBy: () => Promise.resolve(events),
      }),
      orderBy: () => Promise.resolve(events),
    }),
  }
}

function selectCountChain(rows: Array<unknown>) {
  return {
    from: () => ({
      where: () => ({
        then: (cb: (rows: Array<unknown>) => unknown) => Promise.resolve(cb(rows)),
      }),
    }),
  }
}

function selectPagedEventsChain(rows: Array<unknown>) {
  return {
    from: () => ({
      where: () => ({
        orderBy: () => ({
          limit: () => ({
            offset: () => Promise.resolve(rows),
          }),
        }),
      }),
    }),
  }
}

describe('audit-db', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('records audit event and links previous hash', async () => {
    h.platformDbMock.select.mockImplementationOnce(() => selectLatestHashChain('prev_hash'))
    h.platformDbMock.insert.mockImplementationOnce(() => ({
      values: (values: Record<string, unknown>) => ({
        returning: () => Promise.resolve([{ id: 'evt_1', hash: String(values.hash) }]),
      }),
    }))

    const row = await recordAuditEvent({
      orgId: 'org_1',
      actorClerkUserId: 'user_1',
      action: 'governance_action.execute',
      targetType: 'governance_action',
      targetId: 'g_1',
      afterJson: { status: 'executed' },
    })

    expect(row.previousHash).toBe('prev_hash')
    expect(row.hash).toContain('hash:prev_hash')
    expect(h.loggerInfo).toHaveBeenCalled()
  })

  it('records audit event with optional fields omitted', async () => {
    h.platformDbMock.select.mockImplementationOnce(() => selectLatestHashChain(null))
    h.platformDbMock.insert.mockImplementationOnce(() => ({
      values: (values: Record<string, unknown>) => ({
        returning: () => Promise.resolve([{ id: 'evt_2', hash: String(values.hash) }]),
      }),
    }))

    const row = await recordAuditEvent({
      orgId: 'org_2',
      actorClerkUserId: 'user_2',
      action: 'governance_action.create',
      targetType: 'governance_action',
    })

    expect(row.previousHash).toBeNull()
    expect(h.computeEntryHashMock).toHaveBeenCalledWith(
      expect.objectContaining({ targetId: null, afterJson: null }),
      null,
    )
  })

  it('verifies valid and invalid entity chains', async () => {
    h.platformDbMock.select.mockImplementationOnce(() => selectEventsChain([]))
    const empty = await verifyEntityAuditChain('org_1')
    expect(empty).toEqual({ valid: true, totalEvents: 0 })

    const validEvent = {
      id: 'e1',
      orgId: 'org_1',
      actorClerkUserId: 'u',
      action: 'a',
      targetType: 't',
      targetId: 'x',
      afterJson: { ok: true },
      previousHash: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      hash: h.computeEntryHashMock({
        orgId: 'org_1',
        actorClerkUserId: 'u',
        action: 'a',
        targetType: 't',
        targetId: 'x',
        afterJson: { ok: true },
        timestamp: '2026-01-01T00:00:00.000Z',
      }, null),
    }

    h.platformDbMock.select.mockImplementationOnce(() => selectEventsChain([validEvent]))
    const valid = await verifyEntityAuditChain('org_1')
    expect(valid.valid).toBe(true)

    const brokenLink = { ...validEvent, previousHash: 'wrong', hash: 'h1' }
    h.platformDbMock.select.mockImplementationOnce(() => selectEventsChain([brokenLink]))
    const invalid = await verifyEntityAuditChain('org_1')
    expect(invalid.valid).toBe(false)
    expect(invalid.brokenEventId).toBe('e1')

    const hashMismatch = { ...validEvent, hash: 'tampered' }
    h.platformDbMock.select.mockImplementationOnce(() => selectEventsChain([hashMismatch]))
    const invalidHash = await verifyEntityAuditChain('org_1')
    expect(invalidHash.valid).toBe(false)
    expect(invalidHash.brokenEventId).toBe('e1')

    const secondEvent = {
      ...validEvent,
      id: 'e2',
      targetId: null,
      afterJson: null,
      previousHash: validEvent.hash,
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
    }
    secondEvent.hash = h.computeEntryHashMock({
      orgId: secondEvent.orgId,
      actorClerkUserId: secondEvent.actorClerkUserId,
      action: secondEvent.action,
      targetType: secondEvent.targetType,
      targetId: null,
      afterJson: null,
      timestamp: secondEvent.createdAt.toISOString(),
    }, secondEvent.previousHash)

    h.platformDbMock.select.mockImplementationOnce(() => selectEventsChain([validEvent, secondEvent]))
    const multi = await verifyEntityAuditChain('org_1')
    expect(multi).toEqual({ valid: true, totalEvents: 2 })
  })

  it('exports and filters audit trail by target', async () => {
    const events = [
      {
        id: 'e1', orgId: 'org_1', actorClerkUserId: 'u', actorRole: null, action: 'a',
        targetType: 'governance_action', targetId: 'x', beforeJson: null, afterJson: { a: 1 },
        hash: 'h1', previousHash: null, createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        id: 'e2', orgId: 'org_1', actorClerkUserId: 'u', actorRole: null, action: 'a',
        targetType: 'other', targetId: 'y', beforeJson: null, afterJson: { a: 2 },
        hash: 'h2', previousHash: 'h1', createdAt: new Date('2026-01-02T00:00:00.000Z'),
      },
    ]

    h.platformDbMock.select.mockImplementationOnce(() => selectEventsChain(events))
    const trail = await getAuditTrailForTarget('org_1', 'governance_action', 'x')
    expect(trail.length).toBe(2)

    h.platformDbMock.select.mockImplementationOnce(() => selectEventsChain(events))
    const buffer = await exportAuditTrailBuffer('org_1', 'governance_action', 'x')
    const parsed = JSON.parse(buffer.toString())
    expect(parsed).toHaveLength(1)
    expect(parsed[0].id).toBe('e1')
  })

  it('queries audit events with filters and pagination defaults', async () => {
    const rows = [{ id: 'e1' }, { id: 'e2' }]
    h.platformDbMock.select
      .mockImplementationOnce(() => selectCountChain(rows))
      .mockImplementationOnce(() => selectPagedEventsChain(rows))

    const result = await queryAuditEvents({ orgId: 'org_1', actorId: 'u1', targetType: 'x' })

    expect(result.events).toEqual(rows)
    expect(result.total).toBe(2)
    expect(result.limit).toBe(50)
    expect(result.offset).toBe(0)
    expect(h.eqMock).toHaveBeenCalled()
    expect(h.andMock).toHaveBeenCalled()
  })

  it('queries audit events with only mandatory org filter', async () => {
    const rows = [{ id: 'e1' }]
    h.platformDbMock.select
      .mockImplementationOnce(() => selectCountChain(rows))
      .mockImplementationOnce(() => selectPagedEventsChain(rows))

    const result = await queryAuditEvents({ orgId: 'org_1' })

    expect(result.total).toBe(1)
    expect(result.limit).toBe(50)
    expect(result.offset).toBe(0)
  })

  it('caps page size at 200 and accepts all optional filters', async () => {
    const rows = [{ id: 'e1' }]
    h.platformDbMock.select
      .mockImplementationOnce(() => selectCountChain(rows))
      .mockImplementationOnce(() => selectPagedEventsChain(rows))

    const result = await queryAuditEvents({
      orgId: 'org_1',
      actorId: 'u1',
      action: 'governance_action.execute',
      targetType: 'governance_action',
      targetId: 'g_1',
      startTime: new Date('2026-01-01T00:00:00.000Z'),
      endTime: new Date('2026-01-31T23:59:59.000Z'),
      limit: 999,
      offset: 3,
    })

    expect(result.limit).toBe(200)
    expect(result.offset).toBe(3)
    expect(h.gteMock).toHaveBeenCalled()
    expect(h.lteMock).toHaveBeenCalled()
  })
})
