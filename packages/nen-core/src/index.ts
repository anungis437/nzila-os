/**
 * Nzila Economic Network — commercial teaming domain.
 * An isolated, deterministic model: no DB, auth, payment or certificate issuer side effects.
 * Actor context must be supplied by Nzila platform-auth after tenant resolution.
 * The functions below are authorization defense-in-depth, not session authentication.
 */
export type Permission = 'nen.team.propose' | 'nen.team.acknowledge' | 'nen.team.approve' | 'nen.contract.accept'
export type Actor = Readonly<{ userId: string; organizationId: string; permissions: readonly Permission[] }>
export type TeamMember = Readonly<{
  organizationId: string
  role: 'lead' | 'partner'
  allocationBps: number
  workScope: string
  consent: 'accepted' | 'pending' | 'declined'
}>
export type TeamPlan = Readonly<{
  id: string
  contractId: string
  buyerOrganizationId: string
  leadOrganizationId: string
  contractValueCents: number
  currency: 'CAD' | 'USD'
  revision: number
  members: readonly TeamMember[]
  buyerApproval: 'pending' | 'approved'
  status: 'proposed' | 'active'
}>
export type Allocation = Readonly<{
  organizationId: string
  role: 'lead' | 'partner'
  workScope: string
  allocatedCents: number
  label: 'proposed_contract_allocation'
}>
export class NenDomainError extends Error {
  readonly code: string
  constructor(code: string) { super(code); this.name = 'NenDomainError'; this.code = code }
}
function requireCondition(ok: unknown, code: string): asserts ok {
  if (!ok) throw new NenDomainError(code)
}
function requireActor(actor: Actor, organizationId: string, permission: Permission): void {
  requireCondition(Boolean(actor.userId && actor.organizationId), 'UNAUTHENTICATED_ACTOR')
  requireCondition(actor.organizationId === organizationId && actor.permissions.includes(permission), 'AUTHORITY_DENIED')
}
function nonblank(value: string): boolean { return typeof value === 'string' && value.trim().length > 0 && value.length <= 300 }
function validBps(value: number): boolean { return Number.isSafeInteger(value) && value >= 0 && value <= 10_000 }
function validatePlan(plan: TeamPlan): void {
  requireCondition(nonblank(plan.id) && nonblank(plan.contractId), 'INVALID_RESOURCE_ID')
  requireCondition(nonblank(plan.leadOrganizationId) && nonblank(plan.buyerOrganizationId), 'INVALID_ORG_ID')
  requireCondition(plan.buyerOrganizationId !== plan.leadOrganizationId, 'BUYER_IS_SUPPLIER')
  requireCondition(Number.isSafeInteger(plan.contractValueCents) && plan.contractValueCents > 0, 'INVALID_CONTRACT_VALUE')
  requireCondition(plan.currency === 'CAD' || plan.currency === 'USD', 'UNSUPPORTED_CURRENCY')
  requireCondition(plan.members.length >= 2 && plan.members.length <= 20, 'TEAM_SIZE_OUT_OF_RANGE')
  requireCondition(plan.members.filter(m => m.role === 'lead').length === 1, 'ONE_LEAD_REQUIRED')
  requireCondition(plan.members.find(m => m.role === 'lead')?.organizationId === plan.leadOrganizationId, 'LEAD_MISMATCH')
  requireCondition(new Set(plan.members.map(m => m.organizationId)).size === plan.members.length, 'DUPLICATE_ORGANIZATION')
  requireCondition(!plan.members.some(m => m.organizationId === plan.buyerOrganizationId), 'BUYER_IN_SUPPLIER_TEAM')
  requireCondition(plan.members.every(m => nonblank(m.organizationId) && nonblank(m.workScope) && validBps(m.allocationBps)), 'INVALID_TEAM_MEMBER')
  requireCondition(plan.members.reduce((sum, m) => sum + m.allocationBps, 0) === 10_000, 'ALLOCATIONS_MUST_TOTAL_100_PERCENT')
  requireCondition(plan.members.find(m => m.role === 'lead')?.consent === 'accepted', 'LEAD_CONSENT_REQUIRED')
}
export function proposeTeam(input: Omit<TeamPlan, 'revision' | 'buyerApproval' | 'status'>, actor: Actor): TeamPlan {
  requireActor(actor, input.leadOrganizationId, 'nen.team.propose')
  requireCondition(input.members.every(m => m.role === 'lead' ? m.consent === 'accepted' : m.consent === 'pending'), 'PARTNERS_MUST_DECIDE_THEMSELVES')
  const plan: TeamPlan = { ...input, members: input.members.map(m => ({ ...m })), revision: 1, buyerApproval: 'pending', status: 'proposed' }
  validatePlan(plan)
  return plan
}
export function decidePartnership(plan: TeamPlan, actor: Actor, decision: 'accepted' | 'declined', expectedRevision: number): TeamPlan {
  requireCondition(plan.status === 'proposed' && plan.buyerApproval === 'pending', 'PLAN_FROZEN')
  requireCondition(plan.revision === expectedRevision, 'STALE_REVISION')
  requireActor(actor, actor.organizationId, 'nen.team.acknowledge')
  const member = plan.members.find(m => m.organizationId === actor.organizationId && m.role === 'partner')
  requireCondition(member && member.consent === 'pending', 'PARTNER_NOT_PENDING')
  return { ...plan, revision: plan.revision + 1, members: plan.members.map(m => m.organizationId === actor.organizationId ? { ...m, consent: decision } : m) }
}
export function approveBuyer(plan: TeamPlan, actor: Actor, expectedRevision: number): TeamPlan {
  requireCondition(plan.status === 'proposed' && plan.buyerApproval === 'pending', 'PLAN_FROZEN')
  requireCondition(plan.revision === expectedRevision, 'STALE_REVISION')
  requireActor(actor, plan.buyerOrganizationId, 'nen.team.approve')
  requireCondition(plan.members.every(m => m.consent === 'accepted'), 'PARTNER_ACCEPTANCE_REQUIRED')
  validatePlan(plan)
  return { ...plan, revision: plan.revision + 1, buyerApproval: 'approved' }
}
export function acceptTeamContract(plan: TeamPlan, actor: Actor, expectedRevision: number): TeamPlan {
  requireCondition(plan.status === 'proposed', 'PLAN_FROZEN')
  requireCondition(plan.revision === expectedRevision, 'STALE_REVISION')
  requireActor(actor, plan.leadOrganizationId, 'nen.contract.accept')
  requireCondition(plan.buyerApproval === 'approved' && plan.members.every(m => m.consent === 'accepted'), 'TEAM_APPROVAL_REQUIRED')
  validatePlan(plan)
  return { ...plan, revision: plan.revision + 1, status: 'active' }
}
/** Deterministic cent-level allocation; fractional cent remainder stays with lead. */
export function getAllocations(plan: TeamPlan, actor: Actor): readonly Allocation[] {
  requireCondition(plan.members.some(m => m.organizationId === actor.organizationId) || actor.organizationId === plan.buyerOrganizationId, 'NO_CONTRACT_ACCESS')
  requireCondition(plan.buyerApproval === 'approved', 'TEAM_NOT_APPROVED')
  const others = plan.members.filter(m => m.role === 'partner')
  const partnerCents = others.map(m => Number((BigInt(plan.contractValueCents) * BigInt(m.allocationBps)) / 10_000n))
  const leadCents = plan.contractValueCents - partnerCents.reduce((sum, n) => sum + n, 0)
  const all = plan.members.map(m => ({
    organizationId: m.organizationId,
    role: m.role,
    workScope: m.workScope,
    allocatedCents: m.role === 'lead' ? leadCents : partnerCents[others.findIndex(p => p.organizationId === m.organizationId)]!,
    label: 'proposed_contract_allocation' as const,
  }))
  // Partners see only their own allocation. Lead and buyer see the complete approved structure.
  return actor.organizationId === plan.buyerOrganizationId || actor.organizationId === plan.leadOrganizationId
    ? all
    : all.filter(item => item.organizationId === actor.organizationId)
}
export function economicSummary(plan: TeamPlan): Readonly<{
  grossContractCents: number
  receivedCents: 0
  source: 'proposed_team_contract'
  independentlyVerified: false
}> {
  validatePlan(plan)
  return { grossContractCents: plan.contractValueCents, receivedCents: 0, source: 'proposed_team_contract', independentlyVerified: false }
}
