import { describe, expect, it } from 'vitest'
import { activeRecusal, assessDelegation, assessMandate } from '../common'
import { decide } from '../kernel'
import { decideIssuance, type IssuanceRule } from '../issuance'
import { assertVerifiedBinding } from '../store/platform-identity'
import { canonicalMembershipStatus } from '../store/membership-reconciliation'
import { ahead, ago, CASE_ID, caseFacts, DAY, delegation, facts, HOUR, mandate, membership, NOW, ORG, recusal, ref, relationship, request, U } from './fixtures'

const invalid = () => new Date('invalid')
const resource = ref('case', CASE_ID)

describe('authority validity and restriction lifecycle', () => {
  it.each(['effectiveAt', 'expiresAt', 'revokedAt'] as const)('rejects malformed %s across mandate, delegation and relationship consumers', field => {
    expect(assessMandate(mandate({ [field]: invalid() }), ORG, NOW).effective).toBe(false)
    expect(assessDelegation(delegation({ [field]: invalid() }), ORG, NOW).effective).toBe(false)
    expect(decide(request(U.steward, 'case:close', resource), facts(U.steward, ['steward'], {
      relationships: [relationship({ [field]: invalid() })],
    }), caseFacts(), NOW).effect).toBe('deny')
  })

  it.each([invalid(), ahead(HOUR)])('does not count malformed or future acceptance: %s', acceptedAt => {
    for (const requiresAcceptance of [false, true]) {
      expect(assessMandate(mandate({ requiresAcceptance, acceptedAt }), ORG, NOW).effective).toBe(false)
      expect(assessDelegation(delegation({ requiresAcceptance, acceptedAt }), ORG, NOW).effective).toBe(false)
    }
    expect(assessMandate(mandate({ requiresAcceptance: true, acceptedAt: ago(1) }), ORG, NOW).effective).toBe(true)
  })

  it.each([
    { liftedAt: invalid(), liftedBy: U.chief },
    { liftedAt: ahead(1), liftedBy: U.chief },
    { liftedAt: ago(2 * HOUR), liftedBy: U.chief },
    { liftedAt: ago(1), liftedBy: U.steward },
    { liftedAt: ago(1), liftedBy: null },
    { liftedAt: ago(1), liftedBy: ' invalid ' },
    { declaredAt: invalid(), liftedAt: ago(1), liftedBy: U.chief },
  ])('retains a restriction with incoherent lift evidence: %o', over => {
    const r = recusal(over)
    expect(activeRecusal([r], U.steward, resource, ORG, NOW)).toBe(r)
    expect(decide(request(U.steward, 'case:close', resource), facts(U.steward, ['steward'], {
      relationships: [relationship()], recusals: [r],
    }), caseFacts(), NOW).effect).toBe('deny')
  })

  it('honours a coherent independent lift once it takes effect', () => {
    expect(activeRecusal([recusal({ liftedAt: NOW, liftedBy: U.chief })], U.steward, resource, ORG, NOW)).toBeNull()
  })

  it.each(['effectiveAt', 'expiresAt'] as const)('refuses malformed %s when conferring a delegation', field => {
    const rule: IssuanceRule = { id: 'rule', organizationId: ORG, domain: 'delegation', operation: 'issue',
      issuerCapacities: ['executive'], issuerMandateKind: 'executive_office', issuerMandatePower: 'approve',
      allowedPowers: ['case:read'], maxTermDays: 90, requiresAcceptance: true, requiredIndependentApprovals: 0,
      version: 1, status: 'active', sourceInstrument: 'Bylaw 12', draftedBy: U.other, approvedBy: [U.chief, U.treasurer] }
    const req = { issuerUserId: U.president, organizationId: ORG, domain: 'delegation' as const, operation: 'issue' as const,
      holderUserId: U.officer, powers: ['case:read'], effectiveAt: ago(HOUR), expiresAt: ahead(DAY) }
    const f = facts(U.president, ['executive'], { mandates: [mandate({ principalUserId: U.president,
      kind: 'executive_office', powers: ['approve'], scope: {}, grantedBy: U.other })] })
    expect(decideIssuance(req, f, membership(U.officer, ['officer']), rule, NOW).effect).toBe('allow')
    expect(decideIssuance({ ...req, [field]: invalid() }, f, membership(U.officer, ['officer']), rule, NOW).effect).toBe('deny')
  })

  it('never treats an invalid evaluation clock as authority or timestamped evidence', () => {
    const d = decide(request(U.steward, 'case:close', resource), facts(U.steward, ['steward'], {
      relationships: [relationship()],
    }), caseFacts(), invalid())
    expect(d).toMatchObject({ effect: 'deny', evaluatedAt: 'INVALID_CLOCK' })
    expect(() => assertVerifiedBinding({ userId: U.steward, organizationId: ORG, sessionToken: 'server-bearer',
      expiresAt: ahead(HOUR), authority: 'pg-session' }, invalid())).toThrow('evaluation clock')
    expect(() => canonicalMembershipStatus({ state: 'active', effectiveFrom: ago(HOUR), effectiveTo: ahead(HOUR), revokedAt: null } as never, invalid())).toThrow('evaluation clock')
  })
})
