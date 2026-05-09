import type { ReactNode } from 'react'
import Link from 'next/link'

import { CANONICAL_GROUPS, defineTerm } from '@/lib/operational-convergence'

interface GovernanceExperienceLayoutProps {
  readonly children: ReactNode
}

/**
 * Calm institutional layout for the governance experience surfaces.
 * Sparse navigation; no animation; no real-time badges.
 *
 * Tab order honours the canonical operator pathway from
 * `@nzila/operational-convergence` (read posture → interpret continuity
 * → review legitimacy → record decision). The trailing footnote cites
 * the canonical glossary so the same word means the same thing across
 * every Nzila app.
 */
export default function GovernanceExperienceLayout({
  children,
}: GovernanceExperienceLayoutProps) {
  // Canonical pathway: posture → continuity → legitimacy → stabilization → review
  const tabs: ReadonlyArray<{ readonly href: string; readonly label: string }> = [
    { href: '/governance-experience', label: 'Overview' },
    { href: '/governance-experience/continuity', label: 'Continuity' },
    { href: '/governance-experience/legitimacy', label: 'Deployment legitimacy' },
    { href: '/governance-experience/stabilization', label: 'Stabilization' },
    { href: '/governance-experience/review', label: 'Review' },
  ]
  // Read once at render time — refuses non-canonical glossary drift at build.
  const governanceMeaning = defineTerm('governance').meaning
  const canonicalGroupCount = CANONICAL_GROUPS.length
  return (
    <div className="space-y-6">
      <nav
        aria-label="Governance experience navigation"
        className="flex flex-wrap gap-x-6 gap-y-2 border-b border-border pb-3 text-sm"
      >
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground"
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
      <footer className="border-t border-border pt-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Governance</span> — {governanceMeaning}{' '}
        <span className="text-muted-foreground/70">
          (One of {canonicalGroupCount} canonical operating groups across Nzila apps.)
        </span>
      </footer>
    </div>
  )
}

export const metadata = {
  title: 'Governance experience — Nzila OS Control Plane',
  description:
    'Living institutional governance operations: posture, continuity, deployment legitimacy, stabilization, and review.',
}
