import { describe, expect, it } from 'vitest'
import type { Mandate } from '@/lib/authority/ontology'
import { decideEquityDisclosureGrantAuthority } from '../disclosure-authority'

const NOW = new Date('2026-11-09T12:00:00.000Z')
const ORG = '11111111-1111-4111-8111-111111111111'
const USER = 'privacy-officer-1'

function mandate(overrides: Partial<Mandate> = {}): Mandate {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    organizationId: ORG,
    principalUserId: USER,
    kind: 'governance_review',
    powers: ['equity:disclosure:grant'],
    scope: { resourceIds: [ORG] },
    sourceInstrument: 'board-resolution-2026-44',
    grantedBy: 'board-secretary-1',
    approvedBy: 'board-chair-1',
    status: 'active',
    effectiveAt: new Date('2026-11-01T00:00:00.000Z'),
    expiresAt: new Date('2027-11-01T00:00:00.000Z'),
    revokedAt: null,
    requiresAcceptance: false,
    ...overrides,
  }
}

describe('equity disclosure grant authority', () => {
  it('allows only the exact live organization-scoped privacy mandate', () => {
    expect(decideEquityDisclosureGrantAuthority([mandate()], { organizationId: ORG, userId: USER }, NOW)).toEqual({ mandateId: mandate().id })
  })

  it.each([
    ['role/title without mandate', []],
    ['wrong organization scope', [mandate({ scope: { resourceIds: ['33333333-3333-4333-8333-333333333333'] } })]],
    ['wrong power', [mandate({ powers: ['read'] })]],
    ['expired', [mandate({ expiresAt: new Date('2026-11-09T11:59:59.000Z') })]],
    ['revoked', [mandate({ status: 'revoked', revokedAt: new Date('2026-11-08T00:00:00.000Z') })]],
    ['self granted', [mandate({ grantedBy: USER })]],
  ])('denies %s', (_case, mandates) => {
    expect(decideEquityDisclosureGrantAuthority(mandates as Mandate[], { organizationId: ORG, userId: USER }, NOW)).toBeNull()
  })
})
