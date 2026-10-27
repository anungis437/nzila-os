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
import { FILES_0B8 } from './ue-gate0b8-classification.mjs'
import { FILES_0B9 } from './ue-gate0b9-classification.mjs'
import { FILES_0B10 } from './ue-gate0b10-classification.mjs'
import { FILES_0B11 } from './ue-gate0b11-classification.mjs'
import { FILES_0B12, NEW_CAPABILITY_IDS, validateClassification12 } from './ue-gate0b12-classification.mjs'
import { RISK_CATEGORIES, RISK_SCREENS, riskCategoryProblems, riskTriggers } from './ue-gate0b12-risk-screen.mjs'
import { coverageProblems, coverageSummary } from './ue-gate0b12-coverage.mjs'
import { crossTenantFlagProblems } from './ue-gate0b10-exposure.mjs'
import { ANCHOR_COMMIT, DECISION_BOUND_OPERATIONS, TRANCHE_SIZE } from './ue-gate0b12-ids.mjs'
import { FILE_EXCEPTIONS, inventoryTotals, inventoryTotalsProblems, validateDecisionBoundExceptions } from './ue-gate0b6-exceptions.mjs'
import { anchoredEntries, buildClassification12 } from './ue-gate0b12-build-classification.mjs'
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

function fixture() {
  return {
    classification: clone(base.classification0b12),
    manifest: clone(base.tranche0b12),
    ledger: clone(base.ledger0b1),
    classification0b1: clone(base.classification0b1),
    classification0b2: clone(base.classification0b2),
    classification0b3: clone(base.classification0b3),
    classification0b4: clone(base.classification0b4),
    classification0b5: clone(base.classification0b5),
    classification0b6: clone(base.classification0b6),
    classification0b7: clone(base.classification0b7),
    classification0b8: clone(base.classification0b8),
    classification0b9: clone(base.classification0b9),
    classification0b10: clone(base.classification0b10),
    classification0b11: clone(base.classification0b11),
    manifest0b1: clone(base.tranche0b1),
    manifest0b2: clone(base.tranche0b2),
    manifest0b3: clone(base.tranche0b3),
    manifest0b4: clone(base.tranche0b4),
    manifest0b5: clone(base.tranche0b5),
    manifest0b6: clone(base.tranche0b6),
    manifest0b7: clone(base.tranche0b7),
    manifest0b8: clone(base.tranche0b8),
    manifest0b9: clone(base.tranche0b9),
    manifest0b10: clone(base.tranche0b10),
    manifest0b11: clone(base.tranche0b11),
    reviewQueue: clone(base.reviewQueue0b7),
    entries: clone(base.ownership.entries),
    capabilityById: new Map(matrix.capabilities.map((capability) => [capability.id, capability])),
    universe: new Set(routeKeys(base.routes)),
    exists,
    readText,
    anchoredEntries: clone(base.anchoredOwnershipEntries0b12),
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
    laterOperations: new Set([...args.manifest0b6.operations, ...args.manifest0b7.operations, ...args.manifest0b8.operations, ...args.manifest0b9.operations, ...args.manifest0b10.operations, ...args.manifest0b11.operations, ...args.manifest.operations]),
  }
}

const run = (args) => validateClassification12(args)
const runExceptions = (args) => validateDecisionBoundExceptions(args)
const record = (args, id) => args.classification.operations.find((item) => item.id === id)
const entryOf = (args, id) => args.entries.find((entry) => `${entry[0]}|${entry[1]}` === id)
const defectOf = (args, id) => args.classification.defectRegister.find((item) => item.id === id)
const hasProblem = (result, pattern) => (Array.isArray(result) ? result : result.problems).some((problem) => pattern.test(problem))
const newDefects = (args) => args.classification.defectRegister.filter((defect) => defect.tranche === '0B.12')
const highNew = (args) => newDefects(args).filter((defect) => defect.severity === 'HIGH')
const escape = (id) => id.replace(/[[\]|.]/g, '\\$&')
const ctx = { exists, readText }

const CARBON_DASHBOARD = 'carbon/dashboard/route.ts|GET'
const CARBON_POST = 'carbon/validate/route.ts|POST'
const FIRST_NEW = 'support/sla/route.ts|POST'
const LAST_NEW = 'workspace/telemetry/route.ts|POST'
const SPLIT_FILE_EARLIER = 'support/sla/route.ts|GET'
const CLAIM_POST = 'workbook/[id]/claim/route.ts|POST'
const VOCAB_GET = 'vocabulary/route.ts|GET'
const CHECKOUT_POST = 'workbook/checkout/route.ts|POST'
const HOLDERS_GET = 'workbook/[id]/memory-holders/route.ts|GET'
const EXPORT_GET = 'workbook/[id]/export/route.ts|GET'
const ORGS_GET = 'users/me/organizations/route.ts|GET'
const V2_POST = 'v2/[...path]/route.ts|POST'
const EARLIER_CLASSIFIED = 'health-safety/hazards/route.ts|POST'
const EARLIER_CLASSIFIED_0B11 = 'portal/dues/balance/route.ts|GET'
const EARLIER_DEFECT = 'DEF-0B6-CMP-VALIDATE-ATTESTS-FROM-CALLER-DATA'
const PRIOR_DISPOSITIONED = 'DEF-0B7-EXC-READS-IGNORE-SENSITIVITY-LEVEL'
const PRIOR_CONDITIONAL = 'DEF-0B7-PLT-EXT-GET-RETURNS-WHOLE-INTEGRATION-ROW-WITH-CREDENTIALS'
const PRIOR8_DISPOSITIONED = 'DEF-0B8-HS-INCIDENT-ITEM-READ-MEMBER-FLOOR-WHOLE-ROW'
const PRIOR8_CONDITIONAL = 'DEF-0B8-HS-DASHBOARD-ERROR-RETURNS-SUCCESS-WITH-CLEAN-METRICS'
const PRIOR9_DISPOSITIONED = 'DEF-0B9-ORG-ROSTER-GET-ANY-ORGANIZATION-MEMBER-READS-FULL-ROSTER-WITH-CONTACT-DETAILS'
const PRIOR9_CONDITIONAL = 'DEF-0B9-ORG-ITEM-DELETE-ORGANIZATION-ADMIN-ARCHIVES-OWN-ORGANIZATION-BYPASSING-STATUS-GOVERNANCE'
const PRIOR10_DISPOSITIONED = 'DEF-0B10-ORG-CAMPAIGN-ROWS-READABLE-BY-ANY-MEMBER-WITH-STRATEGY-EMPLOYER-VULNERABILITIES-TEAM-AND-SUPPORT-COUNTS'
const PRIOR10_CONDITIONAL = 'DEF-0B10-PEN-T4A-POST-STORES-AN-ADMINISTRATOR-TYPED-INCOME-AS-A-GENERATED-TAX-RECORD'
const PRIOR11_DISPOSITIONED = highNewOf(base.classification0b11, 'RELEASE_BLOCKING')
const PRIOR11_CONDITIONAL = highNewOf(base.classification0b11, 'CONDITIONALLY_BLOCKING')

function highNewOf(classification, disposition) {
  return classification.defectRegister.find((defect) => defect.tranche === '0B.11' && defect.releaseDisposition?.disposition === disposition).id
}

const sortedUndecided = (entries) => entries
  .filter((entry) => entry[4] === 'SCOPE_UNDECIDED')
  .map((entry) => `${entry[0]}|${entry[1]}`)
  .filter((id) => !DECISION_BOUND_OPERATIONS.includes(id))
  .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

test('the committed Gate 0B.12 registers validate against the live source', () => {
  const result = run(fixture())
  assert.deepEqual(result.problems, [])
  assert.deepEqual(result.summary, {
    tranche: 'GATE-0B.12',
    examined: 77,
    carriedForward: 0,
    decisionBoundExcluded: 4,
    newlyExamined: 77,
    classified: 77,
    unresolved: 0,
    newDefects: 53,
    defectsTotal: 770,
    institutionalDecisions: 79,
    crossTenantExposures: 1,
    newCapabilities: 8,
    newHighDefects: 4,
    releaseDispositions: { RELEASE_BLOCKING: 4, CONDITIONALLY_BLOCKING: 0, NON_BLOCKING_WITH_JUSTIFICATION: 0 },
    reviewQueue: 71,
    riskCategoryDefects: {
      SENSITIVE_SOURCE_IN_DERIVED_OUTPUT: 3,
      PUBLICATION_BYPASSES_CLASSIFICATION_OR_CONSENT: 0,
      ANALYTICS_CROSSES_BOUNDARY: 0,
      RLS_ASSUMED_FROM_DB_CLIENT: 1,
      AUDIT_OUTSIDE_DATA_TRANSACTION: 1,
      GET_WITH_SIDE_EFFECTS: 1,
      FABRICATED_INSTITUTIONAL_FINDING: 4,
      EXTERNAL_DISCLOSURE_WITHOUT_DECISION: 2,
    },
    riskScreens: 6,
    coverage: {
      classes: {
        OWNED: 1503,
        SCOPE_UNDECIDED_AWAITING_CLASSIFICATION: 0,
        DECISION_BOUND_SCOPE_EXCEPTION: 4,
        RETIRED_501: 97,
        STUB_501: 31,
        SYSTEM: 9,
      },
      operations: 1644,
      examinedByTranches: 1152,
      decisionBoundExceptions: [...DECISION_BOUND_OPERATIONS].sort(),
    },
    preservedReleaseBlockingDispositions: 28,
  })
  assert.deepEqual(base.classification0b12.summary, result.summary, 'the committed summary is exactly what the validator derives')
})

