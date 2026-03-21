import { describe, it, expect } from 'vitest'
import { aggregateRevenueBySource, buildCreatorRevenueReport } from './reporting'
import { RevenueSource, Currency } from './types'

// ── aggregateRevenueBySource ────────────────────────────────────────────────

describe('aggregateRevenueBySource', () => {
  it('returns empty for empty input', () => {
    expect(aggregateRevenueBySource([])).toEqual([])
  })

  it('aggregates entries by source', () => {
    const entries = [
      { source: RevenueSource.STREAM, grossMinor: 1000, feesMinor: 150, netMinor: 850 },
      { source: RevenueSource.STREAM, grossMinor: 2000, feesMinor: 300, netMinor: 1700 },
      { source: RevenueSource.TIP, grossMinor: 500, feesMinor: 50, netMinor: 450 },
    ]
    const result = aggregateRevenueBySource(entries)

    const streamSource = result.find((r) => r.source === RevenueSource.STREAM)
    expect(streamSource).toBeDefined()
    expect(streamSource!.grossMinor).toBe(3000)
    expect(streamSource!.feesMinor).toBe(450)
    expect(streamSource!.netMinor).toBe(2550)
    expect(streamSource!.transactionCount).toBe(2)

    const tipSource = result.find((r) => r.source === RevenueSource.TIP)
    expect(tipSource!.transactionCount).toBe(1)
  })

  it('sorts by gross descending', () => {
    const entries = [
      { source: RevenueSource.TIP, grossMinor: 100, feesMinor: 10, netMinor: 90 },
      { source: RevenueSource.STREAM, grossMinor: 5000, feesMinor: 750, netMinor: 4250 },
      { source: RevenueSource.TICKET_SALE, grossMinor: 2000, feesMinor: 150, netMinor: 1850 },
    ]
    const result = aggregateRevenueBySource(entries)
    expect(result[0]!.source).toBe(RevenueSource.STREAM)
    expect(result[1]!.source).toBe(RevenueSource.TICKET_SALE)
    expect(result[2]!.source).toBe(RevenueSource.TIP)
  })

  it('handles single entry', () => {
    const entries = [
      { source: RevenueSource.DOWNLOAD, grossMinor: 99, feesMinor: 15, netMinor: 84 },
    ]
    const result = aggregateRevenueBySource(entries)
    expect(result).toHaveLength(1)
    expect(result[0]!.transactionCount).toBe(1)
  })
})

// ── buildCreatorRevenueReport ───────────────────────────────────────────────

describe('buildCreatorRevenueReport', () => {
  it('builds report with correct totals', () => {
    const report = buildCreatorRevenueReport({
      creatorId: 'creator-1',
      orgId: 'org-1',
      periodStart: '2025-01-01',
      periodEnd: '2025-01-31',
      currency: Currency.USD,
      lineItems: [
        { source: RevenueSource.STREAM, grossMinor: 10000, feesMinor: 1500, netMinor: 8500 },
        { source: RevenueSource.TIP, grossMinor: 3000, feesMinor: 300, netMinor: 2700 },
      ],
      payoutsSentMinor: 5000,
      pendingBalanceMinor: 6200,
    })

    expect(report.creatorId).toBe('creator-1')
    expect(report.orgId).toBe('org-1')
    expect(report.grossRevenueMinor).toBe(13000)
    expect(report.platformFeesMinor).toBe(1800)
    expect(report.netRevenueMinor).toBe(11200)
    expect(report.processingFeesMinor).toBe(0)
    expect(report.taxesWithheldMinor).toBe(0)
    expect(report.payoutsSentMinor).toBe(5000)
    expect(report.pendingBalanceMinor).toBe(6200)
  })

  it('includes by-source breakdown sorted by gross', () => {
    const report = buildCreatorRevenueReport({
      creatorId: 'c1',
      orgId: 'o1',
      periodStart: '2025-01-01',
      periodEnd: '2025-01-31',
      currency: Currency.NGN,
      lineItems: [
        { source: RevenueSource.TIP, grossMinor: 100, feesMinor: 10, netMinor: 90 },
        { source: RevenueSource.STREAM, grossMinor: 5000, feesMinor: 750, netMinor: 4250 },
      ],
      payoutsSentMinor: 0,
      pendingBalanceMinor: 0,
    })

    expect(report.revenueBySource).toHaveLength(2)
    expect(report.revenueBySource[0]!.source).toBe(RevenueSource.STREAM)
    expect(report.revenueBySource[1]!.source).toBe(RevenueSource.TIP)
  })

  it('handles empty line items', () => {
    const report = buildCreatorRevenueReport({
      creatorId: 'c1',
      orgId: 'o1',
      periodStart: '2025-06-01',
      periodEnd: '2025-06-30',
      currency: Currency.USD,
      lineItems: [],
      payoutsSentMinor: 0,
      pendingBalanceMinor: 0,
    })

    expect(report.grossRevenueMinor).toBe(0)
    expect(report.platformFeesMinor).toBe(0)
    expect(report.netRevenueMinor).toBe(0)
    expect(report.revenueBySource).toHaveLength(0)
  })

  it('includes ISO timestamp in generatedAt', () => {
    const report = buildCreatorRevenueReport({
      creatorId: 'c1',
      orgId: 'o1',
      periodStart: '2025-01-01',
      periodEnd: '2025-01-31',
      currency: Currency.USD,
      lineItems: [],
      payoutsSentMinor: 0,
      pendingBalanceMinor: 0,
    })
    expect(report.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})
