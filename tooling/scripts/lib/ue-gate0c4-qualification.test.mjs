import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { CARBON_DECISION_ID, CARBON_OPERATIONS, DOCS_0C3, FILES_0C3 } from './ue-gate0c3-ids.mjs'
import { buildFiles } from './ue-gate0c4-build.mjs'
import { ANCHOR_0C3_COMMIT, CERTIFICATION_CHECKS, DOCS_0C4, DOCUMENTARY_LABEL, FILES_0C4, PRESENTATION } from './ue-gate0c4-ids.mjs'
import { loadDocs, loadRegisters, loadSources } from './ue-gate0c4-load.mjs'
import { buildAll, evaluateCertification, serialize } from './ue-gate0c4-reconcile.mjs'
import { renderDocs } from './ue-gate0c4-render.mjs'
import { FLOOR, analyseRouteFile } from './ue-gate0c4-source.mjs'
import { PIN_KEY, qualificationSummary, validateQualification0c4 } from './ue-gate0c4-validate.mjs'
import { loadContext, validateGate0 } from './ue-gate0-scope-lock.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const clone = (value) => JSON.parse(JSON.stringify(value))
const readText = (file) => (existsSync(join(ROOT, file)) ? readFileSync(join(ROOT, file), 'utf8') : null)
const atAnchor = (file) => execFileSync('git', ['show', `${ANCHOR_0C3_COMMIT}:${file}`], { cwd: ROOT, maxBuffer: 256 * 1024 * 1024 })
const sha = (file) => createHash('sha256').update(readFileSync(join(ROOT, file))).digest('hex')
const shaOfBytes = (bytes) => createHash('sha256').update(bytes).digest('hex')

const live = { src: loadSources(), registers: loadRegisters(), docs: loadDocs() }
/** The reader holds functions and cannot be cloned as data; everything else is copied per test. */
const cloneSrc = (src) => {
  const { app, ...data } = src
  return { ...clone(data), app }
}
const fresh = () => ({ src: cloneSrc(live.src), registers: clone(live.registers), docs: { ...live.docs }, readText, liveFileSha: sha })
const problemsOf = (state) => validateQualification0c4({ registers: state.registers, src: state.src, docs: state.docs, readText: state.readText, liveFileSha: state.liveFileSha })
const has = (problems, code) => problems.some((problem) => problem.startsWith(`${code}:`))
const qualificationOf = (state, id) => state.registers.qualification.qualifications.find((item) => item.defectId === id)
const checklistItem = (state, id) => state.registers.certification.checklist.items.find((item) => item.id === id)

const { registers } = live
const FIRST = registers.qualification.qualifications[0].defectId

test('the committed Gate 0C.4 registers and documents validate against the live sources and the accepted Gate 0C.3 commit', () => {
  assert.deepEqual(problemsOf(fresh()), [])
})

test('the registers and documents are the deterministic regeneration of the sources', () => {
  const files = buildFiles(ROOT, live.src)
  assert.equal(Object.keys(files).length, Object.keys(FILES_0C4).length + Object.keys(DOCS_0C4).length)
  for (const [file, text] of Object.entries(files)) assert.equal(readFileSync(join(ROOT, file), 'utf8'), text, `${file} differs from its regeneration`)
  assert.equal(serialize(buildAll(live.src).qualification), serialize(buildAll(live.src).qualification))
  const rendered = renderDocs(buildAll(live.src))
  for (const file of Object.values(DOCS_0C4)) assert.equal(rendered[file], live.docs[file])
})

test('every Gate 0C.3 register and document is byte-identical to the accepted Gate 0C.3 commit', () => {
  for (const file of [...Object.values(FILES_0C3), ...Object.values(DOCS_0C3)]) assert.equal(sha(file), shaOfBytes(atAnchor(file)), `${file} differs from ${ANCHOR_0C3_COMMIT.slice(0, 12)}`)
})

test('the matrix differs from the accepted Gate 0C.3 matrix only by the Gate 0C.4 pin, and the verdict is unchanged', () => {
  const matrix = clone(live.src.base.matrix)
  assert.ok(matrix[PIN_KEY])
  delete matrix[PIN_KEY]
  assert.deepEqual(matrix, JSON.parse(atAnchor('docs/union-eyes/convergence/register/ue-pre-vs-engineering-completion.json').toString()))
  assert.equal(live.src.base.matrix.gate0Verdict, 'IN_PROGRESS')
})

