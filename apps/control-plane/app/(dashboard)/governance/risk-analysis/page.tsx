import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { getKTDecisionIntelligenceSnapshot } from '../_kt-data'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Risk Analysis — Nzila OS Control Plane',
  description:
    'Potential Problem / Opportunity Analysis with probability, severity, prevention plans, contingencies, and rollout confidence indicators.',
}

export default async function RiskAnalysisPage() {
  const snapshot = await getKTDecisionIntelligenceSnapshot()

  return (
    <div className="space-y-8">
      <PageHeader
        title="Potential Problem / Opportunity Analysis"
        description="Pre-mortem governance for deployments, pilots, and migrations with readiness scoring and confidence posture."
      />

      {snapshot.ppoaAnalyses.map((a) => (
        <section key={a.id} className="rounded-lg border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">{a.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{a.context}</p>
            </div>
            <StatusBadge
              status={a.rolloutConfidenceScore >= 80 ? 'healthy' : a.rolloutConfidenceScore >= 60 ? 'degraded' : 'failed'}
              label={`Rollout confidence ${a.rolloutConfidenceScore}%`}
            />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-md border border-border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Context Type</p>
              <p className="mt-2 text-sm capitalize text-foreground">{a.contextType.replace('-', ' ')}</p>
            </article>
            <article className="rounded-md border border-border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Operational Readiness</p>
              <p className="mt-2 text-sm font-mono text-foreground">{a.operationalReadinessScore}/100</p>
            </article>
            <article className="rounded-md border border-border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Critical Risk Count</p>
              <p className="mt-2 text-sm font-mono text-foreground">{a.criticalRiskCount}</p>
            </article>
            <article className="rounded-md border border-border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Governance Maturity</p>
              <p className="mt-2 text-sm capitalize text-foreground">{a.governanceMaturity}</p>
            </article>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <article className="rounded-md border border-border p-4">
              <h3 className="text-sm font-medium text-foreground">Potential Problems</h3>
              {a.risks.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Risk register is being finalized for this analysis window.</p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                  {a.risks.map((r) => (
                    <li key={r.id} className="rounded bg-muted/30 px-3 py-2">
                      <p className="font-medium text-foreground">{r.description}</p>
                      <p>Probability {r.probability} • Severity {r.severity} • Residual {r.residualRisk}</p>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="rounded-md border border-border p-4">
              <h3 className="text-sm font-medium text-foreground">Potential Opportunities</h3>
              {a.opportunities.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Opportunity leverage points are being assessed.</p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                  {a.opportunities.map((o) => (
                    <li key={o.id} className="rounded bg-muted/30 px-3 py-2">
                      <p className="font-medium text-foreground">{o.description}</p>
                      <p>Probability {o.probability} • Impact {o.impact} • Score {o.opportunityScore}</p>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </div>
        </section>
      ))}
    </div>
  )
}
