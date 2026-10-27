import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FILES, loadContext, validateGate0 } from './ue-gate0-scope-lock.mjs'
import { UNDECIDED_OWNER, routeKeys } from './ue-gate0-route-ownership.mjs'
import { FILES_0B1 } from './ue-gate0b1-classification.mjs'
import { FILES_0B2 } from './ue-gate0b2-classification.mjs'
import { FILES_0B3 } from './ue-gate0b3-classification.mjs'
import { FILES_0B4 } from './ue-gate0b4-classification.mjs'
import { FILES_0B5 } from './ue-gate0b5-classification.mjs'
import { FILES_0B6 } from './ue-gate0b6-classification.mjs'
import { FILES_0B7 } from './ue-gate0b7-classification.mjs'
import { FILES_0B8, NEW_CAPABILITY_IDS, validateClassification8 } from './ue-gate0b8-classification.mjs'
import { RISK_CATEGORIES, RISK_SCREENS, riskCategoryProblems, riskTriggers } from './ue-gate0b8-risk-screen.mjs'
import { ANCHOR_COMMIT, DECISION_BOUND_OPERATIONS, TRANCHE_SIZE } from './ue-gate0b8-ids.mjs'
import { FILE_EXCEPTIONS, inventoryTotals, inventoryTotalsProblems, validateDecisionBoundExceptions } from './ue-gate0b6-exceptions.mjs'
import { anchoredEntries } from './ue-gate0b8-build-classification.mjs'
import { buildReviewQueue, defectHash, releaseDispositionProblems } from './ue-gate0b7-release-dispositions.mjs'
import { ACCEPTED, countsAt, fileAt, ledgerAt, matrixAt } from './ue-gate0-history.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const base = loadContext(ROOT)
const matrix = JSON.parse(readFileSync(join(ROOT, FILES.matrix), 'utf8'))
const clone = (value) => JSON.parse(JSON.stringify(value))
const sha = (value) => createHash('sha256').update(value).digest('hex')
const existsCache = new Map()
const textCache = new Map()
const exists = (file) => {
  if (!existsCache.has(file)) existsCache.set(file, existsSync(join(ROOT, file)))
  return existsCache.get(file)
}
const readText = (file) => {
  if (!textCache.has(file)) textCache.set(file, readFileSync(join(ROOT, file), 'utf8'))
  return textCache.get(file)
}

const exceptionOperations = () => new Set(DECISION_BOUND_OPERATIONS)
const ownershipAtAcceptance = base.anchoredOwnershipEntries0b9
const acceptedMatrix = matrixAt(ACCEPTED['0B.8'])
const acceptedLock = JSON.parse(fileAt(ACCEPTED['0B.8'], FILES.lock))

function fixture() {
  return {
    classification: clone(base.classification0b8),
    manifest: clone(base.tranche0b8),
    ledger: clone(ledgerAt(ACCEPTED['0B.8'])),
    classification0b1: clone(base.classification0b1),
    classification0b2: clone(base.classification0b2),
    classification0b3: clone(base.classification0b3),
    classification0b4: clone(base.classification0b4),
    classification0b5: clone(base.classification0b5),
    classification0b6: clone(base.classification0b6),
    classification0b7: clone(base.classification0b7),
    manifest0b1: clone(base.tranche0b1),
    manifest0b2: clone(base.tranche0b2),
    manifest0b3: clone(base.tranche0b3),
    manifest0b4: clone(base.tranche0b4),
    manifest0b5: clone(base.tranche0b5),
    manifest0b6: clone(base.tranche0b6),
    manifest0b7: clone(base.tranche0b7),
    reviewQueue: clone(base.reviewQueue0b7),
    entries: clone(ownershipAtAcceptance),
    capabilityById: new Map(matrix.capabilities.map((capability) => [capability.id, capability])),
    universe: new Set(routeKeys(base.routes)),
    exists,
    readText,
    anchoredEntries: clone(base.anchoredOwnershipEntries0b8),
    exceptionIds: exceptionOperations(),
  }
}

function exceptionFixture() {
  const args = fixture()
  return {
    register: clone(base.exceptionRegister),
    classification0b4: args.classification0b4,
    classification0b5: args.classification0b5,
    latestDecisions: args.classification.institutionalDecisions,
    defectRegister: args.classification.defectRegister,
    ledger: args.ledger,
    entries: args.entries,
    capabilityById: args.capabilityById,
    universe: args.universe,
    laterOperations: new Set([...args.manifest0b6.operations, ...args.manifest0b7.operations, ...args.manifest.operations]),
  }
}

const run = (args) => validateClassification8(args)
const runExceptions = (args) => validateDecisionBoundExceptions(args)
const record = (args, id) => args.classification.operations.find((item) => item.id === id)
const entryOf = (args, id) => args.entries.find((entry) => `${entry[0]}|${entry[1]}` === id)
const defectOf = (args, id) => args.classification.defectRegister.find((item) => item.id === id)
const hasProblem = (result, pattern) => (Array.isArray(result) ? result : result.problems).some((problem) => pattern.test(problem))
const newDefects = (args) => args.classification.defectRegister.filter((defect) => defect.tranche === '0B.8')
const highNew = (args) => newDefects(args).filter((defect) => defect.severity === 'HIGH')
const ctx = { exists, readText }

const CARBON_DASHBOARD = 'carbon/dashboard/route.ts|GET'
const CARBON_POST = 'carbon/validate/route.ts|POST'
const FIRST_NEW = 'external/documents/[id]/route.ts|GET'
const LAST_NEW = 'meeting-rooms/[id]/bookings/route.ts|GET'
const PUBLISH_POST = 'health-safety/hazards/route.ts|POST'
const SSO_POST = 'health-safety/incidents/route.ts|POST'
const EQUITY_GET = 'health-safety/dashboard/route.ts|GET'
const DOWNLOAD_GET = 'external/documents/[id]/route.ts|GET'
const EARLIER_CLASSIFIED = 'enterprise/integrations/route.ts|POST'
const EARLIER_DEFECT = 'DEF-0B6-CMP-VALIDATE-ATTESTS-FROM-CALLER-DATA'
const EARLIER_HIGH = 'DEF-0B6-CMP-VALIDATE-ATTESTS-FROM-CALLER-DATA'
const PRIOR_DISPOSITIONED = 'DEF-0B7-EXC-READS-IGNORE-SENSITIVITY-LEVEL'
const PRIOR_CONDITIONAL = 'DEF-0B7-PLT-EXT-GET-RETURNS-WHOLE-INTEGRATION-ROW-WITH-CREDENTIALS'
const NO_CALLER = 'external/grievances/[id]/documents/upload/route.ts|POST'
const XT_KB_ITEM = 'knowledge-base/[id]/route.ts|GET'
const GET_SIDE_EFFECT = 'location/geofence/route.ts|GET'
const RLS_SCREENED = 'location/consent/route.ts|POST'

test('the committed Gate 0B.8 registers validate against the live source', () => {
  const result = run(fixture())
  assert.deepEqual(result.problems, [])
  assert.deepEqual(result.summary, {
    tranche: 'GATE-0B.8',
    examined: 100,
    carriedForward: 0,
    decisionBoundExcluded: 4,
    newlyExamined: 100,
    classified: 100,
    unresolved: 0,
    newDefects: 82,
    defectsTotal: 451,
    institutionalDecisions: 30,
    crossTenantExposures: 2,
    newCapabilities: 3,
    newHighDefects: 12,
    releaseDispositions: { RELEASE_BLOCKING: 4, CONDITIONALLY_BLOCKING: 8, NON_BLOCKING_WITH_JUSTIFICATION: 0 },
    reviewQueue: 71,
    riskCategoryDefects: {
      SENSITIVE_SOURCE_IN_DERIVED_OUTPUT: 3,
      PUBLICATION_BYPASSES_CLASSIFICATION_OR_CONSENT: 1,
      ANALYTICS_CROSSES_BOUNDARY: 4,
      RLS_ASSUMED_FROM_DB_CLIENT: 4,
      AUDIT_OUTSIDE_DATA_TRANSACTION: 4,
      GET_WITH_SIDE_EFFECTS: 4,
      FABRICATED_INSTITUTIONAL_FINDING: 17,
      EXTERNAL_DISCLOSURE_WITHOUT_DECISION: 1,
    },
    riskScreens: 6,
    preservedReleaseBlockingDispositions: 4,
  })
})