test('all 71 qualifications keep their proposals as proposals with empty approval fields and no changed severity', () => {
  const { qualification } = registers
  assert.equal(qualification.qualifications.length, 71)
  assert.deepEqual(qualification.qualifications.map((item) => item.defectId), live.src.base.queue.entries.map((entry) => entry.defectId))
  assert.deepEqual(qualification.totals.byProposedDisposition, { CONDITIONALLY_BLOCKING: 25, RELEASE_BLOCKING: 43, REVIEW_REQUIRED: 3 })
  assert.equal(qualification.totals.accepted, 0)
  for (const item of qualification.qualifications) {
    assert.equal(item.proposedDisposition.state, 'PROPOSED_NOT_ACCEPTED')
    assert.equal(item.proposedDisposition.acceptedBy, null)
    assert.equal(item.proposedDisposition.acceptedOn, null)
    assert.equal(item.proposedDisposition.severityChanged, false)
    assert.equal(item.review.approval, null)
    assert.equal(item.review.authorityIndependent, false)
    assert.equal(item.review.independence, 'METHOD_INDEPENDENT_ONLY')
    assert.deepEqual(item.executedProof, [])
    assert.equal(item.runtimeEvidence, null)
    assert.ok(['SOURCE_VERIFIED', 'PARTIALLY_VERIFIED', 'INFERENCE_ONLY', 'REQUIRES_RUNTIME_PROOF'].includes(item.reviewStatus))
  }
})

test('the 150-item index is recomputed independently and matches the Gate 0C.3 index', () => {
  const dedup = registers.evidence.deduplication
  assert.equal(dedup.uniqueRecomputed, 150)
  assert.equal(dedup.indexedItems, 150)
  assert.equal(dedup.matches, true)
  assert.deepEqual(dedup.overlapsBetweenGroups, [])
  assert.equal(registers.certification.downstreamObligations.itemCount, 150)
})

test('the independent route extractor reads wrappers, floors and factory bindings from source text', () => {
  const guarded = analyseRouteFile('export const GET = withApi({ auth: { minRole: "steward" } }, async () => {})\nexport async function POST() {}')
  assert.equal(guarded.methods.GET.floor, FLOOR.ROLE_RESTRICTED)
  assert.equal(guarded.methods.GET.role, 'steward')
  assert.equal(guarded.methods.POST.wrapper, 'FUNCTION_DECLARATION')
  assert.equal(guarded.methods.POST.floor, FLOOR.UNDETERMINED)
  const crud = analyseRouteFile('export const { GET, POST } = crudRoutes({ table: "t", auth: { read: "member", write: "officer" } })')
  assert.equal(crud.methods.GET.floor, FLOOR.ANY_AUTHENTICATED)
  assert.equal(crud.methods.POST.floor, FLOOR.ROLE_RESTRICTED)
})

test('the carbon evidence record supersedes the broad statement with the narrower finding and authorizes nothing', () => {
  const { carbon } = registers.evidence
  assert.equal(carbon.status, 'PARTIALLY_VERIFIED')
  assert.equal(carbon.narrowerFindingHolds, true)
  assert.ok(carbon.filesNamingCarbonAccounting.length > 0)
  assert.deepEqual(carbon.reachableFromTheFourRoutes, [])
  const record = registers.supersessions.records.find((entry) => entry.id === 'SUP-0C4-CARBON-SOURCE-EXISTENCE')
  assert.equal(record.kind, 'SUPERSESSION')
  assert.equal(record.effect.historicalRecordAltered, false)
  assert.equal(registers.institutional.carbonDecision.selected, null)
  assert.equal(registers.institutional.carbonDecision.exceptionsAuthorized, false)
  assert.deepEqual(registers.institutional.carbonDecision.scopeExceptionOperations, CARBON_OPERATIONS)
})

