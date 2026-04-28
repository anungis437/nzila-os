import { describe, expect, it } from 'vitest'
import {
  computeAppRevenueBreakdown,
  createInMemoryRevenueService,
  emitRevenueEvent,
  getRevenueAuditLog,
  RevenueEventType,
  RevenueStatus,
  RevenueType,
} from './index'

describe('platform-revenue service', () => {
  it('records and summarizes events by bucket and app', () => {
    const service = createInMemoryRevenueService()

    service.recordEvent({
      id: '11111111-1111-4111-8111-111111111111',
      orgId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      eventType: RevenueEventType.SUBSCRIPTION_STARTED,
      amount: 100,
      currency: 'USD',
      appId: 'web',
      occurredAt: '2026-01-01T00:00:00.000Z',
    })

    service.recordEvent({
      id: '22222222-2222-4222-8222-222222222222',
      orgId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      eventType: RevenueEventType.USAGE_OVERAGE_BILLED,
      amount: 25,
      currency: 'USD',
      appId: 'web',
      occurredAt: '2026-01-02T00:00:00.000Z',
    })

    service.recordEvent({
      id: '33333333-3333-4333-8333-333333333333',
      orgId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      eventType: RevenueEventType.COMMERCE_REVENUE,
      amount: 75,
      currency: 'USD',
      appId: 'zonga',
      occurredAt: '2026-01-03T00:00:00.000Z',
    })

    const summary = service.summarize('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2026-01')
    expect(summary.subscriptionRevenue).toBe(100)
    expect(summary.usageRevenue).toBe(25)
    expect(summary.transactionRevenue).toBe(75)
    expect(summary.totalRevenue).toBe(200)
    expect(summary.byApp.web).toBe(125)
    expect(summary.byApp.zonga).toBe(75)
  })

  it('emits revenue events from unified records and writes audit entries', () => {
    const service = createInMemoryRevenueService()
    const before = getRevenueAuditLog().length

    const event = emitRevenueEvent(service, {
      id: '44444444-4444-4444-8444-444444444444',
      orgId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      appSource: 'zonga',
      revenueType: RevenueType.TRANSACTION,
      grossAmount: 250,
      platformFee: 25,
      netAmount: 225,
      currency: 'USD',
      timestamp: '2026-02-01T00:00:00.000Z',
      status: RevenueStatus.SETTLED,
      metadata: { orderId: 'ord_1' },
    })

    expect(event.eventType).toBe(RevenueEventType.ZONGA_REVENUE)
    expect(event.metadata?.platformFee).toBe(25)

    const after = getRevenueAuditLog().length
    expect(after).toBe(before + 1)
  })

  it('computes per-app breakdown totals and counts', () => {
    const breakdown = computeAppRevenueBreakdown([
      {
        id: '55555555-5555-4555-8555-555555555555',
        orgId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        eventType: RevenueEventType.ONE_TIME_PAYMENT,
        amount: 40,
        currency: 'USD',
        appId: 'console',
        occurredAt: '2026-02-10T00:00:00.000Z',
      },
      {
        id: '66666666-6666-4666-8666-666666666666',
        orgId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        eventType: RevenueEventType.ONE_TIME_PAYMENT,
        amount: 60,
        currency: 'USD',
        occurredAt: '2026-02-11T00:00:00.000Z',
      },
    ])

    expect(breakdown.console).toEqual({ total: 40, count: 1 })
    expect(breakdown.platform).toEqual({ total: 60, count: 1 })
  })
})
