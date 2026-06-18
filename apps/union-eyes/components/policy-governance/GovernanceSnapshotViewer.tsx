'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface Snapshot {
  id: string
  snapshotVersion: number
  triggerType: string
  triggeredBy?: string | null
  policyCount: number
  activeConflictCount: number
  snapshotHash?: string | null
  takenAt: string
  notes?: string | null
}

export default function GovernanceSnapshotViewer() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState(false)
  const [selected, setSelected] = useState<Snapshot | null>(null)
  const [queryAt, setQueryAt] = useState('')
  const [queried, setQueried] = useState<Snapshot | null>(null)

  const loadSnapshots = useCallback(async () => {
    const res = await fetch('/api/governance/lifecycle/snapshots?limit=20')
    const data = await res.json()
    setSnapshots(data.snapshots ?? [])
    setLoading(false)
  }, [])

  const fetchSnapshots = useCallback(async () => {
    setLoading(true)
    await loadSnapshots()
  }, [loadSnapshots])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadSnapshots()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadSnapshots])

  const triggerSnapshot = async () => {
    setTriggering(true)
    await fetch('/api/governance/lifecycle/snapshots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    setTriggering(false)
    await fetchSnapshots()
  }

  const querySnapshot = async () => {
    if (!queryAt) return
    const res = await fetch(`/api/governance/lifecycle/snapshots/${encodeURIComponent(queryAt)}`)
    const data = await res.json()
    setQueried(data.snapshot ?? null)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" onClick={fetchSnapshots} disabled={loading}>
          Refresh
        </Button>
        <Button onClick={triggerSnapshot} disabled={triggering}>
          {triggering ? 'Taking…' : 'Take Snapshot'}
        </Button>
        <div className="flex gap-2 ml-auto">
          <input
            className="rounded-md border bg-background px-3 py-1.5 text-sm"
            placeholder="ISO timestamp to query…"
            value={queryAt}
            onChange={(e) => setQueryAt(e.target.value)}
          />
          <Button variant="outline" onClick={querySnapshot} disabled={!queryAt}>
            Query
          </Button>
        </div>
      </div>

      {queried !== null && (
        <div className="rounded-lg border p-4 bg-muted/30 space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Point-in-time result</p>
          <SnapshotRow s={queried} onClick={() => setSelected(queried)} />
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </div>
      ) : snapshots.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No snapshots yet. Take a manual snapshot to begin.</p>
      ) : (
        <div className="rounded-lg border divide-y">
          {snapshots.map((s) => (
            <SnapshotRow key={s.id} s={s} onClick={() => setSelected(selected?.id === s.id ? null : s)} />
          ))}
        </div>
      )}

      {selected && (
        <SnapshotDetail snapshot={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

function SnapshotRow({ s, onClick }: { s: Snapshot; onClick: () => void }) {
  return (
    <button
      className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-muted/40 transition-colors text-sm"
      onClick={onClick}
    >
      <span className="text-muted-foreground font-mono text-xs w-20 shrink-0">v{s.snapshotVersion}</span>
      <span className="text-xs rounded-full bg-muted px-2 py-0.5 shrink-0">{s.triggerType}</span>
      <span className="flex-1 text-xs text-muted-foreground">{new Date(s.takenAt).toLocaleString()}</span>
      <span className="text-xs">{s.policyCount} policies</span>
      {s.activeConflictCount > 0 && (
        <span className="text-xs text-red-600 font-medium">{s.activeConflictCount} conflicts</span>
      )}
    </button>
  )
}

function SnapshotDetail({ snapshot, onClose }: { snapshot: Snapshot; onClose: () => void }) {
  return (
    <div className="rounded-lg border p-4 space-y-2 bg-card">
      <div className="flex items-center gap-2">
        <p className="font-semibold text-sm">Snapshot v{snapshot.snapshotVersion}</p>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={onClose}>Close</Button>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <dt className="text-muted-foreground">Trigger</dt><dd>{snapshot.triggerType}</dd>
        <dt className="text-muted-foreground">Taken at</dt><dd>{new Date(snapshot.takenAt).toLocaleString()}</dd>
        <dt className="text-muted-foreground">Policies</dt><dd>{snapshot.policyCount}</dd>
        <dt className="text-muted-foreground">Active conflicts</dt><dd className={snapshot.activeConflictCount > 0 ? 'text-red-600' : ''}>{snapshot.activeConflictCount}</dd>
        <dt className="text-muted-foreground">Hash</dt>
        <dd className="font-mono truncate">{snapshot.snapshotHash?.slice(0, 24) ?? '—'}…</dd>
        {snapshot.notes && <><dt className="text-muted-foreground">Notes</dt><dd>{snapshot.notes}</dd></>}
      </dl>
    </div>
  )
}
