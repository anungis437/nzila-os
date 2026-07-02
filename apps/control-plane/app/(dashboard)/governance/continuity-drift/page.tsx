import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { getKTDecisionIntelligenceSnapshot } from '../_kt-data'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Continuity Drift — Nzila OS Control Plane',
  description:
    'Continuity intelligence view of governance drift, fragility, institutional memory coverage, and escalation stability.',
}

function severityLabel(score: number) {
  if (score >= 80) return 'Critical'
  if (score >= 65) return 'Elevated'
  if (score >= 40) return 'Moderate'
  return 'Controlled'
}

export default async function ContinuityDriftPage() {
  const snapshot = await getKTDecisionIntelligenceSnapshot()
  const c = snapshot.continuitySignal

  return (
    <div className="space-y-8">
      <PageHeader
        title="Continuity Drift Observatory"
        description="Institutional continuity diagnostics: governance drift, concentration risk, institutional memory, and escalation volatility."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Overall Continuity Risk</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{c.overallRiskScore}</p>
          <StatusBadge
            status={c.overallRiskScore >= 65 ? 'degraded' : 'healthy'}
            label={severityLabel(c.overallRiskScore)}
          />
        </article>
        <article className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Governance Drift</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{c.governanceDriftScore}</p>
        </article>
        <article className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Operational Fragility</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{c.operationalFragilityIndex}</p>
        </article>
        <article className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Institutional Memory Coverage</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{c.institutionalMemoryScore}</p>
        </article>
        <article className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Escalation Instability</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{c.escalationInstabilityScore}</p>
        </article>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">Drift and Evidence Traceability</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Continuity drift is mapped to concrete governance concerns, evidence references, and unresolved unknowns.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left text-muted-foreground">Category</th>
                <th className="px-3 py-2 text-left text-muted-foreground">Concern</th>
                <th className="px-3 py-2 text-left text-muted-foreground">Trend</th>
                <th className="px-3 py-2 text-left text-muted-foreground">Evidence</th>
                <th className="px-3 py-2 text-left text-muted-foreground">Unknowns</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.situationAssessments.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 capitalize">{s.category}</td>
                  <td className="px-3 py-2 text-foreground">{s.concern}</td>
                  <td className="px-3 py-2 capitalize">{s.trend}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.evidenceRefs.join(', ') || 'n/a'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.unknowns.join(' | ') || 'none recorded'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">Governance Rationale and Evidence Packs</h2>
        <div className="mt-3 grid gap-3 xl:grid-cols-2">
          {snapshot.rationales.map((r) => (
            <article key={r.id} className="rounded-md border border-border p-4">
              <p className="text-sm font-medium text-foreground">{r.decisionTitle}</p>
              <p className="mt-1 text-sm text-muted-foreground">{r.outcome}</p>
              <p className="mt-2 text-xs text-muted-foreground">Replay hash: {r.replayHash}</p>
            </article>
          ))}
          {snapshot.evidencePacks.map((p) => (
            <article key={p.id} className="rounded-md border border-border p-4">
              <p className="text-sm font-medium text-foreground">{p.decisionTitle}</p>
              <p className="mt-1 text-sm text-muted-foreground">{p.executiveSummary}</p>
              <p className="mt-2 text-xs text-muted-foreground">Pack hash: {p.packHash}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
