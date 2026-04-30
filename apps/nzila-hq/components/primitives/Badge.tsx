import type { ReactNode } from 'react'
import { Badge as CanonicalBadge } from '@nzila/ui'

// Adapter: keep HQ's local `tone` API while delegating to canonical Badge.
// Maps HQ hue-named tones onto canonical role-based variants so themes
// (light/dark/enterprise) and product accent flow through automatically.
type Tone = 'slate' | 'emerald' | 'amber' | 'rose' | 'sky' | 'violet'

interface BadgeProps {
  children: ReactNode
  tone?: Tone
}

const toneToVariant = {
  slate: 'neutral',
  emerald: 'ok',
  amber: 'warning',
  rose: 'critical',
  sky: 'info',
  violet: 'accent',
} as const

export function Badge({ children, tone = 'slate' }: BadgeProps) {
  return <CanonicalBadge variant={toneToVariant[tone]}>{children}</CanonicalBadge>
}

export function HealthBadge({ signal }: { signal: 'green' | 'amber' | 'red' }) {
  const variant = signal === 'green' ? 'ok' : signal === 'amber' ? 'warning' : 'critical'
  return <CanonicalBadge variant={variant} dot>{signal.toUpperCase()}</CanonicalBadge>
}
