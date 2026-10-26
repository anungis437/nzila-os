import { describe, expect, it } from 'vitest'
import { decide } from '../kernel'
import type { ApprovalRequestFacts, Decision, GovernanceReviewFacts, ReasonCode } from '../ontology'
import {
  APPROVAL_ID, NOW, ORG, ORG_B, REVIEW_ID, U, ago, ahead, DAY, delegation, facts, mandate, membership, recusal, ref, request,
} from './fixtures'

const codes = (d: Decision): ReasonCode[] => d.reasons.map((r) => r.code)

const approval = (over: Partial<ApprovalRequestFacts> = {}): ApprovalRequestFacts => ({
  kind: 'approval_request', id: APPROVAL_ID, organizationId: ORG, subjectType: 'policy',
  subjectId: '00000000-0000-4000-8000-0000000f0001', proposedBy: U.registrar, subjectAuthorId: U.registrar,
  requiredApprovals: 2, status: 'open', namedApproverIds: [], eligibleCapacities: ['executive'],
  decisions: [], adverseUserIds: [], riskClass: 'medium', ...over,
})

const office = (userId: string, id: string, powers = ['approve']) =>
  mandate({ id, principalUserId: userId, kind: 'executive_office', powers, scope: {}, grantedBy: U.other, sourceInstrument: 'Constitution art. 9' })

const approve = (userId: string, f: ReturnType<typeof facts>, a = approval(), over = {}) =>
  decide(request(userId, 'governance:approve', ref('approval_request', APPROVAL_ID), over), f, a, NOW)

const exec = (userId: string, mid: string, extra: Partial<Parameters<typeof facts>[2]> = {}) =>
  facts(userId, ['executive'], { mandates: [office(userId, mid)], ...extra })

describe('governance approval — authority is an office mandate or naming, not a role', () => {
  it('allows an office-holder carrying approve power with an eligible capacity', () => {
    const d = approve(U.president, exec(U.president, '00000000-0000-4000-8000-0000000a1001'))
    expect(d.effect).toBe('allow')
    expect(d.authorityLineUserId).toBe(U.president)
  })

  it('an executive capacity with NO office mandate cannot approve', () => {
    expect(codes(approve(U.president, facts(U.president, ['executive'])))).toContain('NO_SOURCE_OF_AUTHORITY')
  })

  it('a mandate without the approve power cannot approve', () => {
    const f = facts(U.president, ['executive'], { mandates: [office(U.president, '00000000-0000-4000-8000-0000000a1002', ['read'])] })
    expect(approve(U.president, f).effect).toBe('deny')
  })

  it('an expired office term cannot approve', () => {
    const f = facts(U.president, ['executive'], { mandates: [{ ...office(U.president, '00000000-0000-4000-8000-0000000a1003'), expiresAt: ago(1) }] })
    expect(approve(U.president, f).effect).toBe('deny')
  })

  it('a self-granted office mandate cannot approve', () => {
    const f = facts(U.president, ['executive'], { mandates: [{ ...office(U.president, '00000000-0000-4000-8000-0000000a1004'), grantedBy: U.president }] })
    expect(approve(U.president, f).effect).toBe('deny')
  })

  it('capacity gates eligibility: an office mandate on a non-eligible capacity is refused', () => {
    const f = facts(U.officer, ['officer'], { mandates: [office(U.officer, '00000000-0000-4000-8000-0000000a1005')] })
    expect(codes(approve(U.officer, f))).toContain('CAPACITY_NOT_ELIGIBLE')
  })

  it('named approvers: only the named may approve', () => {
    const a = approval({ namedApproverIds: [U.treasurer] })
    expect(codes(approve(U.president, exec(U.president, '00000000-0000-4000-8000-0000000a1006'), a))).toContain('NOT_ELIGIBLE_APPROVER')
    expect(approve(U.treasurer, facts(U.treasurer, ['executive']), a).effect).toBe('allow')
  })

  it('FOREIGN TENANT', () => {
    const d = decide(request(U.president, 'governance:approve', ref('approval_request', APPROVAL_ID, ORG_B)), exec(U.president, '00000000-0000-4000-8000-0000000a1007'), approval({ organizationId: ORG_B }), NOW)
    expect(codes(d)).toContain('FOREIGN_TENANT')
  })
})

