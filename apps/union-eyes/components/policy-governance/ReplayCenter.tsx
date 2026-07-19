'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ReplayDiffTable, ReplayDiff } from './ReplayDiffTable'

interface ReplaySession {
  id: string
  sourcePolicyId: string
  replayType: string
  status: string
  driftCount?: number | null
  createdAt: string
}

export default function ReplayCenter() {
  const [policyId, setPolicyId] = useState('')
  const [sessions, setSessions] = useState<ReplaySession[]>([])
  const [loading, setLoading] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [diffs, setDiffs] = useState<ReplayDiff[] | null>(null)
  const [evidencePolicyId, setEvidencePolicyId] = useState<string | null>(null)

  const fetchSessions = useCallback(async (id: string) => {
    if (!id) return
    setLoading(true)
    const res = await fetch(`/api/governance/lifecycle/policies/${id}/replay`)
    const data = await res.json()
    setSessions(data.sessions ?? [])
    setLoading(false)
  }, [])

  const launchReplay = async () => {
    if (!policyId) return
    setLaunching(true)
    const res = await fetch(`/api/governance/lifecycle/policies/${policyId}/replay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actorRole: 'admin', autoExecute: true }),
    })
    const data = await res.json()
    setLaunching(false)
    if (data.result?.diffs) setDiffs(data.result.diffs)
    fetchSessions(policyId)
  }

  const loadEvidence = async (sessionId: string) => {
    const res = await fetch(`/api/governance/lifecycle/policies/${evidencePolicyId ?? policyId}/replay?evidenceFor=${sessionId}`)
    const data = await res.json()
    if (data.evidence?.diffs) setDiffs(data.evidence.diffs)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Policy ID to replay…"
          value={policyId}
          onChange={(e) => { setPolicyId(e.target.value); setSessions([]); setDiffs(null) }}
          className="flex-1"
        />
        <Button
          variant="outline"
          onClick={() => fetchSessions(policyId)}
          disabled={!policyId || loading}
        >
          Load
        </Button>
        <Button
          onClick={launchReplay}
          disabled={!policyId || launching}
        >
          {launching ? 'Running…' : 'Run Replay'}
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-32 rounded-lg" />
      ) : sessions.length > 0 && (
        <div className="rounded-lg border overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="border-b text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Session</th>
                <th className="px-3 py-2 text-left font-medium">Type</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Drift</th>
                <th className="px-3 py-2 text-left font-medium">Date</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td className="px-3 py-2 font-mono">{s.id.slice(0, 8)}…</td>
                  <td className="px-3 py-2">{s.replayType}</td>
                  <td className="px-3 py-2">{s.status}</td>
                  <td className="px-3 py-2">{s.driftCount ?? '—'}</td>
                  <td className="px-3 py-2">{new Date(s.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setEvidencePolicyId(policyId); loadEvidence(s.id) }}
                    >
                      Evidence
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {diffs !== null && (
        <div className="border-t pt-4">
          <p className="text-sm font-medium mb-2">Drift analysis</p>
          <ReplayDiffTable diffs={diffs} />
        </div>
      )}
    </div>
  )
}
