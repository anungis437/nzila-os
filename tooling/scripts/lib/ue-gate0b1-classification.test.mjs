import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadContext, validateGate0 } from './ue-gate0-scope-lock.mjs'
import { routeKeys } from './ue-gate0-route-ownership.mjs'
import { trancheHash, validateClassification } from './ue-gate0b1-classification.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const base = loadContext(ROOT)
const matrix = JSON.parse(readFileSync(join(ROOT, 'docs/union-eyes/convergence/register/ue-pre-vs-engineering-completion.json'), 'utf8'))
const clone = (value) => JSON.parse(JSON.stringify(value))
const exists = (file) => existsSync(join(ROOT, file))
const readText = (file) => readFileSync(join(ROOT, file), 'utf8')

function fixture() {
  return {
    classification: clone(base.classification0b1),
    manifest: clone(base.tranche0b1),
    ledger: clone(base.ledger0b1),
    entries: clone(base.ownership.entries),
    capabilityById: new Map(matrix.capabilities.map((capability) => [capability.id, capability])),
    universe: new Set(routeKeys(base.routes)),
    exists,
    readText,
    anchoredEntries: clone(base.anchoredOwnershipEntries),
  }
}

const run = (args) => validateClassification(args)
const record = (args, id) => args.classification.operations.find((item) => item.id === id)
const unauth = (args, id) => args.classification.unauthenticated.find((item) => item.id === id)
const hasProblem = (result, pattern) => result.problems.some((problem) => pattern.test(problem))

const CRUD_POST = 'admin/alerts/rules/route.ts|POST'
const BILLING_POST = 'admin/billing-cycles/route.ts|POST'

test('the committed Gate 0B.1 registers validate against the live source', () => {
  const result = run(fixture())
  assert.deepEqual(result.problems, [])
  assert.equal(result.summary.examined, 100)
  assert.equal(result.summary.classified + result.summary.unresolved, 100)
  assert.equal(result.summary.unauthenticatedRecorded, 50)
  assert.equal(base.tranche0b1.operations.length, 100)
})

test('the tranche is the first 100 SCOPE_UNDECIDED operations at the anchor commit', () => {
  const undecided = base.anchoredOwnershipEntries.filter((entry) => entry[4] === 'SCOPE_UNDECIDED').map((entry) => `${entry[0]}|${entry[1]}`).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  assert.deepEqual(base.tranche0b1.operations, undecided.slice(0, 100))
  assert.equal(base.tranche0b1.operations[0], 'activities/route.ts|GET')
  assert.equal(base.tranche0b1.operations[99], 'admin/roles/batch/route.ts|POST')
})

test('the 42 unauthenticated operations without a prior justification all carry a disposition', () => {
  const args = fixture()
  const system = new Set(args.entries.filter((entry) => entry[4] === 'SYSTEM').map((entry) => `${entry[0]}|${entry[1]}`))
  const forty = args.classification.unauthenticated.filter((item) => !system.has(item.id))
  assert.equal(forty.length, 42)
  assert.equal(forty.filter((item) => item.disposition === 'UNJUSTIFIED_EXPOSURE').length, 0)
  const counts = {}
  for (const item of forty) counts[item.disposition] = (counts[item.disposition] ?? 0) + 1
  assert.deepEqual(counts, { AUTHENTICATED_BY_UNDETECTED_GUARD: 27, INTENTIONALLY_PUBLIC: 11, EXTERNAL_TRUST_MECHANISM: 3, INTERNAL_MACHINE_TO_MACHINE: 1 })
})

test('1. an operation classified without source evidence fails', () => {
  const args = fixture()
  record(args, CRUD_POST).evidence = []
  assert.ok(hasProblem(run(args), /no source evidence/))
  const quoted = fixture()
  record(quoted, CRUD_POST).evidence[0].quote = 'this text is not in the route file'
  assert.ok(hasProblem(run(quoted), /quoted text is not in the file/))
  const noRoute = fixture()
  const entry = record(noRoute, CRUD_POST)
  entry.evidence = entry.evidence.filter((item) => !item.ref.endsWith('admin/alerts/rules/route.ts'))
  assert.ok(hasProblem(run(noRoute), /does not cite its own route file/))
})

