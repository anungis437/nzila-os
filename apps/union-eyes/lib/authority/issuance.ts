/**
 * Authority Kernel — issuance policy.
 *
 * Separates the ability to ISSUE authority from the authority being issued.
 * Holding a power never entitles anyone to confer it, and conferring it never
 * confers it on the issuer. Who may issue what is an institutional decision, so
 * it is data: a versioned, provenance-backed `IssuanceRule`, inactive until
 * approved. With no active rule there is no issuance: the policy fails closed.
 *
 * Pure and deterministic like the rest of the kernel. The database re-checks the
 * structural subset it can see (active rule, ceilings, term, approvals bound to
 * the exact issuance); this module additionally checks what only facts can show
 * (issuer capacity and mandate, membership, conflicts, segregation of duties).
 */
import { activeMembership, activeRecusal, assessMandate, duplicateMembership, hasCapacity } from './common'
import { dutyConflicts } from './policies/finance'
import {
  POLICY_VERSION,
  type AuthorityFacts,
  type Capacity,
  type Mandate,
  type MandateKind,
  type MandateScope,
  type Membership,
  type Reason,
  type ResourceRef,
} from './ontology'

export type IssuanceDomain = MandateKind | 'delegation' | 'case_assignment' | 'recusal'
export type IssuanceOperation = 'issue' | 'amend' | 'suspend' | 'revoke' | 'lift'

export const ISSUANCE_DOMAINS: readonly IssuanceDomain[] = [
  'supervisory',
  'financial',
  'governance_review',
  'executive_office',
  'emergency_access',
  'delegation',
  'case_assignment',
  'recusal',
]
export const ISSUANCE_OPERATIONS: readonly IssuanceOperation[] = ['issue', 'amend', 'suspend', 'revoke', 'lift']

export const PLACEHOLDER_INSTRUMENT = 'PENDING_INSTITUTIONAL_SOURCE'

/** Mirrors the ue_authority_deleg_nondelegable_chk CHECK constraint (asserted by a test). */
export const NON_DELEGABLE_ACTIONS: readonly string[] = [
  'finance:view',
  'finance:prepare',
  'finance:approve',
  'finance:execute',
  'finance:reconcile',
  'finance:audit',
  'case:read_privileged',
  'review:monitor',
  'review:access_evidence',
  'review:issue_finding',
  'review:request_corrective_action',
  'review:enforce',
  'review:verify_remediation',
  'workaid:refer',
  'workaid:receive_disclosure',
  'workaid:read_counsel_material',
]

export interface IssuanceRule {
  id: string
  organizationId: string
  domain: IssuanceDomain
  operation: IssuanceOperation
  issuerCapacities: readonly Capacity[]
  issuerMandateKind: MandateKind | null
  issuerMandatePower: string | null
  allowedPowers: readonly string[]
  maxTermDays: number | null
  requiresAcceptance: boolean
  requiredIndependentApprovals: number
  version: number
  status: 'draft' | 'active' | 'retired'
  sourceInstrument: string
  draftedBy: string
  approvedBy: readonly string[]
}

export interface IssuanceApproval {
  status: 'open' | 'satisfied' | 'rejected' | 'withdrawn'
  /** Distinct authority lines that approved. */
  approvingLines: readonly string[]
}

export interface IssuanceRequest {
  issuerUserId: string
  organizationId: string
  domain: IssuanceDomain
  operation: IssuanceOperation
  holderUserId: string
  /** Powers (mandate), actions (delegation) or permissions (case assignment) conferred. */
  powers?: readonly string[]
  effectiveAt?: Date
  expiresAt?: Date | null
  scope?: MandateScope
  monetaryLimitMinor?: number | null
  currency?: string | null
  justification?: string | null
  sourceInstrument?: string
  resource?: ResourceRef
  /** 'request' skips only the approval-satisfied check, so an approval can be opened for an issuance that would otherwise be allowed. */
  stage?: 'request' | 'execute'
  /** case_assignment: the kernel's own `case:assign` decision for the issuer on this case. */
  caseAssignAllowed?: boolean
  adverseUserIds?: readonly string[]
  /** The holder's currently live mandates, for segregation-of-duties checks. */
  holderMandates?: readonly Mandate[]
  approval?: IssuanceApproval | null
}

