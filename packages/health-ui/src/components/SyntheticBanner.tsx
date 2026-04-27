import React from 'react'

export interface SyntheticBannerProps {
  message?: string
}

export function SyntheticBanner({
  message = 'Synthetic clinical demo data — not real patient records',
}: SyntheticBannerProps) {
  return (
    <div
      className="synthetic-banner"
      role="alert"
      aria-label="Synthetic demo data warning"
      aria-live="polite"
    >
      ⚠ {message}
    </div>
  )
}
