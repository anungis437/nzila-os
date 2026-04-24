'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { trackClientEvent } from '@/lib/analytics/track'
import type { WeekoneAnalyticsEventName } from '@/lib/analytics/events'

export function TrackedCtaLink({
  href,
  eventName,
  context,
  className,
  children,
}: {
  href: string
  eventName: WeekoneAnalyticsEventName
  context?: Record<string, unknown>
  className?: string
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        void trackClientEvent({ eventName, context })
      }}
    >
      {children}
    </Link>
  )
}
