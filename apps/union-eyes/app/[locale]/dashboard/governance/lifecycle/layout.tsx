'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import { ReactNode } from 'react'

const NAV_ITEMS = [
  { href: 'registry',     label: 'Policy Registry' },
  { href: 'timeline',     label: 'Governance Timeline' },
  { href: 'approvals',    label: 'Approval Queue' },
  { href: 'replay',       label: 'Replay Center' },
  { href: 'conflicts',    label: 'Conflicts' },
  { href: 'lineage',      label: 'Lineage' },
  { href: 'deprecation',  label: 'Deprecation Watch' },
  { href: 'drift',        label: 'Drift Detection' },
  { href: 'snapshot',     label: 'Snapshots' },
]

export default function GovernanceLifecycleLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col gap-4">
      {/* Section header */}
      <div className="border-b pb-3">
        <h2 className="text-xl font-semibold tracking-tight">Policy Lifecycle Governance</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Institutional governance infrastructure — policy operationalization, explainable lifecycle
          management, and durable organizational trust.
        </p>
      </div>

      {/* Sub-navigation */}
      <nav
        className="flex flex-wrap gap-1 text-sm"
        aria-label="Policy lifecycle sections"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = pathname?.includes(`/lifecycle/${item.href}`)
          return (
            <Link
              key={item.href}
              href={`governance/lifecycle/${item.href}`}
              className={clsx(
                'px-3 py-1.5 rounded-md font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent',
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Page content */}
      <div className="flex-1">{children}</div>
    </div>
  )
}