test('2. a role floor labelled kernel authorization fails', () => {
  const args = fixture()
  const item = record(args, CRUD_POST)
  item.authorizationCategory = 'KERNEL_AUTHORITY'
  item.kernelAuthorization = true
  assert.ok(hasProblem(run(args), /a role floor is not a kernel decision/))
  const half = fixture()
  record(half, BILLING_POST).kernelAuthorization = true
  assert.ok(hasProblem(run(half), /inconsistent about kernel authorization/))
})

test('3. a public endpoint without a justified exposure contract fails', () => {
  const args = fixture()
  const item = unauth(args, 'contact/route.ts|POST')
  assert.equal(item.disposition, 'INTENTIONALLY_PUBLIC')
  delete item.exposureContract
  assert.ok(hasProblem(run(args), /public without a justified exposure contract/))
  const empty = fixture()
  unauth(empty, 'contact/route.ts|POST').exposureContract.controls = []
  assert.ok(hasProblem(run(empty), /public without a justified exposure contract/))
  const noContract = fixture()
  unauth(noContract, 'contact/route.ts|POST').securityContract = ''
  assert.ok(hasProblem(run(noContract), /no required security contract/))
  const unjustified = fixture()
  delete unauth(unjustified, 'version/route.ts|GET').requiredSecurityContract
  assert.ok(hasProblem(run(unjustified), /without a required security contract/))
  const missing = fixture()
  missing.classification.unauthenticated = missing.classification.unauthenticated.filter((entry) => entry.id !== 'contact/route.ts|POST')
  assert.ok(hasProblem(run(missing), /no recorded disposition/))
})

test('4. a mutating operation falsely marked atomically audited fails', () => {
  const billing = fixture()
  record(billing, BILLING_POST).mutationAudit = 'ATOMIC_AUDIT_IN_TRANSACTION'
  assert.ok(hasProblem(run(billing), /marked atomically audited without citing an in-transaction audit write/))
  const refused = fixture()
  const item = record(refused, CRUD_POST)
  item.mutationAudit = 'ATOMIC_AUDIT_IN_TRANSACTION'
  item.evidence.push({ ref: 'apps/union-eyes/lib/api/crud-factory.ts', quote: 'await persistAtomicAudit(tx, {' })
  assert.ok(hasProblem(run(refused), /refuses the write, so it cannot be recorded as audited/))
  const dropped = fixture()
  const real = record(dropped, BILLING_POST)
  real.manifestCorrections = []
  assert.ok(hasProblem(run(dropped), /declared atomically audited by the manifest but the source does not show it/))
})

test('5. a route assigned to a capability outside its business domain fails', () => {
  const args = fixture()
  record(args, BILLING_POST).capabilityId = 'UE-CAP-K-010'
  const result = run(args)
  assert.ok(hasProblem(result, /does not cover/))
  assert.ok(hasProblem(result, /ownership register names/))
  const both = fixture()
  const item = record(both, BILLING_POST)
  item.capabilityId = 'UE-CAP-K-010'
  item.domain = 'CASE_INGESTION'
  both.entries.find((entry) => `${entry[0]}|${entry[1]}` === BILLING_POST)[3] = 'UE-CAP-K-010'
  assert.ok(hasProblem(run(both), /but the route belongs to UE-CAP-D-003/))
})

test('6. a previously classified operation silently reverted to undecided fails', () => {
  const args = fixture()
  const entry = args.entries.find((item) => `${item[0]}|${item[1]}` === CRUD_POST)
  entry[3] = 'UE-OMIT-ROUTE-DOMAIN-SCOPE'
  entry[4] = 'SCOPE_UNDECIDED'
  assert.ok(hasProblem(run(args), /silently reverted to SCOPE_UNDECIDED/))
  const anchored = fixture()
  const old = anchored.anchoredEntries.find((item) => item[4] !== 'SCOPE_UNDECIDED')
  const live = anchored.entries.find((item) => item[0] === old[0] && item[1] === old[1])
  live[4] = 'SCOPE_UNDECIDED'
  assert.ok(hasProblem(run(anchored), new RegExp(`${old[0].replace(/[[\]/.]/g, '\\$&')}\\|${old[1]} was silently reverted`)))
  const downgraded = fixture()
  record(downgraded, CRUD_POST).status = 'UNRESOLVED'
  assert.ok(run(downgraded).problems.length > 0)
})

