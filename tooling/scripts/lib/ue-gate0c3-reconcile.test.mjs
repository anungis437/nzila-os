import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { defectHash } from './ue-gate0b7-release-dispositions.mjs'
import { buildFiles } from './ue-gate0c3-build.mjs'
import {
  ANCHOR_COMMIT,
  CARBON_DECISION_ID,
  CARBON_OPERATIONS,
  CERTIFICATION_RULING_DOC,
  CHALLENGE_IDS,
  CHALLENGE_POSITION,
  DOCS_0C3,
  EXPOSURE_OPERATIONS,
  FILES_0C3,
  FROZEN_TOTALS,
  OPL_DEFECTS,
  TRACKED_ITEMS,
  TRANCHE_FILES,
} from './ue-gate0c3-ids.mjs'
import { loadDocs, loadFrozen, loadRegisters, loadSources } from './ue-gate0c3-load.mjs'
import { buildAll, serialize, sha256Of } from './ue-gate0c3-reconcile.mjs'
import { releaseDebtSummary, validateReleaseDebt } from './ue-gate0c3-validate.mjs'
import { loadContext, validateGate0 } from './ue-gate0-scope-lock.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const clone = (value) => JSON.parse(JSON.stringify(value))
const readText = (file) => (existsSync(join(ROOT, file)) ? readFileSync(join(ROOT, file), 'utf8') : null)
const atAnchor = (file) => execFileSync('git', ['show', `${ANCHOR_COMMIT}:${file}`], { cwd: ROOT, maxBuffer: 256 * 1024 * 1024 })
const sha = (file) => createHash('sha256').update(readFileSync(join(ROOT, file))).digest('hex')

const live = { src: loadSources(), registers: loadRegisters(), docs: loadDocs(), frozen: loadFrozen() }
const fresh = () => ({ src: clone(live.src), registers: clone(live.registers), docs: { ...live.docs }, frozen: clone(live.frozen), readText })
const problemsOf = (state) => validateReleaseDebt({ registers: state.registers, src: state.src, frozen: state.frozen, docs: state.docs, readText: state.readText })
const has = (problems, code) => problems.some((problem) => problem.startsWith(`${code}:`))
const itemOf = (state, sourceId) => state.registers.debt.items.find((item) => item.sourceId === sourceId)
const assessmentOf = (state, id) => state.registers.assessment.assessments.find((item) => item.defectId === id)
const defectOf = (state, id) => state.src.classification.defectRegister.find((defect) => defect.id === id)
const dropItem = (state, sourceId) => {
  state.registers.debt.items = state.registers.debt.items.filter((item) => item.sourceId !== sourceId)
}

const { registers } = live

test('the committed Gate 0C.3 registers validate against the live sources and the accepted Gate 0C.2 commit', () => {
  assert.deepEqual(validateReleaseDebt({ registers: live.registers, src: live.src, frozen: live.frozen, docs: live.docs, readText, liveFileSha: sha }), [])
})

test('the registers and documents are the deterministic regeneration of the sources', () => {
  const files = buildFiles(ROOT, live.src)
  assert.equal(Object.keys(files).length, Object.keys(FILES_0C3).length + Object.keys(DOCS_0C3).length)
  for (const [file, text] of Object.entries(files)) assert.equal(readFileSync(join(ROOT, file), 'utf8'), text, `${file} differs from its regeneration`)
  assert.equal(serialize(buildAll(live.src).debt), serialize(buildAll(live.src).debt))
})

test('the frozen totals are validated against the registers and not forced onto them', () => {
  const observed = registers.debt.frozenEvidence.totals
  assert.deepEqual(Object.keys(observed), Object.keys(FROZEN_TOTALS))
  for (const [name, accepted] of Object.entries(FROZEN_TOTALS)) {
    assert.equal(observed[name].accepted, accepted)
    assert.equal(observed[name].observed, accepted, `${name} observed ${observed[name].observed}`)
    assert.equal(observed[name].matchesAccepted, true)
  }
  assert.equal(live.src.queue.entries.length, 71)
  assert.equal(live.src.classification.defectRegister.length, 777)
  assert.equal(live.src.matrix.routeInventoryTotals.operations, 1646)
})

