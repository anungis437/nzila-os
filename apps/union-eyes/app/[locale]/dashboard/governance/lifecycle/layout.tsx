'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLocale } from 'next-intl'
import { clsx } from 'clsx'
import { ReactNode } from 'react'
import { PageHeading } from '@/components/dashboard/page-heading'

const NAV_ITEMS = [
  { path: 'registry', en: 'Policy Registry', fr: 'Registre des politiques' },
  { path: 'timeline', en: 'Governance Timeline', fr: 'Chronologie de gouvernance' },
  { path: 'approvals', en: 'Approval Queue', fr: 'Approbations en attente' },
  { path: 'replay', en: 'Replay Center', fr: 'Centre de relecture' },
  { path: 'conflicts', en: 'Conflicts', fr: 'Conflits' },
  { path: 'lineage', en: 'Lineage', fr: 'Filiation' },
  { path: 'deprecation', en: 'Deprecation Watch', fr: 'Suivi des retraits' },
  { path: 'drift', en: 'Drift Detection', fr: 'Détection des écarts' },
  { path: 'snapshot', en: 'Snapshots', fr: 'Instantanés' },
]

export default function GovernanceLifecycleLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const locale = useLocale()
  const french = locale === 'fr-CA'
  const base = `/${locale}/dashboard/governance/lifecycle`

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeading
        title={french ? 'Cycle de vie des politiques' : 'Policy Lifecycle Governance'}
        description={french
          ? 'Suivez les politiques, leurs approbations et leur historique de gouvernance.'
          : 'Track policies, their approvals and their governance history.'}
      />
      <nav className="flex flex-wrap gap-2 text-sm"
        aria-label={french ? 'Sections du cycle de vie des politiques' : 'Policy lifecycle sections'}>
        {NAV_ITEMS.map((item) => {
          const href = `${base}/${item.path}`
          const active = pathname === href || pathname?.startsWith(`${href}/`)
          return (
            <Link key={item.path} href={href} aria-current={active ? 'page' : undefined}
              className={clsx(
                'inline-flex min-h-11 max-w-full items-center rounded-md px-3 py-2 font-medium whitespace-normal transition-colors',
                active ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent',
              )}>
              {french ? item.fr : item.en}
            </Link>
          )
        })}
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
