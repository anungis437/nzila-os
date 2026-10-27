import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FILES, loadContext, validateGate0 } from './ue-gate0-scope-lock.mjs'
import { lockProvenanceProblems, lockVersionFor, updatedLock } from './ue-gate0-lock-provenance.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const base = loadContext(ROOT)
const matrix = JSON.parse(readFileSync(join(ROOT, FILES.matrix), 'utf8'))
const clone = (value) => JSON.parse(JSON.stringify(value))
const byId = new Map(matrix.capabilities.map((capability) => [capability.id, capability]))
const tranches = () => [
  ['tranche0b1', 'classification0b1'], ['tranche0b2', 'classification0b2'], ['tranche0b3', 'classification0b3'], ['tranche0b4', 'classification0b4'], ['tranche0b5', 'classification0b5'], ['tranche0b6', 'classification0b6'], ['tranche0b7', 'classification0b7'], ['tranche0b8', 'classification0b8'], ['tranche0b9', 'classification0b9'],
].map(([manifestKey, classificationKey]) => ({ manifest: clone(base[manifestKey]), classification: clone(base[classificationKey]), tranche: base[manifestKey].tranche }))
const deps = { exists: (file) => existsSync(join(ROOT, file)), commitExists: () => true }

function args(overrides = {}) {
  return {
    lock: clone(base.lock),
    byId,
    anchorIds: base.anchorCapabilityIds,
    checkpointIds: clone(base.checkpointCapabilityIds),
    tranches: tranches(),
    deps,
    ...overrides,
  }
}
const problems = (overrides) => lockProvenanceProblems(args(overrides))
const has = (list, pattern) => list.some((problem) => pattern.test(problem))
const ADDED = 'UE-OMIT-CALENDAR-AND-PROVIDER-CONNECTIONS'
const addition = (lock, id = ADDED) => lock.additions.find((item) => item.capabilityId === id)

test('the committed lock has an anchor, checkpoint or addition record for every id and a matching lockVersion', () => {
  assert.deepEqual(problems(), [])
  assert.equal(base.lock.lockVersion, lockVersionFor(base.lock))
  assert.equal(base.lock.checkpoints.length, 1)
  assert.equal(base.lock.additions.length, 28)
  assert.equal(base.lock.capabilityIds.length, 96)
})

test('the lock updater is deterministic and idempotent on the committed lock', () => {
  const matrixIds = matrix.capabilities.map((capability) => capability.id)
  const first = updatedLock({ lock: clone(base.lock), matrixIds, anchorIds: base.anchorCapabilityIds, checkpointIds: base.checkpointCapabilityIds, tranches: tranches(), matrixById: byId })
  assert.deepEqual(first, base.lock)
  const second = updatedLock({ lock: first, matrixIds, anchorIds: base.anchorCapabilityIds, checkpointIds: base.checkpointCapabilityIds, tranches: tranches(), matrixById: byId })
  assert.deepEqual(second, first)
})

test('NEGATIVE: an id added to the lock by hand without an addition record is refused', () => {
  const lock = clone(base.lock)
  lock.capabilityIds.push('UE-OMIT-HAND-EDITED')
  assert.ok(has(problems({ lock }), /UE-OMIT-HAND-EDITED is in the independent lock without an anchor, checkpoint or addition record/))
})

test('NEGATIVE: an addition record that the lock does not list, or that is duplicated, is refused', () => {
  const unlisted = clone(base.lock)
  unlisted.capabilityIds = unlisted.capabilityIds.filter((id) => id !== ADDED)
  assert.ok(has(problems({ lock: unlisted }), /is not in the lock capability list/))
  const duplicated = clone(base.lock)
  duplicated.additions.push(clone(addition(duplicated)))
  assert.ok(has(problems({ lock: duplicated }), /missing or duplicated/))
})

test('NEGATIVE: an addition that no frozen tranche classified an operation to is refused', () => {
  const lock = clone(base.lock)
  const record = addition(lock)
  const evidence = tranches()
  const frozen = evidence.find((item) => item.tranche === record.tranche)
  frozen.classification.operations = frozen.classification.operations.filter((item) => item.capabilityId !== ADDED)
  const result = problems({ lock, tranches: evidence })
  assert.ok(has(result, /owns no operation that GATE-0B.4 classified; a capability is not added to reduce the undecided count/))
})

