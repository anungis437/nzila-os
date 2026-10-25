/**
 * Revocation sweep over EVERY kernel policy family (UE-CONV-A "revoked sessions or memberships cannot retain
 * subordinate authority"). Each scenario is a decision that is ALLOWED while the holder's membership is active, with
 * the subordinate record (mandate, relationship, delegation, emergency grant, named approval, review mandate, WorkAid
 * referral) left perfectly live. The only change is the holder's membership state; every non-active state must deny
 * with NOT_AN_ACTIVE_MEMBER (or, for a delegation, name the delegator's membership). The database-level proof against
 * the real storage and membership relations is db/__tests__/authority-kernel-revocation.pglite.test.ts.
 */
import { describe, expect, it } from 'vitest'
import { decide } from '../kernel'
import type { ApprovalRequestFacts, Decision, GovernanceReviewFacts, Mandate, MembershipStatus, ReasonCode, WorkAidMatterFacts } from '../ontology'
import {
  ACCT, APPROVAL_ID, CASE_ID, MATTER_ID, NOW, ORG, REVIEW_ID, TX_ID, U, ago, ahead, caseFacts, consent, delegation, facts, mandate, membership, ref, relationship, request,
} from './fixtures'

const codes = (d: Decision): ReasonCode[] => d.reasons.map((r) => r.code)
const NOT_ACTIVE: readonly MembershipStatus[] = ['suspended', 'inactive', 'revoked', 'pending' as MembershipStatus]

const approval = (over: Partial<ApprovalRequestFacts> = {}): ApprovalRequestFacts => ({
  kind: 'approval_request', id: APPROVAL_ID, organizationId: ORG, subjectType: 'policy', subjectId: '00000000-0000-4000-8000-0000000f0001',
  proposedBy: U.registrar, subjectAuthorId: U.registrar, requiredApprovals: 2, status: 'open', namedApproverIds: [], eligibleCapacities: ['executive'],
  decisions: [], adverseUserIds: [], riskClass: 'medium', ...over,
})
const office = (userId: string, powers = ['approve']): Mandate =>
  mandate({ id: '00000000-0000-4000-8000-0000000a1001', principalUserId: userId, kind: 'executive_office', powers, scope: {}, grantedBy: U.other, sourceInstrument: 'Constitution art. 9' })
const review: GovernanceReviewFacts = {
  kind: 'governance_review', id: REVIEW_ID, organizationId: ORG, adverseUserIds: [U.president], complainantUserId: U.member, classification: 'standard', remediationOwnerUserId: U.treasurer,
}
const matter: WorkAidMatterFacts = { kind: 'workaid_matter', id: MATTER_ID, organizationId: ORG, memberUserId: U.member, caseId: CASE_ID, counselControlled: true }

interface Scenario {
  name: string
  /** The decision for the holder, given the holder's membership status. */
  run: (status: MembershipStatus) => Decision
  /** Which membership the scenario revokes (the holder's, or - for a delegation - the delegator's). */
  expectOnRevoked: ReasonCode
}

const caseRead = (userId: string, over = {}) => request(userId, 'case:read', ref('case', CASE_ID), over)
const withStatus = (userId: string, capacities: Parameters<typeof facts>[1], status: MembershipStatus, over: Parameters<typeof facts>[2] = {}) =>
  facts(userId, capacities, { memberships: [membership(userId, capacities, { status })], ...over })