test('the tranche freezes exactly 100 previously unexamined operations in ascending order at the Gate 0B.7 acceptance commit and carries nothing forward', () => {
  const args = fixture()
  assert.equal(args.manifest.size, TRANCHE_SIZE)
  assert.equal(args.manifest.operations.length, 100)
  assert.equal(args.manifest.anchorCommit, ACCEPTED['0B.7'])
  assert.equal(ANCHOR_COMMIT, ACCEPTED['0B.7'])
  assert.equal(args.manifest.anchorCommit.length, 40)
  assert.deepEqual(args.manifest.carryForward, [])
  assert.deepEqual(args.manifest.newOperations, args.manifest.operations)
  assert.equal(args.manifest.operations[0], FIRST_NEW)
  assert.equal(args.manifest.operations[99], LAST_NEW)
  assert.deepEqual(args.manifest.operations, [...args.manifest.operations].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)))
  const examined = new Set([args.manifest0b1, args.manifest0b2, args.manifest0b3, args.manifest0b4, args.manifest0b5, args.manifest0b6, args.manifest0b7].flatMap((item) => item.operations))
  for (const id of args.manifest.operations) assert.ok(!examined.has(id), id)
  for (const id of DECISION_BOUND_OPERATIONS) assert.ok(!args.manifest.operations.includes(id), id)
  const undecided = anchoredEntries().filter((entry) => entry[4] === 'SCOPE_UNDECIDED').map((entry) => `${entry[0]}|${entry[1]}`).filter((id) => !DECISION_BOUND_OPERATIONS.includes(id)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  assert.deepEqual(args.manifest.operations, undecided.slice(0, 100))
  assert.deepEqual(args.manifest.excludedDecisionBound, [...DECISION_BOUND_OPERATIONS].sort())
  assert.equal(args.manifest.version, 1)
  assert.equal(args.manifest.versionLog.length, 1)
  assert.equal(args.manifest.operationsHash, args.manifest.versionLog[0].operationsHash)
  assert.equal(args.manifest.operationsHash, '6b878d9c7abb599f60eae09713099d0e8f6b52aaaae6bdd3c0b1a6c3bcb136af')
  assert.equal(args.ledger.tranches['GATE-0B.8'].operationsHash, args.manifest.operationsHash)
})

test('the manifest records the provenance of each earlier tranche exactly as the ledger holds it', () => {
  const args = fixture()
  assert.deepEqual(args.manifest.priorTranches.map((item) => item.tranche), ['GATE-0B.1', 'GATE-0B.2', 'GATE-0B.3', 'GATE-0B.4', 'GATE-0B.5', 'GATE-0B.6', 'GATE-0B.7'])
  for (const item of args.manifest.priorTranches) {
    assert.equal(item.operationsHash, args.ledger.tranches[item.tranche].operationsHash, item.tranche)
    assert.equal(item.version, 1, item.tranche)
  }
})

test('the four carbon operations stay decision-bound exceptions: not selected, not owned, not classified, not approved', () => {
  const args = fixture()
  for (const id of DECISION_BOUND_OPERATIONS) {
    assert.ok(!args.classification.operations.some((item) => item.id === id), id)
    assert.equal(entryOf(args, id)[4], 'SCOPE_UNDECIDED', id)
    assert.equal(entryOf(args, id)[3], UNDECIDED_OWNER, id)
    assert.ok(!(id in args.ledger.classified), id)
  }
  const decision = args.classification.institutionalDecisions.find((item) => item.id === 'UE-INST-CARBON-ACCOUNTING-SCOPE')
  assert.equal(decision.status, 'OUTSTANDING')
  assert.ok(!matrix.capabilities.some((item) => /carbon/i.test(item.id)), 'no capability was created for the carbon routes')
  const result = runExceptions(exceptionFixture())
  assert.deepEqual(result.problems, [])
  assert.deepEqual(result.summary, { exceptions: 4, decisionIds: ['UE-INST-CARBON-ACCOUNTING-SCOPE'] })
  for (const item of base.exceptionRegister.exceptions) {
    assert.equal(item.adopted, false, item.id)
    assert.equal(item.authorized, false, item.id)
    assert.equal(item.countedAsOwned, false, item.id)
    assert.equal(item.productionReady, false, item.id)
  }
  assert.equal(ownershipAtAcceptance.filter((entry) => entry[4] === 'SCOPE_UNDECIDED').length, 381, 'the 377 awaiting operations plus the four exceptions')
})

test('every classified record cites its route file, states the authorization applied, names callers, audit and dependency gates, and has provenance for each material claim', () => {
  const args = fixture()
  for (const item of args.classification.operations) {
    assert.equal(item.status, 'CLASSIFIED', item.id)
    assert.ok(item.evidence.some((citation) => citation.ref === `apps/union-eyes/app/api/${item.route}`), item.id)
    assert.equal(item.kernelAuthorization, false, item.id)
    assert.ok(Array.isArray(item.callers), item.id)
    assert.ok(item.callerFinding.length > 20, item.id)
    assert.ok(item.requiredAudit.length > 15, item.id)
    assert.ok(Array.isArray(item.dependencyGates), item.id)
    for (const evidence of item.evidence) assert.ok(['ROUTE_HANDLER_DIRECT', 'ROUTE_IMPORTED_HELPER', 'SERVICE_IMPLEMENTATION', 'SCHEMA_OR_POLICY'].includes(evidence.provenance), `${item.id}: ${evidence.provenance}`)
    for (const claim of ['authentication', 'authorization', 'tenantScope', 'mutation']) assert.ok(item.evidence.some((evidence) => evidence.claim === claim), `${item.id} ${claim}`)
    assert.ok(entryOf(args, item.id)[2].startsWith('RULE-0B8-'), item.id)
    assert.equal(entryOf(args, item.id)[4], 'OWNED', item.id)
  }
  assert.equal(record(args, PUBLISH_POST).mutationAudit, 'ATOMIC_AUDIT_IN_TRANSACTION')
  assert.equal(record(args, DOWNLOAD_GET).mutationAudit, 'SEPARATE_AUDIT_EVENT_NOT_ATOMIC')
  assert.equal(record(args, 'icra/report/[assessmentId]/review/route.ts|POST').mutationAudit, 'ATOMIC_AUDIT_LOCAL_PART_ONLY')
  assert.equal(record(args, 'integrations/framework/[id]/sync/route.ts|POST').mutationAudit, 'INTENT_OUTCOME_AUDIT_NOT_ATOMIC')
  assert.ok(record(args, DOWNLOAD_GET).manifestCorrections.some((item) => item.field === 'mutating'))
})

test('the three new capabilities are justified by classified operations, sit in the matrix and the lock, and none exists to reduce the undecided count', () => {
  assert.equal(NEW_CAPABILITY_IDS.length, 3)
  const lock = JSON.parse(readFileSync(join(ROOT, FILES.lock), 'utf8'))
  const additions = new Map(lock.additions.map((item) => [item.capabilityId, item]))
  for (const id of NEW_CAPABILITY_IDS) {
    const capability = matrix.capabilities.find((item) => item.id === id)
    assert.ok(capability, id)
    assert.ok(Number.isInteger(capability.primaryGate), id)
    assert.ok(capability.sourceFiles.length > 0 && capability.sourceFiles.every(exists), `${id} cites existing implementation source`)
    assert.ok(lock.capabilityIds.includes(id), id)
    const addition = additions.get(id)
    assert.equal(addition.tranche, 'GATE-0B.8', id)
    assert.equal(addition.operationsHash, base.tranche0b8.operationsHash, id)
    assert.equal(addition.classifiedOperations, base.classification0b8.operations.filter((item) => item.capabilityId === id).length, id)
    assert.ok(addition.classifiedOperations >= 1, id)
    assert.ok(String(capability.gap).length > 200, `${id} records its business justification and what the source lacks`)
    assert.doesNotMatch(JSON.stringify(capability), /PROVEN_IN_STAGING|"status":"complete"|"delivered"/)
  }
  assert.deepEqual(Object.fromEntries(NEW_CAPABILITY_IDS.map((id) => [id, matrix.capabilities.find((item) => item.id === id).primaryGate])), {
    'UE-OMIT-FEDERATION-LOCAL-HIERARCHY': 14,
    'UE-OMIT-ICRA-PUBLIC-ASSESSMENT': 14,
    'UE-OMIT-REWARDS-REDEMPTION-FULFILMENT': 14,
  })
  assert.equal(acceptedMatrix.capabilities.length, 93)
  assert.equal(acceptedLock.capabilityIds.length, 93)
  assert.ok(!NEW_CAPABILITY_IDS.includes('UE-OMIT-ROUTE-DOMAIN-SCOPE'))
})

test('the 82 new defects each have one responsible capability that owns the repair gate and are cited, and the earlier 369 are untouched', () => {
  const args = fixture()
  const added = newDefects(args)
  assert.equal(added.length, 82)
  for (const defect of added) {
    assert.ok(args.capabilityById.has(defect.ownerCapabilityId), defect.id)
    assert.equal(args.capabilityById.get(defect.ownerCapabilityId).primaryGate, defect.gate, defect.id)
    assert.ok(args.classification.operations.some((item) => item.defects.includes(defect.id)), defect.id)
    assert.ok(defect.id.startsWith('DEF-0B8-'), defect.id)
    assert.equal(typeof defect.releaseBlocking, 'boolean', defect.id)
  }
  assert.equal(args.classification.defectRegister.length, 451)
  assert.deepEqual(args.classification.defectRegister.slice(0, 369), base.classification0b7.defectRegister)
  const accepted = matrixAt(ACCEPTED['0B.7']).routeDefects
  assert.equal(accepted.length, 369)
  assert.equal(acceptedMatrix.routeDefects.length, 451)
  const current = new Map(acceptedMatrix.routeDefects.map((defect) => [defect.id, defect]))
  for (const defect of accepted) assert.deepEqual(current.get(defect.id), defect, defect.id)
  const acceptedHigh = accepted.filter((defect) => defect.severity === 'HIGH').length
  assert.equal(acceptedHigh, 84, '71 earlier HIGH defects plus the 13 of Gate 0B.7')
})

