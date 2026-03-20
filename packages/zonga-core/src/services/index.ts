/**
 * @nzila/zonga-core — Services Barrel Export
 * @module @nzila/zonga-core/services
 */

// ── Payout ──────────────────────────────────────────────────────────────────
export { computePayoutPreview } from './payout'

// ── Audit ───────────────────────────────────────────────────────────────────
export {
  buildZongaAuditEvent,
  ZongaAuditAction,
  ZongaEntityType,
} from './audit'
export type { ZongaAuditEvent } from './audit'

// ── Rights & Splits ─────────────────────────────────────────────────────────
export {
  validateSplitShares,
  detectTerritoryConflicts,
  validateISRC,
  validateUPC,
  shouldBlockPayout,
  canActivateSplitAgreement,
} from './rights'
export type {
  SplitValidationResult,
  SplitValidationError,
  SplitErrorCode,
  TerritoryConflict,
} from './rights'

// ── Media Pipeline ──────────────────────────────────────────────────────────
export {
  validateMediaFile,
  estimateDownloadSize,
  MEDIA_LIMITS,
  QUALITY_BITRATE_MAP,
} from './media'
export type {
  MediaValidationInput,
  MediaValidationOutput,
  MediaUploadService,
  TranscodeService,
  StreamingService,
  ArtworkService,
} from './media'

// ── Events & Ticketing ──────────────────────────────────────────────────────
export {
  checkInventory,
  validatePromoCode,
  verifyTicketScan,
  computeEventSettlement,
  computeOrderTotal,
} from './events'
export type {
  InventoryCheck,
  PromoValidationResult,
  ScanVerificationResult,
  SettlementComputation,
  OrderTotalResult,
} from './events'

// ── Streaming Analytics & Fraud ─────────────────────────────────────────────
export {
  aggregateStreamEvents,
  scoreFraudSignals,
  detectStreamAnomalies,
} from './streaming'
export type {
  StreamSummary,
  FraudScore,
  FraudSignal,
  StreamAnomaly,
} from './streaming'

// ── Recommendations ─────────────────────────────────────────────────────────
export {
  filterRecommendations,
  mergeRecommendations,
  buildSimilarTracksRequest,
  buildRegionalDiscoveryRequest,
  buildSessionContinuationRequest,
} from './recommendations'
export type { RecommendationEngine } from './recommendations'
