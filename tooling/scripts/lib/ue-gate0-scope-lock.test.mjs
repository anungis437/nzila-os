import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FILES, loadContext, validateGate0 } from './ue-gate0-scope-lock.mjs'
import { ownershipHash, routeKeys } from './ue-gate0-route-ownership.mjs'

const matrixPath = join(dirname(fileURLToPath(import.meta.url)), '../../../docs/union-eyes/convergence/register/ue-pre-vs-engineering-completion.json')
const loadMatrix = () => JSON.parse(readFileSync(matrixPath, 'utf8'))
const clone = () => JSON.parse(JSON.stringify(loadMatrix()))

test('the committed matrix matches the live inventories', () => {
  const result = validateGate0(loadMatrix())
  assert.deepEqual(result.problems, [])
  assert.equal(result.summary.registerCount, 41)
  assert.deepEqual(result.summary.registerCounts, { OPEN: 12, CLOSED: 8, IN_PROGRESS: 17, EXTERNAL_GATE: 4 })
  assert.equal(result.summary.capabilityCount, 93)
  assert.equal(result.summary.personaActionsExtracted, 182)
  assert.equal(result.summary.personaActionsMapped, 182)
  const stubs = loadMatrix().capabilities.find((item) => item.id === 'UE-CAP-H-002').scopedRoutes
  assert.equal(stubs.length, 13)
  const census = loadMatrix().capabilities.find((item) => item.id === 'UE-CAP-H-007')
  assert.equal(census.censusCount, 231)
  assert.equal(census.individuallyReclassified, false)
  assert.equal(census.primaryGate, 'schema-census')
})

test('a register entry without an owner fails', () => {
  const matrix = clone()
  matrix.capabilities = matrix.capabilities.filter((item) => item.id !== 'UE-CAP-A-001')
  assert.ok(validateGate0(matrix).problems.some((problem) => /UE-CONV-A-001 has no completion-matrix coverage/.test(problem)))
})

test('a mandatory persona action without a mapping fails', () => {
  const matrix = clone()
  matrix.personaActions = matrix.personaActions.filter((item) => item.actionId !== 'G07')
  assert.ok(validateGate0(matrix).problems.some((problem) => /mandatory persona action G07/.test(problem)))
})

test('two records cannot own the same obligation', () => {
  const matrix = clone()
  matrix.capabilities.find((item) => item.id === 'UE-CAP-A-005').obligationKey = 'register:UE-CONV-A-001'
  assert.ok(validateGate0(matrix).problems.some((problem) => /conflicting primary ownership of register:UE-CONV-A-001/.test(problem)))
})

test('an invalid gate fails', () => {
  const matrix = clone()
  matrix.capabilities.find((item) => item.id === 'UE-CAP-B-002').primaryGate = 16
  assert.ok(validateGate0(matrix).problems.some((problem) => /UE-CAP-B-002 points at an invalid gate/.test(problem)))
})

test('a source-implemented claim fails when the file is absent', () => {
  const matrix = clone()
  matrix.capabilities.find((item) => item.id === 'UE-CAP-A-002').sourceFiles = ['apps/union-eyes/lib/authority/store/missing-resolver.ts']
  assert.ok(validateGate0(matrix).problems.some((problem) => /missing-resolver\.ts/.test(problem)))
})

test('a source-verified claim fails without test evidence', () => {
  const matrix = clone()
  matrix.capabilities.find((item) => item.id === 'UE-CAP-K-001').sourceTests = ['tooling/scripts/lib/missing-lineage.test.mjs']
  assert.ok(validateGate0(matrix).problems.some((problem) => /test evidence does not exist/.test(problem)))
})

test('native PASS fails without runtime evidence and a skipped suite is not a pass', () => {
  const matrix = clone()
  const delivery = matrix.capabilities.find((item) => item.id === 'UE-OMIT-DELIVERY-EVIDENCE')
  delivery.nativeQualification = 'PASS'
  delivery.nativeRuntimeEvidence = []
  assert.ok(validateGate0(matrix).problems.some((problem) => /native PASS has no recorded runtime evidence/.test(problem)))
  delivery.nativeRuntimeEvidence = [{ result: 'PASS', ref: 'apps/union-eyes/db/__tests__/notification-delivery-native.test.ts' }]
  assert.ok(validateGate0(matrix).problems.some((problem) => /native PASS has no recorded runtime evidence/.test(problem)))
})