test('the per-capita MEDIUM and HIGH records are both kept, cross-referenced and not re-rated', () => {
  const { perCapita } = registers.evidence
  assert.deepEqual(perCapita.records.map((record) => record.severity).sort(), ['HIGH', 'MEDIUM'])
  assert.equal(perCapita.severityChanged, false)
  assert.equal(perCapita.reratedHere, false)
  assert.ok(registers.supersessions.records.some((record) => record.id === 'CLAR-0C4-PER-CAPITA-SEVERITY-RELATIONSHIP'))
})

test('the OPL challenges stay challenges of the frozen conditional dispositions and are not additional defects', () => {
  const { challenges } = registers.evidence
  assert.equal(challenges.challenges.length, 2)
  for (const challenge of challenges.challenges) {
    assert.equal(challenge.isAdditionalDefect, false)
    assert.equal(challenge.supersedesFrozenDisposition, false)
    assert.equal(challenge.executedProofOnFile, 0)
  }
})

test('the three public exposures state no public reachability that the repository cannot show', () => {
  const { exposures } = registers.evidence
  assert.equal(exposures.operations.length, 3)
  for (const operation of exposures.operations) assert.equal(operation.statuses.publicReachability, 'REQUIRES_RUNTIME_PROOF')
})

test('the Gate 0 completion presentation labels the seven criteria documentary and separates the five qualifiers', () => {
  const { presentation } = registers.certification
  assert.deepEqual(Object.fromEntries(Object.entries(presentation).filter(([key]) => key in PRESENTATION)), PRESENTATION)
  assert.equal(presentation.documentaryCriteria.label, DOCUMENTARY_LABEL)
  assert.equal(presentation.documentaryCriteria.of, 7)
  assert.equal(registers.certification.gate0Verdict, 'IN_PROGRESS')
})

test('the certification checklist separates the eight checks and cannot be satisfied by counts', () => {
  const model = clone(registers.certification)
  assert.deepEqual(model.checklist.items.map((item) => item.check), CERTIFICATION_CHECKS)
  assert.deepEqual(model.evaluation.unmet, ['CL-2', 'CL-3', 'CL-4B', 'CL-5'])
  assert.equal(model.evaluation.eligibleForCertificationDecision, false)
  model.counts = { operations: 1646, highDefectsQualified: 71, institutionalDecisions: 0, productDecisions: 0, personaRatifications: 0 }
  model.downstreamObligations.itemCount = 0
  model.presentation.documentaryCriteria.satisfiedByRecord = 7
  assert.deepEqual(evaluateCertification(model).unmet, ['CL-2', 'CL-3', 'CL-4B', 'CL-5'])
})

test('a complete set of authority evidence makes a certification decision possible but never grants it, never authorizes a release and never changes readiness', () => {
  const model = clone(registers.certification)
  for (const item of model.checklist.items.filter((entry) => entry.evidenceKind === 'AUTHORITY_EVIDENCE')) {
    item.state = 'SATISFIED_BY_AUTHORITY'
    item.authorityEvidence = { authorityIndependent: true, decidedBy: 'a named authority', decidedOn: '2026-11-01', artifactSha256: 'a'.repeat(64), evidenceDocumentSha256: 'b'.repeat(64) }
  }
  const evaluation = evaluateCertification(model)
  assert.deepEqual(evaluation.unmet, [])
  assert.equal(evaluation.eligibleForCertificationDecision, true)
  assert.equal(evaluation.certificationGranted, false)
  assert.equal(evaluation.impliesReleaseAuthorization, false)
  assert.equal(evaluation.impliesProductionGo, false)
  assert.equal(evaluation.readinessUnchanged, 'NO_GO')
  assert.equal(model.checklist.items.find((item) => item.id === 'CL-7').state, 'NO_GO')
})

test('authority evidence that names no decision maker, no date or no artifact hash does not satisfy an authority item', () => {
  for (const field of ['decidedBy', 'decidedOn', 'artifactSha256', 'evidenceDocumentSha256']) {
    const model = clone(registers.certification)
    const item = model.checklist.items.find((entry) => entry.id === 'CL-3')
    item.state = 'SATISFIED_BY_AUTHORITY'
    item.authorityEvidence = { authorityIndependent: true, decidedBy: 'a named authority', decidedOn: '2026-11-01', artifactSha256: 'a'.repeat(64), evidenceDocumentSha256: 'b'.repeat(64), [field]: '' }
    assert.ok(evaluateCertification(model).unmet.includes('CL-3'), field)
  }
})