test('all 71 earlier HIGH defects are assessed one by one, proposed and not accepted, with their frozen hash and severity', () => {
  const { assessment } = registers
  assert.equal(assessment.assessments.length, 71)
  assert.deepEqual(assessment.assessments.map((item) => item.defectId), live.src.queue.entries.map((entry) => entry.defectId))
  assert.deepEqual(assessment.totals.byProposedDisposition, { CONDITIONALLY_BLOCKING: 25, RELEASE_BLOCKING: 43, REVIEW_REQUIRED: 3 })
  for (const item of assessment.assessments) {
    const defect = live.src.classification.defectRegister.find((entry) => entry.id === item.defectId)
    assert.equal(item.frozenRecord.defectSha256, defectHash(defect))
    assert.equal(item.frozenRecord.originalSeverity, 'HIGH')
    assert.equal(item.frozenRecord.modifiedByGate0C3, false)
    assert.equal(item.proposedDisposition.state, 'PROPOSED_NOT_ACCEPTED')
    assert.equal(item.proposedDisposition.acceptedBy, null)
    assert.equal(item.proposedDisposition.severityChanged, false)
    assert.equal(item.containment.verified, false)
    assert.deepEqual(item.containment.executedProof, [])
    assert.equal(item.evidence.basis, 'SOURCE_INFERENCE_NO_EXECUTED_PROOF')
    assert.ok(item.sourceExposure.statement && item.impact.classes.length > 0)
  }
  const reviewRequired = assessment.assessments.filter((item) => item.proposedDisposition.value === 'REVIEW_REQUIRED')
  assert.equal(reviewRequired.length, 3)
  for (const item of reviewRequired) assert.ok(item.proposedDisposition.reviewReasons.length > 20)
})

test('the release-debt index deduplicates, keeps six record types distinct and owns every obligation', () => {
  const { debt } = registers
  const dispositions = live.src.classification.defectRegister.filter((defect) => defect.releaseDisposition)
  assert.equal(dispositions.filter((defect) => defect.releaseDisposition.disposition === 'RELEASE_BLOCKING').length, 32)
  assert.equal(dispositions.filter((defect) => defect.releaseDisposition.disposition === 'CONDITIONALLY_BLOCKING').length, 41)
  const sourceIds = debt.items.map((item) => item.sourceId)
  assert.equal(new Set(sourceIds).size, sourceIds.length)
  assert.equal(debt.totals.uniqueItems, 150)
  assert.equal(debt.totals.listedInstances - debt.totals.duplicateInflationAvoided, 150)
  for (const defect of dispositions) assert.ok(sourceIds.includes(defect.id), `${defect.id} is missing`)
  for (const entry of live.src.queue.entries) assert.ok(sourceIds.includes(entry.defectId))
  for (const id of Object.keys(TRACKED_ITEMS)) assert.ok(sourceIds.includes(id))
  for (const item of debt.items) {
    const obligation = item.engineeringObligation
    assert.ok(obligation.ownerCapabilityId && obligation.targetGate !== undefined && obligation.sourceReference.register && obligation.acceptanceCondition.behavior)
    assert.equal(obligation.ownerBasis, 'ACCOUNTABILITY_NOT_AUTHORIZATION')
    assert.equal(obligation.state, 'OPEN')
    assert.equal(item.recordTypes.acceptedReleaseDecision, null)
  }
  assert.deepEqual(debt.recordTypes, ['defect', 'releaseDispositionAssessment', 'challenge', 'exposureContract', 'engineeringRepairObligation', 'acceptedReleaseDecision'])
  assert.equal(debt.totals.acceptedReleaseDecisions, 0)
  assert.equal(debt.totals.closedObligations, 0)
  for (const obligation of debt.handoffObligations) assert.equal(obligation.closed, false)
})

test('both OPL challenges are preserved and the original conditional dispositions stay frozen', () => {
  const { challenges } = registers
  assert.deepEqual(challenges.challenges.map((challenge) => challenge.challengeId), CHALLENGE_IDS)
  for (const challenge of challenges.challenges) {
    assert.equal(challenge.challengePosition, CHALLENGE_POSITION)
    assert.equal(challenge.frozenRecord.disposition, 'CONDITIONALLY_BLOCKING')
    assert.equal(challenge.treatment.challengePreserved, true)
    assert.equal(challenge.treatment.supersededBy, null)
    assert.equal(challenge.containment.verified, false)
    assert.equal(challenge.containment.executedProofOnFile, 0)
  }
  assert.equal(challenges.flag.enforcedInAllReleasePaths, false)
  assert.equal(challenges.flagDependentCount, 8)
  assert.equal(challenges.newSourceEvidence.materialChange, false)
  assert.deepEqual(live.src.challenges, JSON.parse(atAnchor(FILES_0C3.challenges.replace('ue-opl-challenge-treatment-0c3', 'ue-release-disposition-challenges')).toString()))
})