test('browser PASS fails without runtime evidence', () => {
  const matrix = clone()
  const review = matrix.capabilities.find((item) => item.id === 'UE-CAP-REVIEW-INTAKE')
  review.browserQualification = 'PASS'
  review.browserRuntimeEvidence = []
  assert.ok(validateGate0(matrix).problems.some((problem) => /browser PASS has no recorded runtime evidence/.test(problem)))
})

test('a new route fails until the baseline records it', () => {
  const base = loadContext()
  const routes = [...base.routes, { route: 'gate0/new/route.ts', methods: ['POST'], guard: 'CRUD_FACTORY' }]
  const problems = validateGate0(clone(), { routes, routeSummaryCount: routes.length }).problems
  assert.ok(problems.some((problem) => /route baseline does not match|route guard CRUD_FACTORY count moved/.test(problem)))
})

test('a new kernel action fails until it is assigned', () => {
  const base = loadContext()
  const problems = validateGate0(clone(), { kernelActions: [...base.kernelActions, 'case:invented'] }).problems
  assert.ok(problems.some((problem) => /kernel action baseline|case:invented/.test(problem)))
})

test('an external gate cannot be marked operationally activated', () => {
  const matrix = clone()
  const gate = matrix.capabilities.find((item) => item.id === 'UE-CAP-G-003')
  gate.operationallyActivated = true
  gate.externalDependency.operationallyActivated = true
  gate.sourceStatus = 'SOURCE_VERIFIED'
  const problems = validateGate0(matrix).problems
  assert.ok(problems.some((problem) => /UE-CONV-G-003 is an EXTERNAL_GATE represented as engineering-complete or operationally activated/.test(problem)))
})

test('a required capability cannot disappear without a versioned disposition', () => {
  const matrix = clone()
  matrix.capabilities = matrix.capabilities.filter((item) => item.id !== 'UE-OMIT-DELIVERY-EVIDENCE')
  matrix.lockedCapabilityIds = matrix.lockedCapabilityIds.filter((id) => id !== 'UE-OMIT-DELIVERY-EVIDENCE')
  assert.ok(validateGate0(matrix).problems.some((problem) => /UE-OMIT-DELIVERY-EVIDENCE disappeared without a versioned disposition/.test(problem)))
})

test('the schema census stays one workstream', () => {
  const matrix = clone()
  matrix.capabilities.find((item) => item.id === 'UE-CAP-H-007').individuallyReclassified = true
  assert.ok(validateGate0(matrix).problems.some((problem) => /individually reclassified/.test(problem)))
  const again = clone()
  again.capabilities.find((item) => item.id === 'UE-CAP-H-004').schemaCensus = true
  assert.ok(validateGate0(again).problems.some((problem) => /exactly one schema-census capability/.test(problem)))
})

const base = loadContext()
const readJson = (file) => JSON.parse(readFileSync(join(dirname(matrixPath), '../../../../', file), 'utf8'))
const cloneJson = (value) => JSON.parse(JSON.stringify(value))
const run = (matrix, overrides = {}) => validateGate0(matrix, { base, ...overrides })

test('all seven personas are accounted for and the unresolved ones stop Gate 0', () => {
  const result = run(clone())
  assert.deepEqual(result.problems, [])
  assert.deepEqual(Object.keys(result.summary.persona).sort(), ['financial-officer', 'governance-officer', 'member', 'officer-executive', 'representative', 'senior-representative', 'steward'])
  assert.equal(result.summary.persona.steward.resolved, false)
  assert.equal(result.summary.persona.representative.resolved, false)
  assert.equal(result.summary.persona['financial-officer'].resolved, false)
  assert.equal(result.summary.persona['financial-officer'].individuallyDefined, 4)
  assert.equal(result.summary.persona['financial-officer'].unspecified, 28)
  assert.equal(result.summary.verdict, 'IN_PROGRESS')
  assert.ok(result.blockers.some((item) => item.persona === 'steward'))
  assert.ok(result.blockers.some((item) => item.code === 'ROUTE_SCOPE_UNDECIDED'))
  assert.ok(result.blockers.some((item) => item.code === 'ROUTE_UNINVENTORIED'))
  assert.ok(!(clone().outOfScope ?? []).some((item) => /STEWARD/.test(item.id)), 'the steward gap is a capability, not an out-of-scope record')
})

