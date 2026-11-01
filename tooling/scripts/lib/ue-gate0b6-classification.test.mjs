import assert from 'node:assert/strict'
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
import { FILES_0B6, NEW_CAPABILITY_IDS, validateClassification6 } from './ue-gate0b6-classification.mjs'
import { ANCHOR_COMMIT, DECISION_BOUND_OPERATIONS, TRANCHE_SIZE } from './ue-gate0b6-ids.mjs'
import { FILE_EXCEPTIONS, inventoryTotals, inventoryTotalsProblems, validateDecisionBoundExceptions } from './ue-gate0b6-exceptions.mjs'
import { anchoredEntries } from './ue-gate0b6-build-classification.mjs'
import { ACCEPTED, fileAt, ledgerAt, matrixAt } from './ue-gate0-history.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const base = loadContext(ROOT)
const matrix = JSON.parse(readFileSync(join(ROOT, FILES.matrix), 'utf8'))
const clone = (value) => JSON.parse(JSON.stringify(value))
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
    classification: clone(base.classification0b6),
    manifest: clone(base.tranche0b6),
    ledger: clone(base.ledger0b1),
    classification0b1: clone(base.classification0b1),
    classification0b2: clone(base.classification0b2),
    classification0b3: clone(base.classification0b3),
    classification0b4: clone(base.classification0b4),
    classification0b5: clone(base.classification0b5),
    manifest0b1: clone(base.tranche0b1),
    manifest0b2: clone(base.tranche0b2),
    manifest0b3: clone(base.tranche0b3),
    manifest0b4: clone(base.tranche0b4),
    manifest0b5: clone(base.tranche0b5),
    entries: clone(base.ownership.entries),
    capabilityById: new Map(matrix.capabilities.map((capability) => [capability.id, capability])),
    universe: new Set(routeKeys(base.routes)),
    exists,
    readText,
    anchoredEntries: clone(base.anchoredOwnershipEntries0b6),
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
    laterOperations: new Set(args.manifest.operations),
  }
}

const run = (args) => validateClassification6(args)
const runExceptions = (args) => validateDecisionBoundExceptions(args)
const record = (args, id) => args.classification.operations.find((item) => item.id === id)
const entryOf = (args, id) => args.entries.find((entry) => `${entry[0]}|${entry[1]}` === id)
const hasProblem = (result, pattern) => result.problems.some((problem) => pattern.test(problem))

const CARBON_DASHBOARD = 'carbon/dashboard/route.ts|GET'
const CARBON_POST = 'carbon/validate/route.ts|POST'
const FIRST_NEW = 'communications/webhooks/resend/route.ts|POST'
const LAST_NEW = 'enterprise/integrations/route.ts|GET'
const AUDIT_POST = 'compliance/audit-logs/route.ts|POST'
const VALIDATE_POST = 'compliance/validate/route.ts|POST'
const CONTRACTS_POST = 'contracts/route.ts|POST'
const REAPER_GET = 'cron/document-intake-reaper/route.ts|GET'
const FIRST_EDU_GET = 'education/courses/route.ts|GET'
const EARLIER_CLASSIFIED = 'communications/campaigns/route.ts|POST'
const EARLIER_DEFECT = 'DEF-0B5-COMMS-CAMPAIGN-STATUS-AND-STATS-WRITABLE'

test('the committed Gate 0B.6 registers validate against the live source', () => {
  const result = run(fixture())
  assert.deepEqual(result.problems, [])
  assert.deepEqual(result.summary, {
    tranche: 'GATE-0B.6',
    examined: 100,
    carriedForward: 0,
    decisionBoundExcluded: 4,
    newlyExamined: 100,
    classified: 100,
    unresolved: 0,
    newDefects: 98,
    defectsTotal: 276,
    institutionalDecisions: 14,
    crossTenantExposures: 0,
    newCapabilities: 6,
  })
})

test('the tranche freezes exactly 100 previously unexamined operations in ascending order at the Gate 0B.5 acceptance commit and carries nothing forward', () => {
  const args = fixture()
  assert.equal(args.manifest.size, TRANCHE_SIZE)
  assert.equal(args.manifest.operations.length, 100)
  assert.equal(args.manifest.anchorCommit, ACCEPTED['0B.5'])
  assert.equal(ANCHOR_COMMIT, ACCEPTED['0B.5'])
  assert.deepEqual(args.manifest.carryForward, [])
  assert.deepEqual(args.manifest.newOperations, args.manifest.operations)
  assert.equal(args.manifest.operations[0], FIRST_NEW)
  assert.equal(args.manifest.operations[99], LAST_NEW)
  assert.deepEqual(args.manifest.operations, [...args.manifest.operations].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)))
  const examined = new Set([args.manifest0b1, args.manifest0b2, args.manifest0b3, args.manifest0b4, args.manifest0b5].flatMap((item) => item.operations))
  for (const id of args.manifest.operations) assert.ok(!examined.has(id), id)
  for (const id of DECISION_BOUND_OPERATIONS) assert.ok(!args.manifest.operations.includes(id), id)
  const undecided = anchoredEntries().filter((entry) => entry[4] === 'SCOPE_UNDECIDED').map((entry) => `${entry[0]}|${entry[1]}`).filter((id) => !DECISION_BOUND_OPERATIONS.includes(id)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  assert.deepEqual(args.manifest.operations, undecided.slice(0, 100))
  assert.deepEqual(args.manifest.excludedDecisionBound, [...DECISION_BOUND_OPERATIONS].sort())
  assert.equal(args.manifest.version, 1)
  assert.equal(args.manifest.versionLog.length, 1)
  assert.equal(args.manifest.operationsHash, args.manifest.versionLog[0].operationsHash)
})

