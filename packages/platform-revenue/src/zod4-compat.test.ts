import { describe, expect, it } from 'vitest'
import { RevenueEventSchema, RevenueEventType, RevenueStatus, RevenueType, SubscriptionSchema, SubscriptionTier, BillingCycle, UnifiedRevenueRecordSchema } from './types'
const id = '550e8400-e29b-41d4-a716-446655440000', orgId = '550e8400-e29b-41d4-a716-446655440001', now = '2026-11-02T18:00:00.000Z'
const event = { id, orgId, eventType: RevenueEventType.ONE_TIME_PAYMENT, amount: 25, currency: 'CAD', metadata: { source: 'stripe', details: { receipt: 'r-1' } }, occurredAt: now }
describe('Zod 4 revenue schema compatibility', () => {
  it('parses enum values and nested metadata records', () => {
    expect(RevenueEventSchema.parse(event)).toEqual(event)
    expect(SubscriptionSchema.parse({ id, orgId, tier: SubscriptionTier.STARTER, billingCycle: BillingCycle.MONTHLY, monthlyPrice: 10, activeApps: [], startedAt: now }).tier).toBe('starter')
  })
  it('preserves unified settlement metadata and status', () => {
    expect(UnifiedRevenueRecordSchema.parse({ id, orgId, appSource: 'commerce', revenueType: RevenueType.TRANSACTION, grossAmount: 25, platformFee: 1, netAmount: 24, currency: 'CAD', timestamp: now, status: RevenueStatus.SETTLED, metadata: { receipt: 'r-1' } }).status).toBe('settled')
  })
  it('rejects malformed metadata, invalid enum values and negative fees', () => {
    expect(RevenueEventSchema.safeParse({ ...event, metadata: ['array'] }).success).toBe(false)
    expect(RevenueEventSchema.safeParse({ ...event, eventType: 'unauthorized' }).success).toBe(false)
    expect(RevenueEventSchema.safeParse({ ...event, orgId: 'other-tenant' }).success).toBe(false)
    expect(UnifiedRevenueRecordSchema.safeParse({ id, orgId, appSource: 'commerce', revenueType: RevenueType.TRANSACTION, grossAmount: 25, platformFee: -1, netAmount: 26, currency: 'CAD', timestamp: now, status: RevenueStatus.SETTLED }).success).toBe(false)
  })
})
