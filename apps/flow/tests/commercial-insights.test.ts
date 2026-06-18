import { describe, expect, it } from 'vitest'
import {
  calculateAverageQuoteSize,
  calculateCloseRateTrend,
  calculateEstimatedMrr,
  estimateCustomerLifetimeValue,
} from '@/lib/commercial-insights'

describe('commercial insights', () => {
  it('calculates average quote size', () => {
    const result = calculateAverageQuoteSize([
      { total: 1000, status: 'draft', createdAt: new Date().toISOString() },
      { total: 3000, status: 'accepted', createdAt: new Date().toISOString() },
    ])

    expect(result).toBe(2000)
  })

  it('calculates estimated MRR from recent paid invoices only', () => {
    const now = new Date().toISOString()
    const old = new Date(Date.now() - 150 * 86_400_000).toISOString()

    const result = calculateEstimatedMrr([
      { total: 1200, status: 'paid', issuedAt: now },
      { total: 600, status: 'sent', issuedAt: now },
      { total: 900, status: 'paid', issuedAt: old },
    ], 3)

    expect(result).toBe(400)
  })

  it('computes close rate trend delta', () => {
    const recent = new Date(Date.now() - 5 * 86_400_000).toISOString()
    const previous = new Date(Date.now() - 40 * 86_400_000).toISOString()

    const trend = calculateCloseRateTrend([
      { total: 1000, status: 'accepted', createdAt: recent },
      { total: 1200, status: 'draft', createdAt: recent },
      { total: 900, status: 'accepted', createdAt: previous },
      { total: 600, status: 'accepted', createdAt: previous },
    ])

    expect(trend.recentCloseRate).toBe(50)
    expect(trend.previousCloseRate).toBe(100)
    expect(trend.deltaPoints).toBe(-50)
  })

  it('estimates CLV', () => {
    const clv = estimateCustomerLifetimeValue({
      averageOrderValue: 250,
      ordersPerMonth: 2,
      averageLifetimeMonths: 18,
    })

    expect(clv).toBe(9000)
  })

  it('covers empty and invalid-input branches across insight helpers', () => {
    expect(calculateAverageQuoteSize([])).toBe(0)

    const mrrInvalidWindow = calculateEstimatedMrr(
      [{ total: 1200, status: ' PAID ', issuedAt: new Date().toISOString() }],
      0,
    )
    expect(mrrInvalidWindow).toBe(0)

    const mrrNormalizedPaid = calculateEstimatedMrr(
      [{ total: 900, status: ' PAID ', issuedAt: new Date().toISOString() }],
      3,
    )
    expect(mrrNormalizedPaid).toBe(300)

    const stale = new Date(Date.now() - 120 * 86_400_000).toISOString()
    const trend = calculateCloseRateTrend([
      { total: 100, status: 'closed', createdAt: stale },
    ])
    expect(trend).toEqual({ recentCloseRate: 0, previousCloseRate: 0, deltaPoints: 0 })

    expect(
      estimateCustomerLifetimeValue({
        averageOrderValue: 0,
        ordersPerMonth: 2,
        averageLifetimeMonths: 12,
      }),
    ).toBe(0)
  })
})
