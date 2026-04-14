import Link from 'next/link'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { SummaryCard } from '@/components/ui/summary-card'
import { getPilotDetail } from '@/server/pilot-metrics-data'
import type { PilotAlert } from '@nzila/platform-pilot-metrics-types'

export const dynamic = 'force-dynamic'

export default async function PilotDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ pilotId: string }>
  searchParams: Promise<{ orgId?: string }>
}) {
  const { pilotId } = await params
  const { orgId } = await searchParams

  if (!orgId) {
    return (
      <>
        <PageHeader title="Pilot Detail" description="Per-pilot proof metrics and health" />
        <EmptyState title="Organization context required" message="Add ?orgId=<uuid> to view live pilot metrics." />
      </>
    )
  }

  const detail = await getPilotDetail(orgId, pilotId)

  if (!detail.metrics.length && !detail.health) {
    return (
      <>
        <PageHeader title={detail.pilot.pilotName} description="Pilot proof metrics" />
        <EmptyState title="No pilot metric data yet" message="This pilot has no ingested metric events/rollups yet." />
      </>
    )
  }

  const byMetric = new Map<string, number>()
  for (const row of detail.metrics) {
    if (!byMetric.has(row.metricName)) byMetric.set(row.metricName, Number(row.valueNumeric ?? 0))
  }

  const topMetrics = [...byMetric.entries()].slice(0, 12)

  return (
    <>
      <PageHeader
        title={detail.pilot.pilotName}
        description={`${detail.pilot.appScope} • ${detail.pilot.pilotType} • ${detail.pilot.status}`}
      />

      <div className="mb-6 flex gap-3">
        <Link className="text-sm text-primary underline" href={`/pilots/health?orgId=${orgId}`}>
          Pilot Health Dashboard
        </Link>
        <Link className="text-sm text-primary underline" href={`/pilots/compare?orgId=${orgId}`}>
          Compare Pilots
        </Link>
        <Link className="text-sm text-primary underline" href={`/pilots/reports?orgId=${orgId}&pilotId=${pilotId}`}>
          Export Reports
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard title="Total Score" value={detail.health?.scoreTotal ?? 0} subtitle={`risk: ${detail.health?.riskLevel ?? 'unknown'}`} />
        <SummaryCard
          title="Open Alerts"
          value={detail.alerts.filter((a: PilotAlert) => a.status === 'open' || a.status === 'acknowledged' || a.status === 'in_progress').length}
          subtitle="unresolved"
        />
        <SummaryCard title="Metric Rollups" value={detail.metrics.length} subtitle="live (no seeded values)" />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <SummaryCard title="MTTA" value={Math.round(detail.alertOps?.mttaMinutes ?? 0)} subtitle="minutes to acknowledge" />
        <SummaryCard title="MTTR" value={Math.round(detail.alertOps?.mttrMinutes ?? 0)} subtitle="minutes to resolve" />
      </div>

      <h2 className="mt-8 mb-3 text-lg font-semibold">Metric Snapshots</h2>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {topMetrics.map(([metric, value]) => (
          <div key={metric} className="rounded-md border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{metric}</p>
            <p className="mt-1 text-xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-8 mb-3 text-lg font-semibold">Alert Timeline</h2>
      <div className="space-y-3">
        {detail.alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No alerts generated for this pilot.</p>
        ) : (
          detail.alerts.map((alert: PilotAlert) => (
            <div key={alert.id} className="rounded-md border border-border p-4">
              <p className="text-sm font-semibold">[{alert.severity}] {alert.title}</p>
              <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
              <p className="text-xs text-muted-foreground mt-2">status: {alert.status} • assignee: {alert.assigneeUserId ?? 'unassigned'} • occurrences: {alert.occurrenceCount}</p>
              <p className="text-xs text-muted-foreground">metric: {alert.metricName ?? 'n/a'} • value {alert.metricValue ?? 0} vs threshold {alert.thresholdValue ?? 0}</p>
              <p className="text-xs text-muted-foreground">trend: {String((alert.metadataJson as Record<string, unknown>)?.trend ?? 'n/a')}</p>
              <p className="text-xs text-muted-foreground">playbook: {alert.playbookKey ?? 'none'} • correlation: {alert.correlationId ?? 'none'}</p>
              {alert.whatHappened ? <p className="text-xs mt-2"><strong>What happened:</strong> {alert.whatHappened}</p> : null}
              {alert.whyItMatters ? <p className="text-xs"><strong>Why it matters:</strong> {alert.whyItMatters}</p> : null}
              {alert.whatToDoNext ? <p className="text-xs"><strong>What to do next:</strong> {alert.whatToDoNext}</p> : null}
              <p className="text-xs text-muted-foreground mt-2">first seen: {new Date(alert.firstSeenAt).toLocaleString()} • last seen: {new Date(alert.lastSeenAt).toLocaleString()}</p>

              {(alert.status === 'open' || alert.status === 'acknowledged' || alert.status === 'in_progress') ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <form method="post" action={`/api/control-plane/pilot-metrics/${detail.pilot.id}/alerts`}>
                    <input type="hidden" name="orgId" value={orgId} />
                    <input type="hidden" name="alertId" value={alert.id} />
                    <input type="hidden" name="action" value="acknowledge" />
                    <button type="submit" className="rounded border border-border px-2 py-1 text-xs">acknowledge</button>
                  </form>
                  <form method="post" action={`/api/control-plane/pilot-metrics/${detail.pilot.id}/alerts`}>
                    <input type="hidden" name="orgId" value={orgId} />
                    <input type="hidden" name="alertId" value={alert.id} />
                    <input type="hidden" name="action" value="resolve" />
                    <button type="submit" className="rounded border border-border px-2 py-1 text-xs">resolve</button>
                  </form>
                  <form method="post" action={`/api/control-plane/pilot-metrics/${detail.pilot.id}/alerts`}>
                    <input type="hidden" name="orgId" value={orgId} />
                    <input type="hidden" name="alertId" value={alert.id} />
                    <input type="hidden" name="action" value="escalate" />
                    <button type="submit" className="rounded border border-border px-2 py-1 text-xs">escalate</button>
                  </form>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </>
  )
}
