import { describe, expect, it } from 'vitest'
import { getAllowedClaimTransitions } from '@/lib/services/claim-workflow-fsm'
import { UE_INVALID_TRANSITIONS, UE_TEST_CASES, UE_VALID_TRANSITIONS } from '../fixtures/test-cases'

describe('UE QA - case lifecycle and isolation rules', () => {
  it('valid transitions are allowed by the state machine', () => {
    for (const transition of UE_VALID_TRANSITIONS) {
      const allowed = getAllowedClaimTransitions(transition.from as never, 'admin')
      expect(allowed, `${transition.from} -> ${transition.to} should be valid`).toContain(
        transition.to,
      )
    }
  })

  it('invalid transitions are rejected by the state machine', () => {
    for (const transition of UE_INVALID_TRANSITIONS) {
      const allowed = getAllowedClaimTransitions(transition.from as never, 'steward')
      expect(allowed, `${transition.from} -> ${transition.to} must be blocked`).not.toContain(
        transition.to,
      )
    }
  })

  it('fixture cases enforce cross-org isolation assumptions', () => {
    expect(UE_TEST_CASES.primarySubmitted.organizationId).not.toBe(
      UE_TEST_CASES.secondarySubmitted.organizationId,
    )
  })
})
