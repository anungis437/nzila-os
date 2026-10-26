/**
 * GET   /api/governance/lifecycle/policies/[id]
 *   — Get a single governed policy by ID (within the caller's institutional scope)
 *
 * PATCH /api/governance/lifecycle/policies/[id]
 *   — Transition lifecycle state
 *
 * Governance Officer 2.1 P0-C: a policy cannot reach approved / published /
 * active without a satisfied approval chain, and the caller must govern the
 * policy's institution (platform policies: platform principals only).
 */
import { z } from 'zod'
import { withApi } from '@/lib/api/framework'
import { ApiError } from '@/lib/api/errors'
import { db } from '@/db/db'
import { withSystemContext } from '@/lib/db/with-rls-context'
import { normalizeRole } from '@/lib/api-auth-guard'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { governedPolicies, policyApprovalChains, policyApprovalActions } from '@nzila/db/schema'
import { asc, eq } from 'drizzle-orm'
import {
  actorOwnsPolicyScope,
  isChainSatisfied,
  resolveAuditOrganization,
  type ApprovalActionRecord,
  type ApprovalActor,
  type ApprovalChain,
} from '@/lib/governance/policy-approval-authority'

export const dynamic = 'force-dynamic'

const APPROVAL_GATED_STATES = ['approved', 'published', 'active']

const patchSchema = z.object({
  targetState: z.enum([
    'draft', 'review_pending', 'approval_required', 'approved', 'published',
    'active', 'superseded', 'deprecated', 'revoked', 'archived',
  ]),
})

function actorFrom(user: { id?: string; role?: string | null } | null, organizationId: string | null): ApprovalActor {
  if (!user?.id) throw ApiError.unauthorized('Authenticated user required')
  return { id: user.id, role: normalizeRole(user.role ?? 'member'), organizationId }
}

export const GET = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    entitlement: 'governance_suite',
  },
  async ({ params, user, organizationId }) => {
    const id = (params as Record<string, string>).id
    const actor = actorFrom(user, organizationId)

    return withSystemContext(async () => {
      const [policy] = await db
        .select()
        .from(governedPolicies)
        .where(eq(governedPolicies.id, id))
        .limit(1)
      if (!policy) {
        return null
      }
      const scope = { id: policy.id, orgId: policy.orgId ?? null, authorId: policy.authorId, lifecycleStatus: policy.lifecycleStatus, riskClassification: policy.riskClassification }
      if (!actorOwnsPolicyScope(actor, scope)) {
        return null
      }
      return { policy }
    })
  },
)

export const PATCH = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    entitlement: 'governance_suite',
  },
  async ({ request, params, user, organizationId }) => {
    const id = (params as Record<string, string>).id
    const actor = actorFrom(user, organizationId)
    const parsed = patchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw ApiError.badRequest('A valid targetState is required.')
    const { targetState } = parsed.data

    return withSystemContext(async () => {
      const [current] = await db
        .select()
        .from(governedPolicies)
        .where(eq(governedPolicies.id, id))
        .limit(1)
        .for('update')
      if (!current) throw ApiError.notFound('Policy')
      const scope = { id: current.id, orgId: current.orgId ?? null, authorId: current.authorId, lifecycleStatus: current.lifecycleStatus, riskClassification: current.riskClassification }
      if (!actorOwnsPolicyScope(actor, scope)) throw ApiError.notFound('Policy')

      if (APPROVAL_GATED_STATES.includes(targetState)) {
        const chains = (await db
          .select()
          .from(policyApprovalChains)
          .where(eq(policyApprovalChains.governedPolicyId, id))) as ApprovalChain[]
        let satisfied = false
        for (const chain of chains) {
          const actions = (await db
            .select()
            .from(policyApprovalActions)
            .where(eq(policyApprovalActions.chainId, chain.id))
            .orderBy(asc(policyApprovalActions.createdAt))) as ApprovalActionRecord[]
          if (isChainSatisfied(chain, actions)) {
            satisfied = true
            break
          }
        }
        if (!satisfied) {
          throw ApiError.conflict('Policy has no satisfied approval chain; it cannot enter this state.', {
            code: 'APPROVAL_REQUIRED',
          })
        }
      }

      const auditOrg = resolveAuditOrganization(current, organizationId)
      if (!auditOrg) throw ApiError.forbidden('An audit scope is required to record governance actions.')

      const [updated] = await db
        .update(governedPolicies)
        .set({
          lifecycleStatus: targetState as never,
          ...(targetState === 'published' ? { publishedAt: new Date() } : {}),
          ...(targetState === 'active' ? { activatedAt: new Date() } : {}),
          ...(targetState === 'deprecated' ? { deprecatedAt: new Date() } : {}),
        })
        .where(eq(governedPolicies.id, id))
        .returning()

      // The transition and its audit record commit together: a failed audit write rolls the transition back.
      await persistAtomicAudit(db as unknown as RLSTx, {
        userId: actor.id,
        organizationId: auditOrg,
        action: 'governance.policy_lifecycle.transition',
        resourceType: 'governed_policies',
        resourceId: id,
        details: { from: current.lifecycleStatus, to: targetState, actorRole: actor.role },
      })

      return { policy: updated }
    })
  },
)
