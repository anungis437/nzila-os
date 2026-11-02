import { describe, expect, it } from 'vitest'
import { checkEntitlementInputSchema, createSubscriptionInputSchema, createBillingService } from './service'

describe('Zod 4 billing authorization inputs', () => {
  it('accepts valid tiers and exact ISO timestamps', () => {
    expect(createSubscriptionInputSchema.parse({ orgId: 'org-1', plan: 'starter', currentPeriodStart: '2026-11-02T12:00:00.000Z' }).plan).toBe('starter')
    expect(checkEntitlementInputSchema.parse({ orgId: 'org-1', featureKey: 'dashboard' }).featureKey).toBe('dashboard')
  })

  it('rejects invalid plans, timestamps and empty authorization subjects', () => {
    expect(createSubscriptionInputSchema.safeParse({ orgId: 'org-1', plan: 'superadmin' }).success).toBe(false)
    expect(createSubscriptionInputSchema.safeParse({ orgId: 'org-1', plan: 'starter', currentPeriodStart: 'tomorrow' }).success).toBe(false)
    expect(checkEntitlementInputSchema.safeParse({ orgId: '', featureKey: 'dashboard' }).success).toBe(false)
    expect(() => createBillingService({ mode: 'in-memory', nodeEnv: 'production' })).toThrow()
  })
})
