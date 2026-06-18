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

  it('maps past-due/incomplete variants and defaults unknown statuses', () => {
    expect(mapStripeSubscriptionStatus('past_due')).toBe('past_due')
    expect(mapStripeSubscriptionStatus('unpaid')).toBe('past_due')
    expect(mapStripeSubscriptionStatus('incomplete')).toBe('incomplete')
    expect(mapStripeSubscriptionStatus('paused')).toBe('canceled')
    expect(mapStripeSubscriptionStatus('mystery_status')).toBe('incomplete')
  })
})

describe('mapFlowPlanFromPriceId', () => {
  it('returns null when price id is missing', () => {
    expect(mapFlowPlanFromPriceId()).toBeNull()
    expect(mapFlowPlanFromPriceId(null)).toBeNull()
  })

  it('maps starter/growth/pro ids from env', () => {
    process.env.STRIPE_FLOW_STARTER_MONTHLY_PRICE_ID = 'price_starter_m'
    process.env.STRIPE_FLOW_STARTER_ANNUAL_PRICE_ID = 'price_starter_a'
    process.env.STRIPE_FLOW_GROWTH_MONTHLY_PRICE_ID = 'price_growth_m'
    process.env.STRIPE_FLOW_GROWTH_ANNUAL_PRICE_ID = 'price_growth_a'
    process.env.STRIPE_FLOW_PRO_MONTHLY_PRICE_ID = 'price_pro_m'
    process.env.STRIPE_FLOW_PRO_ANNUAL_PRICE_ID = 'price_pro_a'

    expect(mapFlowPlanFromPriceId('price_starter_m')).toBe('starter')
    expect(mapFlowPlanFromPriceId('price_starter_a')).toBe('starter')
    expect(mapFlowPlanFromPriceId('price_growth_m')).toBe('growth')
    expect(mapFlowPlanFromPriceId('price_growth_a')).toBe('growth')
    expect(mapFlowPlanFromPriceId('price_pro_m')).toBe('pro')
    expect(mapFlowPlanFromPriceId('price_pro_a')).toBe('pro')
  })

  it('returns null for unknown price ids', () => {
    expect(mapFlowPlanFromPriceId('price_unknown')).toBeNull()
  })
})

describe('isUuid', () => {
  it('accepts valid uuid and rejects invalid values', () => {
    expect(isUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
    expect(isUuid('org_123')).toBe(false)
    expect(isUuid()).toBe(false)
    expect(isUuid(null)).toBe(false)
  })
})
