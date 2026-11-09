import { ApiError } from '@/lib/api/errors'

/**
 * Member dues collection is NOT part of Union Eyes. Owner decision (closed, docs/union-eyes/README.md §1): dues and
 * per-capita remittances are handled in an external system and Union Eyes does not collect dues. The initiation and
 * verified-webhook settlement machinery is kept dormant, but no deployment switch turns collection on:
 *
 * - no source names the merchant account that would receive union dues (the union or the platform operator), and
 *   lib/stripe is the platform-managed client with no per-organization processor configuration;
 * - initiation would disclose the organization id and the member user id to the processor in the PaymentIntent
 *   metadata, and no source records the member's consent to that disclosure.
 *
 * UE_MEMBER_DUES_PAYMENTS=1 used to switch initiation on. It no longer does: the flag is read only so that a
 * deployment that still sets it gets the same 501 with the reason, rather than a payment intent created on an
 * unnamed merchant account. Enabling collection needs an owner decision naming the merchant of record, a
 * per-organization processor configuration and a recorded member disclosure consent; none exists.
 *
 * Configuring Stripe for client-commercial billing never switches member dues payment on. The verified-webhook
 * settlement path stays live so an already-pending dues payment can still be settled exactly once.
 */
export const MEMBER_DUES_COLLECTION_REFUSAL =
  'Member dues payment is not offered: dues are handled in an external system, and no merchant account, per-organization processor configuration or member disclosure consent is recorded for collecting them here'

export function isMemberDuesPaymentEnabled(_env: NodeJS.ProcessEnv = process.env): boolean {
  return false
}

export function assertMemberDuesPaymentEnabled(env: NodeJS.ProcessEnv = process.env): void {
  if (!isMemberDuesPaymentEnabled(env)) throw ApiError.notImplemented(MEMBER_DUES_COLLECTION_REFUSAL)
}
