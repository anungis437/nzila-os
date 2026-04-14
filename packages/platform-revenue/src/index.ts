/**
 * @nzila/platform-revenue — Barrel Export
 *
 * Cross-app revenue awareness for Nzila OS.
 * Subscription models, usage metrics, billing hooks, revenue events.
 *
 * @module @nzila/platform-revenue
 */

// Types & schemas
export type {
  Subscription,
  UsageMetric,
  RevenueEvent,
  RevenueSummary,
  BillingHook,
  UnifiedRevenueRecord,
} from './types'
export {
  SubscriptionTier,
  BillingCycle,
  SubscriptionSchema,
  UsageMetricType,
  UsageMetricSchema,
  RevenueEventType,
  RevenueEventSchema,
  RevenueType,
  RevenueStatus,
  UnifiedRevenueRecordSchema,
} from './types'

// Service
export type { RevenueService } from './service'
export {
  createInMemoryRevenueService,
  computeAppRevenueBreakdown,
  emitRevenueEvent,
  getRevenueAuditLog,
} from './service'

// Evidence bridge
export type { RevenueAuditEntry } from './evidence-bridge'
export {
  buildRevenueAuditEntry,
  buildPayoutAuditEntry,
  buildFeeAuditEntry,
} from './evidence-bridge'
