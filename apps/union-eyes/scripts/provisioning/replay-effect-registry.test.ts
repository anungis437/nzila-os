import { describe, expect, it } from 'vitest'
import { read } from '../../../../scripts/ue/w4-physical-producers'
import { loadFrozenReplay } from '../../../../scripts/ue/implement-w5b-post-w4p-replay'
import { replayDigest } from './post-w4p-replay'
import {
  bindFrozenEffects,
  compileReplayComponents,
  exactReplaySource,
  frozenEffectCounts,
  replayEnumAuthority,
} from './replay-effect-registry'
const { frozen, sourceBytes } = loadFrozenReplay()
const ledgerBytes = read(
  'docs/union-eyes/reality-remediation/UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json',
)
describe('typed source-bound effect registry;not whole-boundary qualification', () => {
  it('binds all762 effects and23 boundaries without rebuilding the graph', () => {
    const before = replayDigest(frozen),
      bindings = bindFrozenEffects(frozen, sourceBytes, ledgerBytes)
    expect(bindings).toHaveLength(762)
    expect(new Set(bindings.map((binding) => binding.boundaryId)).size).toBe(22)
    for (const [name, count] of Object.entries(frozenEffectCounts)) {
      expect(bindings.filter((binding) => binding.effectClass === name)).toHaveLength(count)
    }
    expect(replayDigest(frozen)).toBe(before)
  })
  it('dispatches all762effects and84prospective units to actual typed compilers', () => {
    const result = compileReplayComponents(frozen, sourceBytes, ledgerBytes)
    expect(result.effects).toHaveLength(762)
    expect(result.creates).toHaveLength(43)
    expect(result.wrappers).toHaveLength(41)
    expect(result.proceduralBindings).toHaveLength(75)
    expect(result.wholeBoundaryQualification).toBe('NOT_ESTABLISHED')
    const counts = new Map<string, number>()
    for (const effect of result.effects) {
      counts.set(effect.compiled.kind, (counts.get(effect.compiled.kind) ?? 0) + 1)
      expect(effect.compiled.contract.contractDigest).toMatch(/^[a-f0-9]{64}$/)
    }
    expect(Object.fromEntries(counts)).toEqual({
      RELATION: 76,
      SCHEMA: 2,
      FOREIGN_KEY: 17,
      INDEX: 89,
      COLUMN: 43,
      RLS: 20,
      POLICY_DROP: 61,
      POLICY_CREATE: 14,
      POLICY_HELPER: 320,
      FUNCTION: 13,
      ACL: 21,
      DEFAULT: 7,
      BACKFILL: 4,
      PROCEDURAL: 75,
    })
    expect(compileReplayComponents(frozen, sourceBytes, ledgerBytes).digest).toBe(result.digest)
  })
  it('rejects ledger byte drift rather than trusting recomputed metadata', () => {
    expect(() => bindFrozenEffects(frozen, sourceBytes, ledgerBytes + '\n')).toThrow(
      'REPLAY_REGISTRY_LEDGER_DRIFT',
    )
  })
  it('rejects source drift before extracting either whole units or wrappers', () => {
    for (const kind of ['FROZEN_STATEMENT_UNIT', 'FROZEN_WRAPPER_UNIT', 'FROZEN_MIGRATION_UNIT']) {
      const node = frozen.nodes.find((node) => node.REPLAY_UNIT_CLASS === kind)!
      const file = String(node.SOURCE_FILE)
      expect(() =>
        exactReplaySource(frozen, { ...sourceBytes, [file]: sourceBytes[file] + '\n' }, node),
      ).toThrow('REPLAY_REGISTRY_BOUNDARY_SOURCE_DRIFT')
    }
  })
  it('requires a consistent bound range across repeated compatibility provenance and exact unit hash', () => {
    const node = frozen.nodes.find((node) => node.REPLAY_UNIT_CLASS === 'FROZEN_WRAPPER_UNIT')!
    const clone = structuredClone(frozen)
    if (!Array.isArray(clone.register.BOUND_REPLAY_RECORDS)) throw new Error('REGISTER_REQUIRED')
    clone.register.BOUND_REPLAY_RECORDS = []
    expect(() => exactReplaySource(clone, sourceBytes, node)).toThrow(
      'REPLAY_REGISTRY_SOURCE_BINDING_INVALID',
    )
    expect(() =>
      exactReplaySource(frozen, sourceBytes, { ...node, EXACT_UNIT_SHA256: '0'.repeat(64) }),
    ).toThrow('REPLAY_REGISTRY_UNIT_SOURCE_DRIFT')
  })
  it('retains all127records while denying divergent ranges on repeated provenance', () => {
    const clone = structuredClone(frozen)
    if (!Array.isArray(clone.register.BOUND_REPLAY_RECORDS)) throw new Error('REGISTER_REQUIRED')
    const records = clone.register.BOUND_REPLAY_RECORDS
    expect(records).toHaveLength(127)
    const first = records.find(
      (entry) =>
        entry &&
        typeof entry === 'object' &&
        !Array.isArray(entry) &&
        records.filter(
          (other) =>
            other &&
            typeof other === 'object' &&
            !Array.isArray(other) &&
            other.REPLAY_UNIT_ID === entry.REPLAY_UNIT_ID,
        ).length > 1,
    )
    if (!first || typeof first !== 'object' || Array.isArray(first))
      throw new Error('REPEATED_PROVENANCE_REQUIRED')
    const node = clone.nodes.find((node) => node.REPLAY_UNIT_ID === first.REPLAY_UNIT_ID)!
    expect(exactReplaySource(clone, sourceBytes, node)).toBe(
      exactReplaySource(frozen, sourceBytes, node),
    )
    first.SOURCE_RANGE = [0, 1]
    expect(() => exactReplaySource(clone, sourceBytes, node)).toThrow(
      'REPLAY_REGISTRY_SOURCE_BINDING_INVALID',
    )
  })
  it('derives named enum authority only from the frozen W4P registry and wrappers', () => {
    const enums = replayEnumAuthority(frozen, sourceBytes)
    expect(enums.length).toBeGreaterThanOrEqual(41)
    expect(new Set(enums.map((entry) => `${entry.schema}.${entry.name}`)).size).toBe(enums.length)
    expect(
      enums.every(
        (entry) => entry.members.length > 0 && /^[a-f0-9]{64}$/.test(entry.definitionDigest),
      ),
    ).toBe(true)
  })
})