describe('governance approval — self-approval and conflicts', () => {
  const f = (u: string, n: number) => exec(u, `00000000-0000-4000-8000-0000000a2${String(n).padStart(3, '0')}`)

  it('the proposer cannot approve their own request', () => {
    expect(codes(approve(U.registrar, f(U.registrar, 1)))).toContain('SELF_APPROVAL')
  })

  it('the subject author cannot approve even if someone else proposed it', () => {
    const a = approval({ proposedBy: U.other, subjectAuthorId: U.president })
    expect(codes(approve(U.president, f(U.president, 2), a))).toContain('SELF_APPROVAL')
  })

  it('a respondent / adverse party cannot approve', () => {
    expect(codes(approve(U.president, f(U.president, 3), approval({ adverseUserIds: [U.president] })))).toContain('ADVERSE_PARTY')
  })

  it('a recused principal cannot approve', () => {
    const fx = exec(U.president, '00000000-0000-4000-8000-0000000a2004', { recusals: [recusal({ principalUserId: U.president, resource: ref('approval_request', APPROVAL_ID) })] })
    expect(codes(approve(U.president, fx))).toContain('RECUSED')
  })

  it('cannot approve a request that is not open', () => {
    for (const status of ['satisfied', 'rejected', 'withdrawn'] as const) {
      expect(codes(approve(U.president, f(U.president, 5), approval({ status })))).toContain('STATE_NOT_ELIGIBLE')
    }
  })

  it('the same person cannot vote twice', () => {
    const a = approval({ decisions: [{ approverUserId: U.president, authorityLineUserId: U.president, decision: 'approved' }] })
    expect(codes(approve(U.president, f(U.president, 6), a))).toContain('ALREADY_DECIDED')
  })
})

