/**
 * GET   /api/governance/lifecycle/policies/[id]
 * PATCH /api/governance/lifecycle/policies/[id]
 *
 * Not available (capability UE-GOVERNANCE-POLICY-LIFECYCLE): see lib/governance/policy-lifecycle-unavailable.ts. Nothing is read or written.
 */
import { withApi, ApiError } from '@/lib/api/framework'
import { POLICY_LIFECYCLE_UNAVAILABLE } from '@/lib/governance/policy-lifecycle-unavailable'

export const dynamic = 'force-dynamic'

export const GET = withApi(
  { auth: { required: true, minRole: 'admin' }, entitlement: 'governance_suite' },
  async () => {
    throw ApiError.notImplemented(POLICY_LIFECYCLE_UNAVAILABLE)
  },
)

export const PATCH = withApi(
  { auth: { required: true, minRole: 'admin' }, entitlement: 'governance_suite' },
  async () => {
    throw ApiError.notImplemented(POLICY_LIFECYCLE_UNAVAILABLE)
  },
)
