import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { FILES, loadContext, validateGate0 } from './ue-gate0-scope-lock.mjs'
import { FILES_0B1 } from './ue-gate0b1-classification.mjs'
import { FILES_0B2 } from './ue-gate0b2-classification.mjs'
import { FILES_0B3 } from './ue-gate0b3-classification.mjs'
import { FILES_0B4 } from './ue-gate0b4-classification.mjs'
import { ACCEPTED, countsAt, fileAt, ledgerAt } from './ue-gate0-history.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const base = loadContext(ROOT)
const text = (file) => readFileSync(join(ROOT, file), 'utf8')
const matrix = JSON.parse(text(FILES.matrix))
const sha = (value) => createHash('sha256').update(value).digest('hex')

/**
 * The only test that reads the cumulative registers. Each historical tranche test is anchored to the commit that
 * accepted the tranche; the numbers that move from tranche to tranche live here and nowhere else.
 */
test('cumulative route-ownership counts after the fourth tranche', () => {
  const entries = base.ownership.entries
  assert.equal(entries.length, 1644)
  assert.equal(entries.filter((entry) => entry[4] === 'OWNED').length, 730)
  assert.equal(entries.filter((entry) => entry[4] === 'SCOPE_UNDECIDED').length, 777)
  assert.equal(entries.filter((entry) => !['OWNED', 'SCOPE_UNDECIDED'].includes(entry[4])).length, 1644 - 730 - 777)
  assert.equal(Object.keys(base.ledger0b1.classified).length, 375)
  assert.equal(matrix.routeOwnership.operations, 1644)
  assert.equal(matrix.routeDefects.length, 136)
  assert.equal(matrix.capabilities.length, 74)
  assert.equal(base.lock.capabilityIds.length, 74)
  assert.deepEqual(Object.keys(base.ledger0b1.tranches), ['GATE-0B.1', 'GATE-0B.2', 'GATE-0B.3', 'GATE-0B.4'])
})

test('the cumulative counts advance by exactly what each accepted tranche classified', () => {
  const steps = ['0B.1', '0B.2', '0B.3'].map((key) => countsAt(ACCEPTED[key]))
  assert.deepEqual(steps.map((item) => item.classified), [81, 180, 279])
  assert.deepEqual(steps.map((item) => item.undecided), [1071, 972, 873])
  assert.deepEqual(steps.map((item) => item.owned), [436, 535, 634])
  assert.ok(steps.every((item) => item.operations === 1644))
  assert.equal(873 - 96, 777)
  assert.equal(279 + 96, 375)
})

test('every accepted tranche manifest and classification is byte-identical to the commit that accepted it', () => {
  const frozen = [
    ['0B.1', [FILES_0B1.manifest, FILES_0B1.classification]],
    ['0B.2', [FILES_0B2.manifest, FILES_0B2.classification]],
    ['0B.3', [FILES_0B3.manifest, FILES_0B3.classification]],
  ]
  for (const [key, files] of frozen) for (const file of files) assert.equal(text(file), fileAt(ACCEPTED[key], file), `${key} ${file}`)
})

test('the matrix pins the four tranche manifests and classifications and the cumulative ledger by hash', () => {
  const pins = [
    ['routeClassification', FILES_0B1], ['routeClassification0b2', FILES_0B2], ['routeClassification0b3', FILES_0B3], ['routeClassification0b4', FILES_0B4],
  ]
  for (const [key, files] of pins) {
    assert.equal(matrix[key].files.manifest.sha256, sha(text(files.manifest)), `${key} manifest`)
    assert.equal(matrix[key].files.classification.sha256, sha(text(files.classification)), `${key} classification`)
  }
})

test('earlier tranches keep their identities in the ledger and the ledger only grows', () => {
  for (const key of ['0B.1', '0B.2', '0B.3']) {
    const accepted = ledgerAt(ACCEPTED[key])
    for (const [id, owner] of Object.entries(accepted.classified)) assert.equal(base.ledger0b1.classified[id], owner, `${key} ${id}`)
    for (const [tranche, record] of Object.entries(accepted.tranches)) assert.equal(base.ledger0b1.tranches[tranche].operationsHash, record.operationsHash, `${key} ${tranche}`)
  }
  const acceptedLast = ledgerAt(ACCEPTED['0B.3'])
  const moved = Object.entries(acceptedLast.classifiedIn).filter(([id, tranche]) => base.ledger0b1.classifiedIn[id] !== tranche)
  assert.deepEqual(moved, [], 'no earlier classification changed the tranche that classified it')
  const added = Object.keys(base.ledger0b1.classified).filter((id) => !(id in acceptedLast.classified))
  assert.equal(added.length, 96)
  assert.ok(added.every((id) => base.ledger0b1.classifiedIn[id] === 'GATE-0B.4'))
})

test('Gate 0 validates the cumulative registers and stays IN_PROGRESS with the carbon decision outstanding', () => {
  const result = validateGate0(matrix, { base })
  assert.deepEqual(result.problems, [])
  assert.equal(result.summary.verdict, 'IN_PROGRESS')
  assert.equal(result.summary.capabilityCount, 74)
  assert.ok(base.classification0b4.institutionalDecisions.some((decision) => decision.id === 'UE-INST-CARBON-ACCOUNTING-SCOPE' && decision.status === 'OUTSTANDING'))
  assert.ok(base.classification0b4.institutionalDecisions.some((decision) => decision.id === 'UE-INST-COMMUNICATIONS-CAMPAIGN-OWNER' && decision.status === 'OUTSTANDING'))
})
