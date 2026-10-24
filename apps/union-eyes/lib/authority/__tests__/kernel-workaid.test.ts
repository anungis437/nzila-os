import { describe, expect, it } from 'vitest'
import { decide } from '../kernel'
import type { Decision, ReasonCode, WorkAidMatterFacts } from '../ontology'
import { CASE_ID, DAY, MATTER_ID, NOW, ORG, ORG_B, U, ago, ahead, consent, delegation, facts, mandate, ref, relationship, request } from './fixtures'

const codes = (d: Decision): ReasonCode[] => d.reasons.map((r) => r.code)

const matter = (over: Partial<WorkAidMatterFacts> = {}): WorkAidMatterFacts => ({
  kind: 'workaid_matter', id: MATTER_ID, organizationId: ORG, memberUserId: U.member, caseId: CASE_ID, counselControlled: true, ...over,
})
const act = (userId: string, action: Parameters<typeof request>[1], f: ReturnType<typeof facts>, over = {}, m = matter()) =>
  decide(request(userId, action, ref('workaid_matter', MATTER_ID), over), f, m, NOW)
const handler = (over: Partial<Parameters<typeof facts>[2]> = {}) =>
  facts(U.steward, ['steward'], { relationships: [relationship()], consents: [consent()], ...over })
const refer = (f = handler(), categories: string[] = ['case_summary'], m = matter()) => act(U.steward, 'workaid:refer', f, { categories }, m)

describe('WorkAid boundary — counsel-controlled material is never union-readable', () => {
  const everything = facts(U.president, ['executive', 'officer', 'financial_officer'], {
    mandates: [
      mandate({ principalUserId: U.president, kind: 'supervisory', powers: ['read', 'read_internal', 'read_privileged'] }),
      mandate({ id: '00000000-0000-4000-8000-0000000a9001', principalUserId: U.president, kind: 'emergency_access', powers: ['read'], scope: { resourceIds: [MATTER_ID] }, justification: 'urgent safety matter, counsel unreachable', approvedBy: U.other, effectiveAt: ago(1000), expiresAt: ahead(1000) }),
    ],
    delegations: [delegation({ actions: ['workaid:read_counsel_material'], resourceTypes: ['workaid_matter'] })],
    consents: [consent({ direction: 'workaid_to_union', issuer: 'counsel', recipientUserId: U.president })],
  })

  it('is denied to every union principal, whatever authority they hold', () => {
    for (const userId of [U.president, U.steward, U.chief, U.treasurer, U.admin, U.clc, U.platform, U.member]) {
      const d = act(userId, 'workaid:read_counsel_material', { ...everything, principal: { userId, authenticated: true } })
      expect(d.effect).toBe('deny')
      expect(codes(d)).toContain('COUNSEL_CONTROLLED')
    }
  })

  it('is denied even with a delegation, mandate, emergency grant and counsel disclosure on file', () => {
    const d = act(U.president, 'workaid:read_counsel_material', everything, { delegationId: delegation().id })
    expect(codes(d)).toEqual(['COUNSEL_CONTROLLED'])
  })

  it('is denied even in another tenant or without resource facts (no facts needed, no override)', () => {
    const d = decide(request(U.president, 'workaid:read_counsel_material', ref('workaid_matter', MATTER_ID, ORG_B)), everything, null, NOW)
    expect(codes(d)).toContain('COUNSEL_CONTROLLED')
  })
})

