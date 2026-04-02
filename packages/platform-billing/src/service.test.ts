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
      plan: 'professional',
    })

    expect(sub.orgId).toBe('org-1')
    expect(sub.plan).toBe('professional')
    expect(sub.status).toBe('active')
  })

  it('checks entitlement for subscribed org', async () => {
    await svc.upsertSubscription({
      orgId: 'org-1',
      plan: 'starter',
    })

    const dashboard = await svc.checkEntitlement('org-1', 'dashboard')
    expect(dashboard.active).toBe(true)

    const sso = await svc.checkEntitlement('org-1', 'sso')
    expect(sso.active).toBe(false)
  })

  it('denies entitlement for unsubscribed org', async () => {
    const result = await svc.checkEntitlement('org-1', 'dashboard')
    expect(result.active).toBe(false)
    expect(result.key).toBe('dashboard')
  })

  it('lists all entitlements for enterprise tier', async () => {
    await svc.upsertSubscription({
      orgId: 'org-1',
      plan: 'enterprise',
    })

    const ents = await svc.listEntitlements('org-1')
    expect(ents.length).toBeGreaterThan(5)
    expect(ents.every((e) => e.active)).toBe(true)
  })

  it('checks module access correctly', async () => {
    await svc.upsertSubscription({
      orgId: 'org-1',
      plan: 'free',
    })

    expect(await svc.canAccessModule('org-1', 'dashboard')).toBe(true)
    expect(await svc.canAccessModule('org-1', 'sso')).toBe(false)
  })
})
