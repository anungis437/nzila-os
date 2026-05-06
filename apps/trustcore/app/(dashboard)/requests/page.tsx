import { getAuthContext } from '@/lib/auth/getAuthContext'
import { listTrustcoreDsrRequests } from '@nzila/db/queries/trustcore'
import { DsrRequestClient } from '@/components/requests/DsrRequestClient'

export const dynamic = 'force-dynamic'

export default async function RequestsPage() {
  const ctx = await getAuthContext()
  const records = await listTrustcoreDsrRequests(ctx.orgId)

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Data Subject Rights Requests</h1>
        <p className="text-sm text-gray-500 mt-1">
          Access, rectification, deletion, and portability requests for org{' '}
          <span className="font-mono">{ctx.orgId}</span>
        </p>
      </div>
      <DsrRequestClient records={records} role={ctx.role} />
    </div>
  )
}
