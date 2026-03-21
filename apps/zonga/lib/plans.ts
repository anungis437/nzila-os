/**
 * Zonga — Plan & Feature Gate Definitions
 *
 * Central source of truth for plan tiers, features, and pricing.
 * Used by guards, UI components, and subscription API routes.
 */

// ── Listener Plans ──────────────────────────────────────────────────────────

export type ListenerPlan = 'free' | 'premium'

export const LISTENER_PLANS = {
  free: {
    name: 'Free',
    priceMonthly: 0,
    features: [
      'ad_supported_streaming',
      'create_playlists',
      'follow_artists',
      'event_discovery',
      'standard_audio',
      'tip_artists',
    ] as const,
  },
  premium: {
    name: 'Premium',
    priceMonthly: 499, // cents
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
    ] as const,
  },
} as const

export type ListenerFeature = (typeof LISTENER_PLANS)['premium']['features'][number]

/** Premium-only features */
export const PREMIUM_ONLY_FEATURES: readonly ListenerFeature[] = [
  'ad_free',
  'offline_downloads',
  'hifi_audio',
  'exclusive_releases',
  'enhanced_playlists',
]

// ── Creator Plans ───────────────────────────────────────────────────────────

export type CreatorPlan = 'artist' | 'label' | 'enterprise'

export const CREATOR_PLANS = {
  artist: {
    name: 'Artist',
    priceMonthly: 0,
    features: [
      'upload_content',
      'basic_analytics',
      'payouts',
      'audio_fingerprinting',
      'event_ticketing',
      'community_support',
    ] as const,
  },
  label: {
    name: 'Label',
    priceMonthly: 4900, // cents
    features: [
      'upload_content',
      'basic_analytics',
      'payouts',
      'audio_fingerprinting',
      'event_ticketing',
      'community_support',
      'roster_management',
      'automated_royalty_splits',
      'advanced_analytics',
      'priority_review',
      'bulk_upload',
      'dedicated_manager',
      'compliance_exports',
    ] as const,
  },
  enterprise: {
    name: 'Enterprise',
    priceMonthly: null, // custom pricing
    features: [
      'upload_content',
      'basic_analytics',
      'payouts',
      'audio_fingerprinting',
      'event_ticketing',
      'community_support',
      'roster_management',
      'automated_royalty_splits',
      'advanced_analytics',
      'priority_review',
      'bulk_upload',
      'dedicated_manager',
      'compliance_exports',
      'api_access',
      'white_label',
      'sla_guarantees',
      'on_premise',
      'custom_payment_rails',
      'rights_management',
    ] as const,
  },
} as const

export type CreatorFeature = (typeof CREATOR_PLANS)['enterprise']['features'][number]

/** Features that require Label plan or above */
export const LABEL_ONLY_FEATURES: readonly CreatorFeature[] = [
  'roster_management',
  'automated_royalty_splits',
  'advanced_analytics',
  'priority_review',
  'bulk_upload',
  'dedicated_manager',
  'compliance_exports',
]

/** Features that require Enterprise plan */
export const ENTERPRISE_ONLY_FEATURES: readonly CreatorFeature[] = [
  'api_access',
  'white_label',
  'sla_guarantees',
  'on_premise',
  'custom_payment_rails',
  'rights_management',
]

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
