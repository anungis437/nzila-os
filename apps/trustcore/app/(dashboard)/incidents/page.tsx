import { getAuthContext } from '@/lib/auth/getAuthContext'
import { listTrustcoreIncidents } from '@nzila/db/queries/trustcore'
import { IncidentClient } from '@/components/incidents/IncidentClient'

export const dynamic = 'force-dynamic'

export default async function IncidentsPage() {
  const ctx = await getAuthContext()
  const records = await listTrustcoreIncidents(ctx.orgId)

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Confidentiality Incidents</h1>
        <p className="text-sm text-gray-500 mt-1">
          Law 25 incident register for org{' '}
          <span className="font-mono">{ctx.orgId}</span>
        </p>
      </div>
      <IncidentClient records={records} role={ctx.role} />
    </div>
  )
}
