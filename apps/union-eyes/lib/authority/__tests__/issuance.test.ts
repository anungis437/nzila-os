import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ISSUANCE_TEMPLATES,
  decideIssuance,
  NON_DELEGABLE_ACTIONS,
  PLACEHOLDER_INSTRUMENT,
  type IssuanceRequest,
  type IssuanceRule,
} from '../issuance'
import type { Capacity } from '../ontology'
import { ahead, ago, CASE_ID, DAY, facts, HOUR, membership, mandate, NOW, ORG, ORG_B, ref, recusal, U } from './fixtures'

const rule = (over: Partial<IssuanceRule> = {}): IssuanceRule => ({
  id: '00000000-0000-4000-8000-0000000a0001', organizationId: ORG, domain: 'supervisory', operation: 'issue',
  issuerCapacities: ['officer', 'executive'], issuerMandateKind: null, issuerMandatePower: null,
  allowedPowers: ['read', 'assign', 'monitor'], maxTermDays: 365, requiresAcceptance: true, requiredIndependentApprovals: 0,
  version: 1, status: 'active', sourceInstrument: 'Bylaw 12.4', draftedBy: U.other, approvedBy: [U.president, U.treasurer], ...over,
})

const req = (over: Partial<IssuanceRequest> = {}): IssuanceRequest => ({
  issuerUserId: U.president, organizationId: ORG, domain: 'supervisory', operation: 'issue', holderUserId: U.chief,
  powers: ['read'], scope: { resourceIds: [CASE_ID] }, effectiveAt: ago(HOUR), expiresAt: ahead(30 * DAY), ...over,
})

const issuerFacts = (caps: Capacity[] = ['executive'], over = {}) => facts(U.president, caps, over)
const holder = (caps: Capacity[] = ['chief_steward', 'officer'], user = U.chief) => membership(user, caps)
const run = (r = req(), f = issuerFacts(), h = holder(), ru: IssuanceRule | null = rule()) => decideIssuance(r, f, h, ru, NOW)
const codes = (d: { reasons: readonly { code: string }[] }) => d.reasons.map((x) => x.code)

describe('issuance policy: a rule is the only source of issuing authority', () => {
  it('allows a conforming issuance and reports what the rule requires of the holder', () => {
    const d = run()
    expect(d.effect).toBe('allow')
    expect(d.requiresAcceptance).toBe(true)
    expect(d.ruleId).toBe(rule().id)
  })

  it('no rule, a draft, a retired rule, the placeholder source, one approver, or a self-approved rule all deny', () => {
    expect(codes(run(req(), issuerFacts(), holder(), null))).toContain('NO_ACTIVE_ISSUANCE_RULE')
    for (const bad of [
      rule({ status: 'draft' }), rule({ status: 'retired' }), rule({ sourceInstrument: PLACEHOLDER_INSTRUMENT }), rule({ sourceInstrument: '  ' }),
      rule({ approvedBy: [U.president] }), rule({ approvedBy: [U.president, U.president] }), rule({ approvedBy: [U.other, U.treasurer] }),
    ]) {
      expect(codes(run(req(), issuerFacts(), holder(), bad)), JSON.stringify(bad)).toContain('NO_ACTIVE_ISSUANCE_RULE')
    }
  })

  it('a rule for another domain, operation or organization never applies', () => {
    expect(codes(run(req(), issuerFacts(), holder(), rule({ domain: 'financial' })))).toContain('NO_ACTIVE_ISSUANCE_RULE')
    expect(codes(run(req(), issuerFacts(), holder(), rule({ operation: 'revoke' })))).toContain('NO_ACTIVE_ISSUANCE_RULE')
    expect(codes(run(req(), issuerFacts(), holder(), rule({ organizationId: ORG_B })))).toContain('FOREIGN_TENANT')
  })

  it('fails closed on identity: unauthenticated, mismatched principal, foreign-tenant facts, inactive or duplicate membership', () => {
    expect(codes(run(req(), { ...issuerFacts(), principal: { userId: U.president, authenticated: false } }))).toContain('PRINCIPAL_NOT_AUTHENTICATED')
    expect(codes(run(req({ issuerUserId: U.treasurer })))).toContain('PRINCIPAL_MISMATCH')
    expect(codes(run(req(), issuerFacts(['executive'], { memberships: [membership(U.president, ['executive']), { ...membership(U.other, ['member']), organizationId: ORG_B }] })))).toContain('FOREIGN_TENANT')
    expect(codes(run(req(), issuerFacts(['executive'], { memberships: [membership(U.president, ['executive'], { status: 'suspended' })] })))).toContain('NOT_AN_ACTIVE_MEMBER')
    expect(codes(run(req(), issuerFacts(['executive'], { memberships: [membership(U.president, ['executive']), membership(U.president, ['executive'])] })))).toContain('FACTS_CONTRADICTORY')
  })

  it('an internal failure is a denial, never an exception or an allow', () => {
    const d = run(req(), { ...issuerFacts(), memberships: null as never })
    expect(d.effect).toBe('deny')
    expect(codes(d)).toContain('FACTS_CONTRADICTORY')
  })
})

