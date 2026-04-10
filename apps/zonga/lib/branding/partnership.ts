/**
 * Zonga — Partnership Attribution
 *
 * Handles the three-tier attribution pattern:
 *   "Powered by Zonga / Deployed for {Client} / In partnership with {Partner}"
 *
 * @module @zonga/branding/partnership
 */

import type {
  BrandAsset,
  BrandPlacement,
  BrandingFeatureFlags,
} from './types'
import { canRenderBrand, getSafeBrandMode } from './policy'

// ── Attribution Line Builders ───────────────────────────────────────────────

export interface AttributionLine {
  label: string
  name: string
  logoUrl?: string
  showLogo: boolean
}

export interface PartnershipAttribution {
  platform: AttributionLine
  client?: AttributionLine
  partner?: AttributionLine
}

/**
 * Build a structured attribution for a given placement.
 * Respects policy rules and feature flags.
 */
export function buildAttribution(
  placement: BrandPlacement,
  platform: BrandAsset,
  client?: BrandAsset,
  partner?: BrandAsset,
  flags?: BrandingFeatureFlags,
): PartnershipAttribution {
  const platformMode = getSafeBrandMode('platform', placement, flags)

  const result: PartnershipAttribution = {
    platform: {
      label: 'Powered by',
      name: platform.name,
      logoUrl: platform.logoUrl,
      showLogo: platformMode === 'logo' || platformMode === 'muted_logo',
    },
  }

  if (client) {
    const clientMode = getSafeBrandMode('client', placement, flags)
    if (clientMode !== 'hidden') {
      result.client = {
        label: 'Deployed for',
        name: client.name,
        logoUrl: client.logoUrl,
        showLogo: clientMode === 'logo' || clientMode === 'muted_logo',
      }
    }
  }

  if (partner) {
    const partnerMode = getSafeBrandMode('partner', placement, flags)
    if (partnerMode !== 'hidden') {
      result.partner = {
        label: 'In partnership with',
        name: partner.name,
        logoUrl: partner.logoUrl,
        showLogo: partnerMode === 'logo' || partnerMode === 'muted_logo',
      }
    }
  }

  return result
}

/**
 * Format a single-line attribution string.
 *
 * Example: "Powered by Zonga · Deployed for MS Célébration · In partnership with Rock Power"
 */
export function formatAttributionText(attribution: PartnershipAttribution): string {
  const parts: string[] = [`${attribution.platform.label} ${attribution.platform.name}`]

  if (attribution.client) {
    parts.push(`${attribution.client.label} ${attribution.client.name}`)
  }
  if (attribution.partner) {
    parts.push(`${attribution.partner.label} ${attribution.partner.name}`)
  }

  return parts.join(' · ')
}

/**
 * Get a short relationship label for a partner in a given placement.
 * Uses the partner's custom relationshipLabel if set.
 */
export function getPartnerRelationshipLabel(partner: BrandAsset): string {
  return partner.relationshipLabel ?? 'Distribution Partner'
}

/**
 * Determine the maximum number of external brands visible in a placement.
 * Useful for layout calculations.
 */
export function countVisibleExternalBrands(
  placement: BrandPlacement,
  hasClient: boolean,
  hasPartner: boolean,
  flags?: BrandingFeatureFlags,
): number {
  let count = 0
  if (hasClient && canRenderBrand('client', placement, 'text_only', flags)) count++
  if (hasPartner && canRenderBrand('partner', placement, 'text_only', flags)) count++
  return count
}
