import { getAuthContext } from '@/lib/auth/getAuthContext'
import { evaluateCompliance } from '@/lib/compliance/engine'
import { getResolvedSubscription } from '@/lib/billing/getSubscription'
import { canExportAudit } from '@/lib/billing/featureAccess'
import { ComplianceView } from '@/components/compliance/ComplianceView'
import { LockedExportButton } from '@/components/billing/LockedExportButton'

export const dynamic = 'force-dynamic'

export default async function CompliancePage() {
  const ctx = await getAuthContext()
  const [evaluation, subscription] = await Promise.all([
    evaluateCompliance(ctx.orgId),
    getResolvedSubscription(ctx.orgId),
  ])
  const auditAllowed = canExportAudit(subscription)

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compliance Status</h1>
          <p className="text-sm text-gray-500 mt-1">
            Law 25 (Quebec) evaluation for org{' '}
            <span className="font-mono">{ctx.orgId}</span>
          </p>
        </div>
        {!auditAllowed && (
          <div className="shrink-0">
            <LockedExportButton label="Export Audit Report" feature="audit_export" />
          </div>
        )}
      </div>
      <ComplianceView evaluation={evaluation} />
    </div>
  )
}
