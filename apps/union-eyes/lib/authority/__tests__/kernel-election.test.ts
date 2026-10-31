import { describe, expect, it } from 'vitest'
import { decide } from '../kernel'
import type { ApprovalRequestFacts, CouncilElectionFacts } from '../ontology'
import { NOW, ORG, ORG_B, U, ago, DAY, facts, mandate, ref, request } from './fixtures'

const ELECTION = '00000000-0000-4000-8000-000000000777'
const election = (over: Partial<CouncilElectionFacts> = {}): CouncilElectionFacts => ({
  kind: 'council_election',
  id: ELECTION,
  organizationId: ORG,
  certified: true,
  namedUserIds: [],
  ...over,
})
const resource = ref('council_election', ELECTION)

function governed(over: Parameters<typeof mandate>[0] = {}) {
  return facts(U.reviewer, ['governance_reviewer'], {
    mandates: [
      mandate({
        principalUserId: U.reviewer,
        kind: 'governance_review',
        powers: ['supersede_certified_result'],
        scope: { resourceIds: [ELECTION] },
        grantedBy: U.president,
        approvedBy: U.officer,
        sourceInstrument: 'Council minute 14',
        ...over,
      }),
    ],
  })
}

describe('certified election supersession', () => {
  it('allows a live governance mandate that names this election and a distinct reviewer', () => {
    const decision = decide(request(U.reviewer, 'governance:supersede_certified_result', resource), governed(), election(), NOW)
    expect(decision.effect).toBe('allow')
    expect(decision.authority[0]).toMatchObject({ kind: 'mandate' })
  })

  it('denies an executive capacity that holds no supersession mandate', () => {
    const decision = decide(
      request(U.president, 'governance:supersede_certified_result', resource),
      facts(U.president, ['executive']),
      election(),
      NOW,
    )
    expect(decision.effect).toBe('deny')
    expect(decision.reasons.map((reason) => reason.code)).toContain('NO_SOURCE_OF_AUTHORITY')
  })

  it('denies a mandate for a different election', () => {
    const decision = decide(
      request(U.reviewer, 'governance:supersede_certified_result', resource),
      governed({ scope: { resourceIds: [U.other] } }),
      election(),
      NOW,
    )
    expect(decision.reasons.map((reason) => reason.code)).toContain('OUT_OF_SCOPE')
  })

  it('denies a missing or self-approved reviewer', () => {
    for (const approvedBy of [null, U.reviewer, U.president]) {
      const decision = decide(
        request(U.reviewer, 'governance:supersede_certified_result', resource),
        governed({ approvedBy }),
        election(),
        NOW,
      )
      expect(decision.reasons.map((reason) => reason.code)).toContain('SEGREGATION_OF_DUTIES')
    }
  })

  it('refuses a delegation of certified-result supersession', () => {
    const decision = decide(
      request(U.reviewer, 'governance:supersede_certified_result', resource, { delegationId: U.other }),
      governed(),
      election(),
      NOW,
    )
    expect(decision.reasons.map((reason) => reason.code)).toContain('DELEGATION_INVALID')
  })

  it('refuses an uncertified election and a person named on the result', () => {
    expect(
      decide(request(U.reviewer, 'governance:supersede_certified_result', resource), governed(), election({ certified: false }), NOW).reasons.map((reason) => reason.code),
    ).toContain('STATE_NOT_ELIGIBLE')
    expect(
      decide(
        request(U.reviewer, 'governance:supersede_certified_result', resource),
        governed(),
        election({ namedUserIds: [U.reviewer] }),
        NOW,
      ).reasons.map((reason) => reason.code),
    ).toContain('ADVERSE_PARTY')
  })

  it('denies another organization before the policy runs', () => {
    const decision = decide(
      request(U.reviewer, 'governance:supersede_certified_result', resource, { organizationId: ORG_B }),
      governed(),
      election(),
      NOW,
    )
    expect(decision.reasons.map((reason) => reason.code)).toContain('FOREIGN_TENANT')
  })

  it('denies an expired or unaccepted mandate', () => {
    expect(
      decide(request(U.reviewer, 'governance:supersede_certified_result', resource), governed({ expiresAt: ago(DAY) }), election(), NOW).effect,
    ).toBe('deny')
    expect(
      decide(
        request(U.reviewer, 'governance:supersede_certified_result', resource),
        governed({ requiresAcceptance: true, acceptedAt: null }),
        election(),
        NOW,
      ).reasons.map((reason) => reason.code),
    ).toContain('NOT_ACCEPTED')
  })

  it('does not let governance approval supersede an election, or this action approve a request', () => {
    expect(
      decide(request(U.reviewer, 'governance:approve', resource), governed(), election(), NOW).reasons.map((reason) => reason.code),
    ).toContain('ACTION_NOT_COVERED')
    const approval = {
      kind: 'approval_request',
      id: ELECTION,
      organizationId: ORG,
      subjectType: 'mandate',
      subjectId: U.other,
      proposedBy: U.president,
      requiredApprovals: 1,
      status: 'open',
      namedApproverIds: [],
      eligibleCapacities: ['executive'],
      decisions: [],
      adverseUserIds: [],
      riskClass: 'low',
    } satisfies ApprovalRequestFacts
    expect(
      decide(request(U.reviewer, 'governance:supersede_certified_result', ref('approval_request', ELECTION)), governed(), approval, NOW).reasons.map((reason) => reason.code),
    ).toContain('ACTION_NOT_COVERED')
  })
})
