/**
 * Governed quote machine — Flow app.
 *
 * Wires @nzila/commerce-governance to apply approval, margin-floor,
 * discount-cap, and evidence gates to quote transitions.
 * Org-aware: accepts OrgQuotePolicy for configurable thresholds.
 */
import {
  createGovernedQuoteMachine,
  createApprovalRequiredGate,
  createMarginFloorGate,
  createDiscountCapGate,
  createQuoteCompletenessGate,
  createEvidenceRequiredGate,
  evaluateGates,
  type GovernancePolicy,
  type GateResult,
} from '@nzila/commerce-governance'
import { quoteMachine } from '@nzila/commerce-state'
import type { OrgQuotePolicy } from '@nzila/platform-commerce-org/types'
import { SHOPMOICA_QUOTE_POLICY } from '@nzila/platform-commerce-org/defaults'

export {
  createGovernedQuoteMachine,
  createApprovalRequiredGate,
  createMarginFloorGate,
  createDiscountCapGate,
  createQuoteCompletenessGate,
  createEvidenceRequiredGate,
  evaluateGates,
}
export type { GovernancePolicy, GateResult }

/**
 * Build a governed quote machine with standard NzilaOS policy gates.
 * Uses org quote policy when provided, falls back to ShopMoiCa defaults.
 */
export function buildGovernedQuoteMachine(
  policy?: Partial<GovernancePolicy>,
  orgQuotePolicy?: OrgQuotePolicy,
) {
  const qp = orgQuotePolicy ?? SHOPMOICA_QUOTE_POLICY
  return createGovernedQuoteMachine(quoteMachine, {
    approvalThreshold: qp.approvalThreshold,
    marginFloorPercent: qp.minMarginPercent,
    maxDiscountWithoutApproval: qp.maxDiscountWithoutApproval,
    requireEvidenceForInvoice: qp.requireEvidenceForInvoice,
    ...policy,
  })
}