describe('issuance policy: separation of issuing from issued authority', () => {
  it('the issuer needs a capacity NAMED by the rule; holding the power themselves is irrelevant', () => {
    expect(codes(run(req(), issuerFacts(['member', 'steward'])))).toContain('CAPACITY_NOT_ELIGIBLE')
    const holdsThePower = issuerFacts(['steward'], { mandates: [mandate({ principalUserId: U.president, grantedBy: U.other, powers: ['read', 'assign'] })] })
    expect(codes(run(req(), holdsThePower))).toContain('CAPACITY_NOT_ELIGIBLE')
  })

  it('a rule may require the issuer to hold a live mandate (e.g. office holders delegate)', () => {
    const del = rule({ domain: 'delegation', issuerCapacities: ['executive'], issuerMandateKind: 'executive_office', issuerMandatePower: 'approve', allowedPowers: ['case:read'], maxTermDays: 90, requiredIndependentApprovals: 0 })
    const r = req({ domain: 'delegation', powers: ['case:read'], holderUserId: U.officer, scope: undefined })
    expect(codes(run(r, issuerFacts(), holder(['officer'], U.officer), del))).toContain('NO_SOURCE_OF_AUTHORITY')
    const office = mandate({ id: '00000000-0000-4000-8000-0000000b0001', principalUserId: U.president, kind: 'executive_office', powers: ['approve'], scope: {}, grantedBy: U.other })
    expect(run(r, issuerFacts(['executive'], { mandates: [office] }), holder(['officer'], U.officer), del).effect).toBe('allow')
    const expired = { ...office, expiresAt: ago(DAY) }
    expect(run(r, issuerFacts(['executive'], { mandates: [expired] }), holder(['officer'], U.officer), del).effect).toBe('deny')
  })

  it('nobody confers, amends, suspends or lifts authority for themselves; surrender (revoke) is allowed', () => {
    const self = (operation: IssuanceRequest['operation']) => run(req({ holderUserId: U.president, operation }), issuerFacts(['executive', 'officer']), holder(['executive'], U.president), rule({ operation, issuerCapacities: ['executive'] }))
    for (const op of ['issue', 'amend', 'suspend', 'lift'] as const) expect(codes(self(op)), op).toContain('SELF_APPROVAL')
    expect(self('revoke').effect).toBe('allow')
  })

  it('revoke and suspend need only the issuer eligibility, not holder eligibility or ceilings', () => {
    const d = run(req({ operation: 'revoke', holderUserId: U.stranger, powers: undefined, effectiveAt: undefined, expiresAt: undefined }), issuerFacts(), null, rule({ operation: 'revoke', allowedPowers: [], maxTermDays: null }))
    expect(d.effect).toBe('allow')
  })
})

