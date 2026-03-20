/**
 * Unified vertical timeline for detail-page sidebars.
 *
 * Accepts an array of events (each with a label, optional description,
 * timestamp, actor, icon, and colour) and renders them with a
 * connecting vertical line — same pattern used in the quote detail page.
 */
import {
  ClockIcon,
  CheckCircleIcon,
  TruckIcon,
  CubeIcon,
  CurrencyDollarIcon,
  FlagIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import type { ComponentType, SVGProps } from 'react'

// ── Public types ────────────────────────────────────────────────────────────

export interface TimelineEvent {
  /** Short label, e.g. "Order Confirmed" */
  label: string
  /** Optional one-liner description */
  description?: string
  /** ISO-8601 timestamp */
  timestamp: string | Date
  /** Who performed the action */
  actor?: string
  /** Explicit icon override (default: inferred from label) */
  icon?: ComponentType<SVGProps<SVGSVGElement>>
  /** Explicit dot colour override (default: inferred from label) */
  color?: string
}

// ── Heuristic icon/colour resolution ────────────────────────────────────────

function resolveIcon(label: string): { icon: ComponentType<SVGProps<SVGSVGElement>>; color: string } {
  const l = label.toLowerCase()
  if (l.includes('creat'))                 return { icon: DocumentTextIcon,        color: 'bg-electric' }
  if (l.includes('accept') || l.includes('approv') || l.includes('confirm') || l.includes('complete'))
                                            return { icon: CheckCircleIcon,        color: 'bg-emerald-400' }
  if (l.includes('sent') || l.includes('send') || l.includes('ship') || l.includes('deliver'))
                                            return { icon: TruckIcon,              color: 'bg-violet-400' }
  if (l.includes('revision') || l.includes('request') || l.includes('attention'))
                                            return { icon: ExclamationTriangleIcon, color: 'bg-amber-400' }
  if (l.includes('payment') || l.includes('deposit') || l.includes('paid'))
                                            return { icon: CurrencyDollarIcon,     color: 'bg-orange-400' }
  if (l.includes('production') || l.includes('fulfil') || l.includes('receiv'))
                                            return { icon: CubeIcon,               color: 'bg-cyan-400' }
  if (l.includes('clos') || l.includes('cancel'))
                                            return { icon: FlagIcon,               color: 'bg-gray-400' }
  if (l.includes('lock'))
                                            return { icon: CheckCircleIcon,        color: 'bg-green-400' }
  return { icon: ClockIcon, color: 'bg-electric' }
}

// ── Component ───────────────────────────────────────────────────────────────

export function LifecycleTimeline({
  events,
  className = '',
}: {
  events: TimelineEvent[]
  className?: string
}) {
  if (events.length === 0) return null

  return (
    <div className={`relative ${className}`}>
      {/* Vertical connector */}
      <div className="absolute left-[9px] top-2 bottom-2 w-px bg-gray-200" />

      <div className="space-y-4">
        {events.map((event, idx) => {
          const resolved = resolveIcon(event.label)
          const Icon = event.icon ?? resolved.icon
          const dotColor = event.color ?? resolved.color
          const ts = event.timestamp instanceof Date ? event.timestamp : new Date(event.timestamp)

          return (
            <div key={idx} className="flex items-start gap-3 relative">
              <div
                className={`mt-0.5 h-[18px] w-[18px] rounded-full ${dotColor} flex items-center justify-center shrink-0 z-10`}
              >
                <Icon className="h-2.5 w-2.5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-navy">{event.label}</p>
                {event.description && (
                  <p className="text-xs text-gray-500">{event.description}</p>
                )}
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {ts.toLocaleString('en-CA')}
                  {event.actor ? ` · ${event.actor}` : ''}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
