/**
 * TrustCore — Subscription Resolver
 *
 * Resolves the current billing plan for an org.
 * Falls back to FREE when no subscription record exists.
 *
 * This is the single authoritative source of plan truth for all
 * feature gating in TrustCore.
 */

import { getTrustcoreSubscription } from '@nzila/db/queries/trustcore'

// ── Types ──────────────────────────────────────────────────────────────────

export type Plan = 'free' | 'pro' | 'premium'
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled'

export interface ResolvedSubscription {
  plan: Plan
  status: SubscriptionStatus
  /** True when the subscription is in a usable billing state. */
  isActive: boolean
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  currentPeriodEnd: Date | null
}

const FREE_FALLBACK: ResolvedSubscription = {
  plan: 'free',
  status: 'active',
  isActive: true,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  currentPeriodEnd: null,
}

// ── Resolver ───────────────────────────────────────────────────────────────

/**
 * Return the resolved subscription for an org.
 * When no subscription record exists, returns the FREE default.
 * A past_due or canceled subscription is treated as inactive —
 * callers may choose to downgrade access accordingly.
 */
export async function getResolvedSubscription(
  orgId: string,
): Promise<ResolvedSubscription> {
  const record = await getTrustcoreSubscription(orgId)

  if (!record) return FREE_FALLBACK

  const isActive = record.status === 'active' || record.status === 'trialing'

  return {
    plan: record.plan as Plan,
    status: record.status as SubscriptionStatus,
    isActive,
    stripeCustomerId: record.stripeCustomerId ?? null,
    stripeSubscriptionId: record.stripeSubscriptionId ?? null,
    currentPeriodEnd: record.currentPeriodEnd ?? null,
  }
}
