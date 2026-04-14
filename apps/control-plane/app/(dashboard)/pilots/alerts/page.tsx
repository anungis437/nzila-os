import Link from 'next/link'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { SummaryCard } from '@/components/ui/summary-card'
import { getAlertInbox } from '@/server/pilot-metrics-data'

export const dynamic = 'force-dynamic'

export default async function PilotAlertsInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ orgId?: string; severity?: 'info' | 'warning' | 'critical'; status?: 'open' | 'acknowledged' | 'in_progress' | 'resolved' | 'auto_resolved'; active?: string }>
}) {
  const { orgId, severity, status, active } = await searchParams

  if (!orgId) {
    return (
      <>
        <PageHeader title="Pilot Alerts" description="Cross-pilot incident inbox and operations metrics" />
        <EmptyState title="Organization context required" message="Add ?orgId=<uuid> to load pilot alert operations." />
      </>
    )
  }

  const inbox = await getAlertInbox(orgId, {
    severity: severity ? [severity] : undefined,
    status: status ? [status] : undefined,
    activeIncidentsOnly: active === 'true',
  })

  if (inbox.alerts.length === 0) {
    return (
      <>
        <PageHeader title="Pilot Alerts" description="Cross-pilot incident inbox and operations metrics" />
        <EmptyState title="No alerts" message="No alert incidents matched the selected filters." />
      </>
    )
  }

  return (
    <>
      <PageHeader title="Pilot Alerts" description="Alert Inbox • Active Incidents • Lifecycle Operations" />

      <div className="mb-6 flex flex-wrap gap-2 text-sm">
        <Link className="text-primary underline" href={`/pilots/alerts?orgId=${orgId}`}>All</Link>
        <Link className="text-primary underline" href={`/pilots/alerts?orgId=${orgId}&active=true`}>Active incidents</Link>
        <Link className="text-primary underline" href={`/pilots/alerts?orgId=${orgId}&severity=critical`}>Critical</Link>
        <Link className="text-primary underline" href={`/pilots/alerts?orgId=${orgId}&severity=warning`}>Warning</Link>
        <Link className="text-primary underline" href={`/pilots/alerts?orgId=${orgId}&severity=info`}>Info</Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard title="Total Alerts" value={inbox.summary.total} />
        <SummaryCard title="Active Incidents" value={inbox.summary.active} />
        <SummaryCard title="Critical" value={inbox.summary.critical} />
      </div>

      <div className="mt-8 space-y-3">
        {inbox.alerts.map((alert) => (
          <div key={alert.id} className="rounded-md border border-border p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">[{alert.severity}] {alert.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{alert.message}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  pilot: {alert.pilotId} • metric: {alert.metricName ?? 'n/a'} • status: {alert.status}
                </p>
                <p className="text-xs text-muted-foreground">
                  value {alert.metricValue ?? 0} vs threshold {alert.thresholdValue ?? 0} • occurrences: {alert.occurrenceCount}
                </p>
                <p className="text-xs text-muted-foreground">first seen: {new Date(alert.firstSeenAt).toLocaleString()} • last seen: {new Date(alert.lastSeenAt).toLocaleString()}</p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p>playbook: {alert.playbookKey ?? 'none'}</p>
                <p className="mt-1">correlation: {alert.correlationId ?? 'none'}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
