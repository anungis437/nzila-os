import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadContext, validateGate0 } from './ue-gate0-scope-lock.mjs'

const matrixPath = join(dirname(fileURLToPath(import.meta.url)), '../../../docs/union-eyes/convergence/register/ue-pre-vs-engineering-completion.json')
const loadMatrix = () => JSON.parse(readFileSync(matrixPath, 'utf8'))
const clone = () => JSON.parse(JSON.stringify(loadMatrix()))

test('the committed matrix matches the live inventories', () => {
  const result = validateGate0(loadMatrix())
  assert.deepEqual(result.problems, [])
  assert.equal(result.summary.registerCount, 41)
  assert.deepEqual(result.summary.registerCounts, { OPEN: 12, CLOSED: 8, IN_PROGRESS: 17, EXTERNAL_GATE: 4 })
  assert.equal(result.summary.capabilityCount, 52)
  assert.equal(result.summary.personaActionsExtracted, 102)
  assert.equal(result.summary.personaActionsMapped, 102)
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
