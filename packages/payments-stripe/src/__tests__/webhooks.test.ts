import { describe, it, expect, vi, beforeEach } from 'vitest'

// Shared mock instance so tests can configure it reliably
const mockConstructEvent = vi.fn()
const mockStripeInstance = { webhooks: { constructEvent: mockConstructEvent } }

vi.mock('../client', () => ({
  getStripeClient: vi.fn(() => mockStripeInstance),
}))

vi.mock('../env', () => ({
  getStripeEnv: vi.fn(() => ({
    STRIPE_SECRET_KEY: 'sk_test_abc',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
    STRIPE_ENVIRONMENT: 'test',
    STRIPE_DEFAULT_CURRENCY: 'CAD',
    STRIPE_REFUND_APPROVAL_THRESHOLD_CENTS: 50000,
  })),
}))

import { verifyWebhookSignature, WebhookSignatureError, extractEntityIdFromEvent } from '../webhooks'
import type Stripe from 'stripe'

describe('verifyWebhookSignature', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns parsed event on valid signature', () => {
    const mockEvent = {
      id: 'evt_123',
      type: 'payment_intent.succeeded',
      data: { object: {} },
      created: 1700000000,
    } as unknown as Stripe.Event

    mockConstructEvent.mockReturnValue(mockEvent)

    const result = verifyWebhookSignature(Buffer.from('body'), 'sig_header')
    expect(result.signatureValid).toBe(true)
    expect(result.event.id).toBe('evt_123')
  })

  it('throws WebhookSignatureError on invalid signature', () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Invalid signature')
    })

    expect(() => verifyWebhookSignature(Buffer.from('body'), 'bad_sig')).toThrow(
      WebhookSignatureError,
    )
  })

  it('uses fallback message when thrown value is not an Error', () => {
    mockConstructEvent.mockImplementation(() => {
      throw 'string_error' // eslint-disable-line no-throw-literal
    })

    expect(() => verifyWebhookSignature(Buffer.from('body'), 'bad_sig')).toThrow(
      'Invalid webhook signature',
    )
  })

  it('WebhookSignatureError has correct name', () => {
    const err = new WebhookSignatureError('bad')
    expect(err.name).toBe('WebhookSignatureError')
    expect(err.message).toBe('bad')
    expect(err).toBeInstanceOf(Error)
  })
})

describe('extractEntityIdFromEvent', () => {
  it('extracts org_id from top-level metadata', () => {
    const event = {
      data: {
        object: {
          metadata: { org_id: 'ent_123' },
        },
      },
    } as unknown as Stripe.Event

    expect(extractEntityIdFromEvent(event)).toBe('ent_123')
  })

  it('extracts org_id from payment_intent metadata', () => {
    const event = {
      data: {
        object: {
          metadata: {},
          payment_intent: {
            metadata: { org_id: 'ent_456' },
          },
        },
      },
    } as unknown as Stripe.Event

    expect(extractEntityIdFromEvent(event)).toBe('ent_456')
  })

  it('returns null when no metadata org_id exists', () => {
    const event = {
      data: {
        object: {
          metadata: { other: 'value' },
        },
      },
    } as unknown as Stripe.Event

    expect(extractEntityIdFromEvent(event)).toBeNull()
  })

  it('returns null when no metadata at all', () => {
    const event = {
      data: {
        object: {},
      },
    } as unknown as Stripe.Event

    expect(extractEntityIdFromEvent(event)).toBeNull()
  })

  it('refuses contradictory organization metadata across the signed object and expanded parent', () => {
    const event = {
      data: {
        object: {
          metadata: { org_id: 'top_level' },
          payment_intent: {
            metadata: { org_id: 'nested' },
          },
        },
      },
    } as unknown as Stripe.Event

    expect(extractEntityIdFromEvent(event)).toBeNull()
  })

  it('accepts agreeing object and expanded-parent organization metadata', () => {
    const event = { data: { object: { metadata: { org_id: 'same-org' }, payment_intent: { metadata: { org_id: 'same-org' } } } } } as unknown as Stripe.Event
    expect(extractEntityIdFromEvent(event)).toBe('same-org')
  })

  it.each([42, true, {}, [], '', ' org-a', 'org-a '])('refuses malformed supplied organization metadata without falling back to a different source', (value) => {
    const event = { data: { object: { metadata: { org_id: value }, payment_intent: { metadata: { org_id: 'org-a' } } } } } as unknown as Stripe.Event
    expect(extractEntityIdFromEvent(event)).toBeNull()
  })

  it('returns null when payment_intent is a string (not expanded)', () => {
    const event = {
      data: {
        object: {
          metadata: {},
          payment_intent: 'pi_1234',
        },
      },
    } as unknown as Stripe.Event

    expect(extractEntityIdFromEvent(event)).toBeNull()
  })

  it('returns null when payment_intent is null', () => {
    const event = {
      data: {
        object: {
          metadata: {},
          payment_intent: null,
        },
      },
    } as unknown as Stripe.Event

    expect(extractEntityIdFromEvent(event)).toBeNull()
  })

  it('returns null when payment_intent object has no metadata', () => {
    const event = {
      data: {
        object: {
          metadata: {},
          payment_intent: {},
        },
      },
    } as unknown as Stripe.Event

    expect(extractEntityIdFromEvent(event)).toBeNull()
  })

  it('returns null when payment_intent metadata has no org_id', () => {
    const event = {
      data: {
        object: {
          metadata: {},
          payment_intent: {
            metadata: { other: 'value' },
          },
        },
      },
    } as unknown as Stripe.Event

    expect(extractEntityIdFromEvent(event)).toBeNull()
  })
})
