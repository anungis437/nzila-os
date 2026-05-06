import { getAuthContext } from '@/lib/auth/getAuthContext'
import { listTrustcorePolicies } from '@nzila/db/queries/trustcore'
import { PoliciesClient } from '@/components/policies/PoliciesClient'

export const dynamic = 'force-dynamic'

export default async function PoliciesPage() {
  const ctx = await getAuthContext()
  const policies = await listTrustcorePolicies(ctx.orgId)

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Policies</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your organization&apos;s privacy and data governance policies.
        </p>
      </div>
      <PoliciesClient policies={policies} />
    </div>
  )
}

