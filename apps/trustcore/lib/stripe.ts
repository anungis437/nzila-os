/** TrustCore account bridge; the shared package owns the SDK and API contract. */
import { createStripeClientForKey } from '@nzila/payments-stripe'
export async function createStripeClient(apiKey: string) {
  return createStripeClientForKey(apiKey)
}
