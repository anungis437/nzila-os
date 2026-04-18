/**
 * Zonga — Plan & Feature Gate Definitions
 *
 * Central source of truth for plan tiers, features, pricing,
 * entitlement limits, and fee overrides.
 * Used by guards, UI components, and subscription API routes.
 *
 * All prices in integer minor units (cents USD).
 */

// ── Listener Plans ──────────────────────────────────────────────────────────

export type ListenerPlan = 'free' | 'premium'

export interface ListenerPlanConfig {
  readonly name: string
  readonly priceMonthlyMinor: number
  readonly features: readonly ListenerFeature[]
  readonly limits: {
    readonly skipLimit: number | null
    readonly offlineTracksLimit: number | null
    readonly playlistsLimit: number | null
  }
}

export const LISTENER_PLANS: Record<ListenerPlan, ListenerPlanConfig> = {
  free: {
    name: 'Free',
    priceMonthlyMinor: 0,
    features: [
      'ad_supported_streaming',
      'create_playlists',
      'follow_artists',
      'event_discovery',
      'standard_audio',
      'tip_artists',
    ],
    limits: {
      skipLimit: 6, // per hour
      offlineTracksLimit: null, // not available
      playlistsLimit: 10,
    },
  },
  premium: {
    name: 'Premium',
    priceMonthlyMinor: 499,
    features: [
      'ad_supported_streaming',
      'create_playlists',
      'follow_artists',
      'event_discovery',
      'standard_audio',
      'tip_artists',
      'ad_free',
      'offline_downloads',
      'hifi_audio',
      'exclusive_releases',
      'enhanced_playlists',
    ],
    limits: {
      skipLimit: null, // unlimited
      offlineTracksLimit: 10000,
      playlistsLimit: null, // unlimited
    },
  },
} as const

export type ListenerFeature =
  | 'ad_supported_streaming'
  | 'create_playlists'
  | 'follow_artists'
  | 'event_discovery'
  | 'standard_audio'
  | 'tip_artists'
  | 'ad_free'
  | 'offline_downloads'
  | 'hifi_audio'
  | 'exclusive_releases'
  | 'enhanced_playlists'

/** Premium-only features */
export const PREMIUM_ONLY_FEATURES: readonly ListenerFeature[] = [
  'ad_free',
  'offline_downloads',
  'hifi_audio',
  'exclusive_releases',
  'enhanced_playlists',
]

// ── Creator Plans ───────────────────────────────────────────────────────────

export type CreatorPlan = 'starter' | 'pro' | 'business' | 'label' | 'enterprise'

export interface CreatorPlanConfig {
  readonly name: string
  readonly priceMonthlyMinor: number | null
  readonly features: readonly CreatorFeature[]
  readonly limits: {
    readonly uploadLimitPerMonth: number | null
    readonly teamMembers: number
    readonly splitParties: number
    readonly eventsPerMonth: number | null
  }
  readonly feeOverrides: {
    readonly streamCommissionPercent: number | null
    readonly ticketCommissionPercent: number | null
    readonly tipCommissionPercent: number | null
  }
}