test('the tranche freezes exactly the remaining 77 never-examined operations in ascending order at the Gate 0B.11 acceptance commit', () => {
  const args = fixture()
  assert.equal(args.manifest.size, TRANCHE_SIZE)
  assert.equal(args.manifest.operations.length, 77)
  assert.equal(args.manifest.anchorCommit, ACCEPTED['0B.11'])
  assert.equal(ANCHOR_COMMIT, ACCEPTED['0B.11'])
  assert.equal(args.manifest.anchorCommit.length, 40)
  assert.deepEqual(args.manifest.carryForward, [])
  assert.deepEqual(args.manifest.newOperations, args.manifest.operations)
  assert.equal(args.manifest.operations[0], FIRST_NEW)
  assert.equal(args.manifest.operations[76], LAST_NEW)
  assert.ok(args.manifest.operations.includes(FIRST_NEW), 'the support/sla POST that sorted after the 0B.11 boundary is the first operation of the final tranche')
  assert.deepEqual(args.manifest.operations, [...args.manifest.operations].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)))
  const examined = new Set([args.manifest0b1, args.manifest0b2, args.manifest0b3, args.manifest0b4, args.manifest0b5, args.manifest0b6, args.manifest0b7, args.manifest0b8, args.manifest0b9, args.manifest0b10, args.manifest0b11].flatMap((item) => item.operations))
  for (const id of args.manifest.operations) assert.ok(!examined.has(id), id)
  for (const id of DECISION_BOUND_OPERATIONS) assert.ok(!args.manifest.operations.includes(id), id)
  assert.deepEqual(args.manifest.operations, sortedUndecided(anchoredEntries()), 'the selection is every remaining SCOPE_UNDECIDED operation at the anchor, not the first N')
  assert.deepEqual(args.manifest.excludedDecisionBound, [...DECISION_BOUND_OPERATIONS].sort())
  assert.equal(args.manifest.version, 1)
  assert.equal(args.manifest.versionLog.length, 1)
  assert.equal(args.manifest.operationsHash, args.manifest.versionLog[0].operationsHash)
  assert.equal(args.manifest.operationsHash, 'c94a68dd6a722502aa6dc71836a4379d6967c718a51ebad5414e7c61e8dfd08b')
  assert.equal(args.ledger.tranches['GATE-0B.12'].operationsHash, args.manifest.operationsHash)
})

test('the manifest records the provenance of each earlier tranche exactly as the ledger holds it', () => {
  const args = fixture()
  assert.deepEqual(args.manifest.priorTranches.map((item) => item.tranche), ['GATE-0B.1', 'GATE-0B.2', 'GATE-0B.3', 'GATE-0B.4', 'GATE-0B.5', 'GATE-0B.6', 'GATE-0B.7', 'GATE-0B.8', 'GATE-0B.9', 'GATE-0B.10', 'GATE-0B.11'])
  for (const item of args.manifest.priorTranches) {
    assert.equal(item.operationsHash, args.ledger.tranches[item.tranche].operationsHash, item.tranche)
    assert.equal(item.version, 1, item.tranche)
  }
})

test('the four carbon operations stay decision-bound exceptions: not selected, not owned, not classified, not approved, and separately reported', () => {
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
  assert.equal(base.ownership.entries.filter((entry) => entry[4] === 'SCOPE_UNDECIDED').length, 4, 'only the four exceptions remain undecided')
  assert.equal(readText(FILE_EXCEPTIONS), fileAt(ACCEPTED['0B.11'], FILE_EXCEPTIONS), 'the exception register is byte-identical to the accepted commit')
})

test('every classified record cites its route file, states the authorization applied, names callers, audit and dependency gates, and has provenance for each material claim', () => {
  const args = fixture()
  assert.equal(args.classification.operations.length, 77)
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
    assert.ok(entryOf(args, item.id)[2].startsWith('RULE-0B12-'), item.id)
    assert.equal(entryOf(args, item.id)[4], 'OWNED', item.id)
  }
  assert.equal(record(args, CLAIM_POST).mutationAudit, 'ATOMIC_AUDIT_IN_TRANSACTION')
  assert.equal(record(args, VOCAB_GET).mutationAudit, 'NOT_MUTATING')
  assert.equal(record(args, ORGS_GET).mutationAudit, 'NONE', 'the organizations read re-binds membership rows with no audit event and is recorded as a GET with a side effect')
  assert.ok(args.classification.operations.every((item) => item.kernelAuthorization === false), 'no operation of this tranche claims a kernel decision it does not make')
  assert.ok(args.classification.operations.every((item) => item.authorizationCategory !== 'KERNEL_AUTHORITY'))
})

test('the eight new capabilities are justified by classified operations, sit in the matrix and the lock, and none exists to reduce the undecided count', () => {
  assert.equal(NEW_CAPABILITY_IDS.length, 8)
  const lock = JSON.parse(readFileSync(join(ROOT, FILES.lock), 'utf8'))
  const additions = new Map(lock.additions.filter((item) => item.tranche === 'GATE-0B.12').map((item) => [item.capabilityId, item]))
  assert.equal(additions.size, 8)
  for (const id of NEW_CAPABILITY_IDS) {
    const capability = matrix.capabilities.find((item) => item.id === id)
    assert.ok(capability, id)
    assert.ok(Number.isInteger(capability.primaryGate), id)
    assert.ok(capability.sourceFiles.length > 0 && capability.sourceFiles.every(exists), `${id} cites existing implementation source`)
    assert.ok(lock.capabilityIds.includes(id), id)
    const addition = additions.get(id)
    assert.equal(addition.operationsHash, base.tranche0b12.operationsHash, id)
    assert.equal(addition.classifiedOperations, base.classification0b12.operations.filter((item) => item.capabilityId === id).length, id)
    assert.ok(addition.classifiedOperations >= 1, id)
    assert.ok(String(capability.gap).length > 200, `${id} records its business justification and what the source lacks`)
    assert.doesNotMatch(JSON.stringify(capability), /PROVEN_IN_STAGING|"status":"complete"|"delivered"/)
  }
  assert.deepEqual(Object.fromEntries([...additions].map(([id, item]) => [id, item.classifiedOperations])), {
    'UE-OMIT-BARGAINING-UNIT-AND-WORKSITE-REGISTER': 10,
    'UE-OMIT-CUPE-VOCABULARY-REFERENCE-DATA': 6,
    'UE-OMIT-GOVERNANCE-WORKBOOK-PRODUCT': 8,
    'UE-OMIT-KPI-TARGET-CONFIGURATION': 3,
    'UE-OMIT-LEGACY-COMPATIBILITY-AND-DIAGNOSTIC-ROUTES': 7,
    'UE-OMIT-PLATFORM-MARKETING-TESTIMONIALS': 3,
    'UE-OMIT-VOICE-TRANSCRIPTION': 2,
    'UE-OMIT-WCB-CLAIMS-AND-EMPLOYER-ASSESSMENTS': 10,
  })
  assert.deepEqual(Object.fromEntries(NEW_CAPABILITY_IDS.map((id) => [id, matrix.capabilities.find((item) => item.id === id).primaryGate])), {
    'UE-OMIT-BARGAINING-UNIT-AND-WORKSITE-REGISTER': 14,
    'UE-OMIT-CUPE-VOCABULARY-REFERENCE-DATA': 14,
    'UE-OMIT-GOVERNANCE-WORKBOOK-PRODUCT': 14,
    'UE-OMIT-KPI-TARGET-CONFIGURATION': 14,
    'UE-OMIT-LEGACY-COMPATIBILITY-AND-DIAGNOSTIC-ROUTES': 14,
    'UE-OMIT-PLATFORM-MARKETING-TESTIMONIALS': 14,
    'UE-OMIT-VOICE-TRANSCRIPTION': 14,
    'UE-OMIT-WCB-CLAIMS-AND-EMPLOYER-ASSESSMENTS': 6,
  })
  assert.equal(matrix.capabilities.length, 111)
  assert.equal(lock.capabilityIds.length, 111)
  assert.ok(!NEW_CAPABILITY_IDS.includes('UE-OMIT-ROUTE-DOMAIN-SCOPE'))
})

test('the 53 new defects each have one responsible capability that owns the repair gate, and the earlier 717 are untouched', () => {
  const args = fixture()
  const added = newDefects(args)
  assert.equal(added.length, 53)
  for (const defect of added) {
    assert.ok(args.capabilityById.has(defect.ownerCapabilityId), defect.id)
    assert.equal(args.capabilityById.get(defect.ownerCapabilityId).primaryGate, defect.gate, defect.id)
    assert.ok(args.classification.operations.some((item) => item.defects.includes(defect.id)), defect.id)
    assert.ok(defect.id.startsWith('DEF-0B12-'), defect.id)
    assert.equal(typeof defect.releaseBlocking, 'boolean', defect.id)
  }
  assert.equal(args.classification.defectRegister.length, 770)
  assert.deepEqual(args.classification.defectRegister.slice(0, 717), base.classification0b11.defectRegister)
  const accepted = matrixAt(ACCEPTED['0B.11']).routeDefects
  assert.equal(accepted.length, 717)
  assert.equal(matrix.routeDefects.length, 770)
  const current = new Map(matrix.routeDefects.map((defect) => [defect.id, defect]))
  for (const defect of accepted) assert.deepEqual(current.get(defect.id), defect, defect.id)
  assert.equal(accepted.filter((defect) => defect.severity === 'HIGH').length, 140)
  assert.equal(matrix.routeDefects.filter((defect) => defect.severity === 'HIGH').length, 144)
})

