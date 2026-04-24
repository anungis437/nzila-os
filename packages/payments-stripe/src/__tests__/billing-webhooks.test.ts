import { describe, expect, it } from 'vitest'
import {
  BILLING_WEBHOOK_EVENTS,
  billingWebhookEventSchema,
  classifyBillingWebhook,
} from '../billing-webhooks'

describe('classifyBillingWebhook', () => {
  it('maps checkout completion', () => {
    expect(classifyBillingWebhook(BILLING_WEBHOOK_EVENTS.CHECKOUT_COMPLETED)).toBe('checkout_completed')
  })

  it('maps subscription cancellation', () => {
    expect(classifyBillingWebhook(BILLING_WEBHOOK_EVENTS.SUBSCRIPTION_CANCELED)).toBe('subscription_canceled')
  })

  it('returns ignored for unknown events', () => {
    expect(classifyBillingWebhook('charge.refunded')).toBe('ignored')
  })
})

describe('billingWebhookEventSchema', () => {
  it('accepts a valid payload', () => {
    const parsed = billingWebhookEventSchema.safeParse({
      type: BILLING_WEBHOOK_EVENTS.SUBSCRIPTION_UPDATED,
      orgId: 'org_123',
      status: 'active',
      currentPeriodEnd: new Date().toISOString(),
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects missing event type', () => {
    const parsed = billingWebhookEventSchema.safeParse({ orgId: 'org_123' })
    expect(parsed.success).toBe(false)
  })
})