export const CREATOR_PLANS: Record<CreatorPlan, CreatorPlanConfig> = {
  starter: {
    name: 'Starter',
    priceMonthlyMinor: 0,
    features: [
      'upload_content',
      'basic_analytics',
      'payouts',
      'audio_fingerprinting',
      'event_ticketing',
      'community_support',
    ],
    limits: {
      uploadLimitPerMonth: 5,
      teamMembers: 1,
      splitParties: 3,
      eventsPerMonth: 2,
    },
    feeOverrides: {
      streamCommissionPercent: null, // defaults to global rate (15%)
      ticketCommissionPercent: null, // defaults to global rate (7.5%)
      tipCommissionPercent: null,    // defaults to global rate (10%)
    },
  },
  pro: {
    name: 'Pro Creator',
    priceMonthlyMinor: 2900,
    features: [
      'upload_content',
      'basic_analytics',
      'payouts',
      'audio_fingerprinting',
      'event_ticketing',
      'community_support',
      'advanced_analytics',
      'priority_review',
      'bulk_upload',
      'automated_royalty_splits',
      'promoted_placement',
      'creator_assist_ai',
    ],
    limits: {
      uploadLimitPerMonth: 50,
      teamMembers: 3,
      splitParties: 10,
      eventsPerMonth: 10,
    },
    feeOverrides: {
      streamCommissionPercent: 12, // reduced from 15%
      ticketCommissionPercent: 6,  // reduced from 7.5%
      tipCommissionPercent: 8,     // reduced from 10%
    },
  },
  business: {
    name: 'Business',
    priceMonthlyMinor: 14900,
    features: [
      'upload_content',
      'basic_analytics',
      'payouts',
      'audio_fingerprinting',
      'event_ticketing',
      'community_support',
      'advanced_analytics',
      'priority_review',
      'bulk_upload',
      'automated_royalty_splits',
      'promoted_placement',
      'creator_assist_ai',
      'roster_management',
      'dedicated_manager',
      'compliance_exports',
      'api_access',
      'rights_management',
    ],
    limits: {
      uploadLimitPerMonth: null, // unlimited
      teamMembers: 10,
      splitParties: 50,
      eventsPerMonth: null, // unlimited
    },
    feeOverrides: {
      streamCommissionPercent: 10, // reduced from 15%
      ticketCommissionPercent: 5,  // reduced from 7.5%
      tipCommissionPercent: 5,     // reduced from 10%
    },
  },
  label: {
    name: 'Label',
    priceMonthlyMinor: 49900, // $499/month
    features: [
      'upload_content',
      'basic_analytics',
      'payouts',
      'audio_fingerprinting',
      'event_ticketing',
      'community_support',
      'advanced_analytics',
      'priority_review',
      'bulk_upload',
      'automated_royalty_splits',
      'promoted_placement',
      'creator_assist_ai',
      'roster_management',
      'dedicated_manager',
      'compliance_exports',
      'api_access',
      'rights_management',
      'white_label',
      'sla_guarantees',
      'custom_payment_rails',
    ],
    limits: {
      uploadLimitPerMonth: null,
      teamMembers: 50,
      splitParties: 999,
      eventsPerMonth: null,
    },
    feeOverrides: {
      streamCommissionPercent: 8,  // reduced from 15%
      ticketCommissionPercent: 4,  // reduced from 7.5%
      tipCommissionPercent: 4,     // reduced from 10%
    },
  },
  enterprise: {
    name: 'Enterprise',
    priceMonthlyMinor: null, // custom pricing
    features: [
      'upload_content',
      'basic_analytics',
      'payouts',
      'audio_fingerprinting',
      'event_ticketing',
      'community_support',
      'advanced_analytics',
      'priority_review',
      'bulk_upload',
      'automated_royalty_splits',
      'promoted_placement',
      'creator_assist_ai',
      'roster_management',
      'dedicated_manager',
      'compliance_exports',
      'api_access',
      'rights_management',
      'white_label',
      'sla_guarantees',
      'on_premise',
      'custom_payment_rails',
    ],
    limits: {
      uploadLimitPerMonth: null,
      teamMembers: 999,
      splitParties: 999,
      eventsPerMonth: null,
    },
    feeOverrides: {
      streamCommissionPercent: null, // negotiable
      ticketCommissionPercent: null, // negotiable
      tipCommissionPercent: null,    // negotiable
    },
  },
} as const

export type CreatorFeature =
  | 'upload_content'
  | 'basic_analytics'
  | 'payouts'
  | 'audio_fingerprinting'
  | 'event_ticketing'
  | 'community_support'
  | 'advanced_analytics'
  | 'priority_review'
  | 'bulk_upload'
  | 'automated_royalty_splits'
  | 'promoted_placement'
  | 'creator_assist_ai'
  | 'roster_management'
  | 'dedicated_manager'
  | 'compliance_exports'
  | 'api_access'
  | 'rights_management'
  | 'white_label'
  | 'sla_guarantees'
  | 'on_premise'
  | 'custom_payment_rails'

// ── Entitlement Checks ──────────────────────────────────────────────────────

export function hasListenerFeature(
  plan: ListenerPlan,
  feature: ListenerFeature,
): boolean {
  return LISTENER_PLANS[plan].features.includes(feature)
}

export function hasCreatorFeature(
  plan: CreatorPlan,
  feature: CreatorFeature,
): boolean {
  return CREATOR_PLANS[plan].features.includes(feature)
}

export function getCreatorLimit<K extends keyof CreatorPlanConfig['limits']>(
  plan: CreatorPlan,
  limitKey: K,
): CreatorPlanConfig['limits'][K] {
  return CREATOR_PLANS[plan].limits[limitKey]
}

export function getEffectiveCommission(
  plan: CreatorPlan,
  commissionType: keyof CreatorPlanConfig['feeOverrides'],
  defaultPercent: number,
): number {
  const override = CREATOR_PLANS[plan].feeOverrides[commissionType]
  return override ?? defaultPercent
}

// ── Audio Quality Tiers ─────────────────────────────────────────────────────

export const AUDIO_QUALITY = {
  standard: { bitrate: 128, codec: 'aac', label: 'Standard' },
  high: { bitrate: 256, codec: 'aac', label: 'High' },
  hifi: { bitrate: 1411, codec: 'flac', label: 'Hi-Fi Lossless' },
} as const

export type AudioQuality = keyof typeof AUDIO_QUALITY

// ── Stripe Price IDs (configured via env) ───────────────────────────────────

export function getStripePriceId(plan: 'premium' | 'label'): string {
  if (plan === 'premium') {
    const priceId = process.env.STRIPE_LISTENER_PREMIUM_PRICE_ID
    if (!priceId) throw new Error('STRIPE_LISTENER_PREMIUM_PRICE_ID not configured')
    return priceId
  }
  const priceId = process.env.STRIPE_LABEL_PLAN_PRICE_ID
  if (!priceId) throw new Error('STRIPE_LABEL_PLAN_PRICE_ID not configured')
  return priceId
}