test('every new HIGH defect records a release disposition proved against the source, and none is downgraded for being found in an inventory phase', () => {
  const args = fixture()
  const high = highNew(args)
  assert.equal(high.length, 4)
  const counts = { RELEASE_BLOCKING: 0, CONDITIONALLY_BLOCKING: 0, NON_BLOCKING_WITH_JUSTIFICATION: 0 }
  for (const defect of high) {
    const disposition = defect.releaseDisposition
    assert.ok(disposition, defect.id)
    counts[disposition.disposition] += 1
    assert.deepEqual(releaseDispositionProblems(defect, ctx), [], defect.id)
    assert.ok(disposition.activationEvidence.length > 0, defect.id)
    assert.notEqual(disposition.existingContainment, undefined, defect.id)
    assert.equal(defect.releaseBlocking, disposition.disposition === 'RELEASE_BLOCKING', defect.id)
    assert.doesNotMatch(disposition.justification, /inventory[- ]only|found (during|in) (an )?inventory/i, defect.id)
  }
  assert.deepEqual(counts, { RELEASE_BLOCKING: 4, CONDITIONALLY_BLOCKING: 0, NON_BLOCKING_WITH_JUSTIFICATION: 0 })
  assert.ok(newDefects(args).filter((defect) => defect.severity !== 'HIGH').every((defect) => defect.releaseBlocking === false || defect.releaseDisposition), 'a non-HIGH defect is release blocking only through a disposition')
  const gate = validateGate0(matrix, { base })
  assert.equal(gate.gateAcceptanceBlockers.filter((item) => item.kind === 'RELEASE_BLOCKING_DEFECT_DISPOSITION').length, 32, 'twenty-eight preserved from Gates 0B.7 to 0B.11 and four recorded here')
  assert.equal(gate.gateAcceptanceBlockers.filter((item) => item.kind === 'RELEASE_BLOCKING_ROUTE_EXPOSURE').length, 3)
})

test('the review queue still holds every one of the 71 HIGH defects of Gate 0B.1 to Gate 0B.6 with its original severity, release mark and hash, and assigns no disposition', () => {
  const args = fixture()
  const high = args.classification.defectRegister.filter((defect) => !['0B.7', '0B.8', '0B.9', '0B.10', '0B.11', '0B.12'].includes(defect.tranche) && defect.severity === 'HIGH')
  assert.equal(high.length, 71)
  assert.equal(args.reviewQueue.entries.length, 71)
  for (const defect of high) {
    const entry = args.reviewQueue.entries.find((item) => item.defectId === defect.id)
    assert.ok(entry, defect.id)
    assert.equal(entry.defectSha256, defectHash(defect), defect.id)
    assert.equal(entry.originalSeverity, 'HIGH', defect.id)
    assert.equal(entry.releaseDisposition, null, defect.id)
    assert.equal(entry.qualifiedBy, null, defect.id)
    assert.ok(!('releaseDisposition' in defect), `${defect.id} is not rewritten in place`)
  }
  assert.deepEqual(buildReviewQueue({ defectRegister: args.classification.defectRegister, anchorCommit: args.reviewQueue.anchorCommit }), args.reviewQueue)
  assert.equal(readText(FILES_0B7.reviewQueue), fileAt(ACCEPTED['0B.7'], FILES_0B7.reviewQueue), 'the review queue is byte-identical to the accepted commit')
})

test('earlier tranche files are byte-identical to the accepted commits and the ledger only grows', () => {
  for (const [key, files] of [['0B.1', FILES_0B1], ['0B.2', FILES_0B2], ['0B.3', FILES_0B3], ['0B.4', FILES_0B4], ['0B.5', FILES_0B5], ['0B.6', FILES_0B6], ['0B.7', FILES_0B7], ['0B.8', FILES_0B8], ['0B.9', FILES_0B9], ['0B.10', FILES_0B10], ['0B.11', FILES_0B11]]) {
    for (const file of [files.manifest, files.classification]) assert.equal(readText(file), fileAt(ACCEPTED[key], file), `${key} ${file}`)
  }
  const args = fixture()
  const anchored = ledgerAt(ANCHOR_COMMIT)
  for (const [id, owner] of Object.entries(anchored.classified)) assert.equal(args.ledger.classified[id], owner, id)
  for (const [id, tranche] of Object.entries(anchored.classifiedIn)) assert.equal(args.ledger.classifiedIn[id], tranche, id)
  assert.equal(Object.keys(anchored.classified).length, 1071)
  assert.equal(Object.keys(args.ledger.classified).length, 1071 + 77)
  for (const key of ['GATE-0B.1', 'GATE-0B.2', 'GATE-0B.3', 'GATE-0B.4', 'GATE-0B.5', 'GATE-0B.6', 'GATE-0B.7', 'GATE-0B.8', 'GATE-0B.9', 'GATE-0B.10', 'GATE-0B.11']) assert.equal(args.ledger.tranches[key].operationsHash, anchored.tranches[key].operationsHash)
  for (const old of base.anchoredOwnershipEntries0b12.filter((entry) => entry[4] !== 'SCOPE_UNDECIDED')) assert.notEqual(entryOf(args, `${old[0]}|${old[1]}`)[4], 'SCOPE_UNDECIDED')
})

test('the six inventory classes add up to 1644 with exactly one disposition per operation, and the matrix pins the twelfth tranche', () => {
  const totals = inventoryTotals(base.ownership.entries, exceptionOperations())
  assert.deepEqual(totals, {
    OWNED: 1503,
    SCOPE_UNDECIDED_AWAITING_CLASSIFICATION: 0,
    DECISION_BOUND_SCOPE_EXCEPTION: 4,
    RETIRED_501: 97,
    STUB_501: 31,
    SYSTEM: 9,
    operations: 1644,
  })
  assert.equal(Object.keys(totals).length, 7, 'no inventory class was added')
  assert.equal(1503 + 0 + 4 + 97 + 31 + 9, 1644)
  assert.deepEqual(matrix.routeInventoryTotals, totals)
  const before = countsAt(ACCEPTED['0B.11'])
  assert.deepEqual([before.owned, before.undecided, before.classified], [1426, 81, 1071])
  assert.equal(before.owned + 77, totals.OWNED)
  assert.equal(before.undecided - 77, totals.SCOPE_UNDECIDED_AWAITING_CLASSIFICATION + totals.DECISION_BOUND_SCOPE_EXCEPTION)
  const ids = base.ownership.entries.map((entry) => `${entry[0]}|${entry[1]}`)
  assert.equal(new Set(ids).size, 1644, 'one disposition per route-method operation')
  assert.deepEqual(new Set(ids), new Set(routeKeys(base.routes)))
  assert.equal(matrix.routeClassification0b12.files.manifest.sha256, sha(readText(FILES_0B12.manifest)))
  assert.equal(matrix.routeClassification0b12.files.classification.sha256, sha(readText(FILES_0B12.classification)))
  assert.equal(matrix.routeClassification0b11.files.classification.sha256, sha(readText(FILES_0B11.classification)))
  assert.equal(matrix.routeClassification0b10.files.classification.sha256, sha(readText(FILES_0B10.classification)))
})

test('the coverage reconciliation holds against the committed registers: all ten checks, with the retired, stub and system operations unchanged', () => {
  const args = fixture()
  const manifests = [args.manifest0b1, args.manifest0b2, args.manifest0b3, args.manifest0b4, args.manifest0b5, args.manifest0b6, args.manifest0b7, args.manifest0b8, args.manifest0b9, args.manifest0b10, args.manifest0b11, args.manifest]
  const input = { entries: args.entries, anchoredEntries: args.anchoredEntries, ledger: args.ledger, manifests, exceptionIds: [...DECISION_BOUND_OPERATIONS], frozen: args.manifest.operations, unresolved: [] }
  assert.deepEqual(coverageProblems(input), [])
  const summary = coverageSummary(input)
  assert.equal(summary.operations, 1644)
  assert.equal(summary.classes.SCOPE_UNDECIDED_AWAITING_CLASSIFICATION, 0)
  assert.equal(summary.classes.DECISION_BOUND_SCOPE_EXCEPTION, 4)
  assert.deepEqual(summary.decisionBoundExceptions, [...DECISION_BOUND_OPERATIONS].sort())
  for (const old of args.anchoredEntries.filter((entry) => ['RETIRED_501', 'STUB_501', 'SYSTEM'].includes(entry[4]))) {
    const now = entryOf(args, `${old[0]}|${old[1]}`)
    assert.equal(now[4], old[4], `${old[0]}|${old[1]}`)
    assert.equal(now[3], old[3], `${old[0]}|${old[1]}`)
  }
  assert.ok(!args.entries.some((entry) => entry[4] === 'OWNED' && entry[3] === UNDECIDED_OWNER), 'no owned operation names the undecided owner')
  for (const id of args.manifest.operations) assert.ok(entryOf(args, id)[2].startsWith('RULE-0B12-'), `${id} is owned by a Gate 0B.12 rule`)
  const ruleOwned = args.entries.filter((entry) => typeof entry[2] === 'string' && entry[2].startsWith('RULE-0B12-')).map((entry) => `${entry[0]}|${entry[1]}`).sort()
  assert.deepEqual(ruleOwned, [...args.manifest.operations].sort(), 'no Gate 0B.12 rule owns a method outside the frozen selection')
})