test('the dossiers retain all 111 institutional decisions and all 24 product decisions with their original identifiers', () => {
  assert.equal(registers.institutional.decisions.length, 111)
  assert.equal(registers.product.outstandingProductDecisions.count, 24)
  const sources = live.src.base.classification.institutionalDecisions.map((decision) => decision.id)
  const held = registers.institutional.decisions.map((decision) => decision.decisionId)
  for (const id of sources) assert.ok(held.includes(id), id)
  assert.equal(registers.institutional.totals.adopted, 0)
  assert.deepEqual(registers.institutional.requiredBeforeCertification, [CARBON_DECISION_ID])
})

test('the summary reports the unmet certification items and no certification', () => {
  const summary = qualificationSummary({ registers })
  assert.deepEqual(summary.unmetCertificationItems, ['CL-2', 'CL-3', 'CL-4B', 'CL-5'])
  assert.equal(summary.certificationGranted, false)
  assert.equal(summary.dispositionsAccepted, 0)
  assert.equal(summary.readiness, 'NO_GO')
})

// ---- negative tests -------------------------------------------------------------------------------------------------

test('rejects a proposed disposition presented as accepted', () => {
  const state = fresh()
  const item = qualificationOf(state, FIRST)
  item.proposedDisposition.state = 'ACCEPTED'
  item.proposedDisposition.acceptedBy = 'a named person'
  item.proposedDisposition.acceptedOn = '2026-10-28'
  assert.ok(has(problemsOf(state), 'DISPOSITION-AS-ACCEPTED'))
})

test('rejects an approval recorded in the review block of a qualification', () => {
  const state = fresh()
  qualificationOf(state, FIRST).review.approval = { by: 'reviewer' }
  assert.ok(has(problemsOf(state), 'DISPOSITION-AS-ACCEPTED'))
})

test('rejects a qualification that reports a total of accepted dispositions', () => {
  const state = fresh()
  state.registers.qualification.totals.accepted = 71
  assert.ok(has(problemsOf(state), 'DISPOSITION-AS-ACCEPTED'))
})

test('rejects false independent-review provenance on a record, on a register and on the checklist', () => {
  const record = fresh()
  qualificationOf(record, FIRST).review.authorityIndependent = true
  assert.ok(has(problemsOf(record), 'FALSE-INDEPENDENCE'))
  const reviewer = fresh()
  reviewer.registers.evidence.review.independence = 'AUTHORITY_INDEPENDENT'
  assert.ok(has(problemsOf(reviewer), 'FALSE-INDEPENDENCE'))
  const role = fresh()
  role.registers.qualification.review.reviewerRole = 'INDEPENDENT_SECURITY_AUTHORITY'
  assert.ok(has(problemsOf(role), 'FALSE-INDEPENDENCE'))
  const checklist = fresh()
  checklistItem(checklist, 'CL-2').authorityIndependentReviewOnFile = true
  assert.ok(has(problemsOf(checklist), 'FALSE-INDEPENDENCE'))
})

test('rejects fabricated runtime evidence', () => {
  const proof = fresh()
  qualificationOf(proof, FIRST).executedProof.push({ test: 'tenant isolation', result: 'pass' })
  assert.ok(has(problemsOf(proof), 'FABRICATED-RUNTIME-EVIDENCE'))
  const evidenceField = fresh()
  qualificationOf(evidenceField, FIRST).runtimeEvidence = { database: 'staging' }
  assert.ok(has(problemsOf(evidenceField), 'FABRICATED-RUNTIME-EVIDENCE'))
  const status = fresh()
  const dependent = status.registers.qualification.qualifications.find((item) => item.runtimeDependency.required === true)
  dependent.reviewStatus = 'SOURCE_VERIFIED'
  assert.ok(has(problemsOf(status), 'FABRICATED-RUNTIME-EVIDENCE'))
  const reachability = fresh()
  reachability.registers.evidence.exposures.operations[0].statuses.publicReachability = 'SOURCE_VERIFIED'
  assert.ok(has(problemsOf(reachability), 'FABRICATED-RUNTIME-EVIDENCE'))
  const challenge = fresh()
  challenge.registers.evidence.challenges.challenges[0].executedProofOnFile = 2
  assert.ok(has(problemsOf(challenge), 'FABRICATED-RUNTIME-EVIDENCE'))
})

