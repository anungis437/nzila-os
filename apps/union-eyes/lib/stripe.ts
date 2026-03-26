/**
 * Stripe client — UnionEyes.
 *
 * Delegates to @nzila/payments-stripe for a platform-managed Stripe client.
 * Kept as a thin re-export so existing `@/lib/stripe` imports continue to work.
 *
 * Uses a Proxy so the Stripe env validation is deferred to first use (runtime)
 * rather than module-load time, which would break `next build` in CI where
 * STRIPE_SECRET_KEY is not available.
 */
import { getStripeClient, verifyWebhookSignature } from '@nzila/payments-stripe'
import type StripeType from 'stripe'

export const stripe: StripeType = new Proxy({} as StripeType, {
  get(_target, prop) {
    return (getStripeClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
export { verifyWebhookSignature }

// Re-export Stripe type for files that need it for type annotations
// eslint-disable-next-line no-restricted-imports -- this IS the stripe facade
export type { default as Stripe } from 'stripe'

