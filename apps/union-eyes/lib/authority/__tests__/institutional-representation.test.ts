/**
 * Step 1 S1-A04 / base action C10 (senior representative supervision): institutional authority comes from a live,
 * independently granted mandate in scope, held with an eligible capacity — never from a title or role label.
 * Each refusal is paired with the positive control so a passing test cannot be a blanket deny.
 */
import { describe, expect, it } from 'vitest'
import { decide } from '../kernel'
import type { Action, Capacity } from '../ontology'
import { ago, ahead, CASE_ID, DAY, HOUR, NOW, ORG_B, U, UNIT_ID, caseFacts, facts, mandate, membership, recusal, ref, request } from './fixtures'

const supervisor: Capacity[] = ['member', 'chief_steward']
const resource = ref('case', CASE_ID)
const OTHER_UNIT = '0b7c5a3e-1f2d-4c3b-9a8e-0000000000d1'
const OTHER_CASE = '0b7c5a3e-1f2d-4c3b-9a8e-0000000000d2'
const read = (over: Parameters<typeof facts>[2] = {}, capacities = supervisor, c = caseFacts(), action: Action = 'case:read') =>
  decide(request(U.chief, action, resource), facts(U.chief, capacities, over), c, NOW)

describe('C10 senior representative supervision is mandate-bound', () => {
  it('a live in-scope supervisory mandate held by a chief steward permits its declared power (positive control)', () => {
    const r = read({ mandates: [mandate()] })
    expect(r.effect).toBe('allow')
    expect(r.authority.some((a) => a.kind === 'mandate')).toBe(true)
  })
  it('the same chief steward title with no mandate has no supervisory authority', () => {
    expect(read().effect).toBe('deny')
  })
  it('a power the mandate does not declare is refused', () => {
    expect(read({ mandates: [mandate({ powers: ['read'] })] }, supervisor, caseFacts(), 'case:assign').effect).toBe('deny')
  })
  it('primary-handler-only powers are never reachable through supervision', () => {
    for (const action of ['case:disclose_to_member', 'case:export_sealed_evidence', 'case:close'] as const) {
      const power = action.split(':')[1]
      expect(read({ mandates: [mandate({ powers: ['read', power] })] }, supervisor, caseFacts(), action).effect).toBe('deny')
    }
  })
  it('a case outside the mandate unit or resource scope is refused', () => {
    expect(read({ mandates: [mandate({ scope: { unitIds: [OTHER_UNIT] } })] }).effect).toBe('deny')
    expect(read({ mandates: [mandate({ scope: { resourceIds: [OTHER_CASE] } })] }).effect).toBe('deny')
    expect(read({ mandates: [mandate({ scope: { resourceIds: [CASE_ID] } })] }).effect).toBe('allow')
  })
  it('an ineligible capacity cannot exercise a supervisory mandate', () => {
    expect(read({ mandates: [mandate()] }, ['member', 'steward']).effect).toBe('deny')
  })
  it('a confidential case needs a confidential classification ceiling on the mandate', () => {
    const confidential = caseFacts({ confidential: true } as Parameters<typeof caseFacts>[0])
    expect(read({ mandates: [mandate()] }, supervisor, confidential).effect).toBe('deny')
    expect(read({ mandates: [mandate({ scope: { unitIds: [UNIT_ID], classificationCeiling: 'confidential' } })] }, supervisor, confidential).effect).toBe('allow')
  })
})

describe('S1-A04 suspension, expiry, revocation and conflicts end institutional authority', () => {
  it('a suspended or revoked mandate confers nothing', () => {
    expect(read({ mandates: [mandate({ status: 'suspended' })] }).effect).toBe('deny')
    expect(read({ mandates: [mandate({ status: 'revoked', revokedAt: ago(HOUR) })] }).effect).toBe('deny')
  })
  it('a suspended membership confers nothing even with a live mandate', () => {
    expect(read({ mandates: [mandate()], memberships: [membership(U.chief, supervisor, { status: 'suspended' })] }).effect).toBe('deny')
  })
  it('authority ends at the mandate expiry boundary and has not begun before its effective time', () => {
    expect(read({ mandates: [mandate({ expiresAt: ago(1) })] }).effect).toBe('deny')
    expect(read({ mandates: [mandate({ expiresAt: ahead(HOUR) })] }).effect).toBe('allow')
    expect(read({ mandates: [mandate({ effectiveAt: ahead(DAY) })] }).effect).toBe('deny')
  })
  it('a self-granted appointment is void', () => {
    expect(read({ mandates: [mandate({ grantedBy: U.chief })] }).effect).toBe('deny')
  })
  it('a recused or adverse appointee cannot act on the matter despite a valid mandate', () => {
    expect(read({ mandates: [mandate()], recusals: [recusal({ principalUserId: U.chief })] }).effect).toBe('deny')
    expect(read({ mandates: [mandate()] }, supervisor, caseFacts({ adverseUserIds: [U.chief] })).effect).toBe('deny')
  })
  it('an appointment recorded in another tenant confers nothing here', () => {
    expect(read({ mandates: [mandate({ organizationId: ORG_B })] }).effect).toBe('deny')
  })
})
