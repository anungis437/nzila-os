import { describe, expect, it } from 'vitest'
import { decide } from '../kernel'
import { actionForClass, classifyDocument, DEFAULT_DOCUMENT_CLASS_POLICY, type ClassifiableDocument } from '../document-class'
import type { Decision, ReasonCode } from '../ontology'
import { CASE_ID, NOW, U, UNIT_ID, caseFacts, facts, mandate, ref, relationship, request } from './fixtures'

const codes = (d: Decision): ReasonCode[] => d.reasons.map((r) => r.code)
const askThirdParty = (userId: string) => request(userId, 'case:read_third_party_restricted', ref('case', CASE_ID))

describe('case:read_third_party_restricted — narrower than the internal file', () => {
  it('a primary owner or assignee with a representation capacity reads it', () => {
    for (const relation of ['owner', 'assignee'] as const) {
      const f = facts(U.steward, ['steward'], { relationships: [relationship({ relation })] })
      expect(decide(askThirdParty(U.steward), f, caseFacts(), NOW).effect, relation).toBe('allow')
    }
  })

  it('the internal-file scope does not reach it: a collaborator needs the permission granted explicitly and by name', () => {
    const rel = (permissions: string[]) => relationship({ relation: 'collaborator', origin: 'explicit', grantedBy: U.chief, permissions })
    for (const permissions of [['read'], ['read', 'read_internal'], ['read', 'read_internal', 'write_notes']]) {
      const f = facts(U.steward, ['steward'], { relationships: [rel(permissions)] })
      expect(decide(askThirdParty(U.steward), f, caseFacts(), NOW).effect, permissions.join(',')).toBe('deny')
    }
    const named = facts(U.steward, ['steward'], { relationships: [rel(['read', 'read_third_party_restricted'])] })
    const d = decide(askThirdParty(U.steward), named, caseFacts(), NOW)
    expect(d.effect).toBe('allow')
    expect(d.scope.visibility).toBe('internal')
  })

  it('a self-granted or capacity-less collaborator never reaches it', () => {
    const self = relationship({ relation: 'collaborator', origin: 'explicit', grantedBy: U.steward, permissions: ['read_third_party_restricted'] })
    expect(decide(askThirdParty(U.steward), facts(U.steward, ['steward'], { relationships: [self] }), caseFacts(), NOW).effect).toBe('deny')
    const registrar = relationship({ principalUserId: U.member, relation: 'collaborator', origin: 'explicit', grantedBy: U.chief, permissions: ['read_third_party_restricted'] })
    expect(decide(askThirdParty(U.member), facts(U.member, ['member'], { relationships: [registrar] }), caseFacts(), NOW).effect).toBe('deny')
  })

  it('a supervisory mandate reaches it only when the power is named; seniority and the internal-read power never do', () => {
    const scope = { unitIds: [UNIT_ID] }
    const ask = (powers: string[]) => decide(askThirdParty(U.chief), facts(U.chief, ['chief_steward'], { mandates: [mandate({ powers, scope })] }), caseFacts(), NOW)
    expect(ask(['read', 'read_internal']).effect).toBe('deny')
    expect(ask(['read', 'read_internal', 'read_third_party_restricted']).effect).toBe('allow')
    const exec = facts(U.president, ['executive'])
    expect(decide(askThirdParty(U.president), exec, caseFacts(), NOW).effect).toBe('deny')
  })

  it('the creator and the represented member never read it by that relationship, and a privileged case stays closed', () => {
    const creator = relationship({ principalUserId: U.member, relation: 'creator' })
    expect(decide(askThirdParty(U.member), facts(U.member, ['member'], { relationships: [creator] }), caseFacts(), NOW).effect).toBe('deny')
    const owner = facts(U.steward, ['steward'], { relationships: [relationship({ relation: 'owner' })] })
    const d = decide(askThirdParty(U.steward), owner, caseFacts({ classification: 'privileged' }), NOW)
    expect(d.effect).toBe('deny')
    expect(codes(d)).toContain('PRIVILEGED_MATTER')
  })
})

describe('document classification policy', () => {
  const doc = (over: Partial<ClassifiableDocument> = {}): ClassifiableDocument => ({ uploadedBy: 'user_x', label: 'team_confidential', containsLegalPrivilege: false, thirdPartySensitive: false, ...over })
  const cls = (d: ClassifiableDocument, reader = 'someone') => classifyDocument(d, reader)

  it('the provisional default is unapproved and releases nothing to a member by label', () => {
    expect(DEFAULT_DOCUMENT_CLASS_POLICY.approvedBy).toBeNull()
    expect(DEFAULT_DOCUMENT_CLASS_POLICY.memberDisclosableLabels).toEqual([])
    expect(cls(doc({ label: 'public_internal' }))).toBe('union_working')
    expect(actionForClass(cls(doc({ label: 'public_internal' })))).toBe('case:read_internal')
  })

  it('maps each class to exactly one action, from most to least protected', () => {
    expect(cls(doc({ containsLegalPrivilege: true, thirdPartySensitive: true }))).toBe('privileged')
    expect(cls(doc({ label: 'highly_sensitive' }))).toBe('privileged')
    expect(cls(doc({ label: 'case_restricted' }))).toBe('third_party_restricted')
    expect(cls(doc({ thirdPartySensitive: true }))).toBe('third_party_restricted')
    expect(cls(doc({ label: 'lro_confidential' }))).toBe('union_restricted')
    expect(cls(doc({ label: 'team_confidential' }))).toBe('union_working')
    expect(cls(doc({ label: null }))).toBe('union_working')
    expect(cls(doc({ label: 'never_heard_of_it' }))).toBe('union_working')
    expect(actionForClass('counsel_controlled')).toBeNull()
    expect(actionForClass('third_party_restricted')).toBe('case:read_third_party_restricted')
    expect(actionForClass('privileged')).toBe('case:read_privileged')
    expect(actionForClass('member_submission')).toBe('case:read_own_submission')
  })

  it('own authorship is the reader\'s own submission unless privileged; it never makes anyone else\'s document theirs', () => {
    expect(cls(doc({ uploadedBy: 'me', thirdPartySensitive: true }), 'me')).toBe('member_submission')
    expect(cls(doc({ uploadedBy: 'me', containsLegalPrivilege: true }), 'me')).toBe('privileged')
    expect(cls(doc({ uploadedBy: 'me', thirdPartySensitive: true }), 'you')).toBe('third_party_restricted')
    expect(cls(doc({ uploadedBy: null }), '')).toBe('union_working')
  })

  it('an institution-adopted policy can release a named label, and only that', () => {
    const adopted = { ...DEFAULT_DOCUMENT_CLASS_POLICY, version: 'adopted', approvedBy: 'Board resolution 14', memberDisclosableLabels: ['public_internal'] }
    expect(classifyDocument(doc({ label: 'public_internal' }), 'r', adopted)).toBe('member_disclosable')
    expect(classifyDocument(doc({ label: 'team_confidential' }), 'r', adopted)).toBe('union_working')
    expect(classifyDocument(doc({ label: 'public_internal', thirdPartySensitive: true }), 'r', adopted)).toBe('third_party_restricted')
  })
})
