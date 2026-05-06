'use client'

/**
 * TrustCore — Tracked CTA Link
 *
 * Client-side wrapper that fires an analytics event before navigating.
 * Uses a regular <a> tag so the navigation still works if tracking fails.
 */

import { trackEvent } from '@/lib/analytics/track'
import type { AnalyticsEvent, EventPayload } from '@/lib/analytics/track'

interface TrackedCtaLinkProps {
  href: string
  event: AnalyticsEvent
  payload?: EventPayload
  className?: string
  children: React.ReactNode
}

export function TrackedCtaLink({
  href,
  event,
  payload,
  className = '',
  children,
}: TrackedCtaLinkProps) {
  function handleClick() {
    trackEvent(event, payload)
  }

  return (
    <a href={href} onClick={handleClick} className={className}>
      {children}
    </a>
  )
}
