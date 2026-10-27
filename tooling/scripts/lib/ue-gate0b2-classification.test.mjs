import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FILES, loadContext, validateGate0 } from './ue-gate0-scope-lock.mjs'
import { UNDECIDED_OWNER, routeKeys } from './ue-gate0-route-ownership.mjs'
import { FILES_0B1 } from './ue-gate0b1-classification.mjs'
import { FILES_0B2, validateClassification2 } from './ue-gate0b2-classification.mjs'
import { ANCHOR_COMMIT, CAPABILITY_IDS_0B2 as IDS } from './ue-gate0b2-groups.mjs'
import { ACCEPTED, countsAt, ledgerAt, matrixAt, ownershipEntriesAt } from './ue-gate0-history.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const base = loadContext(ROOT)
const matrix = JSON.parse(readFileSync(join(ROOT, FILES.matrix), 'utf8'))
const clone = (value) => JSON.parse(JSON.stringify(value))
const exists = (file) => existsSync(join(ROOT, file))
const readText = (file) => readFileSync(join(ROOT, file), 'utf8')
const atAnchor = (file) => execFileSync('git', ['show', `${ANCHOR_COMMIT}:${file}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const sha = (text) => createHash('sha256').update(text).digest('hex')

function fixture() {
  return {
    classification: clone(base.classification0b2),
    manifest: clone(base.tranche0b2),
    ledger: ledgerAt(ACCEPTED['0B.2']),
    classification0b1: clone(base.classification0b1),
    manifest0b1: clone(base.tranche0b1),
    entries: ownershipEntriesAt(ACCEPTED['0B.2']),
    capabilityById: new Map(matrix.capabilities.map((capability) => [capability.id, capability])),
    universe: new Set(routeKeys(base.routes)),
    exists,
    readText,
    anchoredEntries: clone(base.anchoredOwnershipEntries0b2),
  }
}

const run = (args) => validateClassification2(args)
const record = (args, id) => args.classification.operations.find((item) => item.id === id)
const entryOf = (args, id) => args.entries.find((entry) => `${entry[0]}|${entry[1]}` === id)
const hasProblem = (result, pattern) => result.problems.some((problem) => pattern.test(problem))

const SEARCH_POST = 'ai/search/route.ts|POST'
const INGEST_POST = 'ai/ingest/route.ts|POST'
const FINANCE_GET = 'ai/finance/analysis/route.ts|GET'
const ALERTS = 'alerts/realtime/route.ts|GET'
const UPDATE_ROLE_POST = 'admin/update-role/route.ts|POST'

const CARRY_OWNERS = {
  'activities/route.ts|GET': IDS.AUDIT_VISIBILITY,
  'admin/ai-usage/route.ts|GET': IDS.AI,
  'admin/database/health/route.ts|GET': IDS.OPERATOR,
  'admin/database/optimize/route.ts|POST': IDS.OPERATOR,
  'admin/feature-flags/route.ts|GET': IDS.OPERATOR,
  'admin/feature-flags/route.ts|PATCH': IDS.OPERATOR,
  'admin/jobs/[action]/route.ts|POST': IDS.OPERATOR,
  'admin/jobs/retry/route.ts|POST': IDS.OPERATOR,
  'admin/members/stats/route.ts|GET': IDS.ENUMERATION,
  'admin/organizations/route.ts|GET': IDS.ENUMERATION,
  'admin/pilot-status/route.ts|GET': IDS.OPERATOR,
  'admin/pki/signatures/[id]/sign/route.ts|POST': IDS.PKI,
  'admin/pki/signatures/[id]/verify/route.ts|POST': IDS.PKI,
  'admin/pki/workflows/[id]/route.ts|DELETE': IDS.PKI,
  'admin/pki/workflows/[id]/route.ts|GET': IDS.PKI,
  'admin/pki/workflows/[id]/route.ts|PUT': IDS.PKI,
  'admin/representation-protocol/route.ts|GET': IDS.PROTOCOL,
  'admin/representation-protocol/route.ts|POST': IDS.PROTOCOL,
  'admin/representation-protocol/route.ts|PUT': IDS.PROTOCOL,
}

test('the committed Gate 0B.2 registers validate against the live source', () => {
  const result = run(fixture())
  assert.deepEqual(result.problems, [])
  assert.deepEqual(result.summary, {
    tranche: 'GATE-0B.2',
    examined: 100,
    carriedForward: 19,
    newlyExamined: 81,
    classified: 99,
    unresolved: 1,
    carriedForwardResolved: 19,
    newDefects: 19,
    defectsTotal: 40,
    institutionalDecisions: 5,
    crossTenantExposures: 9,
  })
})

test('the tranche is the 19 carried-forward operations plus the next 81 undecided operations, frozen and hashed', () => {
  const { manifest } = fixture()
  assert.equal(manifest.operations.length, 100)
  assert.equal(manifest.carryForward.length, 19)
  assert.equal(manifest.newOperations.length, 81)
  assert.equal(manifest.anchorCommit, ANCHOR_COMMIT)
  assert.equal(manifest.version, 1)
  assert.equal(manifest.versionLog[0].operationsHash, manifest.operationsHash)
  assert.deepEqual([...manifest.operations], [...manifest.operations].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)))
  const unresolved0b1 = base.classification0b1.operations.filter((item) => item.status === 'UNRESOLVED').map((item) => item.id).sort()
  assert.deepEqual([...manifest.carryForward].sort(), unresolved0b1)
  const examined0b1 = new Set(base.tranche0b1.operations)
  assert.ok(manifest.newOperations.every((id) => !examined0b1.has(id)))
  const undecidedAtAnchor = base.anchoredOwnershipEntries0b2.filter((entry) => entry[4] === 'SCOPE_UNDECIDED').map((entry) => `${entry[0]}|${entry[1]}`)
  const held = new Set(manifest.carryForward)
  assert.deepEqual(manifest.newOperations, undecidedAtAnchor.filter((id) => !held.has(id)).sort().slice(0, 81))
})

test('the 19 carried-forward operations are each owned by a narrowly defined capability with evidence', () => {
  const args = fixture()
  assert.deepEqual(Object.keys(CARRY_OWNERS).sort(), [...args.manifest.carryForward].sort())
  for (const [id, owner] of Object.entries(CARRY_OWNERS)) {
    const item = record(args, id)
    assert.equal(item.status, 'CLASSIFIED', id)
    assert.equal(item.capabilityId, owner, id)
    assert.equal(item.carriedForwardFrom, 'GATE-0B.1', id)
    assert.equal(entryOf(args, id)[3], owner, id)
    assert.equal(entryOf(args, id)[4], 'OWNED', id)
    assert.notEqual(item.capabilityId, UNDECIDED_OWNER)
  }
})

test('only one operation stays undecided and it names its exact evidence gap and the decision it waits for', () => {
  const args = fixture()
  const unresolved = args.classification.operations.filter((item) => item.status === 'UNRESOLVED')
  assert.deepEqual(unresolved.map((item) => item.id), [ALERTS])
  assert.equal(unresolved[0].capabilityId, UNDECIDED_OWNER)
  assert.ok(unresolved[0].evidenceGap.length > 60)
  assert.deepEqual(unresolved[0].institutionalDecisions, ['UE-INST-OBSERVABILITY-ALERT-OWNER'])
  assert.equal(entryOf(args, ALERTS)[4], 'SCOPE_UNDECIDED', 'at acceptance of Gate 0B.2 the operation was still undecided')
  assert.equal(args.ledger.classifiedIn[ALERTS], undefined)
  assert.equal(base.ledger0b1.classifiedIn[ALERTS], 'GATE-0B.3', 'Gate 0B.3 later resolved the carry-forward operation and the current ledger records it')
  assert.equal(base.ownership.entries.find((entry) => `${entry[0]}|${entry[1]}` === ALERTS)[4], 'OWNED')
})

test('cumulative counts, the 1,644 operations, the schema census and the persona material are preserved', () => {
  const args = fixture()
  assert.equal(args.entries.length, 1644)
  assert.equal(args.entries.filter((entry) => entry[4] === 'OWNED').length, 535, 'owned operations when Gate 0B.2 was accepted')
  assert.equal(args.entries.filter((entry) => entry[4] === 'SCOPE_UNDECIDED').length, 972, 'undecided operations when Gate 0B.2 was accepted')
  assert.equal(countsAt(ACCEPTED['0B.2']).classified, 180)
  assert.equal(base.ownership.entries.length, 1644)
  assert.equal(matrix.routeOwnership.operations, 1644)
  assert.equal(matrix.capabilities.find((item) => item.schemaCensus === true).censusCount, 231)
  assert.equal(matrix.capabilities.find((item) => item.schemaCensus === true).individuallyReclassified, false)
  const anchoredMatrix = JSON.parse(atAnchor(FILES.matrix))
  assert.deepEqual(matrix.proposedPersonaBaselines, anchoredMatrix.proposedPersonaBaselines)
  assert.deepEqual(matrix.personaCompleteness, anchoredMatrix.personaCompleteness)
  assert.equal(matrix.capabilities.filter((item) => item.schemaCensus !== true && item.parentRegisterId === 'UE-CONV-H-007').length, 0)
  for (const file of Object.values(matrix.proposedPersonaBaselines.data).map((item) => item.file)) {
    assert.equal(sha(readText(file)), sha(atAnchor(file)), `${file} changed`)
  }
})

test('the Gate 0B.1 tranche manifest and classification are byte-identical to the accepted commit', () => {
  assert.equal(readText(FILES_0B1.manifest), atAnchor(FILES_0B1.manifest))
  assert.equal(readText(FILES_0B1.classification), atAnchor(FILES_0B1.classification))
})

test('every previously classified operation keeps its owner and the ledger only grows', () => {
  const args = fixture()
  const anchored = JSON.parse(atAnchor(FILES_0B1.ledger))
  for (const [id, owner] of Object.entries(anchored.classified)) assert.equal(args.ledger.classified[id], owner, id)
  assert.equal(args.ledger.tranches['GATE-0B.1'].operationsHash, anchored.tranches['GATE-0B.1'].operationsHash)
  assert.equal(Object.keys(args.ledger.classified).length, 81 + 99, 'ledger size when Gate 0B.2 was accepted')
  for (const old of base.anchoredOwnershipEntries0b2.filter((entry) => entry[4] !== 'SCOPE_UNDECIDED')) {
    assert.notEqual(entryOf(args, `${old[0]}|${old[1]}`)[4], 'SCOPE_UNDECIDED')
  }
  for (const [id, owner] of Object.entries(args.ledger.classified)) {
    assert.equal(base.ledger0b1.classified[id], owner, `${id} keeps its owner in the current ledger`)
    assert.notEqual(base.ownership.entries.find((entry) => `${entry[0]}|${entry[1]}` === id)[4], 'SCOPE_UNDECIDED', `${id} is never reverted`)
  }
})

test('every new classification is owned through a Gate 0B.2 rule, cites its route file and states the authorization actually applied', () => {
  const args = fixture()
  for (const item of args.classification.operations.filter((candidate) => candidate.status === 'CLASSIFIED')) {
    assert.ok(entryOf(args, item.id)[2].startsWith('RULE-0B2-'), item.id)
    assert.ok(item.evidence.some((citation) => citation.ref === `apps/union-eyes/app/api/${item.route}`), item.id)
    assert.equal(item.kernelAuthorization, false, `${item.id}: no route in this tranche is authorized by a kernel decision`)
    assert.ok(Array.isArray(item.institutionalDecisions), item.id)
    assert.ok(Number.isInteger(item.requiredGate), item.id)
  }
})

test('every new defect has exactly one responsible engineering capability that owns the repair gate', () => {
  const args = fixture()
  const added = args.classification.defectRegister.filter((defect) => defect.tranche === '0B.2')
  assert.equal(added.length, 19)
  for (const defect of added) {
    assert.ok(args.capabilityById.has(defect.ownerCapabilityId), defect.id)
    assert.equal(args.capabilityById.get(defect.ownerCapabilityId).primaryGate, defect.gate, defect.id)
    assert.ok(args.classification.operations.some((item) => item.defects.includes(defect.id)), defect.id)
  }
  const old = args.classification.defectRegister.filter((defect) => defect.tranche === '0B.1')
  assert.equal(old.length, 21)
  for (const defect of old) assert.ok(args.capabilityById.has(defect.ownerCapabilityId), defect.id)
})

test('the 21 Gate 0B.1 defects and the 19 new defects are in the engineering completion matrix with owners and gates', () => {
  const accepted = matrixAt(ACCEPTED['0B.2']).routeDefects
  assert.equal(accepted.length, 40, 'defects when Gate 0B.2 was accepted')
  const current = new Map(matrix.routeDefects.map((defect) => [defect.id, defect]))
  for (const defect of accepted) assert.deepEqual(current.get(defect.id), defect, `${defect.id} is unchanged in the current matrix`)
  for (const defect of matrix.routeDefects) {
    const owner = matrix.capabilities.find((item) => item.id === defect.ownerCapabilityId)
    assert.ok(owner, defect.id)
    assert.equal(owner.primaryGate, defect.gate, defect.id)
  }
})

test('the three unjustified public exposures stay Gate 14 release-blocking defects with their contracts preserved', () => {
  const args = fixture()
  assert.deepEqual(args.classification.releaseBlockingExposures.map((item) => item.id).sort(), ['docs/openapi/route.ts|GET', 'docs/route.ts|GET', 'version/route.ts|GET'])
  for (const item of args.classification.releaseBlockingExposures) assert.equal(item.ownerGate, 14)
  const blocking = args.classification.defectRegister.filter((defect) => defect.releaseBlocking)
  assert.deepEqual(blocking.map((defect) => defect.id).sort(), ['DEF-0B1-DOCS-UNAUTH-API-SURFACE', 'DEF-0B1-VERSION-UNAUTH-TOPOLOGY'])
  for (const defect of blocking) assert.equal(defect.gate, 14)
  const result = validateGate0(matrix)
  assert.deepEqual(result.problems, [])
  assert.ok(!result.blockers.some((item) => item.code === 'ROUTE_UNJUSTIFIED_EXPOSURE'))
  assert.equal(result.gateAcceptanceBlockers.filter((item) => item.kind === 'RELEASE_BLOCKING_ROUTE_EXPOSURE').length, 3)
  assert.equal(result.summary.verdict, 'IN_PROGRESS')
})

test('ownership is not authorization: role-floor operations record no kernel decision and cross-tenant reads are defects', () => {
  const args = fixture()
  const exposed = args.classification.operations.filter((item) => item.crossTenantExposure === true)
  assert.equal(exposed.length, 9)
  for (const item of exposed) {
    assert.equal(item.crossTenantAuthorized, false, item.id)
    assert.ok(item.defects.length > 0, item.id)
    assert.ok(item.exposureContract.length > 30, item.id)
  }
  assert.ok(args.classification.institutionalDecisions.every((decision) => decision.status === 'OUTSTANDING'))
  assert.ok(args.classification.operations.every((item) => item.accessJustifiedBy === undefined))
})

test('an operation that is only reachable because it is public cannot be recorded as cross-tenant authorized', () => {
  const args = fixture()
  record(args, SEARCH_POST).crossTenantAuthorized = true
  assert.ok(hasProblem(run(args), /records it as authorized/))
})

test('a public-row read that omits the cross-tenant exposure is rejected', () => {
  const args = fixture()
  delete record(args, SEARCH_POST).crossTenantExposure
  assert.ok(hasProblem(run(args), /does not record the cross-tenant exposure/))
})

test('an invented institutional authority decision cannot justify access', () => {
  const args = fixture()
  record(args, FINANCE_GET).accessJustifiedBy = ['UE-INST-PLATFORM-STAFF-MANDATE']
  assert.ok(hasProblem(run(args), /no institutional authority decision is adopted/))
  const adopted = fixture()
  adopted.classification.institutionalDecisions[0].status = 'ADOPTED'
  assert.ok(hasProblem(run(adopted), /can record only outstanding decisions/))
  const unknown = fixture()
  record(unknown, FINANCE_GET).institutionalDecisions = ['UE-INST-INVENTED']
  assert.ok(hasProblem(run(unknown), /unknown institutional decision/))
})

test('the generic catch-all owner is not a classification', () => {
  const args = fixture()
  record(args, FINANCE_GET).capabilityId = UNDECIDED_OWNER
  assert.ok(hasProblem(run(args), /names an invalid capability/))
  const viaRule = fixture()
  entryOf(viaRule, FINANCE_GET)[2] = 'RULE-DOMAIN-SCOPE-UNDECIDED'
  assert.ok(hasProblem(viaRule && run(viaRule), /not a Gate 0B.2 business-evidence rule/))
})

test('a capability that does not cover the route business domain is rejected', () => {
  const args = fixture()
  record(args, FINANCE_GET).domain = 'PLATFORM_JOB_QUEUE'
  assert.ok(hasProblem(run(args), /does not cover|belongs to/))
})

test('a role floor cannot be recorded as kernel authorization', () => {
  const args = fixture()
  const item = record(args, FINANCE_GET)
  item.kernelAuthorization = true
  item.authorizationCategory = 'KERNEL_AUTHORITY'
  const result = run(args)
  assert.ok(hasProblem(result, /claims kernel authorization but cites no kernel decision/))
  const flagged = fixture()
  record(flagged, FINANCE_GET).kernelAuthorization = true
  assert.ok(hasProblem(run(flagged), /inconsistent about kernel authorization/))
})

test('an atomic audit cannot be claimed by declaration', () => {
  const args = fixture()
  const item = record(args, INGEST_POST)
  item.mutationAudit = 'ATOMIC_AUDIT_IN_TRANSACTION'
  assert.ok(hasProblem(run(args), /atomically audited without citing an in-transaction audit write/))
  const dropped = fixture()
  record(dropped, INGEST_POST).manifestCorrections = []
  assert.ok(hasProblem(run(dropped), /declared atomically audited by the manifest but the source does not show it/))
})

test('a generic write on a read-only table cannot be recorded as audited', () => {
  const args = fixture()
  const item = record(args, UPDATE_ROLE_POST)
  item.mutationAudit = 'ATOMIC_AUDIT_IN_TRANSACTION'
  assert.ok(hasProblem(run(args), /the generic route refuses the write, so it cannot be recorded as audited/))
})

test('a GET that writes a row must say so and cite the write', () => {
  const args = fixture()
  record(args, 'ai/employers/[id]/risk/route.ts|GET').manifestCorrections = []
  assert.ok(hasProblem(run(args), /GET that writes a row and must correct the manifest/))
})

test('a mutating operation marked not mutating needs a reason', () => {
  const args = fixture()
  delete record(args, SEARCH_POST).nonMutationReason
  assert.ok(hasProblem(run(args), /marked not mutating without a reason/))
})

test('an operation cannot disappear from the frozen tranche', () => {
  const args = fixture()
  args.classification.operations = args.classification.operations.filter((item) => item.id !== FINANCE_GET)
  assert.ok(hasProblem(run(args), /has no classification record/))
  const manifest = fixture()
  manifest.manifest.operations = manifest.manifest.operations.filter((id) => id !== FINANCE_GET)
  const result = run(manifest)
  assert.ok(hasProblem(result, /exactly 100 operations/))
  assert.ok(hasProblem(result, /operationsHash/))
})

test('tranche membership cannot change silently', () => {
  const swapped = fixture()
  const outsider = swapped.entries.find((entry) => entry[4] === 'SCOPE_UNDECIDED' && !swapped.manifest.operations.includes(`${entry[0]}|${entry[1]}`))
  swapped.manifest.newOperations[0] = `${outsider[0]}|${outsider[1]}`
  assert.ok(hasProblem(run(swapped), /not the next 81 SCOPE_UNDECIDED operations|not the carry-forward operations plus the new operations/))
  const carry = fixture()
  carry.manifest.carryForward = carry.manifest.carryForward.slice(1)
  assert.ok(hasProblem(run(carry), /carry forward exactly 19|not exactly the operations Gate 0B.1 left unresolved/))
})

test('a Gate 0B.1 classification cannot be silently changed or reverted', () => {
  const owner = fixture()
  const crud = 'admin/alerts/rules/route.ts|POST'
  entryOf(owner, crud)[3] = IDS.AI
  assert.ok(hasProblem(run(owner), /Gate 0B.1 classification admin\/alerts\/rules\/route.ts\|POST was changed or reverted|changed owner/))
  const reverted = fixture()
  const entry = entryOf(reverted, crud)
  entry[3] = UNDECIDED_OWNER
  entry[4] = 'SCOPE_UNDECIDED'
  const result = run(reverted)
  assert.ok(hasProblem(result, /silently reverted to SCOPE_UNDECIDED/))
  assert.ok(hasProblem(result, /was changed or reverted/))
  const removed = fixture()
  delete removed.ledger.classified[crud]
  assert.ok(hasProblem(run(removed), /missing or changed in the ledger/))
})

test('a Gate 0B.1 defect cannot be dropped or altered', () => {
  const dropped = fixture()
  dropped.classification.defectRegister = dropped.classification.defectRegister.filter((defect) => defect.id !== 'DEF-0B1-PKI-WORKFLOW-IN-MEMORY')
  assert.ok(hasProblem(run(dropped), /Gate 0B.1 defect DEF-0B1-PKI-WORKFLOW-IN-MEMORY is missing/))
  const regated = fixture()
  regated.classification.defectRegister.find((defect) => defect.id === 'DEF-0B1-PKI-WORKFLOW-IN-MEMORY').gate = 14
  assert.ok(hasProblem(run(regated), /was altered in the defect register|owns gate/))
})

test('a defect needs a responsible capability that owns the repair gate and a citing classification', () => {
  const ownerless = fixture()
  ownerless.classification.defectRegister.find((defect) => defect.id === 'DEF-0B2-AI-CLASSIFY-UNGUARDED').ownerCapabilityId = 'UE-CAP-NOPE'
  assert.ok(hasProblem(run(ownerless), /no responsible engineering capability/))
  const gate = fixture()
  gate.classification.defectRegister.find((defect) => defect.id === 'DEF-0B2-AI-CLASSIFY-UNGUARDED').gate = 3
  assert.ok(hasProblem(run(gate), /is repaired in gate 3 but/))
  const orphan = fixture()
  for (const item of orphan.classification.operations) item.defects = item.defects.filter((id) => id !== 'DEF-0B2-AI-CLASSIFY-UNGUARDED')
  assert.ok(hasProblem(run(orphan), /is recorded but no classification cites it/))
})

test('a classification cannot cite source text that is not in the file', () => {
  const args = fixture()
  record(args, FINANCE_GET).evidence[1].quote = 'this text is nowhere in the route file'
  assert.ok(hasProblem(run(args), /the quoted text is not in the file/))
  const none = fixture()
  record(none, FINANCE_GET).evidence = []
  assert.ok(hasProblem(run(none), /has no source evidence/))
})

test('an unresolved operation must name its exact evidence gap and the decision it waits on', () => {
  const gap = fixture()
  record(gap, ALERTS).evidenceGap = ''
  assert.ok(hasProblem(run(gap), /unresolved without evidenceGap/))
  const assigned = fixture()
  delete assigned.ledger.classifiedIn[ALERTS]
  const entry = entryOf(assigned, ALERTS)
  entry[3] = IDS.AI
  entry[4] = 'OWNED'
  assert.ok(hasProblem(run(assigned), /unresolved but the ownership register assigns it/))
  const waiting = fixture()
  record(waiting, ALERTS).institutionalDecisions = []
  assert.ok(hasProblem(run(waiting), /without naming the institutional decision/))
})

test('a release-blocking exposure cannot lose its contract or its mark', () => {
  const lost = fixture()
  lost.classification.releaseBlockingExposures = lost.classification.releaseBlockingExposures.slice(1)
  assert.ok(hasProblem(run(lost), /is not preserved as a release-blocking defect/))
  const unmarked = fixture()
  unmarked.classification.defectRegister.find((defect) => defect.id === 'DEF-0B1-DOCS-UNAUTH-API-SURFACE').releaseBlocking = false
  assert.ok(hasProblem(run(unmarked), /must be registered as release blocking/))
  const edited = fixture()
  edited.classification0b1.unauthenticated.find((item) => item.id === 'version/route.ts|GET').exposureContract = { weakened: true }
  assert.ok(hasProblem(run(edited), /no longer preserves its exposure contract/))
})

test('end to end: a tampered Gate 0B.2 register fails the Gate 0 validator and an unregistered exposure returns as a blocker', () => {
  const classification = clone(base.classification0b2)
  classification.operations.find((item) => item.id === FINANCE_GET).evidence = []
  const tampered = validateGate0(matrix, { classification0b2: classification })
  assert.ok(tampered.problems.some((problem) => /has no source evidence/.test(problem)))
  const unregistered = clone(base.classification0b5)
  unregistered.releaseBlockingExposures = []
  const result = validateGate0(matrix, { classification0b5: unregistered })
  assert.ok(result.blockers.some((item) => item.code === 'ROUTE_UNJUSTIFIED_EXPOSURE'))
})

test('the matrix pins the Gate 0B.2 files and a changed file fails the pin', () => {
  const stale = clone(matrix)
  stale.routeClassification0b2.files.classification.sha256 = '0'.repeat(64)
  assert.ok(validateGate0(stale).problems.some((problem) => /CLASSIFICATION-PIN-HASH/.test(problem)))
  const drift = clone(matrix)
  drift.routeDefects[0].ownerCapabilityId = IDS.EXPOSURE
  assert.ok(validateGate0(drift).problems.some((problem) => /ROUTE-DEFECT-DRIFT/.test(problem)))
})
