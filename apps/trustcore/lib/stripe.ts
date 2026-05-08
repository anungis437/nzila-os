/**
 * TrustCore — Stripe Client
 *
 * App-level Stripe client wrapper. This is the ONLY place in the TrustCore
 * app that may instantiate Stripe directly. All billing routes must import
 * from this module rather than instantiating Stripe themselves.
 *
 * @see governance: REV-008 (raw payment processing outside platform-revenue)
 */

/**
 * Creates a configured Stripe client instance.
 * Uses dynamic import to keep the Stripe SDK out of the bundle when unused.
 */
export async function createStripeClient(apiKey: string) {
  const { default: Stripe } = await import('stripe')
  return new Stripe(apiKey, { apiVersion: '2026-02-25.clover' })
}
