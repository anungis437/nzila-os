import { describe, it, expect, beforeEach } from 'vitest'
import {
  createInMemoryBillingService,
  type BillingService,
} from './service.js'

describe('InMemoryBillingService', () => {
  let svc: BillingService

  beforeEach(() => {
    svc = createInMemoryBillingService()
  })

  it('returns null for org without subscription', async () => {
    const sub = await svc.getSubscription('org-1')
    expect(sub).toBeNull()
  })

  it('creates a subscription', async () => {
    const sub = await svc.upsertSubscription({
      orgId: 'org-1',
      planTier: 'professional',
      billingEmail: 'billing@org-1.com',
    })

    expect(sub.orgId).toBe('org-1')
    expect(sub.planTier).toBe('professional')
    expect(sub.status).toBe('active')
  })

  it('checks entitlement for subscribed org', async () => {
    await svc.upsertSubscription({
      orgId: 'org-1',
      planTier: 'starter',
      billingEmail: 'billing@org-1.com',
    })

    const dashboard = await svc.checkEntitlement('org-1', 'dashboard')
    expect(dashboard.enabled).toBe(true)

    const sso = await svc.checkEntitlement('org-1', 'sso')
    expect(sso.enabled).toBe(false)
  })

  it('denies entitlement for unsubscribed org', async () => {
    const result = await svc.checkEntitlement('org-1', 'dashboard')
    expect(result.enabled).toBe(false)
    expect(result.reason).toBe('no_active_subscription')
  })

  it('lists all entitlements for enterprise tier', async () => {
    await svc.upsertSubscription({
      orgId: 'org-1',
      planTier: 'enterprise',
      billingEmail: 'billing@org-1.com',
    })

    const ents = await svc.listEntitlements('org-1')
    expect(ents.length).toBeGreaterThan(5)
    expect(ents.every((e) => e.enabled)).toBe(true)
  })

  it('checks module access correctly', async () => {
    await svc.upsertSubscription({
      orgId: 'org-1',
      planTier: 'free',
      billingEmail: 'billing@org-1.com',
    })

    expect(await svc.canAccessModule('org-1', 'dashboard')).toBe(true)
    expect(await svc.canAccessModule('org-1', 'sso')).toBe(false)
  })
})
