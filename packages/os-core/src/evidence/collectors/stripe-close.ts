/**
 * Evidence Collector: Stripe Month-Close Reconciliation
 *
 * Verifies that Stripe payouts, commissions, and refunds balance
 * against the internal deal and commission records at month close.
 */
import type { EvidenceArtifact } from '../types'

export interface StripeCloseOptions {
  periodLabel: string
  /** ISO month string, e.g. "2025-01" */
  month: string
  stripePayoutTotal: number
  internalCommissionTotal: number
  refundCount: number
  disputeCount: number
  /** Tolerance allowed before flagging discrepancy (e.g. 0.01 = 1%) */
  tolerancePercent?: number
}

export function collectStripeCloseEvidence(opts: StripeCloseOptions): EvidenceArtifact[] {
  const tolerance = opts.tolerancePercent ?? 0.01
  const diff = Math.abs(opts.stripePayoutTotal - opts.internalCommissionTotal)
  const diffPercent = opts.stripePayoutTotal > 0
    ? diff / opts.stripePayoutTotal
    : diff > 0 ? 1 : 0

  const reconciled = diffPercent <= tolerance

  return [
    {
      type: 'stripe-month-close',
      periodLabel: opts.periodLabel,
      month: opts.month,
      stripePayoutTotal: opts.stripePayoutTotal,
      internalCommissionTotal: opts.internalCommissionTotal,
      diffAmount: diff,
      diffPercent,
      tolerancePercent: tolerance,
      reconciled,
      refundCount: opts.refundCount,
      disputeCount: opts.disputeCount,
      passed: reconciled && opts.disputeCount === 0,
      collectedAt: new Date().toISOString(),
    },
  ]
}
