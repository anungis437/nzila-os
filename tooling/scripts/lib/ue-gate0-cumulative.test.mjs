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
import { FILES_0B5 } from './ue-gate0b5-classification.mjs'
import { FILES_0B6 } from './ue-gate0b6-classification.mjs'
import { FILES_0B7 } from './ue-gate0b7-classification.mjs'
import { FILES_0B8 } from './ue-gate0b8-classification.mjs'
import { FILES_0B9 } from './ue-gate0b9-classification.mjs'
import { FILE_EXCEPTIONS, inventoryTotals } from './ue-gate0b6-exceptions.mjs'
import { DECISION_BOUND_OPERATIONS } from './ue-gate0b6-ids.mjs'
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
test('cumulative route-ownership counts after the ninth tranche', () => {
  const entries = base.ownership.entries
  assert.equal(entries.length, 1644)
  assert.equal(entries.filter((entry) => entry[4] === 'OWNED').length, 1226)
  assert.equal(entries.filter((entry) => entry[4] === 'SCOPE_UNDECIDED').length, 281)
  assert.equal(entries.filter((entry) => !['OWNED', 'SCOPE_UNDECIDED'].includes(entry[4])).length, 1644 - 1226 - 281)
  assert.equal(Object.keys(base.ledger0b1.classified).length, 871)
  assert.equal(matrix.routeOwnership.operations, 1644)
  assert.equal(matrix.routeDefects.length, 542)
  assert.equal(matrix.capabilities.length, 96)
  assert.equal(base.lock.capabilityIds.length, 96)
  assert.deepEqual(Object.keys(base.ledger0b1.tranches), ['GATE-0B.1', 'GATE-0B.2', 'GATE-0B.3', 'GATE-0B.4', 'GATE-0B.5', 'GATE-0B.6', 'GATE-0B.7', 'GATE-0B.8', 'GATE-0B.9'])
})

test('the six inventory categories add up to the whole universe and the four carbon operations are counted once, apart from the unexamined operations', () => {
  const totals = inventoryTotals(base.ownership.entries, new Set(DECISION_BOUND_OPERATIONS))
  assert.deepEqual(totals, {
    OWNED: 1226,
    SCOPE_UNDECIDED_AWAITING_CLASSIFICATION: 277,
    DECISION_BOUND_SCOPE_EXCEPTION: 4,
    RETIRED_501: 97,
    STUB_501: 31,
    SYSTEM: 9,
    operations: 1644,
  })
  assert.equal(1226 + 277 + 4 + 97 + 31 + 9, 1644)
  assert.deepEqual(matrix.routeInventoryTotals, totals)
  assert.equal(totals.SCOPE_UNDECIDED_AWAITING_CLASSIFICATION + totals.DECISION_BOUND_SCOPE_EXCEPTION, base.ownership.entries.filter((entry) => entry[4] === 'SCOPE_UNDECIDED').length)
})

test('the cumulative counts advance by exactly what each accepted tranche classified', () => {
  const steps = ['0B.1', '0B.2', '0B.3', '0B.4', '0B.5'].map((key) => countsAt(ACCEPTED[key]))
  assert.deepEqual(steps.map((item) => item.classified), [81, 180, 279, 375, 471])
  assert.deepEqual(steps.map((item) => item.undecided), [1071, 972, 873, 777, 681])
  assert.deepEqual(steps.map((item) => item.owned), [436, 535, 634, 730, 826])
  assert.ok(steps.every((item) => item.operations === 1644))
  assert.equal(681 - 100, 581)
  assert.equal(471 + 100, 571)
  assert.equal(826 + 100, 926)
  const sixth = countsAt(ACCEPTED['0B.6'])
  assert.deepEqual([sixth.classified, sixth.undecided, sixth.owned], [571, 581, 926])
  assert.equal(sixth.classified + 100, 671)
  const seventh = countsAt(ACCEPTED['0B.7'])
  assert.deepEqual([seventh.classified, seventh.undecided, seventh.owned], [671, 481, 1026])
  assert.equal(seventh.classified + 100, 771)
  assert.equal(seventh.owned + 100, 1126)
  assert.equal(seventh.undecided - 100, 381)
  const eighth = countsAt(ACCEPTED['0B.8'])
  assert.deepEqual([eighth.classified, eighth.undecided, eighth.owned], [771, 381, 1126])
  assert.equal(eighth.classified + 100, 871)
  assert.equal(eighth.owned + 100, 1226)
  assert.equal(eighth.undecided - 100, 281)
})

