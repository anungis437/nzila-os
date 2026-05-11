import { PageHeader } from '@/components/ui/page-header'
import {
  GovernanceTimeline,
  LegitimacySummaryCard,
  PostureCardView,
} from '@/components/governance-experience'
import { getGovernanceExperienceReadings } from '@/lib/governance-experience/sample-readings'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Governance posture — Nzila OS Control Plane',
  description: 'Calm overview of governance posture across products.',
}

export default function GovernanceExperienceOverviewPage() {
  const { postureCards, attestations, timeline } = getGovernanceExperienceReadings()
  const legitimacy = attestations.find((a) => a.class === 'deployment-legitimacy')

  return (
    <>
      <PageHeader
        title="Governance experience"
        description="Living institutional governance operations. Read sparsely; act deliberately."
      />

      <section aria-labelledby="posture-heading" className="space-y-4">
        <h2
          id="posture-heading"
          className="text-sm font-medium uppercase tracking-wide text-muted-foreground"
        >
          Posture by product
        </h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {postureCards.map((card) => (
            <PostureCardView key={card.id} card={card} />
          ))}
        </div>
      </section>

      <section aria-labelledby="legitimacy-heading" className="mt-10 space-y-4">
        <h2
          id="legitimacy-heading"
          className="text-sm font-medium uppercase tracking-wide text-muted-foreground"
        >
          Latest deployment legitimacy
        </h2>
        {legitimacy ? (
          <LegitimacySummaryCard attestation={legitimacy} />
        ) : (
          <p className="text-sm text-muted-foreground">No legitimacy attestation in the current window.</p>
        )}
      </section>

      <section aria-labelledby="timeline-heading" className="mt-10 space-y-4">
        <h2
          id="timeline-heading"
          className="text-sm font-medium uppercase tracking-wide text-muted-foreground"
        >
          Governance timeline
        </h2>
        <GovernanceTimeline entries={timeline} />
      </section>
    </>
  )
}
