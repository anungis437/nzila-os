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
import type { Stripe as StripeType } from '@nzila/payments-stripe'

export const stripe: StripeType = new Proxy({} as StripeType, {
  get(_target, prop) {
    return Reflect.get(getStripeClient(), prop);
  },
});
export { verifyWebhookSignature }

// Re-export Stripe type for files that need it for type annotations
export type { Stripe } from '@nzila/payments-stripe'

