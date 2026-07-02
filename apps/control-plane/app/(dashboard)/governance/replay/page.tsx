import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { getKTDecisionIntelligenceSnapshot } from '../_kt-data'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Governance Replay — Nzila OS Control Plane',
  description:
    'Replayable governance reasoning with rationale history, rejected paths, accepted risks, mitigation evolution, and lineage evidence.',
}

export default async function GovernanceReplayPage() {
  const snapshot = await getKTDecisionIntelligenceSnapshot()

  return (
    <div className="space-y-8">
      <PageHeader
        title="Governance Replay"
        description="Reconstruct why decisions were made, what alternatives were rejected, and how risk acceptances evolved over time."
      />

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">Replay Timeline</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Deterministic rationale playback for audit, board review, continuity transfer, and policy regression analysis.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left text-muted-foreground">Timestamp</th>
                <th className="px-3 py-2 text-left text-muted-foreground">Decision</th>
                <th className="px-3 py-2 text-left text-muted-foreground">Policy</th>
                <th className="px-3 py-2 text-right text-muted-foreground">Accepted Risks</th>
                <th className="px-3 py-2 text-right text-muted-foreground">Rejected Paths</th>
                <th className="px-3 py-2 text-right text-muted-foreground">Mitigations</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.replayTimeline.map((entry) => (
                <tr key={entry.rationaleId} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{entry.at}</td>
                  <td className="px-3 py-2 text-foreground">{entry.decisionTitle}</td>
                  <td className="px-3 py-2 text-muted-foreground">{entry.policyRef ?? 'n/a'}</td>
                  <td className="px-3 py-2 text-right font-mono">{entry.acceptedRiskCount}</td>
                  <td className="px-3 py-2 text-right font-mono">{entry.rejectedAlternativeCount}</td>
                  <td className="px-3 py-2 text-right font-mono">{entry.mitigationCommitmentCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-base font-semibold text-foreground">Reasoning Integrity</h2>
          <div className="mt-3 space-y-2">
            {snapshot.rationales.map((r) => (
              <div key={r.id} className="rounded border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{r.decisionTitle}</p>
                  <StatusBadge status={r.isReplayable ? 'healthy' : 'failed'} label={r.isReplayable ? 'Replayable' : 'Not replayable'} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Replay hash: {r.replayHash ?? 'missing'}</p>
                <p className="mt-1 text-sm text-muted-foreground">{r.rationale}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-base font-semibold text-foreground">Lineage Coverage</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Connected graph of decision origins, mitigated risks, and sealed evidence references.
          </p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {snapshot.lineage.edges.map((edge) => (
              <li key={edge.id} className="rounded border border-border p-3">
                <p className="font-medium text-foreground">{edge.relation}</p>
                <p className="mt-1">{edge.rationale}</p>
                <p className="mt-1 text-xs">Evidence refs: {edge.evidenceRefs.join(', ') || 'none'}</p>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </div>
  )
}