test('every new HIGH defect records a release disposition proved against the source, and none is downgraded for being found in an inventory phase', () => {
  const args = fixture()
  const high = highNew(args)
  assert.equal(high.length, 12)
  const counts = { RELEASE_BLOCKING: 0, CONDITIONALLY_BLOCKING: 0, NON_BLOCKING_WITH_JUSTIFICATION: 0 }
  for (const defect of high) {
    const disposition = defect.releaseDisposition
    assert.ok(disposition, defect.id)
    counts[disposition.disposition] += 1
    assert.deepEqual(releaseDispositionProblems(defect, ctx), [], defect.id)
    assert.ok(disposition.activationEvidence.length > 0, defect.id)
    assert.equal(defect.releaseBlocking, disposition.disposition === 'RELEASE_BLOCKING', defect.id)
    assert.doesNotMatch(disposition.justification, /inventory[- ]only|found (during|in) (an )?inventory/i, defect.id)
  }
  assert.deepEqual(counts, { RELEASE_BLOCKING: 4, CONDITIONALLY_BLOCKING: 8, NON_BLOCKING_WITH_JUSTIFICATION: 0 })
  assert.ok(newDefects(args).filter((defect) => defect.severity !== 'HIGH').every((defect) => defect.releaseBlocking === false || defect.releaseDisposition), 'a non-HIGH defect is release blocking only through a disposition')
  const gate = validateGate0(matrix, { base })
  assert.equal(gate.gateAcceptanceBlockers.filter((item) => item.kind === 'RELEASE_BLOCKING_DEFECT_DISPOSITION' && /DEF-0B(7|8)-/.test(JSON.stringify(item))).length, 8, 'four preserved from Gate 0B.7 and four recorded here; the live gate adds the Gate 0B.9 dispositions')
  assert.equal(gate.gateAcceptanceBlockers.filter((item) => item.kind === 'RELEASE_BLOCKING_ROUTE_EXPOSURE').length, 3)
})

test('the review queue holds every one of the 71 HIGH defects of Gate 0B.1 to Gate 0B.6 with its original severity, release mark and hash, and assigns no disposition', () => {
  const args = fixture()
  const high = args.classification.defectRegister.filter((defect) => !['0B.7', '0B.8'].includes(defect.tranche) && defect.severity === 'HIGH')
  assert.equal(high.length, 71)
  assert.equal(args.reviewQueue.entries.length, 71)
  for (const defect of high) {
    const entry = args.reviewQueue.entries.find((item) => item.defectId === defect.id)
    assert.ok(entry, defect.id)
    assert.equal(entry.defectSha256, defectHash(defect), defect.id)
    assert.equal(entry.originalSeverity, 'HIGH', defect.id)
    assert.equal(entry.originalReleaseBlocking, defect.releaseBlocking === true, defect.id)
    assert.equal(entry.releaseDisposition, null, defect.id)
    assert.equal(entry.qualifiedBy, null, defect.id)
    assert.ok(!('releaseDisposition' in defect), `${defect.id} is not rewritten in place`)
  }
  assert.deepEqual(buildReviewQueue({ defectRegister: args.classification.defectRegister, anchorCommit: args.reviewQueue.anchorCommit }), args.reviewQueue)
  const accepted = matrixAt(ACCEPTED['0B.6']).routeDefects.filter((defect) => defect.severity === 'HIGH')
  assert.equal(accepted.length, 71)
  assert.equal(readText(FILES_0B7.reviewQueue), fileAt(ACCEPTED['0B.7'], FILES_0B7.reviewQueue), 'the review queue is byte-identical to the accepted commit')
  const releaseBlockingBefore = accepted.filter((defect) => defect.releaseBlocking === true).length
  assert.equal(releaseBlockingBefore, args.reviewQueue.entries.filter((entry) => entry.originalReleaseBlocking).length)
  assert.equal(releaseBlockingBefore, 0, 'none of the earlier HIGH defects was recorded as release blocking and none is relabelled here')
})

test('earlier tranche files are byte-identical to the accepted commits and the ledger only grows', () => {
  for (const [key, files] of [['0B.1', FILES_0B1], ['0B.2', FILES_0B2], ['0B.3', FILES_0B3], ['0B.4', FILES_0B4], ['0B.5', FILES_0B5], ['0B.6', FILES_0B6], ['0B.7', FILES_0B7]]) {
    for (const file of [files.manifest, files.classification]) assert.equal(readText(file), fileAt(ACCEPTED[key], file), `${key} ${file}`)
  }
  assert.equal(readText(FILE_EXCEPTIONS), fileAt(ACCEPTED['0B.7'], FILE_EXCEPTIONS))
  const args = fixture()
  const anchored = ledgerAt(ANCHOR_COMMIT)
  for (const [id, owner] of Object.entries(anchored.classified)) assert.equal(args.ledger.classified[id], owner, id)
  for (const [id, tranche] of Object.entries(anchored.classifiedIn)) assert.equal(args.ledger.classifiedIn[id], tranche, id)
  assert.equal(Object.keys(anchored.classified).length, 671)
  assert.equal(Object.keys(args.ledger.classified).length, 671 + 100)
  for (const key of ['GATE-0B.1', 'GATE-0B.2', 'GATE-0B.3', 'GATE-0B.4', 'GATE-0B.5', 'GATE-0B.6', 'GATE-0B.7']) assert.equal(args.ledger.tranches[key].operationsHash, anchored.tranches[key].operationsHash)
  for (const old of base.anchoredOwnershipEntries0b8.filter((entry) => entry[4] !== 'SCOPE_UNDECIDED')) assert.notEqual(entryOf(args, `${old[0]}|${old[1]}`)[4], 'SCOPE_UNDECIDED')
})

test('the six inventory classes are preserved, add up to 1644, and the matrix pins the eighth tranche', () => {
  const totals = inventoryTotals(ownershipAtAcceptance, exceptionOperations())
  assert.deepEqual(totals, {
    OWNED: 1126,
    SCOPE_UNDECIDED_AWAITING_CLASSIFICATION: 377,
    DECISION_BOUND_SCOPE_EXCEPTION: 4,
    RETIRED_501: 97,
    STUB_501: 31,
    SYSTEM: 9,
    operations: 1644,
  })
  assert.equal(Object.keys(totals).length, 7, 'no inventory class was added')
  assert.equal(1126 + 377 + 4 + 97 + 31 + 9, 1644)
  assert.deepEqual(acceptedMatrix.routeInventoryTotals, totals)
  const before = countsAt(ACCEPTED['0B.7'])
  assert.deepEqual([before.owned, before.undecided, before.classified], [1026, 481, 671])
  assert.equal(before.owned + 100, totals.OWNED)
  assert.equal(before.undecided - 100, totals.SCOPE_UNDECIDED_AWAITING_CLASSIFICATION + totals.DECISION_BOUND_SCOPE_EXCEPTION)
  assert.equal(acceptedMatrix.routeClassification0b8.files.manifest.sha256, sha(readText(FILES_0B8.manifest)))
  assert.equal(acceptedMatrix.routeClassification0b8.files.classification.sha256, sha(readText(FILES_0B8.classification)))
  assert.equal(matrix.routeClassification0b8.files.classification.sha256, sha(readText(FILES_0B8.classification)), 'the live matrix still pins the frozen Gate 0B.8 file')
  assert.equal(acceptedMatrix.routeClassification0b7.files.reviewQueue.sha256, sha(readText(FILES_0B7.reviewQueue)))
  assert.equal(acceptedMatrix.routeClassification0b7.files.classification.sha256, sha(readText(FILES_0B7.classification)))
})

test('Gate 0 stays IN_PROGRESS, validates the eighth tranche and keeps the three unjustified exposures and the 4 carbon exceptions distinct', () => {
  const result = validateGate0(matrix, { base })
  assert.deepEqual(result.problems, [])
  assert.equal(result.summary.verdict, 'IN_PROGRESS')
  assert.equal(result.summary.classification0b8.classified, 100)
  assert.equal(result.summary.decisionBoundExceptions.exceptions, 4)
  assert.ok(!result.blockers.some((item) => item.code === 'ROUTE_UNJUSTIFIED_EXPOSURE'))
  assert.equal(result.summary.route.scopeUndecidedAwaitingClassification, 177)
  assert.equal(result.summary.route.decisionBoundScopeExceptions, 4)
  assert.equal(result.summary.capabilityCount, 99)
})