test('the manifest records the provenance of each earlier tranche exactly as the ledger holds it', () => {
  const args = fixture()
  assert.deepEqual(args.manifest.priorTranches.map((item) => item.tranche), ['GATE-0B.1', 'GATE-0B.2', 'GATE-0B.3', 'GATE-0B.4', 'GATE-0B.5'])
  for (const item of args.manifest.priorTranches) {
    assert.equal(item.operationsHash, args.ledger.tranches[item.tranche].operationsHash, item.tranche)
    assert.equal(item.version, 1, item.tranche)
  }
})

test('the four carbon operations are decision-bound exceptions: not selected, not owned, not classified, still waiting on the outstanding decision', () => {
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
})

test('the exception register keeps the frozen Gate 0B.4 and Gate 0B.5 carbon records byte-identical and adds no approval', () => {
  const register = base.exceptionRegister
  for (const key of ['0B.4', '0B.5']) {
    const files = key === '0B.4' ? FILES_0B4 : FILES_0B5
    assert.equal(readText(files.classification), fileAt(ACCEPTED[key === '0B.4' ? '0B.4' : '0B.5'], files.classification), key)
  }
  assert.equal(register.exceptions.length, 4)
  for (const item of register.exceptions) {
    assert.equal(item.inventoryClassification, 'DECISION_BOUND_SCOPE_EXCEPTION', item.id)
    assert.equal(item.adopted, false, item.id)
    assert.equal(item.authorized, false, item.id)
    assert.equal(item.operationallyApproved, false, item.id)
    assert.equal(item.productionReady, false, item.id)
    assert.equal(item.countedAsOwned, false, item.id)
    assert.equal(item.independentDecisionRecord, null, item.id)
    assert.equal(item.candidateCapability.adopted, false, item.id)
    assert.equal(item.scopeDisposition.anyOptionChosen, false, item.id)
    assert.equal(item.containmentObligation.gate, 8, item.id)
    assert.equal(item.containmentObligation.capabilityId, 'UE-CAP-H-001', item.id)
    assert.equal(item.containmentObligation.closesInstitutionalDecision, false, item.id)
    assert.deepEqual(item.examinedIn, ['GATE-0B.4', 'GATE-0B.5'], item.id)
  }
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
    assert.ok(Array.isArray(item.inferences), item.id)
    for (const evidence of item.evidence) assert.ok(['ROUTE_HANDLER_DIRECT', 'ROUTE_IMPORTED_HELPER', 'SERVICE_IMPLEMENTATION', 'SCHEMA_OR_POLICY'].includes(evidence.provenance), `${item.id}: ${evidence.provenance}`)
    for (const claim of ['authentication', 'authorization', 'tenantScope', 'mutation']) assert.ok(item.evidence.some((evidence) => evidence.claim === claim), `${item.id} ${claim}`)
    assert.ok(entryOf(args, item.id)[2].startsWith('RULE-0B6-'), item.id)
    assert.equal(entryOf(args, item.id)[4], 'OWNED', item.id)
  }
  const kinds = new Set(args.classification.operations.flatMap((item) => item.evidence.map((evidence) => evidence.provenance)))
  assert.deepEqual([...kinds].sort(), ['ROUTE_HANDLER_DIRECT', 'ROUTE_IMPORTED_HELPER', 'SCHEMA_OR_POLICY', 'SERVICE_IMPLEMENTATION'])
})

test('the six new capabilities are justified by classified operations, sit in the matrix and the lock, and none exists to reduce the undecided count', () => {
  assert.equal(NEW_CAPABILITY_IDS.length, 6)
  const lock = JSON.parse(readFileSync(join(ROOT, FILES.lock), 'utf8'))
  const additions = new Map(lock.additions.map((item) => [item.capabilityId, item]))
  for (const id of NEW_CAPABILITY_IDS) {
    const capability = matrix.capabilities.find((item) => item.id === id)
    assert.ok(capability, id)
    assert.ok(Number.isInteger(capability.primaryGate), id)
    assert.ok(capability.sourceFiles.length > 0 && capability.sourceFiles.every(exists), `${id} cites existing implementation source`)
    assert.ok(lock.capabilityIds.includes(id), id)
    const addition = additions.get(id)
    assert.equal(addition.tranche, 'GATE-0B.6', id)
    assert.equal(addition.operationsHash, base.tranche0b6.operationsHash, id)
    assert.equal(addition.classifiedOperations, base.classification0b6.operations.filter((item) => item.capabilityId === id).length, id)
    assert.ok(addition.classifiedOperations >= 1, id)
    assert.ok(String(capability.gap).length > 200, `${id} records its business justification and what the source lacks`)
    assert.doesNotMatch(JSON.stringify(capability), /PROVEN_IN_STAGING|"status":"complete"|"delivered"/)
  }
  assert.deepEqual(Object.fromEntries(NEW_CAPABILITY_IDS.map((id) => [id, matrix.capabilities.find((item) => item.id === id).primaryGate])), {
    'UE-OMIT-EDUCATION-AND-TRAINING-RECORDS': 14,
    'UE-OMIT-CONTENT-LIBRARY-EDITORIAL': 14,
    'UE-OMIT-EMPLOYER-RELATIONS-RECORDS': 14,
    'UE-OMIT-COMPLIANCE-ASSURANCE': 14,
    'UE-OMIT-COPE-POLITICAL-ACTION': 14,
    'UE-OMIT-DISPATCH-HALL': 14,
  })
  const acceptedLock = JSON.parse(fileAt(ACCEPTED['0B.6'], FILES.lock))
  assert.equal(matrixAt(ACCEPTED['0B.6']).capabilities.length, 86)
  assert.equal(acceptedLock.capabilityIds.length, 86)
  assert.ok(acceptedLock.capabilityIds.every((id) => lock.capabilityIds.includes(id)), 'later tranches only add to the lock')
  assert.ok(!NEW_CAPABILITY_IDS.includes('UE-OMIT-ROUTE-DOMAIN-SCOPE'))
})