test('Gate 0 stays IN_PROGRESS, validates the twelfth tranche and keeps the exposures, the exceptions and the missing route manifest entry distinct', () => {
  const result = validateGate0(matrix, { base })
  assert.deepEqual(result.problems, [])
  assert.equal(result.summary.verdict, 'IN_PROGRESS')
  assert.equal(result.summary.classification0b12.classified, 77)
  assert.equal(result.summary.decisionBoundExceptions.exceptions, 4)
  assert.ok(!result.blockers.some((item) => item.code === 'ROUTE_UNJUSTIFIED_EXPOSURE'))
  assert.equal(result.summary.route.scopeUndecidedAwaitingClassification, 0)
  assert.equal(result.summary.route.decisionBoundScopeExceptions, 4)
  assert.equal(result.summary.capabilityCount, 111)
  const codes = result.blockers.map((item) => item.code)
  assert.ok(codes.includes('ROUTE_DECISION_BOUND_SCOPE_EXCEPTION'))
  assert.ok(codes.includes('PERSONA_SPEC_UNRESOLVED'))
  assert.ok(codes.includes('ROUTE_UNINVENTORIED'), 'reviews/route.ts is still outside the coverage manifest, so the inventory is not claimed complete')
  assert.ok(!codes.includes('ROUTE_SCOPE_UNDECIDED'), 'no never-examined operation stays undecided')
})

test('the committed registers are the deterministic output of the pipeline', () => {
  const rebuilt = buildClassification12()
  assert.deepEqual(rebuilt.result.problems, [])
  assert.deepEqual(rebuilt.manifest, base.tranche0b12)
  assert.deepEqual({ ...rebuilt.classification, summary: rebuilt.result.summary }, base.classification0b12)
  assert.deepEqual(rebuilt.ledger, base.ledger0b1)
})

test('adversarial findings are recorded as defects with a later gate and the source facts they rest on', () => {
  const args = fixture()
  const exposed = args.classification.operations.filter((item) => item.crossTenantExposure === true).map((item) => item.id).sort()
  assert.deepEqual(exposed, [ORGS_GET])
  const item = record(args, ORGS_GET)
  assert.equal(item.crossTenantAuthorized, false)
  assert.ok(item.exposureContract.length > 40)
  assert.ok(item.defects.some((defect) => defectOf(args, defect).releaseDisposition?.potentialImpact.classes.includes('CROSS_TENANT_DISCLOSURE')))
  const high = highNew(args)
  assert.ok(high.some((defect) => defect.releaseDisposition.activationState === 'REACHABLE_ANY_AUTHENTICATED'))
  assert.ok(high.some((defect) => defect.releaseDisposition.activationState === 'REACHABLE_ROLE_RESTRICTED'))
  assert.ok(high.every((defect) => defect.releaseDisposition.existingContainment !== 'NONE' || defect.releaseDisposition.disposition === 'RELEASE_BLOCKING'))
  const fabricated = record(args, V2_POST)
  assert.ok(fabricated.defects.some((defect) => /V2-CATCH-ALL/.test(defect)), 'the catch-all that reports success for a write it does not perform is recorded as a defect of the operation')
})

test('the eight risk categories are screened on every operation from source triggers, and the coverage is recorded in the summary', () => {
  const args = fixture()
  assert.equal(RISK_CATEGORIES.length, 8)
  const coverage = Object.fromEntries(RISK_CATEGORIES.map((category) => [category, newDefects(args).filter((defect) => (defect.riskCategories ?? []).includes(category)).length]))
  assert.deepEqual(coverage, {
    SENSITIVE_SOURCE_IN_DERIVED_OUTPUT: 3,
    PUBLICATION_BYPASSES_CLASSIFICATION_OR_CONSENT: 0,
    ANALYTICS_CROSSES_BOUNDARY: 0,
    RLS_ASSUMED_FROM_DB_CLIENT: 1,
    AUDIT_OUTSIDE_DATA_TRANSACTION: 1,
    GET_WITH_SIDE_EFFECTS: 1,
    FABRICATED_INSTITUTIONAL_FINDING: 4,
    EXTERNAL_DISCLOSURE_WITHOUT_DECISION: 2,
  })
  const defectsById = new Map(newDefects(args).map((defect) => [defect.id, defect]))
  for (const item of args.classification.operations) assert.deepEqual(riskCategoryProblems(item, defectsById, ctx), [], item.id)
  assert.deepEqual(Object.keys(RISK_SCREENS).sort(), args.classification.operations.filter((item) => Object.keys(item.riskScreen).length > 0).map((item) => item.id).sort())
  assert.equal(Object.keys(RISK_SCREENS).length, 5)
  assert.equal(Object.values(RISK_SCREENS).reduce((sum, screens) => sum + Object.keys(screens).length, 0), 6)
  assert.ok(riskTriggers(record(args, ORGS_GET), ctx).triggers.has('GET_WITH_SIDE_EFFECTS'), 'a GET that re-binds membership rows is found from its record')
  assert.ok(record(args, V2_POST).defects.some((id) => (defectsById.get(id)?.riskCategories ?? []).includes('AUDIT_OUTSIDE_DATA_TRANSACTION')), 'the audit-outside-transaction instance is carried by a defect of the catch-all')
})

test('NEGATIVE 1: the selection is exact, so an operation cannot disappear from, duplicate in, or be added to the frozen tranche', () => {
  const dropped = fixture()
  dropped.classification.operations = dropped.classification.operations.filter((item) => item.id !== CLAIM_POST)
  assert.ok(hasProblem(run(dropped), /has no classification record/))
  const manifest = fixture()
  manifest.manifest.operations = manifest.manifest.operations.filter((id) => id !== CLAIM_POST)
  const result = run(manifest)
  assert.ok(hasProblem(result, /exactly 77 operations/))
  assert.ok(hasProblem(result, /operationsHash/))
  const stray = fixture()
  stray.classification.operations.push({ ...clone(record(stray, CLAIM_POST)), id: 'zzz/route.ts|GET' })
  assert.ok(hasProblem(run(stray), /is not in the frozen tranche/))
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
  ledger.ledger.tranches['GATE-0B.12'].operationsHash = '0'.repeat(64)
  assert.ok(hasProblem(run(ledger), /changed without a new versioned reason/))
  const anchor = fixture()
  anchor.manifest.anchorCommit = '0'.repeat(40)
  assert.ok(hasProblem(run(anchor), /anchor commit is not the recorded Gate 0B.11 acceptance commit/))
  const earlier = fixture()
  earlier.manifest0b11.operations = [...earlier.manifest0b11.operations, earlier.manifest.operations[0]]
  assert.ok(hasProblem(run(earlier), /was already examined in an earlier tranche/))
  const partial = fixture()
  partial.manifest.operations = partial.manifest.operations.slice(0, 60)
  partial.manifest.newOperations = partial.manifest.operations
  assert.ok(hasProblem(run(partial), /not every remaining SCOPE_UNDECIDED operation|exactly 77 operations/), 'a partial final tranche cannot stand in for the whole remainder')
})

test('NEGATIVE 2: an unsupported route claim is refused: missing, invented, wrong-method or unprovenanced evidence, and an unreal caller', () => {
  const none = fixture()
  record(none, CLAIM_POST).evidence = []
  assert.ok(hasProblem(run(none), /evidence/))
  const invented = fixture()
  record(invented, CLAIM_POST).evidence[1] = { ...record(invented, CLAIM_POST).evidence[1], quote: 'this line is not in the file' }
  assert.ok(hasProblem(run(invented), /not in|is not present|does not contain/))
  const sibling = fixture()
  const item = record(sibling, CLAIM_POST)
  const index = item.evidence.findIndex((evidence) => evidence.provenance === 'ROUTE_HANDLER_DIRECT')
  item.evidence[index] = { ...item.evidence[index], method: 'GET' }
  assert.ok(hasProblem(run(sibling), /is tagged for GET but the record is POST/))
  const unprovenanced = fixture()
  delete record(unprovenanced, CLAIM_POST).evidence[0].provenance
  assert.ok(hasProblem(run(unprovenanced), /provenance/))
  const callers = fixture()
  record(callers, CLAIM_POST).callers = [{ ref: 'apps/union-eyes/does-not-exist.ts', quote: 'x' }]
  assert.ok(hasProblem(run(callers), /does not exist|caller/))
  const phantomFinding = fixture()
  record(phantomFinding, VOCAB_GET).callerFinding = 'No caller was found for this route anywhere in the application source tree.'
  assert.ok(record(phantomFinding, VOCAB_GET).callers.length > 0)
  assert.ok(hasProblem(run(phantomFinding), /lists callers but its finding says there are none/))
  const hiddenCaller = fixture()
  record(hiddenCaller, CHECKOUT_POST).callers = clone(record(hiddenCaller, VOCAB_GET).callers)
  assert.ok(hasProblem(run(hiddenCaller), /lists callers but its finding says there are none|cites a caller line that is not in/))
})

