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
} from './types.js'
export {
  SubscriptionTier,
  BillingCycle,
  SubscriptionSchema,
  UsageMetricType,
  UsageMetricSchema,
  RevenueEventType,
  RevenueEventSchema,
} from './types.js'

// Service
export type { RevenueService } from './service.js'
export {
  createInMemoryRevenueService,
  computeAppRevenueBreakdown,
} from './service.js'