const SCENARIOS: Scenario[] = [
  {
    name: 'case: supervisory mandate',
    run: (s) => decide(caseRead(U.chief), withStatus(U.chief, ['chief_steward'], s, { mandates: [mandate({ scope: { resourceIds: [CASE_ID] } })] }), caseFacts(), NOW),
    expectOnRevoked: 'NOT_AN_ACTIVE_MEMBER',
  },
  {
    name: 'case: emergency-access mandate',
    run: (s) =>
      decide(
        caseRead(U.steward),
        withStatus(U.steward, ['steward'], s, {
          mandates: [mandate({ id: '00000000-0000-4000-8000-0000000a9001', principalUserId: U.steward, kind: 'emergency_access', powers: ['read'], scope: { resourceIds: [CASE_ID] }, justification: 'urgent safety matter', approvedBy: U.other, effectiveAt: ago(1000), expiresAt: ahead(1000) })],
        }),
        caseFacts(),
        NOW,
      ),
    expectOnRevoked: 'NOT_AN_ACTIVE_MEMBER',
  },
  {
    name: 'case: assignee relationship (case assignment)',
    run: (s) => decide(caseRead(U.steward), withStatus(U.steward, ['steward'], s, { relationships: [relationship()] }), caseFacts(), NOW),
    expectOnRevoked: 'NOT_AN_ACTIVE_MEMBER',
  },
  {
    name: 'case: creator relationship (own case)',
    run: (s) => decide(caseRead(U.member), withStatus(U.member, ['member'], s, { relationships: [relationship({ principalUserId: U.member, relation: 'creator' })] }), caseFacts(), NOW),
    expectOnRevoked: 'NOT_AN_ACTIVE_MEMBER',
  },
  {
    name: 'case: own submission (verified document)',
    run: (s) =>
      decide(
        request(U.member, 'case:read_own_submission', ref('case', CASE_ID)),
        withStatus(U.member, ['member'], s, { relationships: [relationship({ principalUserId: U.member, relation: 'creator' })] }),
        caseFacts({ requestedDocumentIsPrincipalsOwnSubmission: true }),
        NOW,
      ),
    expectOnRevoked: 'NOT_AN_ACTIVE_MEMBER',
  },
  {
    name: 'case: executive delegation (holder revoked)',
    run: (s) =>
      decide(
        caseRead(U.delegate, { delegationId: delegation().id }),
        facts(U.delegate, ['officer'], {
          memberships: [membership(U.delegate, ['officer'], { status: s }), membership(U.president, ['executive'])],
          delegations: [delegation({ actions: ['case:read'], resourceTypes: ['case'] })],
          mandates: [office(U.president, ['read'])],
        }),
        caseFacts(),
        NOW,
      ),
    expectOnRevoked: 'NOT_AN_ACTIVE_MEMBER',
  },
  {
    name: 'finance: financial mandate',
    run: (s) =>
      decide(
        request(U.treasurer, 'finance:view', ref('financial_transaction', TX_ID)),
        withStatus(U.treasurer, ['financial_officer'], s, {
          mandates: [mandate({ id: '00000000-0000-4000-8000-0000000c1001', principalUserId: U.treasurer, kind: 'financial', powers: ['view'], scope: { accountIds: [ACCT] }, monetaryLimitMinor: 100_000, currency: 'CAD', grantedBy: U.president })],
        }),
        { kind: 'financial_transaction', id: TX_ID, organizationId: ORG, accountId: ACCT, amountMinor: 50_000, currency: 'CAD', state: 'prepared', preparedBy: U.registrar, approvals: [], requiredApprovals: 2, executedBy: null, reconciledBy: null, adverseUserIds: [] },
        NOW,
      ),
    expectOnRevoked: 'NOT_AN_ACTIVE_MEMBER',
  },
  {
    name: 'governance: office mandate approving a request',
    run: (s) => decide(request(U.president, 'governance:approve', ref('approval_request', APPROVAL_ID)), withStatus(U.president, ['executive'], s, { mandates: [office(U.president)] }), approval(), NOW),
    expectOnRevoked: 'NOT_AN_ACTIVE_MEMBER',
  },
  {
    name: 'governance: named approver',
    run: (s) => decide(request(U.treasurer, 'governance:approve', ref('approval_request', APPROVAL_ID)), withStatus(U.treasurer, ['executive'], s), approval({ namedApproverIds: [U.treasurer] }), NOW),
    expectOnRevoked: 'NOT_AN_ACTIVE_MEMBER',
  },
  {
    name: 'governance: delegation (delegate revoked)',
    run: (s) =>
      decide(
        request(U.delegate, 'governance:approve', ref('approval_request', APPROVAL_ID), { delegationId: delegation().id }),
        facts(U.delegate, ['officer'], { memberships: [membership(U.delegate, ['officer'], { status: s }), membership(U.president, ['executive'])], delegations: [delegation()], mandates: [office(U.president)] }),
        approval(),
        NOW,
      ),
    expectOnRevoked: 'NOT_AN_ACTIVE_MEMBER',
  },
  {
    name: 'governance review: review mandate',
    run: (s) =>
      decide(
        request(U.reviewer, 'review:monitor', ref('governance_review', REVIEW_ID)),
        withStatus(U.reviewer, ['governance_reviewer'], s, {
          mandates: [mandate({ id: '00000000-0000-4000-8000-0000000b1001', principalUserId: U.reviewer, kind: 'governance_review', powers: ['monitor'], scope: { resourceIds: [REVIEW_ID] }, grantedBy: U.other, sourceInstrument: 'Constitution art. 22 appointment' })],
        }),
        review,
        NOW,
      ),
    expectOnRevoked: 'NOT_AN_ACTIVE_MEMBER',
  },
  {
    name: 'WorkAid: referral by a case handler with member consent',
    run: (s) =>
      decide(
        request(U.steward, 'workaid:refer', ref('workaid_matter', MATTER_ID), { categories: ['case_summary'] }),
        withStatus(U.steward, ['steward'], s, { relationships: [relationship()], consents: [consent()] }),
        matter,
        NOW,
      ),
    expectOnRevoked: 'NOT_AN_ACTIVE_MEMBER',
  },
]