describe('issuance policy: the holder, ceilings and approvals', () => {
  it('the holder must be an active member with a capacity eligible for the domain', () => {
    expect(codes(run(req(), issuerFacts(), null))).toContain('NOT_AN_ACTIVE_MEMBER')
    expect(codes(run(req(), issuerFacts(), membership(U.chief, ['chief_steward'], { status: 'suspended' })))).toContain('NOT_AN_ACTIVE_MEMBER')
    expect(codes(run(req(), issuerFacts(), membership(U.other, ['officer'])))).toContain('NOT_AN_ACTIVE_MEMBER') // wrong person
    expect(codes(run(req(), issuerFacts(), holder(['member'])))).toContain('CAPACITY_NOT_ELIGIBLE')
  })

  it('powers, term and dates stay within the rule', () => {
    expect(codes(run(req({ powers: ['read', 'enforce'] })))).toContain('EXCEEDS_RULE_CEILING')
    expect(codes(run(req({ expiresAt: ahead(366 * DAY) })))).toContain('EXCEEDS_RULE_CEILING')
    expect(run(req({ expiresAt: ahead(365 * DAY - 2 * HOUR), effectiveAt: ago(HOUR) })).effect).toBe('allow')
    expect(codes(run(req({ expiresAt: undefined })))).toContain('INSTRUMENT_INVALID')
    expect(codes(run(req({ effectiveAt: undefined })))).toContain('INSTRUMENT_INVALID')
    expect(codes(run(req({ effectiveAt: ahead(DAY), expiresAt: ago(DAY) })))).toContain('INSTRUMENT_INVALID')
  })

  it('a supervisory mandate must be bounded and cannot carry privileged read', () => {
    expect(codes(run(req({ scope: {} })))).toContain('INSTRUMENT_INVALID')
    expect(codes(run(req({ powers: ['read', 'read_privileged'] }), issuerFacts(), holder(), rule({ allowedPowers: ['read', 'read_privileged'] })))).toContain('INSTRUMENT_INVALID')
  })

  it('independent approvals are counted excluding the issuer and the holder, and must be satisfied', () => {
    const gated = rule({ requiredIndependentApprovals: 2 })
    const approval = (lines: string[], status: 'satisfied' | 'open' = 'satisfied') => ({ status, approvingLines: lines })
    expect(codes(run(req(), issuerFacts(), holder(), gated))).toContain('APPROVAL_NOT_SATISFIED')
    expect(codes(run(req({ approval: approval([U.treasurer, U.president, U.chief]) }), issuerFacts(), holder(), gated))).toContain('APPROVAL_NOT_SATISFIED') // issuer and holder do not count
    expect(codes(run(req({ approval: approval([U.treasurer, U.other], 'open') }), issuerFacts(), holder(), gated))).toContain('APPROVAL_NOT_SATISFIED')
    expect(run(req({ approval: approval([U.treasurer, U.other]) }), issuerFacts(), holder(), gated).effect).toBe('allow')
    // Opening the approval is allowed before it exists.
    expect(run(req({ stage: 'request' }), issuerFacts(), holder(), gated).effect).toBe('allow')
  })

  it('the request stage skips ONLY the approval check', () => {
    const gated = rule({ requiredIndependentApprovals: 1 })
    expect(codes(run(req({ stage: 'request', powers: ['enforce'] }), issuerFacts(), holder(), gated))).toContain('EXCEEDS_RULE_CEILING')
    expect(codes(run(req({ stage: 'request' }), issuerFacts(['member']), holder(), gated))).toContain('CAPACITY_NOT_ELIGIBLE')
  })
})

