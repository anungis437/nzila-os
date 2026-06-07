'use client'

import { useState, useEffect, useCallback } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface DeprecationCandidate {
  id: string
  name: string
  domain: string
  lifecycleStatus: string
  reason: string
  daysSinceLastActivity: number
}

interface OrphanedWorkflow {
  workflowId: string
  policyId?: string | null
  reason: string
}

interface StaleOwnership {
  id: string
  name: string
  ownerUserId?: string | null
  reason: string
}

interface DeprecationData {
  candidates: DeprecationCandidate[]
  orphaned: OrphanedWorkflow[]
  staleOwnership: StaleOwnership[]
}

export default function DeprecationWatch() {
  const [data, setData] = useState<DeprecationData | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    const res = await fetch('/api/governance/lifecycle/deprecation-watch')
    const json = await res.json()
    setData(json)
    setLoading(false)
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadData])

  if (loading) return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
    </div>
  )

  if (!data) return <p className="text-sm text-destructive">Failed to load deprecation watch data.</p>

  const sections = [
    {
      title: 'Deprecation Candidates',
      count: data.candidates.length,
      color: 'text-orange-700',
      items: data.candidates.map((c) => ({
        key: c.id,
        primary: c.name,
        secondary: `${c.domain} · ${c.lifecycleStatus}`,
        meta: c.reason,
        badge: `${c.daysSinceLastActivity}d inactive`,
      })),
    },
    {
      title: 'Orphaned Workflows',
      count: data.orphaned.length,
      color: 'text-red-700',
      items: data.orphaned.map((o) => ({
        key: o.workflowId,
        primary: o.workflowId,
        secondary: o.policyId ? `Policy: ${o.policyId.slice(0, 8)}…` : 'No policy',
        meta: o.reason,
        badge: 'orphaned',
      })),
    },
    {
      title: 'Stale Ownership',
      count: data.staleOwnership.length,
      color: 'text-amber-700',
      items: data.staleOwnership.map((s) => ({
        key: s.id,
        primary: s.name,
        secondary: s.ownerUserId ?? 'No owner',
        meta: s.reason,
        badge: 'stale',
      })),
    },
  ]

  return (
    <div className="space-y-6">
      {sections.map((sec) => (
        <div key={sec.title} className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className={cn('text-sm font-semibold', sec.color)}>{sec.title}</h3>
            <span className="text-xs text-muted-foreground">({sec.count})</span>
          </div>
          {sec.items.length === 0 ? (
            <p className="text-xs text-muted-foreground pl-2">None detected.</p>
          ) : (
            <ul className="space-y-1.5">
              {sec.items.map((item) => (
                <li key={item.key} className="flex items-start gap-3 rounded-md border px-3 py-2 text-xs">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.primary}</p>
                    <p className="text-muted-foreground truncate">{item.secondary}</p>
                    <p className="text-muted-foreground italic">{item.meta}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                    {item.badge}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}