describe('governance approval — executive delegation (one person, one vote)', () => {
  const OFFICE_ID = '00000000-0000-4000-8000-0000000a3001'
  const dlg = delegation()
  const setup = (over: Partial<Parameters<typeof facts>[2]> = {}) =>
    facts(U.delegate, ['executive'], {
      memberships: [membership(U.delegate, ['executive']), membership(U.president, ['executive'])],
      mandates: [office(U.president, OFFICE_ID)], delegations: [dlg], ...over,
    })
  const viaDelegate = (f = setup(), a = approval()) => approve(U.delegate, f, a, { delegationId: dlg.id })

  it('a delegate votes under the delegator\'s authority line', () => {
    const d = viaDelegate()
    expect(d.effect).toBe('allow')
    expect(d.authorityLineUserId).toBe(U.president)
    expect(d.authority[0].kind).toBe('delegation')
  })

  it('once the delegate has voted, the delegator cannot vote again', () => {
    const a = approval({ decisions: [{ approverUserId: U.delegate, authorityLineUserId: U.president, decision: 'approved' }] })
    expect(codes(approve(U.president, exec(U.president, OFFICE_ID), a))).toContain('ALREADY_DECIDED')
  })

  it('once the delegator has voted, the delegate cannot vote on their behalf', () => {
    const a = approval({ decisions: [{ approverUserId: U.president, authorityLineUserId: U.president, decision: 'approved' }] })
    expect(codes(viaDelegate(setup(), a))).toContain('ALREADY_DECIDED')
  })

  it('a delegate cannot cast a second vote under their own line after voting as delegate', () => {
    const a = approval({ decisions: [{ approverUserId: U.delegate, authorityLineUserId: U.president, decision: 'approved' }] })
    expect(codes(approve(U.delegate, facts(U.delegate, ['executive'], { mandates: [office(U.delegate, '00000000-0000-4000-8000-0000000a3002')] }), a))).toContain('ALREADY_DECIDED')
  })

  it.each(['revoked', 'expired'] as const)('a %s delegation is void', (kind) => {
    const bad = kind === 'revoked' ? { ...dlg, status: 'revoked' as const, revokedAt: ago(1) } : { ...dlg, expiresAt: ago(1) }
    expect(viaDelegate(setup({ delegations: [bad] })).effect).toBe('deny')
  })

  it('a delegation naming other actions or resource types cannot approve', () => {
    expect(viaDelegate(setup({ delegations: [{ ...dlg, actions: ['case:read'] }] })).effect).toBe('deny')
    expect(viaDelegate(setup({ delegations: [{ ...dlg, resourceTypes: ['case'] }] })).effect).toBe('deny')
  })

  it('refuses when the delegator\'s office term has lapsed or they left', () => {
    expect(viaDelegate(setup({ mandates: [{ ...office(U.president, OFFICE_ID), expiresAt: ago(1) }] })).effect).toBe('deny')
    expect(viaDelegate(setup({ memberships: [membership(U.delegate, ['executive']), membership(U.president, ['executive'], { status: 'suspended' })] })).effect).toBe('deny')
  })

  it('the delegator\'s conflicts pass through: author, proposer, recusal, adversity', () => {
    expect(codes(viaDelegate(setup(), approval({ subjectAuthorId: U.president })))).toContain('SELF_APPROVAL')
    expect(codes(viaDelegate(setup(), approval({ proposedBy: U.president, subjectAuthorId: null })))).toContain('SELF_APPROVAL')
    expect(codes(viaDelegate(setup(), approval({ adverseUserIds: [U.president] })))).toContain('ADVERSE_PARTY')
    expect(codes(viaDelegate(setup({ recusals: [recusal({ principalUserId: U.president, resource: ref('approval_request', APPROVAL_ID) })] })))).toContain('RECUSED')
  })

  it('a delegate cannot be the proposer or author either', () => {
    expect(codes(viaDelegate(setup(), approval({ proposedBy: U.delegate })))).toContain('SELF_APPROVAL')
  })

  it('high and critical risk approvals cannot be delegated', () => {
    for (const riskClass of ['high', 'critical'] as const) {
      expect(codes(viaDelegate(setup(), approval({ riskClass, requiredApprovals: 2 })))).toContain('DELEGATION_INVALID')
    }
  })

  it('named approvers: the delegator must be the named approver', () => {
    expect(viaDelegate(setup(), approval({ namedApproverIds: [U.treasurer] })).effect).toBe('deny')
    expect(viaDelegate(setup(), approval({ namedApproverIds: [U.president] })).effect).toBe('allow')
  })

  it('a delegation cannot be used by a different principal', () => {
    const f = facts(U.other, ['executive'], { memberships: [membership(U.other, ['executive']), membership(U.president, ['executive'])], mandates: [office(U.president, OFFICE_ID)], delegations: [dlg] })
    expect(approve(U.other, f, approval(), { delegationId: dlg.id }).effect).toBe('deny')
  })

  it('self-delegation and open-ended delegations are void', () => {
    expect(viaDelegate(setup({ delegations: [{ ...dlg, delegatorUserId: U.delegate }] })).effect).toBe('deny')
    expect(viaDelegate(setup({ delegations: [{ ...dlg, expiresAt: null }] })).effect).toBe('deny')
  })
})

describe('governance approval — high-risk integrity', () => {
  it('a high-risk request configured with fewer than two approvals is unapprovable', () => {
    for (const riskClass of ['high', 'critical'] as const) {
      const d = approve(U.president, exec(U.president, '00000000-0000-4000-8000-0000000a4001'), approval({ riskClass, requiredApprovals: 1 }))
      expect(codes(d)).toContain('FACTS_CONTRADICTORY')
    }
  })

  it('a request requiring zero approvals is contradictory', () => {
    expect(codes(approve(U.president, exec(U.president, '00000000-0000-4000-8000-0000000a4002'), approval({ requiredApprovals: 0 })))).toContain('FACTS_CONTRADICTORY')
  })
})

