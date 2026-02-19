/**
 * Tier gates — feature access by partner tier.
 *
 * Each tier unlocks progressively more capabilities.
 * Tiers are ordered: registered → select/certified/professional
 * → premier/advanced/enterprise → elite/strategic
 */
import type { PartnerTier } from '@/components/partner/TierBadge'

// Ordered tiers by level (0 = lowest)
const tierLevel: Record<PartnerTier, number> = {
  registered: 0,
  select: 1,
  certified: 1,
  professional: 1,
  premier: 2,
  advanced: 2,
  enterprise: 2,
  elite: 3,
  strategic: 3,
}

/**
 * Returns true if the partner's current tier meets the required tier level.
 */
export function meetsMinTier(currentTier: PartnerTier, requiredTier: PartnerTier): boolean {
  return tierLevel[currentTier] >= tierLevel[requiredTier]
}

/**
 * Feature gates keyed by feature slug → minimum tier required.
 */
export const featureGates: Record<string, PartnerTier> = {
  // Deals
  'deals:register': 'registered',
  'deals:pipeline': 'registered',

  // Commissions
  'commissions:view': 'registered',
  'commissions:export': 'select',

  // Certifications
  'certs:fundamentals': 'registered',
  'certs:vertical-specialist': 'select',
  'certs:advanced-architecture': 'premier',
  'certs:co-sell-mastery': 'premier',

  // Assets
  'assets:download': 'registered',
  'assets:white-label-generator': 'select',
  'assets:custom-upload': 'premier',

  // API Hub
  'api:sandbox': 'registered',
  'api:production': 'select',
  'api:dedicated-environment': 'elite',

  // GTM
  'gtm:playbooks': 'registered',
  'gtm:co-sell-request': 'select',
  'gtm:joint-business-plan': 'premier',
  'gtm:dedicated-partner-manager': 'elite',
}

/**
 * Check whether a partner can access a specific feature at their tier.
 */
export function canAccess(feature: string, currentTier: PartnerTier): boolean {
  const requiredTier = featureGates[feature]
  if (!requiredTier) return true // unregistered features are open
  return meetsMinTier(currentTier, requiredTier)
}

/**
 * Returns the commission multiplier for a given tier.
 */
export function tierMultiplier(tier: PartnerTier): number {
  const level = tierLevel[tier]
  switch (level) {
    case 0: return 1.0
    case 1: return 1.15
    case 2: return 1.35
    case 3: return 1.50
    default: return 1.0
  }
}

/**
 * Returns the next tier in progression, or null if already at the top.
 */
export function nextTier(current: PartnerTier, partnerType: 'channel' | 'isv' | 'enterprise'): PartnerTier | null {
  const progressions: Record<string, PartnerTier[]> = {
    channel:    ['registered', 'select', 'premier', 'elite'],
    isv:        ['registered', 'certified', 'advanced', 'strategic'],
    enterprise: ['registered', 'professional', 'enterprise'],
  }

  const path = progressions[partnerType]!
  const idx = path.indexOf(current)
  if (idx === -1 || idx >= path.length - 1) return null
  return path[idx + 1]!
}
