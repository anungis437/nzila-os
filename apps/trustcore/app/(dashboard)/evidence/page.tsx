import { getAuthContext } from '@/lib/auth/getAuthContext'
import { listTrustcoreEvidenceEvents } from '@nzila/db/queries/trustcore'
import { EvidenceList } from '@/components/evidence/EvidenceList'

export const dynamic = 'force-dynamic'

export default async function EvidencePage() {
  const ctx = await getAuthContext()
  const records = await listTrustcoreEvidenceEvents(ctx.orgId)

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Evidence Vault</h1>
        <p className="text-sm text-gray-500 mt-1">
          Immutable compliance event log for org{' '}
          <span className="font-mono">{ctx.orgId}</span> · {records.length} events
        </p>
      </div>
      <EvidenceList records={records} />
    </div>
  )
}
