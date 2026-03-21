import { describe, it, expect } from 'vitest'
import {
  SUPPORTED_EVENT_TYPES,
  type NzilaStripeMetadata,
  type SupportedStripeEventType,
  type PaymentObjectType,
  type StripeReportType,
  type NormalizeResult,
  type WebhookVerifyResult,
  type ReportGenerateInput,
  type ReportArtifact,
} from '../types'

describe('SUPPORTED_EVENT_TYPES', () => {
  it('contains exactly 9 event types', () => {
    expect(SUPPORTED_EVENT_TYPES).toHaveLength(9)
  })

  it('includes all expected event types', () => {
    const expected: SupportedStripeEventType[] = [
      'checkout.session.completed',
      'payment_intent.succeeded',
      'payment_intent.payment_failed',
      'charge.refunded',
      'charge.dispute.created',
      'payout.paid',
      'invoice.paid',
      'customer.subscription.updated',
      'customer.subscription.deleted',
    ]
    for (const t of expected) {
      expect(SUPPORTED_EVENT_TYPES).toContain(t)
    }
  })

  it('is read-only', () => {
    // TypeScript enforces this, but runtime check that it's an array
    expect(Array.isArray(SUPPORTED_EVENT_TYPES)).toBe(true)
  })
})

describe('Type structure smoke tests', () => {
  it('NzilaStripeMetadata requires org_id', () => {
    const meta: NzilaStripeMetadata = { org_id: 'ent_1' }
    expect(meta.org_id).toBe('ent_1')
  })

  it('NzilaStripeMetadata supports optional venture_id', () => {
    const meta: NzilaStripeMetadata = { org_id: 'e', venture_id: 'v' }
    expect(meta.venture_id).toBe('v')
  })

  it('NormalizeResult discriminated union works for payment', () => {
    const result: NormalizeResult = {
      kind: 'payment',
      data: {
        orgId: 'e1',
        stripeObjectId: 'pi_123',
        objectType: 'payment_intent',
        status: 'succeeded',
        amountCents: BigInt(5000),
        currency: 'CAD',
        ventureId: null,
        occurredAt: new Date(),
        rawEventId: 'evt_row_1',
      },
    }
    expect(result.kind).toBe('payment')
    if (result.kind === 'payment') {
      expect(result.data.stripeObjectId).toBe('pi_123')
    }
  })

  it('NormalizeResult discriminated union works for skipped', () => {
    const result: NormalizeResult = {
      kind: 'skipped',
      reason: 'Unsupported',
    }
    expect(result.kind).toBe('skipped')
    if (result.kind === 'skipped') {
      expect(result.reason).toBe('Unsupported')
    }
  })
})
