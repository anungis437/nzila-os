import { describe, expect, it } from 'vitest'
import { decide } from '../kernel'
import type { Decision, ReasonCode } from '../ontology'
import { CASE_ID, NOW, U, caseFacts, facts, mandate, recusal, ref, relationship, request } from './fixtures'

const codes = (d: Decision): ReasonCode[] => d.reasons.map((r) => r.code)
const own = (userId: string) => request(userId, 'case:read_own_submission', ref('case', CASE_ID), { documentId: '00000000-0000-4000-8000-00000000d0c1' })
const creator = (over = {}) => relationship({ principalUserId: U.member, relation: 'creator', ...over })
const verified = (over = {}) => caseFacts({ requestedDocumentIsPrincipalsOwnSubmission: true, ...over })

describe('case:read_own_submission — the member\'s own submissions are a separate information domain', () => {
  it('allows the creator when the loader proved authorship, even on a privileged case', () => {
    const f = facts(U.member, ['member'], { relationships: [creator()] })
    expect(decide(own(U.member), f, verified(), NOW)).toMatchObject({ effect: 'allow', scope: { visibility: 'member_visible' } })
    const priv = decide(own(U.member), f, verified({ classification: 'privileged' }), NOW)
    expect(priv.effect).toBe('allow')
    expect(priv.reasons.map((r) => r.code)).toContain('ALLOWED_AS_SUBJECT')
  })

  it('denies when the loader did not prove authorship (absent or false)', () => {
    const f = facts(U.member, ['member'], { relationships: [creator()] })
    expect(decide(own(U.member), f, caseFacts(), NOW).effect).toBe('deny')
    expect(decide(own(U.member), f, caseFacts({ requestedDocumentIsPrincipalsOwnSubmission: false }), NOW).effect).toBe('deny')
  })

  it('denies without a live creator / represented-member relationship: collaborators, owners and mandate holders cannot use it', () => {
    for (const rel of [relationship({ principalUserId: U.steward, relation: 'assignee' }), relationship({ principalUserId: U.steward, relation: 'owner' })]) {
      expect(decide(own(U.steward), facts(U.steward, ['steward'], { relationships: [rel] }), verified(), NOW).effect).toBe('deny')
    }
    const chief = facts(U.chief, ['chief_steward'], { mandates: [mandate({ powers: ['read', 'read_internal', 'read_own_submission'] })] })
    expect(decide(own(U.chief), chief, verified(), NOW).effect).toBe('deny')
    expect(decide(own(U.member), facts(U.member, ['member']), verified(), NOW).effect).toBe('deny')
  })

  it('never survives expiry, revocation, a recusal, an adverse-party finding or a foreign tenant', () => {
    const base = (rel = creator()) => facts(U.member, ['member'], { relationships: [rel] })
    expect(decide(own(U.member), base(creator({ status: 'revoked' })), verified(), NOW).effect).toBe('deny')
    expect(decide(own(U.member), base(creator({ expiresAt: new Date(NOW.getTime() - 1000) })), verified(), NOW).effect).toBe('deny')
    const recused = facts(U.member, ['member'], { relationships: [creator()], recusals: [recusal({ principalUserId: U.member })] })
    expect(codes(decide(own(U.member), recused, verified(), NOW))).toContain('RECUSED')
    expect(codes(decide(own(U.member), base(), verified({ adverseUserIds: [U.member] }), NOW))).toContain('ADVERSE_PARTY')
    const suspended = facts(U.member, ['member'], { relationships: [creator()] })
    suspended.memberships[0].status = 'suspended'
    expect(decide(own(U.member), suspended, verified(), NOW).effect).toBe('deny')
  })

  it('is not counsel material: it grants no privileged read and does not change case:read_privileged', () => {
    const f = facts(U.member, ['member'], { relationships: [creator()] })
    expect(decide(request(U.member, 'case:read_privileged', ref('case', CASE_ID)), f, verified({ classification: 'privileged' }), NOW).effect).toBe('deny')
    expect(decide(request(U.member, 'case:read_internal', ref('case', CASE_ID)), f, verified(), NOW).effect).toBe('deny')
  })
})
