import { describe, expect, it } from 'vitest'
import {
  aggregateByStreamType,
  buildRevenueRecord,
  calculatePlatformFee,
  computePayoutLiability,
  generateCreatorPayouts,
  platformTakeRate,
  RevenueStreamType,
  revenuePerCreator,
  revenuePerEvent,
} from './index'

const orgId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const creatorA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const creatorB = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const eventId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

describe('zonga monetization', () => {
  it('calculates default stream fees and builds validated records', () => {
    expect(calculatePlatformFee(100, RevenueStreamType.STREAMING)).toBe(30)
    expect(calculatePlatformFee(100, RevenueStreamType.FAN_PAYMENT)).toBe(5)

    const record = buildRevenueRecord({
      id: '11111111-1111-4111-8111-111111111111',
      orgId,
      creatorId: creatorA,
      revenueStreamType: RevenueStreamType.EVENT_TICKET,
      grossAmount: 250,
      currency: 'USD',
      eventId,
      recordedAt: '2026-01-10T00:00:00.000Z',
    })

    expect(record.platformFee).toBe(25)
    expect(record.netAmount).toBe(225)
  })

  it('aggregates totals by stream and computes payout liability', () => {
    const records = [
      buildRevenueRecord({
        id: '22222222-2222-4222-8222-222222222222',
        orgId,
        creatorId: creatorA,
        revenueStreamType: RevenueStreamType.STREAMING,
        grossAmount: 100,
        currency: 'USD',
        recordedAt: '2026-01-01T00:00:00.000Z',
      }),
      buildRevenueRecord({
        id: '33333333-3333-4333-8333-333333333333',
        orgId,
        creatorId: creatorB,
        revenueStreamType: RevenueStreamType.FAN_PAYMENT,
        grossAmount: 200,
        currency: 'USD',
        eventId,
        recordedAt: '2026-01-02T00:00:00.000Z',
      }),
    ]

    const agg = aggregateByStreamType(records)
    expect(agg.streaming.gross).toBe(100)
    expect(agg.fan_payment.gross).toBe(200)

    const liability = computePayoutLiability(records)
    expect(liability.creatorCount).toBe(2)
    expect(liability.totalNet).toBe(260)
  })

  it('generates payouts only for creators above minimum threshold', () => {
    const records = [
      buildRevenueRecord({
        id: '44444444-4444-4444-8444-444444444444',
        orgId,
        creatorId: creatorA,
        revenueStreamType: RevenueStreamType.SUBSCRIPTION,
        grossAmount: 60,
        currency: 'USD',
        recordedAt: '2026-01-03T00:00:00.000Z',
      }),
      buildRevenueRecord({
        id: '55555555-5555-4555-8555-555555555555',
        orgId,
        creatorId: creatorB,
        revenueStreamType: RevenueStreamType.MERCHANDISE,
        grossAmount: 20,
        currency: 'USD',
        recordedAt: '2026-01-03T00:00:00.000Z',
      }),
    ]

    const payouts = generateCreatorPayouts(records, { minPayoutAmount: 30 })
    expect(payouts.length).toBe(1)
    expect(payouts[0].creatorId).toBe(creatorA)
  })

  it('produces creator/event snapshots and platform take rate', () => {
    const records = [
      buildRevenueRecord({
        id: '66666666-6666-4666-8666-666666666666',
        orgId,
        creatorId: creatorA,
        revenueStreamType: RevenueStreamType.EVENT_TICKET,
        grossAmount: 100,
        currency: 'USD',
        eventId,
        recordedAt: '2026-01-11T00:00:00.000Z',
      }),
      buildRevenueRecord({
        id: '77777777-7777-4777-8777-777777777777',
        orgId,
        creatorId: creatorA,
        revenueStreamType: RevenueStreamType.FAN_PAYMENT,
        grossAmount: 40,
        currency: 'USD',
        eventId,
        recordedAt: '2026-01-12T00:00:00.000Z',
      }),
    ]

    const byCreator = revenuePerCreator(records, '2026-01-01T00:00:00.000Z', '2026-01-31T23:59:59.000Z')
    expect(byCreator).toHaveLength(1)
    expect(byCreator[0].totalGross).toBe(140)

    const byEvent = revenuePerEvent(records)
    expect(byEvent).toHaveLength(1)
    expect(byEvent[0].eventId).toBe(eventId)
    expect(byEvent[0].ticketRevenue).toBe(100)
    expect(byEvent[0].fanPayments).toBe(40)

    const takeRate = platformTakeRate(records, '2026-01')
    expect(takeRate.totalGross).toBe(140)
    expect(takeRate.takeRate).toBeGreaterThan(0)
  })
})
