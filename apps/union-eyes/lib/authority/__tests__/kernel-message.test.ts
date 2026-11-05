import { describe, expect, it } from 'vitest'
import { capacitiesForRole } from '../capacity'
import { decide } from '../kernel'
import type { Capacity, MessageRetentionFacts, MessageThreadFacts } from '../ontology'
import { NOW, ORG, U, facts, mandate, recusal, ref, request } from './fixtures'

const THREAD = '00000000-0000-4000-8000-000000000258'
const thread = (): MessageThreadFacts => ({
  kind: 'message_thread',
  id: THREAD,
  organizationId: ORG,
  memberUserId: U.member,
  assigneeUserId: U.steward,
  status: 'open',
})
const resource = ref('message_thread', THREAD)

function governed(userId: string, powers: readonly string[] = ['place_legal_hold', 'release_legal_hold'], scopeIds: readonly string[] = [THREAD]) {
  return facts(userId, ['member', 'governance_reviewer'], {
    mandates: [mandate({
      principalUserId: userId,
      kind: 'governance_review',
      powers: [...powers],
      scope: { resourceIds: [...scopeIds] },
    })],
  })
}

describe('conversation legal hold', () => {
  it('denies an organization administrator title with no governance mandate', () => {
    const admin = facts(U.admin, ['member'])
    const decision = decide(request(U.admin, 'message:place_legal_hold', resource), admin, thread(), NOW)
    expect(decision.effect).toBe('deny')
    expect(decision.reasons.map((reason) => reason.code)).toContain('CAPACITY_NOT_ELIGIBLE')
  })

  it('denies the conversation member and the assignee', () => {
    for (const userId of [U.member, U.steward]) {
      const decision = decide(request(userId, 'message:place_legal_hold', resource), facts(userId, ['member', 'steward']), thread(), NOW)
      expect(decision.effect).toBe('deny')
    }
  })

  it('allows place and release only when the mandate names this conversation and that action', () => {
    const holder = governed(U.reviewer)
    expect(decide(request(U.reviewer, 'message:place_legal_hold', resource), holder, thread(), NOW).effect).toBe('allow')
    expect(decide(request(U.reviewer, 'message:release_legal_hold', resource), holder, thread(), NOW).effect).toBe('allow')
    const placeOnly = governed(U.reviewer, ['place_legal_hold'])
    expect(decide(request(U.reviewer, 'message:release_legal_hold', resource), placeOnly, thread(), NOW).effect).toBe('deny')
  })

  it('denies a mandate that names a different conversation, a revoked mandate, and a delegation', () => {
    const other = governed(U.reviewer, ['place_legal_hold'], ['00000000-0000-4000-8000-000000000259'])
    expect(decide(request(U.reviewer, 'message:place_legal_hold', resource), other, thread(), NOW).reasons.map((reason) => reason.code)).toContain('OUT_OF_SCOPE')
    const revoked = governed(U.reviewer)
    revoked.mandates[0].status = 'revoked'
    expect(decide(request(U.reviewer, 'message:place_legal_hold', resource), revoked, thread(), NOW).effect).toBe('deny')
    const delegated = decide(
      request(U.reviewer, 'message:place_legal_hold', resource, { delegationId: '00000000-0000-4000-8000-000000000260' }),
      governed(U.reviewer),
      thread(),
      NOW,
    )
    expect(delegated.reasons.map((reason) => reason.code)).toContain('DELEGATION_INVALID')
  })

  it('denies a recused holder even when the mandate is live', () => {
    const holder = governed(U.reviewer)
    holder.recusals = [recusal({ principalUserId: U.reviewer, resource })]
    expect(decide(request(U.reviewer, 'message:place_legal_hold', resource), holder, thread(), NOW).reasons.map((reason) => reason.code)).toContain('RECUSED')
  })
})

