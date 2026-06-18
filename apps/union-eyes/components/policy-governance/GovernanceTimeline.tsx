'use client'

import { useState, useEffect, useCallback } from 'react'
import { LifecycleBadge } from './LifecycleBadge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface GovernanceEvent {
  id: string
  eventType: string
  policyId: string
  actorUserId?: string | null
  actorRole?: string | null
  fromStatus?: string | null
  toStatus?: string | null
  correlationId?: string | null
  payload?: Record<string, unknown> | null
  occurredAt: string
}

export default function GovernanceTimeline() {
  const [events, setEvents] = useState<GovernanceEvent[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [policyId, setPolicyId] = useState('')
  const [eventType, setEventType] = useState('all')

  const loadEvents = useCallback(async () => {
    const params = new URLSearchParams({ limit: '50' })
    if (policyId) params.set('policyId', policyId)
    if (eventType !== 'all') params.set('eventType', eventType)
    const res = await fetch(`/api/governance/lifecycle/policy-events?${params}`)
    const data = await res.json()
    setEvents(data.events ?? [])
    setTotal(data.total ?? 0)
    setLoading(false)
  }, [policyId, eventType])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadEvents()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadEvents])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Filter by policy ID…"
          value={policyId}
          onChange={(e) => setPolicyId(e.target.value)}
          className="w-72"
        />
        <Select value={eventType} onValueChange={setEventType}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Event type" />
          </SelectTrigger>
          <SelectContent>
            {['all', 'draft_created', 'published', 'activated', 'superseded', 'deprecated', 'revoked',
              'archived', 'approval_requested', 'approved', 'rejected', 'snapshot_taken'].map((t) => (
              <SelectItem key={t} value={t}>{t === 'all' ? 'All events' : t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground self-center ml-auto">{total} events</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </div>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No governance events found.</p>
      ) : (
        <ol className="relative border-l border-border space-y-4 pl-5">
          {events.map((ev) => (
            <li key={ev.id} className="relative">
              <span className="absolute -left-5.25 top-1.5 h-3 w-3 rounded-full border-2 border-background bg-primary" />
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono font-medium">{ev.eventType}</span>
                  {ev.fromStatus && ev.toStatus && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <LifecycleBadge state={ev.fromStatus} size="sm" />
                      <span>→</span>
                      <LifecycleBadge state={ev.toStatus} size="sm" />
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{new Date(ev.occurredAt).toLocaleString()}</span>
                  {ev.actorRole && <span>by {ev.actorRole}</span>}
                  <span className="font-mono truncate max-w-50">{ev.policyId.slice(0, 8)}…</span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
