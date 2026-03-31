/**
 * Zonga — Platform Operations (Server Component).
 *
 * Admin-only view of system health, recent deployments, queue depths,
 * and key operational KPIs across the Zonga platform.
 */
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Card } from '@nzila/ui'

interface OpsMetric {
  label: string
  value: string
  trend?: string
  status: 'healthy' | 'warning' | 'critical'
}

const statusColors: Record<string, string> = {
  healthy: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  critical: 'bg-red-100 text-red-700',
}

export default async function OperationsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  // Simulated operational metrics — replace with real monitoring data
  const metrics: OpsMetric[] = [
    { label: 'API Latency (p95)', value: '142ms', trend: '↓ 8%', status: 'healthy' },
    { label: 'Active Streams', value: '12,847', trend: '↑ 12%', status: 'healthy' },
    { label: 'Queue Depth', value: '34', trend: '↓ 5%', status: 'healthy' },
    { label: 'Error Rate (5m)', value: '0.03%', status: 'healthy' },
    { label: 'CDN Cache Hit', value: '98.1%', trend: '↑ 0.3%', status: 'healthy' },
    { label: 'Payout Pipeline', value: '7 pending', status: 'warning' },
    { label: 'Content Ingestion', value: '23 queued', trend: '↓ 2', status: 'healthy' },
    { label: 'Storage Used', value: '1.34 TB', trend: '↑ 22 GB', status: 'healthy' },
  ]

  const recentEvents = [
    { time: '5 min ago', action: 'Content ingestion completed', detail: '14 tracks processed', icon: '📀' },
    { time: '12 min ago', action: 'Payout batch dispatched', detail: '23 payouts via M-Pesa', icon: '💸' },
    { time: '28 min ago', action: 'Moderation queue cleared', detail: '8 cases resolved', icon: '✅' },
    { time: '1h ago', action: 'CDN cache purge', detail: 'West Africa edge nodes', icon: '🌍' },
    { time: '2h ago', action: 'Scheduled catalog sync', detail: '342 assets synced', icon: '🔄' },
    { time: '3h ago', action: 'Integrity scan completed', detail: '0 duplicates found', icon: '🔒' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Platform Operations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          System health, queues, and operational KPIs.
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.label}>
            <div className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{m.label}</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{m.value}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[m.status]}`}>
                  {m.status}
                </span>
                {m.trend && <span className="text-xs text-muted-foreground/70">{m.trend}</span>}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Recent Operational Events */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Recent Events</h2>
          <div className="divide-y divide-gray-100">
            {recentEvents.map((evt, i) => (
              <div key={i} className="flex items-center gap-4 py-3">
                <span className="text-xl">{evt.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{evt.action}</p>
                  <p className="text-xs text-muted-foreground">{evt.detail}</p>
                </div>
                <span className="text-xs text-muted-foreground/70 whitespace-nowrap">{evt.time}</span>
              </div>
            ))}
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
              { name: 'Payout Engine', status: 'operational' },
              { name: 'Content CDN', status: 'operational' },
              { name: 'Search Index', status: 'operational' },
              { name: 'ML Pipeline', status: 'operational' },
              { name: 'Rights Resolver', status: 'operational' },
              { name: 'Notification Bus', status: 'operational' },
              { name: 'Auth (Clerk)', status: 'operational' },
            ].map((svc) => (
              <div key={svc.name} className="flex items-center gap-2 rounded-lg border border-border p-3">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-sm text-foreground">{svc.name}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}
