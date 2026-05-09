import type { ReviewDecision, ReviewWorkflow } from '@nzila/governance-review'
import { CalmCard } from './primitives'

interface DecisionLedgerPanelProps {
  readonly decisions: readonly ReviewDecision[]
  readonly workflow?: ReviewWorkflow
}

/**
 * Append-only decision ledger view. Supersession history is visible;
 * the experience never hides a superseded decision.
 */
export function DecisionLedgerPanel({ decisions, workflow }: DecisionLedgerPanelProps) {
  const filtered = workflow ? decisions.filter((d) => d.workflow === workflow) : decisions
  const ordered = [...filtered].sort((a, b) => (a.decidedAt < b.decidedAt ? 1 : -1))
  if (ordered.length === 0) {
    return (
      <CalmCard>
        <h3 className="text-base font-semibold text-card-foreground">Decision ledger</h3>
        <p className="mt-3 text-sm text-muted-foreground">
          No governance decisions recorded {workflow ? `for ${workflow}` : 'in the current window'}.
        </p>
      </CalmCard>
    )
  }
  const supersededIds = new Set(ordered.filter((d) => d.supersedes).map((d) => d.supersedes!))
  return (
    <CalmCard>
      <h3 className="text-base font-semibold text-card-foreground">
        Decision ledger {workflow ? `· ${workflow}` : ''}
      </h3>
      <ol className="mt-4 space-y-5">
        {ordered.map((d) => {
          const isSuperseded = supersededIds.has(d.id)
          return (
            <li key={d.id} className="border-l-2 border-border pl-4">
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-sm font-medium text-card-foreground">
                  {d.decision}
                  {isSuperseded ? (
                    <span className="ml-2 text-xs uppercase tracking-wide text-muted-foreground">
                      superseded
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(d.decidedAt).toUTCString()}
                </p>
              </div>
              <p className="mt-1 text-sm text-card-foreground">{d.rationale}</p>
              {d.conditions && d.conditions.length > 0 ? (
                <ul className="mt-2 list-disc pl-4 text-xs text-muted-foreground">
                  {d.conditions.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
                {d.workflow} · {d.reviewerRole} · {d.citedDoctrine.join(' · ')}
                {d.supersedes ? ` · supersedes ${d.supersedes}` : ''}
              </p>
            </li>
          )
        })}
      </ol>
    </CalmCard>
  )
}