test('rejects documentary completeness presented as certification', () => {
  const presentation = fresh()
  presentation.registers.certification.presentation.independentGate0Certification = 'GRANTED'
  assert.ok(has(problemsOf(presentation), 'DOCUMENTARY-AS-CERTIFICATION'))
  const label = fresh()
  label.registers.certification.presentation.documentaryCriteria.label = 'GATE_0_CERTIFIED'
  assert.ok(has(problemsOf(label), 'DOCUMENTARY-AS-CERTIFICATION'))
  const sufficient = fresh()
  checklistItem(sufficient, 'CL-1').sufficientAlone = true
  assert.ok(has(problemsOf(sufficient), 'DOCUMENTARY-AS-CERTIFICATION'))
  const bareClaim = fresh()
  const file = DOCS_0C4.index
  bareClaim.docs[file] = `${bareClaim.docs[file]}\n\n7 of 7 criteria satisfied.\n`
  assert.ok(has(problemsOf(bareClaim), 'DOCUMENTARY-AS-CERTIFICATION'))
  const register = fresh()
  register.registers.certification.note = 'All seven criteria are satisfied.'
  assert.ok(has(problemsOf(register), 'DOCUMENTARY-AS-CERTIFICATION'))
})

test('a statement of the seven criteria is accepted only when it says they are documentary', () => {
  const state = fresh()
  state.docs[DOCS_0C4.index] = `${state.docs[DOCS_0C4.index]}\n\n7 of 7 documentary criteria satisfied. Independent certification is NOT_GRANTED.\n`
  const problems = problemsOf(state)
  assert.ok(!problems.some((problem) => problem.startsWith('DOCUMENTARY-AS-CERTIFICATION: docs/union-eyes/convergence/gate-0c4/UE-GATE-0C4-QUALIFICATION.md states')))
})

test('rejects unratified personas marked resolved', () => {
  const state = fresh()
  state.registers.product.personas[0].currentState = 'RATIFIED'
  assert.ok(has(problemsOf(state), 'PERSONA-MARKED-RESOLVED'))
  const self = fresh()
  self.registers.product.personas[1].selfRatification = true
  assert.ok(has(problemsOf(self), 'PERSONA-MARKED-RESOLVED'))
  const selected = fresh()
  selected.registers.product.stewardStructure.selected = 'OPT-C-SCOPED-PROFILE'
  assert.ok(has(problemsOf(selected), 'PERSONA-MARKED-RESOLVED'))
  const decided = fresh()
  decided.registers.product.outstandingProductDecisions.items[0].currentState = 'DECIDED'
  assert.ok(has(problemsOf(decided), 'PERSONA-MARKED-RESOLVED'))
  const approval = fresh()
  approval.registers.product.approvalFieldsFilled = 3
  assert.ok(has(problemsOf(approval), 'PERSONA-MARKED-RESOLVED'))
  const source = fresh()
  source.src.base.productDecisions.records[0].state = 'RATIFIED'
  assert.ok(has(problemsOf(source), 'PERSONA-MARKED-RESOLVED'))
})

test('rejects institutional decisions silently granted', () => {
  const adopted = fresh()
  adopted.registers.institutional.decisions[5].adopted = true
  assert.ok(has(problemsOf(adopted), 'INSTITUTIONAL-SILENTLY-GRANTED'))
  const grants = fresh()
  grants.registers.institutional.decisions[7].grantsInstitutionalAuthority = true
  assert.ok(has(problemsOf(grants), 'INSTITUTIONAL-SILENTLY-GRANTED'))
  const disposition = fresh()
  disposition.registers.institutional.decisions[9].scopeLockDisposition = 'ADOPTED'
  assert.ok(has(problemsOf(disposition), 'INSTITUTIONAL-SILENTLY-GRANTED'))
  const untreated = fresh()
  const deferred = untreated.registers.institutional.decisions.find((decision) => decision.scopeLockDisposition === 'DEFERRED_NON_AUTHORIZING')
  deferred.nonAuthorizingTreatment = null
  assert.ok(has(problemsOf(untreated), 'INSTITUTIONAL-SILENTLY-GRANTED'))
  const boundary = fresh()
  boundary.registers.product.institutionalBoundary.productRatificationIssuesInstitutionalPermissions = true
  assert.ok(has(problemsOf(boundary), 'INSTITUTIONAL-SILENTLY-GRANTED'))
  const source = fresh()
  source.src.base.classification.institutionalDecisions[0].status = 'ADOPTED'
  assert.ok(has(problemsOf(source), 'INSTITUTIONAL-SILENTLY-GRANTED'))
})