test('adversarial findings are recorded as defects with a later gate and the source facts they rest on', () => {
  const args = fixture()
  for (const id of [XT_KB_ITEM, 'knowledge-base/route.ts|GET']) {
    const item = record(args, id)
    assert.equal(item.crossTenantExposure, true, id)
    assert.equal(item.crossTenantAuthorized, false, id)
    assert.ok(item.defects.some((defect) => /^DEF-0B7-EXC-PUBLISH-AND-INDEX/.test(defect)), `${id} still carries the Gate 0B.7 publication defect`)
    assert.ok(item.defects.some((defect) => /KNOWLEDGE-BASE-READS-IGNORE-ACCESS-COLUMNS/.test(defect)), id)
  }
  const high = highNew(args).filter((defect) => defect.releaseDisposition.disposition === 'RELEASE_BLOCKING')
  assert.ok(high.some((defect) => defect.releaseDisposition.activationState === 'REACHABLE_ANY_AUTHENTICATED'))
  assert.ok(high.some((defect) => defect.releaseDisposition.activationState === 'REACHABLE_UNAUTHENTICATED'))
  assert.ok(highNew(args).some((defect) => defect.releaseDisposition.existingContainment === 'NONE'))
  assert.ok(highNew(args).some((defect) => defect.releaseDisposition.existingContainment !== 'NONE'))
  assert.ok(highNew(args).some((defect) => defect.releaseDisposition.activationState === 'NOT_ACTIVATED'), 'a defect that no flag has activated is still recorded and dispositioned')
})

test('the eight risk categories are screened on every operation from source triggers, and the coverage is recorded in the summary', () => {
  const args = fixture()
  assert.equal(RISK_CATEGORIES.length, 8)
  const coverage = Object.fromEntries(RISK_CATEGORIES.map((category) => [category, newDefects(args).filter((defect) => (defect.riskCategories ?? []).includes(category)).length]))
  for (const [category, count] of Object.entries(coverage)) assert.ok(count >= 1, `${category} has a recorded instance in this tranche`)
  const defectsById = new Map(newDefects(args).map((defect) => [defect.id, defect]))
  const raised = new Set()
  for (const item of args.classification.operations) {
    assert.deepEqual(riskCategoryProblems(item, defectsById, ctx), [], item.id)
    for (const category of riskTriggers(item, ctx).triggers.keys()) raised.add(category)
  }
  assert.deepEqual([...raised].sort(), [...RISK_CATEGORIES].sort(), 'every category is raised by at least one operation, so no category is untested')
  assert.deepEqual(Object.keys(RISK_SCREENS).sort(), args.classification.operations.filter((item) => Object.keys(item.riskScreen).length > 0).map((item) => item.id).sort())
  const geofence = riskTriggers(record(args, GET_SIDE_EFFECT), ctx).triggers
  assert.ok(geofence.has('GET_WITH_SIDE_EFFECTS') && geofence.has('RLS_ASSUMED_FROM_DB_CLIENT'))
  assert.ok(riskTriggers(record(args, XT_KB_ITEM), ctx).triggers.has('GET_WITH_SIDE_EFFECTS'), 'the knowledge-base counter write is found from the GET record, not from a hand-written list')
})

test('NEGATIVE 1: the selection is exact, so an operation cannot disappear from, duplicate in, or be added to the frozen tranche', () => {
  const dropped = fixture()
  dropped.classification.operations = dropped.classification.operations.filter((item) => item.id !== PUBLISH_POST)
  assert.ok(hasProblem(run(dropped), /has no classification record/))
  const manifest = fixture()
  manifest.manifest.operations = manifest.manifest.operations.filter((id) => id !== PUBLISH_POST)
  const result = run(manifest)
  assert.ok(hasProblem(result, /exactly 100 operations/))
  assert.ok(hasProblem(result, /operationsHash/))
  const extra = fixture()
  extra.manifest.operations = [...extra.manifest.operations, 'zzz/route.ts|GET']
  assert.ok(hasProblem(run(extra), /exactly 100 operations|does not exist in the route-method universe/))
  const stray = fixture()
  stray.classification.operations.push({ ...clone(record(stray, PUBLISH_POST)), id: 'zzz/route.ts|GET' })
  assert.ok(hasProblem(run(stray), /is not in the frozen tranche/))
  const duplicated = fixture()
  duplicated.manifest.operations = [...duplicated.manifest.operations.slice(0, 5), duplicated.manifest.operations[4], ...duplicated.manifest.operations.slice(5)]
  assert.ok(hasProblem(run(duplicated), /duplicate operations|exactly 100 operations/))
  const swapped = fixture()
  const outsider = swapped.entries.find((entry) => entry[4] === 'SCOPE_UNDECIDED' && !swapped.manifest.operations.includes(`${entry[0]}|${entry[1]}`) && !DECISION_BOUND_OPERATIONS.includes(`${entry[0]}|${entry[1]}`))
  swapped.manifest.newOperations[0] = `${outsider[0]}|${outsider[1]}`
  assert.ok(hasProblem(run(swapped), /newOperations are not the frozen operations|not the next 100 SCOPE_UNDECIDED operations/))
  const reordered = fixture()
  reordered.manifest.operations = [...reordered.manifest.operations].reverse()
  assert.ok(hasProblem(run(reordered), /not deterministic ascending/))
  const rehashed = fixture()
  rehashed.manifest.operationsHash = '0'.repeat(64)
  assert.ok(hasProblem(run(rehashed), /operationsHash does not match/))
  const unlogged = fixture()
  unlogged.manifest.version = 2
  assert.ok(hasProblem(run(unlogged), /version 2 has no versionLog entry/))
  const ledger = fixture()
  ledger.ledger.tranches['GATE-0B.8'].operationsHash = '0'.repeat(64)
  assert.ok(hasProblem(run(ledger), /changed without a new versioned reason/))
  const anchor = fixture()
  anchor.manifest.anchorCommit = '0'.repeat(40)
  assert.ok(hasProblem(run(anchor), /anchor commit is not the recorded Gate 0B.7 acceptance commit/))
  const earlier = fixture()
  earlier.manifest0b7.operations = [...earlier.manifest0b7.operations, earlier.manifest.operations[0]]
  assert.ok(hasProblem(run(earlier), /was already examined in an earlier tranche/))
})

test('NEGATIVE 2: an unsupported route claim is refused: missing, invented, wrong-method or unprovenanced evidence, and an unreal caller', () => {
  const none = fixture()
  record(none, PUBLISH_POST).evidence = []
  assert.ok(hasProblem(run(none), /evidence/))
  const invented = fixture()
  record(invented, PUBLISH_POST).evidence[1] = { ...record(invented, PUBLISH_POST).evidence[1], quote: 'this line is not in the file' }
  assert.ok(hasProblem(run(invented), /not in|is not present|does not contain/))
  const sibling = fixture()
  const item = record(sibling, PUBLISH_POST)
  const index = item.evidence.findIndex((evidence) => evidence.provenance === 'ROUTE_HANDLER_DIRECT')
  item.evidence[index] = { ...item.evidence[index], method: 'GET' }
  assert.ok(hasProblem(run(sibling), /is tagged for GET but the record is POST/))
  const unprovenanced = fixture()
  delete record(unprovenanced, PUBLISH_POST).evidence[0].provenance
  assert.ok(hasProblem(run(unprovenanced), /provenance/))
  const noRoute = fixture()
  record(noRoute, PUBLISH_POST).evidence = record(noRoute, PUBLISH_POST).evidence.filter((evidence) => evidence.ref !== `apps/union-eyes/app/api/${PUBLISH_POST.split('|')[0]}`)
  assert.ok(hasProblem(run(noRoute), /route file|requires|evidence/))
  const callers = fixture()
  record(callers, PUBLISH_POST).callers = [{ ref: 'apps/union-eyes/does-not-exist.ts', quote: 'x' }]
  assert.ok(hasProblem(run(callers), /does not exist|caller/))
  const phantomFinding = fixture()
  record(phantomFinding, EQUITY_GET).callerFinding = 'No caller was found for this route anywhere in the application source tree.'
  assert.ok(record(phantomFinding, EQUITY_GET).callers.length > 0, 'the self-identification route has a real caller')
  assert.ok(hasProblem(run(phantomFinding), /lists callers but its finding says there are none/))
  const hiddenCaller = fixture()
  record(hiddenCaller, NO_CALLER).callers = clone(record(hiddenCaller, EQUITY_GET).callers)
  assert.ok(hasProblem(run(hiddenCaller), /lists callers but its finding says there are none|cites a caller line that is not in/))
})

