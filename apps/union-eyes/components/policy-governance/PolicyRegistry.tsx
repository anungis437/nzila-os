'use client'

import { useState, useEffect, useCallback } from 'react'
import { PolicyCard, PolicyCardData } from './PolicyCard'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import PolicyDetail from './PolicyDetail'

const LIFECYCLE_STATES = [
  'all', 'draft', 'review_pending', 'approval_required', 'approved',
  'published', 'active', 'superseded', 'deprecated', 'revoked', 'archived',
]

export default function PolicyRegistry() {
  const [policies, setPolicies] = useState<PolicyCardData[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [domain, setDomain] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(0)
  const limit = 20

  const fetchPolicies = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ limit: String(limit), offset: String(page * limit) })
    if (domain) params.set('domain', domain)
    if (status !== 'all') params.set('status', status)
    const res = await fetch(`/api/governance/lifecycle/policies?${params}`)
    const data = await res.json()
    setPolicies(data.policies ?? [])
    setTotal(data.total ?? 0)
    setLoading(false)
  }, [domain, status, page])

  useEffect(() => { fetchPolicies() }, [fetchPolicies])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          placeholder="Filter by domain…"
          value={domain}
          onChange={(e) => { setDomain(e.target.value); setPage(0) }}
          className="w-48"
        />
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0) }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {LIFECYCLE_STATES.map((s) => (
              <SelectItem key={s} value={s}>{s === 'all' ? 'All statuses' : s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">
          {total} {total === 1 ? 'policy' : 'policies'}
        </span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
      ) : policies.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">No policies found.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {policies.map((p) => (
            <PolicyCard
              key={p.id}
              policy={p}
              selected={selected === p.id}
              onClick={(id) => setSelected(id === selected ? null : id)}
            />
          ))}
        </div>
      )}

      {total > limit && (
        <div className="flex gap-2 justify-center pt-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-xs text-muted-foreground self-center">
            Page {page + 1} of {Math.ceil(total / limit)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={(page + 1) * limit >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {selected && (
        <div className="border-t pt-4">
          <PolicyDetail policyId={selected} onClose={() => setSelected(null)} />
        </div>
      )}
    </div>
  )
}
