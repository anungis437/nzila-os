import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { getKTDecisionIntelligenceSnapshot } from '../_kt-data'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Decision Matrices — Nzila OS Control Plane',
  description:
    'Weighted decision science with MUST/WANT criteria, alternatives, risk acceptance, and governance rationale traceability.',
}

export default async function DecisionMatricesPage() {
  const snapshot = await getKTDecisionIntelligenceSnapshot()

  return (
    <div className="space-y-8">
      <PageHeader
        title="Decision Matrices"
        description="Formal KT decision analysis for release governance, architecture, procurement, and continuity strategy choices."
      />

      {snapshot.decisionAnalyses.map((d) => (
        <section key={d.id} className="rounded-lg border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">{d.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{d.objective}</p>
            </div>
            <StatusBadge status={d.status === 'decided' ? 'healthy' : 'degraded'} label={d.status} />
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <article className="rounded-md border border-border p-4">
              <h3 className="text-sm font-medium text-foreground">MUST Criteria</h3>
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                {d.mustCriteria.map((c) => (
                  <li key={c.id} className="rounded bg-muted/30 px-3 py-2">
                    <p className="font-medium text-foreground">{c.label}</p>
                    <p>{c.description}</p>
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-md border border-border p-4">
              <h3 className="text-sm font-medium text-foreground">WANT Criteria</h3>
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                {d.wantCriteria.map((c) => (
                  <li key={c.id} className="rounded bg-muted/30 px-3 py-2">
                    <p className="font-medium text-foreground">{c.label}</p>
                    <p>{c.description}</p>
                    <p className="mt-1 text-xs">Weight: {c.weight}</p>
                  </li>
                ))}
              </ul>
            </article>
          </div>

          <article className="mt-5 rounded-md border border-border p-4">
            <h3 className="text-sm font-medium text-foreground">Alternatives and Scoring</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left text-muted-foreground">Alternative</th>
                    <th className="px-3 py-2 text-right text-muted-foreground">Weighted Score</th>
                    <th className="px-3 py-2 text-left text-muted-foreground">MUST Pass</th>
                    <th className="px-3 py-2 text-left text-muted-foreground">Risks</th>
                  </tr>
                </thead>
                <tbody>
                  {d.alternatives.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-muted-foreground" colSpan={4}>
                        Alternatives are being assembled under governance review.
                      </td>
                    </tr>
                  ) : (
                    d.alternatives.map((a) => (
                      <tr key={a.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 text-foreground">{a.name}</td>
                        <td className="px-3 py-2 text-right font-mono">{a.weightedScore}</td>
                        <td className="px-3 py-2">
                          <StatusBadge status={a.passesAllMust ? 'healthy' : 'failed'} label={a.passesAllMust ? 'Pass' : 'Fail'} />
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{a.risks.join(', ') || 'None recorded'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className="mt-5 rounded-md border border-border p-4">
            <h3 className="text-sm font-medium text-foreground">Governance Linkage</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Evidence refs: {d.evidenceRefs.join(', ') || 'No evidence linked yet.'}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Continuity implications: {d.continuityImplications.join(' | ') || 'No continuity implications recorded.'}
            </p>
          </article>
        </section>
      ))}
    </div>
  )
}