test('carbon is decision-ready with three options, one recommendation and nothing selected', () => {
  const { carbon } = registers
  assert.equal(carbon.decisionId, CARBON_DECISION_ID)
  assert.deepEqual(carbon.options.map((option) => option.id), ['OPT-PLATFORM-OWNED-MEASURED', 'OPT-ORGANIZATION-OWNED-MEASURED', 'OPT-RETIRE-ROUTES'])
  for (const option of carbon.options) assert.deepEqual([option.selected, option.adopted], [false, false])
  assert.equal(carbon.recommendation.optionId, 'OPT-RETIRE-ROUTES')
  assert.equal(carbon.recommendation.recommendationOnly, true)
  assert.equal(carbon.selected, null)
  assert.equal(carbon.decisionRecord, null)
  assert.deepEqual(carbon.operations.map((operation) => operation.operationId), CARBON_OPERATIONS)
  for (const operation of carbon.operations) {
    assert.equal(operation.inventoryClassification, 'DECISION_BOUND_SCOPE_EXCEPTION')
    assert.equal(operation.countedAsOwned, false)
  }
  assert.equal(carbon.preservedObligation.gate, 8)
  assert.equal(carbon.preservedObligation.satisfiedByGate0C3, false)
  assert.equal(sha(live.src.matrix.decisionBoundExceptions.file), live.src.matrix.decisionBoundExceptions.sha256)
  assert.equal(Buffer.compare(readFileSync(join(ROOT, live.src.matrix.decisionBoundExceptions.file)), atAnchor(live.src.matrix.decisionBoundExceptions.file)), 0)
})

test('the decision index keeps five families distinct, adopts nothing and never lets product acceptance grant authority', () => {
  const { decisions } = registers
  assert.equal(decisions.totals.distinctRecords, 138)
  assert.deepEqual(decisions.totals.byFamily, { BASELINE_INSTITUTIONAL_AUTHORITY: 32, BASELINE_PRODUCT: 14, GATE_0C2_PRODUCT: 10, INVENTORY_INSTITUTIONAL: 79, PERSONA_RATIFICATION: 3 })
  assert.equal(decisions.totals.adopted, 0)
  assert.equal(decisions.totals.exactDuplicateIds.length, 0)
  for (const record of decisions.decisions) {
    assert.equal(record.adopted, false)
    assert.equal(record.grantsInstitutionalAuthority, false)
    const product = ['BASELINE_PRODUCT', 'GATE_0C2_PRODUCT', 'PERSONA_RATIFICATION'].includes(record.family)
    assert.equal(record.ownerRole, product ? 'AUTHORIZED_PRODUCT_OWNER' : 'INSTITUTION_TO_BE_NAMED')
  }
  for (const overlap of decisions.overlaps) assert.deepEqual([overlap.merged, overlap.closes], [false, false])
})

test('overlapping defects are mapped without a merge or a severity change', () => {
  const { relationships } = registers
  assert.equal(relationships.totals.defectsMerged, 0)
  assert.equal(relationships.totals.severitiesChanged, 0)
  const severities = relationships.perCapitaSeverityPair.members.map((member) => member.severity).sort()
  assert.deepEqual(severities, ['HIGH', 'MEDIUM'])
  assert.equal(relationships.challengePairs.length, 2)
  assert.equal(relationships.exposures.length, 3)
  assert.deepEqual(relationships.exposures.map((item) => item.operationId), EXPOSURE_OPERATIONS)
  assert.equal(relationships.ratchets.relatedRegisterDefect.merged, false)
})

test('a Gate 0 verdict is separated from release acceptance', () => {
  const { closure } = registers
  assert.equal(closure.gate0Verdict, 'IN_PROGRESS')
  assert.equal(closure.level1.certifiable, false)
  assert.ok(closure.level1.certificationBlockers.length >= 5)
  assert.equal(closure.level2.releaseAuthorization, 'NOT_GRANTED')
  assert.equal(closure.level2.productionGo, false)
  assert.equal(closure.level2.readinessGate.ruling, 'NO_GO')
  assert.match(readText(CERTIFICATION_RULING_DOC), /UE_SAAS_OPERATIONAL_READINESS[^\n]*NO_GO/)
  assert.ok(closure.level2.criteria.every((criterion) => ['OPEN', 'NOT_STARTED'].includes(criterion.state)))
})