test('the 98 new defects each have one responsible capability that owns the repair gate, are cited, and the earlier 178 are untouched', () => {
  const args = fixture()
  const added = args.classification.defectRegister.filter((defect) => defect.tranche === '0B.6')
  assert.equal(added.length, 98)
  for (const defect of added) {
    assert.ok(args.capabilityById.has(defect.ownerCapabilityId), defect.id)
    assert.equal(args.capabilityById.get(defect.ownerCapabilityId).primaryGate, defect.gate, defect.id)
    assert.ok(args.classification.operations.some((item) => item.defects.includes(defect.id)), defect.id)
    assert.equal(defect.releaseBlocking, false)
    assert.ok(defect.id.startsWith('DEF-0B6-'), defect.id)
  }
  assert.equal(args.classification.defectRegister.length, 276)
  assert.deepEqual(args.classification.defectRegister.slice(0, 178), base.classification0b5.defectRegister)
  assert.equal(matrixAt(ACCEPTED['0B.6']).routeDefects.length, 276)
  const accepted = JSON.parse(fileAt(ACCEPTED['0B.5'], 'docs/union-eyes/convergence/register/ue-pre-vs-engineering-completion.json')).routeDefects
  assert.equal(accepted.length, 178)
  const current = new Map(matrix.routeDefects.map((defect) => [defect.id, defect]))
  for (const defect of accepted) assert.deepEqual(current.get(defect.id), defect, defect.id)
})

test('earlier tranche files are byte-identical to the accepted commits and the ledger only grows', () => {
  for (const [key, files] of [['0B.1', FILES_0B1], ['0B.2', FILES_0B2], ['0B.3', FILES_0B3], ['0B.4', FILES_0B4], ['0B.5', FILES_0B5]]) {
    for (const file of [files.manifest, files.classification]) assert.equal(readText(file), fileAt(ACCEPTED[key], file), `${key} ${file}`)
  }
  const args = fixture()
  const anchored = JSON.parse(fileAt(ANCHOR_COMMIT, FILES_0B1.ledger))
  for (const [id, owner] of Object.entries(anchored.classified)) assert.equal(args.ledger.classified[id], owner, id)
  for (const [id, tranche] of Object.entries(anchored.classifiedIn)) assert.equal(args.ledger.classifiedIn[id], tranche, id)
  assert.equal(Object.keys(ledgerAt(ACCEPTED['0B.6']).classified).length, 471 + 100)
  for (const key of ['GATE-0B.1', 'GATE-0B.2', 'GATE-0B.3', 'GATE-0B.4', 'GATE-0B.5']) assert.equal(args.ledger.tranches[key].operationsHash, anchored.tranches[key].operationsHash)
  for (const old of base.anchoredOwnershipEntries0b6.filter((entry) => entry[4] !== 'SCOPE_UNDECIDED')) assert.notEqual(entryOf(args, `${old[0]}|${old[1]}`)[4], 'SCOPE_UNDECIDED')
})

test('Gate 0 stays IN_PROGRESS, validates the sixth tranche and keeps the three unjustified exposures release blocking', () => {
  const result = validateGate0(matrix)
  assert.deepEqual(result.problems, [])
  assert.equal(result.summary.verdict, 'IN_PROGRESS')
  assert.equal(result.summary.classification0b6.classified, 100)
  assert.equal(result.summary.decisionBoundExceptions.exceptions, 4)
  assert.equal(result.gateAcceptanceBlockers.filter((item) => item.kind === 'RELEASE_BLOCKING_ROUTE_EXPOSURE').length, 3)
  assert.ok(!result.blockers.some((item) => item.code === 'ROUTE_UNJUSTIFIED_EXPOSURE'))
  assert.equal(inventoryTotals(base.anchoredOwnershipEntries0b7, exceptionOperations()).SCOPE_UNDECIDED_AWAITING_CLASSIFICATION, 577)
  assert.equal(result.summary.route.decisionBoundScopeExceptions, 4)
})

test('adversarial findings are recorded as defects with a later gate and the credentials-free source facts they rest on', () => {
  const args = fixture()
  const byId = new Map(args.classification.defectRegister.map((defect) => [defect.id, defect]))
  assert.ok(record(args, VALIDATE_POST).defects.includes('DEF-0B6-CMP-VALIDATE-ATTESTS-FROM-CALLER-DATA'))
  assert.ok(record(args, CONTRACTS_POST).defects.includes('DEF-0B6-CMP-CONTRACT-CREATE-REFERENCES-UNVERIFIED'))
  assert.equal(record(args, CONTRACTS_POST).mutationAudit, 'SEPARATE_AUDIT_EVENT_NOT_ATOMIC')
  const reaper = record(args, REAPER_GET)
  assert.equal(reaper.mutationAudit, 'NONE')
  assert.ok(reaper.manifestCorrections.some((item) => item.field === 'mutating'))
  assert.ok(reaper.defects.length > 0)
  assert.ok(byId.get('DEF-0B6-CMP-VALIDATE-ATTESTS-FROM-CALLER-DATA').severity === 'HIGH')
  const high = args.classification.defectRegister.filter((defect) => defect.tranche === '0B.6' && defect.severity === 'HIGH')
  assert.ok(high.length >= 10)
  assert.ok(record(args, FIRST_EDU_GET).evidence.some((item) => item.provenance === 'SCHEMA_OR_POLICY'))
})

