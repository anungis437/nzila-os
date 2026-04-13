/**
 * @nzila/zonga-monetization — Barrel Export
 *
 * Canonical monetization layer for the Zonga platform.
 * Streaming revenue tracking, creator payouts, platform fees,
 * event ticketing cuts, fan payments.
 *
 * @module @nzila/zonga-monetization
 */

// Types & schemas
export type {
  RevenueRecord,
  PayoutRecord,
  PlatformFeeConfig,
  CreatorRevenueSnapshot,
  EventRevenueSnapshot,
  PlatformTakeRate,
} from './types.js'
export {
  RevenueStreamType,
  PayoutStatus,
  RevenueRecordSchema,
  PayoutRecordSchema,
  PlatformFeeConfigSchema,
} from './types.js'

// Revenue tracker
export {
  calculatePlatformFee,
  buildRevenueRecord,
  aggregateByStreamType,
} from './revenue-tracker.js'

// Payout engine
export {
  generateCreatorPayouts,
  computePayoutLiability,
} from './payout-engine.js'

// Analytics hooks
export {
  revenuePerCreator,
  revenuePerEvent,
  platformTakeRate,
} from './analytics.js'
