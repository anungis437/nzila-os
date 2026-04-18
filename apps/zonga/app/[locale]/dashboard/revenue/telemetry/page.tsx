import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import { Card } from '@nzila/ui'
import { getRevenueTelemetryDashboard } from '@/lib/actions/revenue-actions'

function fmtMoney(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)
}

function fmtPct(value: number): string {
  return `${value.toFixed(2)}%`
}

export default async function RevenueTelemetryPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const data = await getRevenueTelemetryDashboard(30)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-navy">Revenue Telemetry Dashboard</h1>
        <p className="text-muted-foreground mt-1">Production readiness metrics for conversion, MRR, churn, M-Pesa and CAC performance.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Card><div className="p-5"><p className="text-xs text-muted-foreground">Creator Signups (30d)</p><p className="text-2xl font-bold text-foreground">{data.creatorSignups}</p></div></Card>
        <Card><div className="p-5"><p className="text-xs text-muted-foreground">Paid Conversions</p><p className="text-2xl font-bold text-emerald-600">{data.paidConversions.captured}</p><p className="text-xs text-muted-foreground">{fmtPct(data.paidConversions.ratePct)} of intents</p></div></Card>
        <Card><div className="p-5"><p className="text-xs text-muted-foreground">M-Pesa Success Rate</p><p className="text-2xl font-bold text-green-700">{fmtPct(data.mpesaSuccess.ratePct)}</p><p className="text-xs text-muted-foreground">{data.mpesaSuccess.captured}/{data.mpesaSuccess.total} captured</p></div></Card>
        <Card><div className="p-5"><p className="text-xs text-muted-foreground">Stripe MRR</p><p className="text-2xl font-bold text-purple-700">{fmtMoney(data.stripeMrrUsd)}</p></div></Card>
        <Card><div className="p-5"><p className="text-xs text-muted-foreground">Churn (30d)</p><p className="text-2xl font-bold text-amber-700">{data.churn.cancelledLast30d}</p></div></Card>
      </div>

      <Card>
        <div className="p-5">
          <h2 className="text-lg font-semibold text-foreground mb-3">CAC by Source</h2>
          {data.cacBySource.length === 0 ? (
            <p className="text-sm text-muted-foreground">No source attribution data available yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {data.cacBySource.map((row) => (
                <div key={row.source} className="grid grid-cols-4 gap-4 py-3 text-sm">
                  <div className="font-medium text-foreground">{row.source}</div>
                  <div className="text-muted-foreground">Spend: {fmtMoney(row.acquisitionCostUsd)}</div>
                  <div className="text-muted-foreground">Conversions: {row.paidConversions}</div>
                  <div className="font-semibold text-foreground">CAC: {fmtMoney(row.cacUsd)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
