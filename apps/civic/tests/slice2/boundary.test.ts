import { expect, it } from 'vitest'
import { Slice2Store, digest, type Options, type Stage } from '../../src/slice2/store'
import { proofOperations } from '../../src/slice1/scenario'
import { guardLog, retain, runWorker } from '../../src/slice2/harness'

it('persists the exact post-governance final authority snapshot; no after-append callback; caller mutation cannot change the staged command', async () => {
  const id = `boundary-exact-${Date.now()}`
  const callsBefore = guardLog().length
  const { s, operations } = proofOperations('A')
  const reader = structuredClone(s.principal)
  const principal = structuredClone(s.principal)
  const decision = structuredClone(operations.at(-1)!)
  if (decision.kind !== 'decision') throw new Error('INVALID_DECISION_FIXTURE')
  const originalRationale = decision.rationale
  let clock = '2026-10-12T17:00:00.123Z'
  let armed = false
  let hookGuardCount = -1
  const stages: Stage[] = []
  const clockSamples: { at: string; completedGuardCalls: number }[] = []
  const options: Options = {
    proofClock: () => {
      clockSamples.push({ at: clock, completedGuardCalls: guardLog().length })
      return clock
    },
    hook: (stage) => {
      stages.push(stage)
      if (armed && stage === 'precommit') {
        clock = '2026-10-12T18:00:00.987Z'
        hookGuardCount = guardLog().length
        decision.rationale = 'Synthetic caller mutation after draft preparation'
        principal.orgId = 'SYN-B-ORG'
      }
      if (armed && stage === 'committed') clock = '2030-01-01T00:00:00Z'
    },
  }
  const store = new Slice2Store(`${id}.sqlite`, options)
  try {
    store.create(s.seed)
    store.submit(reader, operations[0], 'authorize', 1)
    stages.length = 0
    armed = true
    const receipt = store.submit(principal, decision, 'exact-boundary', 2)
    const finalClock = clockSamples.at(-1)!
    expect(finalClock).toEqual({
      at: '2026-10-12T18:00:00.987Z',
      completedGuardCalls: hookGuardCount + 1,
    })
    expect(stages).toEqual(['before-lock', 'locked', 'before-append', 'precommit', 'committed'])
    clock = finalClock.at
    armed = false
    const read = store.read(reader)
    const event = read.events.at(-1)!
    if (event.payload.kind !== 'operation' || event.payload.operation.kind !== 'decision')
      throw new Error('INVALID_PERSISTED_EVENT')
    const boundary = store.boundaryEvidence.at(-1)!
    expect(event.payload.finalSnapshot.evaluatedAt).toBe(finalClock.at)
    expect(event.recordedAt).toBe(finalClock.at)
    expect(boundary.evaluatedAt).toBe(finalClock.at)
    expect(boundary.snapshotDigest).toBe(digest(event.payload.finalSnapshot))
    expect(boundary.persistedEventHash).toBe(event.hash)
    expect(event.payload.principal.orgId).toBe(reader.orgId)
    expect(event.payload.operation.rationale).toBe(originalRationale)
    store.close()
    const fresh = await runWorker({ mode: 'read', file: `${id}.sqlite`, institution: 'A' })
    expect(fresh.code, JSON.stringify(fresh)).toBe(0)
    const recovered = fresh.message!.result as ReturnType<Slice2Store['read']>
    expect(recovered.events.at(-1)).toEqual(event)
    retain(`${id}-results.json`, {
      classification: 'LOCAL_SYNTHETIC_PROOF_ARTIFACT',
      sequence:
        'LOCK_PREPARE_HOOKS_UNCACHED_GOVERNANCE_FINAL_LIVE_AUTHORITY_SYNC_APPEND_HASH_COMMIT',
      receipt,
      event,
      boundary,
      stages,
      finalClock,
      hookGuardCount,
      callerMutationExcluded: true,
      freshExitedReader: fresh,
      authorizationCalls: guardLog().slice(callsBefore),
    })
  } finally {
    store.close()
  }
})

it('rolls back authority expiry observed only after the actual expensive governance check, before any append', () => {
  const id = `boundary-expiry-${Date.now()}`
  const callsBefore = guardLog().length
  const { s, operations } = proofOperations('B')
  const seed = structuredClone(s.seed)
  seed.authorities[0].expiresAt = '2026-11-01T00:00:00Z'
  let armed = false
  let hookGuardCount = -1
  const clockSamples: { at: string; completedGuardCalls: number }[] = []
  const store = new Slice2Store(`${id}.sqlite`, {
    proofClock: () => {
      const completedGuardCalls = guardLog().length
      const at =
        armed && hookGuardCount >= 0 && completedGuardCalls > hookGuardCount
          ? '2026-11-02T00:00:00Z'
          : '2026-10-31T23:59:59Z'
      clockSamples.push({ at, completedGuardCalls })
      return at
    },
    hook: (stage) => {
      if (armed && stage === 'precommit') hookGuardCount = guardLog().length
    },
  })
  try {
    store.create(seed)
    store.submit(s.principal, operations[0], 'authorize', 1)
    const before = store.read(s.principal)
    armed = true
    expect(() => store.submit(s.principal, operations.at(-1)!, 'late-expiry', 2)).toThrow(
      'MISSING_AUTHORITY',
    )
    const finalClock = clockSamples.at(-1)!
    expect(finalClock).toEqual({
      at: '2026-11-02T00:00:00Z',
      completedGuardCalls: hookGuardCount + 1,
    })
    const finalGovernance = guardLog().at(-1)!
    expect(finalGovernance.error).toBeNull()
    armed = false
    const after = store.read(s.principal)
    expect(after.version).toBe(2)
    expect(after.state.decisions).toHaveLength(0)
    expect(digest(after.state)).toBe(digest(before.state))
    const retry = store.submit(s.principal, operations.at(-1)!, 'late-expiry', 2)
    expect(retry.replay).toBe(false)
    retain(`${id}-results.json`, {
      classification: 'LOCAL_SYNTHETIC_PROOF_ARTIFACT',
      finalClock,
      hookGuardCount,
      finalGovernance,
      rolledBackVersion: after.version,
      unchangedStateDigest: digest(after.state),
      noFailedSuccessReceipt: !retry.replay,
      retry,
      authorizationCalls: guardLog().slice(callsBefore),
    })
  } finally {
    store.close()
  }
})
