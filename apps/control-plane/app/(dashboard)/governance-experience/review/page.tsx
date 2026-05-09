import { PageHeader } from '@/components/ui/page-header'
import { DecisionLedgerPanel } from '@/components/governance-experience'
import { getGovernanceExperienceReadings } from '@/lib/governance-experience/sample-readings'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Governance review — Nzila OS Control Plane',
  description: 'Append-only governance decision ledger. Supersession history visible.',
}

export default function GovernanceReviewPage() {
  const { decisions } = getGovernanceExperienceReadings()
  return (
    <>
      <PageHeader
        title="Governance review"
        description="Append-only decision ledger. Decisions cite doctrine; supersessions never overwrite."
      />
      <DecisionLedgerPanel decisions={decisions} />
    </>
  )
}