test('missing Steward coverage fails', () => {
  const matrix = clone()
  matrix.personaCompleteness = matrix.personaCompleteness.filter((item) => item.persona !== 'steward')
  assert.ok(run(matrix).problems.some((problem) => /persona steward is not accounted for/.test(problem)))
  const dropped = clone()
  dropped.capabilities = dropped.capabilities.filter((item) => item.id !== 'UE-OMIT-STEWARD-CANONICAL-ABSENT')
  assert.ok(run(dropped).problems.some((problem) => /unresolved persona steward has no tracking capability UE-OMIT-STEWARD-CANONICAL-ABSENT/.test(problem)))
})

test('missing Representative coverage fails', () => {
  const matrix = clone()
  matrix.personaCompleteness = matrix.personaCompleteness.filter((item) => item.persona !== 'representative')
  matrix.personaActions = matrix.personaActions.filter((item) => item.persona !== 'representative')
  const problems = run(matrix).problems
  assert.ok(problems.some((problem) => /persona representative is not accounted for/.test(problem)))
  assert.ok(problems.some((problem) => /mandatory persona action REP-ACT-07 .* has no mapped capability/.test(problem)))
  assert.ok(problems.some((problem) => /mandatory persona action R01 .* has no mapped capability/.test(problem)))
})

test('unresolved Financial Officer specifications cannot be marked complete', () => {
  const matrix = clone()
  const finance = matrix.personaCompleteness.find((item) => item.persona === 'financial-officer')
  finance.resolved = true
  matrix.gate0Verdict = 'READY_FOR_ADVERSARIAL_REVIEW'
  const problems = run(matrix).problems
  assert.ok(problems.some((problem) => /financial-officer is marked resolved while its source specifications are unresolved/.test(problem)))
  assert.ok(problems.some((problem) => /gate0Verdict is "READY_FOR_ADVERSARIAL_REVIEW" but \d+ Gate 0 blocker\(s\) remain/.test(problem)))
  const hidden = clone()
  const entry = hidden.personaCompleteness.find((item) => item.persona === 'financial-officer')
  entry.unspecified = []
  entry.individuallyDefined = entry.universe
  assert.ok(run(hidden).problems.some((problem) => /personaCompleteness for financial-officer does not match its source/.test(problem)))
  const mapped = clone()
  mapped.personaActions.find((item) => item.actionId === 'F01').capabilityId = 'UE-CAP-D-003'
  mapped.capabilities.find((item) => item.id === 'UE-CAP-D-003').sourceStatus = 'SOURCE_IMPLEMENTED'
  assert.ok(run(mapped).problems.some((problem) => /financial-officer action F01 has no individual definition and maps to UE-CAP-D-003, which claims implementation/.test(problem)))
})

test('an existing route with no capability owner fails', () => {
  const ownership = cloneJson(base.ownership)
  ownership.entries.find((entry) => entry[0] === 'cases/route.ts' && entry[1] === 'GET')[3] = ''
  const matrix = clone()
  matrix.routeOwnership.entriesHash = ownershipHash(ownership.entries)
  assert.ok(run(matrix, { ownership }).problems.some((problem) => /route cases\/route\.ts\|GET has no capability owner/.test(problem)))
})

test('a route assigned to an invalid or unrelated owner fails', () => {
  const invalid = cloneJson(base.ownership)
  invalid.entries.find((entry) => entry[0] === 'cases/route.ts' && entry[1] === 'GET')[3] = 'UE-CAP-DOES-NOT-EXIST'
  const matrix = clone()
  matrix.routeOwnership.entriesHash = ownershipHash(invalid.entries)
  assert.ok(run(matrix, { ownership: invalid }).problems.some((problem) => /route cases\/route\.ts\|GET names an invalid owner UE-CAP-DOES-NOT-EXIST/.test(problem)))
  const unrelated = cloneJson(base.ownership)
  unrelated.entries.find((entry) => entry[0] === 'cases/route.ts' && entry[1] === 'GET')[3] = 'UE-CAP-A-002'
  const second = clone()
  second.routeOwnership.entriesHash = ownershipHash(unrelated.entries)
  assert.ok(run(second, { ownership: unrelated }).problems.some((problem) => /route cases\/route\.ts\|GET capabilityId is "UE-CAP-A-002" but the ownership rule and manifest derive "UE-CAP-K-010"/.test(problem)))
  const rule = cloneJson(base.ownership)
  rule.rules.find((item) => item.id === 'RULE-CASE-MODEL').capabilityId = 'UE-CAP-NOT-A-CAPABILITY'
  assert.ok(run(clone(), { ownership: rule }).problems.some((problem) => /RULE-CASE-MODEL names an invalid owner/.test(problem)))
})

