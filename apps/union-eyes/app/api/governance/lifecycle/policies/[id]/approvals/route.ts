/**
 * GET  /api/governance/lifecycle/policies/[id]/approvals
 * POST /api/governance/lifecycle/policies/[id]/approvals
 */
import { withApi } from '@/lib/api/framework'
import { db } from '@/db/db'
import { withSystemContext } from '@/lib/db/with-rls-context'
import { policyApprovalChains, policyApprovalActions } from '@nzila/db/schema'
import { eq, desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export const GET = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    entitlement: 'governance_suite',
  },
  async ({ params }) => {
    const id = (params as Record<string, string>).id
    return withSystemContext(async () => {
      const chains = await db
        .select()
        .from(policyApprovalChains)
        .where(eq(policyApprovalChains.governedPolicyId, id))
        .orderBy(desc(policyApprovalChains.createdAt))

      const actions = chains.length > 0
        ? await db
            .select()
            .from(policyApprovalActions)
            .where(eq(policyApprovalActions.governedPolicyId, id))
            .orderBy(desc(policyApprovalActions.createdAt))
        : []

      return { chains, actions }
    })
  },
)

export const POST = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    entitlement: 'governance_suite',
  },
  async ({ request, params, user }) => {
    const id = (params as Record<string, string>).id
    const body = await request.json() as {
      op: 'create_chain' | 'record_action'
      chainType?: string
      approverRoles?: string[]
      namedApproverIds?: string[]
      requiredApprovalCount?: number
      chainId?: string
      action?: 'approved' | 'rejected' | 'delegated' | 'withdrawn'
      actorRole?: string
      rationale?: string
      delegatedToUserId?: string
    }

    return withSystemContext(async () => {
      if (body.op === 'create_chain') {
        const [chain] = await db
          .insert(policyApprovalChains)
          .values({
            governedPolicyId: id,
            chainType: (body.chainType ?? 'single') as never,
            requiredApprovals: body.requiredApprovalCount ?? 1,
            approverRoles: body.approverRoles ?? [],
            namedApproverIds: body.namedApproverIds ?? [],
            requiresNamedApprovers: (body.namedApproverIds ?? []).length > 0,
            createdBy: user?.id ?? 'system',
          })
          .returning()
        return { chain }
      }

      if (body.op === 'record_action') {
        if (!body.chainId || !body.action || !body.actorRole) {
          return { error: 'chainId, action, and actorRole are required.' }
        }
        const [action] = await db
          .insert(policyApprovalActions)
          .values({
            chainId: body.chainId,
            governedPolicyId: id,
            approverUserId: user?.id ?? 'system',
            approverRole: body.actorRole,
            action: body.action,
            rationale: body.rationale,
            delegatedToUserId: body.delegatedToUserId,
          })
          .returning()
        return { action }
      }

      return { error: 'Unknown op.' }
    })
  },
)
