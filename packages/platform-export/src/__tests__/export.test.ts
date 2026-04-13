import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMocks = vi.hoisted(() => {
  const selectResults: unknown[][] = []

  function makeWhereResult(rows: unknown[]) {
    const whereResult = {
      limit: vi.fn(async () => rows),
      then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve(rows).then(resolve, reject),
    }
    return whereResult
  }

  const platformDb = {
    select: vi.fn(() => {
      const rows = (selectResults.shift() ?? []) as unknown[]
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => makeWhereResult(rows)),
        })),
      }
    }),
  }

  return { selectResults, platformDb }
})

vi.mock('@nzila/db/platform', () => ({
  platformDb: dbMocks.platformDb,
}))

vi.mock('@nzila/db/schema', () => {
  const column = (name: string) => ({ name })
  return {
    auditEvents: { id: column('id'), action: column('action'), targetType: column('targetType'), actorRole: column('actorRole'), createdAt: column('createdAt'), orgId: column('orgId') },
    ueCases: { id: column('id'), category: column('category'), channel: column('channel'), status: column('status'), priority: column('priority'), slaBreached: column('slaBreached'), reopenCount: column('reopenCount'), messageCount: column('messageCount'), createdAt: column('createdAt'), orgId: column('orgId') },
    zongaRevenueEvents: { id: column('id'), type: column('type'), amount: column('amount'), currency: column('currency'), source: column('source'), createdAt: column('createdAt'), orgId: column('orgId') },
    commerceQuotes: { id: column('id'), ref: column('ref'), status: column('status'), total: column('total'), currency: column('currency'), createdAt: column('createdAt'), orgId: column('orgId') },
    orgs: { id: column('id'), legalName: column('legalName') },
  }
})

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => true),
}))

import { datasetToCsv, exportOrgData } from '../index'

beforeEach(() => {
  dbMocks.selectResults.length = 0
  dbMocks.platformDb.select.mockClear()
})

describe('datasetToCsv', () => {
  it('returns empty string for empty array', () => {
    expect(datasetToCsv([])).toBe('')
  })

  it('generates valid CSV with headers', () => {
    const rows = [
      { id: '1', name: 'Alice', score: 95 },
      { id: '2', name: 'Bob', score: 87 },
    ]
    const csv = datasetToCsv(rows)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('id,name,score')
    expect(lines[1]).toBe('1,Alice,95')
    expect(lines[2]).toBe('2,Bob,87')
  })

  it('escapes commas in values', () => {
    const rows = [{ id: '1', note: 'hello, world' }]
    const csv = datasetToCsv(rows)
    expect(csv).toContain('"hello, world"')
  })

  it('escapes quotes in values', () => {
    const rows = [{ id: '1', note: 'say "hi"' }]
    const csv = datasetToCsv(rows)
    expect(csv).toContain('"say ""hi"""')
  })

  it('handles null values', () => {
    const rows = [{ id: '1', name: null }]
    const csv = datasetToCsv(rows)
    expect(csv).toBe('id,name\n1,')
  })

  it('escapes values containing newlines', () => {
    const rows = [{ id: '1', note: 'hello\nworld' }]
    const csv = datasetToCsv(rows)
    expect(csv).toContain('"hello\nworld"')
  })
})

describe('exportOrgData', () => {
  it('maps datasets and builds ABR audit slice using all supported patterns', async () => {
    const fixed = new Date('2026-01-01T00:00:00.000Z')

    dbMocks.selectResults.push(
      [{ legalName: 'Acme Org' }],
      [{ id: 'case-1', category: 'fraud', channel: 'web', status: 'open', priority: 'high', slaBreached: false, reopenCount: 0, messageCount: 1, createdAt: fixed }],
      [{ id: 'rev-1', type: 'sale', amount: 100, currency: 'USD', source: 'checkout', createdAt: fixed }],
      [{ id: 'quote-1', ref: 'Q-1', status: 'draft', total: 40, currency: 'USD', createdAt: fixed }],
      [
        { id: 'a1', action: 'abr.case.created', targetType: 'case', actorRole: 'org_admin', createdAt: fixed },
        { id: 'a2', action: 'CLAIM_DECISION_APPROVED', targetType: 'case', actorRole: 'org_admin', createdAt: fixed },
        { id: 'a3', action: 'CLAIM_CASE_ESCALATED', targetType: 'case', actorRole: 'org_admin', createdAt: fixed },
        { id: 'a4', action: 'zonga.payment.completed', targetType: 'payment', actorRole: 'org_member', createdAt: fixed },
      ],
    )

    const dataset = await exportOrgData('org-1')

    expect(dataset.orgName).toBe('Acme Org')
    expect(dataset.claims).toHaveLength(1)
    expect(dataset.revenue).toHaveLength(1)
    expect(dataset.quotes).toHaveLength(1)
    expect(dataset.auditEvents).toHaveLength(4)
    expect(dataset.abrAuditSlice).toHaveLength(3)
    expect(dataset.abrCases).toEqual([])
    expect(dataset.abrEvidenceIndex).toEqual([])
    expect(dataset.featureFlags).toEqual([])

    expect(dataset.claims[0].createdAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('falls back to Unknown org name when organization row is missing', async () => {
    dbMocks.selectResults.push([], [], [], [], [])

    const dataset = await exportOrgData('org-missing')

    expect(dataset.orgName).toBe('Unknown')
    expect(dataset.claims).toEqual([])
    expect(dataset.abrAuditSlice).toEqual([])
    expect(dbMocks.platformDb.select).toHaveBeenCalledTimes(5)
  })
})
