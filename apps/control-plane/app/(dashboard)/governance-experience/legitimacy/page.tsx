import { PageHeader } from '@/components/ui/page-header'
import { AttestationPanel, LegitimacySummaryCard } from '@/components/governance-experience'
import { getGovernanceExperienceReadings } from '@/lib/governance-experience/sample-readings'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Deployment legitimacy — Nzila OS Control Plane',
  description: 'Release × environment × verdict. Verdicts are rendered honestly.',
}

export default function DeploymentLegitimacyPage() {
  const { attestations } = getGovernanceExperienceReadings()
  const legitimacy = attestations.filter((a) => a.class === 'deployment-legitimacy')
  const release = attestations.filter((a) => a.class === 'release')

  return (
    <>
      <PageHeader
        title="Deployment legitimacy"
        description="Release lineage, environment integrity, and topology alignment for the current cadence."
      />

      <section aria-labelledby="summary-heading" className="space-y-4">
        <h2
          id="summary-heading"
          className="text-sm font-medium uppercase tracking-wide text-muted-foreground"
        >
          Latest legitimacy summary
        </h2>
        {legitimacy.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No legitimacy attestation recorded for the current window.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {legitimacy.map((a) => (
              <LegitimacySummaryCard key={a.contentHash} attestation={a} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="release-heading" className="mt-10 space-y-4">
        <h2
          id="release-heading"
          className="text-sm font-medium uppercase tracking-wide text-muted-foreground"
        >
          Release attestations
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {release.map((a) => (
            <AttestationPanel key={a.contentHash} attestation={a} />
          ))}
        </div>
      </section>
    </>
  )
}