test('NEGATIVE: an addition with the wrong operations hash, the wrong count or an unknown tranche is refused', () => {
  const hash = clone(base.lock)
  addition(hash).operationsHash = '0'.repeat(64)
  assert.ok(has(problems({ lock: hash }), /does not match the frozen operations hash/))
  const count = clone(base.lock)
  addition(count).classifiedOperations += 1
  assert.ok(has(problems({ lock: count }), /records \d+ classified operation\(s\) but GATE-0B.4 classified \d+/))
  const unknown = clone(base.lock)
  addition(unknown).tranche = 'GATE-0B.9'
  assert.ok(has(problems({ lock: unknown }), /names tranche GATE-0B.9, which has no frozen classification/))
})

test('NEGATIVE: an addition without a reason, or without an implementation source file, is refused', () => {
  const reason = clone(base.lock)
  addition(reason).reason = 'short'
  assert.ok(has(problems({ lock: reason }), /has no reason/))
  const sourceless = new Map(byId)
  sourceless.set(ADDED, { ...byId.get(ADDED), sourceFiles: [] })
  assert.ok(has(problems({ byId: sourceless }), /has no existing implementation source file in the matrix/))
  const missing = new Map(byId)
  missing.set(ADDED, { ...byId.get(ADDED), sourceFiles: ['apps/union-eyes/does/not/exist.ts'] })
  assert.ok(has(problems({ byId: missing }), /has no existing implementation source file in the matrix/))
})

test('NEGATIVE: an addition cannot duplicate an anchored or checkpointed capability', () => {
  const lock = clone(base.lock)
  const anchored = base.anchorCapabilityIds[0]
  lock.additions.push({ ...clone(addition(lock)), capabilityId: anchored })
  assert.ok(has(problems({ lock }), /duplicates a capability the anchor or a checkpoint already holds/))
})

test('NEGATIVE: a capability accepted at a checkpoint cannot be dropped from the lock', () => {
  const lock = clone(base.lock)
  const dropped = Object.values(base.checkpointCapabilityIds).flat()[0]
  lock.capabilityIds = lock.capabilityIds.filter((id) => id !== dropped)
  assert.ok(has(problems({ lock }), new RegExp(`independent lock dropped capability ${dropped} accepted at checkpoint`)))
})

test('NEGATIVE: a checkpoint that is not an existing commit or cannot be read from history is refused', () => {
  const bad = clone(base.lock)
  bad.checkpoints[0].commit = 'not-a-commit'
  assert.ok(has(problems({ lock: bad }), /checkpoint 1 does not name an existing commit/))
  assert.ok(has(problems({ checkpointIds: {} }), /cannot be read from git history/))
  assert.ok(has(problems({ deps: { ...deps, commitExists: () => false } }), /does not name an existing commit/))
})

test('NEGATIVE: a lockVersion that does not follow from the checkpoints and additions is refused', () => {
  const lock = clone(base.lock)
  lock.lockVersion = 9
  assert.ok(has(problems({ lock }), /lockVersion is 9 but its checkpoints and additions require 8/))
})

test('NEGATIVE: the updater refuses a capability that no frozen tranche classified an operation to', () => {
  const lock = clone(base.lock)
  lock.capabilityIds = lock.capabilityIds.filter((id) => id !== ADDED)
  lock.additions = lock.additions.filter((item) => item.capabilityId !== ADDED)
  const evidence = tranches()
  for (const item of evidence) item.classification.operations = item.classification.operations.filter((record) => record.capabilityId !== ADDED)
  assert.throws(() => updatedLock({
    lock,
    matrixIds: matrix.capabilities.map((capability) => capability.id),
    anchorIds: base.anchorCapabilityIds,
    checkpointIds: base.checkpointCapabilityIds,
    tranches: evidence,
    matrixById: byId,
  }), /no frozen tranche classified an operation to it/)
})

test('end to end: hand-editing the independent lock to hold a new capability fails the Gate 0 validator', () => {
  const edited = clone(matrix)
  const extra = clone(edited.capabilities.find((item) => item.id === 'UE-OMIT-DELIVERY-EVIDENCE'))
  extra.id = 'UE-OMIT-HAND-EDITED'
  extra.obligationKey = 'hand-edited'
  edited.capabilities.push(extra)
  edited.lockedCapabilityIds.push(extra.id)
  const lock = clone(base.lock)
  lock.capabilityIds.push(extra.id)
  const result = validateGate0(edited, { base, lock })
  assert.ok(has(result.problems, /UE-OMIT-HAND-EDITED is in the independent lock without an anchor, checkpoint or addition record/))
  assert.ok(!has(validateGate0(matrix, { base }).problems, /independent lock/))
})
