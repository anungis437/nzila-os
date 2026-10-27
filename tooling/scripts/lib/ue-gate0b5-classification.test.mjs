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
import { FILES_0B5, NEW_CAPABILITY_IDS, UNRESOLVED_OPERATIONS, validateClassification5 } from './ue-gate0b5-classification.mjs'
import { ANCHOR_COMMIT, CAPABILITY_IDS_0B5 as IDS } from './ue-gate0b5-groups.mjs'
import { REUSED_CAPABILITY_IDS_0B5 as REUSED } from './ue-gate0b5-ids.mjs'
import { anchoredEntries } from './ue-gate0b5-build-classification.mjs'
import { ACCEPTED, countsAt, fileAt } from './ue-gate0-history.mjs'

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

function fixture() {
  return {
    classification: clone(base.classification0b5),
    manifest: clone(base.tranche0b5),
    ledger: clone(base.ledger0b1),
    classification0b1: clone(base.classification0b1),
    classification0b2: clone(base.classification0b2),
    classification0b3: clone(base.classification0b3),
    classification0b4: clone(base.classification0b4),
    manifest0b1: clone(base.tranche0b1),
    manifest0b2: clone(base.tranche0b2),
    manifest0b3: clone(base.tranche0b3),
    manifest0b4: clone(base.tranche0b4),
    entries: clone(base.ownership.entries),
    capabilityById: new Map(matrix.capabilities.map((capability) => [capability.id, capability])),
    universe: new Set(routeKeys(base.routes)),
    exists,
    readText,
    anchoredEntries: clone(base.anchoredOwnershipEntries0b5),
  }
}

const run = (args) => validateClassification5(args)
const record = (args, id) => args.classification.operations.find((item) => item.id === id)
const entryOf = (args, id) => args.entries.find((entry) => `${entry[0]}|${entry[1]}` === id)
const hasProblem = (result, pattern) => result.problems.some((problem) => pattern.test(problem))

const CARBON_DASHBOARD = 'carbon/dashboard/route.ts|GET'
const CARBON_INFRASTRUCTURE = 'carbon/infrastructure/route.ts|GET'
const CARBON_GET = 'carbon/validate/route.ts|GET'
const CARBON_POST = 'carbon/validate/route.ts|POST'
const FIRST_NEW = 'cnesst/pay-equity/[id]/route.ts|DELETE'
const LAST_NEW = 'communications/unsubscribe/[recipientId]/route.ts|GET'
const PAY_EQUITY_POST = 'cnesst/pay-equity/route.ts|POST'
const WITHDRAWAL_GET = 'cnesst/preventive-withdrawals/route.ts|GET'
const KPIS_GET = 'cognition/kpis/route.ts|GET'
const ENGAGEMENT_GET = 'cognition/engagement/route.ts|GET'
const HEALTH_GET = 'cognition/health/route.ts|GET'
const COMMITTEE_INTELLIGENCE_POST = 'committees/[id]/intelligence/route.ts|POST'
const COMMITTEE_MEETINGS_GET = 'committees/[id]/meetings/route.ts|GET'
const CAMPAIGN_POST = 'communications/campaigns/route.ts|POST'
const SEND_TEST_PATCH = 'communications/campaigns/[id]/send-test/route.ts|PATCH'
const SMS_POST = 'communications/sms/route.ts|POST'
const CLICK_GET = 'communications/track/click/route.ts|GET'
const OPEN_GET = 'communications/track/open/[campaignId]/[recipientId]/route.ts|GET'
const UNSUBSCRIBE_GET = LAST_NEW
const POLLS_POST = 'communications/polls/route.ts|POST'
const POLL_VOTE_POST = 'communications/polls/[pollId]/vote/route.ts|POST'
const SURVEY_RESPONSES_GET = 'communications/surveys/[surveyId]/responses/route.ts|GET'
const SURVEY_RESULTS_GET = 'communications/surveys/[surveyId]/results/route.ts|GET'
const EARLIER_CLASSIFIED = 'calendar-sync/connections/[id]/route.ts|GET'
const EARLIER_DEFECT = 'DEF-0B2-AI-CLASSIFY-UNGUARDED'

test('the committed Gate 0B.5 registers validate against the live source', () => {
  const result = run(fixture())
  assert.deepEqual(result.problems, [])
  assert.deepEqual(result.summary, {
    tranche: 'GATE-0B.5',
    examined: 100,
    carriedForward: 4,
    newlyExamined: 96,
    classified: 96,
    unresolved: 4,
    carriedForwardResolved: 0,
    scopeDispositions: 4,
    newDefects: 42,
    defectsTotal: 178,
    institutionalDecisions: 8,
    crossTenantExposures: 0,
    newCapabilities: 6,
  })
})

test('the tranche freezes the four carried-forward carbon operations and the next 96 unexamined operations at the Gate 0B.4 commit', () => {
  const args = fixture()
  assert.equal(args.manifest.size, 100)
  assert.equal(args.manifest.operations.length, 100)
  assert.deepEqual(args.manifest.carryForward, [CARBON_DASHBOARD, CARBON_INFRASTRUCTURE, CARBON_GET, CARBON_POST])
  assert.equal(args.manifest.newOperations.length, 96)
  assert.equal(args.manifest.anchorCommit, ACCEPTED['0B.4'])
  assert.equal(ANCHOR_COMMIT, ACCEPTED['0B.4'])
  assert.equal(args.manifest.carryForwardFrom, 'GATE-0B.4')
  assert.equal(args.manifest.newOperations[0], FIRST_NEW)
  assert.equal(args.manifest.newOperations[95], LAST_NEW)
  const examined = new Set([...args.manifest0b1.operations, ...args.manifest0b2.operations, ...args.manifest0b3.operations, ...args.manifest0b4.operations])
  for (const id of args.manifest.newOperations) assert.ok(!examined.has(id), id)
  const held = new Set(args.manifest.carryForward)
  const undecided = anchoredEntries().filter((entry) => entry[4] === 'SCOPE_UNDECIDED').map((entry) => `${entry[0]}|${entry[1]}`).filter((id) => !examined.has(id) && !held.has(id)).sort()
  assert.deepEqual(args.manifest.newOperations, undecided.slice(0, 96))
  assert.deepEqual(args.manifest.operations, [...args.manifest.carryForward, ...args.manifest.newOperations].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)))
})

