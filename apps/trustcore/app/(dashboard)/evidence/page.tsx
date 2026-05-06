import { getAuthContext } from '@/lib/auth/getAuthContext'
import { listTrustcoreEvidenceEvents } from '@nzila/db/queries/trustcore'
import { getResolvedSubscription } from '@/lib/billing/getSubscription'
import { canExportEvidence } from '@/lib/billing/featureAccess'
import { EvidenceList } from '@/components/evidence/EvidenceList'
import { LockedExportButton } from '@/components/billing/LockedExportButton'

export const dynamic = 'force-dynamic'

export default async function EvidencePage() {
  const ctx = await getAuthContext()
  const [records, subscription] = await Promise.all([
    listTrustcoreEvidenceEvents(ctx.orgId),
    getResolvedSubscription(ctx.orgId),
  ])
  const evidenceAllowed = canExportEvidence(subscription)

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Evidence Vault</h1>
          <p className="text-sm text-gray-500 mt-1">
            Immutable compliance event log for org{' '}
            <span className="font-mono">{ctx.orgId}</span> · {records.length} events
          </p>
        </div>
        {!evidenceAllowed && (
          <div className="shrink-0">
            <LockedExportButton label="Export Evidence Bundle" feature="evidence_export" />
          </div>
        )}
      </div>
      <EvidenceList records={records} />
    </div>
  )
}