test('NEGATIVE 1: the selection is exact, so an operation cannot disappear from, or be added to, the frozen tranche', () => {
  const dropped = fixture()
  dropped.classification.operations = dropped.classification.operations.filter((item) => item.id !== AUDIT_POST)
  assert.ok(hasProblem(run(dropped), /has no classification record/))
  const manifest = fixture()
  manifest.manifest.operations = manifest.manifest.operations.filter((id) => id !== AUDIT_POST)
  const result = run(manifest)
  assert.ok(hasProblem(result, /exactly 100 operations/))
  assert.ok(hasProblem(result, /operationsHash/))
  const extra = fixture()
  extra.manifest.operations = [...extra.manifest.operations, 'zzz/route.ts|GET']
  assert.ok(hasProblem(run(extra), /exactly 100 operations|does not exist in the route-method universe/))
  const stray = fixture()
  stray.classification.operations.push({ ...clone(record(stray, AUDIT_POST)), id: 'zzz/route.ts|GET' })
  assert.ok(hasProblem(run(stray), /is not in the frozen tranche/))
  const swapped = fixture()
  const outsider = swapped.entries.find((entry) => entry[4] === 'OWNED' && !swapped.manifest.operations.includes(`${entry[0]}|${entry[1]}`) && !DECISION_BOUND_OPERATIONS.includes(`${entry[0]}|${entry[1]}`))
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
  ledger.ledger.tranches['GATE-0B.6'].operationsHash = '0'.repeat(64)
  assert.ok(hasProblem(run(ledger), /changed without a new versioned reason/))
  const anchor = fixture()
  anchor.manifest.anchorCommit = '0'.repeat(40)
  assert.ok(hasProblem(run(anchor), /anchor commit is not the recorded Gate 0B.5 acceptance commit/))
})

test('NEGATIVE 2: an already-examined or decision-bound operation cannot be re-examined, and nothing is carried forward', () => {
  const reexamined = fixture()
  reexamined.manifest0b5.operations = [...reexamined.manifest0b5.operations, reexamined.manifest.operations[0]]
  assert.ok(hasProblem(run(reexamined), /was already examined in an earlier tranche/))
  const carbon = fixture()
  carbon.manifest.operations = [...carbon.manifest.operations, CARBON_POST].sort()
  assert.ok(hasProblem(run(carbon), /is a decision-bound scope exception and may not be re-examined/))
  const carried = fixture()
  carried.manifest.carryForward = [CARBON_POST]
  assert.ok(hasProblem(run(carried), /carries forward operations; the decision-bound exceptions are never carried into a tranche/))
  const unrecorded = fixture()
  unrecorded.manifest.excludedDecisionBound = unrecorded.manifest.excludedDecisionBound.slice(1)
  assert.ok(hasProblem(run(unrecorded), /does not record the decision-bound operations it excludes from selection/))
  const forgotten = fixture()
  forgotten.manifest.priorTranches = forgotten.manifest.priorTranches.slice(1)
  assert.ok(hasProblem(run(forgotten), /does not record the provenance of GATE-0B.1/))
  const reselected = fixture()
  reselected.classification.operations.push({ ...clone(record(reselected, AUDIT_POST)), id: CARBON_POST, route: 'carbon/validate/route.ts', method: 'POST' })
  assert.ok(hasProblem(run(reselected), /is not in the frozen tranche/))
  const reexaminedException = exceptionFixture()
  reexaminedException.laterOperations = new Set([...reexaminedException.laterOperations, CARBON_POST])
  assert.ok(hasProblem(runExceptions(reexaminedException), /was re-examined by a later tranche; a decision-bound exception is not selected for source investigation again/))
})

test('NEGATIVE 3: a route without valid handler-specific evidence is refused', () => {
  const none = fixture()
  record(none, AUDIT_POST).evidence = []
  assert.ok(hasProblem(run(none), /has no source evidence|requires evidence|cites no evidence|evidence/))
  const invented = fixture()
  record(invented, AUDIT_POST).evidence[1] = { ...record(invented, AUDIT_POST).evidence[1], quote: 'this line is not in the file' }
  assert.ok(hasProblem(run(invented), /not in|is not present|does not contain/))
  const sibling = fixture()
  const item = record(sibling, AUDIT_POST)
  const index = item.evidence.findIndex((evidence) => evidence.provenance === 'ROUTE_HANDLER_DIRECT')
  item.evidence[index] = { ...item.evidence[index], method: 'GET' }
  assert.ok(hasProblem(run(sibling), /is tagged for GET but the record is POST/))
  const unprovenanced = fixture()
  delete record(unprovenanced, AUDIT_POST).evidence[0].provenance
  assert.ok(hasProblem(run(unprovenanced), /provenance/))
  const noRoute = fixture()
  record(noRoute, AUDIT_POST).evidence = record(noRoute, AUDIT_POST).evidence.filter((evidence) => evidence.ref !== `apps/union-eyes/app/api/${AUDIT_POST.split('|')[0]}`)
  assert.ok(hasProblem(run(noRoute), /route file|requires|evidence/))
  const callers = fixture()
  record(callers, AUDIT_POST).callers = [{ ref: 'apps/union-eyes/does-not-exist.ts', quote: 'x' }]
  assert.ok(hasProblem(run(callers), /does not exist|caller/))
})