test('NEGATIVE 3: an invented or catch-all owner, an owner the group does not name, and an unowned operation are refused', () => {
  const invented = fixture()
  record(invented, CLAIM_POST).capabilityId = 'UE-OMIT-INVENTED-TO-REDUCE-UNDECIDED'
  assert.ok(hasProblem(run(invented), /names an invalid capability/))
  const catchAll = fixture()
  record(catchAll, CLAIM_POST).capabilityId = 'UE-OMIT-ROUTE-DOMAIN-SCOPE'
  assert.ok(hasProblem(run(catchAll), /names an invalid capability/))
  const wrongOwner = fixture()
  record(wrongOwner, CLAIM_POST).capabilityId = 'UE-CAP-D-002'
  assert.ok(hasProblem(run(wrongOwner), /ownership register names|does not cover|belongs to/))
  const rule = fixture()
  entryOf(rule, CLAIM_POST)[2] = 'RULE-DOMAIN-SCOPE-UNDECIDED'
  assert.ok(hasProblem(run(rule), /not a Gate 0B.12 business-evidence rule/))
  const domain = fixture()
  record(domain, CLAIM_POST).domain = 'SOMETHING_ELSE'
  assert.ok(hasProblem(run(domain), /does not cover|belongs to/))
  const unowned = fixture()
  entryOf(unowned, CLAIM_POST)[4] = 'SCOPE_UNDECIDED'
  entryOf(unowned, CLAIM_POST)[3] = UNDECIDED_OWNER
  const unownedResult = run(unowned)
  assert.ok(hasProblem(unownedResult, /still records SCOPE_UNDECIDED/))
  assert.ok(hasProblem(unownedResult, new RegExp(`never-examined operation ${escape(CLAIM_POST)} stays SCOPE_UNDECIDED after the final tranche`)))
  assert.ok(hasProblem(unownedResult, new RegExp(`operation ${escape(CLAIM_POST)} is still SCOPE_UNDECIDED and is not a decision-bound scope exception`)))
  assert.ok(hasProblem(unownedResult, /1 operation\(s\) still await classification/))
  const missingCapability = fixture()
  missingCapability.capabilityById.delete(NEW_CAPABILITY_IDS[0])
  assert.ok(hasProblem(run(missingCapability), /is not in the engineering completion matrix/))
  const unresolved = fixture()
  record(unresolved, CLAIM_POST).status = 'UNRESOLVED'
  const unresolvedResult = run(unresolved)
  assert.ok(hasProblem(unresolvedResult, /is unresolved but is not a recorded evidence gap/))
  assert.ok(hasProblem(unresolvedResult, new RegExp(`operation ${escape(CLAIM_POST)} is an unresolved evidence gap; the route inventory cannot be reconciled as complete`)))
})

test('NEGATIVE 4: ownership is never authorization: a role floor is not a kernel decision and reachable cross-tenant data is never authorized', () => {
  const kernel = fixture()
  record(kernel, CLAIM_POST).kernelAuthorization = true
  assert.ok(hasProblem(run(kernel), /inconsistent about kernel authorization|claims kernel authorization but cites no kernel decision/))
  const category = fixture()
  record(category, CLAIM_POST).kernelAuthorization = true
  record(category, CLAIM_POST).authorizationCategory = 'KERNEL_AUTHORITY'
  assert.ok(hasProblem(run(category), /claims kernel authorization but cites no kernel decision/))
  const floor = fixture()
  record(floor, CLAIM_POST).authorizationCategory = 'ROLE_FLOOR'
  record(floor, CLAIM_POST).kernelAuthorization = true
  assert.ok(hasProblem(run(floor), /role floor and must record kernelAuthorization false|inconsistent about kernel authorization/))
  const authorized = fixture()
  record(authorized, ORGS_GET).crossTenantAuthorized = true
  assert.ok(hasProblem(run(authorized), /records it as authorized|records cross-tenant access as authorized/))
  const noDefect = fixture()
  const exposed = record(noDefect, VOCAB_GET)
  exposed.crossTenantExposure = true
  exposed.crossTenantAuthorized = false
  exposed.exposureContract = 'Any holder of the link can read the rows of every organization by id through this route.'
  exposed.defects = []
  assert.ok(hasProblem(run(noDefect), /exposes cross-tenant data without a recorded defect/))
  const justified = fixture()
  record(justified, CLAIM_POST).accessJustifiedBy = 'UE-INST-EXIT-INTERVIEW-RECORD-READERS'
  assert.ok(hasProblem(run(justified), /justifies access by/))
  const silent = fixture()
  record(silent, CLAIM_POST).crossTenantAuthorized = true
  assert.ok(hasProblem(run(silent), /records cross-tenant access as authorized/))
  const unknown = fixture()
  record(unknown, CLAIM_POST).institutionalDecisions = ['UE-INST-DOES-NOT-EXIST']
  assert.ok(hasProblem(run(unknown), /cites unknown institutional decision/))
  const clone0 = fixture()
  record(clone0, CLAIM_POST).authorizationCategory = 'NOT_A_CATEGORY'
  assert.ok(run(clone0).problems.length > 0, 'an invented authorization category is refused')
})

