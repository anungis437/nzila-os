/**
 * Authority Kernel — governance policy.
 *
 * Two families:
 *  - `governance:approve`: independent, durable, one-person-one-vote approval of
 *    a governed subject (policy, resolution, ...).
 *  - `review:*`: the five independent oversight powers of the Governance Officer
 *    contract (monitor, access evidence, issue finding, request corrective
 *    action, enforce), plus independent remediation verification.
 *
 * Approval authority = named approver, or a live executive-office mandate
 * carrying the `approve` power; a capacity only makes a principal eligible.
 * A delegate votes under the delegator's authority line, so a delegator and
 * their delegate together hold one vote. High and critical risk subjects are
 * not delegable and require at least two independent approvals.
 *
 * Review powers are personal: they are not delegable, are bound to a specific
 * review, and every conflicted party (respondent, complainant, recused) is
 * excluded from every power.
 */
import {
  activeMembership,
  activeRecusal,
  assessDelegation,
  assessMandate,
  build,
  deny,
  hasCapacity,
  instrumentOf,
} from '../common'
import type {
  ApprovalRequestFacts,
  AuthorityFacts,
  AuthorityRequest,
  AuthoritySource,
  Decision,
  GovernanceReviewFacts,
  Reason,
} from '../ontology'

const HIGH = new Set(['high', 'critical'])

export function decideApproval(
  req: AuthorityRequest,
  facts: AuthorityFacts,
  a: ApprovalRequestFacts,
  now: Date,
): Decision {
  if (req.action !== 'governance:approve') {
    return deny(req, now, { code: 'ACTION_NOT_COVERED', detail: 'only governance:approve applies to an approval request' })
  }
  const orgId = req.organizationId
  const me = req.principalUserId
  const membership = activeMembership(facts, orgId)
  if (!membership) return deny(req, now, { code: 'NOT_AN_ACTIVE_MEMBER' })

  // A misconfigured high-risk request must not be approvable at all.
  if (HIGH.has(a.riskClass) && a.requiredApprovals < 2) {
    return deny(req, now, { code: 'FACTS_CONTRADICTORY', detail: 'high-risk subjects require at least two independent approvals' })
  }
  if (a.requiredApprovals < 1) {
    return deny(req, now, { code: 'FACTS_CONTRADICTORY', detail: 'approval request requires no approvals' })
  }
  if (a.status !== 'open') {
    return deny(req, now, { code: 'STATE_NOT_ELIGIBLE', detail: `approval request is ${a.status}` })
  }

  // Resolve whose authority line this vote counts under.
  let line = me
  let delegationSource: AuthoritySource | null = null
  const misses: Reason[] = []
  if (req.delegationId) {
    if (HIGH.has(a.riskClass)) {
      return deny(req, now, { code: 'DELEGATION_INVALID', detail: 'high-risk approvals cannot be delegated' })
    }
    const d = facts.delegations.find((x) => x.id === req.delegationId)
    if (!d || d.delegateUserId !== me) {
      return deny(req, now, { code: 'DELEGATION_INVALID', detail: 'delegation not found for this principal', ref: req.delegationId })
    }
    const dv = assessDelegation(d, orgId, now)
    if (!dv.effective) return deny(req, now, ...dv.reasons)
    if (!d.actions.includes('governance:approve') || !d.resourceTypes.includes('approval_request')) {
      return deny(req, now, { code: 'DELEGATION_INVALID', detail: 'delegation does not cover governance approval', ref: d.id })
    }
    if (!activeMembership(facts, orgId, d.delegatorUserId)) {
      return deny(req, now, { code: 'DELEGATION_INVALID', detail: 'delegator no longer holds an active membership', ref: d.id })
    }
    // The delegator's own conflicts pass through to the delegate.
    if (a.adverseUserIds.includes(d.delegatorUserId)) return deny(req, now, { code: 'ADVERSE_PARTY', detail: 'delegator is conflicted', ref: d.id })
    if (activeRecusal(facts.recusals, d.delegatorUserId, req.resource, orgId)) {
      return deny(req, now, { code: 'RECUSED', detail: 'delegator is recused', ref: d.id })
    }
    if (d.delegatorUserId === a.proposedBy || d.delegatorUserId === a.subjectAuthorId) {
      return deny(req, now, { code: 'SELF_APPROVAL', detail: 'delegator proposed or authored the subject', ref: d.id })
    }
    const office = facts.mandates.find(
      (m) =>
        m.principalUserId === d.delegatorUserId &&
        m.kind === 'executive_office' &&
        m.powers.includes('approve') &&
        assessMandate(m, orgId, now).effective,
    )
    if (!office) return deny(req, now, { code: 'DELEGATION_INVALID', detail: 'delegator holds no live office mandate with approve power', ref: d.id })
    line = d.delegatorUserId
    delegationSource = { kind: 'delegation', id: d.id, instrument: `delegation of ${d.office} (office mandate ${office.id})` }
  }

  if (a.adverseUserIds.includes(me)) return deny(req, now, { code: 'ADVERSE_PARTY' })
  const recusal = activeRecusal(facts.recusals, me, req.resource, orgId)
  if (recusal) return deny(req, now, { code: 'RECUSED', ref: recusal.id, detail: recusal.reason })
  if (me === a.proposedBy || me === a.subjectAuthorId) {
    return deny(req, now, { code: 'SELF_APPROVAL', detail: 'the proposer or author cannot approve their own subject' })
  }

  // One person, one vote — across personal votes and delegated votes.
  if (a.decisions.some((d) => d.approverUserId === me || d.authorityLineUserId === line || d.authorityLineUserId === me)) {
    return deny(req, now, { code: 'ALREADY_DECIDED', detail: 'this authority line has already decided' })
  }

  // Authority: a named approver, or an office-holder carrying `approve`.
  const capacityHolder = line === me ? membership : activeMembership(facts, orgId, line)
  const named = a.namedApproverIds
  let source: AuthoritySource | null = delegationSource
  if (!source) {
    if (named.length > 0) {
      if (named.includes(me)) source = { kind: 'subject', id: a.id, instrument: `named approver of request ${a.id}` }
      else misses.push({ code: 'NOT_ELIGIBLE_APPROVER', detail: 'principal is not a named approver' })
    } else {
      const office = facts.mandates.find(
        (m) => m.principalUserId === me && m.kind === 'executive_office' && m.powers.includes('approve') && assessMandate(m, orgId, now).effective,
      )
      if (office) source = { kind: 'mandate', id: office.id, instrument: instrumentOf(office) }
      else misses.push({ code: 'NO_SOURCE_OF_AUTHORITY', detail: 'no live office mandate with approve power' })
    }
  } else if (named.length > 0 && !named.includes(line)) {
    misses.push({ code: 'NOT_ELIGIBLE_APPROVER', detail: 'delegator is not a named approver' })
    source = null
  }
  if (!source) return deny(req, now, ...misses)

  if (a.eligibleCapacities.length > 0 && (!capacityHolder || !hasCapacity(capacityHolder, a.eligibleCapacities))) {
    return deny(req, now, { code: 'CAPACITY_NOT_ELIGIBLE', detail: 'capacity not eligible for this approval' })
  }

  return build({
    req,
    now,
    effect: 'allow',
    reasons: [{ code: delegationSource ? 'ALLOWED_BY_DELEGATION' : source.kind === 'mandate' ? 'ALLOWED_BY_MANDATE' : 'ALLOWED_BY_RELATIONSHIP', ref: source.id }],
    authority: [source],
    authorityLineUserId: line,
  })
}

