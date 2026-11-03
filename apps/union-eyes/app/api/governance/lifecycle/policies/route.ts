/**
 * GET  /api/governance/lifecycle/policies
 * POST /api/governance/lifecycle/policies
 *
 * Not available (capability UE-GOVERNANCE-POLICY-LIFECYCLE): see lib/governance/policy-lifecycle-unavailable.ts. Administrators with the governance suite are told
 * so; nothing is read or written.
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

export const POST = withApi(
  { auth: { required: true, minRole: 'admin' }, entitlement: 'governance_suite' },
  async () => {
    throw ApiError.notImplemented(POLICY_LIFECYCLE_UNAVAILABLE)
  },
)
