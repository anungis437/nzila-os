import { describe, expect, it } from 'vitest'
import {
  COMMERCIAL_ANALYTICS_EVENTS,
  SHARED_NOTIFICATION_CHANNELS,
  sharedAnalyticsDashboardRowSchema,
  sharedCrmEventSchema,
  sharedLeadCaptureSchema,
  sharedReferralAttributionSchema,
} from '../commercial-layer'

describe('sharedLeadCaptureSchema', () => {
  it('accepts valid cross-app lead payload', () => {
    const result = sharedLeadCaptureSchema.safeParse({
      appId: 'flow',
      source: 'pricing_page',
      email: 'owner@example.com',
      firstName: 'Owner',
      metadata: { seats: 3 },
    })

    expect(result.success).toBe(true)
  })

  it('rejects unsupported app id', () => {
    const result = sharedLeadCaptureSchema.safeParse({
      appId: 'console',
      source: 'landing',
      email: 'owner@example.com',
    })

    expect(result.success).toBe(false)
  })
})

describe('sharedCrmEventSchema', () => {
  it('accepts canonical CRM event payload', () => {
    const result = sharedCrmEventSchema.safeParse({
      eventName: 'commercial.subscription.upgraded',
      occurredAt: new Date().toISOString(),
      appId: 'weekone',
      payload: { fromPlan: 'free', toPlan: 'pro' },
    })

    expect(result.success).toBe(true)
  })

  it('rejects unknown CRM event name', () => {
    const result = sharedCrmEventSchema.safeParse({
      eventName: 'commercial.unknown',
      occurredAt: new Date().toISOString(),
      appId: 'zonga',
      payload: {},
    })

    expect(result.success).toBe(false)
  })
})

describe('shared constants', () => {
  it('exposes analytics naming convention', () => {
    expect(COMMERCIAL_ANALYTICS_EVENTS.FLOW_PLAN_CHANGED).toBe('flow.plan.changed')
  })

  it('supports both email and sms notification channels', () => {
    expect(SHARED_NOTIFICATION_CHANNELS).toEqual(['email', 'sms'])
  })
})
describe('shared referral attribution schema', () => {
  it('validates referral conversion payloads', () => {
    const parsed = sharedReferralAttributionSchema.safeParse({
      referrerId: 'user_123',
      refereeEmail: 'new@buyer.com',
      appId: 'weekone',
      campaign: 'founder-network',
      conversionValueCents: 12900,
      convertedAt: new Date().toISOString(),
    })
    expect(parsed.success).toBe(true)
  })
})

describe('shared analytics dashboard row schema', () => {
  it('validates dashboard rows', () => {
    const parsed = sharedAnalyticsDashboardRowSchema.safeParse({
      appId: 'flow',
      metric: 'mrr',
      value: 12450,
      period: '2026-04',
      growthRatePct: 12.4,
    })
    expect(parsed.success).toBe(true)
  })
})
