/** Historical synthetic facts; no live authority, adoption or SQL execution is asserted. */
import { describe, expect, it } from 'vitest'
import { decide } from '../kernel'
import { assessMandate } from '../common'
import { decideIssuance, type IssuanceRequest, type IssuanceRule } from '../issuance'
import { capacitiesForRole } from '../capacity'
import type { Action, Mandate } from '../ontology'
import { ahead, ago, CASE_ID, DAY, facts, HOUR, mandate, membership, NOW, ORG, ORG_B, ref, request, caseFacts, U } from './fixtures'

const historicalStaff = (over: Partial<Mandate> = {}): Mandate => mandate({
  principalUserId: U.platform, kind: 'platform_staff', powers: ['platform.stats.read'], scope: {},
  grantedBy: U.other, sourceInstrument: 'Synthetic historical platform responsibility',
  requiresAcceptance: true, acceptedAt: ago(HOUR), ...over,
})
const staffFacts = (held = historicalStaff()) => facts(U.platform, ['executive'], {
  principal: { userId: U.platform, authenticated: true, platformStaff: true }, mandates: [held],
})
const issuanceRule = (over: Partial<IssuanceRule> = {}): IssuanceRule => ({
  id: '00000000-0000-4000-8000-0000000a9911', organizationId: ORG, domain: 'supervisory', operation: 'issue',
  issuerCapacities: ['executive'], issuerMandateKind: 'supervisory', issuerMandatePower: 'assign',
  allowedPowers: ['read'], maxTermDays: 30, requiresAcceptance: true, requiredIndependentApprovals: 0,
  version: 1, status: 'active', sourceInstrument: 'Synthetic otherwise valid adopted rule',
  draftedBy: U.other, approvedBy: [U.president, U.treasurer], ...over,
})
const issuanceRequest = (over: Partial<IssuanceRequest> = {}): IssuanceRequest => ({
  issuerUserId: U.platform, organizationId: ORG, domain: 'supervisory', operation: 'issue', holderUserId: U.chief,
  powers: ['read'], effectiveAt: ago(HOUR), expiresAt: ahead(DAY), scope: { resourceIds: [CASE_ID] }, ...over,
})
const holder = membership(U.chief, ['chief_steward', 'officer'])
const issue = (held: Mandate, rule: IssuanceRule | null = issuanceRule(), req = issuanceRequest()) =>
  decideIssuance(req, staffFacts(held), holder, rule, NOW)

