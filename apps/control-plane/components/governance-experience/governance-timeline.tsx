import type { TimelineEntry } from '@nzila/governance-operations'
import { CalmCard } from './primitives'

interface GovernanceTimelineProps {
  readonly entries: readonly TimelineEntry[]
}

/**
 * Sparse governance-safe timeline. No payloads. No person-resolving
 * content. Newest-first. No animation.
 */
export function GovernanceTimeline({ entries }: GovernanceTimelineProps) {
  if (entries.length === 0) {
    return (
      <CalmCard>
        <h3 className="text-base font-semibold text-card-foreground">Governance timeline</h3>
        <p className="mt-3 text-sm text-muted-foreground">No governance events recorded in the current window.</p>
      </CalmCard>
    )
  }
  return (
    <CalmCard>
      <h3 className="text-base font-semibold text-card-foreground">Governance timeline</h3>
      <ol className="mt-4 space-y-4">
        {entries.map((e) => (
          <li key={e.id} className="border-l-2 border-border pl-4">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-sm font-medium text-card-foreground">{e.eventType}</p>
              <p className="text-xs text-muted-foreground">{new Date(e.occurredAt).toUTCString()}</p>
            </div>
            <p className="mt-1 text-sm text-card-foreground">{e.summary}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
              {e.severity}
              {e.doctrineDocument ? ` · ${e.doctrineDocument}` : ''}
              {e.contentHash ? ` · ${e.contentHash}` : ''}
            </p>
          </li>
        ))}
      </ol>
    </CalmCard>
  )
}
