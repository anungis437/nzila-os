import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UserRole } from '../auth/roles'
import { capacitiesForRole, ROLE_CAPACITIES } from '../authority/capacity'
import { decide } from '../authority/kernel'
import {
  CASE_ID,
  NOW,
  U,
  caseFacts,
  facts,
  ref,
  relationship,
  request,
} from '../authority/__tests__/fixtures'
import {
  validateClaimCaseTransition,
  allowedClaimCaseTransitions,
} from '../workflow/claim-transition-policy'
import { casePolicyRole } from './case-permissions'
import { CASE_HANDLER_ROLES, isCaseHandlerRole } from './case-role-access'

const primary = relationship({ principalUserId: U.steward, relation: 'owner' })
const claim = {
  claimId: CASE_ID,
  status: 'resolved',
  priority: 'medium',
  assignedTo: U.steward,
  description: 'Recorded synthetic resolution and its supporting documentation.',
  createdAt: new Date(NOW.getTime() - 10 * 86400000),
  statusChangedAt: new Date(NOW.getTime() - 8 * 86400000),
  updatedAt: NOW,
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})
afterEach(() => vi.useRealTimers())

describe('case staff surface and primary-handler lifecycle agree with real capacity authority', () => {
  it('uses precisely the canonical customer representation capacities', () => {
    const eligible = Object.keys(ROLE_CAPACITIES).filter((role) =>
      capacitiesForRole(role).some((capacity) =>
        ['steward', 'chief_steward', 'officer'].includes(capacity),
      ),
    )
    expect([...CASE_HANDLER_ROLES].sort()).toEqual(eligible.sort())
    expect(CASE_HANDLER_ROLES).toHaveLength(8)
  })

  it.each(Object.values(UserRole))(
    'checks actual primary-handler authority and closure for %s',
    (role) => {
      const eligible = isCaseHandlerRole(role)
      const decision = decide(
        request(U.steward, 'case:close', ref('case', CASE_ID)),
        facts(U.steward, [...capacitiesForRole(role)], { relationships: [primary] }),
        caseFacts(),
        NOW,
      )
      expect(decision.effect === 'allow').toBe(eligible)
      if (eligible) {
        const actor = casePolicyRole(role)!
        expect(validateClaimCaseTransition(claim, actor, 'closed').allowed).toBe(true)
        expect(
          allowedClaimCaseTransitions(claim, actor, { canTransition: true, canClose: true }),
        ).toEqual(['closed'])
        expect(
          allowedClaimCaseTransitions(claim, actor, { canTransition: true, canClose: false }),
        ).toEqual([])
        expect(
          validateClaimCaseTransition({ ...claim, statusChangedAt: NOW }, actor, 'closed').allowed,
        ).toBe(false)
        expect(
          validateClaimCaseTransition({ ...claim, description: '' }, actor, 'closed').allowed,
        ).toBe(false)
      }
    },
  )

  it.each(['steward', 'chief_steward', 'officer', 'health_safety_rep', 'bargaining_committee'])(
    'keeps %s title, collaborator overgrant, retired membership and foreign scope from closing',
    (role) => {
      const caps = [...capacitiesForRole(role)]
      const close = (over: Parameters<typeof facts>[2]) =>
        decide(
          request(U.steward, 'case:close', ref('case', CASE_ID)),
          facts(U.steward, caps, over),
          caseFacts(),
          NOW,
        )
      expect(close({}).effect).toBe('deny')
      expect(
        close({ relationships: [{ ...primary, relation: 'collaborator', permissions: ['close'] }] })
          .effect,
      ).toBe('deny')
      expect(
        close({ relationships: [{ ...primary, status: 'revoked', revokedAt: NOW }] }).effect,
      ).toBe('deny')
      expect(
        close({
          relationships: [{ ...primary, organizationId: '00000000-0000-4000-8000-00000000000b' }],
        }).effect,
      ).toBe('deny')
      expect(close({ relationships: [primary], memberships: [] }).effect).toBe('deny')
    },
  )
})
