import { describe, expect, it } from 'vitest'
import { getAllowedClaimTransitions } from '@/lib/services/claim-workflow-fsm'
import { UE_INVALID_TRANSITIONS, UE_VALID_TRANSITIONS } from '../fixtures/test-cases'

describe('UE QA - state machine contract', () => {
  it('valid transitions pass', () => {
    for (const transition of UE_VALID_TRANSITIONS) {
      const allowed = getAllowedClaimTransitions(transition.from as never, 'admin')
      expect(allowed).toContain(transition.to)
    }
  })

  it('invalid transitions fail', () => {
    for (const transition of UE_INVALID_TRANSITIONS) {
      const allowed = getAllowedClaimTransitions(transition.from as never, 'steward')
      expect(allowed).not.toContain(transition.to)
    }
  })

  it('undefined transitions fail', () => {
    const allowed = getAllowedClaimTransitions('assigned' as never, 'admin')
    expect(allowed).not.toContain('undefined_transition' as never)
  })
})
