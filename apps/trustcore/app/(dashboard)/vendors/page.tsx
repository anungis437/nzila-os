import { getAuthContext } from '@/lib/auth/getAuthContext'
import { listTrustcoreVendors } from '@nzila/db/queries/trustcore'
import { VendorClient } from '@/components/vendors/VendorClient'

export const dynamic = 'force-dynamic'

export default async function VendorsPage() {
  const ctx = await getAuthContext()
  const records = await listTrustcoreVendors(ctx.orgId)

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Vendor Register</h1>
        <p className="text-sm text-gray-500 mt-1">
          Vendors and subprocessors for org{' '}
          <span className="font-mono">{ctx.orgId}</span>
        </p>
      </div>
      <VendorClient records={records} role={ctx.role} />
    </div>
  )
}
