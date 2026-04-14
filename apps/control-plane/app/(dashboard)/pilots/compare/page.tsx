import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { getPilotDashboard } from '@/server/pilot-metrics-data'

export const dynamic = 'force-dynamic'

export default async function PilotComparisonPage({ searchParams }: { searchParams: Promise<{ orgId?: string }> }) {
  const { orgId } = await searchParams

  if (!orgId) {
    return (
      <>
        <PageHeader title="Pilot Comparison" description="Compare adoption, revenue, operational value, reliability" />
        <EmptyState title="Organization context required" message="Add ?orgId=<uuid> to compare pilot performance." />
      </>
    )
  }

  const data = await getPilotDashboard(orgId)

  if (data.pilots.length === 0) {
    return (
      <>
        <PageHeader title="Pilot Comparison" description="Compare adoption, revenue, operational value, reliability" />
        <EmptyState title="No pilot data yet" message="No pilots with live metrics found for comparison." />
      </>
    )
  }

  const rows = [...data.pilots].sort((a, b) => (b.health?.scoreTotal ?? 0) - (a.health?.scoreTotal ?? 0))

  return (
    <>
      <PageHeader title="Pilot Comparison" description="Ranked by total pilot health score" />
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-4 py-2">Pilot</th>
              <th className="px-4 py-2">Scope</th>
              <th className="px-4 py-2">Adoption</th>
              <th className="px-4 py-2">Ops</th>
              <th className="px-4 py-2">Reliability</th>
              <th className="px-4 py-2">Revenue</th>
              <th className="px-4 py-2">Workflow</th>
              <th className="px-4 py-2">Total</th>
              <th className="px-4 py-2">Risk</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.pilot.id} className="border-t border-border">
                <td className="px-4 py-2">{row.pilot.pilotName}</td>
                <td className="px-4 py-2">{row.pilot.appScope}</td>
                <td className="px-4 py-2">{row.health?.scoreAdoption ?? 0}</td>
                <td className="px-4 py-2">{row.health?.scoreOperations ?? 0}</td>
                <td className="px-4 py-2">{row.health?.scoreReliability ?? 0}</td>
                <td className="px-4 py-2">{row.health?.scoreRevenue ?? 0}</td>
                <td className="px-4 py-2">{row.health?.scoreWorkflow ?? 0}</td>
                <td className="px-4 py-2 font-semibold">{row.health?.scoreTotal ?? 0}</td>
                <td className="px-4 py-2">{row.health?.riskLevel ?? 'unknown'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
