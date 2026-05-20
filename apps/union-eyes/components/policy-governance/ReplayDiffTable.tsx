'use client'

import { cn } from '@/lib/utils'

export interface ReplayDiff {
  sessionId: string
  eventId: string
  originalDecision: string
  replayedDecision: string
  drift: {
    decision: boolean
    reason_code: boolean
    approver_roles: boolean
  }
  originalReasonCode?: string | null
  replayedReasonCode?: string | null
}

interface ReplayDiffTableProps {
  diffs: ReplayDiff[]
  className?: string
}

export function ReplayDiffTable({ diffs, className }: ReplayDiffTableProps) {
  if (diffs.length === 0) return (
    <p className="text-sm text-muted-foreground py-4 text-center">No drift detected. Governance is stable.</p>
  )

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="min-w-full text-xs">
        <thead>
          <tr className="border-b text-muted-foreground text-left">
            <th className="py-2 pr-4 font-medium">Event ID</th>
            <th className="py-2 pr-4 font-medium">Original</th>
            <th className="py-2 pr-4 font-medium">Replayed</th>
            <th className="py-2 pr-4 font-medium">Decision drift</th>
            <th className="py-2 pr-4 font-medium">Reason drift</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {diffs.map((d) => (
            <tr key={d.eventId} className={cn(d.drift.decision ? 'bg-red-50' : '')}>
              <td className="py-2 pr-4 font-mono">{d.eventId.slice(0, 8)}…</td>
              <td className={cn('py-2 pr-4', d.drift.decision ? 'text-red-700' : 'text-emerald-700')}>
                {d.originalDecision}
              </td>
              <td className={cn('py-2 pr-4', d.drift.decision ? 'text-red-700' : 'text-emerald-700')}>
                {d.replayedDecision}
              </td>
              <td className="py-2 pr-4">
                {d.drift.decision
                  ? <span className="text-red-600 font-medium">DRIFT</span>
                  : <span className="text-emerald-600">stable</span>}
              </td>
              <td className="py-2 pr-4 text-muted-foreground">
                {d.originalReasonCode ?? '—'} → {d.replayedReasonCode ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
