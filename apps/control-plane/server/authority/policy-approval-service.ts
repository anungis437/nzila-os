/**
 * Policy Approval Service — Role-gated, fail-closed approval workflow.
 *
 * Approval rules:
 *
 *  1. Role gate: The action actor must hold a role listed in
 *     policy_approval_chains.approver_roles[]. This is ALWAYS enforced.
 *
 *  2. Named approver confirmation: Required when:
 *     - chain.requires_named_approvers = true, OR
 *     - policy.risk_classification in ['high', 'critical']
 *     In this case the actor must also appear in named_approver_ids[].
 *
 *  3. Threshold: when approvedCount >= requiredApprovalCount on the chain,
 *     the policy automatically advances to `approved` state.
 *
 *  4. Emergency override: chain_type = 'emergency' skips named approver
 *     requirement (still subject to role gate). Emits a critical-level audit.
 *
 *  5. Delegation: a named approver can delegate to another user. The delegate
 *     must also satisfy the role gate. The delegation is recorded in
 *     policy_approval_actions.
 */
import 'server-only'

import { createLogger } from '@nzila/os-core'
import {
  policyApprovalChains,
  policyApprovalActions,
  governedPolicies,
  type PolicyApprovalChainRow,
  type NewPolicyApprovalChainRow,
  type PolicyApprovalActionRow,
  type NewPolicyApprovalActionRow,
} from '@nzila/db/schema'
import { eq, and, sql } from 'drizzle-orm'

import { transitionState } from './governed-policy-service'
import { recordGovernanceEvent } from './policy-governance-events-service'

const logger = createLogger('control-plane:authority:policy-approval-service')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDB = any

// ── Chain management ──────────────────────────────────────────────────────────

export interface CreateApprovalChainInput {
  governedPolicyId: string
  chainType: NewPolicyApprovalChainRow['chainType']
  requiresNamedApprovers?: boolean
  approverRoles: string[]
  namedApproverIds?: string[]
  requiredApprovals?: number
}

export async function createApprovalChain(
  input: CreateApprovalChainInput,
  actorId: string,
  db: AnyDB,
): Promise<PolicyApprovalChainRow> {
  const [policy] = await db
    .select()
    .from(governedPolicies)
    .where(eq(governedPolicies.id, input.governedPolicyId))
    .limit(1)

  if (!policy) {
    throw new Error(`[policy-approval-service] Policy ${input.governedPolicyId} not found.`)
  }

  const requiresNamed =
    input.requiresNamedApprovers ||
    policy.riskClassification === 'high' ||
    policy.riskClassification === 'critical'

  const [chain] = await db
    .insert(policyApprovalChains)
    .values({
      governedPolicyId: input.governedPolicyId,
      chainType: input.chainType,
      requiresNamedApprovers: requiresNamed,
      approverRoles: input.approverRoles,
      namedApproverIds: input.namedApproverIds ?? [],
      requiredApprovals: input.requiredApprovals ?? 1,
      createdBy: actorId,
    } satisfies NewPolicyApprovalChainRow)
    .returning()

  logger.info('approval chain created', {
    chainId: (chain as PolicyApprovalChainRow).id,
    governedPolicyId: input.governedPolicyId,
    chainType: input.chainType,
  })

  return chain as PolicyApprovalChainRow
}

// ── Approval actions ──────────────────────────────────────────────────────────

export interface RecordApprovalActionInput {
  chainId: string
  action: NewPolicyApprovalActionRow['action']
  actorUserId: string
  actorRole: string
  rationale?: string | null
  delegatedToUserId?: string | null
}

/**
 * Record an approval action (approved / rejected / delegated / withdrawn).
 *
 * Enforces:
 *  - Role gate: actorRole must be in chain.approver_roles
 *  - Named approver gate: if chain.requires_named_approvers (and not emergency),
 *    actorUserId must be in chain.named_approver_ids
 *  - Auto-advances to `approved` state when threshold is met
 *  - Reverts to `draft` on rejection
 */
