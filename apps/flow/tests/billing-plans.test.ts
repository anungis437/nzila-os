import { describe, expect, it } from 'vitest'
import { getFlowPlan, planPriceCad, toCheckoutUrl } from '@/lib/billing-plans'

describe('flow billing plans', () => {
  it('returns the starter plan', () => {
    const starter = getFlowPlan('starter')
    expect(starter.name).toBe('Starter')
    expect(starter.maxUsers).toBe(5)
  })

  it('returns monthly and annual prices', () => {
    expect(planPriceCad('growth', 'monthly')).toBe(149)
    expect(planPriceCad('growth', 'annual')).toBe(1490)
  })

  it('builds checkout URL', () => {
    const url = toCheckoutUrl({
      baseUrl: 'https://flow.nzila.app/',
      orgId: 'org_123',
      plan: 'pro',
      interval: 'monthly',
    })

    expect(url).toContain('https://flow.nzila.app/billing/checkout?')
    expect(url).toContain('plan=pro')
    expect(url).toContain('interval=monthly')
  })
})