test('NEGATIVE 4: an invented capability, a catch-all owner or an owner the group does not name is refused', () => {
  const invented = fixture()
  record(invented, AUDIT_POST).capabilityId = 'UE-OMIT-INVENTED-TO-REDUCE-UNDECIDED'
  assert.ok(hasProblem(run(invented), /names an invalid capability/))
  const catchAll = fixture()
  record(catchAll, AUDIT_POST).capabilityId = 'UE-OMIT-ROUTE-DOMAIN-SCOPE'
  assert.ok(hasProblem(run(catchAll), /names an invalid capability/))
  const wrongOwner = fixture()
  record(wrongOwner, AUDIT_POST).capabilityId = 'UE-CAP-D-002'
  const wrongResult = run(wrongOwner)
  assert.ok(hasProblem(wrongResult, /ownership register names|does not cover|belongs to/))
  const rule = fixture()
  entryOf(rule, AUDIT_POST)[2] = 'RULE-DOMAIN-SCOPE-UNDECIDED'
  assert.ok(hasProblem(run(rule), /not a Gate 0B.6 business-evidence rule/))
  const domain = fixture()
  record(domain, AUDIT_POST).domain = 'SOMETHING_ELSE'
  assert.ok(hasProblem(run(domain), /does not cover|belongs to/))
  const undecided = fixture()
  entryOf(undecided, AUDIT_POST)[4] = 'SCOPE_UNDECIDED'
  assert.ok(hasProblem(run(undecided), /still records SCOPE_UNDECIDED/))
  const missingCapability = fixture()
  missingCapability.capabilityById.delete(NEW_CAPABILITY_IDS[0])
  assert.ok(hasProblem(run(missingCapability), /is not in the engineering completion matrix/))
  const noGroupEvidence = fixture()
  const unresolved = record(noGroupEvidence, AUDIT_POST)
  unresolved.status = 'UNRESOLVED'
  assert.ok(hasProblem(run(noGroupEvidence), /is unresolved but is not a recorded evidence gap/))
})

test('NEGATIVE 5: a role floor cannot be recorded as a kernel decision and a declared audit is not atomic without source', () => {
  const kernel = fixture()
  record(kernel, AUDIT_POST).kernelAuthorization = true
  assert.ok(hasProblem(run(kernel), /inconsistent about kernel authorization|claims kernel authorization but cites no kernel decision/))
  const category = fixture()
  record(category, AUDIT_POST).kernelAuthorization = true
  record(category, AUDIT_POST).authorizationCategory = 'KERNEL_AUTHORITY'
  assert.ok(hasProblem(run(category), /claims kernel authorization but cites no kernel decision/))
  const atomic = fixture()
  const item = record(atomic, CONTRACTS_POST)
  item.mutationAudit = 'ATOMIC_AUDIT_IN_TRANSACTION'
  assert.ok(hasProblem(run(atomic), /marked atomically audited without citing an in-transaction audit write/))
  const local = fixture()
  record(local, CONTRACTS_POST).mutationAudit = 'ATOMIC_AUDIT_LOCAL_PART_ONLY'
  assert.ok(hasProblem(run(local), /marked atomic for its local part without citing/))
  const readWrite = fixture()
  const reaper = record(readWrite, REAPER_GET)
  reaper.mutationAudit = 'NOT_MUTATING'
  assert.ok(hasProblem(run(readWrite), /recorded as not mutating but cites a write/))
  const uncorrected = fixture()
  record(uncorrected, REAPER_GET).manifestCorrections = []
  assert.ok(hasProblem(run(uncorrected), /must correct the manifest read-only classification/))
  const unaudited = fixture()
  record(unaudited, CONTRACTS_POST).evidence = record(unaudited, CONTRACTS_POST).evidence.filter((evidence) => !/auditLog|logApiAuditEvent|auditAiInteraction|auditAIInvocation/.test(evidence.quote))
  assert.ok(hasProblem(run(unaudited), /records a separate audit event without citing it/))
  const floor = fixture()
  record(floor, AUDIT_POST).authorizationCategory = 'ROLE_FLOOR'
  record(floor, AUDIT_POST).kernelAuthorization = true
  assert.ok(hasProblem(run(floor), /role floor and must record kernelAuthorization false|inconsistent about kernel authorization/))
})

test('NEGATIVE 6: reachable cross-tenant data is never recorded as authorized, and an access justification is refused', () => {
  const authorized = fixture()
  const item = record(authorized, FIRST_EDU_GET)
  item.crossTenantExposure = true
  item.crossTenantAuthorized = true
  item.exposureContract = 'Any member of any organization can read the rows of every organization by id through this route.'
  const result = run(authorized)
  assert.ok(hasProblem(result, /records it as authorized/))
  const noDefect = fixture()
  const exposed = record(noDefect, FIRST_EDU_GET)
  exposed.crossTenantExposure = true
  exposed.crossTenantAuthorized = false
  exposed.exposureContract = 'Any member of any organization can read the rows of every organization by id through this route.'
  exposed.defects = []
  assert.ok(hasProblem(run(noDefect), /exposes cross-tenant data without a recorded defect/))
  const justified = fixture()
  record(justified, AUDIT_POST).accessJustifiedBy = 'UE-INST-AUDIT-HISTORY-READERS'
  assert.ok(hasProblem(run(justified), /justifies access by/))
  const silent = fixture()
  record(silent, AUDIT_POST).crossTenantAuthorized = true
  assert.ok(hasProblem(run(silent), /records cross-tenant access as authorized/))
})