describe('independent review powers', () => {
  const review = (over: Partial<GovernanceReviewFacts> = {}): GovernanceReviewFacts => ({
    kind: 'governance_review', id: REVIEW_ID, organizationId: ORG, adverseUserIds: [U.president],
    complainantUserId: U.member, classification: 'standard', remediationOwnerUserId: U.treasurer, ...over,
  })
  const rm = (powers: string[], over = {}) => mandate({
    id: '00000000-0000-4000-8000-0000000b1001', principalUserId: U.reviewer, kind: 'governance_review',
    powers, scope: { resourceIds: [REVIEW_ID] }, grantedBy: U.other, sourceInstrument: 'Constitution art. 22 appointment', ...over,
  })
  const rf = (powers: string[], caps: Parameters<typeof facts>[1] = ['governance_reviewer'], over = {}) => facts(U.reviewer, caps, { mandates: [rm(powers, over)] })
  const act = (a: Parameters<typeof request>[1], f: ReturnType<typeof facts>, rv = review(), userId = U.reviewer) =>
    decide(request(userId, a, ref('governance_review', REVIEW_ID)), f, rv, NOW)

  it('the five powers are independent: holding one never confers another', () => {
    const powers = ['monitor', 'access_evidence', 'issue_finding', 'request_corrective_action', 'enforce']
    const actions = ['review:monitor', 'review:access_evidence', 'review:issue_finding', 'review:request_corrective_action', 'review:enforce'] as const
    powers.forEach((p, i) => {
      const f = rf([p])
      actions.forEach((a, j) => expect(act(a, f).effect).toBe(i === j ? 'allow' : 'deny'))
    })
  })

  it('a president or admin with no appointment has no oversight', () => {
    expect(act('review:monitor', facts(U.president, ['executive']), review({ adverseUserIds: [] }), U.president).effect).toBe('deny')
    expect(act('review:monitor', facts(U.admin, ['member']), review(), U.admin).effect).toBe('deny')
  })

  it('a mandate is bound to one review and does not reach another', () => {
    const d = decide(request(U.reviewer, 'review:monitor', ref('governance_review', '00000000-0000-4000-8000-0000000b9999')), rf(['monitor']), review({ id: '00000000-0000-4000-8000-0000000b9999' }), NOW)
    expect(codes(d)).toContain('OUT_OF_SCOPE')
  })

  it('an expired appointment grants nothing', () => {
    expect(act('review:monitor', rf(['monitor'], ['governance_reviewer'], { expiresAt: ago(1) })).effect).toBe('deny')
  })

  it('requires the governance_reviewer capacity (appointment-only)', () => {
    expect(codes(act('review:monitor', rf(['monitor'], ['officer'])))).toContain('CAPACITY_NOT_ELIGIBLE')
  })

  it('respondents, complainants and recused reviewers are excluded from every power', () => {
    for (const rv of [review({ adverseUserIds: [U.reviewer] }), review({ complainantUserId: U.reviewer })]) {
      expect(codes(act('review:monitor', rf(['monitor']), rv))).toContain('ADVERSE_PARTY')
    }
    const f = facts(U.reviewer, ['governance_reviewer'], { mandates: [rm(['monitor'])], recusals: [recusal({ principalUserId: U.reviewer, resource: ref('governance_review', REVIEW_ID) })] })
    expect(codes(act('review:monitor', f))).toContain('RECUSED')
  })

  it('an owner cannot verify their own remediation', () => {
    const f = facts(U.treasurer, ['governance_reviewer'], { mandates: [rm(['request_corrective_action'], { principalUserId: U.treasurer })] })
    expect(codes(act('review:verify_remediation', f, review(), U.treasurer))).toContain('SEGREGATION_OF_DUTIES')
  })

  it('an independent reviewer can verify remediation', () => {
    expect(act('review:verify_remediation', rf(['request_corrective_action'])).effect).toBe('allow')
  })

  it('privileged evidence is out of reach of every oversight mandate', () => {
    expect(codes(act('review:access_evidence', rf(['access_evidence']), review({ classification: 'privileged' })))).toContain('PRIVILEGED_MATTER')
  })

  it('oversight powers are personal: not delegable', () => {
    const d = decide(request(U.reviewer, 'review:monitor', ref('governance_review', REVIEW_ID), { delegationId: '00000000-0000-4000-8000-000000000950' }), rf(['monitor']), review(), NOW)
    expect(codes(d)).toContain('DELEGATION_INVALID')
  })

  it('FOREIGN TENANT', () => {
    const d = decide(request(U.reviewer, 'review:monitor', ref('governance_review', REVIEW_ID, ORG_B)), rf(['monitor']), review({ organizationId: ORG_B }), NOW)
    expect(codes(d)).toContain('FOREIGN_TENANT')
  })
})

void DAY; void ahead
