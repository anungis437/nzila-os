import { headers } from 'next/headers'

interface RevenueSnapshot {
  generatedAt: string
  dataMode?: 'live' | 'demo'
  leadsBySource: Array<{ source: string; count: number }>
  demosBooked: number
  proposalsSent: number
  pilotsActive: number
  dealsWon: number
  mrr: number
  arr: number
  arpu: number
  forecastArr90d: number
  funnelConversionPct?: number
  trialToPaidPct?: number
  pilotToPaidPct?: number
  winRatePct?: number
  avgSaleCycleDays?: number
  expansionRevenue?: number
}

async function loadSnapshot(): Promise<RevenueSnapshot | null> {
  try {
    const h = await headers()
    const host = h.get('host')
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https'
    const res = await fetch(`${protocol}://${host}/api/control-plane/revenue/pipeline`, {
      cache: 'no-store',
      headers: {
        'x-api-key': process.env.CONTROL_PLANE_API_KEY ?? '',
      },
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.data as RevenueSnapshot
  } catch {
    return null
  }
}

function currency(v: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(v)
}

export default async function RevenuePipelinePage() {
  const data = await loadSnapshot()

  if (!data) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">Revenue pipeline snapshot unavailable.</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Revenue Pipeline</h1>
        <p className="text-sm text-muted-foreground mt-1">Leads, demos, pilots, wins, and ARR forecast across Tier 1.</p>
      </div>

      {data.dataMode === 'demo' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800 text-sm">
          Demo mode: live commercial events are unavailable, so fallback values are shown.
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="MRR" value={currency(data.mrr)} />
        <MetricCard label="ARR" value={currency(data.arr)} />
        <MetricCard label="ARPU" value={currency(data.arpu)} />
        <MetricCard label="90-day ARR Forecast" value={currency(data.forecastArr90d)} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold mb-3">Pipeline Stages</h2>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between"><span>Demos booked</span><span className="font-bold">{data.demosBooked}</span></li>
            <li className="flex justify-between"><span>Proposals sent</span><span className="font-bold">{data.proposalsSent}</span></li>
            <li className="flex justify-between"><span>Pilots active</span><span className="font-bold">{data.pilotsActive}</span></li>
            <li className="flex justify-between"><span>Deals won</span><span className="font-bold">{data.dealsWon}</span></li>
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold mb-3">Leads by Source</h2>
          <ul className="space-y-2 text-sm">
            {data.leadsBySource.map((row) => (
              <li key={row.source} className="flex justify-between">
                <span>{row.source}</span>
                <span className="font-bold">{row.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {(data.funnelConversionPct !== undefined || data.winRatePct !== undefined) && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold mb-3">Funnel Conversion Metrics</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {data.funnelConversionPct !== undefined && (
              <div><span className="text-muted-foreground">Lead → Close</span><div className="font-bold text-lg">{data.funnelConversionPct}%</div></div>
            )}
            {data.trialToPaidPct !== undefined && (
              <div><span className="text-muted-foreground">Trial → Paid</span><div className="font-bold text-lg">{data.trialToPaidPct}%</div></div>
            )}
            {data.pilotToPaidPct !== undefined && (
              <div><span className="text-muted-foreground">Pilot → Paid</span><div className="font-bold text-lg">{data.pilotToPaidPct}%</div></div>
            )}
            {data.winRatePct !== undefined && (
              <div><span className="text-muted-foreground">Win Rate (demo → close)</span><div className="font-bold text-lg">{data.winRatePct}%</div></div>
            )}
            {data.avgSaleCycleDays !== undefined && (
              <div><span className="text-muted-foreground">Avg. Sale Cycle</span><div className="font-bold text-lg">{data.avgSaleCycleDays}d</div></div>
            )}
            {data.expansionRevenue !== undefined && data.expansionRevenue > 0 && (
              <div><span className="text-muted-foreground">Expansion MRR</span><div className="font-bold text-lg">{currency(data.expansionRevenue)}</div></div>
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">Snapshot generated: {new Date(data.generatedAt).toLocaleString()}</p>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-black text-foreground">{value}</p>
    </div>
  )
}
