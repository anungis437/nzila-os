import { getAuthContext } from '@/lib/auth/getAuthContext'
import { listTrustcoreDataAssets } from '@nzila/db/queries/trustcore'
import { DataInventoryClient } from '@/components/data-inventory/DataInventoryClient'

export const dynamic = 'force-dynamic'

export default async function DataInventoryPage() {
  const ctx = await getAuthContext()
  const records = await listTrustcoreDataAssets(ctx.orgId)

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Data Inventory</h1>
        <p className="text-sm text-gray-500 mt-1">
          PII and personal data assets registered for org{' '}
          <span className="font-mono">{ctx.orgId}</span>
        </p>
      </div>
      <DataInventoryClient records={records} role={ctx.role} />
    </div>
  )
}