test('NEGATIVE 3: an invented or catch-all owner, an owner the group does not name, and an undecided entry are refused', () => {
  const invented = fixture()
  record(invented, PUBLISH_POST).capabilityId = 'UE-OMIT-INVENTED-TO-REDUCE-UNDECIDED'
  assert.ok(hasProblem(run(invented), /names an invalid capability/))
  const catchAll = fixture()
  record(catchAll, PUBLISH_POST).capabilityId = 'UE-OMIT-ROUTE-DOMAIN-SCOPE'
  assert.ok(hasProblem(run(catchAll), /names an invalid capability/))
  const wrongOwner = fixture()
  record(wrongOwner, PUBLISH_POST).capabilityId = 'UE-CAP-D-002'
  assert.ok(hasProblem(run(wrongOwner), /ownership register names|does not cover|belongs to/))
  const rule = fixture()
  entryOf(rule, PUBLISH_POST)[2] = 'RULE-DOMAIN-SCOPE-UNDECIDED'
  assert.ok(hasProblem(run(rule), /not a Gate 0B.8 business-evidence rule/))
  const domain = fixture()
  record(domain, PUBLISH_POST).domain = 'SOMETHING_ELSE'
  assert.ok(hasProblem(run(domain), /does not cover|belongs to/))
  const undecided = fixture()
  entryOf(undecided, PUBLISH_POST)[4] = 'SCOPE_UNDECIDED'
  assert.ok(hasProblem(run(undecided), /still records SCOPE_UNDECIDED/))
  const missingCapability = fixture()
  missingCapability.capabilityById.delete(NEW_CAPABILITY_IDS[0])
  assert.ok(hasProblem(run(missingCapability), /is not in the engineering completion matrix/))
  const unresolved = fixture()
  record(unresolved, PUBLISH_POST).status = 'UNRESOLVED'
  assert.ok(hasProblem(run(unresolved), /is unresolved but is not a recorded evidence gap/))
})

test('NEGATIVE 4: ownership is never authorization: a role floor is not a kernel decision and reachable cross-tenant data is never authorized', () => {
  const kernel = fixture()
  record(kernel, SSO_POST).kernelAuthorization = true
  assert.ok(hasProblem(run(kernel), /inconsistent about kernel authorization|claims kernel authorization but cites no kernel decision/))
  const category = fixture()
  record(category, SSO_POST).kernelAuthorization = true
  record(category, SSO_POST).authorizationCategory = 'KERNEL_AUTHORITY'
  assert.ok(hasProblem(run(category), /claims kernel authorization but cites no kernel decision/))
  const floor = fixture()
  record(floor, SSO_POST).authorizationCategory = 'ROLE_FLOOR'
  record(floor, SSO_POST).kernelAuthorization = true
  assert.ok(hasProblem(run(floor), /role floor and must record kernelAuthorization false|inconsistent about kernel authorization/))
  const authorized = fixture()
  const item = record(authorized, DOWNLOAD_GET)
  item.crossTenantExposure = true
  item.crossTenantAuthorized = true
  item.exposureContract = 'Any holder of the link can read the rows of every organization by id through this route.'
  assert.ok(hasProblem(run(authorized), /records it as authorized/))
  const noDefect = fixture()
  const exposed = record(noDefect, DOWNLOAD_GET)
  exposed.crossTenantExposure = true
  exposed.crossTenantAuthorized = false
  exposed.exposureContract = 'Any holder of the link can read the rows of every organization by id through this route.'
  exposed.defects = []
  assert.ok(hasProblem(run(noDefect), /exposes cross-tenant data without a recorded defect/))
  const justified = fixture()
  record(justified, PUBLISH_POST).accessJustifiedBy = 'UE-INST-EXIT-INTERVIEW-RECORD-READERS'
  assert.ok(hasProblem(run(justified), /justifies access by/))
  const silent = fixture()
  record(silent, PUBLISH_POST).crossTenantAuthorized = true
  assert.ok(hasProblem(run(silent), /records cross-tenant access as authorized/))
  const unknown = fixture()
  record(unknown, PUBLISH_POST).institutionalDecisions = ['UE-INST-DOES-NOT-EXIST']
  assert.ok(hasProblem(run(unknown), /cites unknown institutional decision/))
})

test('NEGATIVE 5: a mutation or audit that the source does not support is refused', () => {
  const withoutAtomicWrite = (args) => {
    const item = record(args, PUBLISH_POST)
    item.evidence = item.evidence.filter((evidence) => !/persistAtomicAudit/.test(evidence.quote))
    return item
  }
  const atomic = fixture()
  withoutAtomicWrite(atomic)
  assert.ok(hasProblem(run(atomic), /marked atomically audited without citing an in-transaction audit write/))
  const local = fixture()
  withoutAtomicWrite(local).mutationAudit = 'ATOMIC_AUDIT_LOCAL_PART_ONLY'
  assert.ok(hasProblem(run(local), /marked atomic for its local part without citing/))
  const readWrite = fixture()
  record(readWrite, DOWNLOAD_GET).mutationAudit = 'NOT_MUTATING'
  assert.ok(hasProblem(run(readWrite), /recorded as not mutating but cites a write/))
  const uncorrected = fixture()
  record(uncorrected, DOWNLOAD_GET).manifestCorrections = []
  assert.ok(hasProblem(run(uncorrected), /must correct the manifest read-only classification/))
  const unaudited = fixture()
  record(unaudited, DOWNLOAD_GET).evidence = record(unaudited, DOWNLOAD_GET).evidence.filter((evidence) => !/auditLog|logApiAuditEvent|auditAiInteraction|auditAIInvocation|audit/i.test(evidence.quote))
  assert.ok(hasProblem(run(unaudited), /records a separate audit event without citing it/))
})

test('NEGATIVE 6: a HIGH defect needs a justified release disposition, and the disposition cannot be hollow, excused by the phase, or inconsistent', () => {
  const missing = fixture()
  const target = highNew(missing)[0]
  delete target.releaseDisposition
  assert.ok(hasProblem(run(missing), new RegExp(`defect ${target.id} is HIGH severity and records no release disposition`)))

  const invalid = fixture()
  highNew(invalid)[0].releaseDisposition.disposition = 'ACCEPTED_RISK'
  assert.ok(hasProblem(run(invalid), /has an invalid release disposition/))

  const excuse = fixture()
  highNew(excuse)[0].releaseDisposition.justification = 'This was found in an inventory-only phase, where no repair is made, so it does not block release for now.'
  assert.ok(hasProblem(run(excuse), /an inventory-only phase is never a ground/))

  const exposure = fixture()
  highNew(exposure)[0].releaseDisposition.actualExposure = 'Short.'
  assert.ok(hasProblem(run(exposure), /does not state its actual exposure/))

  const impact = fixture()
  highNew(impact)[0].releaseDisposition.potentialImpact = { classes: ['NOT_A_CLASS'], description: 'x' }
  assert.ok(hasProblem(run(impact), /does not state a valid potential impact/))

  const activation = fixture()
  highNew(activation)[0].releaseDisposition.activationState = 'MAYBE_LATER'
  assert.ok(hasProblem(run(activation), /does not state a valid activation state/))

  const noEvidence = fixture()
  highNew(noEvidence)[0].releaseDisposition.activationEvidence = []
  assert.ok(hasProblem(run(noEvidence), /activation cites no source evidence/))

  const fakeEvidence = fixture()
  highNew(fakeEvidence)[0].releaseDisposition.activationEvidence = [{ ref: 'apps/union-eyes/app/api/exit-interviews/route.ts', quote: 'this quote is not in that file at all' }]
  assert.ok(hasProblem(run(fakeEvidence), /quotes a line that is not in/))

  const mismatch = fixture()
  const blocking = highNew(mismatch).find((defect) => defect.releaseDisposition.disposition === 'RELEASE_BLOCKING')
  blocking.releaseBlocking = false
  assert.ok(hasProblem(run(mismatch), /has a RELEASE_BLOCKING disposition but is not marked release blocking/))

  const flagged = fixture()
  const conditional = highNew(flagged).find((defect) => defect.releaseDisposition.disposition === 'CONDITIONALLY_BLOCKING')
  conditional.releaseBlocking = true
  assert.ok(hasProblem(run(flagged), /is marked release blocking but its disposition is CONDITIONALLY_BLOCKING/))

  const noCondition = fixture()
  delete highNew(noCondition).find((defect) => defect.releaseDisposition.disposition === 'CONDITIONALLY_BLOCKING').releaseDisposition.blockingCondition
  assert.ok(hasProblem(run(noCondition), /is CONDITIONALLY_BLOCKING and states no blocking condition/))

  const fakeContainment = fixture()
  const contained = highNew(fakeContainment).find((defect) => defect.releaseDisposition.existingContainment !== 'NONE')
  contained.releaseDisposition.existingContainment.evidence = [{ ref: 'apps/union-eyes/app/api/exit-interviews/route.ts', quote: 'a containment line that does not exist in the file' }]
  assert.ok(hasProblem(run(fakeContainment), /containment quotes a line that is not in/))

  const unstated = fixture()
  delete highNew(unstated)[0].releaseDisposition.existingContainment
  assert.ok(hasProblem(run(unstated), /does not state its existing containment/))
})

