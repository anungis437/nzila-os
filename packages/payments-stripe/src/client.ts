/**
 * @nzila/payments-stripe — Stripe SDK client singleton
 *
 * Do NOT create multiple Stripe instances. Reuse this singleton.
 */
import Stripe from 'stripe'
import { getStripeEnv } from './env'

let _stripe: Stripe | null = null

/**
 * Get or create the Stripe SDK client.
 * Uses STRIPE_SECRET_KEY from validated env.
 */
export function getStripeClient(): Stripe {
  if (_stripe) return _stripe

  const env = getStripeEnv()

  _stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-02-25.clover',
    typescript: true,
    maxNetworkRetries: 3,
  })

  return _stripe
}
