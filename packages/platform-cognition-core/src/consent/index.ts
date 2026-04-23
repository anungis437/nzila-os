/**
 * @nzila/platform-cognition-core/consent — Barrel
 *
 * @module @nzila/platform-cognition-core/consent
 */
export {
  RESTRICTIVE_DEFAULT_POLICY,
  buildConsentPolicy,
  policyCovers,
} from './policies'
export {
  jurisdictionProfile,
  effectiveExcludedTags,
} from './jurisdiction'
export type { JurisdictionProfile } from './jurisdiction'
export {
  preflightConsent,
  applyMemoryFilters,
  gate,
  gateAsync,
  gatedRecall,
} from './gate'
export type { GateRequest } from './gate'