test('every accepted tranche manifest and classification is byte-identical to the commit that accepted it', () => {
  const frozen = [
    ['0B.1', [FILES_0B1.manifest, FILES_0B1.classification]],
    ['0B.2', [FILES_0B2.manifest, FILES_0B2.classification]],
    ['0B.3', [FILES_0B3.manifest, FILES_0B3.classification]],
    ['0B.4', [FILES_0B4.manifest, FILES_0B4.classification]],
    ['0B.5', [FILES_0B5.manifest, FILES_0B5.classification]],
    ['0B.6', [FILES_0B6.manifest, FILES_0B6.classification]],
    ['0B.7', [FILES_0B7.manifest, FILES_0B7.classification]],
    ['0B.8', [FILES_0B8.manifest, FILES_0B8.classification]],
  ]
  for (const [key, files] of frozen) for (const file of files) assert.equal(text(file), fileAt(ACCEPTED[key], file), `${key} ${file}`)
})

test('the matrix pins the nine tranche manifests and classifications and the cumulative ledger by hash', () => {
  const pins = [
    ['routeClassification', FILES_0B1], ['routeClassification0b2', FILES_0B2], ['routeClassification0b3', FILES_0B3], ['routeClassification0b4', FILES_0B4], ['routeClassification0b5', FILES_0B5], ['routeClassification0b6', FILES_0B6], ['routeClassification0b7', FILES_0B7], ['routeClassification0b8', FILES_0B8], ['routeClassification0b9', FILES_0B9],
  ]
  for (const [key, files] of pins) {
    assert.equal(matrix[key].files.manifest.sha256, sha(text(files.manifest)), `${key} manifest`)
    assert.equal(matrix[key].files.classification.sha256, sha(text(files.classification)), `${key} classification`)
  }
  assert.equal(matrix.decisionBoundExceptions.sha256, sha(text(FILE_EXCEPTIONS)))
})

test('earlier tranches keep their identities in the ledger and the ledger only grows', () => {
  for (const key of ['0B.1', '0B.2', '0B.3', '0B.4', '0B.5', '0B.6', '0B.7', '0B.8']) {
    const accepted = ledgerAt(ACCEPTED[key])
    for (const [id, owner] of Object.entries(accepted.classified)) assert.equal(base.ledger0b1.classified[id], owner, `${key} ${id}`)
    for (const [tranche, record] of Object.entries(accepted.tranches)) assert.equal(base.ledger0b1.tranches[tranche].operationsHash, record.operationsHash, `${key} ${tranche}`)
  }
  const acceptedLast = ledgerAt(ACCEPTED['0B.8'])
  const moved = Object.entries(acceptedLast.classifiedIn).filter(([id, tranche]) => base.ledger0b1.classifiedIn[id] !== tranche)
  assert.deepEqual(moved, [], 'no earlier classification changed the tranche that classified it')
  const added = Object.keys(base.ledger0b1.classified).filter((id) => !(id in acceptedLast.classified))
  assert.equal(added.length, 100)
  assert.ok(added.every((id) => base.ledger0b1.classifiedIn[id] === 'GATE-0B.9'))
  assert.ok(DECISION_BOUND_OPERATIONS.every((id) => !(id in base.ledger0b1.classified)), 'a decision-bound exception is never recorded as classified')
})

test('Gate 0 validates the cumulative registers and stays IN_PROGRESS with the carbon decision outstanding and the exceptions distinct', () => {
  const result = validateGate0(matrix, { base })
  assert.deepEqual(result.problems, [])
  assert.equal(result.summary.verdict, 'IN_PROGRESS')
  assert.equal(result.summary.capabilityCount, 96)
  assert.ok(result.blockers.some((item) => item.code === 'ROUTE_SCOPE_UNDECIDED' && item.operations === 277))
  assert.ok(result.blockers.some((item) => item.code === 'ROUTE_DECISION_BOUND_SCOPE_EXCEPTION' && item.operations === 4))
  assert.ok(base.classification0b9.institutionalDecisions.some((decision) => decision.id === 'UE-INST-CARBON-ACCOUNTING-SCOPE' && decision.status === 'OUTSTANDING'))
  assert.ok(base.classification0b5.institutionalDecisions.some((decision) => decision.id === 'UE-INST-CARBON-ACCOUNTING-SCOPE' && decision.status === 'OUTSTANDING'))
  assert.ok(base.classification0b5.institutionalDecisions.some((decision) => decision.id === 'UE-INST-COMMUNICATIONS-CAMPAIGN-OWNER' && decision.status === 'OUTSTANDING'))
})