test('the historical route, capability, tranche and Gate 0C.2 artifacts are byte-identical to the accepted commit', () => {
  const frozenFiles = [
    ...TRANCHE_FILES,
    'docs/union-eyes/convergence/register/ue-release-disposition-review-queue.json',
    'docs/union-eyes/convergence/register/ue-release-disposition-challenges.json',
    'docs/union-eyes/convergence/register/ue-route-decision-bound-exceptions.json',
    'docs/union-eyes/convergence/register/ue-gate0c-handoff-register.json',
    'docs/union-eyes/convergence/register/ue-convergence-ratchets.json',
    'docs/union-eyes/convergence/register/ue-persona-proposed-baseline-decisions.json',
    'docs/union-eyes/convergence/register/ue-persona-product-decision-register-0c2.json',
    'docs/union-eyes/convergence/register/ue-persona-requirement-reconciliation-0c2.json',
  ]
  for (const file of frozenFiles) assert.equal(Buffer.compare(readFileSync(join(ROOT, file)), atAnchor(file)), 0, `${file} changed since ${ANCHOR_COMMIT}`)
  for (const key of ['routeInventoryTotals', 'personaCompleteness', 'proposedPersonaBaselines']) assert.deepEqual(live.src.matrix[key], live.frozen.matrix[key])
  assert.deepEqual(live.src.matrix.capabilities.map((capability) => capability.id), live.frozen.matrix.capabilities.map((capability) => capability.id))
  for (const persona of ['steward', 'representative', 'financial-officer']) assert.equal(live.src.matrix.personaCompleteness.find((item) => item.persona === persona).resolved, false)
})

test('validateGate0 carries the Gate 0C.3 check, summary and an unchanged IN_PROGRESS verdict', () => {
  const context = loadContext(ROOT)
  const matrix = JSON.parse(readFileSync(join(ROOT, 'docs/union-eyes/convergence/register/ue-pre-vs-engineering-completion.json'), 'utf8'))
  const result = validateGate0(matrix, context)
  assert.deepEqual(result.problems, [])
  assert.equal(result.summary.releaseDebt0c3.uniqueDebtItems, 150)
  assert.equal(result.summary.releaseDebt0c3.gate0Verdict, 'IN_PROGRESS')
  assert.equal(matrix.gate0Verdict, 'IN_PROGRESS')
  assert.equal(releaseDebtSummary({ registers: live.registers }).sha256, sha256Of(live.registers.debt))
  const tampered = { ...context, reconcile0c3: { ...context.reconcile0c3, registers: clone(context.reconcile0c3.registers) } }
  tampered.reconcile0c3.registers.carbon.selected = 'OPT-RETIRE-ROUTES'
  assert.ok(validateGate0(matrix, tampered).problems.some((problem) => problem.startsWith('RELEASE-DEBT-0C3: CARBON-ADOPTED:')))
})

/* ------------------------------------------------ negative tests ------------------------------------------------ */

test('rejects a missing earlier HIGH defect', () => {
  const state = fresh()
  state.registers.assessment.assessments.pop()
  assert.ok(has(problemsOf(state), 'HIGH-MISSING'))
  const queue = fresh()
  queue.src.queue.entries.pop()
  const problems = problemsOf(queue)
  assert.ok(has(problems, 'BUILD-FAILED') || has(problems, 'HIGH-MISSING'))
  const history = fresh()
  history.registers.assessment.assessments.shift()
  assert.ok(has(problemsOf(history), 'HIGH-MISSING'))
})

test('rejects a changed frozen hash', () => {
  const state = fresh()
  assessmentOf(state, state.registers.assessment.assessments[0].defectId).frozenRecord.defectSha256 = 'f'.repeat(64)
  assert.ok(has(problemsOf(state), 'FROZEN-HASH'))
  const debt = fresh()
  debt.registers.debt.items.find((item) => item.frozenDefectSha256).frozenDefectSha256 = '0'.repeat(64)
  assert.ok(has(problemsOf(debt), 'FROZEN-HASH'))
  const defect = fresh()
  defectOf(defect, defect.registers.assessment.assessments[0].defectId).title = 'A rewritten historical title'
  assert.ok(has(problemsOf(defect), 'FROZEN-HASH'))
  assert.ok(has(problemsOf(defect), 'HISTORY-MUTATED'))
})

