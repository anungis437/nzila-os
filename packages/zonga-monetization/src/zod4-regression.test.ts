import { describe, expect, it } from 'vitest'
import { RevenueRecordSchema, PayoutRecordSchema, RevenueStreamType, PayoutStatus } from './types'
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const revenue = { id, orgId: id, creatorId: id, revenueStreamType: RevenueStreamType.STREAMING, grossAmount: 10, platformFee: 3, netAmount: 7, currency: 'USD', recordedAt: '2026-01-01T00:00:00.000Z' }
describe('Zod 4 monetization compatibility', () => {
  it('preserves enum and metadata contracts', () => {
    expect(RevenueRecordSchema.parse({ ...revenue, metadata: { nested: { tier: 1 } } }).metadata).toEqual({ nested: { tier: 1 } })
    expect(RevenueRecordSchema.safeParse({ ...revenue, revenueStreamType: 'forged' }).success).toBe(false)
    expect(RevenueRecordSchema.safeParse({ ...revenue, metadata: ['invalid'] }).success).toBe(false)
    expect(RevenueRecordSchema.safeParse({ ...revenue, grossAmount: -1 }).success).toBe(false)
  })
  it('retains payout status validation', () => {
    const payout = { id, orgId: id, creatorId: id, amount: 7, currency: 'USD', status: PayoutStatus.PENDING, revenueRecordIds: [id], initiatedAt: '2026-01-01T00:00:00.000Z' }
    expect(PayoutRecordSchema.safeParse(payout).success).toBe(true)
    expect(PayoutRecordSchema.safeParse({ ...payout, status: 'forged' }).success).toBe(false)
  })
})
