'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface Conflict {
  id: string
  conflictType: string
  severity: string
  policyIdA: string
  policyIdB?: string | null
  affectedWorkflowIds?: string[] | null
  description: string
  isActive: boolean
  detectedAt: string
  resolvedAt?: string | null
  resolvedBy?: string | null
}

const SEVERITY_COLOR: Record<string, string> = {
  info:     'bg-blue-50  text-blue-700  border-blue-200',
  warning:  'bg-amber-50 text-amber-700 border-amber-200',
  error:    'bg-orange-50 text-orange-700 border-orange-200',
  critical: 'bg-red-50   text-red-700   border-red-200',
}

export default function ConflictAnalysis() {
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [loading, setLoading] = useState(true)
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')

  const loadConflicts = useCallback(async () => {
    const res = await fetch('/api/governance/lifecycle/conflicts?activeOnly=true')
    const data = await res.json()
    setConflicts(data.conflicts ?? [])
    setLoading(false)
  }, [])

  const fetchConflicts = useCallback(async () => {
    setLoading(true)
    await loadConflicts()
  }, [loadConflicts])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadConflicts()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadConflicts])

  const resolveConflict = async (id: string) => {
    await fetch(`/api/governance/lifecycle/conflicts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolutionNotes: notes }),
    })
    setResolvingId(null)
    setNotes('')
    await fetchConflicts()
  }

  if (loading) return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
    </div>
  )

  if (conflicts.length === 0) return (
    <p className="text-sm text-muted-foreground py-8 text-center">No active conflicts detected.</p>
  )

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{conflicts.length} active conflict{conflicts.length !== 1 ? 's' : ''}</p>
      {conflicts.map((c) => (
        <div
          key={c.id}
          className={cn('rounded-lg border p-4 space-y-2', SEVERITY_COLOR[c.severity] ?? '')}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold uppercase tracking-wide">{c.severity}</span>
            <span className="text-xs font-mono">{c.conflictType}</span>
            <span className="text-xs text-muted-foreground ml-auto">
              {new Date(c.detectedAt).toLocaleDateString()}
            </span>
          </div>
          <p className="text-sm">{c.description}</p>
          <div className="flex gap-2 flex-wrap text-xs text-muted-foreground">
            <span className="font-mono">{c.policyIdA.slice(0, 8)}…</span>
            {c.policyIdB && <span>vs {c.policyIdB.slice(0, 8)}…</span>}
          </div>

          {resolvingId === c.id ? (
            <div className="flex gap-2 pt-1">
              <input
                className="flex-1 rounded-md border bg-white px-2 py-1 text-xs text-foreground"
                placeholder="Resolution notes…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <Button size="sm" variant="outline" onClick={() => resolveConflict(c.id)} disabled={!notes}>
                Confirm
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setResolvingId(null)}>Cancel</Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="mt-1"
              onClick={() => setResolvingId(c.id)}
            >
              Resolve
            </Button>
          )}
        </div>
      ))}
    </div>
  )
}
