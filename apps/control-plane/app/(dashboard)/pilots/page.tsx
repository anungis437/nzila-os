import Link from 'next/link'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { SummaryCard } from '@/components/ui/summary-card'
import { getPilotDashboard } from '@/server/pilot-metrics-data'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Pilots — Nzila OS Control Plane',
  description: 'Pilot proof overview backed by live pilot metrics data.',
}

export default async function PilotsPage({ searchParams }: { searchParams: Promise<{ orgId?: string }> }) {
  const { orgId } = await searchParams

  if (!orgId) {
    return (
      <>
        <PageHeader title="Pilots" description="Pilot proof overview from live metrics" />
        <EmptyState title="Organization context required" message="Add ?orgId=<uuid> to load live pilot proof data." />
      </>
    )
  }

  const dashboard = await getPilotDashboard(orgId)

  if (dashboard.pilots.length === 0) {
    return (
      <>
        <PageHeader title="Pilots" description="Pilot proof overview from live metrics" />
        <EmptyState title="No pilots available" message="No pilot definitions with live metrics were found for this organization." />
      </>
    )
  }

  return (
    <>
      <PageHeader title="Pilots" description="Live pilot portfolio proof metrics" />
      <div className="mb-6 flex flex-wrap gap-3 text-sm">
        <Link className="text-primary underline" href={`/pilots/health?orgId=${orgId}`}>Pilot Health</Link>
        <Link className="text-primary underline" href={`/pilots/alerts?orgId=${orgId}`}>Pilot Alerts</Link>
        <Link className="text-primary underline" href={`/pilots/compare?orgId=${orgId}`}>Pilot Compare</Link>
        <Link className="text-primary underline" href={`/pilots/reports?orgId=${orgId}`}>Pilot Reports</Link>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard title="Total Pilots" value={dashboard.summary.totalPilots} />
        <SummaryCard title="Active Pilots" value={dashboard.summary.activePilots} />
        <SummaryCard title="High Risk" value={dashboard.summary.highRisk} subtitle="needs remediation" />
        <SummaryCard title="Average Score" value={dashboard.summary.avgScore} subtitle="0-100" />
      </div>

      <div className="mt-8 space-y-3">
        {dashboard.pilots.map((row) => (
          <div key={row.pilot.id} className="rounded-md border border-border p-4">
            <p className="font-semibold">{row.pilot.pilotName}</p>
            <p className="text-xs text-muted-foreground">{row.pilot.appScope} • {row.pilot.pilotType} • {row.pilot.status}</p>
            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
              <span>score: {row.health?.scoreTotal ?? 0}</span>
              <span>risk: {row.health?.riskLevel ?? 'unknown'}</span>
              <span>alerts open: {row.alertsOpen}</span>
              <Link className="text-primary underline" href={`/pilots/${row.pilot.id}?orgId=${orgId}`}>open pilot</Link>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
