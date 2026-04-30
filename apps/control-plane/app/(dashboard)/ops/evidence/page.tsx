import { Suspense } from 'react'
import { Activity, AlertTriangle, ShieldCheck, Timer } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { SummaryCard } from '@/components/ui/summary-card'
import { CardSkeleton } from '@/components/ui/loading'
import { getOperatingEvidenceDashboard } from '@/server/operating-evidence-data'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Ops Evidence — Nzila OS Control Plane',
  description: 'Latency, failure, overrides, and system correction evidence for operational audit readiness.',
}

async function OpsEvidenceContent() {
  const data = await getOperatingEvidenceDashboard(30)

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard title="p50 Latency" icon={<Timer className="h-5 w-5" />} value={`${data.latency.p50.toFixed(0)}ms`} />
        <SummaryCard title="p95 Latency" icon={<Activity className="h-5 w-5" />} value={`${data.latency.p95.toFixed(0)}ms`} />
        <SummaryCard title="Error Ratio" icon={<AlertTriangle className="h-5 w-5" />} value={`${(data.errorRate.ratio * 100).toFixed(2)}%`} />
        <SummaryCard title="Override Ratio" icon={<ShieldCheck className="h-5 w-5" />} value={`${(data.overrideRatio.ratio * 100).toFixed(2)}%`} />
      </div>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">Failure clusters</h2>
        <p className="mt-1 text-sm text-muted-foreground">Top recurring operational fault groups used for post-incident prioritization.</p>
        <ul className="mt-3 space-y-2 text-sm">
          {data.failureClusters.length === 0 ? (
            <li className="text-muted-foreground">No failure clusters detected in this window.</li>
          ) : (
            data.failureClusters.map((cluster) => (
              <li key={cluster.key} className="flex justify-between rounded border border-border px-3 py-2">
                <span className="font-mono text-xs text-foreground">{cluster.key}</span>
                <span className="font-semibold text-foreground">{cluster.count}</span>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">System confidence vs correction</h2>
        <p className="mt-1 text-sm text-muted-foreground">How frequently humans corrected system decisions by confidence band.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left text-muted-foreground">Confidence</th>
                <th className="px-3 py-2 text-right text-muted-foreground">Decisions</th>
                <th className="px-3 py-2 text-right text-muted-foreground">Corrections</th>
                <th className="px-3 py-2 text-right text-muted-foreground">Correction Rate</th>
              </tr>
            </thead>
            <tbody>
              {data.confidenceVsCorrection.map((row) => {
                const rate = row.decisions > 0 ? (row.corrections / row.decisions) * 100 : 0
                return (
                  <tr key={row.bucket} className="border-b border-border">
                    <td className="px-3 py-2 font-mono text-xs">{row.bucket}</td>
                    <td className="px-3 py-2 text-right">{row.decisions}</td>
                    <td className="px-3 py-2 text-right">{row.corrections}</td>
                    <td className="px-3 py-2 text-right">{rate.toFixed(2)}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default function OpsEvidencePage() {
  return (
    <>
      <PageHeader
        title="Operating Evidence"
        description="Latency trends, failure clusters, override ratios, and correction behavior with sealed audit export support."
      />
      <Suspense fallback={<CardSkeleton count={4} />}>
        <OpsEvidenceContent />
      </Suspense>
    </>
  )
}
