import { afterEach, describe, expect, it, vi } from 'vitest'
import { syntheticScenario } from '../../src/scenario'
import { apply, genesis, authoritySnapshot, brief } from '../../src/slice1/model'
import { DurableCivic } from '../../src/slice1/store'
import { proofOperations } from '../../src/slice1/scenario'
import type { Operation } from '../../src/slice1/model'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('Slice 1 retained semantic boundaries', () => {
  it.each(['A', 'B'] as const)(
    'preserves reference categories, provenance and conflicting accountability for %s',
    (institution) => {
      const { s, operations } = proofOperations(institution)
      let state = genesis(s.seed)
      for (const op of operations) state = apply(state, s.principal, op).state
      expect(brief(state, operations.at(-1)!.at).varianceDays).toBe(4)
      expect(brief(state, operations.at(-1)!.at).conflictStatus).toBe('UNRESOLVED')
      expect(state.seed.evidence.filter((e) => e.mode === 'reference')).toHaveLength(3)
      expect(
        state.seed.evidence.every((e) => e.mode !== 'reference' || e.content === undefined),
      ).toBe(true)
      expect(
        state.seed.evidence.find((e) => e.category === 'derived_evidence')?.derivedFrom,
      ).toEqual([s.seed.items[0].expected.evidenceId, s.observation.id])
      expect(state.decisions[0].unresolvedConflict).toBe(true)
      expect(state.decisions[0].snapshot.actor.kind).toBe('human')
      const after = structuredClone(state)
      after.seed.authorities[0].actions = []
      expect(state.decisions[0].snapshot.authority.actions).toContain('decide')
    },
  )

  it.each([
    { revokedAt: '2026-10-10T18:00:00Z' },
    { expiresAt: '2026-10-10T18:30:00Z' },
    { effectiveAt: '2026-10-10T18:30:01Z' },
    { actions: ['record_evidence'] },
    { positionId: 'SYN-A-OBSERVER-POSITION' },
  ])('rejects stale or mismatched delegation %j', (patch) => {
    const s = syntheticScenario('A'),
      state = genesis(s.seed)
    Object.assign(state.seed.authorities[0], patch)
    expect(() => authoritySnapshot(state, s.principal, '2026-10-10T18:30:00Z', 'decide')).toThrow(
      'MISSING_AUTHORITY',
    )
  })
  it('keeps authentication and membership distinct from delegated institutional authority', () => {
    const s = syntheticScenario('A'),
      state = genesis(s.seed)
    expect(() => authoritySnapshot(state, s.observer, '2026-10-10T18:30:00Z', 'decide')).toThrow(
      'MISSING_AUTHORITY',
    )
    state.seed.memberships = []
    expect(() => authoritySnapshot(state, s.principal, '2026-10-10T18:30:00Z', 'decide')).toThrow(
      'NOT_FOUND',
    )
  })
  it('rejects reference document copies, promotion and cyclic derived evidence', () => {
    const { s, operations } = proofOperations('A')
    let state = genesis(s.seed)
    state = apply(state, s.principal, operations[0]).state
    for (const evidence of [
      { ...s.receipts, content: 'Fictional source document copy' },
      { ...s.derived, category: 'authoritative_record' as const },
      { ...s.derived, derivedFrom: [s.derived.id] },
    ])
      expect(() =>
        apply(state, s.principal, {
          kind: 'evidence',
          resourceId: s.itemId,
          at: '2026-10-10T18:30:01Z',
          evidence,
        }),
      ).toThrow()
  })
  it.each([NaN, Infinity, -1])('does not invent a valid observed outcome for %s', (value) => {
    const { s, operations } = proofOperations('A')
    let state = genesis(s.seed)
    for (const op of operations.slice(0, 8)) state = apply(state, s.principal, op).state
    expect(() =>
      apply(state, s.principal, {
        kind: 'outcome',
        resourceId: s.itemId,
        at: '2026-10-10T18:30:08Z',
        outcome: {
          value,
          unit: 'working_days',
          window: 'synthetic:2026-Q3',
          evidenceId: s.observation.id,
        },
      }),
    ).toThrow('INVALID_OUTCOME')
  })
  it.each([12, 12.001, 10])('preserves exact material-variance threshold at %s', (value) => {
    const { s, operations } = proofOperations('A')
    let state = genesis(s.seed)
    for (const op of operations.slice(0, 8)) state = apply(state, s.principal, op).state
    state = apply(state, s.principal, {
      kind: 'outcome',
      resourceId: s.itemId,
      at: '2026-10-10T18:30:08Z',
      outcome: {
        value,
        unit: 'working_days',
        window: 'synthetic:2026-Q3',
        evidenceId: s.observation.id,
      },
    }).state
    expect(brief(state, '2026-10-10T18:30:08Z').risks.includes('Material outcome variance')).toBe(
      value > 12,
    )
  })
  it('preserves immutable final records and rejects stale supersession', () => {
    const { s, operations } = proofOperations('A')
    let state = genesis(s.seed)
    for (const op of operations) state = apply(state, s.principal, op).state
    const wrong: Operation = {
      kind: 'decision',
      resourceId: s.itemId,
      at: '2026-10-10T18:31:00Z',
      id: 'SYN-A-WRONG',
      disposition: 'change',
      rationale: 'Fictional invalid predecessor',
      supersedes: null,
    }
    expect(() => apply(state, s.principal, wrong)).toThrow('INVALID_WORKFLOW_STATE')
    expect(() => apply(state, s.principal, operations[1])).toThrow('INVALID_WORKFLOW_STATE')
  })
})

describe('actual runtime fail-closed boundaries', () => {
  it('denies existing instances and new instances exactly at grant expiry', () => {
    const store = new DurableCivic(`expiry-proof-${Date.now()}.sqlite`)
    try {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-10-17T17:56:14Z'))
      expect(() => store.read(syntheticScenario('A').principal)).toThrow('ineffective or expired')
      expect(() => new DurableCivic('expired-new.sqlite')).toThrow('ineffective or expired')
    } finally {
      vi.useRealTimers()
      store.close()
    }
  })
  it('rejects production even in the approved branch and storage directory', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => new DurableCivic('production-denied.sqlite')).toThrow('production prohibited')
  })

  it('rechecks expiry before commit and rolls back an admitted mutation', () => {
    const { s, operations } = proofOperations('A')
    const store = new DurableCivic(`commit-expiry-${Date.now()}.sqlite`)
    try {
      store.create(s.seed, 'genesis')
      expect(() =>
        store.submit(s.principal, operations[0], 'admitted-before-expiry', 1, () => {
          vi.useFakeTimers()
          vi.setSystemTime(new Date('2026-10-17T17:56:14Z'))
        }),
      ).toThrow('ineffective or expired')
      vi.useRealTimers()
      expect(store.read(s.principal).version).toBe(1)
      expect(store.read(s.principal).state.approval).toBeNull()
    } finally {
      vi.useRealTimers()
      store.close()
    }
  })
})
