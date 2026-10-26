/**
 * Governed-policy approval authority — pure decision logic.
 *
 * Governance Officer 2.1 P0-C. Every input that decides authority (actor id,
 * actor role, organization) is supplied by the SERVER from the authenticated
 * session. Nothing in a request body may name the actor's role, widen an
 * approval chain beyond what the policy's risk class allows, or approve on
 * behalf of another identity.
 *
 * Platform policies (orgId = null) are governed only by platform principals;
 * org-scoped policies only within their own organization. Neither confers
 * authority over the other.
 */
import { PLATFORM_ELEVATED_ROLES, ROLE_HIERARCHY, type UserRole } from '@/lib/api-auth-guard'

export type PolicyRisk = 'low' | 'medium' | 'high' | 'critical'

export interface ApprovalActor {
  id: string
  role: UserRole
  organizationId: string | null
}

export interface ApprovalPolicy {
  id: string
  orgId: string | null
  authorId: string
  lifecycleStatus: string
  riskClassification: PolicyRisk | string
}

export interface ApprovalChain {
  id: string
  governedPolicyId: string
  chainType: string
  requiredApprovals: number
  requiresNamedApprovers: boolean
  approverRoles: string[]
  namedApproverIds: string[]
  delegatable: boolean
}

export interface ApprovalActionRecord {
  chainId: string
  approverUserId: string
  action: 'approved' | 'rejected' | 'delegated' | 'withdrawn'
  delegatedToUserId?: string | null
}

export type Decision =
  | { allowed: true }
  | { allowed: false; code: DenialCode; reason: string; status: 403 | 404 | 409 | 400 }

export type DenialCode =
  | 'OUT_OF_SCOPE'
  | 'POLICY_NOT_OPEN_FOR_APPROVAL'
  | 'CHAIN_ALREADY_EXISTS'
  | 'INVALID_CHAIN'
  | 'CHAIN_POLICY_MISMATCH'
  | 'CHAIN_CLOSED'
  | 'SELF_APPROVAL'
  | 'NOT_AN_ELIGIBLE_APPROVER'
  | 'ALREADY_APPROVED'
  | 'DELEGATION_NOT_PERMITTED'
  | 'NOTHING_TO_WITHDRAW'

const OPEN_FOR_CHAIN = ['draft', 'review_pending', 'approval_required']
const OPEN_FOR_ACTION = ['review_pending', 'approval_required']
const MIN_APPROVER_LEVEL = ROLE_HIERARCHY.officer

const deny = (code: DenialCode, reason: string, status: 403 | 404 | 409 | 400 = 403): Decision => ({
  allowed: false,
  code,
  reason,
  status,
})

const isPlatformRole = (role: string) => (PLATFORM_ELEVATED_ROLES as readonly string[]).includes(role)
const isHighRisk = (risk: string) => risk === 'high' || risk === 'critical'

/** Whether the actor's institution is the policy's governing institution. */
export function actorOwnsPolicyScope(actor: ApprovalActor, policy: ApprovalPolicy): boolean {
  if (policy.orgId === null) return isPlatformRole(actor.role)
  return actor.organizationId !== null && actor.organizationId === policy.orgId
}

export interface RequestedChain {
  chainType?: string
  requiredApprovals?: number
  approverRoles?: string[]
  namedApproverIds?: string[]
  delegatable?: boolean
}

export function evaluateChainCreation(
  actor: ApprovalActor,
  policy: ApprovalPolicy,
  requested: RequestedChain,
  existingChains: readonly { id: string }[],
): Decision {
  if (!actorOwnsPolicyScope(actor, policy)) {
    return deny('OUT_OF_SCOPE', 'Policy is not within your institutional authority.', 404)
  }
  if (!OPEN_FOR_CHAIN.includes(policy.lifecycleStatus)) {
    return deny('POLICY_NOT_OPEN_FOR_APPROVAL', `Policy in state '${policy.lifecycleStatus}' cannot receive an approval chain.`, 409)
  }
  // One chain per policy version: a second, more permissive chain cannot be
  // added after a strict one exists.
  if (existingChains.length > 0) {
    return deny('CHAIN_ALREADY_EXISTS', 'An approval chain already exists for this policy version.', 409)
  }

  const required = requested.requiredApprovals ?? 1
  if (!Number.isInteger(required) || required < 1 || required > 10) {
    return deny('INVALID_CHAIN', 'requiredApprovals must be an integer between 1 and 10.', 400)
  }

  const roles = requested.approverRoles ?? []
  const named = requested.namedApproverIds ?? []
  if (roles.length === 0 && named.length === 0) {
    return deny('INVALID_CHAIN', 'An approval chain must restrict approvers by role or by named identity.', 400)
  }
  for (const role of roles) {
    const level = ROLE_HIERARCHY[role as UserRole]
    if (level === undefined || level < MIN_APPROVER_LEVEL) {
      return deny('INVALID_CHAIN', `Role '${role}' cannot be an approver.`, 400)
    }
    if (policy.orgId !== null && isPlatformRole(role)) {
      return deny('INVALID_CHAIN', 'Platform roles cannot approve an organization policy.', 400)
    }
  }
  if (requested.chainType === 'emergency' && !isPlatformRole(actor.role)) {
    return deny('INVALID_CHAIN', 'Emergency chains are reserved to platform governance.', 403)
  }
  if (new Set(named).size !== named.length) {
    return deny('INVALID_CHAIN', 'Named approvers must be distinct.', 400)
  }
  if (named.includes(policy.authorId)) {
    return deny('SELF_APPROVAL', 'The policy author cannot be a named approver.')
  }
  if (named.length > 0 && named.length < required) {
    return deny('INVALID_CHAIN', 'Fewer named approvers than required approvals.', 400)
  }
  if (isHighRisk(policy.riskClassification)) {
    if (required < 2) {
      return deny('INVALID_CHAIN', 'High and critical risk policies require at least two independent approvals.', 400)
    }
    if (named.length === 0) {
      return deny('INVALID_CHAIN', 'High and critical risk policies require named approvers.', 400)
    }
    if (requested.delegatable) {
      return deny('INVALID_CHAIN', 'High and critical risk approvals cannot be delegated.', 400)
    }
  }
  return { allowed: true }
}