describe('historical platform staff records remain distinct from case authority', () => {
  it('recognizes an accepted historical record as effective without treating that alone as action authorization', () => {
    expect(assessMandate(historicalStaff(), ORG, NOW)).toEqual({ effective: true, reasons: [] })
  })

  it.each<Action>(['case:read', 'case:assign', 'case:read_internal', 'case:upload_evidence', 'case:close', 'case:read_privileged'])(
    'does not authorize %s through a platform kind even with a matching copied power and exact case scope', action => {
      const staff = historicalStaff({ powers: ['platform.stats.read', action, action.slice(5)], scope: { resourceIds: [CASE_ID] } })
      const decision = decide(request(U.platform, action, ref('case', CASE_ID)), staffFacts(staff), caseFacts(), NOW)
      expect(decision.effect).toBe('deny')
    })

  it.each(['platform_lead', 'system_admin', 'admin', 'president'])(
    '%s title and platform-admin flag alone do not grant case access or assignment', role => {
      const f = facts(U.platform, capacitiesForRole(role), { principal: { userId: U.platform, authenticated: true, platformStaff: true } })
      for (const action of ['case:read', 'case:assign'] as const)
        expect(decide(request(U.platform, action, ref('case', CASE_ID)), f, caseFacts(), NOW).effect).toBe('deny')
    })

  it.each([
    ['wrong organization', historicalStaff({ organizationId: ORG_B })],
    ['revoked', historicalStaff({ status: 'revoked', revokedAt: ago(HOUR) })],
    ['expired', historicalStaff({ expiresAt: ago(1) })],
    ['unaccepted', historicalStaff({ acceptedAt: null })],
    ['future acceptance', historicalStaff({ acceptedAt: ahead(HOUR) })],
  ] as const)('rejects the %s historical instrument at the generic assessment boundary', (_name, staff) => {
    expect(assessMandate(staff, ORG, NOW).effective).toBe(false)
  })

  it('preserves a valid domain-specific supervisory issuance positive control', () => {
    const supervisor = historicalStaff({ kind: 'supervisory', powers: ['assign'], scope: { resourceIds: [CASE_ID] } })
    expect(issue(supervisor).effect).toBe('allow')
  })

  it.each([
    ['absent rule', null],
    ['draft', issuanceRule({ status: 'draft' })],
    ['retired', issuanceRule({ status: 'retired' })],
    ['wrong rule organization', issuanceRule({ organizationId: ORG_B })],
    ['wrong domain', issuanceRule({ domain: 'delegation' })],
    ['wrong operation', issuanceRule({ operation: 'revoke' })],
    ['wrong issuer kind', issuanceRule()],
    ['wrong issuer power', issuanceRule({ issuerMandateKind: 'platform_staff', issuerMandatePower: 'platform.organization.manage' })],
  ] as const)('does not turn generic platform assessment into issuance when the rule is %s', (_name, rule) => {
    expect(issue(historicalStaff(), rule).effect).toBe('deny')
  })

  it('requires actual case assignment authority even when a rule names a historical platform mandate', () => {
    const rule = issuanceRule({ domain: 'case_assignment', issuerMandateKind: 'platform_staff', issuerMandatePower: 'platform.stats.read' })
    expect(issue(historicalStaff(), rule, issuanceRequest({ domain: 'case_assignment', caseAssignAllowed: false })).effect).toBe('deny')
  })

  it('keeps the adopted rule and its named institutional capacity authoritative; a platform prerequisite only narrows eligibility', () => {
    const rule = issuanceRule({ issuerMandateKind: 'platform_staff', issuerMandatePower: 'platform.stats.read' })
    const unrestrictedPrerequisite = { ...rule, issuerMandateKind: null, issuerMandatePower: null }
    const effective = staffFacts(), missingCapacity = { ...effective, memberships: [membership(U.platform, ['member'])] }
    const decisions = {
      eligibleWithNoMandateRequirement: decideIssuance(issuanceRequest(), { ...effective, mandates: [] }, holder, unrestrictedPrerequisite, NOW),
      eligibleWithNamedStaffRequirement: decideIssuance(issuanceRequest(), effective, holder, rule, NOW),
      eligibleWithoutRequiredStaff: decideIssuance(issuanceRequest(), { ...effective, mandates: [] }, holder, rule, NOW),
      staffCannotReplaceInstitutionalCapacity: decideIssuance(issuanceRequest(), missingCapacity, holder, rule, NOW),
      staffCannotReplaceAdoptedRule: decideIssuance(issuanceRequest(), effective, holder, null, NOW),
    }
    process.stdout.write(JSON.stringify({ proof: 'HISTORICAL_PLATFORM_STAFF_PREREQUISITE_COUNTERFACTUAL', engine: 'pure production decideIssuance',
      domain: rule.domain, issuerMandateKind: rule.issuerMandateKind, issuerMandatePower: rule.issuerMandatePower,
      decisions, nativeVerdict: 'UNEXECUTED', fixtureBoundary: 'Synthetic accepted rule and membership; no live adoption claimed' }) + '\n')
    expect(Object.fromEntries(Object.entries(decisions).map(([name, decision]) => [name, decision.effect]))).toEqual({
      eligibleWithNoMandateRequirement: 'allow', eligibleWithNamedStaffRequirement: 'allow', eligibleWithoutRequiredStaff: 'deny',
      staffCannotReplaceInstitutionalCapacity: 'deny', staffCannotReplaceAdoptedRule: 'deny',
    })
    expect(decisions.staffCannotReplaceInstitutionalCapacity.reasons).toContainEqual(expect.objectContaining({ code: 'CAPACITY_NOT_ELIGIBLE' }))
    expect(decisions.staffCannotReplaceAdoptedRule.reasons).toContainEqual(expect.objectContaining({ code: 'NO_ACTIVE_ISSUANCE_RULE' }))
  })

  it.each([
    ['wrong organization', historicalStaff({ organizationId: ORG_B })],
    ['wrong principal', historicalStaff({ principalUserId: U.other })],
    ['wrong kind', historicalStaff({ kind: 'executive_office' })],
    ['wrong power', historicalStaff({ powers: ['platform.organization.manage'] })],
    ['revoked', historicalStaff({ status: 'revoked', revokedAt: ago(HOUR) })],
    ['expired', historicalStaff({ expiresAt: ago(1) })],
    ['unaccepted', historicalStaff({ acceptedAt: null })],
  ] as const)('does not satisfy an explicitly adopted platform mandate prerequisite with a %s record', (_name, held) => {
    expect(issue(held, issuanceRule({ issuerMandateKind: 'platform_staff', issuerMandatePower: 'platform.stats.read' })).effect).toBe('deny')
  })
})
