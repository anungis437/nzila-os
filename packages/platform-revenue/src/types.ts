/**
 * @nzila/platform-revenue — Types
 *
 * Cross-app revenue model: subscriptions, usage metrics, billing hooks, revenue events.
 */
import { z } from 'zod'

// ── Subscription Models ──────────────────────────────────

export const SubscriptionTier = {
  FREE: 'free',
  STARTER: 'starter',
  PROFESSIONAL: 'professional',
  ENTERPRISE: 'enterprise',
} as const
export type SubscriptionTier = (typeof SubscriptionTier)[keyof typeof SubscriptionTier]

export const BillingCycle = {
  MONTHLY: 'monthly',
  ANNUAL: 'annual',
} as const
export type BillingCycle = (typeof BillingCycle)[keyof typeof BillingCycle]

export const SubscriptionSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  tier: z.nativeEnum(SubscriptionTier),
  billingCycle: z.nativeEnum(BillingCycle),
  monthlyPrice: z.number().nonnegative(),
  activeApps: z.array(z.string()),
  startedAt: z.string().datetime(),
  renewsAt: z.string().datetime().optional(),
  cancelledAt: z.string().datetime().optional(),
})
export type Subscription = z.infer<typeof SubscriptionSchema>

// ── Usage Metrics ────────────────────────────────────────

export const UsageMetricType = {
  API_CALLS: 'api_calls',
  STORAGE_GB: 'storage_gb',
  AI_REQUESTS: 'ai_requests',
  ACTIVE_USERS: 'active_users',
  TRANSACTIONS: 'transactions',
} as const
export type UsageMetricType = (typeof UsageMetricType)[keyof typeof UsageMetricType]

export const UsageMetricSchema = z.object({
  orgId: z.string().uuid(),
  metricType: z.nativeEnum(UsageMetricType),
  value: z.number().nonnegative(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
})
export type UsageMetric = z.infer<typeof UsageMetricSchema>

// ── Revenue Events ───────────────────────────────────────

export const RevenueEventType = {
  SUBSCRIPTION_STARTED: 'subscription_started',
  SUBSCRIPTION_RENEWED: 'subscription_renewed',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',
  SUBSCRIPTION_UPGRADED: 'subscription_upgraded',
  USAGE_OVERAGE_BILLED: 'usage_overage_billed',
  ONE_TIME_PAYMENT: 'one_time_payment',
  ZONGA_REVENUE: 'zonga_revenue',
  COMMERCE_REVENUE: 'commerce_revenue',
} as const
export type RevenueEventType = (typeof RevenueEventType)[keyof typeof RevenueEventType]

export const RevenueEventSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  eventType: z.nativeEnum(RevenueEventType),
  amount: z.number(),
  currency: z.string().length(3),
  appId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  occurredAt: z.string().datetime(),
})
export type RevenueEvent = z.infer<typeof RevenueEventSchema>

// ── Unified Revenue Record ───────────────────────────────

export const RevenueType = {
  SUBSCRIPTION: 'subscription',
  TRANSACTION: 'transaction',
  EVENT: 'event',
  PAYOUT: 'payout',
} as const
export type RevenueType = (typeof RevenueType)[keyof typeof RevenueType]

export const RevenueStatus = {
  PENDING: 'pending',
  SETTLED: 'settled',
  FAILED: 'failed',
  REFUNDED: 'refunded',
} as const
export type RevenueStatus = (typeof RevenueStatus)[keyof typeof RevenueStatus]

export const UnifiedRevenueRecordSchema = z.object({
  id: z.string().uuid(),
  entityId: z.string().uuid(),
  appSource: z.string(),
  revenueType: z.nativeEnum(RevenueType),
  grossAmount: z.number(),
  platformFee: z.number().nonnegative(),
  netAmount: z.number(),
  currency: z.string().length(3),
  timestamp: z.string().datetime(),
  status: z.nativeEnum(RevenueStatus),
  metadata: z.record(z.unknown()).optional(),
})
export type UnifiedRevenueRecord = z.infer<typeof UnifiedRevenueRecordSchema>

// ── Revenue Summary ──────────────────────────────────────

export interface RevenueSummary {
  orgId: string
  period: string
  subscriptionRevenue: number
  usageRevenue: number
  transactionRevenue: number
  totalRevenue: number
  byApp: Record<string, number>
  byEventType: Record<RevenueEventType, number>
}

// ── Billing Hooks ────────────────────────────────────────

export interface BillingHook {
  event: RevenueEventType
  handler: (event: RevenueEvent) => Promise<void>
}
