/**
 * Console StatusPill — semantic status with dot indicator.
 *
 * Distinct from <Badge>: this is for live operational state (healthy /
 * degraded / down / unknown / running / queued).
 */
import { cn } from './cn'

type Status =
  | 'healthy'
  | 'degraded'
  | 'down'
  | 'unknown'
  | 'running'
  | 'queued'
  | 'paused'
  | 'success'
  | 'failed'

const STATUS: Record<Status, { dot: string; ring: string; bg: string; text: string; label: string }> = {
  healthy:  { dot: 'bg-emerald-500', ring: 'ring-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-800', label: 'Healthy' },
  success:  { dot: 'bg-emerald-500', ring: 'ring-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-800', label: 'Success' },
  running:  { dot: 'bg-blue-500',    ring: 'ring-blue-200',    bg: 'bg-blue-50',    text: 'text-blue-800',    label: 'Running' },
  queued:   { dot: 'bg-gray-400',    ring: 'ring-gray-200',    bg: 'bg-gray-50',    text: 'text-gray-700',    label: 'Queued' },
  degraded: { dot: 'bg-amber-500',   ring: 'ring-amber-200',   bg: 'bg-amber-50',   text: 'text-amber-800',   label: 'Degraded' },
  paused:   { dot: 'bg-amber-500',   ring: 'ring-amber-200',   bg: 'bg-amber-50',   text: 'text-amber-800',   label: 'Paused' },
  down:     { dot: 'bg-red-500',     ring: 'ring-red-200',     bg: 'bg-red-50',     text: 'text-red-800',     label: 'Down' },
  failed:   { dot: 'bg-red-500',     ring: 'ring-red-200',     bg: 'bg-red-50',     text: 'text-red-800',     label: 'Failed' },
  unknown:  { dot: 'bg-gray-400',    ring: 'ring-gray-200',    bg: 'bg-gray-50',    text: 'text-gray-600',    label: 'Unknown' },
}

export function StatusPill({
  status,
  label,
  pulse,
  className,
}: {
  status: Status
  label?: string
  /** Animate the dot — use for live/in-flight states only. */
  pulse?: boolean
  className?: string
}) {
  const cfg = STATUS[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        cfg.bg,
        cfg.text,
        cfg.ring,
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'inline-block h-1.5 w-1.5 rounded-full',
          cfg.dot,
          pulse && 'motion-safe:animate-pulse',
        )}
      />
      {label ?? cfg.label}
    </span>
  )
}
