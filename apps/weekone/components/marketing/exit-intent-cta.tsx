'use client'

import { useEffect, useState } from 'react'
import { trackClientEvent, WEEKONE_ANALYTICS_EVENTS } from '@/lib/analytics/track'

export function ExitIntentCta({ locale }: { locale: string }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const key = `weekone_exit_seen_${new Date().toISOString().slice(0, 10)}`
    if (typeof window === 'undefined' || window.sessionStorage.getItem(key)) return

    const onMouseOut = (event: MouseEvent) => {
      if (event.clientY <= 10) {
        setOpen(true)
        window.sessionStorage.setItem(key, '1')
        document.removeEventListener('mouseout', onMouseOut)
      }
    }

    document.addEventListener('mouseout', onMouseOut)
    return () => document.removeEventListener('mouseout', onMouseOut)
  }, [])

  if (!open) return null

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 rounded-xl border border-electric/30 bg-white p-4 shadow-xl sm:inset-x-auto sm:right-4 sm:max-w-sm">
      <p className="text-sm font-semibold text-navy">Before you go: get the Founder Weekly Reset template.</p>
      <p className="mt-1 text-xs text-muted-foreground">Free planner + reset checklist used by early WeekOne users.</p>
      <div className="mt-3 flex items-center gap-2">
        <a
          href={`/${locale}/#template-download`}
          className="rounded-lg bg-electric px-3 py-2 text-xs font-bold text-white"
          onClick={() => {
            void trackClientEvent({
              eventName: WEEKONE_ANALYTICS_EVENTS.EXIT_INTENT_CTA,
              context: { source: 'exit_intent_modal' },
            })
            setOpen(false)
          }}
        >
          Get template
        </a>
        <button
          className="rounded-lg border border-border px-3 py-2 text-xs font-semibold"
          onClick={() => setOpen(false)}
        >
          Close
        </button>
      </div>
    </div>
  )
}