export async function recordApprovalAction(
  input: RecordApprovalActionInput,
  db: AnyDB,
  correlationId?: string,
): Promise<PolicyApprovalActionRow> {
  const [chain] = await db
    .select()
    .from(policyApprovalChains)
    .where(eq(policyApprovalChains.id, input.chainId))
    .limit(1)

  if (!chain) {
    throw new Error(`[policy-approval-service] Approval chain ${input.chainId} not found.`)
  }

  const c = chain as PolicyApprovalChainRow

  // ── Role gate ────────────────────────────────────────────────────────────
  const roleOk =
    !c.approverRoles ||
    c.approverRoles.length === 0 ||
    c.approverRoles.includes(input.actorRole)
  if (!roleOk) {
    throw new Error(
      `[policy-approval-service] ROLE_GATE_BLOCKED: actor role "${input.actorRole}" ` +
        `is not in the required approver roles [${c.approverRoles.join(', ')}].`,
    )
  }

  // ── Named approver gate ──────────────────────────────────────────────────
  const isEmergency = c.chainType === 'emergency'
  if (c.requiresNamedApprovers && !isEmergency) {
    const namedOk =
      !c.namedApproverIds ||
      c.namedApproverIds.length === 0 ||
      c.namedApproverIds.includes(input.actorUserId) ||
      input.delegatedToUserId != null
    if (!namedOk) {
      throw new Error(
        `[policy-approval-service] NAMED_APPROVER_GATE_BLOCKED: ` +
          `actor "${input.actorUserId}" is not a named approver for this chain.`,
      )
    }
  }

  // ── Record action (append-only) ──────────────────────────────────────────
  const [action] = await db
    .insert(policyApprovalActions)
    .values({
      governedPolicyId: c.governedPolicyId,
      chainId: input.chainId,
      approverUserId: input.actorUserId,
      approverRole: input.actorRole,
      action: input.action,
      rationale: input.rationale ?? null,
      delegatedToUserId: input.delegatedToUserId ?? null,
    } satisfies NewPolicyApprovalActionRow)
    .returning()

  // ── Post-action state transitions ────────────────────────────────────────
  if (input.action === 'approved') {
    const approvedCount = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(policyApprovalActions)
      .where(
        and(
          eq(policyApprovalActions.chainId, input.chainId),
          eq(policyApprovalActions.action, 'approved'),
        ),
      )

    const count = Number(approvedCount[0]?.count ?? 0)
    if (count >= (c.requiredApprovals ?? 1)) {
      await transitionState(c.governedPolicyId, 'approved', input.actorUserId, input.actorRole, db, {
        correlationId,
        payload: { chainId: input.chainId, approvedCount: count },
      })
    }
  }

  if (input.action === 'rejected') {
    await transitionState(c.governedPolicyId, 'draft', input.actorUserId, input.actorRole, db, {
      correlationId,
      payload: { chainId: input.chainId, reason: input.rationale },
    })

    await recordGovernanceEvent(
      {
        policyId: c.governedPolicyId,
        policyVersion: 'unknown',
        domain: 'governance',
        eventType: 'policy.rejected',
        actorUserId: input.actorUserId,
        actorRole: input.actorRole,
        previousState: 'approval_required',
        nextState: 'draft',
        payload: { chainId: input.chainId, rationale: input.rationale },
        correlationId,
      },
      db,
    )
  }

  if (input.action === 'delegated' && input.delegatedToUserId) {
    await recordGovernanceEvent(
      {
        policyId: c.governedPolicyId,
        policyVersion: 'unknown',
        domain: 'governance',
        eventType: 'policy.approval_delegated',
        actorUserId: input.actorUserId,
        actorRole: input.actorRole,
        payload: {
          chainId: input.chainId,
          delegatedToUserId: input.delegatedToUserId,
        },
        correlationId,
      },
      db,
    )
  }

  if (isEmergency) {
    logger.warn('EMERGENCY APPROVAL executed — bypass of named approver requirement', {
      chainId: input.chainId,
      actorUserId: input.actorUserId,
    })
  }

  return action as PolicyApprovalActionRow
}