test('NEGATIVE 7: a NON_BLOCKING_WITH_JUSTIFICATION disposition cannot be used for uncontained, cross-tenant, unauthenticated or widely reachable harm', () => {
  const base7 = fixture()
  const template = highNew(base7).find((defect) => defect.releaseDisposition.existingContainment !== 'NONE')
  const downgrade = (mutate) => {
    const defect = clone(template)
    defect.releaseBlocking = false
    defect.releaseDisposition.disposition = 'NON_BLOCKING_WITH_JUSTIFICATION'
    delete defect.releaseDisposition.blockingCondition
    mutate(defect.releaseDisposition)
    return releaseDispositionProblems(defect, ctx)
  }
  assert.deepEqual(downgrade((d) => { d.activationState = 'REACHABLE_ROLE_RESTRICTED'; d.potentialImpact.classes = ['DATA_QUALITY'] }), [], 'a contained, role-restricted data-quality defect may be non blocking')
  assert.ok(downgrade((d) => { d.existingContainment = 'NONE'; d.activationState = 'REACHABLE_ROLE_RESTRICTED'; d.potentialImpact.classes = ['DATA_QUALITY'] }).some((item) => /without an existing containment/.test(item)))
  assert.ok(downgrade((d) => { d.potentialImpact.classes = ['CROSS_TENANT_DISCLOSURE'] }).some((item) => /reaches another organization and cannot be NON_BLOCKING_WITH_JUSTIFICATION/.test(item)))
  assert.ok(downgrade((d) => { d.activationState = 'REACHABLE_UNAUTHENTICATED'; d.potentialImpact.classes = ['DATA_QUALITY'] }).some((item) => /reachable without authentication and cannot be NON_BLOCKING_WITH_JUSTIFICATION/.test(item)))
  assert.ok(downgrade((d) => { d.activationState = 'REACHABLE_ANY_AUTHENTICATED'; d.potentialImpact.classes = ['UNAUTHORIZED_MUTATION'] }).some((item) => /reachable by any authenticated caller with UNAUTHORIZED_MUTATION impact/.test(item)))
  assert.ok(downgrade((d) => { d.activationState = 'REACHABLE_ANY_AUTHENTICATED'; d.potentialImpact.classes = ['PRIVACY_OR_CONSENT'] }).some((item) => /cannot be NON_BLOCKING_WITH_JUSTIFICATION/.test(item)))

  const gateLevel = fixture()
  const blocking = highNew(gateLevel).find((defect) => defect.releaseDisposition.disposition === 'RELEASE_BLOCKING')
  blocking.releaseBlocking = false
  blocking.releaseDisposition.disposition = 'NON_BLOCKING_WITH_JUSTIFICATION'
  assert.ok(run(gateLevel).problems.length > 0, 'the validator refuses to downgrade a release-blocking defect in the register')
})

test('NEGATIVE 8: an accepted defect cannot be deleted, downgraded, relabelled, given a disposition in place or removed from the review queue', () => {
  const dropped = fixture()
  dropped.classification.defectRegister = dropped.classification.defectRegister.filter((item) => item.id !== EARLIER_DEFECT)
  assert.ok(hasProblem(run(dropped), /is missing from the defect register/))
  const downgraded = fixture()
  defectOf(downgraded, EARLIER_HIGH).severity = 'LOW'
  assert.ok(hasProblem(run(downgraded), /was altered in the defect register/))
  const unblocked = fixture()
  defectOf(unblocked, EARLIER_HIGH).releaseBlocking = true
  assert.ok(hasProblem(run(unblocked), /was altered in the defect register/))
  const dispositioned = fixture()
  defectOf(dispositioned, EARLIER_HIGH).releaseDisposition = clone(highNew(dispositioned)[0].releaseDisposition)
  const dispositionedResult = run(dispositioned)
  assert.ok(hasProblem(dispositionedResult, /gained a release disposition; the frozen records are preserved/))
  assert.ok(hasProblem(dispositionedResult, /was altered in the defect register/))
  const smuggled = fixture()
  smuggled.classification.defectRegister.push({ ...clone(smuggled.classification.defectRegister[0]), id: 'DEF-0B5-SMUGGLED' })
  assert.ok(hasProblem(run(smuggled), /earlier-tranche defect that no earlier tranche recorded/))
  const wrongTranche = fixture()
  newDefects(wrongTranche)[0].tranche = '0B.9'
  assert.ok(hasProblem(run(wrongTranche), /does not record the tranche that found it/))

  const removed = fixture()
  removed.reviewQueue.entries = removed.reviewQueue.entries.filter((entry) => entry.defectId !== EARLIER_HIGH)
  assert.ok(hasProblem(run(removed), new RegExp(`HIGH defect ${EARLIER_HIGH} of Gate 0B.6 is missing from the release disposition review queue`)))
  const drifted = fixture()
  drifted.reviewQueue.entries.find((entry) => entry.defectId === EARLIER_HIGH).defectSha256 = '0'.repeat(64)
  assert.ok(hasProblem(run(drifted), /no longer matches the frozen defect record; an accepted defect cannot be altered or downgraded/))
  const preassigned = fixture()
  preassigned.reviewQueue.entries[0].releaseDisposition = 'NON_BLOCKING_WITH_JUSTIFICATION'
  assert.ok(hasProblem(run(preassigned), /records a disposition; only an independent qualification may/))
  const qualified = fixture()
  qualified.reviewQueue.entries[0].qualifiedBy = 'the-inventory-itself'
  assert.ok(hasProblem(run(qualified), /records a disposition; only an independent qualification may/))
  const lowered = fixture()
  lowered.reviewQueue.entries[0].originalSeverity = 'MEDIUM'
  assert.ok(hasProblem(run(lowered), /does not preserve the original severity and release-blocking mark/))
  const relabelled = fixture()
  relabelled.reviewQueue.entries[0].originalReleaseBlocking = !relabelled.reviewQueue.entries[0].originalReleaseBlocking
  assert.ok(hasProblem(run(relabelled), /does not preserve the original severity and release-blocking mark/))
  const padded = fixture()
  padded.reviewQueue.entries.push({ ...clone(padded.reviewQueue.entries[0]), defectId: 'DEF-0B6-NOT-A-HIGH-DEFECT' })
  assert.ok(hasProblem(run(padded), /is not a HIGH defect of Gate 0B.1 to Gate 0B.6|not in deterministic order/))
  const doubled = fixture()
  doubled.reviewQueue.entries.push(clone(doubled.reviewQueue.entries[0]))
  assert.ok(hasProblem(run(doubled), /lists .* twice/))
  const absent = fixture()
  absent.reviewQueue = undefined
  assert.ok(hasProblem(run(absent), /the release disposition review queue is missing or malformed/))
})

test('NEGATIVE 9: a decision-bound carbon exception cannot be converted into owned, classified, adopted or approved scope', () => {
  for (const flag of ['adopted', 'authorized', 'operationallyApproved', 'productionReady', 'countedAsOwned']) {
    const args = exceptionFixture()
    args.register.exceptions[0][flag] = true
    assert.ok(hasProblem(runExceptions(args), new RegExp(`records ${flag} true`)), flag)
  }
  const owned = exceptionFixture()
  const carbon = owned.entries.find((entry) => `${entry[0]}|${entry[1]}` === CARBON_DASHBOARD)
  carbon[3] = 'UE-OMIT-ENTERPRISE-SSO-IDENTITY-PROVIDERS'
  carbon[4] = 'OWNED'
  assert.ok(hasProblem(runExceptions(owned), /is not owned|an exception is not owned/))
  const classified = exceptionFixture()
  classified.ledger.classified[CARBON_DASHBOARD] = 'UE-OMIT-ENTERPRISE-SSO-IDENTITY-PROVIDERS'
  assert.ok(hasProblem(runExceptions(classified), /appears in the classification ledger as classified; an exception is not a classification/))
  const reselected = exceptionFixture()
  reselected.laterOperations = new Set([...reselected.laterOperations, CARBON_POST])
  assert.ok(hasProblem(runExceptions(reselected), /was re-examined by a later tranche; a decision-bound exception is not selected for source investigation again/))
  const carbonTranche = fixture()
  carbonTranche.manifest.operations = [...carbonTranche.manifest.operations, CARBON_POST].sort()
  assert.ok(hasProblem(run(carbonTranche), /is a decision-bound scope exception and may not be re-examined/))
  const carried = fixture()
  carried.manifest.carryForward = [CARBON_POST]
  assert.ok(hasProblem(run(carried), /carries forward operations; the decision-bound exceptions are never carried into a tranche/))
  const unrecorded = fixture()
  unrecorded.manifest.excludedDecisionBound = unrecorded.manifest.excludedDecisionBound.slice(1)
  assert.ok(hasProblem(run(unrecorded), /does not record the decision-bound operations it excludes from selection/))
  const reclassified = fixture()
  reclassified.classification.operations.push({ ...clone(record(reclassified, PUBLISH_POST)), id: CARBON_POST, route: 'carbon/validate/route.ts', method: 'POST' })
  assert.ok(hasProblem(run(reclassified), /is not in the frozen tranche/))
  const decision = fixture()
  decision.classification.institutionalDecisions = decision.classification.institutionalDecisions.filter((item) => item.id !== 'UE-INST-CARBON-ACCOUNTING-SCOPE')
  assert.ok(hasProblem(run(decision), /recorded by an earlier tranche is missing; a decision cannot be silently closed by removal/))
  const adopted = fixture()
  adopted.classification.institutionalDecisions.find((item) => item.id === 'UE-INST-CARBON-ACCOUNTING-SCOPE').status = 'ADOPTED'
  const adoptedResult = run(adopted)
  assert.ok(hasProblem(adoptedResult, /is ADOPTED; Gate 0B.8 can record only outstanding decisions/))
  assert.ok(hasProblem(adoptedResult, /was altered or adopted/))
  const inventory = inventoryTotals(ownershipAtAcceptance.map((entry) => (DECISION_BOUND_OPERATIONS.includes(`${entry[0]}|${entry[1]}`) ? [...entry.slice(0, 4), 'OWNED', ...entry.slice(5)] : entry)), exceptionOperations())
  assert.equal(inventory.DECISION_BOUND_SCOPE_EXCEPTION, 0)
  assert.equal(inventory.OWNED, 1130, 'converting an exception to owned would show as four more owned operations and is caught by the pinned totals')
  const totals = inventoryTotals(ownershipAtAcceptance, exceptionOperations())
  assert.ok(inventoryTotalsProblems(inventory, totals).some((problem) => /INVENTORY-TOTALS-DRIFT/.test(problem)))
  const double = { ...totals, SCOPE_UNDECIDED_AWAITING_CLASSIFICATION: totals.SCOPE_UNDECIDED_AWAITING_CLASSIFICATION + 4 }
  assert.ok(inventoryTotalsProblems(double, totals).some((problem) => /INVENTORY-TOTALS-SUM: the categories add to 1648, not the 1644/.test(problem)))
})

