/** The one Stripe server SDK factory across Nzila. */
import Stripe from 'stripe'
import { getStripeEnv } from './env'
import { STRIPE_API_VERSION } from './version'

let _stripe: Stripe | null = null

/** Explicitly supplied account key; always uses the same Endive API version. */
export function createStripeClientForKey(apiKey: string): Stripe {
  if (!apiKey || !apiKey.trim()) throw new Error('Stripe API key must be provided')
  return new Stripe(apiKey, {
    apiVersion: STRIPE_API_VERSION,
    typescript: true,
    maxNetworkRetries: 3,
  })
}

export function getStripeClient(): Stripe {
  if (_stripe) return _stripe
  _stripe = createStripeClientForKey(getStripeEnv().STRIPE_SECRET_KEY)
  return _stripe
}