test('7. a route-method operation disappearing from the tranche fails', () => {
  const dropped = fixture()
  dropped.manifest.operations = dropped.manifest.operations.slice(1)
  const result = run(dropped)
  assert.ok(hasProblem(result, /exactly 100 operations/))
  assert.ok(hasProblem(result, /not in the frozen tranche/))
  const gone = fixture()
  gone.universe.delete(gone.manifest.operations[10])
  assert.ok(hasProblem(run(gone), /does not exist in the route-method universe/))
  const unrecorded = fixture()
  unrecorded.classification.operations = unrecorded.classification.operations.filter((item) => item.id !== CRUD_POST)
  assert.ok(hasProblem(run(unrecorded), /has no classification record/))
})

test('8. a change to tranche order or membership without a versioned reason fails', () => {
  const swapped = fixture()
  const ops = swapped.manifest.operations
  ;[ops[3], ops[4]] = [ops[4], ops[3]]
  assert.ok(hasProblem(run(swapped), /not deterministic ascending/))
  const rehashed = fixture()
  const sorted = rehashed.manifest.operations.slice()
  sorted.splice(5, 1)
  sorted.push('zzz/route.ts|GET')
  rehashed.manifest.operations = sorted
  rehashed.manifest.operationsHash = trancheHash(sorted)
  rehashed.manifest.versionLog[0].operationsHash = rehashed.manifest.operationsHash
  const result = run(rehashed)
  assert.ok(hasProblem(result, /without a new versioned reason/))
  assert.ok(hasProblem(result, /first 100 SCOPE_UNDECIDED operations/))
  const bumped = fixture()
  bumped.manifest.version = 2
  assert.ok(hasProblem(run(bumped), /tranche version 2 has no versionLog entry/))
  const reasonless = fixture()
  reasonless.manifest.version = 2
  reasonless.manifest.versionLog.push({ version: 2, operationsHash: reasonless.manifest.operationsHash, reason: 'changed' })
  assert.ok(hasProblem(run(reasonless), /no versioned reason/))
})

test('Gate 0 stays IN_PROGRESS and carries the unjustified exposures as Gate 14 release-blocking defects', () => {
  const result = validateGate0(matrix)
  assert.deepEqual(result.problems, [])
  assert.ok(!result.blockers.some((item) => item.code === 'ROUTE_UNJUSTIFIED_EXPOSURE'))
  const releaseBlocking = result.gateAcceptanceBlockers.filter((item) => item.kind === 'RELEASE_BLOCKING_ROUTE_EXPOSURE')
  assert.deepEqual(releaseBlocking.map((item) => item.file).sort(), ['docs/openapi/route.ts|GET', 'docs/route.ts|GET', 'version/route.ts|GET'])
  assert.ok(releaseBlocking.every((item) => item.blocksGates.includes(14) && item.releaseBlocking === true))
  assert.equal(result.summary.route.unauthenticatedWithoutRecordedJustification, 0)
  assert.equal(result.summary.route.scopeUndecided, 873)
  assert.equal(matrix.gate0Verdict, 'IN_PROGRESS')
})

test('the Gate 0B.1 validator still reports the three unjustified exposures as a blocker when no later tranche registers them', () => {
  const result = run(fixture())
  assert.deepEqual(result.problems, [])
  assert.ok(result.blockers.some((item) => item.code === 'ROUTE_UNJUSTIFIED_EXPOSURE' && item.operations.length === 3))
})

test('Gate 0 rejects a tampered classification register end to end', () => {
  const classification = clone(base.classification0b1)
  classification.operations.find((item) => item.id === CRUD_POST).evidence = []
  const result = validateGate0(matrix, { classification0b1: classification })
  assert.ok(result.problems.some((problem) => /no source evidence/.test(problem)))
  const unpinned = validateGate0(matrix, { classification0b1: classification, classificationPinProblems: [] })
  assert.ok(unpinned.problems.some((problem) => /no source evidence/.test(problem)))
})