test('rejects carbon exceptions treated as authorized, owned or selected', () => {
  const authorized = fresh()
  authorized.registers.institutional.carbonDecision.exceptionsAuthorized = true
  assert.ok(has(problemsOf(authorized), 'CARBON-AUTHORIZED'))
  const owned = fresh()
  owned.registers.institutional.carbonDecision.exceptionsOwned = true
  assert.ok(has(problemsOf(owned), 'CARBON-AUTHORIZED'))
  const selected = fresh()
  selected.registers.institutional.carbonDecision.selected = 'OPT-RETIRE-ROUTES'
  assert.ok(has(problemsOf(selected), 'CARBON-AUTHORIZED'))
  const evidence = fresh()
  evidence.registers.evidence.carbon.status = 'SOURCE_VERIFIED'
  assert.ok(has(problemsOf(evidence), 'CARBON-AUTHORIZED'))
  const reach = fresh()
  reach.registers.evidence.carbon.reachableFromTheFourRoutes = ['apps/union-eyes/services/carbon-accounting-service.ts']
  assert.ok(has(problemsOf(reach), 'CARBON-AUTHORIZED'))
})

test('rejects release debt dropped', () => {
  const state = fresh()
  const dropped = state.registers.certification.downstreamObligations.itemIds.pop()
  state.registers.certification.downstreamObligations.itemCount -= 1
  const problems = problemsOf(state)
  assert.ok(has(problems, 'DEBT-DROPPED'))
  assert.ok(problems.some((problem) => problem.includes(dropped)))
  const decision = fresh()
  decision.registers.institutional.decisions.pop()
  assert.ok(has(problemsOf(decision), 'DEBT-DROPPED'))
  const product = fresh()
  product.registers.product.outstandingProductDecisions.count = 23
  assert.ok(has(problemsOf(product), 'DEBT-DROPPED'))
  const proposals = fresh()
  proposals.registers.certification.downstreamObligations.proposedDispositionsAwaitingAcceptance = 0
  assert.ok(has(problemsOf(proposals), 'DEBT-DROPPED'))
})

test('rejects release debt double-counted', () => {
  const state = fresh()
  const ids = state.registers.certification.downstreamObligations.itemIds
  ids.push(ids[0])
  assert.ok(has(problemsOf(state), 'DEBT-DOUBLE-COUNTED'))
  const dossier = fresh()
  dossier.registers.institutional.decisions.push(clone(dossier.registers.institutional.decisions[0]))
  assert.ok(has(problemsOf(dossier), 'DEBT-DOUBLE-COUNTED'))
  const dedup = fresh()
  dedup.registers.evidence.deduplication.indexedItemsDuplicated = 3
  assert.ok(has(problemsOf(dedup), 'DEBT-DOUBLE-COUNTED'))
  const foreign = fresh()
  foreign.registers.certification.downstreamObligations.itemIds.push('DEBT:INVENTED')
  assert.ok(has(problemsOf(foreign), 'DEBT-DOUBLE-COUNTED'))
})

