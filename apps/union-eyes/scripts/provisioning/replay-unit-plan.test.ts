import { describe, expect, it } from 'vitest'
import { read } from '../../../../scripts/ue/w4-physical-producers'
import { loadFrozenReplay } from '../../../../scripts/ue/implement-w5b-post-w4p-replay'
import { replayDigest, replayHash } from './post-w4p-replay'
import { compileReplayUnitPlan } from './replay-unit-plan'
import { executionPlanDigest } from './post-w4p-execution'
const { frozen, sourceBytes } = loadFrozenReplay()
const ledgerBytes = read(
  'docs/union-eyes/reality-remediation/UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json',
)
const supplementPlanDigest = replayDigest('fake-only-supplement-plan')
describe('107source-native unit contracts and23transaction assignments,not replay eligibility', () => {
  const plan = compileReplayUnitPlan(frozen, sourceBytes, ledgerBytes, supplementPlanDigest)
  it('binds107contracts,762effects,23boundaries andexactlyoneeffect-free financial unit', () => {
    expect(plan.specification.units).toHaveLength(107)
    expect(plan.sourceContracts).toBe(107)
    expect(plan.boundaries).toHaveLength(23)
    expect(plan.boundaries.flatMap((boundary) => boundary.effects)).toHaveLength(762)
    expect(plan.originalTransactionAssignments).toBe(23)
    expect(
      plan.boundaries
        .filter((boundary) => boundary.scope === 'FINANCIAL_SERVICE')
        .map((boundary) => boundary.effects),
    ).toEqual([[]])
    expect(plan.wholeUnitEligibility).toBe('NOT_ESTABLISHED')
    expect(plan.executionAuthorized).toBe(false)
  })
  it('retains all231edges including repeated provenance,127records and86handoffs', () => {
    expect(plan.specification.units.flatMap((unit) => unit.predecessors)).toHaveLength(231)
    expect(plan.specification.frozen.register.BOUND_REPLAY_RECORDS).toHaveLength(127)
    expect(plan.specification.frozen.register.BOUND_ORDERING_HANDOFFS).toHaveLength(86)
    expect(plan.specification.units.map((unit) => unit.node.REPLAY_UNIT_ID)).toEqual(
      frozen.order.map((node) => node.REPLAY_UNIT_ID),
    )
  })
  for (const unit of plan.specification.units) {
    it(`actual source contract:${unit.node.REPLAY_UNIT_ID}`, () => {
      expect(replayHash(unit.sql)).toBe(unit.node.EXACT_UNIT_SHA256)
      expect(unit.contractDigest).toMatch(/^[a-f0-9]{64}$/)
      if (unit.node.REPLAY_UNIT_CLASS === 'FROZEN_STATEMENT_UNIT')
        expect(unit.contractDigest).toBe(
          plan.components.creates.find((entry) => entry.unitId === unit.node.REPLAY_UNIT_ID)
            ?.contract.contractDigest,
        )
      if (unit.node.REPLAY_UNIT_CLASS === 'FROZEN_WRAPPER_UNIT')
        expect(unit.contractDigest).toBe(
          plan.components.wrappers.find((entry) => entry.unitId === unit.node.REPLAY_UNIT_ID)
            ?.contract.contractDigest,
        )
    })
  }
  it('is deterministic anddenies anunbound supplement commitment', () => {
    const next = compileReplayUnitPlan(frozen, sourceBytes, ledgerBytes, supplementPlanDigest)
    expect(executionPlanDigest(next.specification)).toBe(executionPlanDigest(plan.specification))
    expect(() => compileReplayUnitPlan(frozen, sourceBytes, ledgerBytes, 'UNBOUND')).toThrow(
      'REPLAY_UNIT_PLAN_SUPPLEMENT_DIGEST_REQUIRED',
    )
  })
})
