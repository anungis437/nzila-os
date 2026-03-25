/**
 * Stripe Elements client-side helper — Union-Eyes.
 *
 * Provides a shared, memoized `loadStripe()` promise for all client-side
 * Stripe Elements components. This avoids duplicate Stripe.js script loads
 * and centralizes the publishable key configuration.
 *
 * Usage:
 * ```tsx
 * import { getStripePromise } from '@/lib/stripe-elements'
 * <Elements stripe={getStripePromise()}>
 *   <PaymentElement />
 * </Elements>
 * ```
 */
// eslint-disable-next-line no-restricted-imports -- this IS the stripe-elements facade
import { loadStripe } from '@stripe/stripe-js'
// eslint-disable-next-line no-restricted-imports -- this IS the stripe-elements facade
import type { Stripe } from '@stripe/stripe-js'

let _stripePromise: Promise<Stripe | null> | null = null

/**
 * Returns a memoized promise that resolves to the Stripe client.
 * Safe to call multiple times — only one Stripe.js load will occur.
 */
export function getStripePromise(): Promise<Stripe | null> {
  if (!_stripePromise) {
    _stripePromise = loadStripe(
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
    )
  }
  return _stripePromise
}