export interface IssuanceDecision {
  effect: 'allow' | 'deny'
  domain: IssuanceDomain
  operation: IssuanceOperation
  issuerUserId: string
  holderUserId: string
  organizationId: string
  ruleId: string | null
  ruleVersion: number | null
  requiresAcceptance: boolean
  reasons: readonly Reason[]
  evaluatedAt: string
  policyVersion: string
}

const HOLDER_CAPACITIES: Readonly<Record<IssuanceDomain, readonly Capacity[]>> = {
  supervisory: ['chief_steward', 'officer', 'executive'],
  financial: ['financial_officer', 'executive', 'trustee', 'auditor'],
  governance_review: ['member'],
  executive_office: ['executive'],
  emergency_access: ['steward', 'chief_steward', 'officer', 'executive', 'financial_officer'],
  delegation: ['officer', 'executive'],
  case_assignment: ['steward', 'chief_steward', 'officer'],
  recusal: ['member'],
}

const DAY_MS = 24 * 60 * 60 * 1000

function result(
  req: IssuanceRequest,
  now: Date,
  rule: IssuanceRule | null,
  effect: 'allow' | 'deny',
  reasons: Reason[],
): IssuanceDecision {
  return {
    effect,
    domain: req.domain,
    operation: req.operation,
    issuerUserId: req.issuerUserId,
    holderUserId: req.holderUserId,
    organizationId: req.organizationId,
    ruleId: rule?.id ?? null,
    ruleVersion: rule?.version ?? null,
    requiresAcceptance: effect === 'allow' ? !!rule?.requiresAcceptance : false,
    reasons,
    evaluatedAt: now.toISOString(),
    policyVersion: POLICY_VERSION,
  }
}

function ruleIntegrityProblem(rule: IssuanceRule): string | null {
  if (rule.status !== 'active') return `rule is ${rule.status}`
  if (!rule.sourceInstrument || rule.sourceInstrument.trim() === '' || rule.sourceInstrument === PLACEHOLDER_INSTRUMENT) {
    return 'rule has no real institutional source instrument'
  }
  if (new Set(rule.approvedBy).size !== rule.approvedBy.length || rule.approvedBy.length < 2) {
    return 'rule was not approved by two distinct approvers'
  }
  if (rule.approvedBy.includes(rule.draftedBy)) return 'rule was approved by its own drafter'
  return null
}

export function decideIssuance(
  req: IssuanceRequest,
  facts: AuthorityFacts,
  holderMembership: Membership | null,
  rule: IssuanceRule | null,
  now: Date,
): IssuanceDecision {
  try {
    return evaluate(req, facts, holderMembership, rule, now)
  } catch (error) {
    return result(req, now, null, 'deny', [
      { code: 'FACTS_CONTRADICTORY', detail: `issuance evaluation failed closed: ${error instanceof Error ? error.message : 'unknown'}` },
    ])
  }
}

