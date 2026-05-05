import { getAuthContext } from '@/lib/auth/getAuthContext'
import { evaluateCompliance } from '@/lib/compliance/engine'
import { ComplianceView } from '@/components/compliance/ComplianceView'

export const dynamic = 'force-dynamic'

export default async function CompliancePage() {
  const ctx = await getAuthContext()
  const evaluation = await evaluateCompliance(ctx.orgId)

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Compliance Status</h1>
        <p className="text-sm text-gray-500 mt-1">
          Law 25 (Quebec) evaluation for org{' '}
          <span className="font-mono">{ctx.orgId}</span>
        </p>
      </div>
      <ComplianceView evaluation={evaluation} />
    </div>
  )
}
