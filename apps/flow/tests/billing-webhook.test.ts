import { describe, expect, it } from 'vitest'
import { isUuid, mapFlowPlanFromPriceId, mapStripeSubscriptionStatus } from '@/lib/billing-webhook'

describe('mapStripeSubscriptionStatus', () => {
  it('maps active-like statuses', () => {
    expect(mapStripeSubscriptionStatus('active')).toBe('active')
    expect(mapStripeSubscriptionStatus('trialing')).toBe('active')
  })

  it('maps cancellation status', () => {
    expect(mapStripeSubscriptionStatus('canceled')).toBe('canceled')
    expect(mapStripeSubscriptionStatus('incomplete_expired')).toBe('canceled')
  })
})

describe('mapFlowPlanFromPriceId', () => {
  it('returns null for unknown price ids', () => {
    expect(mapFlowPlanFromPriceId('price_unknown')).toBeNull()
  })
})

describe('isUuid', () => {
  it('accepts valid uuid and rejects invalid values', () => {
    expect(isUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
    expect(isUuid('org_123')).toBe(false)
  })
})