test('rejects a changed severity', () => {
  const state = fresh()
  assessmentOf(state, state.registers.assessment.assessments[0].defectId).frozenRecord.originalSeverity = 'MEDIUM'
  assert.ok(has(problemsOf(state), 'SEVERITY-CHANGED'))
  const downgraded = fresh()
  const cluster = downgraded.registers.relationships.clusters.find((entry) => entry.members.some((member) => member.severity === 'HIGH'))
  cluster.members.find((member) => member.severity === 'HIGH').severity = 'MEDIUM'
  assert.ok(has(problemsOf(downgraded), 'SEVERITY-CHANGED'))
  const merged = fresh()
  merged.registers.relationships.totals.defectsMerged = 1
  assert.ok(has(problemsOf(merged), 'SEVERITY-CHANGED'))
  const perCapita = fresh()
  perCapita.registers.relationships.perCapitaSeverityPair.members.forEach((member) => {
    member.severity = 'HIGH'
  })
  assert.ok(has(problemsOf(perCapita), 'SEVERITY-CHANGED'))
})

test('rejects invented containment', () => {
  const state = fresh()
  const item = state.registers.assessment.assessments[0]
  item.containment.verified = true
  item.containment.executedProof = [{ ref: 'run-1' }]
  assert.ok(has(problemsOf(state), 'INVENTED-CONTAINMENT'))
  const challenge = fresh()
  challenge.registers.challenges.challenges[0].containment.verified = true
  challenge.registers.challenges.challenges[0].containment.executedProofOnFile = 1
  assert.ok(has(problemsOf(challenge), 'INVENTED-CONTAINMENT'))
  const flag = fresh()
  flag.registers.challenges.flag.enforcedInAllReleasePaths = true
  assert.ok(has(problemsOf(flag), 'INVENTED-CONTAINMENT'))
})

test('rejects an unresolved item classified as approved', () => {
  const state = fresh()
  const item = state.registers.assessment.assessments[0]
  item.proposedDisposition.state = 'ACCEPTED'
  item.proposedDisposition.acceptedBy = 'Engineering'
  assert.ok(has(problemsOf(state), 'UNRESOLVED-AS-APPROVED'))
  const closed = fresh()
  closed.registers.debt.items[0].engineeringObligation.state = 'CLOSED'
  assert.ok(has(problemsOf(closed), 'UNRESOLVED-AS-APPROVED'))
  const decided = fresh()
  decided.registers.debt.items[0].recordTypes.acceptedReleaseDecision = 'REL-1'
  assert.ok(has(problemsOf(decided), 'UNRESOLVED-AS-APPROVED'))
  const downgraded = fresh()
  const blocking = downgraded.registers.debt.items.find((entry) => entry.reportingClass === 'RELEASE_BLOCKING')
  blocking.reportingClass = 'TRACKED_ENGINEERING_DEBT'
  assert.ok(has(problemsOf(downgraded), 'UNRESOLVED-AS-APPROVED'))
  const underEvidenced = fresh()
  underEvidenced.registers.assessment.assessments.find((entry) => entry.proposedDisposition.value === 'REVIEW_REQUIRED').proposedDisposition.reviewReasons = null
  assert.ok(has(problemsOf(underEvidenced), 'UNRESOLVED-AS-APPROVED'))
})

test('rejects a challenge that is silently removed or superseded', () => {
  const removed = fresh()
  removed.registers.challenges.challenges.pop()
  assert.ok(has(problemsOf(removed), 'CHALLENGE-REMOVED'))
  const superseded = fresh()
  superseded.registers.challenges.challenges[0].treatment.supersededBy = 'FROZEN-DISPOSITION'
  assert.ok(has(problemsOf(superseded), 'CHALLENGE-REMOVED'))
  const softened = fresh()
  softened.registers.challenges.challenges[1].challengePosition = 'CONDITIONALLY_BLOCKING'
  assert.ok(has(problemsOf(softened), 'CHALLENGE-REMOVED'))
  const source = fresh()
  source.src.challenges.challenges.pop()
  assert.ok(has(problemsOf(source), 'CHALLENGE-REMOVED') || has(problemsOf(source), 'BUILD-FAILED'))
  const flat = fresh()
  const item = itemOf(flat, OPL_DEFECTS[0])
  item.reportingClass = 'CONDITIONALLY_BLOCKING'
  assert.ok(has(problemsOf(flat), 'CHALLENGE-REMOVED'))
  const pair = fresh()
  pair.registers.relationships.challengePairs[0].challengeSupersededByFrozenDisposition = true
  assert.ok(has(problemsOf(pair), 'CHALLENGE-REMOVED'))
})