test('NEGATIVE 10: a historical tranche cannot be mutated, reverted or re-owned, and the lock cannot gain a capability without provenance', () => {
  const reverted = fixture()
  entryOf(reverted, EARLIER_CLASSIFIED)[4] = 'SCOPE_UNDECIDED'
  assert.ok(hasProblem(run(reverted), /was changed or reverted|silently reverted to SCOPE_UNDECIDED/))
  const reowned = fixture()
  entryOf(reowned, EARLIER_CLASSIFIED)[3] = 'UE-OMIT-ENTERPRISE-SSO-IDENTITY-PROVIDERS'
  assert.ok(hasProblem(run(reowned), /changed owner from .* without a versioned reason|was changed or reverted/))
  const ledger = fixture()
  delete ledger.ledger.classified[EARLIER_CLASSIFIED]
  assert.ok(hasProblem(run(ledger), /is missing or changed in the ledger/))
  const moved = fixture()
  moved.ledger.classifiedIn[EARLIER_CLASSIFIED] = 'GATE-0B.8'
  assert.ok(hasProblem(run(moved), /no longer records GATE-0B.7 in the ledger/))
  const phantom = fixture()
  phantom.ledger.classifiedIn['zzz/route.ts|GET'] = 'GATE-0B.8'
  assert.ok(hasProblem(run(phantom), /ledger records zzz\/route.ts\|GET as classified in GATE-0B.8 but no classification exists/))
  const unledgered = fixture()
  delete unledgered.ledger.classified[PUBLISH_POST]
  assert.ok(hasProblem(run(unledgered), /is not recorded in the classification ledger/))
  const twice = fixture()
  twice.ledger.classifiedIn[PUBLISH_POST] = 'GATE-0B.7'
  assert.ok(hasProblem(run(twice), /does not record GATE-0B.8 in the ledger/))
  const exposure = fixture()
  exposure.classification.releaseBlockingExposures = exposure.classification.releaseBlockingExposures.slice(1)
  assert.ok(hasProblem(run(exposure), /is not preserved as a release-blocking defect/))
  const edited = fixture()
  edited.manifest0b7.operations = edited.manifest0b7.operations.slice(1)
  run(edited)
  assert.equal(readText(FILES_0B7.classification), fileAt(ACCEPTED['0B.7'], FILES_0B7.classification))
  assert.equal(readText(FILES_0B7.manifest), fileAt(ACCEPTED['0B.7'], FILES_0B7.manifest))
  const ownershipIds = new Set(ownershipAtAcceptance.map((entry) => `${entry[0]}|${entry[1]}`))
  assert.equal(ownershipIds.size, ownershipAtAcceptance.length, 'no duplicate route-method identity in the ownership register')
  const bookings = 'meeting-rooms/[id]/bookings/route.ts'
  const partial = base.anchoredOwnershipEntries0b8.filter((entry) => entry[0] === bookings)
  assert.deepEqual(partial.map((entry) => [entry[1], entry[4]]).sort(), [['DELETE', 'SCOPE_UNDECIDED'], ['GET', 'SCOPE_UNDECIDED'], ['PATCH', 'SCOPE_UNDECIDED']])
  assert.deepEqual(ownershipAtAcceptance.filter((entry) => entry[0] === bookings).map((entry) => [entry[1], entry[4]]).sort(), [['DELETE', 'OWNED'], ['GET', 'OWNED'], ['PATCH', 'SCOPE_UNDECIDED']], 'a file only partly in the tranche classifies only its selected methods')

  const lock = JSON.parse(readFileSync(join(ROOT, FILES.lock), 'utf8'))
  const stripped = validateGate0(matrix, { base, lock: { ...clone(lock), additions: lock.additions.filter((item) => item.tranche !== 'GATE-0B.8') } })
  assert.ok(stripped.problems.some((problem) => /addition record|is in the independent lock without/.test(problem)))
  const handEdited = clone(lock)
  handEdited.capabilityIds.push('UE-OMIT-HAND-ADDED-0B8')
  assert.ok(validateGate0(matrix, { base, lock: handEdited }).problems.some((problem) => /UE-OMIT-HAND-ADDED-0B8 is in the independent lock without an anchor, checkpoint or addition record/.test(problem)))
  const forged = clone(lock)
  forged.additions.find((item) => item.tranche === 'GATE-0B.8').operationsHash = '0'.repeat(64)
  assert.ok(validateGate0(matrix, { base, lock: forged }).problems.length > 0)
  const unclassified = clone(lock)
  const addition = unclassified.additions.find((item) => item.tranche === 'GATE-0B.8')
  addition.classifiedOperations += 5
  assert.ok(validateGate0(matrix, { base, lock: unclassified }).problems.length > 0)
})

test('NEGATIVE 11: the inventory counts cannot be forged, and the moving totals live only in the cumulative registers', () => {
  const stale = clone(matrix)
  stale.routeInventoryTotals.OWNED += 1
  assert.ok(validateGate0(stale, { base }).problems.some((problem) => /INVENTORY-TOTALS-DRIFT: OWNED/.test(problem)))
  const absent = clone(matrix)
  delete absent.routeInventoryTotals
  assert.ok(validateGate0(absent, { base }).problems.some((problem) => /INVENTORY-TOTALS-ABSENT/.test(problem)))
  const pin = clone(matrix)
  pin.routeClassification0b8.files.classification.sha256 = '0'.repeat(64)
  assert.ok(validateGate0(pin, { base }).problems.length > 0)
})

const defectCarrying = (args, category) => newDefects(args).filter((defect) => (defect.riskCategories ?? []).includes(category))
const strip = (args, category) => {
  for (const defect of defectCarrying(args, category)) defect.riskCategories = defect.riskCategories.filter((item) => item !== category)
  for (const defect of newDefects(args)) if (defect.riskCategories?.length === 0) delete defect.riskCategories
}

