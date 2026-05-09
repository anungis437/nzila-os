import { PageHeader } from '@/components/ui/page-header'
import { ContinuityBandView } from '@/components/governance-experience'
import { getGovernanceExperienceReadings } from '@/lib/governance-experience/sample-readings'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Continuity posture — Nzila OS Control Plane',
  description: 'System-scoped continuity posture review. Interpretive, never scoring.',
}

export default function ContinuityPosturePage() {
  const { continuityCards } = getGovernanceExperienceReadings()
  return (
    <>
      <PageHeader
        title="Continuity posture"
        description="Banded, system-scoped, interpretive. Stabilization guidance is advisory; humans hold authority."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {continuityCards.map((card, i) => (
          <ContinuityBandView key={`${card.dimension}-${i}`} card={card} />
        ))}
      </div>
    </>
  )
}