describe('issuance policy: conflicts and domain protections', () => {
  const caseRule = rule({ domain: 'case_assignment', issuerCapacities: ['officer'], allowedPowers: ['read', 'comment'], maxTermDays: null, requiresAcceptance: false })
  const caseReq = (over: Partial<IssuanceRequest> = {}) => req({ domain: 'case_assignment', powers: ['read'], holderUserId: U.steward, scope: undefined, effectiveAt: undefined, expiresAt: undefined, resource: ref('case', CASE_ID), caseAssignAllowed: true, ...over })

  it('case assignment needs the issuer’s own case:assign authority and a conflict-free handler', () => {
    const f = issuerFacts(['officer'])
    expect(run(caseReq(), f, holder(['steward'], U.steward), caseRule).effect).toBe('allow')
    expect(codes(run(caseReq({ caseAssignAllowed: false }), f, holder(['steward'], U.steward), caseRule))).toContain('NO_SOURCE_OF_AUTHORITY')
    expect(codes(run(caseReq({ adverseUserIds: [U.steward] }), f, holder(['steward'], U.steward), caseRule))).toContain('ADVERSE_PARTY')
    expect(codes(run(caseReq({ adverseUserIds: [U.president] }), f, holder(['steward'], U.steward), caseRule))).toContain('ADVERSE_PARTY')
    expect(codes(run(caseReq(), issuerFacts(['officer'], { recusals: [recusal({ principalUserId: U.president })] }), holder(['steward'], U.steward), caseRule))).toContain('RECUSED')
    expect(codes(run(caseReq(), f, holder(['member'], U.steward), caseRule))).toContain('CAPACITY_NOT_ELIGIBLE')
  })

  it('a delegation can never include a non-delegable action', () => {
    const del = rule({ domain: 'delegation', issuerCapacities: ['executive'], allowedPowers: [...NON_DELEGABLE_ACTIONS, 'case:read'], maxTermDays: 90 })
    for (const a of NON_DELEGABLE_ACTIONS) {
      const d = run(req({ domain: 'delegation', powers: ['case:read', a], holderUserId: U.officer, scope: undefined }), issuerFacts(), holder(['officer'], U.officer), del)
      expect(codes(d), a).toContain('DELEGATION_INVALID')
    }
  })

  it('a governance reviewer cannot hold executive or financial authority', () => {
    const gr = rule({ domain: 'governance_review', issuerCapacities: ['executive'], allowedPowers: ['monitor'], maxTermDays: 365 })
    const r = req({ domain: 'governance_review', powers: ['monitor'], holderUserId: U.reviewer, scope: { resourceIds: [CASE_ID] } })
    expect(run(r, issuerFacts(), holder(['member'], U.reviewer), gr).effect).toBe('allow')
    const operating = [mandate({ principalUserId: U.reviewer, kind: 'executive_office', powers: ['approve'], scope: {}, grantedBy: U.other })]
    expect(codes(run({ ...r, holderMandates: operating }, issuerFacts(), holder(['member'], U.reviewer), gr))).toContain('SEGREGATION_OF_DUTIES')
    const unscoped = req({ ...r, scope: {} })
    expect(codes(run(unscoped, issuerFacts(), holder(['member'], U.reviewer), gr))).toContain('INSTRUMENT_INVALID')
  })

  it('financial grants refuse incompatible duties over one account and unbounded money', () => {
    const fin = rule({ domain: 'financial', issuerCapacities: ['executive'], allowedPowers: ['view', 'prepare', 'approve', 'execute', 'reconcile', 'audit'], maxTermDays: 365, requiredIndependentApprovals: 1 })
    const acct = '00000000-0000-4000-8000-0000000acc01'
    const money = { monetaryLimitMinor: 100_000, currency: 'CAD', scope: { accountIds: [acct] }, approval: { status: 'satisfied' as const, approvingLines: [U.other] } }
    const r = (powers: string[], extra: Partial<IssuanceRequest> = {}) => req({ domain: 'financial', powers, holderUserId: U.treasurer, ...money, ...extra })
    const h = holder(['financial_officer'], U.treasurer)
    expect(run(r(['view', 'prepare']), issuerFacts(), h, fin).effect).toBe('allow')
    const held = [mandate({ principalUserId: U.treasurer, kind: 'financial', powers: ['prepare'], scope: { accountIds: [acct] }, monetaryLimitMinor: 1, currency: 'CAD', grantedBy: U.other })]
    expect(codes(run(r(['approve'], { holderMandates: held }), issuerFacts(), h, fin))).toContain('SEGREGATION_OF_DUTIES')
    expect(codes(run(r(['prepare', 'approve']), issuerFacts(), h, fin))).toContain('SEGREGATION_OF_DUTIES')
    expect(codes(run(r(['prepare'], { monetaryLimitMinor: undefined }), issuerFacts(), h, fin))).toContain('INSTRUMENT_INVALID')
    expect(codes(run(r(['prepare'], { currency: undefined }), issuerFacts(), h, fin))).toContain('INSTRUMENT_INVALID')
    expect(codes(run(r(['prepare'], { scope: {} }), issuerFacts(), h, fin))).toContain('INSTRUMENT_INVALID')
    expect(codes(run(r(['prepare'], { holderUserId: U.officer }), issuerFacts(), holder(['officer'], U.officer), fin))).toContain('CAPACITY_NOT_ELIGIBLE')
  })

  it('emergency access: read-only, justified, short, independently approved', () => {
    const em = rule({ domain: 'emergency_access', issuerCapacities: ['executive'], allowedPowers: ['read'], maxTermDays: 1, requiredIndependentApprovals: 1, requiresAcceptance: false })
    const base = { domain: 'emergency_access' as const, powers: ['read'], holderUserId: U.steward, scope: { resourceIds: [CASE_ID] }, justification: 'Imminent safety concern in the file', effectiveAt: ago(HOUR), expiresAt: ahead(6 * HOUR), approval: { status: 'satisfied' as const, approvingLines: [U.treasurer] } }
    const h = holder(['steward'], U.steward)
    expect(run(req(base), issuerFacts(), h, em).effect).toBe('allow')
    expect(codes(run(req({ ...base, justification: 'because' }), issuerFacts(), h, em))).toContain('INSTRUMENT_INVALID')
    expect(codes(run(req({ ...base, expiresAt: ahead(30 * HOUR) }), issuerFacts(), h, em))).toContain('EXCEEDS_RULE_CEILING')
    expect(codes(run(req({ ...base, powers: ['read', 'write'] }), issuerFacts(), h, em))).toContain('EXCEEDS_RULE_CEILING')
    expect(codes(run(req({ ...base, scope: {} }), issuerFacts(), h, em))).toContain('INSTRUMENT_INVALID')
    expect(codes(run(req({ ...base, approval: { status: 'satisfied', approvingLines: [U.president, U.steward] } }), issuerFacts(), h, em))).toContain('APPROVAL_NOT_SATISFIED')
  })

  it('a recusal lift cannot be done by the recused person or by an ineligible issuer', () => {
    const lift = rule({ domain: 'recusal', operation: 'lift', issuerCapacities: ['executive'], allowedPowers: [], maxTermDays: null })
    const r = req({ domain: 'recusal', operation: 'lift', holderUserId: U.steward, resource: ref('case', CASE_ID), powers: undefined, scope: undefined, effectiveAt: undefined, expiresAt: undefined })
    expect(run(r, issuerFacts(), null, lift).effect).toBe('allow')
    expect(codes(run(r, issuerFacts(['steward']), null, lift))).toContain('CAPACITY_NOT_ELIGIBLE')
    expect(codes(run({ ...r, holderUserId: U.president }, issuerFacts(), null, lift))).toContain('SELF_APPROVAL')
  })
})