test('the four carbon operations stay unresolved, owned by nobody, with the institutional decision outstanding', () => {
  const args = fixture()
  assert.deepEqual([...UNRESOLVED_OPERATIONS].sort(), [CARBON_DASHBOARD, CARBON_INFRASTRUCTURE, CARBON_GET, CARBON_POST].sort())
  for (const id of UNRESOLVED_OPERATIONS) {
    const item = record(args, id)
    assert.equal(item.status, 'UNRESOLVED', id)
    assert.equal(item.capabilityId, UNDECIDED_OWNER, id)
    assert.equal(item.domain, 'UNRESOLVED', id)
    assert.equal(item.carriedForwardFrom, 'GATE-0B.4', id)
    assert.ok(item.evidenceGap.length > 40, id)
    assert.deepEqual(item.institutionalDecisions, ['UE-INST-CARBON-ACCOUNTING-SCOPE'], id)
    assert.equal(entryOf(args, id)[4], 'SCOPE_UNDECIDED', id)
    assert.equal(entryOf(args, id)[3], UNDECIDED_OWNER, id)
    assert.ok(!(id in args.ledger.classified), id)
  }
  assert.equal(args.classification.institutionalDecisions.find((decision) => decision.id === 'UE-INST-CARBON-ACCOUNTING-SCOPE').status, 'OUTSTANDING')
  assert.ok(!matrix.capabilities.some((item) => /carbon/i.test(item.id)), 'no capability was created for the carbon routes')
})

test('each carbon operation records a scope disposition that lists options, adopts none and leaves a gate 8 implementation obligation', () => {
  const args = fixture()
  for (const id of UNRESOLVED_OPERATIONS) {
    const item = record(args, id)
    assert.equal(item.scopeDisposition.disposition, 'RETAIN_AS_UNAPPROVED_CAPABILITY_CANDIDATE', id)
    assert.equal(item.scopeDisposition.adopted, false, id)
    assert.equal(item.scopeDisposition.decisionId, 'UE-INST-CARBON-ACCOUNTING-SCOPE', id)
    assert.ok(item.scopeDisposition.options.length >= 2, id)
    assert.ok(item.scopeDisposition.options.every((option) => option.chosen === undefined && option.selected === undefined), id)
    assert.equal(item.implementationObligation.gate, 8, id)
    assert.equal(item.implementationObligation.capabilityId, REUSED.SCAFFOLD, id)
    assert.equal(args.capabilityById.get(REUSED.SCAFFOLD).primaryGate, 8)
    assert.match(item.implementationObligation.obligation, /501/, id)
    assert.equal(item.implementationObligation.closesInstitutionalDecision, false, id)
  }
  for (const item of args.classification.operations.filter((candidate) => candidate.status === 'CLASSIFIED')) {
    assert.equal(item.scopeDisposition, undefined, item.id)
    assert.equal(item.implementationObligation, undefined, item.id)
  }
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
    assert.equal(addition.tranche, 'GATE-0B.5', id)
    assert.equal(addition.operationsHash, base.tranche0b5.operationsHash, id)
    assert.equal(addition.classifiedOperations, base.classification0b5.operations.filter((item) => item.status === 'CLASSIFIED' && item.capabilityId === id).length, id)
    assert.ok(addition.classifiedOperations >= 1, id)
    assert.doesNotMatch(JSON.stringify(capability), /PROVEN_IN_STAGING|"status":"complete"|"delivered"/)
  }
  assert.deepEqual(Object.fromEntries(NEW_CAPABILITY_IDS.map((id) => [id, matrix.capabilities.find((item) => item.id === id).primaryGate])), {
    [IDS.PAY_EQUITY]: 6, [IDS.COMMITTEES]: 14, [IDS.CAMPAIGN_AUTHORING]: 11, [IDS.SMS]: 11, [IDS.CONSENT]: 11, [IDS.POLLS_SURVEYS]: 14,
  })
  assert.equal(matrix.capabilities.length, 80)
  assert.equal(lock.capabilityIds.length, 80)
  const owned = base.classification0b5.operations.filter((item) => item.status === 'CLASSIFIED').reduce((counts, item) => ({ ...counts, [item.capabilityId]: (counts[item.capabilityId] ?? 0) + 1 }), {})
  assert.deepEqual(owned, {
    [REUSED.OHS]: 10, [IDS.PAY_EQUITY]: 5, [REUSED.ANALYTICS]: 6, [REUSED.OPERATOR]: 1, [IDS.COMMITTEES]: 20, [IDS.CAMPAIGN_AUTHORING]: 29, [IDS.SMS]: 8, [IDS.CONSENT]: 3, [IDS.POLLS_SURVEYS]: 14,
  })
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
    if (item.status === 'CLASSIFIED') assert.ok(entryOf(args, item.id)[2].startsWith('RULE-0B5-'), item.id)
  }
  const kinds = new Set(args.classification.operations.flatMap((item) => item.evidence.map((evidence) => evidence.provenance)))
  assert.deepEqual([...kinds].sort(), ['ROUTE_HANDLER_DIRECT', 'ROUTE_IMPORTED_HELPER', 'SCHEMA_OR_POLICY', 'SERVICE_IMPLEMENTATION'])
})

test('the 42 new defects each have one responsible capability that owns the repair gate, are cited, and the earlier 136 are untouched', () => {
  const args = fixture()
  const added = args.classification.defectRegister.filter((defect) => defect.tranche === '0B.5')
  assert.equal(added.length, 42)
  for (const defect of added) {
    assert.ok(args.capabilityById.has(defect.ownerCapabilityId), defect.id)
    assert.equal(args.capabilityById.get(defect.ownerCapabilityId).primaryGate, defect.gate, defect.id)
    assert.ok(args.classification.operations.some((item) => item.defects.includes(defect.id)), defect.id)
    assert.equal(defect.releaseBlocking, false)
  }
  assert.equal(args.classification.defectRegister.length, 178)
  assert.deepEqual(args.classification.defectRegister.slice(0, 136), base.classification0b4.defectRegister)
  assert.equal(matrix.routeDefects.length, 178)
  const accepted = JSON.parse(fileAt(ACCEPTED['0B.4'], 'docs/union-eyes/convergence/register/ue-pre-vs-engineering-completion.json')).routeDefects
  assert.equal(accepted.length, 136)
  const current = new Map(matrix.routeDefects.map((defect) => [defect.id, defect]))
  for (const defect of accepted) assert.deepEqual(current.get(defect.id), defect, defect.id)
})

