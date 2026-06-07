'use client'

import { useState, useEffect, useCallback } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

interface DriftSession {
  id: string
  sourcePolicyId: string
  replayType: string
  status: string
  driftCount?: number | null
  totalEvents?: number | null
  createdAt: string
}

export default function DriftDetection() {
  const [sessions, setSessions] = useState<DriftSession[]>([])
  const [loading, setLoading] = useState(false)
  const [policyId, setPolicyId] = useState('')

  const loadSessions = useCallback(async (nextPolicyId: string) => {
    const res = await fetch(`/api/governance/lifecycle/policies/${nextPolicyId}/replay`)
    const data = await res.json()
    setSessions((data.sessions ?? []).filter((s: DriftSession) => s.driftCount !== null))
    setLoading(false)
  }, [])

  const fetchSessions = useCallback(async () => {
    if (!policyId) return
    setLoading(true)
    await loadSessions(policyId)
  }, [policyId, loadSessions])

  useEffect(() => {
    if (!policyId) return
    const timeoutId = window.setTimeout(() => {
      void loadSessions(policyId)
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [policyId, loadSessions])

  const driftRate = sessions.length > 0
    ? sessions.reduce((acc, s) => acc + (s.driftCount ?? 0), 0) / sessions.reduce((acc, s) => acc + (s.totalEvents ?? 1), 0)
    : null

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm"
          placeholder="Policy ID to analyze drift…"
          value={policyId}
          onChange={(e) => setPolicyId(e.target.value)}
        />
        <button
          className="rounded-md border px-4 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
          onClick={fetchSessions}
          disabled={!policyId || loading}
        >
          Analyze
        </button>
      </div>

      {!policyId ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Enter a policy ID to analyze governance drift.</p>
      ) : loading ? (
        <Skeleton className="h-32 rounded-lg" />
      ) : (
        <div className="space-y-4">
          {driftRate !== null && (
            <div className="flex gap-6 rounded-lg border p-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{sessions.length}</p>
                <p className="text-xs text-muted-foreground">Replay sessions</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{sessions.reduce((a, s) => a + (s.driftCount ?? 0), 0)}</p>
                <p className="text-xs text-muted-foreground">Total drift events</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{(driftRate * 100).toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Drift rate</p>
              </div>
            </div>
          )}

          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No drift sessions found for this policy.</p>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="border-b text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Session</th>
                    <th className="px-3 py-2 text-left font-medium">Type</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">Drift</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                    <th className="px-3 py-2 text-left font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sessions.map((s) => (
                    <tr key={s.id} className={(s.driftCount ?? 0) > 0 ? 'bg-orange-50' : ''}>
                      <td className="px-3 py-2 font-mono">{s.id.slice(0, 8)}…</td>
                      <td className="px-3 py-2">{s.replayType}</td>
                      <td className="px-3 py-2">{s.status}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${(s.driftCount ?? 0) > 0 ? 'text-orange-700' : 'text-emerald-700'}`}>
                        {s.driftCount ?? 0}
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{s.totalEvents ?? '—'}</td>
                      <td className="px-3 py-2">{new Date(s.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
