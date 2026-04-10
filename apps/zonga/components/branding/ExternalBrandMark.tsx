/**
 * ExternalBrandMark — Renders a client or partner brand mark.
 *
 * Enforces:
 * - Policy check before rendering (DENY by default)
 * - Grayscale / muted / opacity constraints per mode
 * - Max size capping (external logos never outsize Zonga)
 * - Forbidden placement blocking
 */
'use client'

import Image from 'next/image'
import type { BrandAsset, BrandPlacement, BrandingFeatureFlags } from '@/lib/branding/types'
import { evaluateBrandPolicy } from '@/lib/branding/policy'

interface ExternalBrandMarkProps {
  asset: BrandAsset
  placement: BrandPlacement
  flags?: BrandingFeatureFlags
  /** Max logo height in px (capped at 28 to never outsize Zonga) */
  maxHeight?: number
  className?: string
}

const MAX_EXTERNAL_LOGO_HEIGHT = 28

export function ExternalBrandMark({
  asset,
  placement,
  flags,
  maxHeight = MAX_EXTERNAL_LOGO_HEIGHT,
  className = '',
}: ExternalBrandMarkProps) {
  const directive = evaluateBrandPolicy(asset.role, placement, 'logo', flags)

  // If full logo not allowed, try text_only
  if (!directive.allowed) {
    const textDirective = evaluateBrandPolicy(asset.role, placement, 'text_only', flags)
    if (!textDirective.allowed) return null

    return (
      <span className={`text-sm text-white/60 ${className}`}>
        {asset.shortName ?? asset.name}
      </span>
    )
  }

  const effectiveHeight = Math.min(maxHeight, MAX_EXTERNAL_LOGO_HEIGHT)

  const modeClasses = (() => {
    switch (directive.mode) {
      case 'grayscale_logo':
        return 'grayscale opacity-50'
      case 'muted_logo':
        return 'opacity-60'
      default:
        return ''
    }
  })()

  if (asset.logoUrl) {
    return (
      <Image
        src={asset.logoUrl}
        alt={`${asset.name} logo`}
        height={effectiveHeight}
        width={effectiveHeight * 3} // aspect ratio placeholder
        className={`object-contain ${modeClasses} ${className}`}
        style={{ maxHeight: effectiveHeight }}
      />
    )
  }

  // Fallback to text if no logo URL
  return (
    <span className={`text-sm font-medium text-white/70 ${modeClasses} ${className}`}>
      {asset.shortName ?? asset.name}
    </span>
  )
}
