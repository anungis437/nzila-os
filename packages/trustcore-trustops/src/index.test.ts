import { describe, expect, it } from 'vitest'

import {
  evaluateTransition,
  isTerminalStage,
  isTransitionAllowed,
  nextStages,
} from './fsm/index'
import { compareCreditorPriority, higherPriority } from './creditors/index'
import { isAdmittedProofOfClaim, isOpenProofOfClaim } from './claims/index'
import { computeMandateProgress } from './progress/index'

const ORG = '00000000-0000-0000-0000-000000000001'
const MANDATE = '00000000-0000-0000-0000-000000000002'
const ACTOR = 'user-1'

describe('trustcore-trustops fsm', () => {
  it('allows the canonical forward edge intake→engagement_signed', () => {
    expect(
      isTransitionAllowed({
        mandateId: MANDATE,
        fromStage: 'mandate_intake',
        toStage: 'engagement_signed',
        trigger: 'manual',
        actorUserId: ACTOR,
      }),
    ).toBe(true)
  })

  it('allows single-step rollback (auditable)', () => {
    expect(
      isTransitionAllowed({
        mandateId: MANDATE,
        fromStage: 'engagement_signed',
        toStage: 'mandate_intake',
        trigger: 'manual',
        actorUserId: ACTOR,
      }),
    ).toBe(true)
  })

  it('rejects skipping over a stage', () => {
    const result = evaluateTransition({
      mandateId: MANDATE,
      fromStage: 'mandate_intake',
      toStage: 'asset_inventory',
      trigger: 'manual',
      actorUserId: ACTOR,
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('edge_not_allowed')
  })

  it('rejects transitions out of terminal stages', () => {
    const result = evaluateTransition({
      mandateId: MANDATE,
      fromStage: 'archived',
      toStage: 'discharge',
      trigger: 'manual',
      actorUserId: ACTOR,
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('terminal_from_stage')
  })

  it('rejects identity transitions', () => {
    const result = evaluateTransition({
      mandateId: MANDATE,
      fromStage: 'asset_inventory',
      toStage: 'asset_inventory',
      trigger: 'manual',
      actorUserId: ACTOR,
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('identity_transition')
  })

  it('rejects malformed input', () => {
    const result = evaluateTransition({ orgId: ORG }) // missing fields
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('invalid_input')
  })

  it('lists single-step neighbours including rollback', () => {
    const next = nextStages('engagement_signed')
    expect(next).toContain('asset_inventory')
    expect(next).toContain('mandate_intake')
  })

  it('reports terminal-stage membership correctly', () => {
    expect(isTerminalStage('archived')).toBe(true)
    expect(isTerminalStage('mandate_intake')).toBe(false)
  })

  it('returns an empty array of next stages for an unknown stage', () => {
    expect(nextStages('not_a_real_stage' as never)).toEqual([])
  })
})

describe('trustcore-trustops creditors', () => {
  it('orders secured above unsecured', () => {
    expect(compareCreditorPriority('secured', 'unsecured')).toBeLessThan(0)
    expect(higherPriority('secured', 'unsecured')).toBe('secured')
  })

  it('orders priority above unsecured but below secured', () => {
    expect(compareCreditorPriority('priority', 'secured')).toBeGreaterThan(0)
    expect(compareCreditorPriority('priority', 'unsecured')).toBeLessThan(0)
  })

  it('places equity last', () => {
    expect(higherPriority('equity', 'subordinated')).toBe('subordinated')
  })
})

describe('trustcore-trustops claims', () => {
  it('treats submitted + under_review as open', () => {
    expect(isOpenProofOfClaim('submitted')).toBe(true)
    expect(isOpenProofOfClaim('under_review')).toBe(true)
    expect(isOpenProofOfClaim('admitted')).toBe(false)
    expect(isOpenProofOfClaim('rejected')).toBe(false)
  })

  it('treats admitted and partially_admitted as admitted', () => {
    expect(isAdmittedProofOfClaim('admitted')).toBe(true)
    expect(isAdmittedProofOfClaim('partially_admitted')).toBe(true)
    expect(isAdmittedProofOfClaim('rejected')).toBe(false)
  })
})

describe('trustcore-trustops progress', () => {
  it('returns 0 for intake and 1 for archived', () => {
    expect(computeMandateProgress('mandate_intake')).toBe(0)
    expect(computeMandateProgress('archived')).toBe(1)
  })

  it('produces a monotonically increasing ratio across the canonical order', () => {
    const stages = [
      'mandate_intake',
      'engagement_signed',
      'asset_inventory',
      'distribution',
      'archived',
    ] as const
    const values = stages.map(computeMandateProgress)
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]!)
    }
  })
})