describe('default issuance templates', () => {
  const key = (t: { domain: string; operation: string }) => `${t.domain}/${t.operation}`

  it('are unique per domain and operation, and carry no real source instrument', () => {
    const keys = DEFAULT_ISSUANCE_TEMPLATES.map(key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const t of DEFAULT_ISSUANCE_TEMPLATES) expect('sourceInstrument' in t).toBe(false)
  })

  it('every one names an issuing authority, and conferring templates are term-limited', () => {
    for (const t of DEFAULT_ISSUANCE_TEMPLATES) {
      expect(t.issuerCapacities.length > 0 || !!t.issuerMandateKind, key(t)).toBe(true)
      if (t.operation === 'issue' && t.domain !== 'case_assignment' && t.domain !== 'recusal') expect(t.maxTermDays, key(t)).not.toBeNull()
    }
  })

  it('money and emergency authority always need independent approval; emergency is short and read-only; no template delegates the undelegable', () => {
    const t = (d: string, o: string) => DEFAULT_ISSUANCE_TEMPLATES.find((x) => x.domain === d && x.operation === o)!
    expect(t('financial', 'issue').requiredIndependentApprovals).toBeGreaterThanOrEqual(1)
    expect(t('emergency_access', 'issue')).toMatchObject({ maxTermDays: 1, allowedPowers: ['read'] })
    expect(t('emergency_access', 'issue').requiredIndependentApprovals).toBeGreaterThanOrEqual(1)
    expect(t('delegation', 'issue').allowedPowers.some((p) => NON_DELEGABLE_ACTIONS.includes(p))).toBe(false)
    expect(t('case_assignment', 'issue').requiredIndependentApprovals).toBe(0)
  })

  it('revocation and suspension are at least as available as issuance for every mandate kind', () => {
    for (const d of ['supervisory', 'executive_office', 'financial', 'governance_review', 'emergency_access']) {
      const issue = DEFAULT_ISSUANCE_TEMPLATES.find((x) => x.domain === d && x.operation === 'issue')!
      for (const op of ['revoke', 'suspend']) {
        const other = DEFAULT_ISSUANCE_TEMPLATES.find((x) => x.domain === d && x.operation === op)
        expect(other, `${d}/${op}`).toBeDefined()
        expect(other!.requiredIndependentApprovals, `${d}/${op}`).toBe(0)
        for (const c of issue.issuerCapacities) expect(other!.issuerCapacities, `${d}/${op}`).toContain(c)
      }
    }
  })
})