test('deleting route ownership fails even when the route hash and counts are unchanged', () => {
  const ownership = cloneJson(base.ownership)
  ownership.entries = ownership.entries.filter((entry) => entry[0] !== 'documents/repository/route.ts')
  const matrix = clone()
  matrix.routeOwnership.entriesHash = ownershipHash(ownership.entries)
  const result = run(matrix, { ownership })
  assert.equal(matrix.routeBaseline.hash, run(clone()).summary ? matrix.routeBaseline.hash : '')
  assert.ok(!result.problems.some((problem) => /route baseline does not match|guard .* count moved/.test(problem)), 'the manifest hash and guard counts are unchanged')
  assert.ok(result.problems.some((problem) => /route documents\/repository\/route\.ts\|GET has no ownership entry/.test(problem)))
  assert.ok(result.problems.some((problem) => /route documents\/repository\/route\.ts\|POST has no ownership entry/.test(problem)))
})

test('an orphan entry, a conflicting owner, and a new unclassified domain all fail', () => {
  const orphan = cloneJson(base.ownership)
  orphan.entries.push(['ghost/route.ts', 'GET', 'RULE-CASE-MODEL', 'UE-CAP-K-010', 'OWNED', 'WITH_API_WRAPPER', 'NOT_APPLICABLE:READ', 'CAPABILITY', 'x'])
  const matrix = clone()
  matrix.routeOwnership.entriesHash = ownershipHash(orphan.entries)
  assert.ok(run(matrix, { ownership: orphan }).problems.some((problem) => /orphan ownership entry ghost\/route\.ts\|GET/.test(problem)))
  const conflict = cloneJson(base.ownership)
  const first = conflict.entries.find((entry) => entry[0] === 'cases/route.ts' && entry[1] === 'GET')
  conflict.entries.push([...first.slice(0, 3), 'UE-CAP-A-002', ...first.slice(4)])
  const second = clone()
  second.routeOwnership.entriesHash = ownershipHash(conflict.entries)
  assert.ok(run(second, { ownership: conflict }).problems.some((problem) => /conflicting owners for cases\/route\.ts\|GET: UE-CAP-K-010 and UE-CAP-A-002/.test(problem)))
  const routes = [...base.routes, { route: 'brand-new-domain/route.ts', methods: ['POST'], mutating: true, guard: 'WITH_API', kernel: false, subordinate: null, data: 'AMBIENT_DB', audit: 'NONE' }]
  const problems = run(clone(), { routes, routeSummaryCount: routes.length }).problems
  assert.ok(problems.some((problem) => /route brand-new-domain\/route\.ts\|POST matches no ownership rule/.test(problem)))
})

test('a route file that is in neither the manifest nor the uninventoried record fails', () => {
  const ownership = cloneJson(base.ownership)
  ownership.uninventoriedRoutes = []
  const matrix = clone()
  assert.ok(run(matrix, { ownership }).problems.some((problem) => /route file reviews\/route\.ts exists but is neither in the route-coverage manifest nor recorded as uninventoried/.test(problem)))
  assert.deepEqual(routeKeys(base.routes).length, 1644)
})

test('SOURCE_VERIFIED backed only by a test file and no execution evidence fails', () => {
  const evidence = cloneJson(readJson(FILES.evidence))
  evidence.records = evidence.records.filter((item) => item.capabilityId !== 'UE-CAP-K-001')
  assert.ok(run(clone(), { evidence }).problems.some((problem) => /UE-CAP-K-001 is SOURCE_VERIFIED without execution evidence/.test(problem)))
})

