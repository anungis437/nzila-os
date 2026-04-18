import { headers } from 'next/headers'
import type { CommandCenterSnapshot, CommandAlert, AlertSeverity } from '@/app/api/control-plane/revenue/command-center/route'

async function loadCommandCenter(): Promise<CommandCenterSnapshot | null> {
  try {
    const h = await headers()
    const host = h.get('host')
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https'
    const res = await fetch(
      `${protocol}://${host}/api/control-plane/revenue/command-center`,
      { cache: 'no-store' },
    )
    if (!res.ok) return null
    const json = await res.json()
    return json.data as CommandCenterSnapshot
  } catch {
    return null
  }
}

function currency(v: number) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(v)
}

function severityBadge(s: AlertSeverity) {
  const classes: Record<AlertSeverity, string> = {
    critical: 'bg-red-100 text-red-700 border border-red-200',
    high: 'bg-orange-100 text-orange-700 border border-orange-200',
    medium: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
    low: 'bg-gray-100 text-gray-600 border border-gray-200',
  }
  return classes[s]
}

function appBadge(appId: string) {
  const map: Record<string, string> = {
    'union-eyes': 'bg-blue-50 text-blue-700',
    flow: 'bg-emerald-50 text-emerald-700',
    zonga: 'bg-purple-50 text-purple-700',
  }
  return map[appId] ?? 'bg-gray-50 text-gray-600'
}

function AlertCard({ alert }: { alert: CommandAlert }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${severityBadge(alert.severity)}`}>
            {alert.severity.toUpperCase()}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${appBadge(alert.appId)}`}>
            {alert.appId}
          </span>
        </div>
        {alert.ageHours !== undefined && (
          <span className="text-xs text-muted-foreground whitespace-nowrap">{alert.ageHours}h ago</span>
        )}
        {alert.daysUntilExpiry !== undefined && (
          <span className="text-xs text-red-600 font-semibold whitespace-nowrap">
            {alert.daysUntilExpiry}d remaining
          </span>
        )}
      </div>
      <p className="font-semibold text-foreground text-sm">{alert.label}</p>
      <p className="text-xs text-muted-foreground">{alert.detail}</p>
      <div className="mt-2 px-3 py-2 bg-muted/50 rounded-lg text-xs text-foreground">
        <span className="font-semibold">Suggested action: </span>{alert.suggestedAction}
      </div>
    </div>
  )
}

export default async function RevenueCommandCenterPage() {
  const data = await loadCommandCenter()

  if (!data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
        Command Center snapshot unavailable.
      </div>
    )
  }

  const { kpis, alerts, scoreboard } = data

  const criticalAlerts = alerts.filter((a) => a.severity === 'critical')
  const highAlerts = alerts.filter((a) => a.severity === 'high')
  const otherAlerts = alerts.filter((a) => a.severity !== 'critical' && a.severity !== 'high')

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Revenue Command Center</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Stale leads, stalled trials, pilot expiry alerts, and rep scoreboard.
          Snapshot as of {new Date(data.generatedAt).toLocaleString('en-CA')}.
        </p>
      </div>

      {data.dataMode === 'demo' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800 text-sm">
          Demo mode: live commercial signal ingestion is unavailable for this environment.
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'New leads today', value: kpis.newLeadsToday, highlight: false },
          { label: 'Stale leads', value: kpis.staleLeads, highlight: kpis.staleLeads > 5 },
          { label: 'Stalled trials', value: kpis.stalledTrials, highlight: kpis.stalledTrials > 2 },
          { label: 'Pilots expiring (14d)', value: kpis.pilotsExpiringIn14d, highlight: kpis.pilotsExpiringIn14d > 0 },
          { label: 'Proposals stalled (72h+)', value: kpis.proposalsPendingOver72h, highlight: kpis.proposalsPendingOver72h > 3 },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className={`rounded-xl border p-4 ${kpi.highlight ? 'border-red-200 bg-red-50' : 'border-border bg-card'}`}
          >
            <div className={`text-3xl font-bold ${kpi.highlight ? 'text-red-600' : 'text-foreground'}`}>
              {kpi.value}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">ARR added this month</div>
          <div className="text-2xl font-bold text-foreground">{currency(kpis.arrAddedThisMonth)}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">MRR delta WoW</div>
          <div className={`text-2xl font-bold ${kpis.mrrDeltaWow >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {kpis.mrrDeltaWow >= 0 ? '+' : ''}{currency(kpis.mrrDeltaWow)}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Win rate</div>
          <div className="text-2xl font-bold text-foreground">{kpis.winRatePct}%</div>
        </div>
      </div>

      {/* Alerts — Critical */}
      {criticalAlerts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-red-700 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-600 inline-block" />
            Critical ({criticalAlerts.length})
          </h2>
          {criticalAlerts.map((a) => <AlertCard key={a.id} alert={a} />)}
        </div>
      )}

      {/* Alerts — High */}
      {highAlerts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-orange-700 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
            High Priority ({highAlerts.length})
          </h2>
          {highAlerts.map((a) => <AlertCard key={a.id} alert={a} />)}
        </div>
      )}

      {/* Alerts — Medium/Low */}
      {otherAlerts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-muted-foreground flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />
            Watch ({otherAlerts.length})
          </h2>
          {otherAlerts.map((a) => <AlertCard key={a.id} alert={a} />)}
        </div>
      )}

      {/* Rep Scoreboard */}
      <div>
        <h2 className="text-base font-semibold text-foreground mb-3">Rep Scoreboard — This Month</h2>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rep</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">ARR Closed</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deals Won</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pipeline</th>
              </tr>
            </thead>
            <tbody>
              {scoreboard.map((row, i) => (
                <tr key={row.rep} className={i < scoreboard.length - 1 ? 'border-b border-border' : ''}>
                  <td className="p-3 font-medium text-foreground">{row.rep}</td>
                  <td className="p-3 text-right font-bold text-emerald-600">{currency(row.arrClosed)}</td>
                  <td className="p-3 text-right text-foreground">{row.dealsWon}</td>
                  <td className="p-3 text-right text-muted-foreground">{currency(row.pipeline)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