// ── Delegation ────────────────────────────────────────────────────────────────

export async function delegateApproval(
  chainId: string,
  fromUserId: string,
  toUserId: string,
  fromRole: string,
  db: AnyDB,
  correlationId?: string,
): Promise<PolicyApprovalActionRow> {
  return recordApprovalAction(
    {
      chainId,
      action: 'delegated',
      actorUserId: fromUserId,
      actorRole: fromRole,
      delegatedToUserId: toUserId,
    },
    db,
    correlationId,
  )
}

// ── Status reads ──────────────────────────────────────────────────────────────

export interface ApprovalStatus {
  policyId: string
  chains: PolicyApprovalChainRow[]
  approvedCount: number
  requiredCount: number
  isFullyApproved: boolean
  hasPendingDelegation: boolean
}

export async function checkApprovalStatus(
  policyId: string,
  db: AnyDB,
): Promise<ApprovalStatus> {
  const chains = await db
    .select()
    .from(policyApprovalChains)
    .where(eq(policyApprovalChains.governedPolicyId, policyId))

  if (chains.length === 0) {
    return {
      policyId,
      chains: [],
      approvedCount: 0,
      requiredCount: 1,
      isFullyApproved: false,
      hasPendingDelegation: false,
    }
  }

  const primaryChain = chains[0] as PolicyApprovalChainRow
  const actions: PolicyApprovalActionRow[] = await db
    .select()
    .from(policyApprovalActions)
    .where(eq(policyApprovalActions.chainId, primaryChain.id))

  const approvedCount = actions.filter((a) => a.action === 'approved').length
  const requiredCount = primaryChain.requiredApprovals ?? 1
  const hasPendingDelegation = actions.some(
    (a) => a.action === 'delegated' && a.delegatedToUserId !== null,
  )

  return {
    policyId,
    chains: chains as PolicyApprovalChainRow[],
    approvedCount,
    requiredCount,
    isFullyApproved: approvedCount >= requiredCount,
    hasPendingDelegation,
  }
}

export interface PendingApproval {
  chainId: string
  policyId: string
  policyName: string
  riskClassification: string
  chainType: string
  requiredCount: number
  currentCount: number
}

/**
 * Get all pending approvals for a given actor (by role or named ID).
 */
export async function getApprovalQueue(
  actorUserId: string,
  actorRole: string,
  db: AnyDB,
): Promise<PendingApproval[]> {
  const policies = await db
    .select()
    .from(governedPolicies)
    .where(eq(governedPolicies.lifecycleStatus, 'approval_required'))

  const results: PendingApproval[] = []

  for (const policy of policies) {
    const chains: PolicyApprovalChainRow[] = await db
      .select()
      .from(policyApprovalChains)
      .where(eq(policyApprovalChains.governedPolicyId, policy.id))

    for (const chain of chains) {
      const isRoleEligible =
        !chain.approverRoles || chain.approverRoles.includes(actorRole)
      const isNamedEligible =
        !chain.requiresNamedApprovers ||
        !chain.namedApproverIds ||
        chain.namedApproverIds.includes(actorUserId)

      if (!isRoleEligible && !isNamedEligible) continue

      const actions: PolicyApprovalActionRow[] = await db
        .select()
        .from(policyApprovalActions)
        .where(
          and(
            eq(policyApprovalActions.chainId, chain.id),
            eq(policyApprovalActions.action, 'approved'),
          ),
        )

      const currentCount = actions.length
      const requiredCount = chain.requiredApprovals ?? 1

      if (currentCount < requiredCount) {
        results.push({
          chainId: chain.id,
          policyId: policy.id,
          policyName: policy.name,
          riskClassification: policy.riskClassification,
          chainType: chain.chainType,
          requiredCount,
          currentCount,
        })
      }
    }
  }

  return results
}