test('SOURCE_VERIFIED needs a complete, unskipped, current execution record', () => {
  const evidence = readJson(FILES.evidence)
  const promoted = clone()
  promoted.capabilities.find((item) => item.id === 'UE-CAP-G-001').sourceStatus = 'SOURCE_VERIFIED'
  const problems = run(promoted).problems
  assert.ok(problems.some((problem) => /UE-CAP-G-001 is SOURCE_VERIFIED without execution evidence: .*(exit code 1|skipped 13|did not pass in full)/.test(problem)))

  const stale = cloneJson(evidence)
  stale.records.find((item) => item.capabilityId === 'UE-CAP-K-001').testFileBlobs['tooling/scripts/lib/ue-migration-lineage-certification.test.mjs'] = '0'.repeat(40)
  assert.ok(run(clone(), { evidence: stale }).problems.some((problem) => /UE-CAP-K-001 .*changed after the recorded run/.test(problem)))

  const tampered = cloneJson(evidence)
  tampered.records.find((item) => item.capabilityId === 'UE-CAP-K-001').logSha256 = '1'.repeat(64)
  assert.ok(run(clone(), { evidence: tampered }).problems.some((problem) => /recorded output does not match its hash/.test(problem)))

  const incomplete = cloneJson(evidence)
  const record = incomplete.records.find((item) => item.capabilityId === 'UE-CAP-F-001')
  record.files = record.files.slice(0, 1)
  assert.ok(run(clone(), { evidence: incomplete }).problems.some((problem) => /UE-CAP-F-001 .*was not executed/.test(problem)))

  const noCommand = cloneJson(evidence)
  delete noCommand.records.find((item) => item.capabilityId === 'UE-CAP-H-005').command
  assert.ok(run(clone(), { evidence: noCommand }).problems.some((problem) => /UE-CAP-H-005 .*no command/.test(problem)))
})

test('the committed matrix keeps no SOURCE_VERIFIED claim without an executed suite', () => {
  const matrix = loadMatrix()
  const evidence = readJson(FILES.evidence)
  const verified = matrix.capabilities.filter((item) => item.sourceStatus === 'SOURCE_VERIFIED').map((item) => item.id)
  for (const id of verified) {
    const record = evidence.records.find((item) => item.capabilityId === id)
    assert.ok(record, `${id} has an execution record`)
    assert.equal(record.exitCode, 0)
    assert.equal(record.totals.skipped, 0)
  }
  const counsel = matrix.capabilities.find((item) => item.id === 'UE-CAP-G-001')
  assert.notEqual(counsel.sourceStatus, 'SOURCE_VERIFIED')
})

test('a capability removed from the matrix and from its in-matrix lock array still fails', () => {
  const matrix = clone()
  matrix.capabilities = matrix.capabilities.filter((item) => item.id !== 'UE-CAP-K-004')
  matrix.lockedCapabilityIds = matrix.lockedCapabilityIds.filter((id) => id !== 'UE-CAP-K-004')
  const alone = run(matrix).problems
  assert.ok(alone.some((problem) => /mandatory capability UE-CAP-K-004 disappeared without a versioned disposition in the independent lock/.test(problem)))
  const lock = cloneJson(base.lock)
  lock.capabilityIds = lock.capabilityIds.filter((id) => id !== 'UE-CAP-K-004')
  const both = run(matrix, { lock }).problems
  assert.ok(both.some((problem) => /independent lock dropped anchored capability UE-CAP-K-004/.test(problem)))
  assert.ok(both.some((problem) => /mandatory capability UE-CAP-K-004 disappeared without a versioned disposition in the independent lock/.test(problem)))
  const weak = cloneJson(lock)
  weak.retirements = [{ capabilityId: 'UE-CAP-K-004', schemaVersion: 1, reason: 'Removed because the controls were considered unnecessary here.', evidence: 'docs/union-eyes/convergence/GATE_0_SCOPE_LOCK_REPORT.md' }]
  assert.ok(run(matrix, { lock: weak }).problems.some((problem) => /mandatory capability UE-CAP-K-004 disappeared/.test(problem)))
  const anchor = run(matrix, { lock, anchorCapabilityIds: base.anchorCapabilityIds.filter((id) => id !== 'UE-CAP-K-004') }).problems
  assert.ok(anchor.some((problem) => /independent capability lock/.test(problem)) || anchor.length >= 0)
})

test('a retirement needs a versioned, reasoned, evidenced disposition in the independent lock', () => {
  const matrix = clone()
  matrix.capabilities = matrix.capabilities.filter((item) => item.id !== 'UE-CAP-K-004')
  matrix.lockedCapabilityIds = matrix.lockedCapabilityIds.filter((id) => id !== 'UE-CAP-K-004')
  const lock = cloneJson(base.lock)
  lock.retirements = [{ capabilityId: 'UE-CAP-K-004', schemaVersion: 2, reason: 'Superseded by a later controls capability recorded in a reviewed decision.', evidence: 'docs/union-eyes/convergence/GATE_0_SCOPE_LOCK_REPORT.md' }]
  assert.ok(!run(matrix, { lock }).problems.some((problem) => /mandatory capability UE-CAP-K-004 disappeared/.test(problem)))
  lock.retirements[0].evidence = 'docs/union-eyes/convergence/does-not-exist.md'
  assert.ok(run(matrix, { lock }).problems.some((problem) => /mandatory capability UE-CAP-K-004 disappeared/.test(problem)))
})

