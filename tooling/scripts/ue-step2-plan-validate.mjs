import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { buildPlan, loadCanonical, PLAN_FILES, scopeNodes, STEP1_BASELINE_SHA } from './lib/ue-step2-plan-model.mjs'

const root = process.cwd()
const markdown = [
  'docs/union-eyes/step2/UE_STEP2_MASTER_PLAN.md',
  'docs/union-eyes/step2/UE_STEP2_DEPLOYMENT_AND_DATA_PLAN.md',
  'docs/union-eyes/step2/UE_STEP2_ADVERSARIAL_REVIEW.md',
  'docs/union-eyes/step2/UE_STEP2_EXECUTION_ORDER.md',
]

function writePlan() {
  const plan = buildPlan(root)
  for (const [key, relative] of Object.entries(PLAN_FILES)) {
    const path = join(root, relative)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, `${JSON.stringify(plan[key], null, 2)}\n`)
  }
}

function fail(errors, message) {
  errors.push(message)
}

function read(relative) {
  return readFileSync(join(root, relative), 'utf8')
}

function validate() {
  const errors = []
  const { recon, coverage, go } = loadCanonical(root)
  const expectedNodes = scopeNodes(recon)
  const register = JSON.parse(read(PLAN_FILES.register))
  const matrix = JSON.parse(read(PLAN_FILES.matrix))
  const work = JSON.parse(read(PLAN_FILES.work))
  const prose = markdown.map((path) => read(path)).join('\n')

  if (register.step2PlanningComplete !== true) fail(errors, 'planning flag is not YES')
  if (register.step2EngineeringComplete !== false) fail(errors, 'engineering flag moved during planning')
  if (register.step2Accepted !== false) fail(errors, 'acceptance flag moved during planning')
  if (register.stagingGo !== 'HELD' || register.productionGo !== 'HELD') fail(errors, 'a GO flag moved')
  if (register.ueSaasOperationalReadiness !== 'NO_GO') fail(errors, 'operational readiness moved')
  if (register.fullReadiness !== 'NOT_YET_PROVEN') fail(errors, 'fullReadiness moved')
  if (register.step1.baselineSha !== STEP1_BASELINE_SHA) fail(errors, 'Step 1 baseline SHA drifted')
  if (register.step1.merged !== false || register.step1.deployed !== false) fail(errors, 'Step 1 is recorded as merged or deployed')
  if (register.servingIdentity.freshObservation !== 'UNEXECUTED') fail(errors, 'a fresh serving observation was claimed')
  if (register.servingIdentity.resolution !== 'CONFLICTED_HISTORICAL') fail(errors, 'serving conflict was resolved without a fresh observation')
  if (register.legacyInstaller.step2Applicability !== 'APPLICABLE_UNTIL_DISPROVEN') fail(errors, 'legacy gate was waived')
  if (register.legacyInstaller.notPasses !== true) fail(errors, 'legacy cases were called passes')
  if (register.deploymentCandidatePin.applicationSourceSha !== '6a60c95c9de17e9343e0414bb51766afbc190054') {
    fail(errors, 'deployment pin changed during planning')
  }

  const counts = register.denominators
  const expected = {
    functionalActionFamilies: 22,
    operationalFamiliesRequired: 13,
    stakeholderFamiliesTotal: 35,
    stakeholderFamiliesRequired: 26,
    storedRoleValues: 39,
    requiredRoleBoundaries: 34,
    lifecycleStages: 16,
    operatingModelPresets: 4,
    crossCuttingVariantsRequired: 6,
    requiredScopeNodes: 654,
    stagingCriteriaRequired: 20,
  }
  for (const [key, value] of Object.entries(expected)) {
    if (counts[key] !== value) fail(errors, `${key} is ${counts[key]}, expected ${value}`)
  }
  if (expectedNodes.length !== 654) fail(errors, `recomputation produced ${expectedNodes.length} scope nodes`)
  const actualKeys = register.scopeNodes.map((node) => `${node.inventory}:${node.id}`).sort()
  const expectedKeys = expectedNodes.map((node) => `${node.inventory}:${node.id}`).sort()
  if (actualKeys.join('\n') !== expectedKeys.join('\n')) fail(errors, 'scope node identities do not match the canonical reconciliation')
  const expectedByKey = new Map(expectedNodes.map((node) => [`${node.inventory}:${node.id}`, node.baseActionIds.join(',')]))
  for (const node of register.scopeNodes) {
    if (node.proofStatus !== 'UNEXECUTED') fail(errors, `scope node ${node.id} has a proof status`)
    if (expectedByKey.get(`${node.inventory}:${node.id}`) !== node.baseActionIds.join(',')) {
      fail(errors, `scope node ${node.inventory}:${node.id} action join drifted`)
    }
  }

  const actionIds = new Set(coverage.actions.map((action) => action.id))
  if ([...actionIds].sort().join() !== Array.from({ length: 22 }, (_, index) => `C${String(index + 1).padStart(2, '0')}`).join()) {
    fail(errors, 'functional family ids drifted')
  }
  for (const action of register.actions) {
    if (action.stagingAcceptance !== 'UNEXECUTED') fail(errors, `${action.id} was marked staging accepted`)
    if (!action.entryPoints.every((path) => existsSync(join(root, path)))) fail(errors, `${action.id} cites a missing entry point`)
  }
  const deferredOps = new Set(register.operations.filter((item) => item.scope === 'DEFERRED').map((item) => item.id))
  if ([...deferredOps].sort().join() !== 'O09,O10') fail(errors, 'deferred operations drifted')
  for (const operation of register.operations) {
    if (operation.stagingAcceptance !== 'UNEXECUTED') fail(errors, `${operation.id} was marked staging accepted`)
    if (operation.scope === 'DEFERRED' && operation.disposition !== 'DEFERRED_NOT_A_PASS') fail(errors, `${operation.id} deferred disposition drifted`)
  }

  const requiredCriteria = register.criteria.filter((item) => item.countsTowardRequired20)
  if (requiredCriteria.length !== 20) fail(errors, 'required staging criteria count drifted')
  if (requiredCriteria.some((item) => item.step2Status !== 'UNEXECUTED' || item.historicalStatus === 'PASS')) {
    fail(errors, 'a required staging criterion is marked passed')
  }
  if (go.criteria.find((item) => item.id === 'LOCAL_HOLISTIC_REGRESSION')?.requirement !== 'ADVISORY') {
    fail(errors, 'local holistic regression is no longer advisory in the source contract')
  }
  const packageIds = new Set(work.packages.map((item) => item.id))
  for (const criterion of requiredCriteria) {
    if (!packageIds.has(criterion.packageId)) fail(errors, `${criterion.id} has no work package`)
  }

  const external = new Set(['FOUNDER_MERGE_APPROVAL', 'FOUNDER_STAGING_APPLY_APPROVAL'])
  const byId = new Map(work.packages.map((item) => [item.id, item]))
  const seen = new Set()
  const stack = ['S2.08-CRITERIA']
  while (stack.length) {
    const id = stack.pop()
    if (!id || seen.has(id) || external.has(id)) continue
    seen.add(id)
    for (const dependency of byId.get(id)?.dependencies ?? []) stack.push(dependency)
  }
  for (const id of packageIds) if (!seen.has(id)) fail(errors, `${id} is not reachable from S2.08-CRITERIA`)
  for (const item of work.packages) {
    if (!item.acceptance || !item.objective || item.verificationCommands.length < 1) fail(errors, `${item.id} lacks an acceptance contract`)
    if (item.stagingGo !== 'HELD' || item.productionGo !== 'HELD') fail(errors, `${item.id} changes a GO flag`)
    if (item.engineeringComplete !== false) fail(errors, `${item.id} claims engineering completion`)
    if (item.id !== 'S2.00-PLAN' && item.verificationExecutedInS200 !== false) fail(errors, `${item.id} claims S2.00 executed its runtime proof`)
    for (const dependency of item.dependencies) {
      if (!packageIds.has(dependency) && !external.has(dependency)) fail(errors, `${item.id} depends on unknown ${dependency}`)
    }
  }

  const rows = matrix.rows
  const rowIds = new Set(rows.map((item) => item.id))
  if (rowIds.size !== rows.length) fail(errors, 'matrix row ids are not unique')
  if (rows.some((item) => item.proofStatus !== 'UNEXECUTED' || item.evidence !== null)) fail(errors, 'a matrix row claims evidence')
  for (const actionId of actionIds) {
    for (const proofClass of ['authorized-positive', 'unauthorized-negative', 'wrong-tenant', 'expired-or-revoked', 'retry-concurrency', 'persisted-readback', 'audit-event', 'presentation-en-fr-mobile', 'recovery']) {
      if (!rows.some((item) => item.actionId === actionId && item.proofClass === proofClass)) {
        fail(errors, `${actionId} lacks ${proofClass}`)
      }
    }
  }
  const requiredFamilies = new Set(recon.stakeholderCensus.stakeholderFamilies.filter((item) => item.scope === 'REQUIRED').map((item) => item.id))
  const seenFamilies = new Set(rows.filter((item) => item.actorType === 'stakeholder-family' && item.actorScope === 'REQUIRED').map((item) => item.actorId))
  for (const id of requiredFamilies) if (!seenFamilies.has(id)) fail(errors, `required stakeholder ${id} has no matrix row`)
  for (const item of rows) {
    if (item.actorScope === 'DEFERRED' && item.expectedResult !== 'DENY_DEFERRED_ACTOR_IS_NOT_A_PASS' && item.expectedResult !== 'DEFERRED_NOT_A_PASS') {
      fail(errors, `${item.id} treats a deferred actor as authorized`)
    }
  }
  const requiredRoles = recon.stakeholderCensus.roleValues.filter((item) => item.scope === 'REQUIRED').map((item) => item.id)
  for (const id of requiredRoles) {
    if (!rows.some((item) => item.actorType === 'stored-role' && item.actorId === id && item.proofClass === 'role-boundary')) {
      fail(errors, `required role ${id} has no boundary row`)
    }
    if (!rows.some((item) => item.actorId === id && item.proofClass === 'finance-boundary' && item.expectedResult === 'DENY_FINANCE_AND_DUES_IMPLEMENTATION')) {
      fail(errors, `required role ${id} has no finance denial`)
    }
  }
  for (const id of recon.stakeholderLifecycle.stages.map((item) => item.id)) {
    if (!rows.some((item) => item.proofClass === 'lifecycle-stage' && item.actorId === id)) fail(errors, `lifecycle ${id} missing`)
  }
  for (const id of recon.operatingModelScope.presets.filter((item) => item.scope === 'REQUIRED').map((item) => item.id)) {
    if (!rows.some((item) => item.proofClass === 'operating-preset' && item.actorId === id)) fail(errors, `preset ${id} missing`)
  }
  for (const variant of recon.operatingModelScope.crossCuttingVariants) {
    if (!rows.some((item) => item.proofClass === 'cross-cutting-variant' && item.actorId === variant.id)) fail(errors, `variant ${variant.id} missing`)
  }
  const lifecycleSeen = new Set(rows.filter((item) => item.actorScope === 'REQUIRED').flatMap((item) => item.lifecycleIds))
  for (const stage of recon.stakeholderLifecycle.stages) {
    if (!lifecycleSeen.has(stage.id)) fail(errors, `lifecycle ${stage.id} is not joined from a required actor`)
  }

  for (const path of register.evidencePaths) {
    if (!existsSync(join(root, path))) fail(errors, `evidence path missing: ${path}`)
  }
  for (const token of [
    'STEP_2_PLANNING_COMPLETE = YES',
    'STEP_2_ENGINEERING_COMPLETE = NO',
    'STEP_2_ACCEPTED = NO',
    'STAGING_GO = HELD',
    'PRODUCTION_GO = HELD',
    'UE_SAAS_OPERATIONAL_READINESS = NO_GO',
    'fullReadiness = NOT_YET_PROVEN',
    'APPLICABLE_UNTIL_DISPROVEN',
    'CONFLICTED_HISTORICAL',
    'O09',
    'O10',
    STEP1_BASELINE_SHA,
  ]) {
    if (!prose.includes(token)) fail(errors, `planning prose lacks ${token}`)
  }
  if (prose.includes('STAGING_GO = GO') || prose.includes('PRODUCTION_GO = GO')) fail(errors, 'prose issues a GO')

  if (errors.length) {
    for (const error of errors) console.error(`step2-plan: ${error}`)
    console.error(`step2-plan: ${errors.length} error(s)`)
    process.exit(1)
  }
  console.log(`step2-plan: 654 scope nodes, ${rows.length} matrix rows, ${work.packages.length} work packages, 20 required criteria`)
}

if (process.argv.includes('--write')) writePlan()
if (!process.argv.includes('--write')) validate()