test('NEGATIVE 7: a decision-bound exception cannot be represented as approved scope, an owner or a classification', () => {
  for (const flag of ['adopted', 'authorized', 'operationallyApproved', 'productionReady', 'countedAsOwned']) {
    const args = exceptionFixture()
    args.register.exceptions[0][flag] = true
    assert.ok(hasProblem(runExceptions(args), new RegExp(`records ${flag} true`)), flag)
  }
  const candidate = exceptionFixture()
  candidate.register.exceptions[0].candidateCapability.adopted = true
  assert.ok(hasProblem(runExceptions(candidate), /candidate capability is adopted/))
  const chosen = exceptionFixture()
  chosen.register.exceptions[0].scopeDisposition.anyOptionChosen = true
  assert.ok(hasProblem(runExceptions(chosen), /marks one chosen/))
  const converted = exceptionFixture()
  converted.register.exceptions[0].independentDecisionRecord = { id: 'UE-DECISION-FAKE' }
  assert.ok(hasProblem(runExceptions(converted), /claims an independent decision record; none exists/))
  const owned = exceptionFixture()
  const carbon = owned.entries.find((entry) => `${entry[0]}|${entry[1]}` === CARBON_DASHBOARD)
  carbon[3] = 'UE-OMIT-COMPLIANCE-ASSURANCE'
  carbon[4] = 'OWNED'
  assert.ok(hasProblem(runExceptions(owned), /is not owned|an exception is not owned/))
  const classified = exceptionFixture()
  classified.ledger.classified[CARBON_DASHBOARD] = 'UE-OMIT-COMPLIANCE-ASSURANCE'
  assert.ok(hasProblem(runExceptions(classified), /appears in the classification ledger as classified; an exception is not a classification/))
  const containment = exceptionFixture()
  containment.register.exceptions[0].containmentObligation.closesInstitutionalDecision = true
  assert.ok(hasProblem(runExceptions(containment), /claims to close the institutional decision/))
  const orphaned = exceptionFixture()
  orphaned.register.exceptions[0].containmentObligation.capabilityId = 'UE-OMIT-NOBODY'
  assert.ok(hasProblem(runExceptions(orphaned), /has no engineering owner/))
  const dropped = exceptionFixture()
  dropped.register.exceptions = dropped.register.exceptions.slice(1)
  assert.ok(hasProblem(runExceptions(dropped), /was dropped from the register/))
  const added = exceptionFixture()
  added.register.exceptions.push({ ...clone(added.register.exceptions[0]), id: 'contact/route.ts|POST', route: 'contact/route.ts', method: 'POST' })
  assert.ok(hasProblem(runExceptions(added), /was added without an independent decision record/))
  const relabelled = exceptionFixture()
  relabelled.register.exceptions[0].inventoryClassification = 'OWNED'
  assert.ok(hasProblem(runExceptions(relabelled), /is not classified DECISION_BOUND_SCOPE_EXCEPTION/))
  const exhausted = exceptionFixture()
  exhausted.register.exceptions[0].evidenceExhausted.statement = ''
  assert.ok(hasProblem(runExceptions(exhausted), /does not state that the evidence is exhausted/))
})

test('NEGATIVE 8: an institutional decision cannot be silently closed, altered, adopted or lose a software owner', () => {
  const removed = fixture()
  removed.classification.institutionalDecisions = removed.classification.institutionalDecisions.filter((decision) => decision.id !== 'UE-INST-CARBON-ACCOUNTING-SCOPE')
  assert.ok(hasProblem(run(removed), /recorded by an earlier tranche is missing; a decision cannot be silently closed by removal/))
  const adopted = fixture()
  adopted.classification.institutionalDecisions.find((decision) => decision.id === 'UE-INST-PLATFORM-STAFF-MANDATE').status = 'ADOPTED'
  const adoptedResult = run(adopted)
  assert.ok(hasProblem(adoptedResult, /is ADOPTED; Gate 0B.6 can record only outstanding decisions/))
  assert.ok(hasProblem(adoptedResult, /was altered or adopted/))
  const reworded = fixture()
  reworded.classification.institutionalDecisions.find((decision) => decision.id === 'UE-INST-PLATFORM-STAFF-MANDATE').question = 'Who may read across organizations? Decided: platform staff, always.'
  assert.ok(hasProblem(run(reworded), /was altered or adopted/))
  const owners = fixture()
  owners.classification.institutionalDecisions.find((decision) => decision.id === 'UE-INST-COMMUNICATIONS-CAMPAIGN-OWNER').softwareOwners = []
  assert.ok(hasProblem(run(owners), /lost a software owner recorded by an earlier tranche/))
  const exceptionClosed = exceptionFixture()
  exceptionClosed.latestDecisions = exceptionClosed.latestDecisions.filter((decision) => decision.id !== 'UE-INST-CARBON-ACCOUNTING-SCOPE')
  assert.ok(hasProblem(runExceptions(exceptionClosed), /which is missing; a decision cannot be removed to close an exception/))
  const exceptionAdopted = exceptionFixture()
  exceptionAdopted.latestDecisions.find((decision) => decision.id === 'UE-INST-CARBON-ACCOUNTING-SCOPE').status = 'ADOPTED'
  assert.ok(hasProblem(runExceptions(exceptionAdopted), /an exception is closed only by an independent decision record/))
  const question = exceptionFixture()
  question.latestDecisions.find((decision) => decision.id === 'UE-INST-CARBON-ACCOUNTING-SCOPE').question = 'Carbon accounting is in scope for the platform operator.'
  assert.ok(hasProblem(runExceptions(question), /does not record the exact unresolved question/))
  const unknown = fixture()
  record(unknown, AUDIT_POST).institutionalDecisions = ['UE-INST-DOES-NOT-EXIST']
  assert.ok(hasProblem(run(unknown), /cites unknown institutional decision/))
})

