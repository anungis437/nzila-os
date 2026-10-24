/**
 * GET  /api/governance/lifecycle/policies/[id]/approvals
 * POST /api/governance/lifecycle/policies/[id]/approvals
 *
 * Governance Officer 2.1 P0-C: the approver's identity, role and institution
 * are taken from the authenticated session only. A request body can neither
 * assert a role nor widen an approval chain. All authority decisions live in
 * lib/governance/policy-approval-authority.ts; denials are audited.
 */
import { z } from 'zod'
import { withApi } from '@/lib/api/framework'
import { ApiError } from '@/lib/api/errors'
import { db } from '@/db/db'
import { withSystemContext } from '@/lib/db/with-rls-context'
import { normalizeRole } from '@/lib/api-auth-guard'
import { auditDataMutation, auditSecurityEvent } from '@/lib/audit-logger'
import { policyApprovalChains, policyApprovalActions, governedPolicies } from '@nzila/db/schema'
import { and, asc, desc, eq } from 'drizzle-orm'
import {
  actorOwnsPolicyScope,
  evaluateApprovalAction,
  evaluateChainCreation,
  isChainSatisfied,
  type ApprovalActor,
  type ApprovalActionRecord,
  type ApprovalChain,
  type ApprovalPolicy,
  type Decision,
  resolveAuditOrganization,
} from '@/lib/governance/policy-approval-authority'

export const dynamic = 'force-dynamic'

const bodySchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('create_chain'),
    chainType: z.enum(['single', 'multi', 'sequential', 'domain', 'emergency']).optional(),
    approverRoles: z.array(z.string()).optional(),
    namedApproverIds: z.array(z.string()).optional(),
    requiredApprovalCount: z.number().int().optional(),
    delegatable: z.boolean().optional(),
  }),
  z.object({
    op: z.literal('record_action'),
    chainId: z.string().uuid(),
    action: z.enum(['approved', 'rejected', 'delegated', 'withdrawn']),
    rationale: z.string().max(4000).optional(),
    delegatedToUserId: z.string().optional(),
  }),
])

type Denial = Extract<Decision, { allowed: false }>

function toError(decision: Denial) {
  switch (decision.status) {
    case 404:
      return ApiError.notFound('Policy')
    case 409:
      return ApiError.conflict(decision.reason, { code: decision.code })
    case 400:
      return ApiError.badRequest(decision.reason, { code: decision.code })
    default:
      return ApiError.forbidden(decision.reason)
  }
}

async function loadScopedPolicy(id: string, actor: ApprovalActor, lock: boolean): Promise<ApprovalPolicy> {
  const query = db.select().from(governedPolicies).where(eq(governedPolicies.id, id)).limit(1)
  const [row] = await (lock ? query.for('update') : query)
  // Out-of-scope and missing are indistinguishable to the caller.
  if (!row) throw ApiError.notFound('Policy')
  const policy: ApprovalPolicy = {
    id: row.id,
    orgId: row.orgId ?? null,
    authorId: row.authorId,
    lifecycleStatus: row.lifecycleStatus,
    riskClassification: row.riskClassification,
  }
  if (!actorOwnsPolicyScope(actor, policy)) throw ApiError.notFound('Policy')
  return policy
}

function resolveActor(user: { id?: string; role?: string | null } | null, organizationId: string | null): ApprovalActor {
  if (!user?.id) {
    throw ApiError.badRequest('Authenticated user is required to record a policy approval.')
  }
  return { id: user.id, role: normalizeRole(user.role ?? 'member'), organizationId }
}

