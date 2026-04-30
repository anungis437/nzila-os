import React from 'react'

/**
 * Stat — single KPI cell.
 *
 * Used inside a `KpiStrip` (a CSS grid the consumer composes), one per
 * cell. Honest: never invents a delta — `delta` is optional. `meta`
 * is for provenance ("source: live", "as of 09:14 UTC"); render small
 * and muted, never highlighted.
 */
interface StatProps {
  label: string
  value: React.ReactNode
  /** Trend marker, optional. Honest mode: omit when not measured. */
  delta?: { value: string; tone: 'ok' | 'warning' | 'critical' | 'neutral' }
  /** Provenance / freshness annotation. */
  meta?: string
  /** Optional inline icon, 16-20px. */
  icon?: React.ReactNode
}

const deltaTone = {
  ok: 'text-[var(--color-status-ok)]',
  warning: 'text-[var(--color-status-warning)]',
  critical: 'text-[var(--color-status-critical)]',
  neutral: 'text-[var(--color-fg-muted)]',
} as const

export function Stat({ label, value, delta, meta, icon }: StatProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
        {icon ? <span aria-hidden="true">{icon}</span> : null}
        <span>{label}</span>
      </div>
      <div className="text-[24px] font-semibold tabular-nums text-[var(--color-fg)] leading-tight">
        {value}
      </div>
      {delta ? (
        <div className={`text-[12px] font-semibold tabular-nums ${deltaTone[delta.tone]}`}>
          {delta.value}
        </div>
      ) : null}
      {meta ? (
        <div className="text-[11px] text-[var(--color-fg-subtle)]">{meta}</div>
      ) : null}
    </div>
  )
}
