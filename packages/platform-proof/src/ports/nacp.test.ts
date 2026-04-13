import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => {
  const queuedResults: unknown[] = []

  function nextResult(): unknown {
    if (queuedResults.length === 0) {
      throw new Error('No queued DB result for mocked query')
    }
    return queuedResults.shift()
  }

  const selectMock = vi.fn(() => ({
    from: vi.fn(() => {
      const query = {
        where: vi.fn(() => query),
        orderBy: vi.fn(() => query),
        limit: vi.fn(async () => nextResult()),
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(nextResult()).then(resolve, reject),
      }
      return query
    }),
  }))

  return { queuedResults, selectMock }
})

function enqueue(...results: unknown[]): void {
  mockState.queuedResults.push(...results)
}

vi.mock('@nzila/db/platform', () => ({
  platformDb: {
    select: mockState.selectMock,
  },
}))

vi.mock('@nzila/db/schema', () => ({
  auditEvents: {
    id: 'id',
    orgId: 'org_id',
    action: 'action',
    targetId: 'target_id',
    createdAt: 'created_at',
    hash: 'hash',
  },
  evidencePacks: {
    id: 'id',
    orgId: 'org_id',
    status: 'status',
    eventId: 'event_id',
    verifiedAt: 'verified_at',
    createdAt: 'created_at',
    chainIntegrity: 'chain_integrity',
    hashChainEnd: 'hash_chain_end',
    packId: 'pack_id',
  },
}))

import { nacpIntegrityPorts } from './nacp'

describe('nacpIntegrityPorts', () => {
  beforeEach(() => {
    mockState.queuedResults.length = 0
    mockState.selectMock.mockClear()
  })

  it('aggregates seal statuses across all NACP terminal event types', async () => {
    enqueue(
      [{ count: 4 }],
      [{ count: 3, lastSealedAt: '2026-04-01T00:00:00Z' }],
      [{ targetId: 'sub-1' }],
      [{ count: 2 }],
      [{ count: 2, lastSealedAt: '2026-04-02T00:00:00Z' }],
      [{ targetId: 'grade-1' }],
      [{ count: 1 }],
      [{ count: 0, lastSealedAt: null }],
      [{ targetId: 'export-1' }],
    )

    const statuses = await nacpIntegrityPorts.fetchSealStatuses('org-1')

    expect(statuses).toHaveLength(3)
    expect(statuses[0]).toMatchObject({ totalEvents: 4, sealedCount: 3, unsealedCount: 1 })
    expect(statuses[1]).toMatchObject({ totalEvents: 2, sealedCount: 2, unsealedCount: 0 })
    expect(statuses[2]).toMatchObject({ totalEvents: 1, sealedCount: 0, unsealedCount: 1 })
  })

  it('falls back to safe defaults when result rows are empty', async () => {
    enqueue([], [], [], [], [], [], [], [], [])

    const statuses = await nacpIntegrityPorts.fetchSealStatuses('org-1')

    for (const status of statuses) {
      expect(status.totalEvents).toBe(0)
      expect(status.sealedCount).toBe(0)
      expect(status.unsealedCount).toBe(0)
      expect(status.lastSealedAt).toBeNull()
      expect(status.lastSubjectId).toBeNull()
    }
  })

  it('reports missing seals and chain breaks as anomalies', async () => {
    enqueue(
      [
        { id: 'evt-1', targetId: 'sub-1', createdAt: '2026-04-03T01:00:00Z' },
        { id: 'evt-2', targetId: null, createdAt: '2026-04-03T01:30:00Z' },
      ],
      [{ id: 'pack-match' }],
      [],
      [],
      [{ id: 'evt-3', targetId: 'export-3', createdAt: '2026-04-03T02:00:00Z' }],
      [],
      [{ packId: 'pack-broken', eventId: 'EXPORT_GENERATED', createdAt: '2026-04-03T03:00:00Z' }],
    )

    const anomalies = await nacpIntegrityPorts.fetchAnomalies('org-1')
    const missing = anomalies.filter((a) => a.type === 'missing_seal')
    const chainBreaks = anomalies.filter((a) => a.type === 'chain_break')

    expect(missing).toHaveLength(2)
    expect(chainBreaks).toHaveLength(1)
    expect(chainBreaks[0]?.subjectId).toBe('pack-broken')
  })

  it('returns export proof hash from most recent sealed export event', async () => {
    enqueue([{ hashChainEnd: 'hash-end-1' }])

    const hash = await nacpIntegrityPorts.fetchExportProofHash('org-1')
    expect(hash).toBe('hash-end-1')
  })

  it('returns null export proof hash when no sealed export exists', async () => {
    enqueue([])

    const hash = await nacpIntegrityPorts.fetchExportProofHash('org-1')
    expect(hash).toBeNull()
  })

  it('returns hash chain length and head with null-safe defaults', async () => {
    enqueue([{ count: 12 }], [{ hash: 'chain-head' }])

    const info = await nacpIntegrityPorts.fetchHashChainInfo('org-1')
    expect(info).toEqual({ length: 12, head: 'chain-head' })

    enqueue([], [])

    const emptyInfo = await nacpIntegrityPorts.fetchHashChainInfo('org-1')
    expect(emptyInfo).toEqual({ length: 0, head: null })
  })
})
