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
import { FILES_0B3, NEW_CAPABILITY_IDS, validateClassification3 } from './ue-gate0b3-classification.mjs'
import { ANCHOR_COMMIT, CAPABILITY_IDS_0B3 as IDS } from './ue-gate0b3-groups.mjs'
import { anchoredEntries } from './ue-gate0b3-build-classification.mjs'
import { ACCEPTED, countsAt, ledgerAt, matrixAt, ownershipEntriesAt } from './ue-gate0-history.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const base = loadContext(ROOT)
const matrix = JSON.parse(readFileSync(join(ROOT, FILES.matrix), 'utf8'))
const lock = JSON.parse(readFileSync(join(ROOT, FILES.lock), 'utf8'))
const clone = (value) => JSON.parse(JSON.stringify(value))
const exists = (file) => existsSync(join(ROOT, file))
const readText = (file) => readFileSync(join(ROOT, file), 'utf8')
const atAnchor = (file) => execFileSync('git', ['show', `${ANCHOR_COMMIT}:${file}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

function fixture() {
  return {
    classification: clone(base.classification0b3),
    manifest: clone(base.tranche0b3),
    ledger: ledgerAt(ACCEPTED['0B.3']),
    classification0b1: clone(base.classification0b1),
    classification0b2: clone(base.classification0b2),
    manifest0b1: clone(base.tranche0b1),
    manifest0b2: clone(base.tranche0b2),
    entries: ownershipEntriesAt(ACCEPTED['0B.3']),
    capabilityById: new Map(matrix.capabilities.map((capability) => [capability.id, capability])),
    universe: new Set(routeKeys(base.routes)),
    exists,
    readText,
    anchoredEntries: clone(base.anchoredOwnershipEntries0b3),
  }
}

const run = (args) => validateClassification3(args)
const record = (args, id) => args.classification.operations.find((item) => item.id === id)
const entryOf = (args, id) => args.entries.find((entry) => `${entry[0]}|${entry[1]}` === id)
const hasProblem = (result, pattern) => result.problems.some((problem) => pattern.test(problem))

const ALERTS = 'alerts/realtime/route.ts|GET'
const BATCH_STATUS = 'billing/batch-status/[jobId]/route.ts|GET'
const AUDITS = 'audits/route.ts|GET'
const KPIS_GET = 'analytics/kpis/route.ts|GET'
const INSIGHTS_POST = 'analytics/insights/route.ts|POST'
const CITATIONS_GET = 'arbitration/precedents/[id]/citations/route.ts|GET'
const WEEKLY_SUMMARY = 'analytics/insights/weekly-summary/route.ts|POST'
const REPLAY_INVOICE = 'billing/replay-invoice/route.ts|POST'
const BULK_IMPORT = 'bulk-import/route.ts|POST'
const BREAKS_POST = 'breaks/route.ts|POST'
const BREAKS_ITEM_GET = 'breaks/[id]/route.ts|GET'
const CRUD_ALERT_ANCHORED = 'admin/alerts/rules/route.ts|POST'

test('the tranche freezes exactly one carry-forward operation and the next 99 unexamined operations at the Gate 0B.2 commit', () => {
  const args = fixture()
  assert.deepEqual(run(args).problems, [])
  assert.equal(args.manifest.size, 100)
  assert.equal(args.manifest.operations.length, 100)
  assert.deepEqual(args.manifest.carryForward, [ALERTS])
  assert.equal(args.manifest.newOperations.length, 99)
  assert.equal(args.manifest.anchorCommit, 'e38eee48d8dbc7b4dddddeb4974ca4067213117a')
  assert.equal(args.manifest.carryForwardFrom, 'GATE-0B.2')
  assert.equal(args.manifest.version, 1)
  assert.deepEqual([...args.manifest.operations].sort(), args.manifest.operations.length === 100 ? [...args.manifest.operations].sort() : [])
  const examined = new Set([...args.manifest0b1.operations, ...args.manifest0b2.operations])
  for (const id of args.manifest.newOperations) assert.ok(!examined.has(id), id)
  const undecided = anchoredEntries().filter((entry) => entry[4] === 'SCOPE_UNDECIDED').map((entry) => `${entry[0]}|${entry[1]}`).filter((id) => !examined.has(id) && id !== ALERTS).sort()
  assert.deepEqual(args.manifest.newOperations, undecided.slice(0, 99))
})

test('the carry-forward operation is classified as observability alert visibility and the institutional owner stays outstanding', () => {
  const args = fixture()
  const item = record(args, ALERTS)
  assert.equal(item.status, 'CLASSIFIED')
  assert.equal(item.capabilityId, 'UE-OMIT-OBSERVABILITY-ALERT-VISIBILITY')
  assert.equal(item.carriedForwardFrom, 'GATE-0B.2')
  assert.equal(args.capabilityById.get(item.capabilityId).primaryGate, 14)
  assert.ok(item.institutionalDecisions.includes('UE-INST-OBSERVABILITY-ALERT-OWNER'))
  const decision = args.classification.institutionalDecisions.find((entry) => entry.id === 'UE-INST-OBSERVABILITY-ALERT-OWNER')
  assert.equal(decision.status, 'OUTSTANDING')
  assert.equal(args.ledger.classifiedIn[ALERTS], 'GATE-0B.3')
  assert.equal(entryOf(args, ALERTS)[4], 'OWNED')
})

test('one operation stays undecided and names its exact evidence gap and the decision it waits for', () => {
  const args = fixture()
  const unresolved = args.classification.operations.filter((item) => item.status === 'UNRESOLVED')
  assert.deepEqual(unresolved.map((item) => item.id), [BATCH_STATUS])
  assert.equal(unresolved[0].capabilityId, UNDECIDED_OWNER)
  assert.ok(unresolved[0].evidenceGap.length > 60)
  assert.deepEqual(unresolved[0].institutionalDecisions, ['UE-INST-COMMUNICATIONS-CAMPAIGN-OWNER'])
  assert.equal(entryOf(args, BATCH_STATUS)[4], 'SCOPE_UNDECIDED')
  assert.equal(args.classification.operations.filter((item) => item.status === 'CLASSIFIED').length, 99)
})

test('the five justified capabilities exist in the matrix at gate 14 and in the independent lock', () => {
  assert.deepEqual([...NEW_CAPABILITY_IDS].sort(), [
    'UE-OMIT-ANALYTICS-REPORT-AUTHORIZATION', 'UE-OMIT-ARBITRATION-PRECEDENT-LIBRARY', 'UE-OMIT-BARGAINING-RECORDS',
    'UE-OMIT-OBSERVABILITY-ALERT-VISIBILITY', 'UE-OMIT-PLATFORM-SUBSCRIPTION-BILLING',
  ])
  for (const id of Object.values(IDS)) {
    const capability = matrix.capabilities.find((item) => item.id === id)
    assert.ok(capability, id)
    assert.equal(capability.primaryGate, 14, id)
    assert.ok(lock.capabilityIds.includes(id), id)
  }
})

test('every classified record cites its route file, names callers, required audit and dependency gates, and records no kernel authorization', () => {
  const args = fixture()
  for (const item of args.classification.operations.filter((candidate) => candidate.status === 'CLASSIFIED')) {
    assert.ok(entryOf(args, item.id)[2].startsWith('RULE-0B3-') || item.id === ALERTS, item.id)
    assert.ok(item.evidence.some((citation) => citation.ref === `apps/union-eyes/app/api/${item.route}`), item.id)
    assert.equal(item.kernelAuthorization, false, item.id)
    assert.ok(Array.isArray(item.callers), item.id)
    assert.ok(item.callerFinding.length > 20, item.id)
    assert.ok(item.requiredAudit.length > 15, item.id)
    assert.ok(Array.isArray(item.dependencyGates), item.id)
    assert.ok(Number.isInteger(item.requiredGate), item.id)
  }
  assert.ok(args.classification.operations.some((item) => item.callers.length > 0))
  assert.ok(args.classification.operations.some((item) => item.callers.length === 0 && item.callerFinding.startsWith('No caller')))
})

test('the 36 new defects each have one responsible capability that owns the repair gate and the earlier 40 are untouched', () => {
  const args = fixture()
  const added = args.classification.defectRegister.filter((defect) => defect.tranche === '0B.3')
  assert.equal(added.length, 36)
  assert.deepEqual([...new Set(added.map((defect) => defect.gate))].sort((a, b) => a - b), [4, 5, 13, 14])
  for (const defect of added) {
    assert.ok(args.capabilityById.has(defect.ownerCapabilityId), defect.id)
    assert.equal(args.capabilityById.get(defect.ownerCapabilityId).primaryGate, defect.gate, defect.id)
    assert.ok(args.classification.operations.some((item) => item.defects.includes(defect.id)), defect.id)
    assert.equal(defect.releaseBlocking, false)
  }
  assert.equal(args.classification.defectRegister.length, 76)
  assert.deepEqual(args.classification.defectRegister.slice(0, 40), base.classification0b2.defectRegister)
  const accepted = matrixAt(ACCEPTED['0B.3']).routeDefects
  assert.equal(accepted.length, 76, 'defects when Gate 0B.3 was accepted')
  const current = new Map(matrix.routeDefects.map((defect) => [defect.id, defect]))
  for (const defect of accepted) assert.deepEqual(current.get(defect.id), defect, `${defect.id} is unchanged in the current matrix`)
})

test('the Gate 0B.1 and Gate 0B.2 manifests and classifications are byte-identical to the accepted commit and the ledger only grows', () => {
  for (const file of [FILES_0B1.manifest, FILES_0B1.classification, FILES_0B2.manifest, FILES_0B2.classification]) assert.equal(readText(file), atAnchor(file), file)
  const args = fixture()
  const anchored = JSON.parse(atAnchor(FILES_0B1.ledger))
  for (const [id, owner] of Object.entries(anchored.classified)) assert.equal(args.ledger.classified[id], owner, id)
  for (const [id, tranche] of Object.entries(anchored.classifiedIn)) assert.equal(args.ledger.classifiedIn[id], tranche, id)
  for (const [id, owner] of Object.entries(args.ledger.classified)) {
    assert.equal(base.ledger0b1.classified[id], owner, `${id} keeps its owner in the current ledger`)
    assert.notEqual(base.ownership.entries.find((entry) => `${entry[0]}|${entry[1]}` === id)[4], 'SCOPE_UNDECIDED', `${id} is never reverted`)
  }
  assert.equal(Object.keys(args.ledger.classified).length, 81 + 99 + 99)
  assert.equal(args.ledger.tranches['GATE-0B.2'].operationsHash, anchored.tranches['GATE-0B.2'].operationsHash)
  for (const old of base.anchoredOwnershipEntries0b3.filter((entry) => entry[4] !== 'SCOPE_UNDECIDED')) {
    assert.notEqual(entryOf(args, `${old[0]}|${old[1]}`)[4], 'SCOPE_UNDECIDED')
  }
})

test('cumulative counts and the 1,644 operations are preserved', () => {
  const args = fixture()
  assert.equal(args.entries.length, 1644)
  assert.equal(args.entries.filter((entry) => entry[4] === 'OWNED').length, 634, 'owned operations when Gate 0B.3 was accepted')
  assert.equal(args.entries.filter((entry) => entry[4] === 'SCOPE_UNDECIDED').length, 873, 'undecided operations when Gate 0B.3 was accepted')
  assert.equal(countsAt(ACCEPTED['0B.3']).classified, 279)
  assert.equal(base.ownership.entries.length, 1644)
  assert.equal(matrix.routeOwnership.operations, 1644)
  assert.equal(matrix.capabilities.find((item) => item.schemaCensus === true).censusCount, 231)
})

test('Gate 0 stays IN_PROGRESS, validates the third tranche and keeps the three unjustified exposures release blocking', () => {
  const result = validateGate0(matrix)
  assert.deepEqual(result.problems, [])
  assert.equal(result.summary.verdict, 'IN_PROGRESS')
  assert.equal(result.summary.classification0b3.examined, 100)
  assert.equal(result.summary.classification0b3.classified, 99)
  assert.equal(result.summary.classification0b3.unresolved, 1)
  assert.equal(result.gateAcceptanceBlockers.filter((item) => item.kind === 'RELEASE_BLOCKING_ROUTE_EXPOSURE').length, 3)
  assert.ok(!result.blockers.some((item) => item.code === 'ROUTE_UNJUSTIFIED_EXPOSURE'))
  assert.deepEqual(fixture().classification.releaseBlockingExposures.map((item) => item.id).sort(), ['docs/openapi/route.ts|GET', 'docs/route.ts|GET', 'version/route.ts|GET'])
})

test('the matrix pins the Gate 0B.3 files and a changed file fails the pin', () => {
  const stale = clone(matrix)
  stale.routeClassification0b3.files.classification.sha256 = '0'.repeat(64)
  assert.ok(validateGate0(stale).problems.some((problem) => /CLASSIFICATION-PIN-HASH/.test(problem)))
  const absent = clone(matrix)
  delete absent.routeClassification0b3
  assert.ok(validateGate0(absent).problems.some((problem) => /CLASSIFICATION-PIN-ABSENT/.test(problem)))
  const drift = clone(matrix)
  drift.routeDefects[drift.routeDefects.length - 1].ownerCapabilityId = IDS.BARGAINING
  assert.ok(validateGate0(drift).problems.some((problem) => /ROUTE-DEFECT-DRIFT/.test(problem)))
  assert.equal(matrix.routeClassification0b3.files.manifest.file, FILES_0B3.manifest)
})

test('NEGATIVE 1: an operation cannot disappear from, or be added to, the frozen tranche', () => {
  const dropped = fixture()
  dropped.classification.operations = dropped.classification.operations.filter((item) => item.id !== AUDITS)
  assert.ok(hasProblem(run(dropped), /has no classification record/))
  const manifest = fixture()
  manifest.manifest.operations = manifest.manifest.operations.filter((id) => id !== AUDITS)
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
  assert.ok(hasProblem(run(dropped), /carry forward exactly 1|carry-forward operation .* was dropped|not exactly the operation Gate 0B.2 left unresolved/))
  const reexamined = fixture()
  reexamined.manifest0b2.operations = [...reexamined.manifest0b2.operations, reexamined.manifest.newOperations[0]]
  assert.ok(hasProblem(run(reexamined), /was already examined in an earlier tranche/))
  const anchor = fixture()
  anchor.manifest.anchorCommit = '0'.repeat(40)
  assert.ok(hasProblem(run(anchor), /anchor commit is not the recorded Gate 0B.2 commit/))
})

test('NEGATIVE 4: a Gate 0B.1 or Gate 0B.2 classification cannot be silently changed or reverted', () => {
  const reverted = fixture()
  const entry = entryOf(reverted, CRUD_ALERT_ANCHORED)
  entry[3] = UNDECIDED_OWNER
  entry[4] = 'SCOPE_UNDECIDED'
  const result = run(reverted)
  assert.ok(hasProblem(result, /silently reverted to SCOPE_UNDECIDED/))
  assert.ok(hasProblem(result, /was changed or reverted/))
  const owner = fixture()
  entryOf(owner, 'ai/search/route.ts|POST')[3] = IDS.BARGAINING
  assert.ok(hasProblem(run(owner), /was changed or reverted|changed owner/))
  const removed = fixture()
  delete removed.ledger.classified['ai/search/route.ts|POST']
  assert.ok(hasProblem(run(removed), /missing or changed in the ledger/))
})

test('NEGATIVE 5: an earlier defect cannot be dropped or altered, and a defect needs one owner that owns its repair gate', () => {
  const dropped = fixture()
  dropped.classification.defectRegister = dropped.classification.defectRegister.filter((defect) => defect.id !== 'DEF-0B2-AI-CLASSIFY-UNGUARDED')
  assert.ok(hasProblem(run(dropped), /earlier defect DEF-0B2-AI-CLASSIFY-UNGUARDED is missing/))
  const altered = fixture()
  altered.classification.defectRegister.find((defect) => defect.id === 'DEF-0B1-PKI-WORKFLOW-IN-MEMORY').severity = 'LOW'
  assert.ok(hasProblem(run(altered), /earlier defect DEF-0B1-PKI-WORKFLOW-IN-MEMORY was altered/))
  const gate = fixture()
  gate.classification.defectRegister.find((defect) => defect.tranche === '0B.3').gate = 3
  assert.ok(hasProblem(run(gate), /is repaired in gate 3 but/))
  const ownerless = fixture()
  ownerless.classification.defectRegister.find((defect) => defect.tranche === '0B.3').ownerCapabilityId = 'UE-CAP-NOPE'
  assert.ok(hasProblem(run(ownerless), /no responsible engineering capability/))
  const orphan = fixture()
  const first = orphan.classification.defectRegister.find((defect) => defect.tranche === '0B.3').id
  for (const item of orphan.classification.operations) item.defects = item.defects.filter((id) => id !== first)
  assert.ok(hasProblem(run(orphan), /is recorded but no classification cites it/))
})

test('NEGATIVE 6: a classification cannot cite source text that is not in the file or cite no source', () => {
  const quote = fixture()
  record(quote, AUDITS).evidence[1].quote = 'this text is nowhere in the route file'
  assert.ok(hasProblem(run(quote), /the quoted text is not in the file/))
  const none = fixture()
  record(none, AUDITS).evidence = []
  assert.ok(hasProblem(run(none), /has no source evidence/))
})

test('NEGATIVE 7: cross-tenant reachability is never authorization', () => {
  const authorized = fixture()
  record(authorized, CITATIONS_GET).crossTenantAuthorized = true
  assert.ok(hasProblem(run(authorized), /records it as authorized/))
  const hidden = fixture()
  record(hidden, CITATIONS_GET).exposureContract = ''
  assert.ok(hasProblem(run(hidden), /without an exposure contract/))
  const undefended = fixture()
  record(undefended, CITATIONS_GET).defects = []
  assert.ok(hasProblem(run(undefended), /without a recorded defect/))
  const granted = fixture()
  record(granted, AUDITS).accessJustifiedBy = ['UE-INST-AUDIT-HISTORY-READERS']
  assert.ok(hasProblem(run(granted), /no institutional authority decision is adopted/))
})

test('NEGATIVE 8: a role floor cannot be recorded as kernel authorization and no institutional decision can be adopted', () => {
  const kernel = fixture()
  const item = record(kernel, AUDITS)
  item.kernelAuthorization = true
  item.authorizationCategory = 'KERNEL_AUTHORITY'
  assert.ok(hasProblem(run(kernel), /claims kernel authorization but cites no kernel decision/))
  const flagged = fixture()
  record(flagged, KPIS_GET).kernelAuthorization = true
  assert.ok(hasProblem(run(flagged), /inconsistent about kernel authorization/))
  const adopted = fixture()
  adopted.classification.institutionalDecisions.find((decision) => decision.id === 'UE-INST-OBSERVABILITY-ALERT-OWNER').status = 'ADOPTED'
  assert.ok(hasProblem(run(adopted), /can record only outstanding decisions/))
  const altered = fixture()
  altered.classification.institutionalDecisions.find((decision) => decision.id === 'UE-INST-AUDIT-HISTORY-READERS').question = 'Altered question that no longer asks what the earlier tranche asked.'
  assert.ok(hasProblem(run(altered), /was altered or adopted/))
})

test('NEGATIVE 9: an atomic audit cannot be claimed by declaration, and a refused write cannot be recorded as audited', () => {
  const declared = fixture()
  record(declared, WEEKLY_SUMMARY).mutationAudit = 'ATOMIC_AUDIT_IN_TRANSACTION'
  record(declared, WEEKLY_SUMMARY).evidence = record(declared, WEEKLY_SUMMARY).evidence.filter((item) => !item.quote.includes('persistAtomicAudit'))
  assert.ok(hasProblem(run(declared), /atomically audited without citing an in-transaction audit write/))
  const local = fixture()
  record(local, WEEKLY_SUMMARY).manifestCorrections = []
  assert.ok(hasProblem(run(local), /audited atomically for its local part only and must correct the manifest/))
  const separate = fixture()
  record(separate, REPLAY_INVOICE).evidence = record(separate, REPLAY_INVOICE).evidence.filter((item) => !/auditLog|audit/i.test(item.quote))
  assert.ok(hasProblem(run(separate), /records a separate audit event without citing it|has no source evidence|the quoted text/))
  const refused = fixture()
  record(refused, BULK_IMPORT).mutationAudit = 'ATOMIC_AUDIT_IN_TRANSACTION'
  assert.ok(hasProblem(run(refused), /the generic route refuses the write, so it cannot be recorded as audited/))
})

test('NEGATIVE 10: a read recorded as not mutating cannot cite a write, and a mutating operation marked not mutating needs a reason', () => {
  const read = fixture()
  const item = record(read, KPIS_GET)
  item.evidence = [...item.evidence, { ref: 'apps/union-eyes/lib/api/crud-factory.ts', quote: 'tx.update(table)' }]
  assert.ok(hasProblem(run(read), /read method recorded as not mutating but cites a write/))
  const mutating = fixture()
  record(mutating, INSIGHTS_POST).mutationAudit = 'NOT_MUTATING'
  assert.ok(hasProblem(run(mutating), /marked not mutating without a reason|writes an OPERATIONAL table/))
})

test('NEGATIVE 11: a capability that does not cover the route business domain or rule is rejected', () => {
  const domain = fixture()
  record(domain, AUDITS).domain = 'PLATFORM_JOB_QUEUE'
  assert.ok(hasProblem(run(domain), /does not cover|belongs to/))
  const catchAll = fixture()
  record(catchAll, AUDITS).capabilityId = UNDECIDED_OWNER
  assert.ok(hasProblem(run(catchAll), /names an invalid capability/))
  const viaRule = fixture()
  entryOf(viaRule, AUDITS)[2] = 'RULE-DOMAIN-SCOPE-UNDECIDED'
  assert.ok(hasProblem(run(viaRule), /not a Gate 0B.3 business-evidence rule/))
})

test('NEGATIVE 12: callers must be real lines in real files and the caller finding must agree with the list', () => {
  const quote = fixture()
  const withCallers = quote.classification.operations.find((item) => item.callers.length > 0)
  withCallers.callers[0].quote = 'a line that no product file contains'
  assert.ok(hasProblem(run(quote), /cites a caller line that is not in/))
  const file = fixture()
  const another = file.classification.operations.find((item) => item.callers.length > 0)
  another.callers[0].ref = 'apps/union-eyes/does/not/exist.ts'
  assert.ok(hasProblem(run(file), /which does not exist/))
  const contradiction = fixture()
  const none = contradiction.classification.operations.find((item) => item.callers.length === 0)
  none.callerFinding = '3 call site(s) in product source name this route path.'
  assert.ok(hasProblem(run(contradiction), /lists no caller but its finding says one exists/))
  const missing = fixture()
  delete record(missing, AUDITS).callers
  assert.ok(hasProblem(run(missing), /is missing callers/))
})

test('NEGATIVE 13: required audit and dependency gates must be stated and valid', () => {
  const audit = fixture()
  record(audit, AUDITS).requiredAudit = ''
  assert.ok(hasProblem(run(audit), /states no required audit behavior/))
  const gates = fixture()
  record(gates, AUDITS).dependencyGates = [99]
  assert.ok(hasProblem(run(gates), /invalid dependency gate list/))
  const absent = fixture()
  delete record(absent, AUDITS).dependencyGates
  assert.ok(hasProblem(run(absent), /is missing dependencyGates/))
})

test('NEGATIVE 14: an unresolved operation must name its exact evidence gap and cannot be silently assigned', () => {
  const gap = fixture()
  record(gap, BATCH_STATUS).evidenceGap = ''
  assert.ok(hasProblem(run(gap), /unresolved without evidenceGap/))
  const waiting = fixture()
  record(waiting, BATCH_STATUS).institutionalDecisions = []
  assert.ok(hasProblem(run(waiting), /without naming the institutional decision/))
  const assigned = fixture()
  const entry = entryOf(assigned, BATCH_STATUS)
  entry[3] = IDS.PLATFORM_BILLING
  entry[4] = 'OWNED'
  assert.ok(hasProblem(run(assigned), /unresolved but the ownership register assigns it/))
  const guessed = fixture()
  record(guessed, ALERTS).status = 'UNRESOLVED'
  assert.ok(hasProblem(run(guessed), /is unresolved but is not a recorded evidence gap|is unresolved/))
})

test('NEGATIVE 15: a release-blocking exposure cannot lose its contract or its mark', () => {
  const lost = fixture()
  lost.classification.releaseBlockingExposures = lost.classification.releaseBlockingExposures.slice(1)
  assert.ok(hasProblem(run(lost), /is not preserved as a release-blocking defect/))
  const unmarked = fixture()
  unmarked.classification.defectRegister.find((defect) => defect.id === 'DEF-0B1-DOCS-UNAUTH-API-SURFACE').releaseBlocking = false
  assert.ok(hasProblem(run(unmarked), /was altered in the defect register|must be registered as release blocking/))
  const edited = fixture()
  edited.classification0b1.unauthenticated.find((item) => item.id === 'version/route.ts|GET').exposureContract = { weakened: true }
  assert.ok(hasProblem(run(edited), /no longer preserves its exposure contract/))
})

test('NEGATIVE 16: the classification summary cannot disagree with its records and the ledger must record every classification', () => {
  const summary = fixture()
  summary.classification.summary = { ...base.classification0b3.summary, classified: 98 }
  assert.ok(hasProblem(run(summary), /summary does not match its records/))
  const ledger = fixture()
  delete ledger.ledger.classified[AUDITS]
  assert.ok(hasProblem(run(ledger), /is not recorded in the classification ledger/))
  const tranche = fixture()
  delete tranche.ledger.tranches['GATE-0B.3']
  assert.ok(hasProblem(run(tranche), /does not record the GATE-0B.3 tranche/))
})

test('NEGATIVE 17: a member break route cannot claim an owner column it does not declare', () => {
  const args = fixture()
  const collection = record(args, BREAKS_POST)
  const item = record(args, BREAKS_ITEM_GET)
  assert.ok(collection.evidence.some((citation) => citation.quote === "ownerColumn: 'memberId',"))
  assert.ok(!item.evidence.some((citation) => citation.quote === "ownerColumn: 'memberId',"))
  assert.ok(!readText(`apps/union-eyes/app/api/${item.route}`).includes('ownerColumn'))
  const forged = fixture()
  record(forged, BREAKS_ITEM_GET).evidence.push({ ref: 'apps/union-eyes/app/api/breaks/[id]/route.ts', quote: "ownerColumn: 'memberId'," })
  assert.ok(hasProblem(run(forged), /the quoted text is not in the file/))
})