describe('conversation participation', () => {
  const read = (userId: string, capacities: readonly Capacity[] = ['member']) =>
    decide(request(userId, 'message:read', resource), facts(userId, [...capacities]), thread(), NOW)

  it('lets the member and an eligible assignee read, reply, close, and archive, and denies everyone else', () => {
    expect(read(U.member).effect).toBe('allow')
    expect(read(U.member).authority[0]).toMatchObject({ kind: 'subject', instrument: 'member of this conversation' })
    const assignee = read(U.steward, capacitiesForRole('steward'))
    expect(assignee.effect).toBe('allow')
    expect(assignee.authority[0]).toMatchObject({ kind: 'relationship', instrument: 'assignee of this conversation' })
    for (const action of ['message:reply', 'message:close', 'message:archive'] as const) {
      expect(decide(request(U.member, action, resource), facts(U.member, ['member']), thread(), NOW).effect).toBe('allow')
      expect(decide(request(U.steward, action, resource), facts(U.steward, [...capacitiesForRole('health_safety_rep')]), thread(), NOW).effect).toBe('allow')
    }
    expect(read(U.other).effect).toBe('deny')
  })

  it('denies an administrator title, an unknown role, and a national officer even when they are the assignee', () => {
    const assigned = (): MessageThreadFacts => ({ ...thread(), assigneeUserId: U.admin })
    for (const role of ['admin', 'union_rep', 'national_officer', 'business_agent']) {
      const decision = decide(request(U.admin, 'message:read', resource), facts(U.admin, [...capacitiesForRole(role)]), assigned(), NOW)
      expect(decision.effect, role).toBe('deny')
      expect(decision.reasons.map((reason) => reason.code)).toContain(role === 'admin' ? 'CAPACITY_NOT_ELIGIBLE' : 'CAPACITY_NOT_ELIGIBLE')
    }
  })

  it('does not let a legal-hold mandate read the conversation, and refuses a delegation', () => {
    const holder = governed(U.reviewer)
    expect(decide(request(U.reviewer, 'message:place_legal_hold', resource), holder, thread(), NOW).effect).toBe('allow')
    expect(decide(request(U.reviewer, 'message:read', resource), holder, thread(), NOW).reasons.map((reason) => reason.code)).toContain('NO_SOURCE_OF_AUTHORITY')
    const delegated = decide(
      request(U.member, 'message:read', resource, { delegationId: '00000000-0000-4000-8000-000000000261' }),
      facts(U.member, ['member']),
      thread(),
      NOW,
    )
    expect(delegated.reasons.map((reason) => reason.code)).toContain('DELEGATION_INVALID')
  })

  it('allows a read of a closed conversation and refuses a reply', () => {
    const closed = (): MessageThreadFacts => ({ ...thread(), status: 'closed' })
    expect(decide(request(U.member, 'message:read', resource), facts(U.member, ['member']), closed(), NOW).effect).toBe('allow')
    expect(decide(request(U.member, 'message:reply', resource), facts(U.member, ['member']), closed(), NOW).reasons.map((reason) => reason.code)).toContain('ACTION_NOT_COVERED')
  })

  it('denies a recused participant and a principal with no membership', () => {
    const member = facts(U.member, ['member'])
    member.recusals = [recusal({ principalUserId: U.member, resource })]
    expect(decide(request(U.member, 'message:read', resource), member, thread(), NOW).reasons.map((reason) => reason.code)).toContain('RECUSED')
    const absent = facts(U.member, ['member'], { memberships: [] })
    expect(decide(request(U.member, 'message:read', resource), absent, thread(), NOW).reasons.map((reason) => reason.code)).toContain('NOT_AN_ACTIVE_MEMBER')
  })
})

const retention = (): MessageRetentionFacts => ({ kind: 'message_retention', id: ORG, organizationId: ORG })
const retentionResource = ref('message_retention', ORG)

describe('conversation retention record', () => {
  it('denies an administrator title and allows only a mandate that names this organization and the action', () => {
    const admin = facts(U.admin, ['member'])
    expect(decide(request(U.admin, 'message:adopt_retention', retentionResource), admin, retention(), NOW).reasons.map((r) => r.code)).toContain('CAPACITY_NOT_ELIGIBLE')
    const holder = governed(U.reviewer, ['adopt_retention', 'read_retention_policy'], [ORG])
    expect(decide(request(U.reviewer, 'message:adopt_retention', retentionResource), holder, retention(), NOW).effect).toBe('allow')
    expect(decide(request(U.reviewer, 'message:read_retention_policy', retentionResource), holder, retention(), NOW).effect).toBe('allow')
    const readOnly = governed(U.reviewer, ['read_retention_policy'], [ORG])
    expect(decide(request(U.reviewer, 'message:adopt_retention', retentionResource), readOnly, retention(), NOW).effect).toBe('deny')
    const otherOrg = governed(U.reviewer, ['adopt_retention'], ['00000000-0000-4000-8000-000000000259'])
    expect(decide(request(U.reviewer, 'message:adopt_retention', retentionResource), otherOrg, retention(), NOW).reasons.map((r) => r.code)).toContain('OUT_OF_SCOPE')
  })
})
