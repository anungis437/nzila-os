'use client'

import { TrackedCtaLink } from './tracked-cta-link'
import { WEEKONE_ANALYTICS_EVENTS } from '@/lib/analytics/track'

export function StickyCtaHeader({ locale, waitlistMode }: { locale: string; waitlistMode: boolean }) {
  return (
    <div className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur supports-backdrop-filter:bg-white/85">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-electric">WeekOne</p>
        <div className="flex items-center gap-2">
          <TrackedCtaLink
            href={`/${locale}/pricing`}
            eventName={WEEKONE_ANALYTICS_EVENTS.LANDING_CTA_CLICK}
            context={{ source: 'sticky_header', action: 'pricing' }}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground"
          >
            Pricing
          </TrackedCtaLink>
          <TrackedCtaLink
            href={waitlistMode ? `/${locale}/#waitlist` : `/${locale}/onboarding`}
            eventName={WEEKONE_ANALYTICS_EVENTS.LANDING_CTA_CLICK}
            context={{ source: 'sticky_header', action: 'primary' }}
            className="rounded-lg bg-electric px-3 py-1.5 text-xs font-bold text-white"
          >
            {waitlistMode ? 'Join waitlist' : 'Start free'}
          </TrackedCtaLink>
        </div>
      </div>
    </div>
  )
}
