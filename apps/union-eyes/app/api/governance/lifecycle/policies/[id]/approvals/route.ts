/**
 * GET  /api/governance/lifecycle/policies/[id]/approvals
 * POST /api/governance/lifecycle/policies/[id]/approvals
 *
 * Not available (capability UE-GOVERNANCE-POLICY-LIFECYCLE): see lib/governance/policy-lifecycle-unavailable.ts. Nothing is read or written. The decision logic for
 * who may approve (lib/governance/policy-approval-authority.ts: identity and role from the session only) waits for a store to run against.
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
