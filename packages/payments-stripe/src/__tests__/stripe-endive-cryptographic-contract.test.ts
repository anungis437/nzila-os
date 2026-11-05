import { describe, expect, it } from 'vitest'
import { createStripeClientForKey } from '../client'
import { STRIPE_API_VERSION, STRIPE_SDK_VERSION } from '../version'

/**
 * Native Stripe SDK proof: no mock implementation of signature checking.
 * Uses only local HMAC; it must not call the Stripe network or need an account.
 */
describe('Stripe Endive client and native webhook HMAC', () => {
  const stripe = createStripeClientForKey('sk_test_offline_crypto_test')
  const secret = 'whsec_offline_webhook_verification_test'
  const payload = JSON.stringify({
    id: 'evt_offline_1',
    object: 'event',
    api_version: STRIPE_API_VERSION,
    created: Math.floor(Date.now() / 1000),
    data: { object: { id: 'pi_offline_1', object: 'payment_intent' } },
    livemode: false,
    type: 'payment_intent.succeeded',
  })

  it('locks the current SDK/API contract to the published release', () => {
    expect(STRIPE_SDK_VERSION).toBe('23.1.0')
    expect(STRIPE_API_VERSION).toBe('2026-10-28.endive')
  })

  it('accepts a real Stripe HMAC over the unchanged raw payload', () => {
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret })
    const event = stripe.webhooks.constructEvent(payload, signature, secret)
    expect(event.id).toBe('evt_offline_1')
    expect(event.api_version).toBe(STRIPE_API_VERSION)
  })

  it('rejects forged, modified and missing signatures', () => {
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret })
    expect(() => stripe.webhooks.constructEvent(payload + ' ', signature, secret)).toThrow()
    expect(() => stripe.webhooks.constructEvent(payload, signature, 'whsec_wrong')).toThrow()
    expect(() => stripe.webhooks.constructEvent(payload, 't=123,v1=abc123', secret)).toThrow()
  })

  it('refuses to initialize a keyless client rather than hiding missing configuration', () => {
    expect(() => createStripeClientForKey('')).toThrow(/key must be provided/i)
  })
})