test('rejects historical evidence altered without a supersession record', () => {
  const register = fresh()
  register.liveFileSha = (file) => (file === FILES_0C3.assessment ? 'f'.repeat(64) : sha(file))
  assert.ok(has(problemsOf(register), 'HISTORY-MUTATED'))
  const loaded = fresh()
  loaded.src.regSha.debt = 'e'.repeat(64)
  assert.ok(has(problemsOf(loaded), 'HISTORY-MUTATED'))
  const target = fresh()
  target.registers.supersessions.records[0].targets[0].registerSha256 = 'd'.repeat(64)
  assert.ok(has(problemsOf(target), 'HISTORY-MUTATED'))
  const effect = fresh()
  effect.registers.supersessions.records[0].effect.historicalRecordAltered = true
  assert.ok(has(problemsOf(effect), 'HISTORY-MUTATED'))
  const matrix = fresh()
  matrix.src.base.matrix.routeInventoryTotals = { ...matrix.src.base.matrix.routeInventoryTotals, operations: 1000 }
  assert.ok(has(problemsOf(matrix), 'HISTORY-MUTATED'))
  const lineage = fresh()
  lineage.registers.qualification.lineage.assessmentSha256 = 'c'.repeat(64)
  assert.ok(has(problemsOf(lineage), 'HISTORY-MUTATED'))
  const record = fresh()
  qualificationOf(record, FIRST).assessmentRecordSha256 = 'b'.repeat(64)
  assert.ok(has(problemsOf(record), 'HISTORY-MUTATED'))
})

test('rejects a missing supersession or clarification record', () => {
  for (const id of ['SUP-0C4-CARBON-SOURCE-EXISTENCE', 'CLAR-0C4-PER-CAPITA-SEVERITY-RELATIONSHIP', 'CLAR-0C4-CHALLENGE-0B10-OPL-01', 'CLAR-0C4-DOCUMENTARY-CRITERIA-PRESENTATION']) {
    const state = fresh()
    state.registers.supersessions.records = state.registers.supersessions.records.filter((record) => record.id !== id)
    const problems = problemsOf(state)
    assert.ok(has(problems, 'SUPERSESSION-MISSING'), id)
    assert.ok(problems.some((problem) => problem.includes(id)), id)
  }
  const unsupported = fresh()
  const claim = unsupported.registers.supersessions.records.find((record) => /^CLAR-0C4-DEF-/.test(record.id))
  unsupported.registers.supersessions.records = unsupported.registers.supersessions.records.filter((record) => record !== claim)
  assert.ok(has(problemsOf(unsupported), 'SUPERSESSION-MISSING'))
})

test('rejects an unsupported or overbroad certification claim', () => {
  for (const phrase of ['Gate 0 is certified.', 'The scope-lock certification is granted.', 'No source names carbon accounting.', 'The route is independently approved.', 'The production is ready.']) {
    const state = fresh()
    state.registers.certification.note = phrase
    assert.ok(has(problemsOf(state), 'OVERBROAD-CERTIFICATION-CLAIM'), phrase)
  }
  const doc = fresh()
  doc.docs[DOCS_0C4.checklist] = `${doc.docs[DOCS_0C4.checklist]}\n\nGate 0 is certified.\n`
  assert.ok(has(problemsOf(doc), 'OVERBROAD-CERTIFICATION-CLAIM'))
})

test('rejects a certification recorded without independent evidence', () => {
  const granted = fresh()
  granted.registers.certification.checklist.certificationDecision.granted = true
  assert.ok(has(problemsOf(granted), 'CERTIFICATION-GRANTED-WITHOUT-EVIDENCE'))
  const signed = fresh()
  signed.registers.certification.checklist.certificationDecision.decidedBy = 'the preparer'
  assert.ok(has(problemsOf(signed), 'CERTIFICATION-GRANTED-WITHOUT-EVIDENCE'))
  const item = fresh()
  checklistItem(item, 'CL-3').state = 'SATISFIED_BY_AUTHORITY'
  const problems = problemsOf(item)
  assert.ok(has(problems, 'CERTIFICATION-GRANTED-WITHOUT-EVIDENCE'))
  const evaluation = fresh()
  evaluation.registers.certification.evaluation.unmet = []
  evaluation.registers.certification.evaluation.eligibleForCertificationDecision = true
  assert.ok(has(problemsOf(evaluation), 'CERTIFICATION-GRANTED-WITHOUT-EVIDENCE'))
  const selfEvidence = fresh()
  const target = checklistItem(selfEvidence, 'CL-2')
  target.state = 'SATISFIED_BY_AUTHORITY'
  target.authorityEvidence = { authorityIndependent: false, decidedBy: 'the preparer', decidedOn: '2026-10-27', artifactSha256: 'a'.repeat(64), evidenceDocumentSha256: 'b'.repeat(64) }
  assert.ok(has(problemsOf(selfEvidence), 'CERTIFICATION-GRANTED-WITHOUT-EVIDENCE'))
})

