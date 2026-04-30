import { Suspense } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { CardSkeleton } from '@/components/ui/loading'
import { getCommercialMetricsDashboard } from '@/server/commercial-metrics-data'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Business Metrics — Nzila OS Control Plane',
  description: 'Commercial instrumentation: funnel, cohort retention, feature usage, and early revenue proxies.',
}

async function BusinessMetricsContent() {
  const data = await getCommercialMetricsDashboard(90)

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">Funnel visualization</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {data.funnel.map((stage) => (
            <div key={stage.stage} className="rounded border border-border p-3">
              <p className="text-xs text-muted-foreground">{stage.stage}</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{stage.users}</p>
              <p className="text-xs text-muted-foreground">Conversion: {(stage.conversionRate * 100).toFixed(2)}%</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">Cohort retention (D1 / D7 / D30)</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left text-muted-foreground">Cohort</th>
                <th className="px-3 py-2 text-right text-muted-foreground">D1</th>
                <th className="px-3 py-2 text-right text-muted-foreground">D7</th>
                <th className="px-3 py-2 text-right text-muted-foreground">D30</th>
              </tr>
            </thead>
            <tbody>
              {data.retention.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-4 text-muted-foreground">No cohort retention events yet.</td></tr>
              ) : (
                data.retention.map((row) => (
                  <tr key={row.cohort} className="border-b border-border">
                    <td className="px-3 py-2 font-mono text-xs">{row.cohort}</td>
                    <td className="px-3 py-2 text-right">{row.day1}</td>
                    <td className="px-3 py-2 text-right">{row.day7}</td>
                    <td className="px-3 py-2 text-right">{row.day30}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">Feature usage + revenue proxies</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Active users: {data.revenueProxy.activeUsers} · Conversion signals: {data.revenueProxy.conversionSignals} · Weighted proxy score: {data.revenueProxy.weightedProxyScore}
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {data.featureUsage.length === 0 ? (
            <li className="text-muted-foreground">No feature usage events yet.</li>
          ) : (
            data.featureUsage.map((row) => (
              <li key={row.feature} className="flex justify-between rounded border border-border px-3 py-2">
                <span>{row.feature}</span>
                <span className="font-semibold">{row.events}</span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  )
}

export default function BusinessMetricsPage() {
  return (
    <>
      <PageHeader
        title="Business Metrics"
        description="Acquisition, activation, retention, feature adoption, and early revenue proxies for commercial readiness."
      />
      <Suspense fallback={<CardSkeleton count={3} />}>
        <BusinessMetricsContent />
      </Suspense>
    </>
  )
}