test('earlier tranche files are byte-identical to the accepted commits and the ledger only grows', () => {
  for (const [key, files] of [['0B.1', FILES_0B1], ['0B.2', FILES_0B2], ['0B.3', FILES_0B3], ['0B.4', FILES_0B4]]) {
    for (const file of [files.manifest, files.classification]) assert.equal(readText(file), fileAt(ACCEPTED[key], file), `${key} ${file}`)
  }
  const args = fixture()
  const anchored = JSON.parse(fileAt(ANCHOR_COMMIT, FILES_0B1.ledger))
  for (const [id, owner] of Object.entries(anchored.classified)) assert.equal(args.ledger.classified[id], owner, id)
  for (const [id, tranche] of Object.entries(anchored.classifiedIn)) assert.equal(args.ledger.classifiedIn[id], tranche, id)
  assert.equal(Object.keys(args.ledger.classified).length, 375 + 96)
  for (const key of ['GATE-0B.1', 'GATE-0B.2', 'GATE-0B.3', 'GATE-0B.4']) assert.equal(args.ledger.tranches[key].operationsHash, anchored.tranches[key].operationsHash)
  for (const old of base.anchoredOwnershipEntries0b5.filter((entry) => entry[4] !== 'SCOPE_UNDECIDED')) assert.notEqual(entryOf(args, `${old[0]}|${old[1]}`)[4], 'SCOPE_UNDECIDED')
})

test('cumulative counts advance by exactly the operations this tranche classified', () => {
  const before = countsAt(ACCEPTED['0B.4'])
  const args = fixture()
  const owned = args.entries.filter((entry) => entry[4] === 'OWNED').length
  const undecided = args.entries.filter((entry) => entry[4] === 'SCOPE_UNDECIDED').length
  assert.deepEqual(before, { operations: 1644, owned: 730, undecided: 777, classified: 375 })
  assert.equal(args.entries.length, 1644)
  assert.equal(owned, 730 + 96)
  assert.equal(undecided, 777 - 96)
  assert.equal(Object.keys(args.ledger.classified).length, before.classified + 96)
  assert.equal(matrix.routeOwnership.operations, 1644)
})

test('Gate 0 stays IN_PROGRESS, validates the fifth tranche and keeps the three unjustified exposures release blocking', () => {
  const result = validateGate0(matrix)
  assert.deepEqual(result.problems, [])
  assert.equal(result.summary.verdict, 'IN_PROGRESS')
  assert.equal(result.summary.classification0b5.examined, 100)
  assert.equal(result.summary.classification0b5.classified, 96)
  assert.equal(result.summary.classification0b5.unresolved, 4)
  assert.equal(result.gateAcceptanceBlockers.filter((item) => item.kind === 'RELEASE_BLOCKING_ROUTE_EXPOSURE').length, 3)
  assert.ok(!result.blockers.some((item) => item.code === 'ROUTE_UNJUSTIFIED_EXPOSURE'))
})

test('the pay equity routes leave the health and safety capability, and the committee placeholder is a scaffold defect owned by gate 8', () => {
  const args = fixture()
  assert.equal(record(args, PAY_EQUITY_POST).capabilityId, IDS.PAY_EQUITY)
  assert.equal(record(args, WITHDRAWAL_GET).capabilityId, REUSED.OHS)
  const placeholder = record(args, COMMITTEE_INTELLIGENCE_POST)
  assert.equal(placeholder.implementationStatus, 'NOT_IMPLEMENTED_RETURNS_200')
  assert.equal(placeholder.capabilityId, IDS.COMMITTEES)
  const defect = args.classification.defectRegister.find((item) => item.id === 'DEF-0B5-COMMITTEE-INTELLIGENCE-PLACEHOLDER-RETURNED-AS-RESULT')
  assert.equal(defect.ownerCapabilityId, REUSED.SCAFFOLD)
  assert.equal(defect.gate, 8)
  assert.ok(placeholder.defects.includes(defect.id))
})

