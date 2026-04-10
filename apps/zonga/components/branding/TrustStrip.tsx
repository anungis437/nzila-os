/**
 * TrustStrip — "Trusted by" horizontal badge carousel.
 *
 * Shows registered clients/partners with policy-enforced visibility.
 * Typically used in marketing pages (marketing_trust placement).
 */
'use client'

import type { BrandAsset, BrandPlacement, BrandingFeatureFlags } from '@/lib/branding/types'
import { ExternalBrandMark } from './ExternalBrandMark'

interface TrustStripProps {
  placement?: BrandPlacement
  brands: BrandAsset[]
  flags?: BrandingFeatureFlags
  title?: string
  className?: string
}

export function TrustStrip({
  placement = 'marketing_trust',
  brands,
  flags,
  title = 'Trusted by organizations across Africa',
  className = '',
}: TrustStripProps) {
  if (brands.length === 0) return null

  return (
    <section className={`py-12 ${className}`}>
      <p className="mb-8 text-center text-sm font-medium uppercase tracking-widest text-white/40">
        {title}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
        {brands.map((brand) => (
          <ExternalBrandMark
            key={brand.id}
            asset={brand}
            placement={placement}
            flags={flags}
            maxHeight={24}
          />
        ))}
      </div>
    </section>
  )
}