const REVIEW_POWER: Record<string, string> = {
  'review:monitor': 'monitor',
  'review:access_evidence': 'access_evidence',
  'review:issue_finding': 'issue_finding',
  'review:request_corrective_action': 'request_corrective_action',
  'review:enforce': 'enforce',
  // Verification is a corrective-action power, exercised independently of the owner.
  'review:verify_remediation': 'request_corrective_action',
}

export function decideReview(
  req: AuthorityRequest,
  facts: AuthorityFacts,
  rv: GovernanceReviewFacts,
  now: Date,
): Decision {
  const power = REVIEW_POWER[req.action]
  if (!power) return deny(req, now, { code: 'ACTION_NOT_COVERED', detail: `${req.action} does not apply to a governance review` })
  if (req.delegationId) return deny(req, now, { code: 'DELEGATION_INVALID', detail: 'oversight powers are personal and not delegable' })

  const orgId = req.organizationId
  const me = req.principalUserId
  const membership = activeMembership(facts, orgId)
  if (!membership) return deny(req, now, { code: 'NOT_AN_ACTIVE_MEMBER' })
  if (rv.adverseUserIds.includes(me)) return deny(req, now, { code: 'ADVERSE_PARTY', detail: 'respondent cannot exercise oversight' })
  if (rv.complainantUserId === me) return deny(req, now, { code: 'ADVERSE_PARTY', detail: 'complainant cannot review their own complaint' })
  const recusal = activeRecusal(facts.recusals, me, req.resource, orgId)
  if (recusal) return deny(req, now, { code: 'RECUSED', ref: recusal.id })
  if (req.action === 'review:verify_remediation' && rv.remediationOwnerUserId === me) {
    return deny(req, now, { code: 'SEGREGATION_OF_DUTIES', detail: 'an owner cannot verify their own remediation' })
  }
  if (!hasCapacity(membership, ['governance_reviewer'])) {
    return deny(req, now, { code: 'CAPACITY_NOT_ELIGIBLE', detail: 'a recorded oversight appointment is required' })
  }
  // Privileged material needs separately authorised counsel scope; no oversight
  // mandate reaches it.
  if (req.action === 'review:access_evidence' && rv.classification === 'privileged') {
    return deny(req, now, { code: 'PRIVILEGED_MATTER', detail: 'privileged evidence requires separately authorised scope' })
  }

  const misses: Reason[] = []
  for (const m of facts.mandates) {
    if (m.principalUserId !== me || m.kind !== 'governance_review') continue
    const v = assessMandate(m, orgId, now)
    if (!v.effective) {
      misses.push(...v.reasons)
      continue
    }
    if (!m.scope.resourceIds?.includes(rv.id)) {
      misses.push({ code: 'OUT_OF_SCOPE', ref: m.id, detail: 'mandate is bound to a different review' })
      continue
    }
    if (!m.powers.includes(power)) {
      misses.push({ code: 'ACTION_NOT_COVERED', ref: m.id, detail: `mandate lacks power '${power}'` })
      continue
    }
    return build({
      req,
      now,
      effect: 'allow',
      reasons: [{ code: 'ALLOWED_BY_MANDATE', ref: m.id }],
      authority: [{ kind: 'mandate', id: m.id, instrument: instrumentOf(m) }],
      obligations: power === 'monitor' || power === 'access_evidence' ? ['read_only'] : [],
    })
  }
  return deny(req, now, { code: 'NO_SOURCE_OF_AUTHORITY', detail: `no live oversight mandate for ${req.action}` }, ...misses)
}