test('cognition reads that write local files are not read-only, the engagement route is a 200 placeholder and the health route is platform posture', () => {
  const args = fixture()
  const kpis = record(args, KPIS_GET)
  assert.equal(kpis.mutationAudit, 'SEPARATE_AUDIT_EVENT_NOT_ATOMIC')
  assert.ok(kpis.manifestCorrections.some((item) => item.field === 'mutating'))
  assert.ok(kpis.evidence.some((item) => /writeFileSync|writeRecord\(/.test(item.quote)))
  assert.equal(record(args, ENGAGEMENT_GET).implementationStatus, 'NOT_IMPLEMENTED_RETURNS_200')
  const health = record(args, HEALTH_GET)
  assert.equal(health.capabilityId, REUSED.OPERATOR)
  assert.equal(args.classification.defectRegister.find((item) => item.id === 'DEF-0B5-COGNITION-HEALTH-PLATFORM-POSTURE-TO-ORG-OFFICER').gate, 9)
  assert.equal(args.classification.defectRegister.find((item) => item.id === 'DEF-0B5-COGNITION-SNAPSHOTS-IN-LOCAL-FILES').severity, 'HIGH')
})

test('the tracking and unsubscribe GETs are external trust, change state without an audit record, and correct the manifest', () => {
  const args = fixture()
  for (const id of [CLICK_GET, OPEN_GET, UNSUBSCRIBE_GET]) {
    const item = record(args, id)
    assert.equal(item.authorizationCategory, 'EXTERNAL_TRUST', id)
    assert.equal(item.mutationAudit, 'NONE', id)
    assert.equal(item.capabilityId, IDS.CONSENT, id)
    assert.ok(item.manifestCorrections.some((correction) => correction.field === 'mutating'), id)
    assert.ok(item.defects.includes('DEF-0B1-COMMS-TRACKING-GET-MUTATES'), id)
  }
  assert.equal(record(args, UNSUBSCRIBE_GET).defects.length, 4)
})

test('polls cannot run, the SMS create sends nothing, and survey responses identify respondents', () => {
  const args = fixture()
  for (const id of [POLLS_POST, POLL_VOTE_POST]) {
    assert.equal(record(args, id).mutationAudit, 'WRITE_REFUSED_BY_GOVERNANCE', id)
    assert.equal(record(args, id).implementationStatus, 'LATENT_NOT_OPERATIONAL', id)
  }
  assert.ok(record(args, SMS_POST).defects.includes('DEF-0B5-SMS-ROWS-WRITTEN-WITHOUT-SENDING'))
  assert.ok(record(args, SEND_TEST_PATCH).defects.includes('DEF-0B5-COMMS-ACTION-ROUTE-IS-GENERIC-CAMPAIGN-CRUD'))
  assert.equal(record(args, SEND_TEST_PATCH).implementationStatus, 'FACADE_OVER_GENERIC_TABLE')
  const high = args.classification.defectRegister.filter((defect) => defect.tranche === '0B.5' && defect.severity === 'HIGH').map((defect) => defect.id).sort()
  assert.deepEqual(high, ['DEF-0B5-COGNITION-SNAPSHOTS-IN-LOCAL-FILES', 'DEF-0B5-SURVEY-RESPONSES-IDENTIFY-RESPONDENTS-TO-STEWARDS', 'DEF-0B5-SURVEY-RESULTS-NO-ORG-PREDICATE-LOADS-ALL-ANSWERS', 'DEF-0B5-OHS-WITHDRAWAL-REFUSAL-NO-CASE-AUTHORITY'].sort())
  assert.ok(record(args, SURVEY_RESPONSES_GET).defects.includes('DEF-0B5-SURVEY-RESPONSES-IDENTIFY-RESPONDENTS-TO-STEWARDS'))
  assert.ok(record(args, SURVEY_RESULTS_GET).defects.includes('DEF-0B5-SURVEY-RESULTS-NO-ORG-PREDICATE-LOADS-ALL-ANSWERS'))
})

test('NEGATIVE 1: an operation cannot disappear from, or be added to, the frozen tranche', () => {
  const dropped = fixture()
  dropped.classification.operations = dropped.classification.operations.filter((item) => item.id !== COMMITTEE_MEETINGS_GET)
  assert.ok(hasProblem(run(dropped), /has no classification record/))
  const manifest = fixture()
  manifest.manifest.operations = manifest.manifest.operations.filter((id) => id !== COMMITTEE_MEETINGS_GET)
  const result = run(manifest)
  assert.ok(hasProblem(result, /exactly 100 operations/))
  assert.ok(hasProblem(result, /operationsHash/))
  const extra = fixture()
  extra.manifest.operations = [...extra.manifest.operations, 'zzz/route.ts|GET']
  assert.ok(hasProblem(run(extra), /exactly 100 operations|does not exist in the route-method universe/))
  const stray = fixture()
  stray.classification.operations.push({ ...clone(record(stray, COMMITTEE_MEETINGS_GET)), id: 'zzz/route.ts|GET' })
  assert.ok(hasProblem(run(stray), /is not in the frozen tranche/))
})

test('NEGATIVE 2: tranche membership or order cannot change without a new version and reason', () => {
  const swapped = fixture()
  const outsider = swapped.entries.find((entry) => entry[4] === 'SCOPE_UNDECIDED' && !swapped.manifest.operations.includes(`${entry[0]}|${entry[1]}`))
  swapped.manifest.newOperations[0] = `${outsider[0]}|${outsider[1]}`
  assert.ok(hasProblem(run(swapped), /not the next 96 SCOPE_UNDECIDED operations|not the carry-forward operations plus the new operations/))
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
  ledger.ledger.tranches['GATE-0B.5'].operationsHash = '0'.repeat(64)
  assert.ok(hasProblem(run(ledger), /changed without a new versioned reason/))
})

test('NEGATIVE 3: no carry-forward operation can be dropped, and an already-examined operation cannot be re-examined', () => {
  const dropped = fixture()
  dropped.manifest.carryForward = dropped.manifest.carryForward.filter((id) => id !== CARBON_POST)
  assert.ok(hasProblem(run(dropped), /carry forward exactly 4|carry-forward operation .* was dropped|not exactly the operations Gate 0B.4 left unresolved/))
  const reexamined = fixture()
  reexamined.manifest0b4.operations = [...reexamined.manifest0b4.operations, reexamined.manifest.newOperations[0]]
  assert.ok(hasProblem(run(reexamined), /was already examined in an earlier tranche/))
  const anchor = fixture()
  anchor.manifest.anchorCommit = '0'.repeat(40)
  assert.ok(hasProblem(run(anchor), /anchor commit is not the recorded Gate 0B.4 commit/))
  const forgotten = fixture()
  delete record(forgotten, CARBON_POST).carriedForwardFrom
  assert.ok(hasProblem(run(forgotten), /is carried forward but does not record GATE-0B.4/))
})

test('NEGATIVE 4: a carbon operation cannot be classified, owned or reduced out of the undecided count without new evidence', () => {
  const classified = fixture()
  record(classified, CARBON_POST).status = 'CLASSIFIED'
  const classifiedResult = run(classified)
  assert.ok(hasProblem(classifiedResult, /recorded evidence gap carbon\/validate\/route.ts\|POST was classified without new evidence/))
  assert.ok(hasProblem(classifiedResult, /is classified but the ownership register still records SCOPE_UNDECIDED/))
  const assigned = fixture()
  const entry = entryOf(assigned, CARBON_DASHBOARD)
  entry[3] = IDS.CAMPAIGN_AUTHORING
  entry[4] = 'OWNED'
  const result = run(assigned)
  assert.ok(hasProblem(result, /unresolved but the ownership register assigns it/))
  assert.ok(hasProblem(result, /no longer records SCOPE_UNDECIDED in the ownership register/))
  const dropped = fixture()
  dropped.classification.operations = dropped.classification.operations.filter((item) => item.id !== CARBON_INFRASTRUCTURE)
  assert.ok(hasProblem(run(dropped), /has no classification record/))
  const guessed = fixture()
  record(guessed, COMMITTEE_MEETINGS_GET).status = 'UNRESOLVED'
  const guessedResult = run(guessed)
  assert.ok(hasProblem(guessedResult, /is unresolved but the ownership register assigns it/))
  assert.ok(hasProblem(guessedResult, /is unresolved but is not a recorded evidence gap/))
  const waiting = fixture()
  record(waiting, CARBON_POST).institutionalDecisions = []
  assert.ok(hasProblem(run(waiting), /without naming the institutional decision/))
  const gap = fixture()
  record(gap, CARBON_GET).evidenceGap = ''
  assert.ok(hasProblem(run(gap), /unresolved without evidenceGap/))
})

test('NEGATIVE 5: a scope disposition cannot be missing, adopted, chosen, mis-cited or detached from its gate 8 obligation', () => {
  const missing = fixture()
  delete record(missing, CARBON_POST).scopeDisposition
  assert.ok(hasProblem(run(missing), /is unresolved but records no scope disposition/))
  const adopted = fixture()
  record(adopted, CARBON_POST).scopeDisposition.adopted = true
  assert.ok(hasProblem(run(adopted), /scope disposition is marked adopted/))
  const kind = fixture()
  record(kind, CARBON_POST).scopeDisposition.disposition = 'PLACE_UNDER_PLATFORM_OPERATOR'
  assert.ok(hasProblem(run(kind), /scope disposition is PLACE_UNDER_PLATFORM_OPERATOR, not RETAIN_AS_UNAPPROVED_CAPABILITY_CANDIDATE/))
  const chosen = fixture()
  record(chosen, CARBON_POST).scopeDisposition.options[0].chosen = true
  assert.ok(hasProblem(run(chosen), /is marked chosen; no option is chosen/))
  const single = fixture()
  record(single, CARBON_POST).scopeDisposition.options = record(single, CARBON_POST).scopeDisposition.options.slice(0, 1)
  assert.ok(hasProblem(run(single), /must list at least two options/))
  const decision = fixture()
  record(decision, CARBON_POST).scopeDisposition.decisionId = 'UE-INST-PLATFORM-STAFF-MANDATE'
  assert.ok(hasProblem(run(decision), /does not cite the outstanding decision UE-INST-CARBON-ACCOUNTING-SCOPE/))
  const wording = fixture()
  record(wording, CARBON_POST).scopeDisposition.summary = 'The institution approved platform ownership of carbon accounting and the routes stay under the platform operator capability.'
  assert.ok(hasProblem(run(wording), /uses adoption wording/))
  const access = fixture()
  delete record(access, CARBON_POST).scopeDisposition.neitherOptionJustifiesAccess
  assert.ok(hasProblem(run(access), /does not state that no option justifies access/))
  const granted = fixture()
  record(granted, CARBON_POST).accessJustifiedBy = ['UE-INST-CARBON-ACCOUNTING-SCOPE']
  assert.ok(hasProblem(run(granted), /no institutional authority decision is adopted/))
  const classifiedWith = fixture()
  record(classifiedWith, COMMITTEE_MEETINGS_GET).scopeDisposition = clone(record(classifiedWith, CARBON_POST).scopeDisposition)
  assert.ok(hasProblem(run(classifiedWith), /is classified but carries a scope disposition/))
})

test('NEGATIVE 6: the gate 8 implementation obligation must be held by the scaffold capability, name gate 8 and require a 501', () => {
  const none = fixture()
  delete record(none, CARBON_DASHBOARD).implementationObligation
  assert.ok(hasProblem(run(none), /records no implementation obligation/))
  const holder = fixture()
  record(holder, CARBON_DASHBOARD).implementationObligation.capabilityId = IDS.COMMITTEES
  assert.ok(hasProblem(run(holder), /is not held by UE-CAP-H-001/))
  const gate = fixture()
  record(gate, CARBON_DASHBOARD).implementationObligation.gate = 11
  const gateResult = run(gate)
  assert.ok(hasProblem(gateResult, /is not the primary gate of UE-CAP-H-001/))
  assert.ok(hasProblem(gateResult, /must name gate 8/))
  const plain = fixture()
  record(plain, CARBON_DASHBOARD).implementationObligation.obligation = 'Return the figures once the institution decides who owns carbon accounting.'
  assert.ok(hasProblem(run(plain), /does not require a 501 until a measured source exists/))
  const closes = fixture()
  record(closes, CARBON_DASHBOARD).implementationObligation.closesInstitutionalDecision = true
  assert.ok(hasProblem(run(closes), /claims to close the institutional decision/))
})

test('NEGATIVE 7: no institutional decision can be adopted, altered, dropped or stripped of a software owner', () => {
  const adopted = fixture()
  adopted.classification.institutionalDecisions.find((decision) => decision.id === 'UE-INST-CARBON-ACCOUNTING-SCOPE').status = 'ADOPTED'
  assert.ok(hasProblem(run(adopted), /can record only outstanding decisions/))
  const altered = fixture()
  altered.classification.institutionalDecisions.find((decision) => decision.id === 'UE-INST-AUDIT-HISTORY-READERS').question = 'Altered question that no longer asks what the earlier tranche asked.'
  assert.ok(hasProblem(run(altered), /was altered or adopted/))
  const dropped = fixture()
  dropped.classification.institutionalDecisions = dropped.classification.institutionalDecisions.filter((decision) => decision.id !== 'UE-INST-CARBON-ACCOUNTING-SCOPE')
  const droppedResult = run(dropped)
  assert.ok(hasProblem(droppedResult, /recorded by an earlier tranche is missing/))
  assert.ok(hasProblem(droppedResult, /must stay outstanding/))
  const owners = fixture()
  owners.classification.institutionalDecisions.find((decision) => decision.id === 'UE-INST-PLATFORM-STAFF-MANDATE').softwareOwners = []
  assert.ok(hasProblem(run(owners), /lost a software owner recorded by an earlier tranche/))
  const unknown = fixture()
  record(unknown, COMMITTEE_MEETINGS_GET).institutionalDecisions = ['UE-INST-NOT-RECORDED']
  assert.ok(hasProblem(run(unknown), /cites unknown institutional decision UE-INST-NOT-RECORDED/))
})

test('NEGATIVE 8: an earlier defect cannot be dropped or altered, and a defect needs one owner that owns its repair gate and a citing record', () => {
  const dropped = fixture()
  dropped.classification.defectRegister = dropped.classification.defectRegister.filter((defect) => defect.id !== EARLIER_DEFECT)
  assert.ok(hasProblem(run(dropped), new RegExp(`earlier defect ${EARLIER_DEFECT} is missing`)))
  const altered = fixture()
  altered.classification.defectRegister.find((defect) => defect.tranche === '0B.4').severity = 'LOW'
  assert.ok(hasProblem(run(altered), /earlier defect .* was altered/))
  const gate = fixture()
  gate.classification.defectRegister.find((defect) => defect.tranche === '0B.5').gate = 3
  assert.ok(hasProblem(run(gate), /is repaired in gate 3 but/))
  const ownerless = fixture()
  ownerless.classification.defectRegister.find((defect) => defect.tranche === '0B.5').ownerCapabilityId = 'UE-CAP-NOPE'
  assert.ok(hasProblem(run(ownerless), /no responsible engineering capability/))
  const orphan = fixture()
  const first = orphan.classification.defectRegister.find((defect) => defect.tranche === '0B.5').id
  for (const item of orphan.classification.operations) item.defects = item.defects.filter((id) => id !== first)
  assert.ok(hasProblem(run(orphan), /is recorded but no classification cites it/))
  const stray = fixture()
  stray.classification.defectRegister.find((defect) => defect.tranche === '0B.5').tranche = '0B.9'
  assert.ok(hasProblem(run(stray), /does not record the tranche that found it/))
  const unknown = fixture()
  record(unknown, COMMITTEE_MEETINGS_GET).defects = ['DEF-0B5-NOT-IN-THE-REGISTER']
  assert.ok(hasProblem(run(unknown), /DEF-0B5-NOT-IN-THE-REGISTER/))
})

test('NEGATIVE 9: a classification cannot cite source text that is not in the file, cite no source, or cite a quote without provenance', () => {
  const quote = fixture()
  record(quote, COMMITTEE_MEETINGS_GET).evidence[0].quote = 'this text is nowhere in the route file'
  assert.ok(hasProblem(run(quote), /the quoted text is not in the file/))
  const none = fixture()
  record(none, COMMITTEE_MEETINGS_GET).evidence = []
  assert.ok(hasProblem(run(none), /has no source evidence|without non-inference evidence/))
  const bare = fixture()
  delete record(bare, COMMITTEE_MEETINGS_GET).evidence[0].provenance
  assert.ok(hasProblem(run(bare), /without a valid provenance/))
})

test('NEGATIVE 10: a quote that belongs to a sibling method or sibling route is not evidence for the classified operation', () => {
  const route = 'apps/union-eyes/app/api/communications/campaigns/route.ts'
  const method = fixture()
  record(method, 'communications/campaigns/route.ts|GET').evidence.push({ provenance: 'ROUTE_HANDLER_DIRECT', claim: 'audit', method: 'GET', ref: route, quote: record(method, CAMPAIGN_POST).evidence.find((item) => /persistAtomicAudit/.test(item.quote))?.quote ?? 'persistAtomicAudit' })
  assert.ok(hasProblem(run(method), /the quote is not inside the GET handler of the route|is not in the file|not inside the GET handler/))
  const retagged = fixture()
  record(retagged, 'communications/campaigns/route.ts|GET').evidence.push({ provenance: 'ROUTE_HANDLER_DIRECT', claim: 'behavior', method: 'POST', ref: route, quote: record(retagged, CAMPAIGN_POST).evidence[0].quote })
  assert.ok(hasProblem(run(retagged), /is tagged for POST but the record is GET/))
  const sibling = fixture()
  record(sibling, COMMITTEE_MEETINGS_GET).evidence.push({
    provenance: 'ROUTE_HANDLER_DIRECT', claim: 'behavior', method: 'GET', ref: 'apps/union-eyes/app/api/committees/route.ts', quote: record(sibling, 'committees/route.ts|GET').evidence[0].quote,
  })
  assert.ok(hasProblem(run(sibling), /is not the classified route file/))
})

test('NEGATIVE 11: an authentication or authorization claim cannot rest on an inference', () => {
  const inferred = fixture()
  const item = record(inferred, COMMITTEE_MEETINGS_GET)
  item.evidence = item.evidence.filter((evidence) => evidence.claim !== 'authentication')
  item.inferences = [{ claim: 'authentication', statement: 'The wrapper presumably authenticates every caller before the handler runs.' }]
  const result = run(inferred)
  assert.ok(hasProblem(result, /makes the authentication claim without non-inference evidence/))
  assert.ok(hasProblem(result, /rests the authentication claim on an inference/))
  const missing = fixture()
  delete record(missing, COMMITTEE_MEETINGS_GET).inferences
  assert.ok(hasProblem(run(missing), /is missing inferences/))
})

test('NEGATIVE 12: a role floor cannot be recorded as kernel authorization and cross-tenant reachability is never authorization', () => {
  const kernel = fixture()
  const item = record(kernel, COMMITTEE_MEETINGS_GET)
  item.kernelAuthorization = true
  item.authorizationCategory = 'KERNEL_AUTHORITY'
  assert.ok(hasProblem(run(kernel), /claims kernel authorization but cites no kernel decision/))
  const flagged = fixture()
  record(flagged, SURVEY_RESULTS_GET).kernelAuthorization = true
  assert.ok(hasProblem(run(flagged), /inconsistent about kernel authorization/))
  const authorized = fixture()
  record(authorized, SURVEY_RESULTS_GET).crossTenantAuthorized = true
  assert.ok(hasProblem(run(authorized), /records cross-tenant access as authorized/))
  const granted = fixture()
  record(granted, SURVEY_RESULTS_GET).accessJustifiedBy = ['UE-INST-COMMUNICATIONS-CAMPAIGN-OWNER']
  assert.ok(hasProblem(run(granted), /no institutional authority decision is adopted/))
})

test('NEGATIVE 13: an atomic audit cannot be claimed by declaration, and a read cannot cite a write or hide one', () => {
  const declared = fixture()
  const item = record(declared, PAY_EQUITY_POST)
  item.evidence = item.evidence.filter((evidence) => evidence.claim !== 'audit')
  const declaredResult = run(declared)
  assert.ok(hasProblem(declaredResult, /is marked atomically audited without citing an in-transaction audit write/))
  assert.ok(hasProblem(declaredResult, /makes the audit claim without non-inference evidence/))
  const read = fixture()
  record(read, COMMITTEE_MEETINGS_GET).mutationAudit = 'ATOMIC_AUDIT_IN_TRANSACTION'
  assert.ok(hasProblem(run(read), /is a read method but records a mutation obligation/))
  const silent = fixture()
  record(silent, PAY_EQUITY_POST).mutationAudit = 'NOT_MUTATING'
  const silentResult = run(silent)
  assert.ok(hasProblem(silentResult, /is POST but is marked not mutating without a reason/))
  assert.ok(hasProblem(silentResult, /writes an OPERATIONAL table through the factory, which audits atomically/))
  const local = fixture()
  record(local, KPIS_GET).mutationAudit = 'NOT_MUTATING'
  assert.ok(hasProblem(run(local), /is a read method recorded as not mutating but cites a write/))
  const uncorrected = fixture()
  record(uncorrected, KPIS_GET).manifestCorrections = []
  assert.ok(hasProblem(run(uncorrected), /is a GET that writes a row and must correct the manifest read-only classification/))
  const unseparated = fixture()
  record(unseparated, KPIS_GET).evidence = record(unseparated, KPIS_GET).evidence.filter((evidence) => !/auditAiInteraction|auditAIInvocation|auditLog|logApiAuditEvent/.test(evidence.quote))
  assert.ok(hasProblem(run(unseparated), /records a separate audit event without citing it/))
})

test('NEGATIVE 14: a tracking GET that writes without an audit record must cite the write, correct the manifest and record a defect', () => {
  const noWrite = fixture()
  const item = record(noWrite, CLICK_GET)
  item.evidence = item.evidence.filter((evidence) => !/\.insert\(|\.update\(|\.delete\(/.test(evidence.quote))
  assert.ok(hasProblem(run(noWrite), /is a read that writes with no audit record but cites no write/))
  const uncorrected = fixture()
  record(uncorrected, OPEN_GET).manifestCorrections = []
  assert.ok(hasProblem(run(uncorrected), /is a GET that writes a row and must correct the manifest read-only classification/))
  const undefended = fixture()
  record(undefended, UNSUBSCRIBE_GET).defects = []
  assert.ok(hasProblem(run(undefended), /is a GET that writes with no audit record and must record a defect/))
  const atomic = fixture()
  record(atomic, UNSUBSCRIBE_GET).mutationAudit = 'ATOMIC_AUDIT_IN_TRANSACTION'
  assert.ok(hasProblem(run(atomic), /is a read method but records a mutation obligation/))
})

test('NEGATIVE 15: a table the CRUD governance refuses cannot be recorded as audited, and one it allows cannot be recorded as refused', () => {
  const refused = fixture()
  record(refused, POLLS_POST).mutationAudit = 'ATOMIC_AUDIT_IN_TRANSACTION'
  const refusedResult = run(refused)
  assert.ok(hasProblem(refusedResult, /writes polls, which is READ_ONLY: the generic route refuses the write, so it cannot be recorded as audited/))
  assert.ok(hasProblem(refusedResult, /is marked atomically audited without citing an in-transaction audit write/))
  const denied = fixture()
  record(denied, POLL_VOTE_POST).mutationAudit = 'ATOMIC_AUDIT_IN_TRANSACTION'
  assert.ok(hasProblem(run(denied), /writes poll_votes, which is DENIED: the generic route refuses the write/))
  const allowed = fixture()
  record(allowed, SMS_POST).mutationAudit = 'WRITE_REFUSED_BY_GOVERNANCE'
  const allowedResult = run(allowed)
  assert.ok(hasProblem(allowedResult, /writes an OPERATIONAL table through the factory, which audits atomically/))
  assert.ok(hasProblem(allowedResult, /records a refused write without citing the refusal/))
  const wrongTable = fixture()
  record(wrongTable, SMS_POST).crudTable = 'poll_votes'
  assert.ok(hasProblem(run(wrongTable), /records poll_votes as OPERATIONAL but the CRUD governance table says DENIED/))
})

test('NEGATIVE 16: a capability that does not cover the route business domain or rule is rejected', () => {
  const wrong = fixture()
  const item = record(wrong, COMMITTEE_MEETINGS_GET)
  item.capabilityId = IDS.SMS
  entryOf(wrong, COMMITTEE_MEETINGS_GET)[3] = IDS.SMS
  const wrongResult = run(wrong)
  assert.ok(hasProblem(wrongResult, /is in the domain COMMITTEE_MEETINGS_AND_MINUTES, which UE-OMIT-COMMUNICATIONS-SMS does not cover/))
  assert.ok(hasProblem(wrongResult, /changed owner from UE-OMIT-COMMITTEE-WORKSPACE to UE-OMIT-COMMUNICATIONS-SMS without a versioned reason/))
  const generic = fixture()
  record(generic, COMMITTEE_MEETINGS_GET).capabilityId = UNDECIDED_OWNER
  assert.ok(hasProblem(run(generic), /names an invalid capability UE-OMIT-ROUTE-DOMAIN-SCOPE/))
  const unknown = fixture()
  record(unknown, COMMITTEE_MEETINGS_GET).capabilityId = 'UE-OMIT-NOT-A-CAPABILITY'
  assert.ok(hasProblem(run(unknown), /names an invalid capability UE-OMIT-NOT-A-CAPABILITY/))
  const earlier = fixture()
  entryOf(earlier, COMMITTEE_MEETINGS_GET)[2] = 'RULE-0B4-SOMETHING'
  assert.ok(hasProblem(run(earlier), /not a Gate 0B.5 business-evidence rule/))
})

test('NEGATIVE 17: an earlier classification cannot be silently changed or reverted', () => {
  const reverted = fixture()
  const entry = entryOf(reverted, EARLIER_CLASSIFIED)
  entry[3] = UNDECIDED_OWNER
  entry[4] = 'SCOPE_UNDECIDED'
  assert.ok(hasProblem(run(reverted), /silently reverted to SCOPE_UNDECIDED/))
  const owner = fixture()
  entryOf(owner, EARLIER_CLASSIFIED)[3] = IDS.SMS
  assert.ok(hasProblem(run(owner), /was changed or reverted|changed owner/))
  const removed = fixture()
  delete removed.ledger.classified[EARLIER_CLASSIFIED]
  assert.ok(hasProblem(run(removed), /missing or changed in the ledger/))
  const moved = fixture()
  moved.ledger.classifiedIn[EARLIER_CLASSIFIED] = 'GATE-0B.5'
  assert.ok(hasProblem(run(moved), /no longer records GATE-0B.4 in the ledger/))
  const first = fixture()
  entryOf(first, 'alerts/realtime/route.ts|GET')[4] = 'SCOPE_UNDECIDED'
  assert.ok(hasProblem(run(first), /silently reverted to SCOPE_UNDECIDED/))
})

test('NEGATIVE 18: required audit, callers and dependency gates must be stated and valid', () => {
  const audit = fixture()
  record(audit, COMMITTEE_MEETINGS_GET).requiredAudit = ''
  assert.ok(hasProblem(run(audit), /states no required audit behavior/))
  const gates = fixture()
  record(gates, COMMITTEE_MEETINGS_GET).dependencyGates = [99]
  assert.ok(hasProblem(run(gates), /has an invalid dependency gate list/))
  const callers = fixture()
  record(callers, COMMITTEE_MEETINGS_GET).callers = [{ ref: 'apps/union-eyes/does/not/exist.ts', quote: 'fetch("/api/committees")' }]
  assert.ok(hasProblem(run(callers), /cites caller apps\/union-eyes\/does\/not\/exist.ts, which does not exist/))
  const malformed = fixture()
  record(malformed, COMMITTEE_MEETINGS_GET).callers = [{ file: 'x', line: 1 }]
  assert.ok(hasProblem(run(malformed), /has a malformed caller/))
})

test('NEGATIVE 19: the classification summary cannot disagree with its records and the ledger must record every classification', () => {
  const summary = fixture()
  summary.classification.summary = { ...base.classification0b5.summary, classified: 100, unresolved: 0 }
  assert.ok(hasProblem(run(summary), /summary does not match its records/))
  const ledger = fixture()
  delete ledger.ledger.classified[COMMITTEE_MEETINGS_GET]
  assert.ok(hasProblem(run(ledger), /is not recorded in the classification ledger/))
  const tranche = fixture()
  delete tranche.ledger.tranches['GATE-0B.5']
  assert.ok(hasProblem(run(tranche), /does not record the GATE-0B.5 tranche/))
  const phantom = fixture()
  phantom.ledger.classifiedIn['zzz/route.ts|GET'] = 'GATE-0B.5'
  assert.ok(hasProblem(run(phantom), /but no classification exists/))
})

test('NEGATIVE 20: a release-blocking exposure cannot lose its contract or its mark', () => {
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

test('NEGATIVE 21: an earlier tranche classification, manifest or decision file cannot be altered without the validator noticing', () => {
  const classification = fixture()
  classification.classification0b4.operations.find((item) => item.id === EARLIER_CLASSIFIED).capabilityId = IDS.SMS
  assert.ok(hasProblem(run(classification), /Gate 0B.4 classification .* was changed or reverted/))
  const carry = fixture()
  carry.classification0b4.operations.find((item) => item.id === CARBON_POST).status = 'CLASSIFIED'
  assert.ok(hasProblem(run(carry), /carry-forward operations are not exactly the operations Gate 0B.4 left unresolved|carry forward exactly 4/))
  const decisions = fixture()
  decisions.classification0b4.institutionalDecisions.find((decision) => decision.id === 'UE-INST-CARBON-ACCOUNTING-SCOPE').question = 'A different question that earlier tranche never recorded in the register.'
  assert.ok(hasProblem(run(decisions), /UE-INST-CARBON-ACCOUNTING-SCOPE was altered or adopted/))
})

test('NEGATIVE 22: end to end, a tampered Gate 0B.5 register fails the Gate 0 validator and the matrix pin catches a changed file', () => {
  const classification = clone(base.classification0b5)
  classification.operations.find((item) => item.id === COMMITTEE_MEETINGS_GET).evidence = []
  const tampered = validateGate0(matrix, { classification0b5: classification })
  assert.ok(tampered.problems.some((problem) => /has no source evidence/.test(problem)))
  const carbon = clone(base.classification0b5)
  carbon.operations.find((item) => item.id === CARBON_POST).scopeDisposition.adopted = true
  assert.ok(validateGate0(matrix, { classification0b5: carbon }).problems.some((problem) => /scope disposition is marked adopted/.test(problem)))
  const unregistered = clone(base.classification0b5)
  unregistered.releaseBlockingExposures = []
  assert.ok(validateGate0(matrix, { classification0b5: unregistered }).blockers.some((item) => item.code === 'ROUTE_UNJUSTIFIED_EXPOSURE'))
  const stale = clone(matrix)
  stale.routeClassification0b5.files.classification.sha256 = '0'.repeat(64)
  assert.ok(validateGate0(stale).problems.some((problem) => /CLASSIFICATION-PIN-HASH/.test(problem)))
  const absent = clone(matrix)
  delete absent.routeClassification0b5
  assert.ok(validateGate0(absent).problems.some((problem) => /CLASSIFICATION-PIN-ABSENT/.test(problem)))
  const drift = clone(matrix)
  drift.routeDefects[drift.routeDefects.length - 1].ownerCapabilityId = IDS.CAMPAIGN_AUTHORING
  assert.ok(validateGate0(drift).problems.some((problem) => /ROUTE-DEFECT-DRIFT/.test(problem)))
  assert.equal(FILES_0B5.classification, 'docs/union-eyes/convergence/register/ue-route-classification-0b5.json')
})