test('rejects duplicate defect inflation', () => {
  const doubled = fresh()
  doubled.registers.debt.items.push(clone(doubled.registers.debt.items[0]))
  assert.ok(has(problemsOf(doubled), 'DUPLICATE-INFLATION'))
  const inflated = fresh()
  inflated.registers.debt.totals.uniqueItems += 3
  assert.ok(has(problemsOf(inflated), 'DUPLICATE-INFLATION'))
  const twice = fresh()
  twice.registers.assessment.assessments.push(clone(twice.registers.assessment.assessments[0]))
  assert.ok(has(problemsOf(twice), 'DUPLICATE-INFLATION'))
  const decisions = fresh()
  decisions.registers.decisions.decisions.push(clone(decisions.registers.decisions.decisions[0]))
  assert.ok(has(problemsOf(decisions), 'DUPLICATE-INFLATION'))
  const classes = fresh()
  classes.registers.debt.totals.byReportingClass.RELEASE_BLOCKING += 1
  assert.ok(has(problemsOf(classes), 'DUPLICATE-INFLATION'))
})

test('rejects carbon adoption without decision evidence', () => {
  const selected = fresh()
  selected.registers.carbon.selected = 'OPT-RETIRE-ROUTES'
  assert.ok(has(problemsOf(selected), 'CARBON-ADOPTED'))
  const option = fresh()
  option.registers.carbon.options[0].adopted = true
  assert.ok(has(problemsOf(option), 'CARBON-ADOPTED'))
  const owned = fresh()
  owned.registers.carbon.operations[0].countedAsOwned = true
  assert.ok(has(problemsOf(owned), 'CARBON-ADOPTED'))
  const record = fresh()
  record.registers.carbon.decisionRecord = 'minutes.pdf'
  assert.ok(has(problemsOf(record), 'CARBON-ADOPTED'))
  const obligation = fresh()
  obligation.registers.carbon.preservedObligation.satisfiedByGate0C3 = true
  assert.ok(has(problemsOf(obligation), 'CARBON-ADOPTED'))
  const index = fresh()
  index.registers.decisions.decisions.find((decision) => decision.decisionId === CARBON_DECISION_ID).adopted = true
  assert.ok(has(problemsOf(index), 'CARBON-ADOPTED'))
})

test('rejects persona product acceptance represented as an institutional grant', () => {
  const owner = fresh()
  owner.registers.decisions.decisions.find((decision) => decision.family === 'INVENTORY_INSTITUTIONAL').ownerRole = 'AUTHORIZED_PRODUCT_OWNER'
  assert.ok(has(problemsOf(owner), 'PRODUCT-AS-INSTITUTIONAL'))
  const grant = fresh()
  grant.registers.decisions.decisions.find((decision) => decision.family === 'PERSONA_RATIFICATION').grantsInstitutionalAuthority = true
  assert.ok(has(problemsOf(grant), 'PRODUCT-AS-INSTITUTIONAL'))
  const source = fresh()
  source.src.productDecisions.records[0].institutionalGrants.issuedByThisRecord = 5
  assert.ok(has(problemsOf(source), 'PRODUCT-AS-INSTITUTIONAL'))
  const reversed = fresh()
  reversed.registers.decisions.decisions.find((decision) => decision.family === 'GATE_0C2_PRODUCT').ownerRole = 'INSTITUTION_TO_BE_NAMED'
  assert.ok(has(problemsOf(reversed), 'PRODUCT-AS-INSTITUTIONAL'))
})

test('rejects an unresolved decision marked adopted', () => {
  const adopted = fresh()
  adopted.registers.decisions.decisions[0].adopted = true
  assert.ok(has(problemsOf(adopted), 'DECISION-ADOPTED'))
  const state = fresh()
  state.registers.decisions.decisions[1].currentState = 'ACCEPTED'
  assert.ok(has(problemsOf(state), 'DECISION-ADOPTED'))
  const totals = fresh()
  totals.registers.decisions.totals.adopted = 1
  assert.ok(has(problemsOf(totals), 'DECISION-ADOPTED'))
  const inventory = fresh()
  inventory.src.classification.institutionalDecisions[0].status = 'ADOPTED'
  assert.ok(has(problemsOf(inventory), 'DECISION-ADOPTED'))
  const merged = fresh()
  merged.registers.decisions.overlaps[0].merged = true
  assert.ok(has(problemsOf(merged), 'DECISION-ADOPTED'))
  const ratified = fresh()
  ratified.src.productDecisions.records[0].state = 'ACCEPTED_BY_AUTHORIZED_PRODUCT_OWNER'
  assert.ok(has(problemsOf(ratified), 'DECISION-ADOPTED'))
})

