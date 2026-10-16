import { ApiError } from '@/lib/api/errors'

/**
 * Member dues collection is NOT part of the initial Union Eyes launch. The dues initiation and
 * settlement machinery is proven and kept, but it is a dormant optional capability: the member-facing
 * initiation routes answer 501 unless the deployment explicitly sets UE_MEMBER_DUES_PAYMENTS=1.
 *
 * This is deliberately independent of Stripe configuration: configuring Stripe for client-commercial
 * billing must never switch member dues payment on as a side effect. The verified-webhook settlement
 * path stays live so an already-pending dues payment can still be settled exactly once.
 */
export function isMemberDuesPaymentEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.UE_MEMBER_DUES_PAYMENTS === '1'
}

export function assertMemberDuesPaymentEnabled(env: NodeJS.ProcessEnv = process.env): void {
  if (!isMemberDuesPaymentEnabled(env))
    throw ApiError.notImplemented('Member dues payment is not enabled in this deployment')
}
