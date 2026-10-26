import { describe, expect, it } from 'vitest'
import { decide } from '../kernel'
import type { MessageThreadFacts } from '../ontology'
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
