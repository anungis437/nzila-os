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
 * Configuring Stripe for client-commercial billing never switches member dues payment on. Verified-webhook settlement
 * is unavailable as well (MEMBER_DUES_SETTLEMENT_REFUSAL): SYSTEM holds no authority over the dues tables.
 */
export const MEMBER_DUES_COLLECTION_REFUSAL =
  'Member dues payment is not offered: dues are handled in an external system, and no merchant account, per-organization processor configuration or member disclosure consent is recorded for collecting them here'

/** The SYSTEM role holds zero authority over dues_transactions and member_dues_ledger (ZERO_SYSTEM_MUTATION_TABLES in
 * scripts/bootstrap-v2/system-mutation-contracts.ts). A verified processor event for a member dues payment therefore has
 * no settlement path here: the webhook answers 501 and writes nothing, and the database refuses the settlement writer. */
export const MEMBER_DUES_SETTLEMENT_REFUSAL =
  'Member dues settlement is not available: dues are handled in an external system, and Union Eyes holds no system authority over dues transactions or the member dues ledger'

export function isMemberDuesPaymentEnabled(_env: NodeJS.ProcessEnv = process.env): boolean {
  return false
}

export function assertMemberDuesPaymentEnabled(env: NodeJS.ProcessEnv = process.env): void {
  if (!isMemberDuesPaymentEnabled(env)) throw ApiError.notImplemented(MEMBER_DUES_COLLECTION_REFUSAL)
}
