import { PageHeader } from '@/components/ui/page-header'
import { StabilizationSummary } from '@/components/governance-experience'
import { getGovernanceExperienceReadings } from '@/lib/governance-experience/sample-readings'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Stabilization signals — Nzila OS Control Plane',
  description: 'Calm stabilization indicators. Never composite scores. Refresh on slow cadence.',
}

export default function StabilizationPage() {
  const { stabilization } = getGovernanceExperienceReadings()
  return (
    <>
      <PageHeader
        title="Stabilization signals"
        description="Banded readings paired with stabilization-oriented advisory. Read once per cadence; act once per cycle."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {stabilization.map((r) => (
          <StabilizationSummary key={`${r.signal}-${r.scope.systemId}`} reading={r} />
        ))}
      </div>
    </>
  )
}