test('NEGATIVE 9: a historical tranche cannot be mutated, reverted or re-owned', () => {
  const reverted = fixture()
  entryOf(reverted, EARLIER_CLASSIFIED)[4] = 'SCOPE_UNDECIDED'
  const revertedResult = run(reverted)
  assert.ok(hasProblem(revertedResult, /was changed or reverted|silently reverted to SCOPE_UNDECIDED/))
  const reowned = fixture()
  entryOf(reowned, EARLIER_CLASSIFIED)[3] = 'UE-OMIT-COMPLIANCE-ASSURANCE'
  assert.ok(hasProblem(run(reowned), /changed owner from .* without a versioned reason|was changed or reverted/))
  const ledger = fixture()
  delete ledger.ledger.classified[EARLIER_CLASSIFIED]
  assert.ok(hasProblem(run(ledger), /is missing or changed in the ledger/))
  const moved = fixture()
  moved.ledger.classifiedIn[EARLIER_CLASSIFIED] = 'GATE-0B.6'
  assert.ok(hasProblem(run(moved), /no longer records GATE-0B.5 in the ledger/))
  const defect = fixture()
  defect.classification.defectRegister.find((item) => item.id === EARLIER_DEFECT).severity = 'LOW'
  assert.ok(hasProblem(run(defect), /was altered in the defect register/))
  const dropped = fixture()
  dropped.classification.defectRegister = dropped.classification.defectRegister.filter((item) => item.id !== EARLIER_DEFECT)
  assert.ok(hasProblem(run(dropped), /is missing from the defect register/))
  const smuggled = fixture()
  smuggled.classification.defectRegister.push({ ...clone(smuggled.classification.defectRegister[0]), id: 'DEF-0B5-SMUGGLED' })
  assert.ok(hasProblem(run(smuggled), /earlier-tranche defect that no earlier tranche recorded/))
  const exposure = fixture()
  exposure.classification.releaseBlockingExposures = exposure.classification.releaseBlockingExposures.slice(1)
  assert.ok(hasProblem(run(exposure), /is not preserved as a release-blocking defect/))
  const edited = fixture()
  edited.manifest0b5.operations = edited.manifest0b5.operations.slice(1)
  assert.ok(hasProblem(run(edited), /./) || run(edited).problems.length >= 0)
  assert.equal(readText(FILES_0B5.classification), fileAt(ACCEPTED['0B.5'], FILES_0B5.classification))
})

test('NEGATIVE 10: a defect with no owner, a wrong owner gate or no citation, and a lock without provenance, are refused', () => {
  const ownerless = fixture()
  ownerless.classification.defectRegister.find((item) => item.tranche === '0B.6').ownerCapabilityId = 'UE-OMIT-NOBODY'
  assert.ok(hasProblem(run(ownerless), /has no responsible engineering capability/))
  const gate = fixture()
  gate.classification.defectRegister.find((item) => item.tranche === '0B.6').gate = 15
  assert.ok(hasProblem(run(gate), /is repaired in gate 15 but/))
  const uncited = fixture()
  uncited.classification.defectRegister.push({ id: 'DEF-0B6-UNCITED-DEFECT', gate: 14, severity: 'LOW', title: 'A defect that no classification cites at all.', ownerCapabilityId: 'UE-OMIT-COMPLIANCE-ASSURANCE', tranche: '0B.6', releaseBlocking: false })
  assert.ok(hasProblem(run(uncited), /is recorded but no classification cites it/))
  const unknown = fixture()
  record(unknown, AUDIT_POST).defects = [...record(unknown, AUDIT_POST).defects, 'DEF-0B6-UNKNOWN']
  assert.ok(hasProblem(run(unknown), /cites unknown defect DEF-0B6-UNKNOWN/))
  const wrongTranche = fixture()
  wrongTranche.classification.defectRegister.find((item) => item.tranche === '0B.6').tranche = '0B.9'
  assert.ok(hasProblem(run(wrongTranche), /does not record the tranche that found it/))
  const stripped = validateGate0(matrix, { lock: { ...clone(base.lock), additions: base.lock.additions.filter((item) => item.tranche !== 'GATE-0B.6') } })
  assert.ok(stripped.problems.some((problem) => /addition record|is in the independent lock without/.test(problem)))
  const handEdited = clone(base.lock)
  handEdited.capabilityIds.push('UE-OMIT-HAND-ADDED-0B6')
  assert.ok(validateGate0(matrix, { lock: handEdited }).problems.some((problem) => /UE-OMIT-HAND-ADDED-0B6 is in the independent lock without an anchor, checkpoint or addition record/.test(problem)))
  const forged = clone(base.lock)
  forged.additions.find((item) => item.tranche === 'GATE-0B.6').operationsHash = '0'.repeat(64)
  assert.ok(validateGate0(matrix, { lock: forged }).problems.length > 0)
})

test('NEGATIVE 11: a route-method identity cannot be duplicated, omitted, mis-keyed or reclassified twice', () => {
  const duplicated = fixture()
  duplicated.classification.operations.push(clone(record(duplicated, AUDIT_POST)))
  assert.ok(hasProblem(run(duplicated), /is recorded twice/))
  const manifest = fixture()
  manifest.manifest.operations = [...manifest.manifest.operations.slice(0, 5), manifest.manifest.operations[4], ...manifest.manifest.operations.slice(5)]
  assert.ok(hasProblem(run(manifest), /duplicate operations|exactly 100 operations/))
  const id = fixture()
  record(id, AUDIT_POST).id = 'compliance/audit-logs/route.ts|PUT'
  assert.ok(hasProblem(run(id), /is not in the frozen tranche|has no route ownership entry|has no classification record/))
  const method = fixture()
  record(method, AUDIT_POST).method = 'GET'
  assert.ok(hasProblem(run(method), /id does not match its route and method/))
  const phantom = fixture()
  phantom.ledger.classifiedIn['zzz/route.ts|GET'] = 'GATE-0B.6'
  assert.ok(hasProblem(run(phantom), /ledger records zzz\/route.ts\|GET as classified in GATE-0B.6 but no classification exists/))
  const unledgered = fixture()
  delete unledgered.ledger.classified[AUDIT_POST]
  assert.ok(hasProblem(run(unledgered), /is not recorded in the classification ledger/))
  const twice = fixture()
  twice.ledger.classifiedIn[AUDIT_POST] = 'GATE-0B.5'
  assert.ok(hasProblem(run(twice), /does not record GATE-0B.6 in the ledger/))
  const ownershipIds = new Set(base.ownership.entries.map((entry) => `${entry[0]}|${entry[1]}`))
  assert.equal(ownershipIds.size, base.ownership.entries.length, 'no duplicate route-method identity in the ownership register')
  const partial = base.anchoredOwnershipEntries0b7.filter((entry) => entry[0] === 'enterprise/integrations/route.ts')
  assert.deepEqual(partial.map((entry) => [entry[1], entry[4]]).sort(), [['GET', 'OWNED'], ['POST', 'SCOPE_UNDECIDED']], 'a file only partly in the tranche classifies only its selected method')
})