/** Latest action per approver; later records supersede earlier ones. */
function latestByApprover(actions: readonly ApprovalActionRecord[]) {
  const latest = new Map<string, ApprovalActionRecord>()
  for (const a of actions) latest.set(a.approverUserId, a)
  return latest
}

export function countEffectiveApprovals(actions: readonly ApprovalActionRecord[]): number {
  let n = 0
  for (const a of latestByApprover(actions).values()) if (a.action === 'approved') n += 1
  return n
}

export function isChainRejected(actions: readonly ApprovalActionRecord[]): boolean {
  for (const a of latestByApprover(actions).values()) if (a.action === 'rejected') return true
  return false
}

export function isChainSatisfied(chain: ApprovalChain, actions: readonly ApprovalActionRecord[]): boolean {
  return !isChainRejected(actions) && countEffectiveApprovals(actions) >= chain.requiredApprovals
}

function isEligible(actor: ApprovalActor, chain: ApprovalChain, actions: readonly ApprovalActionRecord[]): boolean {
  if (chain.approverRoles.length > 0 && !chain.approverRoles.includes(actor.role)) return false
  if (!chain.requiresNamedApprovers) return true
  if (chain.namedApproverIds.includes(actor.id)) return true
  if (!chain.delegatable) return false
  const delegatedToActor = actions.some(
    (a) =>
      a.action === 'delegated' &&
      a.delegatedToUserId === actor.id &&
      chain.namedApproverIds.includes(a.approverUserId) &&
      latestByApprover(actions).get(a.approverUserId)?.action === 'delegated',
  )
  return delegatedToActor
}

export interface RequestedAction {
  action: 'approved' | 'rejected' | 'delegated' | 'withdrawn'
  delegatedToUserId?: string
}

export function evaluateApprovalAction(
  actor: ApprovalActor,
  policy: ApprovalPolicy,
  chain: ApprovalChain,
  actions: readonly ApprovalActionRecord[],
  requested: RequestedAction,
): Decision {
  if (!actorOwnsPolicyScope(actor, policy)) {
    return deny('OUT_OF_SCOPE', 'Policy is not within your institutional authority.', 404)
  }
  if (chain.governedPolicyId !== policy.id) {
    return deny('CHAIN_POLICY_MISMATCH', 'Approval chain does not belong to this policy.', 404)
  }
  if (!OPEN_FOR_ACTION.includes(policy.lifecycleStatus)) {
    return deny('POLICY_NOT_OPEN_FOR_APPROVAL', `Policy in state '${policy.lifecycleStatus}' is not awaiting approval.`, 409)
  }
  if (isChainRejected(actions) || isChainSatisfied(chain, actions)) {
    return deny('CHAIN_CLOSED', 'This approval chain has already reached a terminal outcome.', 409)
  }
  if (actor.id === policy.authorId) {
    return deny('SELF_APPROVAL', 'The policy author cannot act on their own approval chain.')
  }

  const mine = latestByApprover(actions).get(actor.id)

  if (requested.action === 'withdrawn') {
    return mine?.action === 'approved'
      ? { allowed: true }
      : deny('NOTHING_TO_WITHDRAW', 'You have no standing approval to withdraw.', 409)
  }

  if (!isEligible(actor, chain, actions)) {
    return deny('NOT_AN_ELIGIBLE_APPROVER', 'You are not an eligible approver for this chain.')
  }

  if (requested.action === 'delegated') {
    const target = requested.delegatedToUserId
    if (
      !chain.delegatable ||
      isHighRisk(policy.riskClassification) ||
      !target ||
      target === actor.id ||
      target === policy.authorId ||
      !chain.requiresNamedApprovers ||
      !chain.namedApproverIds.includes(actor.id)
    ) {
      return deny('DELEGATION_NOT_PERMITTED', 'Delegation is not permitted for this chain, approver or target.')
    }
    return { allowed: true }
  }

  if (mine?.action === 'approved' && requested.action === 'approved') {
    return deny('ALREADY_APPROVED', 'You have already approved this chain.', 409)
  }
  return { allowed: true }
}

/** A policy may leave approval only through a satisfied chain. */
export function mayTransitionToApprovedState(
  chains: readonly ApprovalChain[],
  actionsByChain: ReadonlyMap<string, readonly ApprovalActionRecord[]>,
): boolean {
  return chains.some((c) => isChainSatisfied(c, actionsByChain.get(c.id) ?? []))
}

/**
 * Tenant audit scope for a governance mutation. Org policies audit under their
 * own organization; platform policies under the acting platform principal's
 * organization. Returns null (caller must refuse) rather than inventing a scope.
 */
export function resolveAuditOrganization(
  policy: Pick<ApprovalPolicy, 'orgId'>,
  actorOrganizationId: string | null,
): string | null {
  return policy.orgId ?? actorOrganizationId ?? null
}
