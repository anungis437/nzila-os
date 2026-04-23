/**
 * @nzila/platform-growth-os — Public barrel
 *
 * Apps SHOULD prefer focused subpaths (`/campaigns`, `/scoring`,
 * `/attribution`, `/proof`, `/founder`, `/next-best-action`) so Phase-2
 * boundary changes are caught precisely. The root barrel is provided for
 * ergonomic exploration.
 *
 * @module @nzila/platform-growth-os
 */

// Types
export type {
  GrowthScope,
  BrandVoice,
  Campaign,
  CampaignChannel,
  CampaignStatus,
  AudienceSegment,
  AudiencePredicate,
  CampaignRun,
  CampaignRunResult,
  ContentAsset,
  ApprovalState,
  CommercialOffer,
  OfferComponent,
  LeadStage,
  LeadScoreFeatures,
  LeadScore,
  ScoreContribution,
  NextActionKind,
  NextBestAction,
  AttributionEventKind,
  AttributionEvent,
  AttributionModel,
  AttributionResult,
  AttributionContribution,
  ProofRequestStatus,
  ProofRequest,
  ProofKpiBaseline,
  ProofPermission,
  FounderTopic,
  AuditEntry,
} from './types'

export { GROWTH_OS_VERSION } from './types'

// Schemas
export * from './schemas'

// Utils (curated re-exports)
export {
  nowISO,
  makeId,
  scopeKey,
  clamp01,
  sigmoid,
  sha256,
  daysBetween,
} from './utils'

// Store
export { setGrowthStoreRoot } from './store'

// Sub-engines
export * as campaigns from './campaigns/index'
export * as scoring from './scoring/index'
export * as attribution from './attribution/index'
export * as proof from './proof/index'
export * as founder from './founder/index'

// Outbound pipeline modules
export * as icp from './icp/index'
export * as unionMap from './union-map/index'
export * as sequences from './sequences/index'
export * as events from './events/index'

// ICP types
export type {
  UnionSector,
  IcpTier,
  IcpSegment,
  OrganisationAttributes,
  IcpScore,
  IcpScoreContribution,
  TargetOrganisation,
} from './icp/types'

// Union map types
export type {
  UnionScope,
  UnionNode,
  ExpansionRelationType,
  ExpansionRelationship,
  UnionMapStats,
} from './union-map/types'
export type { ExpansionTarget } from './union-map/map'

// Sequence types
export type {
  SequenceChannel,
  SequenceKind,
  SequenceStep,
  OutreachSequence,
  SequenceInstance,
  SequenceInstanceStatus,
} from './sequences/types'

// Event pipeline types
export type {
  EventType,
  EventLead,
  EventLeadStatus,
  ConferenceEvent,
  ConferencePlaybookState,
} from './events/types'

// Recommender (top-level re-export — no submodule namespace)
export {
  NBA_VERSION,
  recommendNextBestAction,
  recommendBatch,
} from './recommend/next-best-action'
