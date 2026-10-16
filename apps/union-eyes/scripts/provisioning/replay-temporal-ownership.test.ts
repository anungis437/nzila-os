import { describe, expect, it } from 'vitest'
import { loadFrozenReplay } from '../../../../scripts/ue/implement-w5b-post-w4p-replay'
import { read } from '../../../../scripts/ue/w4-physical-producers'
import { compileReplayUnitPlan } from './replay-unit-plan'
import { replayDigest, replayText } from './post-w4p-replay'
import {
  executionPlanDigest,
  type ReplayExecutionContext,
  type ReplayInspectionWitness,
  type ReplayUnitReceipt,
} from './post-w4p-execution'
import {
  authenticatedTemporalReceipt,
  buildReplayTemporalOwnership,
  replayOwnedAtoms,
} from './replay-temporal-ownership'

const { frozen, sourceBytes } = loadFrozenReplay()
const { components, specification } = compileReplayUnitPlan(
  frozen,
  sourceBytes,
  read('docs/union-eyes/reality-remediation/UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json'),
  replayDigest('fake-supplement-plan'),
)
const context: ReplayExecutionContext = {
  scope: 'UE_OPERATIONAL',
  actorClass: 'MIGRATION_ADMIN',
  actorPrincipal: 'fake-only',
  targetDigest: replayDigest('fake-target'),
  w4pPlanDigest: specification.w4pPlanDigest,
  w4pVerificationDigest: replayDigest('fake-w4p'),
  supplementPlanDigest: specification.supplementPlanDigest,
  supplementVerificationDigest: replayDigest('fake-supplement'),
  exclusiveExecutionReference: 'fake-current-transaction',
}
const planDigest = executionPlanDigest(specification)
function receipt(id: string, predecessors: Map<string, ReplayUnitReceipt>): ReplayUnitReceipt {
  const unit = specification.units.find((unit) => unit.node.REPLAY_UNIT_ID === id)!
  const body: Omit<ReplayUnitReceipt, 'RECEIPT_DIGEST'> = {
    UNIT_ID: id,
    SOURCE_SHA256: replayText(unit.node.SOURCE_SHA256),
    UNIT_CONTENT_SHA256: replayText(unit.node.EXACT_UNIT_SHA256),
    UNIT_CONTRACT_DIGEST: unit.contractDigest,
    PLAN_DIGEST: planDigest,
    GRAPH_DIGEST: specification.graphDigest,
    TOPOLOGY_DIGEST: specification.topologyDigest,
    TARGET_SCOPE: context.scope,
    TARGET_DIGEST: context.targetDigest,
    ACTOR_CLASS: context.actorClass,
    ACTOR_PRINCIPAL: context.actorPrincipal,
    W4P_VERIFICATION_DIGEST: context.w4pVerificationDigest,
    SUPPLEMENT_VERIFICATION_DIGEST: context.supplementVerificationDigest,
    PREDECESSOR_RECEIPT_DIGESTS: unit.predecessors.map((id) => ({
      UNIT_ID: id,
      DIGEST: predecessors.get(id)!.RECEIPT_DIGEST,
    })),
    OWNED_STATE_DIGEST: replayDigest('fake-state-only-not-catalog-proof'),
    POSTCONDITION_VERIFICATION_DIGEST: replayDigest('fake-verification-only'),
    ACTION: 'NOOP',
    EXCLUSIVE_EXECUTION_REFERENCE: 'fake-historical-transaction',
  }
  return { ...body, RECEIPT_DIGEST: replayDigest(body) }
}
function witness(): ReplayInspectionWitness {
  return {
    phase: 'BEFORE',
    position: 107,
    planDigest,
    historicalReceipts: new Map(),
    verifiedReceipts: new Map(),
  }
}
describe('source temporal ownership;neither replacement nor receipts alone prove catalog completion', () => {
  const model = buildReplayTemporalOwnership(specification, components.effects)
  it('accounts all762effects with at least one explicit owned atom, including branch-sensitive DOs', () => {
    expect(new Set(model.owners.map((owner) => owner.effectId)).size).toBe(762)
    expect(model.handoffs.length).toBeGreaterThan(0)
    expect(buildReplayTemporalOwnership(specification, components.effects).digest).toBe(
      model.digest,
    )
  })
  for (const effect of components.effects) {
    it(`actual owned selectors:${effect.effectId}`, () => {
      const atoms = replayOwnedAtoms(effect)
      expect(atoms.length).toBeGreaterThan(0)
      expect(new Set(atoms.map((atom) => atom.key)).size).toBe(atoms.length)
      expect(atoms.every((atom) => /^[a-f0-9]{64}$/.test(atom.semanticsDigest))).toBe(true)
    })
  }
  it('does not treat guarded or exception-conditional writes as unconditional supersession', () => {
    const conditional = model.handoffs.filter(
      (handoff) =>
        handoff.successor.atom.operation === 'CONDITIONAL' &&
        handoff.predecessor.atom.semanticsDigest !== handoff.successor.atom.semanticsDigest,
    )
    expect(conditional.length).toBeGreaterThan(0)
    expect(
      conditional.every((handoff) => handoff.kind === 'CONDITIONAL_OR_ENSURE_NOT_SUPERSESSION'),
    ).toBe(true)
    for (const handoff of model.handoffs.filter(
      (handoff) => handoff.kind === 'EXPLICIT_REPLACEMENT',
    ))
      expect(handoff.successor.atom.operation).toBe('SET')
  })
  it('rejects missing, duplicated, and source-drifted effects', () => {
    expect(() => buildReplayTemporalOwnership(specification, components.effects.slice(1))).toThrow(
      'REPLAY_TEMPORAL_EFFECT_COVERAGE_INVALID',
    )
    expect(() =>
      buildReplayTemporalOwnership(specification, [
        ...components.effects.slice(1),
        components.effects[1],
      ]),
    ).toThrow('REPLAY_TEMPORAL_EFFECT_COVERAGE_INVALID')
    const altered = structuredClone(components.effects)
    altered[0].source += ' '
    expect(() => buildReplayTemporalOwnership(specification, altered)).toThrow(
      'REPLAY_TEMPORAL_EFFECT_SOURCE_DRIFT',
    )
  })
  const root = specification.units.find(
    (unit) => unit.node.DATABASE_SCOPE === context.scope && unit.predecessors.length === 0,
  )!
  const rootId = replayText(root.node.REPLAY_UNIT_ID)
  it('does not manufacture a temporal witness when no authenticated receipt exists', () => {
    expect(authenticatedTemporalReceipt(rootId, specification, context, witness())).toBeNull()
  })
  it('authenticates a historical receipt with a distinct historical transaction reference', () => {
    const w = witness(),
      historical = receipt(rootId, new Map())
    w.historicalReceipts = new Map([[rootId, historical]])
    expect(authenticatedTemporalReceipt(rootId, specification, context, w)).toEqual(historical)
  })
  it('rejects an invalid plan witness and a self-digested foreign-target receipt', () => {
    expect(() =>
      authenticatedTemporalReceipt(rootId, specification, context, {
        ...witness(),
        planDigest: replayDigest('wrong'),
      }),
    ).toThrow('REPLAY_TEMPORAL_WITNESS_BINDING_INVALID')
    const historical = receipt(rootId, new Map())
    historical.TARGET_DIGEST = replayDigest('different-target')
    const { RECEIPT_DIGEST: _digest, ...body } = historical
    historical.RECEIPT_DIGEST = replayDigest(body)
    const w = witness()
    w.historicalReceipts = new Map([[rootId, historical]])
    expect(() => authenticatedTemporalReceipt(rootId, specification, context, w)).toThrow(
      'REPLAY_TEMPORAL_RECEIPT_BINDING_INVALID',
    )
  })
  it('rejects future staged verification before the current position', () => {
    const w = witness()
    w.position = specification.units.indexOf(root) + 1
    w.verifiedReceipts = new Map([[rootId, receipt(rootId, new Map())]])
    expect(() => authenticatedTemporalReceipt(rootId, specification, context, w)).toThrow(
      'REPLAY_TEMPORAL_FUTURE_VERIFICATION_INVALID',
    )
  })
  it('requires every actual predecessor receipt,not only a self-consistent successor digest', () => {
    const target = specification.units.find(
      (unit) => unit.node.DATABASE_SCOPE === context.scope && unit.predecessors.length > 0,
    )!
    const chain = new Map<string, ReplayUnitReceipt>()
    const add = (id: string) => {
      if (chain.has(id)) return
      const unit = specification.units.find((unit) => unit.node.REPLAY_UNIT_ID === id)!
      unit.predecessors.forEach(add)
      chain.set(id, receipt(id, chain))
    }
    const id = replayText(target.node.REPLAY_UNIT_ID)
    add(id)
    const w = witness()
    w.historicalReceipts = chain
    expect(authenticatedTemporalReceipt(id, specification, context, w)).toEqual(chain.get(id))
    chain.delete(target.predecessors[0])
    expect(() => authenticatedTemporalReceipt(id, specification, context, w)).toThrow(
      'REPLAY_TEMPORAL_RECEIPT_CHAIN_INVALID',
    )
  })
  it('keeps helper dynamic-DDL namespace selectors unresolved despite public existence guards', () => {
    const helper = components.effects.find((effect) => effect.compiled.kind === 'POLICY_HELPER')!
    expect(
      replayOwnedAtoms(helper).every((atom) => JSON.parse(atom.key)[1] === 'UNQUALIFIED'),
    ).toBe(true)
  })
})
