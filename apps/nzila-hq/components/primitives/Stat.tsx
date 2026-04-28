import type { ReactNode } from 'react'

// Retokenized: HQ's status-color `tone` semantics are preserved (the tone
// describes the stat itself, not a delta — distinct from canonical Stat).
// Ring + dot now consume canonical status tokens so themes flow through.
interface StatProps {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: 'neutral' | 'green' | 'amber' | 'red'
}

const TONE_RING: Record<NonNullable<StatProps['tone']>, string> = {
  neutral: 'ring-[var(--color-border)]',
  green: 'ring-[var(--color-status-ok-soft)]',
  amber: 'ring-[var(--color-status-warning-soft)]',
  red: 'ring-[var(--color-status-critical-soft)]',
}

const TONE_DOT: Record<NonNullable<StatProps['tone']>, string> = {
  neutral: 'bg-[var(--color-fg-subtle)]',
  green: 'bg-[var(--color-status-ok)]',
  amber: 'bg-[var(--color-status-warning)]',
  red: 'bg-[var(--color-status-critical)]',
}

export function Stat({ label, value, hint, tone = 'neutral' }: StatProps) {
  return (
    <div className={`rounded-[var(--radius-lg)] bg-[var(--color-surface-1)] p-4 ring-1 ${TONE_RING[tone]}`}>
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-[var(--color-fg-muted)]">
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${TONE_DOT[tone]}`} />
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-[var(--color-fg)]">{value}</div>
      {hint && <div className="mt-1 text-xs text-[var(--color-fg-muted)]">{hint}</div>}
    </div>
  )
}