function evaluate(
  req: IssuanceRequest,
  facts: AuthorityFacts,
  holderMembership: Membership | null,
  rule: IssuanceRule | null,
  now: Date,
): IssuanceDecision {
  const deny = (...reasons: Reason[]): IssuanceDecision => result(req, now, rule, 'deny', reasons)
  const org = req.organizationId

  if (!facts.principal.authenticated) return deny({ code: 'PRINCIPAL_NOT_AUTHENTICATED' })
  if (facts.principal.userId !== req.issuerUserId) return deny({ code: 'PRINCIPAL_MISMATCH' })
  if (facts.memberships.some((m) => m.organizationId !== org)) {
    return deny({ code: 'FOREIGN_TENANT', detail: 'facts include another organization' })
  }

  // 1. An active, matching, organization-owned rule is the only source of issuing authority.
  if (!rule) return deny({ code: 'NO_ACTIVE_ISSUANCE_RULE', detail: `no rule for ${req.domain}/${req.operation}` })
  if (rule.organizationId !== org) return deny({ code: 'FOREIGN_TENANT', detail: 'rule belongs to another organization', ref: rule.id })
  if (rule.domain !== req.domain || rule.operation !== req.operation) {
    return deny({ code: 'NO_ACTIVE_ISSUANCE_RULE', detail: 'rule does not match the requested domain and operation', ref: rule.id })
  }
  const problem = ruleIntegrityProblem(rule)
  if (problem) return deny({ code: 'NO_ACTIVE_ISSUANCE_RULE', detail: problem, ref: rule.id })

  // 2. The issuer is an active member and meets the rule's issuing authority.
  const issuer = activeMembership(facts, org)
  if (!issuer) {
    return deny({ code: duplicateMembership(facts, org) ? 'FACTS_CONTRADICTORY' : 'NOT_AN_ACTIVE_MEMBER' })
  }
  if (rule.issuerCapacities.length > 0 && !hasCapacity(issuer, rule.issuerCapacities)) {
    return deny({ code: 'CAPACITY_NOT_ELIGIBLE', detail: 'issuer capacity is not named by the issuance rule', ref: rule.id })
  }
  if (rule.issuerMandateKind) {
    const power = rule.issuerMandatePower as string
    const held = facts.mandates.find(
      (m) =>
        m.principalUserId === req.issuerUserId &&
        m.kind === rule.issuerMandateKind &&
        m.powers.includes(power) &&
        assessMandate(m, org, now).effective,
    )
    if (!held) {
      return deny({ code: 'NO_SOURCE_OF_AUTHORITY', detail: `issuer holds no live ${rule.issuerMandateKind} mandate with '${power}'`, ref: rule.id })
    }
  }

  // 3. Conflicts.
  if (req.resource) {
    const recusal = activeRecusal(facts.recusals, req.issuerUserId, req.resource, org)
    if (recusal) return deny({ code: 'RECUSED', detail: 'issuer is recused from this matter', ref: recusal.id })
    if ((req.adverseUserIds ?? []).includes(req.issuerUserId)) return deny({ code: 'ADVERSE_PARTY', detail: 'issuer is a party to the matter' })
  }
  if (req.holderUserId === req.issuerUserId) {
    // Surrendering one's own authority is permitted; conferring or lifting a restriction on oneself is not.
    if (req.operation !== 'revoke') return deny({ code: 'SELF_APPROVAL', detail: 'an issuer cannot confer, amend, suspend or lift authority for themselves' })
  }

  // Assigning OR ending a case assignment needs the kernel's own case:assign authority on that very case.
  if (req.domain === 'case_assignment' && req.caseAssignAllowed !== true) {
    return deny({ code: 'NO_SOURCE_OF_AUTHORITY', detail: 'the issuer holds no case:assign authority on this case' })
  }

  const confers = req.operation === 'issue' || req.operation === 'amend'
  if (!confers) {
    return result(req, now, rule, 'allow', [{ code: 'ALLOWED_BY_ISSUANCE_RULE', ref: rule.id }])
  }

  // 4. Conferring authority: the holder, the ceilings and the domain's own protections.
  if (!holderMembership || holderMembership.organizationId !== org || holderMembership.userId !== req.holderUserId || holderMembership.status !== 'active') {
    return deny({ code: 'NOT_AN_ACTIVE_MEMBER', detail: 'the holder is not an active member of this organization' })
  }
  if (!hasCapacity(holderMembership, HOLDER_CAPACITIES[req.domain])) {
    return deny({ code: 'CAPACITY_NOT_ELIGIBLE', detail: `the holder's capacity is not eligible for ${req.domain}` })
  }
  if ((req.adverseUserIds ?? []).includes(req.holderUserId)) return deny({ code: 'ADVERSE_PARTY', detail: 'the holder is a party to the matter' })
  if (req.resource && activeRecusal(facts.recusals, req.holderUserId, req.resource, org)) {
    return deny({ code: 'RECUSED', detail: 'the holder is recused from this matter' })
  }

  const powers = req.powers ?? []
  if ((req.domain !== 'case_assignment' || powers.length > 0) && !powers.every((p) => rule.allowedPowers.includes(p))) {
    return deny({ code: 'EXCEEDS_RULE_CEILING', detail: 'requested powers exceed the rule ceiling', ref: rule.id })
  }
  if (req.domain !== 'case_assignment' && req.domain !== 'recusal') {
    if (!req.expiresAt || !req.effectiveAt) return deny({ code: 'INSTRUMENT_INVALID', detail: 'an effective date and an expiry are required' })
    if (rule.maxTermDays !== null && req.expiresAt.getTime() - req.effectiveAt.getTime() > rule.maxTermDays * DAY_MS) {
      return deny({ code: 'EXCEEDS_RULE_CEILING', detail: `term exceeds ${rule.maxTermDays} day(s)`, ref: rule.id })
    }
    if (req.expiresAt.getTime() <= req.effectiveAt.getTime()) return deny({ code: 'INSTRUMENT_INVALID', detail: 'expiry must follow the effective date' })
  }

  // 5. Independent approval, bound to the exact issuance, excluding issuer and holder.
  if (rule.requiredIndependentApprovals > 0 && req.stage !== 'request') {
    const a = req.approval
    const lines = new Set((a?.approvingLines ?? []).filter((l) => l !== req.issuerUserId && l !== req.holderUserId))
    if (!a || a.status !== 'satisfied' || lines.size < rule.requiredIndependentApprovals) {
      return deny({
        code: 'APPROVAL_NOT_SATISFIED',
        detail: `${rule.requiredIndependentApprovals} independent approval(s) required, ${lines.size} found`,
        ref: rule.id,
      })
    }
  }

  // 6. Domain protections, evaluated on the instrument that WOULD result.
  switch (req.domain) {
    case 'delegation': {
      const banned = powers.filter((p) => NON_DELEGABLE_ACTIONS.includes(p))
      if (banned.length > 0) return deny({ code: 'DELEGATION_INVALID', detail: `not delegable: ${banned.join(', ')}` })
      break
    }
    case 'case_assignment':
      if (req.caseAssignAllowed !== true) return deny({ code: 'NO_SOURCE_OF_AUTHORITY', detail: 'the issuer holds no case:assign authority on this case' })
      break
    case 'governance_review': {
      // Oversight must stay independent of operation.
      const operating = (req.holderMandates ?? []).some(
        (m) => (m.kind === 'executive_office' || m.kind === 'financial') && assessMandate(m, org, now).effective,
      )
      if (operating) return deny({ code: 'SEGREGATION_OF_DUTIES', detail: 'a governance reviewer cannot also hold executive or financial authority' })
      break
    }
    default:
      break
  }

  if (req.domain !== 'delegation' && req.domain !== 'case_assignment' && req.domain !== 'recusal') {
    const candidate: Mandate = {
      id: '00000000-0000-4000-8000-00000000ca4d',
      organizationId: org,
      principalUserId: req.holderUserId,
      kind: req.domain,
      powers,
      scope: req.scope ?? {},
      monetaryLimitMinor: req.monetaryLimitMinor ?? null,
      currency: req.currency ?? null,
      sourceInstrument: req.sourceInstrument ?? rule.sourceInstrument,
      grantedBy: req.issuerUserId,
      approvedBy:
        req.domain === 'emergency_access'
          ? ([...(req.approval?.approvingLines ?? [])].find((l) => l !== req.issuerUserId && l !== req.holderUserId) ??
            (req.stage === 'request' ? '__pending_independent_approver__' : null))
          : null,
      justification: req.justification ?? null,
      status: 'active',
      effectiveAt: req.effectiveAt as Date,
      expiresAt: req.expiresAt as Date,
      revokedAt: null,
    }
    // `effectiveAt` may be in the future; judge structure at the effective date.
    const structure = assessMandate(candidate, org, candidate.effectiveAt)
    if (!structure.effective) return deny(...structure.reasons)
    if (req.domain === 'financial') {
      const conflicts = dutyConflicts([...(req.holderMandates ?? []).filter((m) => assessMandate(m, org, now).effective), candidate])
      if (conflicts.length > 0) {
        return deny({ code: 'SEGREGATION_OF_DUTIES', detail: `incompatible financial duties over one account: ${conflicts.map((c) => c.duties.join('+')).join(', ')}` })
      }
    }
  }

  return result(req, now, rule, 'allow', [{ code: 'ALLOWED_BY_ISSUANCE_RULE', ref: rule.id }])
}

