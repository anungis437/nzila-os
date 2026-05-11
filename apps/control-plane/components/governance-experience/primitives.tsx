import type { ReactNode } from 'react'
import type { PostureBand, Verdict } from '@nzila/governance-operations'

/**
 * Map a posture banding to restrained Tailwind classes. Colour is text
 * only (no aggressive backgrounds, no animation). The banded vocabulary
 * is the single visual signal — never a traffic-light wall.
 */
function bandClasses(band: PostureBand): string {
  switch (band) {
    case 'stable':
      return 'text-emerald-700 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-900/60'
    case 'warming':
      return 'text-amber-700 dark:text-amber-400 border-amber-200/60 dark:border-amber-900/60'
    case 'concerning':
      return 'text-orange-700 dark:text-orange-400 border-orange-200/60 dark:border-orange-900/60'
    case 'destabilizing':
      return 'text-red-700 dark:text-red-400 border-red-200/60 dark:border-red-900/60'
  }
}

function verdictClasses(verdict: Verdict): string {
  switch (verdict) {
    case 'verified':
      return 'text-emerald-700 dark:text-emerald-400'
    case 'partial':
      return 'text-amber-700 dark:text-amber-400'
    case 'rejected':
      return 'text-red-700 dark:text-red-400'
    case 'unknown':
      return 'text-muted-foreground'
  }
}

interface BandingLabelProps {
  readonly band: PostureBand
}

export function BandingLabel({ band }: BandingLabelProps) {
  return (
    <span className={`inline-flex items-center text-sm font-medium ${bandClasses(band)}`}>
      {band}
    </span>
  )
}

interface VerdictLabelProps {
  readonly verdict: Verdict
}

export function VerdictLabel({ verdict }: VerdictLabelProps) {
  return (
    <span className={`inline-flex items-center text-sm font-medium ${verdictClasses(verdict)}`}>
      {verdict}
    </span>
  )
}

interface CalmCardProps {
  readonly children: ReactNode
  readonly band?: PostureBand
  readonly className?: string
}

/**
 * Sparse, low-density card. Border colour optionally reflects the band,
 * and even then only at low saturation. No shadows beyond `shadow-sm`.
 */
export function CalmCard({ children, band, className }: CalmCardProps) {
  const border = band ? bandClasses(band) : 'border-border'
  return (
    <section
      className={`rounded-lg border bg-card p-6 shadow-sm ${border} ${className ?? ''}`}
    >
      {children}
    </section>
  )
}
