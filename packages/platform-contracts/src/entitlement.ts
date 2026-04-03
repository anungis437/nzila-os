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

// ── Partner Tier Gate ───────────────────────────────────────────────────────

export const partnerTierValues = [
  'registered',
  'select',
  'certified',
  'professional',
  'premier',
  'advanced',
  'enterprise',
  'elite',
  'strategic',
] as const
export type PartnerTier = (typeof partnerTierValues)[number]

export const featureGateSchema = z.object({
  /** Dotted feature key (e.g. 'deals:pipeline'). */
  feature: z.string().regex(/^[a-z][a-z0-9]*(?:[:.][a-z][a-z0-9-]*)*$/),
  /** Minimum partner tier required. */
  minTier: z.enum(partnerTierValues),
  /** If true, all access attempts are logged to the audit trail. */
  audited: z.boolean().default(false),
  /** Human-readable description for governance reports. */
  description: z.string().optional(),
})
export type FeatureGate = z.infer<typeof featureGateSchema>

export const featureGateManifestSchema = z.object({
  /** App ID owning these gates. */
  appId: z.string(),
  /** Tier hierarchy (lowest → highest). */
  tierOrder: z.array(z.enum(partnerTierValues)).min(2),
  /** Feature gates. */
  gates: z.array(featureGateSchema).min(1),
})
export type FeatureGateManifest = z.infer<typeof featureGateManifestSchema>

/**
 * Evaluate whether a partner tier satisfies a feature gate.
 */
export function checkFeatureGate(
  manifest: FeatureGateManifest,
  feature: string,
  currentTier: PartnerTier,
): FeatureAccess {
  const gate = manifest.gates.find((g) => g.feature === feature)
  if (!gate) {
    return { key: feature, granted: true }
  }
  const current = manifest.tierOrder.indexOf(currentTier)
  const required = manifest.tierOrder.indexOf(gate.minTier)
  if (current === -1 || required === -1) {
    return { key: feature, granted: false, reason: `Unknown tier` }
  }
  return {
    key: feature,
    granted: current >= required,
    reason: current < required ? `Requires ${gate.minTier} tier` : undefined,
  }
}
