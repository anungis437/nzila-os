/**
 * Nzila OS — Org Activation Matrix
 *
 * Shows toggles for enabling/disabling platform apps per org.
 * Toggling records an audit event and updates policyConfig feature flags.
 */
import { requireRole } from '@/lib/rbac'
import { getOrgActivationState } from './actions'
import { ActivationToggles } from './activation-toggles'

export const dynamic = 'force-dynamic'

export default async function OrgActivationPage({
  params,
}: {
  params: Promise<{ entityId: string }>
}) {
  // Only platform_admin, studio_admin, or ops can view activation matrix
  await requireRole('platform_admin', 'studio_admin', 'ops')

  const { entityId } = await params
  const activationState = await getOrgActivationState(entityId)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">App Activation Matrix</h1>
        <p className="text-gray-500 mt-1">
          Enable or disable platform apps for this organization.
          Changes are immediately effective and recorded in the audit log.
        </p>
      </div>

      <ActivationToggles entityId={entityId} initialState={activationState} />

      <div className="mt-8 p-4 bg-gray-50 rounded-lg text-sm text-gray-500">
        <p className="font-medium text-gray-700 mb-1">How it works</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Toggling enables/disables the feature flag in the org&apos;s policy config</li>
          <li>Every toggle produces an immutable audit event with hash-chain integrity</li>
          <li>Deactivation is fully reversible — no data is deleted</li>
          <li>Database tables are pre-provisioned; toggling controls access only</li>
        </ul>
      </div>
    </div>
  )
}