test('rejects release-blocking obligations omitted from the debt index', () => {
  const blocking = fresh()
  const target = blocking.registers.debt.items.find((item) => item.reportingClass === 'RELEASE_BLOCKING' && item.frozenDisposition === 'RELEASE_BLOCKING')
  dropItem(blocking, target.sourceId)
  assert.ok(has(problemsOf(blocking), 'DEBT-OMISSION'))
  const conditional = fresh()
  dropItem(conditional, conditional.registers.debt.items.find((item) => item.reportingClass === 'CONDITIONALLY_BLOCKING').sourceId)
  assert.ok(has(problemsOf(conditional), 'DEBT-OMISSION'))
  const awaiting = fresh()
  dropItem(awaiting, awaiting.registers.assessment.assessments[3].defectId)
  assert.ok(has(problemsOf(awaiting), 'DEBT-OMISSION'))
  const tracked = fresh()
  dropItem(tracked, Object.keys(TRACKED_ITEMS)[0])
  assert.ok(has(problemsOf(tracked), 'DEBT-OMISSION'))
  const exposure = fresh()
  dropItem(exposure, 'DEF-0B1-DOCS-UNAUTH-API-SURFACE')
  assert.ok(has(problemsOf(exposure), 'DEBT-OMISSION'))
  const mapped = fresh()
  mapped.registers.relationships.exposures.pop()
  assert.ok(has(problemsOf(mapped), 'DEBT-OMISSION'))
  const handoff = fresh()
  handoff.registers.debt.handoffObligations.pop()
  assert.ok(has(problemsOf(handoff), 'DEBT-OMISSION'))
})

test('rejects an obligation without an owner, a target gate, a source reference or an acceptance condition', () => {
  for (const mutate of [
    (item) => delete item.engineeringObligation.ownerCapabilityId,
    (item) => {
      item.engineeringObligation.targetGate = null
    },
    (item) => delete item.engineeringObligation.sourceReference,
    (item) => delete item.engineeringObligation.acceptanceCondition,
  ]) {
    const state = fresh()
    mutate(state.registers.debt.items[0])
    assert.ok(has(problemsOf(state), 'OWNERSHIP-INCOMPLETE'))
  }
  const decision = fresh()
  delete decision.registers.decisions.decisions[0].requiredApprovalEvidence
  assert.ok(has(problemsOf(decision), 'OWNERSHIP-INCOMPLETE'))
})

test('rejects a Gate 0 verdict represented as a release authorization or production GO', () => {
  const go = fresh()
  go.registers.closure.level2.productionGo = true
  assert.ok(has(problemsOf(go), 'GATE0-AS-GO'))
  const granted = fresh()
  granted.registers.closure.level2.releaseAuthorization = 'GRANTED'
  assert.ok(has(problemsOf(granted), 'GATE0-AS-GO'))
  const verdict = fresh()
  verdict.registers.closure.gate0Verdict = 'CERTIFIED'
  assert.ok(has(problemsOf(verdict), 'GATE0-AS-GO'))
  const matrix = fresh()
  matrix.src.matrix.gate0Verdict = 'CERTIFIED'
  assert.ok(has(problemsOf(matrix), 'GATE0-AS-GO'))
  const ruling = fresh()
  ruling.registers.closure.level2.readinessGate.ruling = 'GO'
  assert.ok(has(problemsOf(ruling), 'GATE0-AS-GO'))
  const text = fresh()
  text.readText = (file) => (file === CERTIFICATION_RULING_DOC ? 'UE_SAAS_OPERATIONAL_READINESS = GO' : readText(file))
  assert.ok(has(problemsOf(text), 'GATE0-AS-GO'))
  const certifiable = fresh()
  certifiable.registers.closure.level1.certifiable = true
  assert.ok(has(problemsOf(certifiable), 'GATE0-AS-GO'))
  const doc = fresh()
  doc.docs[DOCS_0C3.index] += '\nProduction GO: true\n'
  assert.ok(has(problemsOf(doc), 'GATE0-AS-GO'))
  const criterion = fresh()
  criterion.registers.closure.level2.criteria[0].state = 'MET'
  assert.ok(has(problemsOf(criterion), 'GATE0-AS-GO'))
})

