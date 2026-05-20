'use client'

import { useState, useEffect } from 'react'
import { LifecycleBadge } from './LifecycleBadge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface PolicyDetailProps {
  policyId: string
  onClose?: () => void
}

export default function PolicyDetail({ policyId, onClose }: PolicyDetailProps) {
  const [policy, setPolicy] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/governance/lifecycle/policies/${policyId}`)
      .then((r) => r.json())
      .then((d) => { setPolicy(d.policy ?? null); setLoading(false) })
      .catch(() => setLoading(false))
  }, [policyId])

  if (loading) return <Skeleton className="h-40 rounded-lg" />
  if (!policy) return <p className="text-sm text-destructive">Policy not found.</p>

  const fields: [string, string][] = [
    ['ID', policy.id as string],
    ['Name', policy.name as string],
    ['Domain', policy.domain as string],
    ['Version', `v${policy.semver as string}`],
    ['Risk', policy.riskClassification as string],
    ['Owner', (policy.ownerUserId as string) || '—'],
    ['Published', policy.publishedAt ? new Date(policy.publishedAt as string).toLocaleString() : '—'],
    ['Activated', policy.activatedAt ? new Date(policy.activatedAt as string).toLocaleString() : '—'],
    ['Content Hash', (policy.contentHash as string)?.slice(0, 32) + '…' || '—'],
  ]

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <h3 className="font-semibold text-base">{policy.name as string}</h3>
        <LifecycleBadge state={policy.lifecycleStatus as string} />
        {onClose && (
          <Button variant="ghost" size="sm" className="ml-auto" onClick={onClose}>
            Close
          </Button>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {fields.map(([k, v]) => (
          <>
            <dt key={`k-${k}`} className="text-muted-foreground">{k}</dt>
            <dd key={`v-${k}`} className="font-mono text-xs truncate">{v}</dd>
          </>
        ))}
      </dl>
      {Boolean(policy.description) && (
        <p className="text-sm text-muted-foreground border-t pt-2">{policy.description as string}</p>
      )}
    </div>
  )
}