test('NEGATIVE 5: a mutation or audit that the source does not support is refused', () => {
  const withoutAtomicWrite = (args) => {
    const item = record(args, CLAIM_POST)
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
  record(readWrite, VOCAB_GET).evidence.push({ ref: 'apps/union-eyes/app/api/vocabulary/route.ts', quote: 'await db.insert(vocabulary)' })
  assert.ok(run(readWrite).problems.length > 0, 'a read that cites a write the source does not contain is refused')
  const silentWrite = fixture()
  record(silentWrite, VOCAB_GET).mutationAudit = 'NONE'
  assert.ok(hasProblem(run(silentWrite), /is a read that writes with no audit record but cites no write/))
  const unaudited = fixture()
  record(unaudited, VOCAB_GET).mutationAudit = 'SEPARATE_AUDIT_EVENT_NOT_ATOMIC'
  assert.ok(hasProblem(run(unaudited), /records a separate audit event without citing it/))
  const unreasoned = fixture()
  record(unreasoned, CLAIM_POST).mutationAudit = 'NOT_MUTATING'
  assert.ok(hasProblem(run(unreasoned), /is POST but is marked not mutating without a reason/))
})

test('NEGATIVE 6: a HIGH defect needs a justified release disposition, and the disposition cannot be hollow, excused by the phase, downgraded or inconsistent', () => {
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
  highNew(fakeEvidence)[0].releaseDisposition.activationEvidence = [{ ref: 'apps/union-eyes/app/api/vocabulary/route.ts', quote: 'this quote is not in that file at all' }]
  assert.ok(hasProblem(run(fakeEvidence), /quotes a line that is not in/))

  const mismatch = fixture()
  highNew(mismatch)[0].releaseBlocking = false
  assert.ok(hasProblem(run(mismatch), /has a RELEASE_BLOCKING disposition but is not marked release blocking/))

  const downgraded = fixture()
  highNew(downgraded)[0].releaseBlocking = false
  highNew(downgraded)[0].releaseDisposition.disposition = 'NON_BLOCKING_WITH_JUSTIFICATION'
  assert.ok(run(downgraded).problems.length > 0, 'a release-blocking defect cannot be downgraded in the register')

  const fakeContainment = fixture()
  const contained = highNew(fakeContainment).find((defect) => defect.releaseDisposition.existingContainment !== 'NONE')
  contained.releaseDisposition.existingContainment.evidence = [{ ref: 'apps/union-eyes/app/api/vocabulary/route.ts', quote: 'a containment line that does not exist in the file' }]
  assert.ok(hasProblem(run(fakeContainment), /containment quotes a line that is not in/))

  const unstated = fixture()
  delete highNew(unstated)[0].releaseDisposition.existingContainment
  assert.ok(hasProblem(run(unstated), /does not state its existing containment/))

  const unlisted = fixture()
  highNew(unlisted)[0].severity = 'MEDIUM'
  assert.ok(run(unlisted).problems.length > 0, 'a HIGH defect cannot escape its disposition by being relabelled MEDIUM')
})

test('NEGATIVE 7: a historical tranche, defect or disposition cannot be mutated, reverted, re-owned or relaxed, and a new HIGH defect cannot be downgraded for harm that reaches other organizations', () => {
  const dropped = fixture()
  dropped.classification.defectRegister = dropped.classification.defectRegister.filter((item) => item.id !== EARLIER_DEFECT)
  assert.ok(hasProblem(run(dropped), /is missing from the defect register/))
  const downgraded = fixture()
  defectOf(downgraded, EARLIER_DEFECT).severity = 'LOW'
  assert.ok(hasProblem(run(downgraded), /was altered in the defect register/))
  const dispositioned = fixture()
  defectOf(dispositioned, EARLIER_DEFECT).releaseDisposition = clone(highNew(dispositioned)[0].releaseDisposition)
  const dispositionedResult = run(dispositioned)
  assert.ok(hasProblem(dispositionedResult, /gained a release disposition; the frozen records are preserved/))
  assert.ok(hasProblem(dispositionedResult, /was altered in the defect register/))
  const smuggled = fixture()
  smuggled.classification.defectRegister.push({ ...clone(smuggled.classification.defectRegister[0]), id: 'DEF-0B5-SMUGGLED' })
  assert.ok(hasProblem(run(smuggled), /earlier-tranche defect that no earlier tranche recorded/))
  const wrongTranche = fixture()
  newDefects(wrongTranche)[0].tranche = '0B.13'
  assert.ok(hasProblem(run(wrongTranche), /does not record the tranche that found it/))

  const removed = fixture()
  removed.reviewQueue.entries = removed.reviewQueue.entries.filter((entry) => entry.defectId !== EARLIER_DEFECT)
  assert.ok(hasProblem(run(removed), new RegExp(`HIGH defect ${EARLIER_DEFECT} of Gate 0B.6 is missing from the release disposition review queue`)))
  const preassigned = fixture()
  preassigned.reviewQueue.entries[0].releaseDisposition = 'NON_BLOCKING_WITH_JUSTIFICATION'
  assert.ok(hasProblem(run(preassigned), /records a disposition; only an independent qualification may/))

  for (const [id, label] of [[PRIOR_DISPOSITIONED, 'Gate 0B.7'], [PRIOR8_DISPOSITIONED, 'Gate 0B.8'], [PRIOR9_DISPOSITIONED, 'Gate 0B.9'], [PRIOR10_DISPOSITIONED, 'Gate 0B.10'], [PRIOR11_DISPOSITIONED, 'Gate 0B.11']]) {
    const altered = fixture()
    defectOf(altered, id).releaseDisposition.disposition = 'CONDITIONALLY_BLOCKING'
    defectOf(altered, id).releaseBlocking = false
    assert.ok(hasProblem(run(altered), /was altered in the defect register/), label)

    const stripped = fixture()
    delete defectOf(stripped, id).releaseDisposition
    assert.ok(hasProblem(run(stripped), /was altered in the defect register|is HIGH severity and records no release disposition/), label)

    const gone = fixture()
    gone.classification.defectRegister = gone.classification.defectRegister.filter((item) => item.id !== id)
    assert.ok(hasProblem(run(gone), /is missing from the defect register/), label)
  }
  for (const id of [PRIOR_CONDITIONAL, PRIOR8_CONDITIONAL, PRIOR9_CONDITIONAL, PRIOR10_CONDITIONAL, PRIOR11_CONDITIONAL]) {
    const relaxed = fixture()
    defectOf(relaxed, id).releaseDisposition.disposition = 'NON_BLOCKING_WITH_JUSTIFICATION'
    assert.ok(hasProblem(run(relaxed), /was altered in the defect register/), id)
    const reseverity = fixture()
    defectOf(reseverity, id).severity = 'MEDIUM'
    assert.ok(hasProblem(run(reseverity), /was altered in the defect register/), id)
  }

  const reverted = fixture()
  entryOf(reverted, EARLIER_CLASSIFIED)[4] = 'SCOPE_UNDECIDED'
  assert.ok(hasProblem(run(reverted), /was changed or reverted|silently reverted to SCOPE_UNDECIDED/))
  const revertedLatest = fixture()
  entryOf(revertedLatest, EARLIER_CLASSIFIED_0B11)[4] = 'SCOPE_UNDECIDED'
  assert.ok(hasProblem(run(revertedLatest), /Gate 0B.11 classification .* was changed or reverted|silently reverted to SCOPE_UNDECIDED/))
  const reowned = fixture()
  entryOf(reowned, EARLIER_CLASSIFIED)[3] = 'UE-OMIT-ENTERPRISE-SSO-IDENTITY-PROVIDERS'
  assert.ok(hasProblem(run(reowned), /changed owner from .* without a versioned reason|was changed or reverted/))
  const ledger = fixture()
  delete ledger.ledger.classified[EARLIER_CLASSIFIED]
  assert.ok(hasProblem(run(ledger), /is missing or changed in the ledger/))
  const moved = fixture()
  moved.ledger.classifiedIn[EARLIER_CLASSIFIED_0B11] = 'GATE-0B.12'
  assert.ok(hasProblem(run(moved), /no longer records GATE-0B.11 in the ledger/))
  const phantom = fixture()
  phantom.ledger.classifiedIn['zzz/route.ts|GET'] = 'GATE-0B.12'
  assert.ok(hasProblem(run(phantom), /ledger records zzz\/route.ts\|GET as classified in GATE-0B.12 but no classification exists/))
  const unledgered = fixture()
  delete unledgered.ledger.classified[CLAIM_POST]
  assert.ok(hasProblem(run(unledgered), /is not recorded in the classification ledger/))
  const exposure = fixture()
  exposure.classification.releaseBlockingExposures = exposure.classification.releaseBlockingExposures.slice(1)
  assert.ok(hasProblem(run(exposure), /is not preserved as a release-blocking defect/))
  const edited = fixture()
  edited.manifest0b11.operations = edited.manifest0b11.operations.slice(1)
  run(edited)
  assert.equal(readText(FILES_0B11.classification), fileAt(ACCEPTED['0B.11'], FILES_0B11.classification))
  assert.equal(readText(FILES_0B11.manifest), fileAt(ACCEPTED['0B.11'], FILES_0B11.manifest))

  const decision = fixture()
  decision.classification.institutionalDecisions = decision.classification.institutionalDecisions.filter((item) => item.id !== 'UE-INST-CARBON-ACCOUNTING-SCOPE')
  assert.ok(hasProblem(run(decision), /recorded by an earlier tranche is missing; a decision cannot be silently closed by removal/))
  const adopted = fixture()
  adopted.classification.institutionalDecisions.find((item) => item.id === 'UE-INST-CARBON-ACCOUNTING-SCOPE').status = 'ADOPTED'
  const adoptedResult = run(adopted)
  assert.ok(hasProblem(adoptedResult, /is ADOPTED; Gate 0B.12 can record only outstanding decisions/))
  assert.ok(hasProblem(adoptedResult, /was altered or adopted/))
  const newAdopted = fixture()
  newAdopted.classification.institutionalDecisions.find((item) => item.id === 'UE-INST-WORKBOOK-CLAIM-AND-SAME-ORGANIZATION-PEER-AUTHORITY').status = 'ADOPTED'
  assert.ok(hasProblem(run(newAdopted), /is ADOPTED; Gate 0B.12 can record only outstanding decisions/), 'a decision recorded by the final tranche is not adopted by it')

  const gate = validateGate0(matrix, { base })
  const dispositions = gate.gateAcceptanceBlockers.filter((item) => item.kind === 'RELEASE_BLOCKING_DEFECT_DISPOSITION')
  assert.equal(dispositions.length, 32)
  const text = (item) => item.id ?? item.defectId ?? item.detail ?? JSON.stringify(item)
  for (const [prefix, count] of [['DEF-0B7-', 4], ['DEF-0B8-', 4], ['DEF-0B9-', 8], ['DEF-0B10-', 4], ['DEF-0B11-', 8], ['DEF-0B12-', 4]]) assert.equal(dispositions.filter((item) => text(item).startsWith(prefix)).length, count, prefix)
  for (const id of [PRIOR_DISPOSITIONED, PRIOR8_DISPOSITIONED, PRIOR9_DISPOSITIONED, PRIOR10_DISPOSITIONED, PRIOR11_DISPOSITIONED]) {
    const tampered = clone(base.classification0b12)
    const defect = tampered.defectRegister.find((item) => item.id === id)
    defect.releaseDisposition.disposition = 'CONDITIONALLY_BLOCKING'
    defect.releaseBlocking = false
    assert.ok(validateGate0(matrix, { base, classification0b12: tampered }).problems.length > 0, `the Gate 0 validator refuses a relaxed ${id}`)
  }

  const template = highNew(fixture())[0]
  const downgrade = (mutate) => {
    const item = clone(template)
    item.releaseBlocking = false
    item.releaseDisposition.disposition = 'NON_BLOCKING_WITH_JUSTIFICATION'
    delete item.releaseDisposition.blockingCondition
    mutate(item.releaseDisposition)
    return releaseDispositionProblems(item, ctx)
  }
  assert.ok(downgrade((d) => { d.potentialImpact.classes = ['CROSS_TENANT_DISCLOSURE'] }).some((item) => /reaches another organization and cannot be NON_BLOCKING_WITH_JUSTIFICATION/.test(item)))
  assert.ok(downgrade((d) => { d.activationState = 'REACHABLE_UNAUTHENTICATED'; d.potentialImpact.classes = ['DATA_QUALITY'] }).some((item) => /reachable without authentication and cannot be NON_BLOCKING_WITH_JUSTIFICATION/.test(item)))
  assert.ok(downgrade((d) => { d.existingContainment = 'NONE'; d.activationState = 'REACHABLE_ROLE_RESTRICTED'; d.potentialImpact.classes = ['DATA_QUALITY'] }).some((item) => /without an existing containment/.test(item)))
})

test('NEGATIVE 8: complete coverage cannot be faked: an extra disposition, a stale undecided, a converted exception, a changed retired operation or an unledgered classification is refused', () => {
  const args = fixture()
  const manifests = [args.manifest0b1, args.manifest0b2, args.manifest0b3, args.manifest0b4, args.manifest0b5, args.manifest0b6, args.manifest0b7, args.manifest0b8, args.manifest0b9, args.manifest0b10, args.manifest0b11, args.manifest]
  const input = (mutate) => {
    const copy = { entries: clone(args.entries), anchoredEntries: clone(args.anchoredEntries), ledger: clone(args.ledger), manifests: clone(manifests), exceptionIds: [...DECISION_BOUND_OPERATIONS], frozen: [...args.manifest.operations], unresolved: [] }
    mutate(copy)
    return coverageProblems(copy)
  }
  assert.deepEqual(input(() => {}), [])

  assert.ok(input((i) => { i.entries.push(clone(i.entries.find((entry) => `${entry[0]}|${entry[1]}` === CLAIM_POST))) }).some((p) => /has 2 dispositions; exactly one is required/.test(p)), 'a duplicate disposition is refused')
  assert.ok(input((i) => { i.entries = i.entries.filter((entry) => `${entry[0]}|${entry[1]}` !== CLAIM_POST) }).some((p) => new RegExp(`ledger classification ${escape(CLAIM_POST)} is not in the ownership register`).test(p)), 'an operation dropped from the register is caught through the ledger')
  assert.ok(input((i) => { const e = i.entries.find((entry) => `${entry[0]}|${entry[1]}` === CLAIM_POST); e[4] = 'SCOPE_UNDECIDED'; e[3] = UNDECIDED_OWNER }).some((p) => /is still SCOPE_UNDECIDED and is not a decision-bound scope exception/.test(p)))
  assert.ok(input((i) => { const e = i.entries.find((entry) => `${entry[0]}|${entry[1]}` === CLAIM_POST); e[4] = 'MAYBE' }).some((p) => /is not one of the six inventory classes/.test(p)))
  assert.ok(input((i) => { i.entries.find((entry) => `${entry[0]}|${entry[1]}` === CARBON_DASHBOARD)[4] = 'OWNED' }).some((p) => /was given disposition OWNED; an exception is non-authorizing/.test(p)), 'a carbon exception cannot be converted into owned scope to finish the count')
  assert.ok(input((i) => { i.ledger.classified[CARBON_POST] = 'UE-OMIT-ENTERPRISE-SSO-IDENTITY-PROVIDERS' }).some((p) => /is recorded as classified in the ledger/.test(p)))
  assert.ok(input((i) => { i.frozen.push(CARBON_DASHBOARD) }).some((p) => /is inside the frozen Gate 0B.12 selection/.test(p)))
  assert.ok(input((i) => { i.exceptionIds = i.exceptionIds.slice(1) }).some((p) => /is still SCOPE_UNDECIDED and is not a decision-bound scope exception/.test(p)), 'an exception removed from the exception list is a coverage failure, not a way to hide it')
  assert.ok(input((i) => { delete i.ledger.classified[CLAIM_POST] }).some((p) => /was examined by a tranche but the ledger does not record a classification/.test(p)))
  assert.ok(input((i) => { i.unresolved = [CLAIM_POST] }).some((p) => /is an unresolved evidence gap/.test(p)))
  const retired = args.anchoredEntries.find((entry) => entry[4] === 'RETIRED_501')
  const retiredId = `${retired[0]}|${retired[1]}`
  assert.ok(input((i) => { i.entries.find((entry) => `${entry[0]}|${entry[1]}` === retiredId)[4] = 'OWNED' }).some((p) => new RegExp(`retired, stub or system operation ${escape(retiredId)} changed from RETIRED_501`).test(p)), 'a retired 501 operation cannot be promoted')
  const system = args.anchoredEntries.find((entry) => entry[4] === 'SYSTEM')
  const systemId = `${system[0]}|${system[1]}`
  assert.ok(input((i) => { i.entries.find((entry) => `${entry[0]}|${entry[1]}` === systemId)[3] = 'UE-OMIT-FINANCE-UNAVAILABLE' }).some((p) => new RegExp(`retired, stub or system operation ${escape(systemId)} changed`).test(p)))
  assert.ok(input((i) => { for (const entry of i.entries) if (`${entry[0]}|${entry[1]}` === FIRST_NEW) { entry[4] = 'SCOPE_UNDECIDED'; entry[3] = UNDECIDED_OWNER } }).some((p) => /operation\(s\) still await classification/.test(p)))

  const totals = inventoryTotals(args.entries, exceptionOperations())
  const inflated = { ...totals, SCOPE_UNDECIDED_AWAITING_CLASSIFICATION: totals.SCOPE_UNDECIDED_AWAITING_CLASSIFICATION + 4 }
  assert.ok(inventoryTotalsProblems(inflated, totals).some((problem) => /INVENTORY-TOTALS-SUM: the categories add to 1648, not the 1644/.test(problem)))
  const converted = inventoryTotals(args.entries.map((entry) => (DECISION_BOUND_OPERATIONS.includes(`${entry[0]}|${entry[1]}`) ? [...entry.slice(0, 4), 'OWNED', ...entry.slice(5)] : entry)), exceptionOperations())
  assert.equal(converted.OWNED, 1507)
  assert.ok(inventoryTotalsProblems(converted, totals).some((problem) => /INVENTORY-TOTALS-DRIFT/.test(problem)))
})

test('NEGATIVE 9: ownership cannot spill across the tranche boundary: a rule cannot own a method outside the frozen 77, and a decision-bound exception cannot be re-examined', () => {
  const spill = fixture()
  const earlier = entryOf(spill, SPLIT_FILE_EARLIER)
  assert.equal(earlier[4], 'OWNED')
  assert.ok(earlier[2].startsWith('RULE-0B11-'), 'the sla GET was classified by Gate 0B.11 and keeps its rule')
  earlier[2] = entryOf(spill, FIRST_NEW)[2]
  assert.ok(hasProblem(run(spill), new RegExp(`owns ${escape(SPLIT_FILE_EARLIER)}, which is outside the frozen tranche`)), 'a Gate 0B.12 rule that captures an earlier method is refused')

  const carbon = fixture()
  const carbonEntry = entryOf(carbon, CARBON_DASHBOARD)
  carbonEntry[2] = entryOf(carbon, FIRST_NEW)[2]
  carbonEntry[4] = 'OWNED'
  assert.ok(hasProblem(run(carbon), new RegExp(`owns ${escape(CARBON_DASHBOARD)}, which is outside the frozen tranche`)), 'a Gate 0B.12 rule that captures a carbon exception is refused')

  const rules = base.ownership.rules.filter((rule) => rule.id.startsWith('RULE-0B12-'))
  assert.ok(rules.length > 0)
  const frozenOps = new Set(base.tranche0b12.operations)
  for (const rule of rules) {
    const owned = base.ownership.entries.filter((entry) => entry[2] === rule.id)
    assert.ok(owned.length > 0 && owned.every((entry) => frozenOps.has(`${entry[0]}|${entry[1]}`)), `${rule.id} owns only frozen operations`)
    for (const file of new Set(owned.map((entry) => entry[0]))) {
      const siblings = base.ownership.entries.filter((entry) => entry[0] === file)
      if (siblings.some((entry) => !frozenOps.has(`${entry[0]}|${entry[1]}`))) assert.ok(Array.isArray(rule.methods) && rule.methods.length > 0, `${rule.id} shares ${file} with an earlier method and is limited to named methods`)
    }
  }
  assert.deepEqual(base.ownership.rules.find((rule) => rule.id === 'RULE-0B12-CRUD-SUPPORT-SLA-POST').methods, ['POST'])

  const carbonSelected = fixture()
  carbonSelected.manifest.operations = [...carbonSelected.manifest.operations, CARBON_POST].sort()
  assert.ok(hasProblem(run(carbonSelected), /is a decision-bound scope exception and may not be re-examined/))
  const carried = fixture()
  carried.manifest.carryForward = [CARBON_POST]
  assert.ok(hasProblem(run(carried), /carries forward operations; the decision-bound exceptions are never carried into a tranche/))
  const unrecorded = fixture()
  unrecorded.manifest.excludedDecisionBound = unrecorded.manifest.excludedDecisionBound.slice(1)
  assert.ok(hasProblem(run(unrecorded), /does not record the decision-bound operations it excludes from selection/))
  const reclassified = fixture()
  reclassified.classification.operations.push({ ...clone(record(reclassified, CLAIM_POST)), id: CARBON_POST, route: 'carbon/validate/route.ts', method: 'POST' })
  assert.ok(hasProblem(run(reclassified), /is not in the frozen tranche/))
  const reselected = exceptionFixture()
  reselected.laterOperations = new Set([...reselected.laterOperations, CARBON_POST])
  assert.ok(hasProblem(runExceptions(reselected), /was re-examined by a later tranche; a decision-bound exception is not selected for source investigation again/))
  for (const flag of ['adopted', 'authorized', 'operationallyApproved', 'productionReady', 'countedAsOwned']) {
    const flagged = exceptionFixture()
    flagged.register.exceptions[0][flag] = true
    assert.ok(hasProblem(runExceptions(flagged), new RegExp(`records ${flag} true`)), flag)
  }

  const frozen = new Set(base.tranche0b12.operations)
  for (const file of new Set(base.tranche0b12.operations.map((id) => id.split('|')[0]))) {
    for (const entry of base.ownership.entries.filter((candidate) => candidate[0] === file)) {
      const id = `${entry[0]}|${entry[1]}`
      assert.equal(frozen.has(id), entry[2].startsWith('RULE-0B12-'), `${id}: only a frozen method carries a Gate 0B.12 rule`)
    }
  }
})

test('NEGATIVE 10: the lock cannot gain a capability without provenance, and an addition record cannot be forged, inflated or stripped', () => {
  const lock = JSON.parse(readFileSync(join(ROOT, FILES.lock), 'utf8'))
  const stripped = validateGate0(matrix, { base, lock: { ...clone(lock), additions: lock.additions.filter((item) => item.tranche !== 'GATE-0B.12') } })
  assert.ok(stripped.problems.some((problem) => /addition record|is in the independent lock without/.test(problem)))
  const handEdited = clone(lock)
  handEdited.capabilityIds.push('UE-OMIT-HAND-ADDED-0B12')
  assert.ok(validateGate0(matrix, { base, lock: handEdited }).problems.some((problem) => /UE-OMIT-HAND-ADDED-0B12 is in the independent lock without an anchor, checkpoint or addition record/.test(problem)))
  const forged = clone(lock)
  forged.additions.find((item) => item.tranche === 'GATE-0B.12').operationsHash = '0'.repeat(64)
  assert.ok(validateGate0(matrix, { base, lock: forged }).problems.length > 0)
  const inflated = clone(lock)
  inflated.additions.find((item) => item.tranche === 'GATE-0B.12').classifiedOperations += 5
  assert.ok(validateGate0(matrix, { base, lock: inflated }).problems.length > 0)
  const withoutOps = clone(lock)
  withoutOps.additions.find((item) => item.tranche === 'GATE-0B.12' && item.capabilityId === 'UE-OMIT-VOICE-TRANSCRIPTION').classifiedOperations = 0
  assert.ok(validateGate0(matrix, { base, lock: withoutOps }).problems.length > 0, 'a lock addition that claims no classified operation is refused')
  const unlocked = clone(lock)
  unlocked.capabilityIds = unlocked.capabilityIds.filter((id) => id !== 'UE-OMIT-VOICE-TRANSCRIPTION')
  assert.ok(validateGate0(matrix, { base, lock: unlocked }).problems.length > 0, 'a capability the lock does not hold is refused')
  const invented = clone(matrix)
  invented.capabilities.push({ ...clone(invented.capabilities.find((item) => item.id === NEW_CAPABILITY_IDS[0])), id: 'UE-OMIT-INVENTED-IN-MATRIX-ONLY' })
  assert.ok(validateGate0(invented, { base }).problems.length > 0, 'a capability added to the matrix alone is refused')
})

test('NEGATIVE 11: the inventory counts cannot be forged, and the moving totals live only in the cumulative registers', () => {
  const stale = clone(matrix)
  stale.routeInventoryTotals.OWNED += 1
  assert.ok(validateGate0(stale, { base }).problems.some((problem) => /INVENTORY-TOTALS-DRIFT: OWNED/.test(problem)))
  const absent = clone(matrix)
  delete absent.routeInventoryTotals
  assert.ok(validateGate0(absent, { base }).problems.some((problem) => /INVENTORY-TOTALS-ABSENT/.test(problem)))
  const pin = clone(matrix)
  pin.routeClassification0b12.files.classification.sha256 = '0'.repeat(64)
  assert.ok(validateGate0(pin, { base }).problems.length > 0)
})

const defectCarrying = (args, category) => newDefects(args).filter((defect) => (defect.riskCategories ?? []).includes(category))
const strip = (args, category) => {
  for (const defect of defectCarrying(args, category)) defect.riskCategories = defect.riskCategories.filter((item) => item !== category)
  for (const defect of newDefects(args)) if (defect.riskCategories?.length === 0) delete defect.riskCategories
}

test('NEGATIVE 12: each risk category raised by the source is refused without a defect or screen, and a screen cannot be hollow, invented or used on a structural trigger', () => {
  const expectations = [
    ['GET_WITH_SIDE_EFFECTS', ORGS_GET],
    ['RLS_ASSUMED_FROM_DB_CLIENT', CHECKOUT_POST],
    ['EXTERNAL_DISCLOSURE_WITHOUT_DECISION', CHECKOUT_POST],
  ]
  for (const [category, id] of expectations) {
    const args = fixture()
    strip(args, category)
    if (record(args, id).riskScreen[category]) delete record(args, id).riskScreen[category]
    assert.ok(run(args).problems.length > 0, `${category} on ${id}`)
  }
  for (const id of [HOLDERS_GET, EXPORT_GET]) {
    const args = fixture()
    delete record(args, id).riskScreen.RLS_ASSUMED_FROM_DB_CLIENT
    assert.ok(hasProblem(run(args), new RegExp(`operation ${escape(id)} raises RLS_ASSUMED_FROM_DB_CLIENT`)), id)
  }
  const sensitive = fixture()
  delete record(sensitive, EXPORT_GET).riskScreen.SENSITIVE_SOURCE_IN_DERIVED_OUTPUT
  assert.ok(hasProblem(run(sensitive), new RegExp(`operation ${escape(EXPORT_GET)} raises SENSITIVE_SOURCE_IN_DERIVED_OUTPUT`)))

  for (const category of ['GET_WITH_SIDE_EFFECTS', 'AUDIT_OUTSIDE_DATA_TRANSACTION', 'PUBLICATION_BYPASSES_CLASSIFICATION_OR_CONSENT']) {
    const structural = fixture()
    record(structural, CLAIM_POST).riskScreen = { [category]: clone(record(structural, HOLDERS_GET).riskScreen.RLS_ASSUMED_FROM_DB_CLIENT) }
    assert.ok(hasProblem(run(structural), new RegExp(`records a screen for ${category} that no source trigger raised`)), `${category} cannot be screened where the source raised nothing`)
  }

  const fakeQuote = fixture()
  record(fakeQuote, HOLDERS_GET).riskScreen.RLS_ASSUMED_FROM_DB_CLIENT.evidence = [{ ref: 'apps/union-eyes/app/api/workbook/[id]/memory-holders/route.ts', quote: 'a transaction line that is not in the route' }]
  assert.ok(hasProblem(run(fakeQuote), /screen for RLS_ASSUMED_FROM_DB_CLIENT quotes a line that is not in/))
  const unevidenced = fixture()
  record(unevidenced, HOLDERS_GET).riskScreen.RLS_ASSUMED_FROM_DB_CLIENT.evidence = []
  assert.ok(hasProblem(run(unevidenced), /screen for RLS_ASSUMED_FROM_DB_CLIENT cites no source evidence/))
  const hollow = fixture()
  record(hollow, HOLDERS_GET).riskScreen.RLS_ASSUMED_FROM_DB_CLIENT.reason = 'Fine.'
  assert.ok(hasProblem(run(hollow), /screen for RLS_ASSUMED_FROM_DB_CLIENT states no reason/))
  const invented = fixture()
  record(invented, CLAIM_POST).riskScreen = { FABRICATED_INSTITUTIONAL_FINDING: clone(record(invented, HOLDERS_GET).riskScreen.RLS_ASSUMED_FROM_DB_CLIENT) }
  assert.ok(hasProblem(run(invented), /records a screen for FABRICATED_INSTITUTIONAL_FINDING that no source trigger raised/))
  const unknown = fixture()
  record(unknown, CLAIM_POST).riskScreen = { MADE_UP_CATEGORY: clone(record(unknown, HOLDERS_GET).riskScreen.RLS_ASSUMED_FROM_DB_CLIENT) }
  assert.ok(hasProblem(run(unknown), /screens an unknown risk category MADE_UP_CATEGORY/))
  const badDefect = fixture()
  newDefects(badDefect)[0].riskCategories = ['NOT_A_CATEGORY']
  assert.ok(hasProblem(run(badDefect), /names an unknown risk category NOT_A_CATEGORY/))
  const earlierDefect = fixture()
  defectOf(earlierDefect, PRIOR_DISPOSITIONED).riskCategories = ['FABRICATED_INSTITUTIONAL_FINDING']
  assert.ok(hasProblem(run(earlierDefect), /of an earlier tranche gained riskCategories/))
  assert.deepEqual(run(fixture()).problems, [], 'the committed screens and defects satisfy every source trigger of the tranche')
})

test('NEGATIVE 13: a cross-tenant disclosure recorded as a defect must be carried by every operation that cites it, and a mutated flag or hidden defect is refused', () => {
  const clean = fixture()
  const defectsById = new Map(clean.classification.defectRegister.map((defect) => [defect.id, defect]))
  for (const item of clean.classification.operations) assert.deepEqual(crossTenantFlagProblems(item, defectsById), [], item.id)
  const dropped = fixture()
  const item = record(dropped, ORGS_GET)
  item.crossTenantExposure = false
  delete item.exposureContract
  assert.ok(run(dropped).problems.length > 0, 'the organizations read cannot drop its cross-tenant flag while citing the disclosure defect')
  const hidden = fixture()
  const exposed = record(hidden, ORGS_GET)
  exposed.defects = exposed.defects.filter((defect) => !defectOf(hidden, defect).releaseDisposition?.potentialImpact.classes.includes('CROSS_TENANT_DISCLOSURE'))
  assert.ok(run(hidden).problems.length > 0, 'an exposed record that no longer cites its cross-tenant defect is refused')
  const downgrade = fixture()
  const cross = highNew(downgrade).find((defect) => defect.releaseDisposition.potentialImpact.classes.includes('CROSS_TENANT_DISCLOSURE') && defect.releaseDisposition.disposition === 'RELEASE_BLOCKING')
  cross.releaseDisposition.disposition = 'NON_BLOCKING_WITH_JUSTIFICATION'
  cross.releaseBlocking = false
  assert.ok(run(downgrade).problems.length > 0, 'a cross-tenant defect cannot be downgraded to non blocking')
})