test('NEGATIVE 12: each of the eight risk categories raised by the source is refused without a defect that carries it, and a screen cannot be hollow, invented or used on a structural trigger', () => {
  const expectations = [
    ['GET_WITH_SIDE_EFFECTS', XT_KB_ITEM],
    ['AUDIT_OUTSIDE_DATA_TRANSACTION', 'integrations/framework/[id]/sync/route.ts|POST'],
    ['RLS_ASSUMED_FROM_DB_CLIENT', 'integrations/shopify/webhooks/route.ts|POST'],
    ['ANALYTICS_CROSSES_BOUNDARY', 'health-safety/incidents/trends/route.ts|GET'],
    ['FABRICATED_INSTITUTIONAL_FINDING', 'health-safety/dashboard/route.ts|GET'],
    ['PUBLICATION_BYPASSES_CLASSIFICATION_OR_CONSENT', 'knowledge-base/route.ts|GET'],
    ['SENSITIVE_SOURCE_IN_DERIVED_OUTPUT', 'icra/report/[assessmentId]/route.ts|GET'],
    ['EXTERNAL_DISCLOSURE_WITHOUT_DECISION', 'icra/email-results/route.ts|POST'],
  ]
  for (const [category, id] of expectations) {
    const args = fixture()
    strip(args, category)
    if (args.classification.operations.find((item) => item.id === id).riskScreen[category]) delete args.classification.operations.find((item) => item.id === id).riskScreen[category]
    assert.ok(hasProblem(run(args), new RegExp(`operation ${id.replace(/[[\]|.]/g, '\\$&')} raises ${category}`)), `${category} on ${id}`)
  }

  const screenedAway = fixture()
  record(screenedAway, XT_KB_ITEM).riskScreen = { GET_WITH_SIDE_EFFECTS: { reason: 'The counter is only a view count and harmless to the organization, so the write is not a concern here.', evidence: [{ ref: 'apps/union-eyes/app/api/knowledge-base/[id]/route.ts', quote: 'logger.warn(' }] } }
  strip(screenedAway, 'GET_WITH_SIDE_EFFECTS')
  assert.ok(hasProblem(run(screenedAway), /screens GET_WITH_SIDE_EFFECTS away; a structural trigger is satisfied only by a defect/))

  const auditScreened = fixture()
  record(auditScreened, 'integrations/framework/[id]/sync/route.ts|POST').riskScreen = { AUDIT_OUTSIDE_DATA_TRANSACTION: { reason: 'The intent and outcome pair is the documented design of the audited operation helper.', evidence: [{ ref: 'apps/union-eyes/lib/audit/operation-audit.ts', quote: 'export async function performAuditedOperation' }] } }
  assert.ok(hasProblem(run(auditScreened), /screens AUDIT_OUTSIDE_DATA_TRANSACTION away/))

  const fakeQuote = fixture()
  record(fakeQuote, RLS_SCREENED).riskScreen.RLS_ASSUMED_FROM_DB_CLIENT.evidence = [{ ref: 'apps/union-eyes/app/api/location/consent/route.ts', quote: 'a transaction line that is not in the route' }]
  assert.ok(hasProblem(run(fakeQuote), /screen for RLS_ASSUMED_FROM_DB_CLIENT quotes a line that is not in/))

  const noRef = fixture()
  record(noRef, RLS_SCREENED).riskScreen.RLS_ASSUMED_FROM_DB_CLIENT.evidence = [{ ref: 'apps/union-eyes/app/api/location/nope/route.ts', quote: 'x' }]
  assert.ok(hasProblem(run(noRef), /screen for RLS_ASSUMED_FROM_DB_CLIENT cites .*, which does not exist/))

  const unevidenced = fixture()
  record(unevidenced, RLS_SCREENED).riskScreen.RLS_ASSUMED_FROM_DB_CLIENT.evidence = []
  assert.ok(hasProblem(run(unevidenced), /screen for RLS_ASSUMED_FROM_DB_CLIENT cites no source evidence/))

  const hollow = fixture()
  record(hollow, RLS_SCREENED).riskScreen.RLS_ASSUMED_FROM_DB_CLIENT.reason = 'Fine.'
  assert.ok(hasProblem(run(hollow), /screen for RLS_ASSUMED_FROM_DB_CLIENT states no reason/))

  const invented = fixture()
  record(invented, PUBLISH_POST).riskScreen = { FABRICATED_INSTITUTIONAL_FINDING: clone(record(invented, RLS_SCREENED).riskScreen.RLS_ASSUMED_FROM_DB_CLIENT) }
  assert.ok(hasProblem(run(invented), /records a screen for FABRICATED_INSTITUTIONAL_FINDING that no source trigger raised/))

  const unknown = fixture()
  record(unknown, PUBLISH_POST).riskScreen = { MADE_UP_CATEGORY: clone(record(unknown, RLS_SCREENED).riskScreen.RLS_ASSUMED_FROM_DB_CLIENT) }
  assert.ok(hasProblem(run(unknown), /screens an unknown risk category MADE_UP_CATEGORY/))

  const badDefect = fixture()
  newDefects(badDefect)[0].riskCategories = ['NOT_A_CATEGORY']
  assert.ok(hasProblem(run(badDefect), /names an unknown risk category NOT_A_CATEGORY/))

  const emptyDefect = fixture()
  newDefects(emptyDefect)[0].riskCategories = []
  assert.ok(hasProblem(run(emptyDefect), /records an empty riskCategories list/))

  const earlier = fixture()
  defectOf(earlier, PRIOR_DISPOSITIONED).riskCategories = ['FABRICATED_INSTITUTIONAL_FINDING']
  assert.ok(hasProblem(run(earlier), /of an earlier tranche gained riskCategories/))

  const analyticsOrg = fixture()
  const trend = record(analyticsOrg, 'federations/benchmark/grievances/route.ts|GET')
  strip(analyticsOrg, 'ANALYTICS_CROSSES_BOUNDARY')
  trend.riskScreen = { ANALYTICS_CROSSES_BOUNDARY: { reason: 'The route computes no cross-organization aggregate and reads only the session organization rows.', evidence: [{ ref: 'apps/union-eyes/app/api/federations/benchmark/grievances/route.ts', quote: 'orgScoped' }] } }
  const analyticsResult = run(analyticsOrg)
  assert.ok(!hasProblem(analyticsResult, /federations\/benchmark\/grievances\/route.ts\|GET (raises|screens)/), 'a verified screen with an organization predicate in the cited source satisfies the analytics trigger')
  const noOrg = fixture()
  record(noOrg, 'federations/benchmark/grievances/route.ts|GET').riskScreen = clone(trend.riskScreen)
  strip(noOrg, 'ANALYTICS_CROSSES_BOUNDARY')
  record(noOrg, 'federations/benchmark/grievances/route.ts|GET').evidence = []
  assert.ok(hasProblem(run(noOrg), /federations\/benchmark\/grievances\/route.ts\|GET (screens ANALYTICS_CROSSES_BOUNDARY but no cited implementation file names an organization predicate|raises ANALYTICS)/))
})

test('NEGATIVE 13: the Gate 0B.7 release dispositions are preserved, a rule cannot own an operation outside the frozen hundred, and the gate keeps eight release-blocking dispositions', () => {
  const altered = fixture()
  defectOf(altered, PRIOR_DISPOSITIONED).releaseDisposition.disposition = 'CONDITIONALLY_BLOCKING'
  defectOf(altered, PRIOR_DISPOSITIONED).releaseBlocking = false
  assert.ok(hasProblem(run(altered), /was altered in the defect register/))

  const removed = fixture()
  delete defectOf(removed, PRIOR_DISPOSITIONED).releaseDisposition
  assert.ok(hasProblem(run(removed), /was altered in the defect register|is HIGH severity and records no release disposition/))

  const downgraded = fixture()
  defectOf(downgraded, PRIOR_CONDITIONAL).releaseDisposition.disposition = 'NON_BLOCKING_WITH_JUSTIFICATION'
  assert.ok(hasProblem(run(downgraded), /was altered in the defect register/))

  const dropped = fixture()
  dropped.classification.defectRegister = dropped.classification.defectRegister.filter((item) => item.id !== PRIOR_DISPOSITIONED)
  assert.ok(hasProblem(run(dropped), /is missing from the defect register/))

  const reseverity = fixture()
  defectOf(reseverity, PRIOR_CONDITIONAL).severity = 'MEDIUM'
  assert.ok(hasProblem(run(reseverity), /was altered in the defect register/))

  const overreach = fixture()
  const patch = entryOf(overreach, 'meeting-rooms/[id]/bookings/route.ts|PATCH')
  patch[2] = 'RULE-0B8-JUR-CALENDAR-MEETING-ROOM-FACADE'
  patch[4] = 'OWNED'
  assert.ok(hasProblem(run(overreach), /owns meeting-rooms\/\[id\]\/bookings\/route.ts\|PATCH, which is outside the frozen tranche/))
  assert.equal(entryOf(fixture(), 'meeting-rooms/[id]/bookings/route.ts|PATCH')[4], 'SCOPE_UNDECIDED')

  const gate = validateGate0(matrix, { base })
  const dispositions = gate.gateAcceptanceBlockers.filter((item) => item.kind === 'RELEASE_BLOCKING_DEFECT_DISPOSITION')
  assert.equal(dispositions.length, 20, 'the live gate holds the 0B.7, 0B.8, 0B.9 and 0B.10 dispositions')
  assert.equal(dispositions.filter((item) => /^DEF-0B7-/.test(item.id ?? item.defectId ?? item.detail ?? JSON.stringify(item))).length, 4)
  const tampered = clone(base.classification0b8)
  const target = tampered.defectRegister.find((defect) => defect.id === PRIOR_DISPOSITIONED)
  target.releaseDisposition.disposition = 'CONDITIONALLY_BLOCKING'
  target.releaseBlocking = false
  assert.ok(validateGate0(matrix, { base, classification0b8: tampered }).problems.length > 0, 'the Gate 0 validator refuses a Gate 0B.7 disposition that has been relaxed')
})
