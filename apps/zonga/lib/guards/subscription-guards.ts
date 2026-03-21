/**
 * Zonga — Subscription & Feature Gate Guards (S1–S6)
 *
 * Runtime enforcement of plan-based access control.
 *
 * S1: Premium-only features require active premium subscription
 * S2: Label features require label or enterprise plan
 * S3: Enterprise features require enterprise plan
 * S4: Download gating — premium only
 * S5: Audio quality gating — standard for free, hifi for premium
 * S6: Active subscription status check
 */

import { logger } from '@/lib/logger'
import {
  PREMIUM_ONLY_FEATURES,
  LABEL_ONLY_FEATURES,
  ENTERPRISE_ONLY_FEATURES,
  type ListenerPlan,
  type ListenerFeature,
  type CreatorPlan,
  type CreatorFeature,
  type AudioQuality,
} from '@/lib/plans'

export interface SubscriptionGuardResult {
  passed: boolean
  invariant: string
  details?: string
}

// ── Listener Guards ─────────────────────────────────────────────────────────

/** S1: Check if a listener has access to a specific feature */
export function guardListenerFeature(
  plan: ListenerPlan,
  feature: ListenerFeature,
): SubscriptionGuardResult {
  if (plan === 'premium') {
    return { passed: true, invariant: 'S1_LISTENER_FEATURE_ACCESS' }
  }

  // Free plan — block premium-only features
  if ((PREMIUM_ONLY_FEATURES as readonly string[]).includes(feature)) {
    logger.info('S1 GATE: Listener feature blocked — premium required', { plan, feature })
    return {
      passed: false,
      invariant: 'S1_LISTENER_FEATURE_ACCESS',
      details: `Feature '${feature}' requires premium plan (current: ${plan})`,
    }
  }

  return { passed: true, invariant: 'S1_LISTENER_FEATURE_ACCESS' }
}

/** S4: Download access — premium only */
export function guardCanDownload(plan: ListenerPlan): SubscriptionGuardResult {
  if (plan !== 'premium') {
    logger.info('S4 GATE: Download blocked — premium required', { plan })
    return {
      passed: false,
      invariant: 'S4_DOWNLOAD_ACCESS',
      details: 'Downloads require a premium subscription',
    }
  }
  return { passed: true, invariant: 'S4_DOWNLOAD_ACCESS' }
}

/** S5: Audio quality — free gets standard, premium gets hifi */
export function guardAudioQuality(
  plan: ListenerPlan,
  requestedQuality: AudioQuality,
): SubscriptionGuardResult {
  if (plan === 'premium') {
    return { passed: true, invariant: 'S5_AUDIO_QUALITY' }
  }

  if (requestedQuality === 'hifi') {
    return {
      passed: false,
      invariant: 'S5_AUDIO_QUALITY',
      details: 'Hi-Fi lossless audio requires a premium subscription',
    }
  }

  return { passed: true, invariant: 'S5_AUDIO_QUALITY' }
}

/** S6: Subscription status check — active or trialing */
export function guardSubscriptionActive(
  subscriptionStatus: string | null | undefined,
): SubscriptionGuardResult {
  const active = subscriptionStatus === 'active' || subscriptionStatus === 'trialing'

  if (!active && subscriptionStatus != null) {
    logger.warn('S6 GATE: Subscription not active', { subscriptionStatus })
    return {
      passed: false,
      invariant: 'S6_SUBSCRIPTION_ACTIVE',
      details: `Subscription status '${subscriptionStatus}' is not active`,
    }
  }

  return { passed: true, invariant: 'S6_SUBSCRIPTION_ACTIVE' }
}

// ── Creator/Label Guards ────────────────────────────────────────────────────

const PLAN_HIERARCHY: Record<CreatorPlan, number> = {
  artist: 0,
  label: 1,
  enterprise: 2,
}

/** S2: Check if a creator has access to label-tier features */
export function guardCreatorFeature(
  plan: CreatorPlan,
  feature: CreatorFeature,
): SubscriptionGuardResult {
  if (PLAN_HIERARCHY[plan] >= PLAN_HIERARCHY.enterprise) {
    return { passed: true, invariant: 'S2_CREATOR_FEATURE_ACCESS' }
  }

  if ((ENTERPRISE_ONLY_FEATURES as readonly string[]).includes(feature)) {
    if (PLAN_HIERARCHY[plan] < PLAN_HIERARCHY.enterprise) {
      logger.info('S3 GATE: Enterprise feature blocked', { plan, feature })
      return {
        passed: false,
        invariant: 'S3_ENTERPRISE_FEATURE_ACCESS',
        details: `Feature '${feature}' requires enterprise plan (current: ${plan})`,
      }
    }
  }

  if ((LABEL_ONLY_FEATURES as readonly string[]).includes(feature)) {
    if (PLAN_HIERARCHY[plan] < PLAN_HIERARCHY.label) {
      logger.info('S2 GATE: Label feature blocked', { plan, feature })
      return {
        passed: false,
        invariant: 'S2_CREATOR_FEATURE_ACCESS',
        details: `Feature '${feature}' requires label plan or above (current: ${plan})`,
      }
    }
  }

  return { passed: true, invariant: 'S2_CREATOR_FEATURE_ACCESS' }
}

/** S2: Bulk check — does the plan include a required minimum tier? */
export function guardCreatorPlanTier(
  currentPlan: CreatorPlan,
  requiredPlan: CreatorPlan,
): SubscriptionGuardResult {
  if (PLAN_HIERARCHY[currentPlan] < PLAN_HIERARCHY[requiredPlan]) {
    return {
      passed: false,
      invariant: 'S2_PLAN_TIER_CHECK',
      details: `Plan '${currentPlan}' is below required tier '${requiredPlan}'`,
    }
  }
  return { passed: true, invariant: 'S2_PLAN_TIER_CHECK' }
}

// ── Composite Helpers ───────────────────────────────────────────────────────

/** Quick check: is the listener on a premium plan with active subscription? */
export function isListenerPremium(
  plan: ListenerPlan | null | undefined,
  subscriptionStatus: string | null | undefined,
): boolean {
  return plan === 'premium' && (subscriptionStatus === 'active' || subscriptionStatus === 'trialing')
}

/** Quick check: is the creator on a label plan with active subscription? */
export function isCreatorLabel(
  plan: CreatorPlan | null | undefined,
  subscriptionStatus: string | null | undefined,
): boolean {
  if (!plan) return false
  const tier = PLAN_HIERARCHY[plan] ?? 0
  return tier >= PLAN_HIERARCHY.label && (subscriptionStatus === 'active' || subscriptionStatus === 'trialing')
}

/** Maximum audio quality allowed for the listener's plan */
export function maxAudioQuality(plan: ListenerPlan): AudioQuality {
  return plan === 'premium' ? 'hifi' : 'high'
}