describe('every kernel policy family: a live subordinate record never outlives the holder’s active membership', () => {
  it.each(SCENARIOS)('$name: allowed while active (positive control)', ({ run }) => {
    expect(run('active').effect).toBe('allow')
  })

  for (const status of NOT_ACTIVE) {
    it.each(SCENARIOS)(`$name: denied once the membership is ${status}`, ({ run, expectOnRevoked }) => {
      const decision = run(status)
      expect(decision.effect).toBe('deny')
      expect(codes(decision)).toContain(expectOnRevoked)
    })
  }

  it('a delegation also dies with the DELEGATOR’s membership (case and governance)', () => {
    for (const status of NOT_ACTIVE) {
      const asCase = decide(
        caseRead(U.delegate, { delegationId: delegation().id }),
        facts(U.delegate, ['officer'], {
          memberships: [membership(U.delegate, ['officer']), membership(U.president, ['executive'], { status })],
          delegations: [delegation({ actions: ['case:read'], resourceTypes: ['case'] })],
          mandates: [office(U.president, ['read'])],
        }),
        caseFacts(),
        NOW,
      )
      expect(asCase.effect, `case/${status}`).toBe('deny')
      expect(codes(asCase)).toContain('DELEGATION_INVALID')
      const asApproval = decide(
        request(U.delegate, 'governance:approve', ref('approval_request', APPROVAL_ID), { delegationId: delegation().id }),
        facts(U.delegate, ['officer'], { memberships: [membership(U.delegate, ['officer']), membership(U.president, ['executive'], { status })], delegations: [delegation()], mandates: [office(U.president)] }),
        approval(),
        NOW,
      )
      expect(asApproval.effect, `governance/${status}`).toBe('deny')
      expect(codes(asApproval)).toContain('DELEGATION_INVALID')
    }
  })

  it('a missing membership (loader returned no row) and a foreign-organization membership both deny', () => {
    const noRow = decide(caseRead(U.steward), facts(U.steward, ['steward'], { memberships: [], relationships: [relationship()] }), caseFacts(), NOW)
    expect(codes(noRow)).toContain('NOT_AN_ACTIVE_MEMBER')
    const foreign = decide(
      caseRead(U.steward),
      facts(U.steward, ['steward'], { memberships: [membership(U.steward, ['steward'], { organizationId: '00000000-0000-4000-8000-00000000000b' })], relationships: [relationship()] }),
      caseFacts(),
      NOW,
    )
    expect(codes(foreign)).toContain('NOT_AN_ACTIVE_MEMBER')
  })
})
