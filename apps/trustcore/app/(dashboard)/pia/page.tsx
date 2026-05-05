import { getAuthContext } from '@/lib/auth/getAuthContext'
import { listTrustcorePias } from '@nzila/db/queries/trustcore'
import { PiaClient } from '@/components/pia/PiaClient'

export const dynamic = 'force-dynamic'

export default async function PiaPage() {
  const ctx = await getAuthContext()
  const records = await listTrustcorePias(ctx.orgId)

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Privacy Impact Assessments</h1>
        <p className="text-sm text-gray-500 mt-1">
          Law 25 PIAs for org{' '}
          <span className="font-mono">{ctx.orgId}</span>
        </p>
      </div>
      <PiaClient records={records} role={ctx.role} />
    </div>
  )
}
