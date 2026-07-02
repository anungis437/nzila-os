import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { getKTDecisionIntelligenceSnapshot } from '../_kt-data'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Problem Analysis — Nzila OS Control Plane',
  description:
    'Forensic KT problem analysis for governance drift, continuity deviations, and release regression root-cause determination.',
}

export default async function ProblemAnalysisPage() {
  const snapshot = await getKTDecisionIntelligenceSnapshot()

  return (
    <div className="space-y-8">
      <PageHeader
        title="Problem Analysis"
        description="Structured deviation analysis using WHAT, WHERE, WHEN, EXTENT, IS / IS NOT, and CHANGE correlation."
      />

      {snapshot.problemAnalyses.map((p) => (
        <section key={p.id} className="rounded-lg border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">{p.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
            </div>
            <StatusBadge
              status={p.analysisConfidence >= 70 ? 'healthy' : p.analysisConfidence >= 40 ? 'degraded' : 'failed'}
              label={`Confidence ${p.analysisConfidence}%`}
            />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-md border border-border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">What</p>
              <p className="mt-2 text-sm text-foreground"><span className="font-medium">IS:</span> {p.what.is}</p>
              <p className="mt-1 text-sm text-muted-foreground"><span className="font-medium text-foreground">IS NOT:</span> {p.what.isNot}</p>
            </article>
            <article className="rounded-md border border-border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Where</p>
              <p className="mt-2 text-sm text-foreground"><span className="font-medium">IS:</span> {p.where.is}</p>
              <p className="mt-1 text-sm text-muted-foreground"><span className="font-medium text-foreground">IS NOT:</span> {p.where.isNot}</p>
            </article>
            <article className="rounded-md border border-border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">When</p>
              <p className="mt-2 text-sm text-foreground"><span className="font-medium">IS:</span> {p.when.is}</p>
              <p className="mt-1 text-sm text-muted-foreground"><span className="font-medium text-foreground">IS NOT:</span> {p.when.isNot}</p>
            </article>
            <article className="rounded-md border border-border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Extent</p>
              <p className="mt-2 text-sm text-foreground"><span className="font-medium">IS:</span> {p.extent.is}</p>
              <p className="mt-1 text-sm text-muted-foreground"><span className="font-medium text-foreground">IS NOT:</span> {p.extent.isNot}</p>
              <p className="mt-2 text-xs text-muted-foreground">Severity level: {p.extent.severityLevel}</p>
            </article>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <article className="rounded-md border border-border p-4">
              <h3 className="text-sm font-medium text-foreground">Release Correlation</h3>
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                {p.releaseCorrelations.map((c) => (
                  <li key={c.releaseId} className="rounded bg-muted/30 px-3 py-2">
                    <span className="font-medium text-foreground">{c.releaseId}</span>
                    <span className="mx-2">•</span>
                    <span className="capitalize">{c.correlationStrength}</span>
                    <p className="mt-1">{c.changeDescription}</p>
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-md border border-border p-4">
              <h3 className="text-sm font-medium text-foreground">Telemetry Overlay</h3>
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                {p.telemetryMarkers.map((m) => (
                  <li key={`${m.metric}-${m.observedAt}`} className="rounded bg-muted/30 px-3 py-2">
                    <p className="font-medium text-foreground">{m.metric}</p>
                    <p>Value: {String(m.value)} • Baseline: {String(m.baseline ?? 'n/a')}</p>
                    <p>Deviation: {m.deviationPct ?? 0}%</p>
                  </li>
                ))}
              </ul>
            </article>
          </div>

          <article className="mt-5 rounded-md border border-border p-4">
            <h3 className="text-sm font-medium text-foreground">Continuity Implications</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {p.continuityImplications.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </article>
        </section>
      ))}
    </div>
  )
}