test('rejects a scope-lock certification converted into a release authorization or a production GO', () => {
  const release = fresh()
  release.registers.certification.checklist.certificationDecision.impliesReleaseAuthorization = true
  assert.ok(has(problemsOf(release), 'CERTIFICATION-IMPLIES-RELEASE'))
  const go = fresh()
  go.registers.certification.checklist.certificationDecision.impliesProductionGo = true
  assert.ok(has(problemsOf(go), 'CERTIFICATION-IMPLIES-RELEASE'))
  const ready = fresh()
  const last = checklistItem(ready, 'CL-7')
  last.state = 'SATISFIED_BY_AUTHORITY'
  last.canBeSatisfiedByGate0Certification = true
  assert.ok(has(problemsOf(ready), 'CERTIFICATION-IMPLIES-RELEASE'))
  const text = fresh()
  text.registers.certification.releaseAuthorization = 'GRANTED'
  text.registers.certification.note = '"releaseAuthorization":"GRANTED"'
  assert.ok(has(problemsOf(text), 'CERTIFICATION-IMPLIES-RELEASE'))
  const verdict = fresh()
  verdict.registers.certification.gate0Verdict = 'GO'
  assert.ok(has(problemsOf(verdict), 'GATE0-AS-GO'))
})

test('rejects a forbidden completion status anywhere in the registers', () => {
  const state = fresh()
  state.registers.product.status = 'APPROVED'
  assert.ok(has(problemsOf(state), 'IMPLEMENTATION-CLAIM'))
})

test('rejects a source file that changed since the evidence was recorded', () => {
  const state = fresh()
  state.registers.evidence.sourceBlobs[0].sha256 = '0'.repeat(64)
  assert.ok(has(problemsOf(state), 'SOURCE-DRIFT'))
})

test('rejects drift of a register, a document or a pin', () => {
  const register = fresh()
  register.registers.evidence.limitations = ['changed']
  assert.ok(has(problemsOf(register), 'REGISTER-DRIFT'))
  const doc = fresh()
  doc.docs[DOCS_0C4.product] = `${doc.docs[DOCS_0C4.product]}extra`
  assert.ok(has(problemsOf(doc), 'DOC-DRIFT'))
  const absent = fresh()
  delete absent.docs[DOCS_0C4.institutional]
  assert.ok(has(problemsOf(absent), 'DOC-ABSENT'))
  const pin = fresh()
  pin.liveFileSha = (file) => (file === FILES_0C4.product ? '9'.repeat(64) : sha(file))
  assert.ok(has(problemsOf(pin), 'PIN-DRIFT'))
  const missing = fresh()
  delete missing.registers.certification
  assert.ok(has(problemsOf(missing), 'REGISTER-ABSENT'))
})

test('rejects a qualification that omits one of the 71 defects', () => {
  const state = fresh()
  state.registers.qualification.qualifications.pop()
  assert.ok(has(problemsOf(state), 'QUALIFICATION-INCOMPLETE'))
})

test('validateGate0 carries the Gate 0C.4 validator and keeps the verdict IN_PROGRESS', () => {
  const matrix = clone(live.src.base.matrix)
  const base = loadContext(ROOT)
  const clean = validateGate0(matrix, base)
  assert.deepEqual(clean.problems, [])
  assert.equal(clean.summary.qualification0c4.certificationGranted, false)
  assert.equal(matrix.gate0Verdict, 'IN_PROGRESS')
  const mutated = clone(registers)
  mutated.qualification.qualifications[0].proposedDisposition.state = 'ACCEPTED'
  const rejected = validateGate0(matrix, { ...base, qualification0c4: { registers: mutated, docs: base.qualification0c4.docs, src: base.qualification0c4.src } })
  assert.ok(rejected.problems.some((problem) => problem.startsWith('QUALIFICATION-0C4: DISPOSITION-AS-ACCEPTED')))
})
