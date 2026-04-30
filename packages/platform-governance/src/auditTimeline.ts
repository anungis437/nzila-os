import { randomUUID } from 'node:crypto'
import type { AuditTimelineEntry, GovernanceEventType, GovernanceAuditTimelineEntry } from './types'

const timeline: AuditTimelineEntry[] = []

export function recordAuditEvent(params: {
  eventType: GovernanceEventType
  actor: string
  orgId: string
  app: string
  policyResult: 'pass' | 'fail' | 'warn'
  commitHash: string
  details?: Record<string, unknown>
}): AuditTimelineEntry {
  const entry: AuditTimelineEntry = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    ...params,
  }
  timeline.push(entry)
  return entry
}

export function getAuditTimeline(filters?: {
  orgId?: string
  app?: string
  eventType?: GovernanceEventType
  since?: string
}): AuditTimelineEntry[] {
  let results = [...timeline]

  if (filters?.orgId) {
    results = results.filter((e) => e.orgId === filters.orgId)
  }
  if (filters?.app) {
    results = results.filter((e) => e.app === filters.app)
  }
  if (filters?.eventType) {
    results = results.filter((e) => e.eventType === filters.eventType)
  }
  if (filters?.since) {
    const sinceDate = new Date(filters.since)
    results = results.filter((e) => new Date(e.timestamp) >= sinceDate)
  }

  return results.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )
}

export function clearAuditTimeline(): void {
  timeline.length = 0
}

export function buildGovernanceAuditTimeline(filters?: {
  orgId?: string
  app?: string
  since?: string
}): GovernanceAuditTimelineEntry[] {
  const entries = getAuditTimeline(filters)

  return entries.map((entry) => ({
    timestamp: entry.timestamp,
    event_type: entry.eventType,
    actor: entry.actor,
    policy_result: entry.policyResult,
    policy_version: typeof entry.details?.['policyVersion'] === 'string' ? String(entry.details['policyVersion']) : undefined,
    commit_hash: entry.commitHash,
    source: entry.app,
  }))
}