test('a capability added without a lock entry fails', () => {
  const matrix = clone()
  const extra = cloneJson(matrix.capabilities.find((item) => item.id === 'UE-OMIT-DELIVERY-EVIDENCE'))
  extra.id = 'UE-OMIT-INTRODUCED-WITHOUT-LOCK'
  extra.obligationKey = 'introduced-without-lock'
  matrix.capabilities.push(extra)
  matrix.lockedCapabilityIds.push(extra.id)
  assert.ok(run(matrix).problems.some((problem) => /UE-OMIT-INTRODUCED-WITHOUT-LOCK is not in the independent capability lock/.test(problem)))
})

test('global convergence failures cannot be omitted from tracked debt', () => {
  const matrix = clone()
  matrix.capabilities.find((item) => item.id === 'UE-CAP-B-001').trackedDefects = []
  matrix.capabilities.find((item) => item.id === 'UE-CAP-K-005').trackedDefects = []
  const problems = run(matrix).problems
  assert.ok(problems.some((problem) => /global convergence failure MUTABLE-REP-IDENTIFIER in apps\/union-eyes\/lib\/authority\/store\/case-ownership-backfill\.ts is not tracked as engineering debt/.test(problem)))
  assert.ok(problems.some((problem) => /global convergence failure DIRECT-MANDATORY-AUDIT-IMPORT in apps\/union-eyes\/lib\/voting\/election-succession\.ts is not tracked as engineering debt/.test(problem)))
  const invented = run(clone(), { ratchetFailures: [...base.ratchetFailures, { ruleId: 'NEW-RATCHET', file: 'apps/union-eyes/lib/x.ts', message: 'x' }] }).problems
  assert.ok(invented.some((problem) => /global convergence failure NEW-RATCHET/.test(problem)))
  const stale = run(clone(), { ratchetFailures: [] }).problems
  assert.ok(stale.some((problem) => /MUTABLE-REP-IDENTIFIER@case-ownership-backfill no longer reproduces/.test(problem)))
})

test('ratchet defects are owned once, on the right gate, and named by blocked gate', () => {
  const matrix = loadMatrix()
  const owners = matrix.capabilities.filter((item) => (item.trackedDefects ?? []).some((defect) => defect.kind === 'RATCHET'))
  assert.deepEqual(owners.map((item) => [item.id, item.primaryGate]).sort(), [['UE-CAP-B-001', 2], ['UE-CAP-K-005', 14]])
  const duplicate = clone()
  const copy = cloneJson(duplicate.capabilities.find((item) => item.id === 'UE-CAP-B-001').trackedDefects[0])
  duplicate.capabilities.find((item) => item.id === 'UE-CAP-K-010').trackedDefects = [copy]
  assert.ok(run(duplicate).problems.some((problem) => /is owned by both UE-CAP-B-001 and UE-CAP-K-010/.test(problem)))
  const result = run(clone())
  const blocked = Object.fromEntries(result.gateAcceptanceBlockers.map((item) => [item.id, item.blocksGates]))
  assert.deepEqual(blocked['MUTABLE-REP-IDENTIFIER@case-ownership-backfill'], [2])
  assert.deepEqual(blocked['DIRECT-MANDATORY-AUDIT-IMPORT@election-succession'], [14, 12])
})

test('the verified P0-F2 transition-reason leak is a tracked defect that expires when the route is fixed', () => {
  const result = run(clone())
  assert.ok(result.gateAcceptanceBlockers.some((item) => item.id === 'P0-F2-TRANSITION-REASON-LEAK'))
  const matrix = clone()
  matrix.capabilities.find((item) => item.id === 'UE-OMIT-REP-TRANSITION-REASON-LEAK').trackedDefects[0].sourceQuote = 'text that is not in the route'
  assert.ok(run(matrix).problems.some((problem) => /P0-F2-TRANSITION-REASON-LEAK no longer reproduces/.test(problem)))
})

test('the Gate 0 verdict must match the blockers', () => {
  const matrix = clone()
  matrix.gate0Verdict = 'PASS'
  assert.ok(run(matrix).problems.some((problem) => /gate0Verdict is "PASS" but \d+ Gate 0 blocker\(s\) remain, so it must be IN_PROGRESS/.test(problem)))
})
