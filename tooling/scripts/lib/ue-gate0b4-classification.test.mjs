import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FILES, loadContext, validateGate0 } from './ue-gate0-scope-lock.mjs'
import { UNDECIDED_OWNER, routeKeys } from './ue-gate0-route-ownership.mjs'
import { FILES_0B1 } from './ue-gate0b1-classification.mjs'
import { FILES_0B2 } from './ue-gate0b2-classification.mjs'
import { FILES_0B3 } from './ue-gate0b3-classification.mjs'
import { FILES_0B4, NEW_CAPABILITY_IDS, UNRESOLVED_OPERATIONS, validateClassification4 } from './ue-gate0b4-classification.mjs'
import { ANCHOR_COMMIT, CAPABILITY_IDS_0B4 as IDS } from './ue-gate0b4-groups.mjs'
import { anchoredEntries } from './ue-gate0b4-build-classification.mjs'
import { ACCEPTED, countsAt, matrixAt, ownershipEntriesAt } from './ue-gate0-history.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const base = loadContext(ROOT)
const matrix = JSON.parse(readFileSync(join(ROOT, FILES.matrix), 'utf8'))
const lock = JSON.parse(readFileSync(join(ROOT, FILES.lock), 'utf8'))
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
const atAnchor = (file) => execFileSync('git', ['show', `${ANCHOR_COMMIT}:${file}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

function fixture() {
  return {
    classification: clone(base.classification0b4),
    manifest: clone(base.tranche0b4),
    ledger: clone(base.ledger0b1),
    classification0b1: clone(base.classification0b1),
    classification0b2: clone(base.classification0b2),
    classification0b3: clone(base.classification0b3),
    manifest0b1: clone(base.tranche0b1),
    manifest0b2: clone(base.tranche0b2),
    manifest0b3: clone(base.tranche0b3),
    entries: clone(base.ownership.entries),
    capabilityById: new Map(matrix.capabilities.map((capability) => [capability.id, capability])),
    universe: new Set(routeKeys(base.routes)),
    exists,
    readText,
    anchoredEntries: clone(base.anchoredOwnershipEntries0b4),
  }
}

const run = (args) => validateClassification4(args)
const record = (args, id) => args.classification.operations.find((item) => item.id === id)
const entryOf = (args, id) => args.entries.find((entry) => `${entry[0]}|${entry[1]}` === id)
const hasProblem = (result, pattern) => result.problems.some((problem) => pattern.test(problem))

const BATCH_STATUS = 'billing/batch-status/[jobId]/route.ts|GET'
const CALENDAR_ITEM_GET = 'calendar-sync/connections/[id]/route.ts|GET'
const CALENDAR_ITEM_PATCH = 'calendar-sync/connections/[id]/route.ts|PATCH'
const CLAUSE_LIST_GET = 'clause-library/route.ts|GET'
const CLAUSE_SEARCH_POST = 'clause-library/search/route.ts|POST'
const ANTI_SCAB_DELETE = 'cnesst/anti-scab/[id]/route.ts|DELETE'
const CBA_EXTRACTION = 'cba-intelligence/extraction/route.ts|POST'
const CARBON_POST = 'carbon/validate/route.ts|POST'
const CASE_STUDIES_GET = 'case-studies/route.ts|GET'
const LAST = 'cnesst/hs-committees/route.ts|POST'

test('the committed Gate 0B.4 registers validate against the live source', () => {
  const result = run(fixture())
  assert.deepEqual(result.problems, [])
  assert.deepEqual(result.summary, {
    tranche: 'GATE-0B.4',
    examined: 100,
    carriedForward: 1,
    newlyExamined: 99,
    classified: 96,
    unresolved: 4,
    carriedForwardResolved: 1,
    newDefects: 60,
    defectsTotal: 136,
    institutionalDecisions: 8,
    crossTenantExposures: 8,
    newCapabilities: 6,
  })
})

test('the tranche freezes the carried-forward operation and the next 99 unexamined operations at the Gate 0B.3 commit', () => {
  const args = fixture()
  assert.equal(args.manifest.size, 100)
  assert.equal(args.manifest.operations.length, 100)
  assert.deepEqual(args.manifest.carryForward, [BATCH_STATUS])
  assert.equal(args.manifest.newOperations.length, 99)
  assert.equal(args.manifest.anchorCommit, ACCEPTED['0B.3'])
  assert.equal(ANCHOR_COMMIT, ACCEPTED['0B.3'])
  assert.equal(args.manifest.carryForwardFrom, 'GATE-0B.3')
  assert.equal(args.manifest.newOperations[0], CALENDAR_ITEM_GET)
  assert.equal(args.manifest.newOperations[98], LAST)
  const examined = new Set([...args.manifest0b1.operations, ...args.manifest0b2.operations, ...args.manifest0b3.operations])
  for (const id of args.manifest.newOperations) assert.ok(!examined.has(id), id)
  const undecided = anchoredEntries().filter((entry) => entry[4] === 'SCOPE_UNDECIDED').map((entry) => `${entry[0]}|${entry[1]}`).filter((id) => !examined.has(id) && id !== BATCH_STATUS).sort()
  assert.deepEqual(args.manifest.newOperations, undecided.slice(0, 99))
  assert.deepEqual(args.manifest.operations, [BATCH_STATUS, ...args.manifest.newOperations].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)))
})

test('newsletter batch status is owned by the narrow campaign-delivery capability and the institutional owner stays outstanding', () => {
  const args = fixture()
  const item = record(args, BATCH_STATUS)
  assert.equal(item.status, 'CLASSIFIED')
  assert.equal(item.capabilityId, IDS.COMMS_DELIVERY)
  assert.equal(item.carriedForwardFrom, 'GATE-0B.3')
  assert.equal(args.capabilityById.get(item.capabilityId).primaryGate, 11)
  assert.deepEqual(item.institutionalDecisions, ['UE-INST-COMMUNICATIONS-CAMPAIGN-OWNER'])
  const decision = args.classification.institutionalDecisions.find((entry) => entry.id === 'UE-INST-COMMUNICATIONS-CAMPAIGN-OWNER')
  assert.equal(decision.status, 'OUTSTANDING')
  assert.equal(item.kernelAuthorization, false)
  assert.equal(item.authorizationCategory, 'ROLE_FLOOR')
  assert.equal(args.ledger.classifiedIn[BATCH_STATUS], 'GATE-0B.4')
  assert.equal(entryOf(args, BATCH_STATUS)[4], 'OWNED')
  assert.equal(entryOf(args, BATCH_STATUS)[3], IDS.COMMS_DELIVERY)
  assert.equal(ownershipEntriesAt(ACCEPTED['0B.3']).find((entry) => `${entry[0]}|${entry[1]}` === BATCH_STATUS)[4], 'SCOPE_UNDECIDED', 'it was still undecided when Gate 0B.3 was accepted')
  assert.ok(item.defects.length >= 3)
  assert.doesNotMatch(JSON.stringify(args.capabilityById.get(IDS.COMMS_DELIVERY)), /PROVEN_IN_STAGING|\bdelivered\b|\bcomplete\b/)
})

test('the four carbon operations stay undecided and each names its exact evidence gap and the decision it waits for', () => {
  const args = fixture()
  const unresolved = args.classification.operations.filter((item) => item.status === 'UNRESOLVED').map((item) => item.id).sort()
  assert.deepEqual(unresolved, [...UNRESOLVED_OPERATIONS].sort())
  for (const id of unresolved) {
    const item = record(args, id)
    assert.equal(item.capabilityId, UNDECIDED_OWNER)
    assert.ok(item.evidenceGap.length > 60, id)
    assert.ok(item.unresolvedReason.length > 60, id)
    assert.deepEqual(item.institutionalDecisions, ['UE-INST-CARBON-ACCOUNTING-SCOPE'])
    assert.equal(entryOf(args, id)[4], 'SCOPE_UNDECIDED')
    assert.equal(entryOf(args, id)[3], UNDECIDED_OWNER)
    assert.equal(args.ledger.classified[id], undefined, 'an unresolved operation is not in the classified ledger')
  }
  assert.equal(args.classification.operations.filter((item) => item.status === 'CLASSIFIED').length, 96)
  assert.equal(args.classification.institutionalDecisions.find((decision) => decision.id === 'UE-INST-CARBON-ACCOUNTING-SCOPE').status, 'OUTSTANDING')
})

test('the six new capabilities are justified: each owns classified operations, sits in the matrix and the lock, and none exists to reduce the undecided count', () => {
  assert.equal(NEW_CAPABILITY_IDS.length, 6)
  const additions = new Map(lock.additions.map((item) => [item.capabilityId, item]))
  for (const id of NEW_CAPABILITY_IDS) {
    const capability = matrix.capabilities.find((item) => item.id === id)
    assert.ok(capability, id)
    assert.ok(Number.isInteger(capability.primaryGate), id)
    assert.ok(capability.sourceFiles.length > 0 && capability.sourceFiles.every(exists), `${id} cites existing implementation source`)
    assert.ok(Array.isArray(capability.dependencyGates), id)
    assert.ok(lock.capabilityIds.includes(id), id)
    const addition = additions.get(id)
    assert.equal(addition.tranche, 'GATE-0B.4', id)
    assert.equal(addition.operationsHash, base.tranche0b4.operationsHash, id)
    assert.equal(addition.classifiedOperations, base.classification0b4.operations.filter((item) => item.status === 'CLASSIFIED' && item.capabilityId === id).length, id)
    assert.ok(addition.classifiedOperations >= 1, id)
    assert.doesNotMatch(JSON.stringify(capability), /PROVEN_IN_STAGING|"status":"complete"|"delivered"/)
  }
  assert.deepEqual(Object.fromEntries(NEW_CAPABILITY_IDS.map((id) => [id, matrix.capabilities.find((item) => item.id === id).primaryGate])), {
    [IDS.COMMS_DELIVERY]: 11, [IDS.CALENDAR]: 14, [IDS.CBA_DATASET]: 14, [IDS.CBA_REGISTER]: 14, [IDS.CLAUSE_LIBRARY]: 14, [IDS.OHS]: 6,
  })
  assert.equal(matrix.capabilities.length, 74)
  assert.equal(lock.capabilityIds.length, 74)
  assert.ok(!matrix.capabilities.some((item) => /carbon/i.test(item.id)), 'no capability was created for the carbon routes')
})

test('every classified record cites its route file, states the authorization applied, names callers, audit and dependency gates, and has provenance for each material claim', () => {
  const args = fixture()
  for (const item of args.classification.operations) {
    assert.ok(item.evidence.some((citation) => citation.ref === `apps/union-eyes/app/api/${item.route}`), item.id)
    assert.equal(item.kernelAuthorization, false, item.id)
    assert.ok(Array.isArray(item.callers), item.id)
    assert.ok(item.callerFinding.length > 20, item.id)
    assert.ok(item.requiredAudit.length > 15, item.id)
    assert.ok(Array.isArray(item.dependencyGates), item.id)
    assert.ok(Array.isArray(item.inferences), item.id)
    for (const evidence of item.evidence) assert.ok(['ROUTE_HANDLER_DIRECT', 'ROUTE_IMPORTED_HELPER', 'SERVICE_IMPLEMENTATION', 'SCHEMA_OR_POLICY'].includes(evidence.provenance), `${item.id}: ${evidence.provenance}`)
    for (const claim of ['authentication', 'authorization', 'tenantScope', 'mutation']) assert.ok(item.evidence.some((evidence) => evidence.claim === claim), `${item.id} ${claim}`)
    if (item.status === 'CLASSIFIED') assert.ok(entryOf(args, item.id)[2].startsWith('RULE-0B4-') || item.id === BATCH_STATUS, item.id)
  }
  assert.ok(args.classification.operations.some((item) => item.callers.length > 0))
})

test('the 60 new defects each have one responsible capability that owns the repair gate, are cited, and the earlier 76 are untouched', () => {
  const args = fixture()
  const added = args.classification.defectRegister.filter((defect) => defect.tranche === '0B.4')
  assert.equal(added.length, 60)
  for (const defect of added) {
    assert.ok(args.capabilityById.has(defect.ownerCapabilityId), defect.id)
    assert.equal(args.capabilityById.get(defect.ownerCapabilityId).primaryGate, defect.gate, defect.id)
    assert.ok(args.classification.operations.some((item) => item.defects.includes(defect.id)), defect.id)
    assert.equal(defect.releaseBlocking, false)
  }
  assert.equal(args.classification.defectRegister.length, 136)
  assert.deepEqual(args.classification.defectRegister.slice(0, 76), base.classification0b3.defectRegister)
  assert.equal(matrix.routeDefects.length, 136)
  const acceptedDefects = matrixAt(ACCEPTED['0B.3']).routeDefects
  const current = new Map(matrix.routeDefects.map((defect) => [defect.id, defect]))
  for (const defect of acceptedDefects) assert.deepEqual(current.get(defect.id), defect, defect.id)
})

test('earlier tranche files are byte-identical to the accepted commit and the ledger only grows', () => {
  for (const file of [FILES_0B1.manifest, FILES_0B1.classification, FILES_0B2.manifest, FILES_0B2.classification, FILES_0B3.manifest, FILES_0B3.classification]) assert.equal(readText(file), atAnchor(file), file)
  const args = fixture()
  const anchored = JSON.parse(atAnchor(FILES_0B1.ledger))
  for (const [id, owner] of Object.entries(anchored.classified)) assert.equal(args.ledger.classified[id], owner, id)
  for (const [id, tranche] of Object.entries(anchored.classifiedIn)) {
    if (id === BATCH_STATUS) continue
    assert.equal(args.ledger.classifiedIn[id], tranche, id)
  }
  assert.equal(Object.keys(args.ledger.classified).length, 279 + 96)
  for (const key of ['GATE-0B.1', 'GATE-0B.2', 'GATE-0B.3']) assert.equal(args.ledger.tranches[key].operationsHash, anchored.tranches[key].operationsHash)
  for (const old of base.anchoredOwnershipEntries0b4.filter((entry) => entry[4] !== 'SCOPE_UNDECIDED')) assert.notEqual(entryOf(args, `${old[0]}|${old[1]}`)[4], 'SCOPE_UNDECIDED')
})

test('cumulative counts advance by exactly the operations this tranche classified', () => {
  const before = countsAt(ACCEPTED['0B.3'])
  const args = fixture()
  const owned = args.entries.filter((entry) => entry[4] === 'OWNED').length
  const undecided = args.entries.filter((entry) => entry[4] === 'SCOPE_UNDECIDED').length
  assert.deepEqual(before, { operations: 1644, owned: 634, undecided: 873, classified: 279 })
  assert.equal(args.entries.length, 1644)
  assert.equal(owned, 634 + 96)
  assert.equal(undecided, 873 - 96)
  assert.equal(Object.keys(args.ledger.classified).length, before.classified + 96)
  assert.equal(matrix.routeOwnership.operations, 1644)
})

test('Gate 0 stays IN_PROGRESS, validates the fourth tranche and keeps the three unjustified exposures release blocking', () => {
  const result = validateGate0(matrix)
  assert.deepEqual(result.problems, [])
  assert.equal(result.summary.verdict, 'IN_PROGRESS')
  assert.equal(result.summary.classification0b4.examined, 100)
  assert.equal(result.summary.classification0b4.classified, 96)
  assert.equal(result.summary.classification0b4.unresolved, 4)
  assert.equal(result.gateAcceptanceBlockers.filter((item) => item.kind === 'RELEASE_BLOCKING_ROUTE_EXPOSURE').length, 3)
  assert.ok(!result.blockers.some((item) => item.code === 'ROUTE_UNJUSTIFIED_EXPOSURE'))
})

test('public marketing reads and the clause library cross-tenant reads are recorded as exposures, not authorizations', () => {
  const args = fixture()
  assert.equal(record(args, CASE_STUDIES_GET).authorizationCategory, 'NONE_PUBLIC')
  assert.equal(record(args, CLAUSE_LIST_GET).crossTenantExposure, true)
  assert.equal(record(args, CLAUSE_LIST_GET).crossTenantAuthorized, false)
  assert.ok(record(args, CLAUSE_LIST_GET).exposureContract.length > 40)
  assert.ok(record(args, CLAUSE_LIST_GET).defects.length >= 2)
})

test('NEGATIVE 1: an operation cannot disappear from, or be added to, the frozen tranche', () => {
  const dropped = fixture()
  dropped.classification.operations = dropped.classification.operations.filter((item) => item.id !== CALENDAR_ITEM_GET)
  assert.ok(hasProblem(run(dropped), /has no classification record/))
  const manifest = fixture()
  manifest.manifest.operations = manifest.manifest.operations.filter((id) => id !== CALENDAR_ITEM_GET)
  const result = run(manifest)
  assert.ok(hasProblem(result, /exactly 100 operations/))
  assert.ok(hasProblem(result, /operationsHash/))
  const extra = fixture()
  extra.manifest.operations = [...extra.manifest.operations, 'zzz/route.ts|GET']
  assert.ok(hasProblem(run(extra), /exactly 100 operations|does not exist in the route-method universe/))
})

test('NEGATIVE 2: tranche membership or order cannot change without a new version and reason', () => {
  const swapped = fixture()
  const outsider = swapped.entries.find((entry) => entry[4] === 'SCOPE_UNDECIDED' && !swapped.manifest.operations.includes(`${entry[0]}|${entry[1]}`))
  swapped.manifest.newOperations[0] = `${outsider[0]}|${outsider[1]}`
  assert.ok(hasProblem(run(swapped), /not the next 99 SCOPE_UNDECIDED operations|not the carry-forward operation plus the new operations/))
  const reordered = fixture()
  reordered.manifest.operations = [...reordered.manifest.operations].reverse()
  assert.ok(hasProblem(run(reordered), /not deterministic ascending/))
  const rehashed = fixture()
  rehashed.manifest.operationsHash = '0'.repeat(64)
  assert.ok(hasProblem(run(rehashed), /operationsHash does not match/))
  const unlogged = fixture()
  unlogged.manifest.version = 2
  assert.ok(hasProblem(run(unlogged), /version 2 has no versionLog entry/))
})

test('NEGATIVE 3: the carry-forward operation cannot be dropped, and an already-examined operation cannot be re-examined', () => {
  const dropped = fixture()
  dropped.manifest.carryForward = []
  assert.ok(hasProblem(run(dropped), /carry forward exactly 1|carry-forward operation .* was dropped|not exactly the operation Gate 0B.3 left unresolved/))
  const reexamined = fixture()
  reexamined.manifest0b3.operations = [...reexamined.manifest0b3.operations, reexamined.manifest.newOperations[0]]
  assert.ok(hasProblem(run(reexamined), /was already examined in an earlier tranche/))
  const anchor = fixture()
  anchor.manifest.anchorCommit = '0'.repeat(40)
  assert.ok(hasProblem(run(anchor), /anchor commit is not the recorded Gate 0B.3 commit/))
})

test('NEGATIVE 4: an earlier classification cannot be silently changed or reverted', () => {
  const reverted = fixture()
  const entry = entryOf(reverted, 'alerts/realtime/route.ts|GET')
  entry[3] = UNDECIDED_OWNER
  entry[4] = 'SCOPE_UNDECIDED'
  const result = run(reverted)
  assert.ok(hasProblem(result, /silently reverted to SCOPE_UNDECIDED/))
  const owner = fixture()
  entryOf(owner, 'ai/search/route.ts|POST')[3] = IDS.CALENDAR
  assert.ok(hasProblem(run(owner), /was changed or reverted|changed owner/))
  const removed = fixture()
  delete removed.ledger.classified['ai/search/route.ts|POST']
  assert.ok(hasProblem(run(removed), /missing or changed in the ledger/))
})

test('NEGATIVE 5: an earlier defect cannot be dropped or altered, and a defect needs one owner that owns its repair gate and a citing record', () => {
  const dropped = fixture()
  dropped.classification.defectRegister = dropped.classification.defectRegister.filter((defect) => defect.id !== 'DEF-0B2-AI-CLASSIFY-UNGUARDED')
  assert.ok(hasProblem(run(dropped), /earlier defect DEF-0B2-AI-CLASSIFY-UNGUARDED is missing/))
  const altered = fixture()
  altered.classification.defectRegister.find((defect) => defect.tranche === '0B.3').severity = 'LOW'
  assert.ok(hasProblem(run(altered), /earlier defect .* was altered/))
  const gate = fixture()
  gate.classification.defectRegister.find((defect) => defect.tranche === '0B.4').gate = 3
  assert.ok(hasProblem(run(gate), /is repaired in gate 3 but/))
  const ownerless = fixture()
  ownerless.classification.defectRegister.find((defect) => defect.tranche === '0B.4').ownerCapabilityId = 'UE-CAP-NOPE'
  assert.ok(hasProblem(run(ownerless), /no responsible engineering capability/))
  const orphan = fixture()
  const first = orphan.classification.defectRegister.find((defect) => defect.tranche === '0B.4').id
  for (const item of orphan.classification.operations) item.defects = item.defects.filter((id) => id !== first)
  assert.ok(hasProblem(run(orphan), /is recorded but no classification cites it/))
})

test('NEGATIVE 6: a classification cannot cite source text that is not in the file, cite no source, or cite a quote without provenance', () => {
  const quote = fixture()
  record(quote, CALENDAR_ITEM_GET).evidence[0].quote = 'this text is nowhere in the route file'
  assert.ok(hasProblem(run(quote), /the quoted text is not in the file/))
  const none = fixture()
  record(none, CALENDAR_ITEM_GET).evidence = []
  assert.ok(hasProblem(run(none), /has no source evidence|without non-inference evidence/))
  const bare = fixture()
  delete record(bare, CALENDAR_ITEM_GET).evidence[0].provenance
  assert.ok(hasProblem(run(bare), /without a valid provenance/))
})

test('NEGATIVE 7: a quote that belongs to a sibling method or sibling route is not evidence for the classified operation', () => {
  const INGESTION_GET = 'cba-intelligence/ingestion/route.ts|GET'
  const INGESTION_ROUTE = 'apps/union-eyes/app/api/cba-intelligence/ingestion/route.ts'
  const method = fixture()
  record(method, INGESTION_GET).evidence.push({ provenance: 'ROUTE_HANDLER_DIRECT', claim: 'audit', method: 'GET', ref: INGESTION_ROUTE, quote: 'await persistAtomicAudit(tx, {' })
  assert.ok(hasProblem(run(method), /the quote is not inside the GET handler of the route; it may belong to another method or to module scope/))
  const retagged = fixture()
  record(retagged, INGESTION_GET).evidence.push({ provenance: 'ROUTE_HANDLER_DIRECT', claim: 'audit', method: 'POST', ref: INGESTION_ROUTE, quote: 'await persistAtomicAudit(tx, {' })
  assert.ok(hasProblem(run(retagged), /is tagged for POST but the record is GET/))
  const module = fixture()
  record(module, INGESTION_GET).evidence.push({ provenance: 'ROUTE_HANDLER_DIRECT', claim: 'behavior', method: 'GET', ref: INGESTION_ROUTE, quote: 'const triggerIngestionSchema = z.object({' })
  assert.ok(hasProblem(run(module), /not inside the GET handler/))
  const route = fixture()
  record(route, CALENDAR_ITEM_GET).evidence.push({
    provenance: 'ROUTE_HANDLER_DIRECT', claim: 'behavior', method: 'GET', ref: 'apps/union-eyes/app/api/calendar-sync/connections/route.ts', quote: 'beforeCreate: (values, { userId }) => ({ ...values, userId }),',
  })
  assert.ok(hasProblem(run(route), /is not the classified route file/))
})

test('NEGATIVE 8: an authentication or authorization claim cannot rest on an inference or on a service the route handler does not reach', () => {
  const inferred = fixture()
  const item = record(inferred, CALENDAR_ITEM_GET)
  item.evidence = item.evidence.filter((evidence) => evidence.claim !== 'authentication')
  item.inferences = [{ claim: 'authentication', statement: 'The wrapper presumably authenticates every caller before the handler runs.' }]
  const result = run(inferred)
  assert.ok(hasProblem(result, /makes the authentication claim without non-inference evidence/))
  assert.ok(hasProblem(result, /rests the authentication claim on an inference/))
  const missing = fixture()
  delete record(missing, CALENDAR_ITEM_GET).inferences
  assert.ok(hasProblem(run(missing), /is missing inferences/))
})

test('NEGATIVE 9: cross-tenant reachability is never authorization', () => {
  const authorized = fixture()
  record(authorized, CLAUSE_LIST_GET).crossTenantAuthorized = true
  assert.ok(hasProblem(run(authorized), /records it as authorized/))
  const hidden = fixture()
  record(hidden, CLAUSE_LIST_GET).exposureContract = ''
  assert.ok(hasProblem(run(hidden), /without an exposure contract/))
  const undefended = fixture()
  record(undefended, CLAUSE_LIST_GET).defects = []
  assert.ok(hasProblem(run(undefended), /without a recorded defect/))
  const granted = fixture()
  record(granted, CLAUSE_LIST_GET).accessJustifiedBy = ['UE-INST-KNOWLEDGE-PUBLICATION']
  assert.ok(hasProblem(run(granted), /no institutional authority decision is adopted/))
})

test('NEGATIVE 10: a role floor cannot be recorded as kernel authorization and no institutional decision can be adopted or altered', () => {
  const kernel = fixture()
  const item = record(kernel, CALENDAR_ITEM_GET)
  item.kernelAuthorization = true
  item.authorizationCategory = 'KERNEL_AUTHORITY'
  assert.ok(hasProblem(run(kernel), /claims kernel authorization but cites no kernel decision/))
  const flagged = fixture()
  record(flagged, CLAUSE_LIST_GET).kernelAuthorization = true
  assert.ok(hasProblem(run(flagged), /inconsistent about kernel authorization/))
  const adopted = fixture()
  adopted.classification.institutionalDecisions.find((decision) => decision.id === 'UE-INST-COMMUNICATIONS-CAMPAIGN-OWNER').status = 'ADOPTED'
  assert.ok(hasProblem(run(adopted), /can record only outstanding decisions/))
  const altered = fixture()
  altered.classification.institutionalDecisions.find((decision) => decision.id === 'UE-INST-AUDIT-HISTORY-READERS').question = 'Altered question that no longer asks what the earlier tranche asked.'
  assert.ok(hasProblem(run(altered), /was altered or adopted/))
  const dropped = fixture()
  dropped.classification.institutionalDecisions = dropped.classification.institutionalDecisions.filter((decision) => decision.id !== 'UE-INST-OBSERVABILITY-ALERT-OWNER')
  assert.ok(hasProblem(run(dropped), /recorded by an earlier tranche is missing/))
})

test('NEGATIVE 11: an atomic audit cannot be claimed by declaration and a read cannot cite a write', () => {
  const declared = fixture()
  const item = record(declared, CALENDAR_ITEM_PATCH)
  item.evidence = item.evidence.filter((evidence) => evidence.claim !== 'audit')
  const declaredResult = run(declared)
  assert.ok(hasProblem(declaredResult, /is marked atomically audited without citing an in-transaction audit write/))
  assert.ok(hasProblem(declaredResult, /makes the audit claim without non-inference evidence/))
  const read = fixture()
  record(read, CALENDAR_ITEM_GET).mutationAudit = 'ATOMIC_AUDIT_IN_TRANSACTION'
  assert.ok(hasProblem(run(read), /is a read method but records a mutation obligation/))
  const silent = fixture()
  record(silent, ANTI_SCAB_DELETE).mutationAudit = 'NOT_MUTATING'
  const silentResult = run(silent)
  assert.ok(hasProblem(silentResult, /is DELETE but is marked not mutating without a reason/))
  assert.ok(hasProblem(silentResult, /writes an OPERATIONAL table through the factory, which audits atomically/))
})

test('NEGATIVE 12: a capability that does not cover the route business domain or rule is rejected', () => {
  const wrong = fixture()
  const item = record(wrong, CALENDAR_ITEM_GET)
  item.capabilityId = IDS.CBA_DATASET
  entryOf(wrong, CALENDAR_ITEM_GET)[3] = IDS.CBA_DATASET
  const wrongResult = run(wrong)
  assert.ok(hasProblem(wrongResult, /is in the domain CALENDAR_PROVIDER_CONNECTIONS, which UE-OMIT-CBA-INTELLIGENCE-DATASET does not cover/))
  assert.ok(hasProblem(wrongResult, /changed owner from UE-OMIT-CALENDAR-AND-PROVIDER-CONNECTIONS to UE-OMIT-CBA-INTELLIGENCE-DATASET without a versioned reason/))
  const generic = fixture()
  record(generic, CBA_EXTRACTION).capabilityId = 'UE-OMIT-ROUTE-DOMAIN-SCOPE'
  assert.ok(hasProblem(run(generic), /names an invalid capability UE-OMIT-ROUTE-DOMAIN-SCOPE/))
  const unknown = fixture()
  record(unknown, CALENDAR_ITEM_GET).capabilityId = 'UE-OMIT-NOT-A-CAPABILITY'
  assert.ok(hasProblem(run(unknown), /names an invalid capability UE-OMIT-NOT-A-CAPABILITY/))
})

test('NEGATIVE 13: required audit, callers and dependency gates must be stated and valid', () => {
  const audit = fixture()
  record(audit, CALENDAR_ITEM_GET).requiredAudit = ''
  assert.ok(hasProblem(run(audit), /states no required audit behavior/))
  const gates = fixture()
  record(gates, CALENDAR_ITEM_GET).dependencyGates = [99]
  assert.ok(hasProblem(run(gates), /has an invalid dependency gate list/))
  const callers = fixture()
  record(callers, CALENDAR_ITEM_GET).callers = [{ file: 'apps/union-eyes/does/not/exist.ts', line: 1, text: 'fetch("/api/calendar-sync/connections")' }]
  assert.ok(hasProblem(run(callers), /has a malformed caller/))
})

test('NEGATIVE 14: an unresolved operation must name its exact evidence gap and cannot be silently assigned', () => {
  const gap = fixture()
  record(gap, CARBON_POST).evidenceGap = ''
  assert.ok(hasProblem(run(gap), /unresolved without evidenceGap/))
  const waiting = fixture()
  record(waiting, CARBON_POST).institutionalDecisions = []
  assert.ok(hasProblem(run(waiting), /without naming the institutional decision/))
  const assigned = fixture()
  const entry = entryOf(assigned, CARBON_POST)
  entry[3] = IDS.CALENDAR
  entry[4] = 'OWNED'
  assert.ok(hasProblem(run(assigned), /unresolved but the ownership register assigns it/))
  const guessed = fixture()
  record(guessed, CALENDAR_ITEM_GET).status = 'UNRESOLVED'
  const guessedResult = run(guessed)
  assert.ok(hasProblem(guessedResult, /is unresolved but the ownership register assigns it/))
  assert.ok(hasProblem(guessedResult, /is unresolved without evidenceGap/))
  assert.ok(hasProblem(guessedResult, /is unresolved but is not a recorded evidence gap/))
})

test('NEGATIVE 15: the classification summary cannot disagree with its records and the ledger must record every classification', () => {
  const summary = fixture()
  summary.classification.summary = { ...base.classification0b4.summary, classified: 100, unresolved: 0 }
  assert.ok(hasProblem(run(summary), /summary does not match its records/))
  const ledger = fixture()
  delete ledger.ledger.classified[CALENDAR_ITEM_GET]
  assert.ok(hasProblem(run(ledger), /is not recorded in the classification ledger/))
  const tranche = fixture()
  delete tranche.ledger.tranches['GATE-0B.4']
  assert.ok(hasProblem(run(tranche), /does not record the GATE-0B.4 tranche/))
})

test('NEGATIVE 16: a release-blocking exposure cannot lose its contract or its mark', () => {
  const lost = fixture()
  lost.classification.releaseBlockingExposures = lost.classification.releaseBlockingExposures.slice(1)
  assert.ok(hasProblem(run(lost), /is not preserved as a release-blocking defect/))
  const unmarked = fixture()
  unmarked.classification.defectRegister.find((defect) => defect.id === 'DEF-0B1-DOCS-UNAUTH-API-SURFACE').releaseBlocking = false
  assert.ok(hasProblem(run(unmarked), /was altered in the defect register|must be registered as release blocking/))
})

test('NEGATIVE 17: a search that POST-reads a table cannot be recorded as mutating, and a mutation cannot be recorded as not mutating without a reason', () => {
  const search = record(fixture(), CLAUSE_SEARCH_POST)
  assert.equal(search.mutationAudit, 'NOT_MUTATING')
  assert.ok(search.nonMutationReason.length > 20)
  const silent = fixture()
  delete record(silent, CLAUSE_SEARCH_POST).nonMutationReason
  assert.ok(hasProblem(run(silent), /is POST but is marked not mutating without a reason/))
})

test('the matrix pins the Gate 0B.4 files and a changed file fails the pin', () => {
  const stale = clone(matrix)
  stale.routeClassification0b4.files.classification.sha256 = '0'.repeat(64)
  assert.ok(validateGate0(stale).problems.some((problem) => /CLASSIFICATION-PIN-HASH/.test(problem)))
  const absent = clone(matrix)
  delete absent.routeClassification0b4
  assert.ok(validateGate0(absent).problems.some((problem) => /CLASSIFICATION-PIN-ABSENT/.test(problem)))
  const drift = clone(matrix)
  drift.routeDefects[drift.routeDefects.length - 1].ownerCapabilityId = IDS.CALENDAR
  assert.ok(validateGate0(drift).problems.some((problem) => /ROUTE-DEFECT-DRIFT/.test(problem)))
  assert.equal(FILES_0B4.classification, 'docs/union-eyes/convergence/register/ue-route-classification-0b4.json')
})
