/**
 * Zonga — Platform Operations (Server Component).
 *
 * Admin-only view of live system health: upload queue, moderation pipeline,
 * payout queue, takedown tracker, and Nzila OS sync status.
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import { Card } from '@nzila/ui'
import { getAdminDashboard } from '@/features/admin/observability-dashboard'
import { getRecentSyncEvents } from '@/features/nzila-integration/sync-service'

const statusColors: Record<string, string> = {
  healthy: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  critical: 'bg-red-100 text-red-700',
}

function deriveStatus(val: number, warnAt: number, critAt: number): 'healthy' | 'warning' | 'critical' {
  if (val >= critAt) return 'critical'
  if (val >= warnAt) return 'warning'
  return 'healthy'
}

export default async function OperationsPage() {
  const { userId, orgId } = await auth()
  if (!userId) redirect('/sign-in')
  if (!orgId) redirect('/sign-in')

  const [dashboard, recentSync] = await Promise.all([
    getAdminDashboard(orgId),
    getRecentSyncEvents(orgId, 10),
  ])

  const { upload, moderation, payouts, takedowns } = dashboard

  const metrics = [
    {
      label: 'Upload Queue',
      value: `${upload.pendingJobs} pending`,
      detail: `${upload.processingJobs} processing, ${upload.completedLast24h} completed (24h)`,
      status: deriveStatus(upload.failedJobs, 3, 10),
    },
    {
      label: 'Stuck Jobs',
      value: `${upload.stuckJobs.length}`,
      detail: upload.stuckJobs.length > 0 ? `Oldest: ${upload.stuckJobs[0].profile}` : 'None',
      status: deriveStatus(upload.stuckJobs.length, 1, 5),
    },
    {
      label: 'Moderation Queue',
      value: `${moderation.pendingReview} pending`,
      detail: `${moderation.approvedToday} approved, ${moderation.rejectedToday} rejected today`,
      status: deriveStatus(moderation.pendingReview, 20, 50),
    },
    {
      label: 'Oldest Pending Review',
      value: moderation.oldestPendingAge,
      detail: `${moderation.escalatedOpen} escalated open`,
      status: moderation.oldestPendingAge.includes('d')
        ? (parseInt(moderation.oldestPendingAge) > 2 ? 'critical' : 'warning')
        : 'healthy',
    },
    {
      label: 'Payout Requests',
      value: `${payouts.pendingRequests} pending`,
      detail: `${payouts.approvedAwaitingProcessing} approved, ${payouts.processingNow} processing`,
      status: deriveStatus(payouts.pendingRequests, 10, 30),
    },
    {
      label: 'Payouts This Month',
      value: `${payouts.completedThisMonth} completed`,
      detail: `$${payouts.totalPayoutsThisMonth.toFixed(2)} disbursed`,
      status: deriveStatus(payouts.failedThisMonth, 1, 5),
    },
    {
      label: 'Active Takedowns',
      value: `${takedowns.activeRequests}`,
      detail: `${takedowns.enforcedTotal} enforced, ${takedowns.counterFiledPending} counter-filed`,
      status: deriveStatus(takedowns.activeRequests, 5, 15),
    },
    {
      label: 'Avg Resolution',
      value: `${takedowns.avgResolutionDays}d`,
      detail: 'Takedown avg resolution time',
      status: deriveStatus(takedowns.avgResolutionDays, 5, 14),
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Platform Operations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live system health, queues, and operational KPIs.
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.label}>
            <div className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{m.label}</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{m.value}</p>
              <div className="mt-1 flex flex-col gap-1">
                <span className={`inline-block w-fit px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[m.status]}`}>
                  {m.status}
                </span>
                <span className="text-xs text-muted-foreground/70">{m.detail}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Nzila OS Sync Log */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Nzila OS Sync Events</h2>
          <div className="divide-y divide-gray-100">
            {recentSync.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">No recent sync events.</p>
            ) : (
              recentSync.map((evt) => (
                <div key={evt.id} className="flex items-center gap-4 py-3">
                  <span className={`h-2 w-2 rounded-full ${evt.status === 'synced' ? 'bg-green-500' : evt.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {evt.action} <span className="text-muted-foreground">({evt.entityType})</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{evt.resourceId.slice(0, 8)}... → {evt.direction}</p>
                  </div>
                  <span className="text-xs text-muted-foreground/70 whitespace-nowrap">
                    {evt.syncedAt.toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </Card>

      {/* Service Status */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Service Status</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { name: 'Streaming API', status: 'operational' },
              { name: 'Payout Engine', status: payouts.failedThisMonth > 0 ? 'degraded' : 'operational' },
              { name: 'Content CDN', status: 'operational' },
              { name: 'Media Processing', status: upload.stuckJobs.length > 0 ? 'degraded' : 'operational' },
              { name: 'Search Index', status: 'operational' },
              { name: 'Rights Resolver', status: 'operational' },
              { name: 'Nzila OS Sync', status: 'operational' },
              { name: 'Auth (Entra AD)', status: 'operational' },
            ].map((svc) => (
              <div key={svc.name} className="flex items-center gap-2 rounded-lg border border-border p-3">
                <span className={`h-2 w-2 rounded-full ${svc.status === 'operational' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                <span className="text-sm text-foreground">{svc.name}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}
