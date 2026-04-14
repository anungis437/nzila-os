import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { listPilotMetricsPilots } from '@/server/pilot-metrics-data'

export const dynamic = 'force-dynamic'

export default async function PilotReportsPage({ searchParams }: { searchParams: Promise<{ orgId?: string; pilotId?: string }> }) {
  const { orgId, pilotId } = await searchParams

  if (!orgId) {
    return (
      <>
        <PageHeader title="Pilot Reports" description="Export JSON, CSV, and executive markdown summaries" />
        <EmptyState title="Organization context required" message="Add ?orgId=<uuid> to export pilot reports." />
      </>
    )
  }

  const pilots = await listPilotMetricsPilots(orgId)
  type PilotListItem = (typeof pilots)[number]

  if (pilots.length === 0) {
    return (
      <>
        <PageHeader title="Pilot Reports" description="Export JSON, CSV, and executive markdown summaries" />
        <EmptyState title="No pilots available" message="Pilot reports become available once pilot definitions exist." />
      </>
    )
  }

  const selected = pilotId ? pilots.find((p: PilotListItem) => p.id === pilotId) : pilots[0]

  return (
    <>
      <PageHeader title="Pilot Reports" description="Proof-grade exports for case studies, renewals, and QBRs" />
      <div className="rounded-md border border-border p-4">
        <p className="text-sm text-muted-foreground">Selected pilot</p>
        <p className="text-lg font-semibold">{selected?.pilotName}</p>
        <p className="text-xs text-muted-foreground">{selected?.appScope} • {selected?.pilotType}</p>

        {selected ? (
          <div className="mt-4 flex flex-wrap gap-3">
            <a className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground" href={`/api/control-plane/pilot-metrics/${selected.id}/export?orgId=${orgId}&format=json`}>Export JSON</a>
            <a className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground" href={`/api/control-plane/pilot-metrics/${selected.id}/export?orgId=${orgId}&format=csv`}>Export CSV Rollups</a>
            <a className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground" href={`/api/control-plane/pilot-metrics/${selected.id}/export?orgId=${orgId}&format=markdown`}>Export Executive Markdown</a>
          </div>
        ) : null}
      </div>

      <div className="mt-6 space-y-2">
        {pilots.map((pilot: PilotListItem) => (
          <a key={pilot.id} href={`/pilots/reports?orgId=${orgId}&pilotId=${pilot.id}`} className="block rounded border border-border p-3 hover:bg-muted/40">
            <p className="font-medium">{pilot.pilotName}</p>
            <p className="text-xs text-muted-foreground">{pilot.appScope} • {pilot.pilotType} • {pilot.status}</p>
          </a>
        ))}
      </div>
    </>
  )
}
