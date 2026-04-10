/**
 * PartnershipAttribution — Three-tier attribution strip.
 *
 * "Powered by Zonga · Deployed for {Client} · In partnership with {Partner}"
 */
'use client'

import type { BrandAsset, BrandPlacement, BrandingFeatureFlags } from '@/lib/branding/types'
import { buildAttribution, formatAttributionText } from '@/lib/branding/partnership'
import { ZONGA_BRAND } from '@/lib/branding/registry'
import { ExternalBrandMark } from './ExternalBrandMark'

interface PartnershipAttributionProps {
  placement: BrandPlacement
  client?: BrandAsset
  partner?: BrandAsset
  flags?: BrandingFeatureFlags
  /** Render as a compact single-line or expanded multi-line */
  variant?: 'inline' | 'stacked'
  className?: string
}

export function PartnershipAttribution({
  placement,
  client,
  partner,
  flags,
  variant = 'inline',
  className = '',
}: PartnershipAttributionProps) {
  const attribution = buildAttribution(placement, ZONGA_BRAND, client, partner, flags)

  if (variant === 'inline') {
    return (
      <p className={`text-xs text-white/40 ${className}`}>
        {formatAttributionText(attribution)}
      </p>
    )
  }

  // Stacked variant
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-xs text-white/40">{attribution.platform.label}</span>
        <span className="text-xs font-medium text-white/60">{attribution.platform.name}</span>
      </div>
      {attribution.client && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40">{attribution.client.label}</span>
          <span className="text-xs font-medium text-white/60">{attribution.client.name}</span>
          {attribution.client.showLogo && client && (
            <ExternalBrandMark asset={client} placement={placement} flags={flags} maxHeight={16} />
          )}
        </div>
      )}
      {attribution.partner && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40">{attribution.partner.label}</span>
          <span className="text-xs font-medium text-white/60">{attribution.partner.name}</span>
          {attribution.partner.showLogo && partner && (
            <ExternalBrandMark asset={partner} placement={placement} flags={flags} maxHeight={16} />
          )}
        </div>
      )}
    </div>
  )
}
