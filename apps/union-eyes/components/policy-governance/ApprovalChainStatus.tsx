'use client'

import { useState } from 'react'
import { LifecycleBadge } from './LifecycleBadge'
import { cn } from '@/lib/utils'

export interface ApprovalChainStatus {
  chainId: string
  policyId: string
  chainType: string
  requiredApprovalCount: number
  approvalCount: number
  rejectionCount: number
  status: 'pending' | 'approved' | 'rejected'
  actions: Array<{
    id: string
    actorRole: string
    action: string
    rationale?: string | null
    actedAt: string
  }>
}

interface ApprovalChainStatusProps {
  policyId: string
  status: ApprovalChainStatus | null
  className?: string
}

const ACTION_COLOR: Record<string, string> = {
  approved:  'text-emerald-700',
  rejected:  'text-red-700',
  delegated: 'text-blue-700',
  withdrawn: 'text-muted-foreground',
}

export function ApprovalChainStatusCard({ policyId: _policyId, status, className }: ApprovalChainStatusProps) {
  const [expanded, setExpanded] = useState(false)

  if (!status) return (
    <p className="text-sm text-muted-foreground">No active approval chain.</p>
  )

  const progress = Math.min(status.approvalCount / Math.max(status.requiredApprovalCount, 1), 1)

  return (
    <div className={cn('rounded-lg border bg-card p-4 space-y-3', className)}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium capitalize">{status.chainType} approval</span>
        <LifecycleBadge
          state={status.status === 'approved' ? 'approved' : status.status === 'rejected' ? 'revoked' : 'approval_required'}
          size="sm"
        />
        <span className="text-xs text-muted-foreground ml-auto">
          {status.approvalCount}/{status.requiredApprovalCount} approvals
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-muted rounded-full h-1.5">
        <div
          className="bg-primary h-1.5 rounded-full transition-all"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <button
        className="text-xs text-muted-foreground hover:text-foreground underline"
        onClick={() => setExpanded((e) => !e)}
      >
        {expanded ? 'Hide' : 'Show'} {status.actions.length} actions
      </button>

      {expanded && (
        <ol className="space-y-1.5 border-t pt-2">
          {status.actions.map((a) => (
            <li key={a.id} className="flex items-start gap-2 text-xs">
              <span className={cn('font-medium capitalize', ACTION_COLOR[a.action] ?? '')}>{a.action}</span>
              <span className="text-muted-foreground">by {a.actorRole}</span>
              <span className="text-muted-foreground ml-auto">{new Date(a.actedAt).toLocaleDateString()}</span>
              {a.rationale && <span className="block w-full text-muted-foreground italic pl-2">&ldquo;{a.rationale}&rdquo;</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