export const GET = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    entitlement: 'governance_suite',
  },
  async ({ params, user, organizationId }) => {
    const id = (params as Record<string, string>).id
    const actor = resolveActor(user, organizationId)
    return withSystemContext(async () => {
      await loadScopedPolicy(id, actor, false)

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
  async ({ request, params, user, organizationId }) => {
    const actor = resolveActor(user, organizationId)
    const id = (params as Record<string, string>).id

    const parsed = bodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      throw ApiError.badRequest('Unknown or malformed approval operation.')
    }
    const body = parsed.data

    const outcome = await withSystemContext(async () => {
      // Row lock serialises concurrent approvals on the same policy version.
      const policy = await loadScopedPolicy(id, actor, true)
      // Audit is tenant-scoped and fail-closed: without a real organization the
      // mutation is refused rather than written unaudited.
      const auditOrg = resolveAuditOrganization(policy, organizationId)
      if (!auditOrg) throw ApiError.forbidden('An audit scope is required to record governance actions.')

      const denyWith = async (decision: Denial, details: Record<string, unknown>) => {
        await auditSecurityEvent({
          eventType: 'governance.policy_approval.denied',
          userId: actor.id,
          organizationId: auditOrg,
          outcome: 'failure',
          details: { policyId: id, code: decision.code, reason: decision.reason, ...details },
        })
        return { denied: decision } as const
      }

      if (body.op === 'create_chain') {
        const existing = await db
          .select({ id: policyApprovalChains.id })
          .from(policyApprovalChains)
          .where(eq(policyApprovalChains.governedPolicyId, id))
        const decision = evaluateChainCreation(
          actor,
          policy,
          {
            chainType: body.chainType,
            requiredApprovals: body.requiredApprovalCount,
            approverRoles: body.approverRoles,
            namedApproverIds: body.namedApproverIds,
            delegatable: body.delegatable,
          },
          existing,
        )
        if (!decision.allowed) return denyWith(decision, { op: body.op })

        const named = body.namedApproverIds ?? []
        const [chain] = await db
          .insert(policyApprovalChains)
          .values({
            governedPolicyId: id,
            chainType: (body.chainType ?? 'single') as never,
            requiredApprovals: body.requiredApprovalCount ?? 1,
            approverRoles: body.approverRoles ?? [],
            namedApproverIds: named,
            requiresNamedApprovers: named.length > 0,
            delegatable: body.delegatable ?? false,
            createdBy: actor.id,
          })
          .returning()
        await auditDataMutation({
          userId: actor.id,
          organizationId: auditOrg,
          resource: 'policy_approval_chains',
          resourceId: chain?.id,
          action: 'create',
          details: { policyId: id, actorRole: actor.role },
        })
        return { chain }
      }

      const [chainRow] = await db
        .select()
        .from(policyApprovalChains)
        .where(and(eq(policyApprovalChains.id, body.chainId), eq(policyApprovalChains.governedPolicyId, id)))
        .limit(1)
      if (!chainRow) {
        return denyWith(
          { allowed: false, code: 'CHAIN_POLICY_MISMATCH', reason: 'Approval chain does not belong to this policy.', status: 404 },
          { op: body.op, chainId: body.chainId },
        )
      }
      const chain: ApprovalChain = {
        id: chainRow.id,
        governedPolicyId: chainRow.governedPolicyId,
        chainType: chainRow.chainType,
        requiredApprovals: chainRow.requiredApprovals,
        requiresNamedApprovers: chainRow.requiresNamedApprovers,
        approverRoles: chainRow.approverRoles,
        namedApproverIds: chainRow.namedApproverIds,
        delegatable: chainRow.delegatable,
      }
      const history = (await db
        .select()
        .from(policyApprovalActions)
        .where(eq(policyApprovalActions.chainId, chain.id))
        .orderBy(asc(policyApprovalActions.createdAt))) as ApprovalActionRecord[]

      const decision = evaluateApprovalAction(actor, policy, chain, history, {
        action: body.action,
        delegatedToUserId: body.delegatedToUserId,
      })
      if (!decision.allowed) return denyWith(decision, { op: body.op, chainId: chain.id, attempted: body.action })

      // approverUserId/approverRole come from the session, never the body.
      const [action] = await db
        .insert(policyApprovalActions)
        .values({
          chainId: chain.id,
          governedPolicyId: id,
          approverUserId: actor.id,
          approverRole: actor.role,
          action: body.action,
          rationale: body.rationale,
          delegatedToUserId: body.action === 'delegated' ? body.delegatedToUserId : undefined,
        })
        .returning()
      await auditDataMutation({
        userId: actor.id,
        organizationId: auditOrg,
        resource: 'policy_approval_actions',
        resourceId: action?.id,
        action: 'create',
        details: { policyId: id, chainId: chain.id, decision: body.action, actorRole: actor.role },
      })

      const satisfied = isChainSatisfied(chain, [
        ...history,
        { chainId: chain.id, approverUserId: actor.id, action: body.action, delegatedToUserId: body.delegatedToUserId },
      ])
      return { action, chainSatisfied: satisfied }
    })

    if ('denied' in outcome) throw toError(outcome.denied)
    return outcome
  },
)
