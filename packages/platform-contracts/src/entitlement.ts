/**
 * @nzila/platform-contracts — Entitlement / Subscription Contracts
 *
 * Canonical billing and access entitlement shapes. Apps use
 * these to determine module access and feature availability
 * without coupling to a specific billing provider.
 */
import { z } from 'zod'

// ── Plan Tier ───────────────────────────────────────────────────────────────

export const planTierValues = ['free', 'starter', 'professional', 'enterprise', 'custom'] as const
export type PlanTier = (typeof planTierValues)[number]

// ── Subscription Status ─────────────────────────────────────────────────────

export const subscriptionStatusValues = [
  'active',
  'trialing',
  'past_due',
  'canceled',
  'paused',
] as const

export type SubscriptionStatus = (typeof subscriptionStatusValues)[number]

// ── Entitlement ─────────────────────────────────────────────────────────────

export const entitlementSchema = z.object({
  /** Entitlement key (e.g. "module:cfo", "feature:ai-assistant"). */
  key: z.string().min(1),
  /** Whether the entitlement is currently active. */
  active: z.boolean(),
  /** Optional limit (e.g. max seats, max API calls). */
  limit: z.number().int().nonnegative().optional(),
  /** Current usage against limit. */
  usage: z.number().int().nonnegative().optional(),
  /** When the entitlement expires (if applicable). */
  expiresAt: z.string().datetime().optional(),
})

export type Entitlement = z.infer<typeof entitlementSchema>

// ── Subscription ────────────────────────────────────────────────────────────

export const subscriptionSchema = z.object({
  /** Subscription ID. */
  id: z.string().min(1),
  /** Org scope ID. */
  orgId: z.string().min(1),
  /** Plan tier. */
  plan: z.enum(planTierValues),
  /** Current status. */
  status: z.enum(subscriptionStatusValues),
  /** Active entitlements. */
  entitlements: z.array(entitlementSchema),
  /** Enabled module IDs. */
  enabledModules: z.array(z.string()),
  /** Billing cycle start date. */
  currentPeriodStart: z.string().datetime(),
  /** Billing cycle end date. */
  currentPeriodEnd: z.string().datetime(),
  /** External provider ID (e.g. Stripe subscription ID). */
  externalId: z.string().optional(),
})

export type Subscription = z.infer<typeof subscriptionSchema>

// ── Feature Access Check ────────────────────────────────────────────────────

export const featureAccessSchema = z.object({
  /** Feature/module key. */
  key: z.string().min(1),
  /** Whether access is granted. */
  granted: z.boolean(),
  /** Reason if denied. */
  reason: z.string().optional(),
  /** Remaining quota if applicable. */
  remaining: z.number().int().optional(),
})

export type FeatureAccess = z.infer<typeof featureAccessSchema>
