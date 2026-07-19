'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ApprovalChainStatusCard, ApprovalChainStatus } from './ApprovalChainStatus'

interface QueueItem {
  policyId: string
  policyName: string
  chainId: string
  riskClassification: string
  approvalStatus: ApprovalChainStatus
}

export default function ApprovalQueue() {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [rationale, setRationale] = useState('')

  const loadQueue = useCallback(async () => {
    const res = await fetch('/api/governance/lifecycle/policies?status=approval_required&limit=50')
    const data = await res.json()
    const items: QueueItem[] = []
    for (const p of data.policies ?? []) {
      const statusRes = await fetch(`/api/governance/lifecycle/policies/${p.id}/approvals`)
      const statusData = await statusRes.json()
      if (statusData.approvalStatus) {
        items.push({
          policyId: p.id,
          policyName: p.name,
          chainId: statusData.approvalStatus.chainId,
          riskClassification: p.riskClassification,
          approvalStatus: statusData.approvalStatus,
        })
      }
    }
    setQueue(items)
    setLoading(false)
  }, [])

  const fetchQueue = useCallback(async () => {
    setLoading(true)
    await loadQueue()
  }, [loadQueue])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadQueue()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadQueue])

  const recordAction = async (item: QueueItem, action: 'approved' | 'rejected') => {
    setActing(item.policyId)
    await fetch(`/api/governance/lifecycle/policies/${item.policyId}/approvals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        op: 'record_action',
        chainId: item.chainId,
        action,
        actorRole: 'admin',
        rationale,
      }),
    })
    setActing(null)
    setRationale('')
    await fetchQueue()
  }

  if (loading) return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
    </div>
  )

  if (queue.length === 0) return (
    <p className="text-sm text-muted-foreground py-8 text-center">No policies awaiting approval.</p>
  )

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{queue.length} pending</p>
      {queue.map((item) => (
        <div key={item.policyId} className="rounded-lg border p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium text-sm">{item.policyName}</p>
              <p className="text-xs text-muted-foreground">{item.policyId.slice(0, 8)} · {item.riskClassification} risk</p>
            </div>
          </div>

          <ApprovalChainStatusCard policyId={item.policyId} status={item.approvalStatus} />

          <div className="flex gap-2 items-center">
            <input
              className="flex-1 rounded-md border bg-transparent px-3 py-1.5 text-sm"
              placeholder="Optional rationale…"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              className="border-green-500 text-green-700 hover:bg-green-50"
              disabled={acting === item.policyId}
              onClick={() => recordAction(item, 'approved')}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-red-400 text-red-700 hover:bg-red-50"
              disabled={acting === item.policyId}
              onClick={() => recordAction(item, 'rejected')}
            >
              Reject
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