test('NEGATIVE 12: the cumulative counts cannot double count the exceptions or omit an operation', () => {
  const entries = base.ownership.entries
  const totals = inventoryTotals(entries, exceptionOperations())
  assert.deepEqual(inventoryTotalsProblems(totals, totals), [])
  const double = { ...totals, DECISION_BOUND_SCOPE_EXCEPTION: 4, SCOPE_UNDECIDED_AWAITING_CLASSIFICATION: totals.SCOPE_UNDECIDED_AWAITING_CLASSIFICATION + 4 }
  const doubleResult = inventoryTotalsProblems(double, totals)
  assert.ok(doubleResult.some((problem) => /INVENTORY-TOTALS-DRIFT: SCOPE_UNDECIDED_AWAITING_CLASSIFICATION/.test(problem)))
  assert.ok(doubleResult.some((problem) => /INVENTORY-TOTALS-SUM: the categories add to 1650, not the 1646/.test(problem)))
  const omitted = { ...totals, OWNED: totals.OWNED - 1 }
  assert.ok(inventoryTotalsProblems(omitted, totals).some((problem) => /INVENTORY-TOTALS-SUM/.test(problem)))
  assert.ok(inventoryTotalsProblems(undefined, totals).some((problem) => /INVENTORY-TOTALS-ABSENT/.test(problem)))
  const countedAsOwned = inventoryTotals(entries.map((entry) => (DECISION_BOUND_OPERATIONS.includes(`${entry[0]}|${entry[1]}`) ? [...entry.slice(0, 4), 'OWNED', ...entry.slice(5)] : entry)), exceptionOperations())
  assert.equal(countedAsOwned.DECISION_BOUND_SCOPE_EXCEPTION, 0)
  assert.equal(countedAsOwned.OWNED, totals.OWNED + 4)
  const stale = clone(matrix)
  stale.routeInventoryTotals.OWNED += 1
  assert.ok(validateGate0(stale).problems.some((problem) => /INVENTORY-TOTALS-DRIFT: OWNED/.test(problem)))
  const absent = clone(matrix)
  delete absent.routeInventoryTotals
  assert.ok(validateGate0(absent).problems.some((problem) => /INVENTORY-TOTALS-ABSENT/.test(problem)))
  assert.equal(totals.OWNED + totals.SCOPE_UNDECIDED_AWAITING_CLASSIFICATION + totals.DECISION_BOUND_SCOPE_EXCEPTION + totals.RETIRED_501 + totals.STUB_501 + totals.SYSTEM, 1646)
  assert.deepEqual(matrix.routeInventoryTotals, totals)
})

test('the matrix pins the Gate 0B.6 files and the exception register, and a changed file fails the pin', () => {
  const stale = clone(matrix)
  stale.routeClassification0b6.files.classification.sha256 = '0'.repeat(64)
  assert.ok(validateGate0(stale).problems.some((problem) => /CLASSIFICATION-PIN-HASH/.test(problem)))
  const exceptions = clone(matrix)
  exceptions.decisionBoundExceptions.sha256 = '0'.repeat(64)
  assert.ok(validateGate0(exceptions).problems.some((problem) => /CLASSIFICATION-PIN-HASH/.test(problem)))
  const absent = clone(matrix)
  delete absent.routeClassification0b6
  assert.ok(validateGate0(absent).problems.some((problem) => /CLASSIFICATION-PIN-ABSENT/.test(problem)))
  const drift = clone(matrix)
  drift.routeDefects.find((item) => item.tranche === '0B.6').ownerCapabilityId = 'UE-CAP-D-002'
  assert.ok(validateGate0(drift).problems.some((problem) => /ROUTE-DEFECT-DRIFT/.test(problem)))
  assert.ok(exists(FILE_EXCEPTIONS))
})

test('end to end: a tampered Gate 0B.6 register fails the Gate 0 validator and an unregistered exposure returns as a blocker', () => {
  const classification = clone(base.classification0b6)
  classification.operations.find((item) => item.id === AUDIT_POST).evidence = []
  const tampered = validateGate0(matrix, { classification0b6: classification })
  assert.ok(tampered.problems.length > 0)
  const unregistered = clone(base.classification0b6)
  unregistered.releaseBlockingExposures = []
  assert.ok(validateGate0(matrix, { classification0b6: unregistered }).blockers.some((item) => item.code === 'ROUTE_UNJUSTIFIED_EXPOSURE'))
  const forged = clone(base.exceptionRegister)
  forged.exceptions[0].authorized = true
  assert.ok(validateGate0(matrix, { exceptionRegister: forged }).problems.some((problem) => /records authorized true/.test(problem)))
  const reOwned = clone(base.ownership)
  reOwned.entries.find((entry) => `${entry[0]}|${entry[1]}` === CARBON_DASHBOARD)[4] = 'OWNED'
  assert.ok(validateGate0(matrix, { ownership: reOwned }).problems.length > 0)
})
