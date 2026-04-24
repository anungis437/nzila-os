'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { trackClientEvent } from '@/lib/analytics/track'
import type { WeekoneAnalyticsEventName } from '@/lib/analytics/events'

export function TrackedCtaButton({
  eventName,
  context,
  children,
  onClick,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  eventName: WeekoneAnalyticsEventName
  context?: Record<string, unknown>
  children: ReactNode
}) {
  return (
    <button
      {...props}
      onClick={(event) => {
        void trackClientEvent({ eventName, context })
        onClick?.(event)
      }}
    >
      {children}
    </button>
  )
}
