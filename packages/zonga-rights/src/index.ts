/**
 * @nzila/zonga-rights — Hardened rights, royalties, splits, and disputes
 */

// ── Types & Schemas ───────────────────────────────────────────────────────
export {
  // Enums
  RightsType,
  ContributorRole,
  AgreementStatus,
  DisputeStatus,
  DisputeType,
  RoyaltyTrigger,

  // Interfaces
  type RightsHolder,
  type RightsOwnership,
  type SplitAgreement,
  type SplitEntry,
  type Signatory,
  type RoyaltyRule,
  type RoyaltyAccrual,
  type RightsDispute,
  type RightsVersionHistory,

  // Schemas
  CreateSplitAgreementSchema,
  AmendSplitAgreementSchema,
  FileDisputeSchema,
  ResolveDisputeSchema,
  RegisterRoyaltyRuleSchema,
} from './types'

// ── Agreement Engine ──────────────────────────────────────────────────────
export {
  validateSplits,
  isFullySigned,
  canAmend,
  canSign,
  recordSignature,
  computeAgreementStatus,
  buildVersionHistoryEntry,
  type SplitValidation,
} from './agreements'

// ── Royalty Engine ────────────────────────────────────────────────────────
export {
  calculateRoyalties,
  checkPayoutReadiness,
  summarizeRoyalties,
  type RoyaltyCalculation,
  type HolderAccrual,
  type PayoutReadiness,
  type RoyaltySummary,
} from './royalties'

// ── Dispute Engine ────────────────────────────────────────────────────────
export {
  canFileDispute,
  canTransitionDispute,
  getAvailableDisputeTransitions,
  shouldFreezePayouts,
  getFrozenAssets,
  type DisputeAction,
  type DisputeResolutionResult,
} from './disputes'
