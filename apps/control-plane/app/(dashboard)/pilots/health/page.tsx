import Link from 'next/link'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { SummaryCard } from '@/components/ui/summary-card'
import { getPilotDashboard } from '@/server/pilot-metrics-data'

export const dynamic = 'force-dynamic'

export default async function PilotHealthDashboard({ searchParams }: { searchParams: Promise<{ orgId?: string }> }) {
  const { orgId } = await searchParams

  if (!orgId) {
    return (
      <>
        <PageHeader title="Pilot Health Dashboard" description="Cross-pilot scoring and risk status" />
        <EmptyState title="Organization context required" message="Add ?orgId=<uuid> to load pilot health from live data." />
      </>
    )
  }

  const data = await getPilotDashboard(orgId)
  type DashboardRow = (typeof data.pilots)[number]

  if (data.pilots.length === 0) {
    return (
      <>
        <PageHeader title="Pilot Health Dashboard" description="Cross-pilot scoring and risk status" />
        <EmptyState title="No pilots found" message="Create pilot definitions before health scoring can be computed." />
      </>
    )
  }

  return (
    <>
      <PageHeader title="Pilot Health Dashboard" description="Adoption, operations, reliability, revenue, workflow scorecards" />

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard title="Pilots" value={data.summary.totalPilots} />
        <SummaryCard title="Active" value={data.summary.activePilots} />
        <SummaryCard title="High Risk" value={data.summary.highRisk} subtitle="needs remediation" />
        <SummaryCard title="Average Score" value={data.summary.avgScore} subtitle="0-100" />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <SummaryCard title="Average MTTA" value={data.summary.avgMttaMinutes} subtitle="minutes" />
        <SummaryCard title="Average MTTR" value={data.summary.avgMttrMinutes} subtitle="minutes" />
      </div>

      <div className="mt-8 space-y-3">
        {data.pilots.map((row: DashboardRow) => (
          <div key={row.pilot.id} className="rounded-md border border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{row.pilot.pilotName}</p>
                <p className="text-xs text-muted-foreground">{row.pilot.appScope} • {row.pilot.pilotType} • {row.pilot.status}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-semibold">{row.health?.scoreTotal ?? 0}</p>
                <p className="text-xs text-muted-foreground">risk: {row.health?.riskLevel ?? 'unknown'}</p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
              <span>days active: {row.daysActive}</span>
              <span>alerts open: {row.alertsOpen}</span>
              <span>mtta: {Math.round(row.alertOps?.mttaMinutes ?? 0)}m</span>
              <span>mttr: {Math.round(row.alertOps?.mttrMinutes ?? 0)}m</span>
              <Link className="text-primary underline" href={`/pilots/${row.pilot.id}?orgId=${orgId}`}>open pilot</Link>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