// ── Default templates ────────────────────────────────────────────────────────
// PROPOSED defaults, not statements about any constitution. They are drafted
// INACTIVE and carry the placeholder instrument, so the database refuses their
// activation until a real source instrument and two independent approvers are
// recorded. Institutions are expected to change them.

export interface IssuanceRuleTemplate {
  domain: IssuanceDomain
  operation: IssuanceOperation
  issuerCapacities: readonly Capacity[]
  issuerMandateKind?: MandateKind
  issuerMandatePower?: string
  allowedPowers: readonly string[]
  maxTermDays: number | null
  requiresAcceptance: boolean
  requiredIndependentApprovals: number
  rationale: string
}

export const DEFAULT_ISSUANCE_TEMPLATES: readonly IssuanceRuleTemplate[] = [
  { domain: 'case_assignment', operation: 'issue', issuerCapacities: ['steward', 'chief_steward', 'officer'], allowedPowers: ['read', 'read_internal', 'comment', 'write'], maxTermDays: null, requiresAcceptance: false, requiredIndependentApprovals: 0, rationale: 'Authorized case owner or designated supervisor; the kernel additionally requires case:assign and conflict checks. read_internal is the explicit grant of the union\'s internal file.' },
  { domain: 'supervisory', operation: 'issue', issuerCapacities: ['officer', 'executive'], allowedPowers: ['read', 'assign', 'monitor'], maxTermDays: 365, requiresAcceptance: true, requiredIndependentApprovals: 1, rationale: 'Authorized institutional officer; defined jurisdiction, term and powers.' },
  { domain: 'executive_office', operation: 'issue', issuerCapacities: ['executive'], allowedPowers: ['approve'], maxTermDays: 1095, requiresAcceptance: true, requiredIndependentApprovals: 1, rationale: 'Authorized executive body; office terms are bounded.' },
  { domain: 'delegation', operation: 'issue', issuerCapacities: ['executive'], issuerMandateKind: 'executive_office', issuerMandatePower: 'approve', allowedPowers: ['case:read', 'case:comment', 'governance:approve'], maxTermDays: 90, requiresAcceptance: true, requiredIndependentApprovals: 0, rationale: 'Office holder; limited, expiring, action-specific.' },
  { domain: 'financial', operation: 'issue', issuerCapacities: ['executive'], allowedPowers: ['view', 'prepare', 'approve', 'execute', 'reconcile', 'audit'], maxTermDays: 365, requiresAcceptance: true, requiredIndependentApprovals: 1, rationale: 'Authorized financial governing body; segregation of duties is enforced at grant time.' },
  { domain: 'governance_review', operation: 'issue', issuerCapacities: ['executive'], allowedPowers: ['monitor', 'access_evidence', 'issue_finding', 'request_corrective_action'], maxTermDays: 365, requiresAcceptance: true, requiredIndependentApprovals: 1, rationale: 'Governed approval body; independent approvers and recusal.' },
  { domain: 'emergency_access', operation: 'issue', issuerCapacities: ['executive'], allowedPowers: ['read'], maxTermDays: 1, requiresAcceptance: false, requiredIndependentApprovals: 1, rationale: 'Pre-authorized emergency process; time-limited, justified, independently approved.' },
  { domain: 'case_assignment', operation: 'revoke', issuerCapacities: ['steward', 'chief_steward', 'officer'], allowedPowers: [], maxTermDays: null, requiresAcceptance: false, requiredIndependentApprovals: 0, rationale: 'Ends a case assignment at once; the kernel additionally requires case:assign on the case.' },
  { domain: 'supervisory', operation: 'revoke', issuerCapacities: ['officer', 'executive'], allowedPowers: [], maxTermDays: null, requiresAcceptance: false, requiredIndependentApprovals: 0, rationale: 'Revocation is immediate and does not need approval.' },
  { domain: 'executive_office', operation: 'revoke', issuerCapacities: ['executive'], allowedPowers: [], maxTermDays: null, requiresAcceptance: false, requiredIndependentApprovals: 0, rationale: 'Succession and removal.' },
  { domain: 'delegation', operation: 'revoke', issuerCapacities: ['executive'], allowedPowers: [], maxTermDays: null, requiresAcceptance: false, requiredIndependentApprovals: 0, rationale: 'The delegator or an executive may revoke at once.' },
  { domain: 'financial', operation: 'revoke', issuerCapacities: ['executive'], allowedPowers: [], maxTermDays: null, requiresAcceptance: false, requiredIndependentApprovals: 0, rationale: 'Revocation is immediate.' },
  { domain: 'governance_review', operation: 'revoke', issuerCapacities: ['executive'], allowedPowers: [], maxTermDays: null, requiresAcceptance: false, requiredIndependentApprovals: 0, rationale: 'Revocation is immediate.' },
  { domain: 'emergency_access', operation: 'revoke', issuerCapacities: ['executive', 'officer'], allowedPowers: [], maxTermDays: null, requiresAcceptance: false, requiredIndependentApprovals: 0, rationale: 'Emergency access can always be withdrawn.' },
  { domain: 'recusal', operation: 'lift', issuerCapacities: ['executive'], allowedPowers: [], maxTermDays: null, requiresAcceptance: false, requiredIndependentApprovals: 0, rationale: 'Never by the recused person; the kernel enforces that.' },
  // Suspension also governs resumption, and must be at least as available as revocation.
  { domain: 'supervisory', operation: 'suspend', issuerCapacities: ['officer', 'executive'], allowedPowers: [], maxTermDays: null, requiresAcceptance: false, requiredIndependentApprovals: 0, rationale: 'Suspend or resume a supervisory mandate.' },
  { domain: 'executive_office', operation: 'suspend', issuerCapacities: ['executive'], allowedPowers: [], maxTermDays: null, requiresAcceptance: false, requiredIndependentApprovals: 0, rationale: 'Suspend or resume an office.' },
  { domain: 'financial', operation: 'suspend', issuerCapacities: ['executive'], allowedPowers: [], maxTermDays: null, requiresAcceptance: false, requiredIndependentApprovals: 0, rationale: 'Freeze financial authority at once.' },
  { domain: 'governance_review', operation: 'suspend', issuerCapacities: ['executive'], allowedPowers: [], maxTermDays: null, requiresAcceptance: false, requiredIndependentApprovals: 0, rationale: 'Suspend a review mandate.' },
  { domain: 'emergency_access', operation: 'suspend', issuerCapacities: ['executive', 'officer'], allowedPowers: [], maxTermDays: null, requiresAcceptance: false, requiredIndependentApprovals: 0, rationale: 'Suspend emergency access.' },
]