test('rejects mutation of the historical route inventory, capability lock or frozen registers', () => {
  const totals = fresh()
  totals.src.matrix.routeInventoryTotals.operations = 1645
  assert.ok(has(problemsOf(totals), 'HISTORY-MUTATED'))
  const capabilities = fresh()
  capabilities.src.matrix.capabilities.pop()
  assert.ok(has(problemsOf(capabilities), 'HISTORY-MUTATED') || has(problemsOf(capabilities), 'BUILD-FAILED'))
  const operation = fresh()
  operation.src.classification.operations[0].status = 'RETIRED_501'
  assert.ok(has(problemsOf(operation), 'HISTORY-MUTATED'))
  const pin = fresh()
  pin.src.matrix.routeClassification0b4.files.classification.sha256 = 'a'.repeat(64)
  assert.ok(has(problemsOf(pin), 'HISTORY-MUTATED'))
  const exceptions = fresh()
  exceptions.src.exceptions.exceptions.pop()
  assert.ok(has(problemsOf(exceptions), 'HISTORY-MUTATED'))
  const flagged = fresh()
  flagged.registers.assessment.assessments[0].frozenRecord.modifiedByGate0C3 = true
  assert.ok(has(problemsOf(flagged), 'HISTORY-MUTATED'))
  const baselines = fresh()
  baselines.src.matrix.personaCompleteness.find((item) => item.persona === 'steward').resolved = true
  assert.ok(has(problemsOf(baselines), 'HISTORY-MUTATED'))
})

test('rejects frozen totals that are forced or misreported', () => {
  const forced = fresh()
  forced.registers.debt.frozenEvidence.totals.defects.accepted = 776
  assert.ok(has(problemsOf(forced), 'FROZEN-TOTALS'))
  const lied = fresh()
  lied.registers.debt.frozenEvidence.totals.challenges.matchesAccepted = false
  assert.ok(has(problemsOf(lied), 'FROZEN-TOTALS'))
  const observed = fresh()
  observed.src.matrix.proposedPersonaBaselines.data.invented = {}
  observed.src.matrix.proposedPersonaBaselines.data['steward-2'] = {}
  assert.ok(problemsOf(observed).length > 0)
})

test('rejects drift, absence and claims in registers and documents', () => {
  const drift = fresh()
  drift.registers.closure.note += ' edited'
  assert.ok(has(problemsOf(drift), 'REGISTER-DRIFT'))
  const absent = fresh()
  absent.registers.carbon = null
  assert.ok(has(problemsOf(absent), 'REGISTER-ABSENT'))
  const doc = fresh()
  doc.docs[DOCS_0C3.assessment] += '\nedited\n'
  assert.ok(has(problemsOf(doc), 'DOC-DRIFT'))
  const noDoc = fresh()
  noDoc.docs[DOCS_0C3.carbon] = null
  assert.ok(has(problemsOf(noDoc), 'DOC-ABSENT'))
  const claim = fresh()
  claim.registers.debt.status = 'complete'
  assert.ok(has(problemsOf(claim), 'IMPLEMENTATION-CLAIM'))
  const staged = fresh()
  staged.registers.assessment.assessments[0].runtimeQualification = { ...staged.registers.assessment.assessments[0].runtimeQualification, state: 'PROVEN_IN_STAGING' }
  assert.ok(has(problemsOf(staged), 'IMPLEMENTATION-CLAIM'))
  const forgedQuote = fresh()
  forgedQuote.registers.carbon.currentBehavior.routeEvidence[0].quote = 'totalEmissions: 0.00 was never in this file'
  assert.ok(has(problemsOf(forgedQuote), 'EVIDENCE-QUOTE'))
  const unreadable = fresh()
  unreadable.registers.carbon.currentBehavior.routeEvidence[0].ref = 'apps/union-eyes/app/api/carbon/missing.ts'
  assert.ok(has(problemsOf(unreadable), 'EVIDENCE-QUOTE'))
  const stale = fresh()
  stale.registers.assessment.anchorCommit = 'a'.repeat(40)
  assert.ok(has(problemsOf(stale), 'REGISTER-DRIFT'))
})

test('reports a regeneration failure instead of validating stale registers', () => {
  const state = fresh()
  state.src.queue.entries.pop()
  const problems = problemsOf(state)
  assert.equal(problems.length, 1)
  assert.ok(has(problems, 'BUILD-FAILED'))
})