describe('WorkAid referral (union → WorkAid) needs relationship AND member consent', () => {
  it('allows with an owner/assignee relationship and live member consent covering the categories', () => {
    const d = refer()
    expect(d.effect).toBe('allow')
    expect(d.scope.categories).toEqual(['case_summary'])
    expect(d.obligations).toContain('acknowledgement_expected')
    expect(d.authority.map((a) => a.kind)).toEqual(['relationship', 'consent'])
  })

  it('no consent → denied', () => expect(codes(refer(handler({ consents: [] })))).toContain('CONSENT_REQUIRED'))

  it('revoked or expired consent → denied (revocation stops sharing)', () => {
    expect(codes(refer(handler({ consents: [consent({ revokedAt: ago(1) })] })))).toContain('CONSENT_REQUIRED')
    expect(codes(refer(handler({ consents: [consent({ expiresAt: ago(1) })] })))).toContain('CONSENT_REQUIRED')
  })

  it('consent not issued by the member (e.g. union- or counsel-issued) is ignored', () => {
    expect(codes(refer(handler({ consents: [consent({ issuer: 'counsel' })] })))).toContain('CONSENT_REQUIRED')
  })

  it('consent for a different member or matter is ignored', () => {
    expect(codes(refer(handler({ consents: [consent({ memberUserId: U.other })] })))).toContain('CONSENT_REQUIRED')
    expect(codes(refer(handler({ consents: [consent({ matterId: '00000000-0000-4000-8000-0000000fffff' })] })))).toContain('CONSENT_REQUIRED')
  })

  it('every requested category must be consented: medical needs explicit consent, no wildcard', () => {
    expect(codes(refer(handler(), ['case_summary', 'medical']))).toContain('CONSENT_SCOPE_EXCEEDED')
    expect(refer(handler({ consents: [consent({ categories: ['case_summary', 'medical'] })] }), ['case_summary', 'medical']).effect).toBe('allow')
    expect(codes(refer(handler({ consents: [consent({ categories: ['*'] })] }), ['medical']))).toContain('CONSENT_SCOPE_EXCEEDED')
    expect(codes(refer(handler(), ['*']))).toContain('CONSENT_SCOPE_EXCEEDED')
    expect(codes(refer(handler(), []))).toContain('CONSENT_SCOPE_EXCEEDED')
  })

  it('consent in the wrong direction does not authorize a referral', () => {
    expect(codes(refer(handler({ consents: [consent({ direction: 'workaid_to_union' })] })))).toContain('CONSENT_REQUIRED')
  })

  it('without a relationship to the underlying case, consent alone is not enough', () => {
    expect(codes(refer(handler({ relationships: [] })))).toContain('NO_SOURCE_OF_AUTHORITY')
  })

  it('a collaborator or unrelated steward cannot refer', () => {
    const collab = relationship({ relation: 'collaborator', origin: 'explicit', grantedBy: U.chief, permissions: ['read'] })
    expect(refer(handler({ relationships: [collab] })).effect).toBe('deny')
  })

  it('a member cannot refer on the union\'s behalf (no representation capacity)', () => {
    const f = facts(U.member, ['member'], { relationships: [relationship({ principalUserId: U.member })], consents: [consent()] })
    expect(codes(act(U.member, 'workaid:refer', f, { categories: ['case_summary'] }))).toContain('CAPACITY_NOT_ELIGIBLE')
  })

  it('a supervisory mandate does not authorize a referral', () => {
    const f = facts(U.chief, ['chief_steward'], { mandates: [mandate()], consents: [consent()] })
    expect(act(U.chief, 'workaid:refer', f, { categories: ['case_summary'] }).effect).toBe('deny')
  })

  it('is not delegable and FOREIGN TENANT is denied', () => {
    expect(codes(act(U.steward, 'workaid:refer', handler(), { categories: ['case_summary'], delegationId: '00000000-0000-4000-8000-000000000950' }))).toContain('DELEGATION_INVALID')
    const d = decide(request(U.steward, 'workaid:refer', ref('workaid_matter', MATTER_ID, ORG_B), { categories: ['case_summary'] }), handler(), matter({ organizationId: ORG_B }), NOW)
    expect(codes(d)).toContain('FOREIGN_TENANT')
  })
})

describe('WorkAid disclosure (WorkAid → union) must be issued by counsel to a named recipient', () => {
  const disclosure = (over = {}) => consent({ id: '00000000-0000-4000-8000-0000000d0001', direction: 'workaid_to_union', issuer: 'counsel', recipientUserId: U.officer, categories: ['status_update'], purpose: 'strategy update', ...over })
  const recv = (over = {}, userId = U.officer, categories = ['status_update'], disclosureId = '00000000-0000-4000-8000-0000000d0001') =>
    act(userId, 'workaid:receive_disclosure', facts(userId, ['officer'], { consents: [disclosure(over)] }), { categories, disclosureId })

  it('allows the named recipient, limited to the disclosed categories', () => {
    const d = recv()
    expect(d.effect).toBe('allow')
    expect(d.scope.categories).toEqual(['status_update'])
    expect(d.obligations).toContain('read_only')
  })

  it('a union- or member-issued record can never open counsel material', () => {
    expect(codes(recv({ issuer: 'member' }))).toContain('DISCLOSURE_NOT_ISSUED_BY_COUNSEL')
  })

  it('revoked / expired disclosures are void', () => {
    expect(codes(recv({ revokedAt: ago(1) }))).toContain('INSTRUMENT_EXPIRED_OR_REVOKED')
    expect(codes(recv({ expiresAt: ago(1) }))).toContain('INSTRUMENT_EXPIRED_OR_REVOKED')
  })

  it('another principal cannot use someone else\'s disclosure', () => {
    expect(recv({}, U.president).effect).toBe('deny')
  })

  it('categories beyond the disclosure are refused', () => {
    expect(codes(recv({}, U.officer, ['status_update', 'medical']))).toContain('CONSENT_SCOPE_EXCEEDED')
  })

  it('unknown id, wrong direction or other matter → denied', () => {
    expect(recv({}, U.officer, ['status_update'], '00000000-0000-4000-8000-0000000fffff').effect).toBe('deny')
    expect(recv({ direction: 'union_to_workaid' }).effect).toBe('deny')
    expect(recv({ matterId: '00000000-0000-4000-8000-0000000fffff' }).effect).toBe('deny')
  })
})

void DAY
