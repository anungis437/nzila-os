/**
 * Console KpiTile — premium executive metric card.
 *
 * Supports: label, value, optional sublabel, optional delta with direction,
 * optional trailing icon. Hover state subtle (no movement).
 */
import { cn } from './cn'

type DeltaDirection = 'up' | 'down' | 'flat'

const DELTA: Record<DeltaDirection, string> = {
  up: 'text-emerald-700 bg-emerald-50',
  down: 'text-red-700 bg-red-50',
  flat: 'text-gray-600 bg-gray-100',
}

const DELTA_ARROW: Record<DeltaDirection, string> = {
  up: '↑',
  down: '↓',
  flat: '·',
}

export interface KpiTileProps {
  label: string
  value: React.ReactNode
  sublabel?: React.ReactNode
  delta?: { direction: DeltaDirection; text: string }
  /** Optional 20px icon, e.g. <BanknotesIcon className="h-5 w-5" />. */
  icon?: React.ReactNode
  /** When true, value is rendered with `tabular-nums` so columns line up. */
  numeric?: boolean
  className?: string
  /** Optional href — turns the whole tile into a link. */
  href?: string
}

export function KpiTile({
  label,
  value,
  sublabel,
  delta,
  icon,
  numeric = true,
  className,
  href,
}: KpiTileProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</p>
        {icon ? <span className="text-gray-400">{icon}</span> : null}
      </div>
      <p
        className={cn(
          'mt-3 text-2xl font-semibold text-gray-900',
          numeric && 'tabular-nums',
        )}
      >
        {value}
      </p>
      <div className="mt-3 flex items-center gap-2">
        {delta ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium',
              DELTA[delta.direction],
            )}
          >
            <span aria-hidden>{DELTA_ARROW[delta.direction]}</span>
            {delta.text}
          </span>
        ) : null}
        {sublabel ? <p className="text-xs text-gray-500">{sublabel}</p> : null}
      </div>
    </>
  )

  const base = cn(
    'block rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition',
    href && 'hover:shadow-md hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900',
    className,
  )

  if (href) {
    return (
      <a href={href} className={base}>
        {content}
      </a>
    )
  }
  return <div className={base}>{content}</div>
}
