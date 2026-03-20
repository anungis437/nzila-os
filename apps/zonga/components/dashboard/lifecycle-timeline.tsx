/**
 * Unified vertical timeline for Zonga detail-page sidebars.
 *
 * Accepts an array of events (each with a label, optional description,
 * timestamp, actor, icon, and colour) and renders them with a
 * connecting vertical line.
 */
import {
  ClockIcon,
  CheckCircleIcon,
  MusicalNoteIcon,
  CurrencyDollarIcon,
  FlagIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  MicrophoneIcon,
} from '@heroicons/react/24/outline'
import type { ComponentType, SVGProps } from 'react'

export interface TimelineEvent {
  label: string
  description?: string
  timestamp: string | Date
  actor?: string
  icon?: ComponentType<SVGProps<SVGSVGElement>>
  color?: string
}

function resolveIcon(label: string): { icon: ComponentType<SVGProps<SVGSVGElement>>; color: string } {
  const l = label.toLowerCase()
  if (l.includes('creat') || l.includes('register'))
    return { icon: DocumentTextIcon, color: 'bg-electric' }
  if (l.includes('publish') || l.includes('releas') || l.includes('approv') || l.includes('complet'))
    return { icon: CheckCircleIcon, color: 'bg-emerald-400' }
  if (l.includes('upload') || l.includes('encod') || l.includes('process'))
    return { icon: MusicalNoteIcon, color: 'bg-indigo-400' }
  if (l.includes('payout') || l.includes('disburse') || l.includes('paid') || l.includes('revenue'))
    return { icon: CurrencyDollarIcon, color: 'bg-orange-400' }
  if (l.includes('review') || l.includes('moderat') || l.includes('flag'))
    return { icon: ExclamationTriangleIcon, color: 'bg-amber-400' }
  if (l.includes('record') || l.includes('perform') || l.includes('live'))
    return { icon: MicrophoneIcon, color: 'bg-violet-400' }
  if (l.includes('cancel') || l.includes('takedown') || l.includes('suspend'))
    return { icon: FlagIcon, color: 'bg-gray-400' }
  return { icon: ClockIcon, color: 'bg-electric' }
}

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
