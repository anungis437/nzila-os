import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { FILES_0C1 } from './ue-gate0c1-classification.mjs'
import { buildFiles } from './ue-gate0c2-build.mjs'
import { ANCHOR_COMMIT, BASELINE_FILES, DECISION_STATES, DOCS_0C2, DOMAINS, FILES_0C2, PERSONAS, RECORD_IDS } from './ue-gate0c2-ids.mjs'
import { NEGATIVE_SECURITY_CRITERIA, NEW_PRODUCT_DECISIONS, SHARED_OBLIGATIONS, STEWARD_STRUCTURE } from './ue-gate0c2-facts.mjs'
import { loadDocs, loadFrozen, loadRegisters, loadSources } from './ue-gate0c2-load.mjs'
import { buildAll, serialize, sha256Of, validateDecisionRecord, validatePersonaReadiness } from './ue-gate0c2-readiness.mjs'
import { loadContext, validateGate0 } from './ue-gate0-scope-lock.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const clone = (value) => JSON.parse(JSON.stringify(value))
const sha = (file) => createHash('sha256').update(readFileSync(join(ROOT, file))).digest('hex')
const atAnchor = (file) => execFileSync('git', ['show', `${ANCHOR_COMMIT}:${file}`], { cwd: ROOT, maxBuffer: 256 * 1024 * 1024 })

const live = { src: loadSources(), registers: loadRegisters(), docs: loadDocs(), frozen: loadFrozen() }
const fresh = () => ({ src: clone(live.src), registers: clone(live.registers), docs: { ...live.docs }, frozen: clone(live.frozen) })
const run = (state) => validatePersonaReadiness({ registers: state.registers, src: state.src, frozen: state.frozen, docs: state.docs })
const problemsOf = (state) => run(state)
const has = (problems, code) => problems.some((problem) => problem.startsWith(`${code}:`))
const rowOf = (state, id) => state.registers.reconciliation.rows.find((row) => row.requirementId === id)
const recordOf = (state, persona) => state.registers.decisions.records.find((record) => record.persona === persona)

const validEvidence = (state, persona) => {
  const record = recordOf(state, persona)
  const pkg = state.registers.packages[persona]
  return {
    decisionMaker: { name: 'Independent Product Owner', role: 'AUTHORIZED_PRODUCT_OWNER' },
    decidedOn: '2026-11-03',
    artifactVersion: pkg.version,
    artifactSha256: record.artifact.sha256,
    scope: ['PRODUCT_SPECIFICATION_BASELINE'],
    evidenceDocument: { reference: 'minutes/product-owner-2026-11-03.pdf', sha256: 'a'.repeat(64) },
    independentOfPreparer: true,
  }
}

test('the committed Gate 0C.2 registers validate against the live sources and the accepted Gate 0C.1 commit', () => {
  assert.deepEqual(problemsOf(fresh()), [])
})

test('the registers and documents are the deterministic regeneration of the sources', () => {
  const files = buildFiles(ROOT)
  assert.equal(Object.keys(files).length, 11)
  for (const [file, text] of Object.entries(files)) assert.equal(readFileSync(join(ROOT, file), 'utf8'), text, `${file} differs from its regeneration`)
  assert.equal(serialize(buildAll(live.src).reconciliation), serialize(buildAll(live.src).reconciliation))
})

test('all three baselines are PROPOSED_FOR_RATIFICATION and none is accepted, rejected or returned', () => {
  const { decisions } = live.registers
  assert.deepEqual(decisions.permittedStates, DECISION_STATES)
  assert.deepEqual(decisions.records.map((record) => record.recordId), PERSONAS.map((persona) => RECORD_IDS[persona]))
  for (const record of decisions.records) {
    assert.equal(record.state, 'PROPOSED_FOR_RATIFICATION')
    assert.equal(record.approvalEvidence, null)
    assert.equal(record.selfRatification, false)
    assert.equal(record.decisionOwnerRole, 'AUTHORIZED_PRODUCT_OWNER')
    assert.equal(record.institutionalGrants.issuedByThisRecord, 0)
    assert.equal(record.artifact.sha256, sha256Of(live.registers.packages[record.persona]))
  }
  for (const persona of PERSONAS) {
    assert.equal(live.registers.packages[persona].status, 'PROPOSED_FOR_RATIFICATION')
    assert.equal(live.registers.packages[persona].lineage.historicalCanonicalRecovered, false)
    assert.equal(live.src.baselines[persona].adopted, false)
    assert.equal(live.src.baselines[persona].frozen, false)
    assert.equal(live.src.baselines[persona].originalRecovered, false)
    assert.equal(live.src.matrix.personaCompleteness.find((item) => item.persona === persona).resolved, false)
  }
})

test('the three packages carry every section a product owner needs to approve, reject or return', () => {
  for (const persona of PERSONAS) {
    const pkg = live.registers.packages[persona]
    assert.ok(pkg.packageId && pkg.version && pkg.lineage.proposedBaselineSha256)
    assert.ok(pkg.actionUniverse.requirements > 0)
    assert.equal(pkg.visibilityWorkflowMatrix.length, 11)
    assert.deepEqual(pkg.visibilityWorkflowMatrix.map((entry) => entry.domain), DOMAINS)
    assert.ok(pkg.functionalAcceptanceCriteria.length === pkg.actionUniverse.requirements)
    assert.ok(pkg.negativeSecurityAndTenantIsolationCriteria.some((criterion) => criterion.class === 'TENANT_ISOLATION'))
    assert.ok(pkg.negativeSecurityAndTenantIsolationCriteria.some((criterion) => /HIERARCHY|SENIORITY/.test(criterion.class)))
    assert.ok(Array.isArray(pkg.dependenciesOnOtherPersonas))
    assert.ok(pkg.outstandingProductDecisions.baseline.length > 0)
    assert.equal(pkg.outstandingProductDecisions.raisedByGate0C2.length >= 3, true)
    assert.ok(pkg.outstandingInstitutionalAuthorityDecisions.baseline.length > 0)
    assert.equal(pkg.outstandingInstitutionalAuthorityDecisions.inventoryLevelInstitutionalDecisionsOutstanding, 79)
    assert.ok(pkg.knownSourceGaps.sourceGaps.length > 0)
    assert.ok(pkg.implementationObligationsByGate.length > 0)
    assert.equal(pkg.decisionOwnerRole, 'AUTHORIZED_PRODUCT_OWNER')
    assert.deepEqual(pkg.approvalOptions.map((option) => option.id), ['APPROVE', 'REJECT', 'RETURN_FOR_REWORK'])
    assert.equal(pkg.claims.implementationComplete, false)
    assert.equal(pkg.claims.runtimeQualification, 'NOT_QUALIFIED')
  }
})

test('every requirement has one accountable persona, one completion owner, evidence classification, acceptance and negative criteria', () => {
  const rows = live.registers.reconciliation.rows
  assert.equal(rows.length, 177)
  assert.equal(new Set(rows.map((row) => row.requirementId)).size, 177)
  assert.deepEqual(live.registers.reconciliation.totals.byPersona, { 'financial-officer': 55, representative: 67, steward: 55 })
  for (const row of rows) {
    assert.ok(PERSONAS.includes(row.persona), row.requirementId)
    assert.ok(row.completionOwner.capabilityId && Number.isInteger(row.engineeringGate), row.requirementId)
    assert.ok(DOMAINS.includes(row.domain))
    assert.ok(['HISTORICAL_DIRECT', 'RECONSTRUCTED_UNDER_HISTORICAL_LABEL', 'NEW_DESIGN_NO_HISTORICAL_SOURCE'].includes(row.evidenceClassification))
    assert.ok(row.acceptanceEvidence.length > 0 && row.negativeCriteria.criterionIds.length > 0)
    assert.notEqual(row.authorityClass, 'ADOPTED_INSTITUTIONAL_AUTHORIZATION')
    assert.equal(row.liveAuthorityCreated, false)
    assert.equal(row.scope.inferredFromHierarchy, false)
    assert.ok(Array.isArray(row.routes))
  }
  assert.equal(live.registers.reconciliation.totals.adoptedInstitutionalAuthorizations, 0)
  assert.ok(rows.filter((row) => row.persona === 'steward').every((row) => row.historical.class === 'NONE'))
})

test('shared obligations have exactly one owner and no requirement is shared twice', () => {
  const obligations = live.registers.reconciliation.sharedObligations
  assert.equal(obligations.length, SHARED_OBLIGATIONS.length)
  const seen = new Set()
  for (const obligation of obligations) {
    assert.equal(obligation.members.filter((member) => member.role === 'OWNER').length, 1, obligation.id)
    assert.equal(obligation.accountabilityNotAuthorization, true)
    for (const member of obligation.members) {
      assert.ok(!seen.has(member.id), `${member.id} is shared twice`)
      seen.add(member.id)
    }
  }
})

test('the 182 historical identifiers and their evidence status are preserved, including those with incomplete sources', () => {
  const { preservation } = live.registers
  const actions = live.src.matrix.personaActions
  assert.equal(preservation.total, 182)
  assert.equal(actions.length, 182)
  assert.deepEqual(preservation.identifiers.map((item) => item.id), actions.map((action) => action.actionId))
  assert.deepEqual(live.frozen.matrix.personaActions, actions)
  const rowIds = new Set(live.registers.reconciliation.rows.map((row) => row.requirementId))
  for (const action of actions.filter((item) => PERSONAS.includes(item.persona))) assert.ok(rowIds.has(action.actionId), `${action.actionId} has no requirement row`)
  assert.deepEqual(preservation.perPersona, { 'financial-officer': 38, 'governance-officer': 30, member: 10, 'officer-executive': 26, representative: 56, 'senior-representative': 22 })
  const unresolved = preservation.unresolvedPersonas.map((item) => item.persona)
  assert.deepEqual(unresolved, ['steward', 'representative', 'financial-officer'])
  const fo = preservation.unresolvedPersonas.find((item) => item.persona === 'financial-officer')
  assert.deepEqual([fo.individuallyDefined, fo.groupedOnly, fo.unspecified], [4, 6, 28])
  const rep = preservation.unresolvedPersonas.find((item) => item.persona === 'representative')
  assert.deepEqual([rep.individuallyDefined, rep.groupedOnly], [39, 17])
  assert.equal(preservation.unresolvedPersonas.find((item) => item.persona === 'steward').identifiers, 0)
})

test('the Steward structure is a recommendation and is neither selected nor ratified', () => {
  const { structure } = live.registers
  assert.equal(structure.status, 'RECOMMENDATION_ONLY_NOT_SELECTED')
  assert.equal(structure.selected, null)
  assert.equal(structure.ratified, false)
  assert.equal(structure.recommendation.optionId, 'OPT-C-SCOPED-PROFILE')
  assert.equal(structure.recommendation.recommendationOnly && structure.recommendation.notSelected && structure.recommendation.notRatified, true)
  assert.equal(structure.options.length, 3)
  for (const option of structure.options) assert.deepEqual(Object.keys(option.consequences), ['workflows', 'navigation', 'authority', 'continuity', 'delegatedAccess', 'testing'])
  assert.equal(structure.evidence.authoritativeStewardActions, 0)
  assert.equal(structure.evidence.historicalStewardIdentifiers, 0)
  assert.equal(structure.evidence.stewardContractsNamingRepresentativeCounterpart, 55)
  assert.equal(STEWARD_STRUCTURE.recommendation.recommendationOnly, true)
})

test('the new product decisions are outstanding, owned by the product owner and recommend nothing', () => {
  assert.equal(NEW_PRODUCT_DECISIONS.length, 10)
  for (const decision of live.registers.decisions.raisedByGate0C2) {
    assert.equal(decision.status, 'OUTSTANDING')
    assert.equal(decision.type, 'PRODUCT_DESIGN')
    assert.equal(decision.recommendedOption, null)
    assert.equal(decision.adoptedByInstitution, false)
  }
})

test('existing evidence is protected: routes, tranches, capability lock, defects, exceptions, decisions and dispositions', () => {
  const { matrix } = live.src
  const frozen = live.frozen.matrix
  assert.equal(matrix.routeInventoryTotals.canonicalOperations ?? matrix.routeInventoryTotals.operations ?? matrix.routeInventoryTotals.total, frozen.routeInventoryTotals.canonicalOperations ?? frozen.routeInventoryTotals.operations ?? frozen.routeInventoryTotals.total)
  assert.deepEqual(matrix.routeInventoryTotals, frozen.routeInventoryTotals)
  assert.equal(matrix.capabilities.length, 111)
  assert.deepEqual(matrix.capabilities.map((capability) => capability.id), frozen.capabilities.map((capability) => capability.id))
  const classification = JSON.parse(readFileSync(join(ROOT, FILES_0C1.classification), 'utf8'))
  assert.equal(classification.defectRegister.length, 777)
  assert.equal(classification.institutionalDecisions.length, 79)
  assert.equal(matrix.decisionBoundExceptions.operations.length, 4)
  assert.deepEqual(matrix.decisionBoundExceptions, frozen.decisionBoundExceptions)
  for (const name of ['routeClassification', 'routeClassification0b2', 'routeClassification0b3', 'routeClassification0b4', 'routeClassification0b5', 'routeClassification0b6', 'routeClassification0b7', 'routeClassification0b8', 'routeClassification0b9', 'routeClassification0b10', 'routeClassification0b11', 'routeClassification0b12', 'routeClassification0c1', 'routeUniverseTransition', 'gate0cHandoff', 'releaseDispositionChallenges']) {
    assert.deepEqual(matrix[name], frozen[name], `${name} changed`)
  }
  for (const file of [BASELINE_FILES.steward, BASELINE_FILES.representative, BASELINE_FILES['financial-officer'], BASELINE_FILES.decisions, FILES_0C1.classification, FILES_0C1.manifest, FILES_0C1.ledger, 'docs/union-eyes/convergence/register/ue-gate0c-handoff-register.json']) {
    assert.equal(sha(file), createHash('sha256').update(atAnchor(file)).digest('hex'), `${file} differs from the accepted Gate 0C.1 commit`)
  }
  assert.equal(JSON.stringify(live.registers.decisions.records.map((record) => record.persona)), JSON.stringify(PERSONAS))
})

test('Gate 0 still reports the three persona blockers and no problems, and pins the Gate 0C.2 artifacts', () => {
  const matrix = JSON.parse(readFileSync(join(ROOT, 'docs/union-eyes/convergence/register/ue-pre-vs-engineering-completion.json'), 'utf8'))
  const result = validateGate0(matrix)
  assert.deepEqual(result.problems, [])
  assert.deepEqual(result.blockers.filter((blocker) => blocker.code === 'PERSONA_SPEC_UNRESOLVED').map((blocker) => blocker.persona).sort(), ['financial-officer', 'representative', 'steward'])
  assert.equal(result.summary.personaReadiness0c2.ratified, 0)
  for (const [key, file] of Object.entries({ ...FILES_0C2, ...Object.fromEntries(Object.entries(DOCS_0C2).map(([name, path]) => [`doc-${name}`, path])) })) {
    assert.equal(matrix.personaReadiness0c2.files[key].file, file)
    assert.equal(matrix.personaReadiness0c2.files[key].sha256, sha(file), `${file} is not pinned at its current hash`)
  }
  const mutated = loadContext()
  mutated.readiness0c2.registers = clone(mutated.readiness0c2.registers)
  mutated.readiness0c2.registers.decisions.records[0].state = 'ACCEPTED_BY_AUTHORIZED_PRODUCT_OWNER'
  const rejected = validateGate0(matrix, mutated)
  assert.ok(rejected.problems.some((problem) => /^PERSONA-READINESS-0C2: DECISION-NO-EVIDENCE/.test(problem)))
})

/* Negative tests. Each one must fail closed with the named code. */

test('rejects fabricated historical canonical evidence', () => {
  let state = fresh()
  rowOf(state, 'STW-ACT-01').historical.class = 'DIRECT_INDIVIDUAL'
  rowOf(state, 'STW-ACT-01').historical.individuallyEvidenced = true
  assert.ok(has(problemsOf(state), 'FABRICATED-HISTORICAL'))
  state = fresh()
  state.registers.packages.representative.lineage.historicalCanonicalRecovered = true
  assert.ok(has(problemsOf(state), 'FABRICATED-HISTORICAL'))
  state = fresh()
  state.src.baselines['financial-officer'].originalRecovered = true
  assert.ok(has(problemsOf(state), 'FABRICATED-HISTORICAL'))
  state = fresh()
  rowOf(state, 'F01').historical.class = 'DIRECT_INDIVIDUAL'
  assert.ok(has(problemsOf(state), 'FABRICATED-HISTORICAL'))
})

test('rejects lost and duplicated requirement identifiers', () => {
  let state = fresh()
  state.registers.reconciliation.rows = state.registers.reconciliation.rows.filter((row) => row.requirementId !== 'R05')
  assert.ok(has(problemsOf(state), 'ID-LOST'))
  state = fresh()
  state.registers.reconciliation.rows.push(clone(rowOf(state, 'F01')))
  assert.ok(has(problemsOf(state), 'ID-DUPLICATE'))
  state = fresh()
  state.registers.reconciliation.rows.push({ ...clone(rowOf(state, 'F01')), requirementId: 'F99' })
  assert.ok(has(problemsOf(state), 'ID-INVENTED'))
  state = fresh()
  state.registers.preservation.identifiers = state.registers.preservation.identifiers.filter((item) => item.id !== 'F20')
  assert.ok(has(problemsOf(state), 'ID-LOST'))
  state = fresh()
  state.registers.preservation.identifiers[3].matrixDefinition = 'INDIVIDUAL-CHANGED'
  assert.ok(has(problemsOf(state), 'ID-EVIDENCE-STATUS-CHANGED'))
  state = fresh()
  state.src.baselines.representative.contracts.push({ ...clone(state.src.baselines.steward.contracts[0]) })
  assert.ok(has(problemsOf(state), 'ID-DUPLICATE'))
})

test('rejects actions with no accountable persona, an orphaned action and duplicate ownership', () => {
  let state = fresh()
  rowOf(state, 'REP-ACT-04').persona = null
  assert.ok(has(problemsOf(state), 'NO-ACCOUNTABLE-PERSONA'))
  state = fresh()
  rowOf(state, 'REP-ACT-04').persona = 'steward'
  assert.ok(has(problemsOf(state), 'NO-ACCOUNTABLE-PERSONA'))
  state = fresh()
  rowOf(state, 'F08').completionOwner = { capabilityId: null, resolvedBy: null }
  assert.ok(has(problemsOf(state), 'ORPHANED-ACTION'))
  state = fresh()
  rowOf(state, 'F08').completionOwner.capabilityId = 'UE-NOT-A-CAPABILITY'
  assert.ok(has(problemsOf(state), 'ORPHANED-ACTION'))
  state = fresh()
  state.registers.reconciliation.sharedObligations[0].members.find((member) => member.role === 'OWNER').role = 'OWNER_PART'
  assert.ok(has(problemsOf(state), 'DUPLICATE-OWNERSHIP'))
  state = fresh()
  state.registers.reconciliation.sharedObligations[0].members.push({ id: 'REP-ACT-01', persona: 'representative', role: 'OWNER' })
  assert.ok(has(problemsOf(state), 'DUPLICATE-OWNERSHIP'))
  state = fresh()
  state.registers.reconciliation.sharedObligations[1].members.push({ ...state.registers.reconciliation.sharedObligations[0].members[1] })
  assert.ok(has(problemsOf(state), 'DUPLICATE-OWNERSHIP'))
})

test('rejects a role, membership or hierarchy promoted into an institutional authorization', () => {
  let state = fresh()
  rowOf(state, 'STW-DENY-01').authorityClass = 'ADOPTED_INSTITUTIONAL_AUTHORIZATION'
  assert.ok(has(problemsOf(state), 'FALSE-AUTHORITY'))
  state = fresh()
  rowOf(state, 'REP-ACT-04').liveAuthorityCreated = true
  assert.ok(has(problemsOf(state), 'FALSE-AUTHORITY'))
  state = fresh()
  rowOf(state, 'F15').authorityClass = 'ENGINEERING_REQUIREMENT'
  assert.ok(has(problemsOf(state), 'FALSE-AUTHORITY'))
  state = fresh()
  state.registers.reconciliation.sharedObligations[0].accountabilityNotAuthorization = false
  assert.ok(has(problemsOf(state), 'FALSE-AUTHORITY'))
})

test('rejects cross-tenant visibility inferred from the hierarchy', () => {
  let state = fresh()
  rowOf(state, 'STW-ACT-34').scope.inferredFromHierarchy = true
  assert.ok(has(problemsOf(state), 'CROSS-TENANT-INFERENCE'))
  state = fresh()
  rowOf(state, 'REP-ACT-10').scope.crossOrganizationVisibility = 'PARENT_AND_CHILD_ORGANIZATIONS'
  assert.ok(has(problemsOf(state), 'CROSS-TENANT-INFERENCE'))
  state = fresh()
  rowOf(state, 'F03').scope.organizationScope = 'FEDERATION'
  assert.ok(has(problemsOf(state), 'CROSS-TENANT-INFERENCE'))
  for (const persona of PERSONAS) {
    const classes = NEGATIVE_SECURITY_CRITERIA[persona].map((criterion) => criterion.class)
    assert.ok(classes.includes('TENANT_ISOLATION'))
    assert.ok(classes.some((name) => /HIERARCHY|SENIORITY/.test(name)))
  }
})

test('rejects a proposed baseline represented as accepted', () => {
  let state = fresh()
  state.registers.packages.steward.status = 'ACCEPTED_BY_AUTHORIZED_PRODUCT_OWNER'
  assert.ok(has(problemsOf(state), 'PROPOSED-AS-ACCEPTED'))
  state = fresh()
  state.src.baselines.representative.adopted = true
  assert.ok(has(problemsOf(state), 'PROPOSED-AS-ACCEPTED'))
  state = fresh()
  state.src.baselines['financial-officer'].frozen = true
  assert.ok(has(problemsOf(state), 'PROPOSED-AS-ACCEPTED'))
  state = fresh()
  state.src.matrix.personaCompleteness.find((item) => item.persona === 'steward').resolved = true
  assert.ok(has(problemsOf(state), 'PROPOSED-AS-ACCEPTED'))
  state = fresh()
  state.docs[DOCS_0C2.steward] = state.docs[DOCS_0C2.steward].replace('**Status: PROPOSED_FOR_RATIFICATION.**', '**Status: ACCEPTED_BY_AUTHORIZED_PRODUCT_OWNER.**')
  assert.ok(has(problemsOf(state), 'PROPOSED-AS-ACCEPTED'))
  state = fresh()
  state.registers.structure.selected = 'OPT-C-SCOPED-PROFILE'
  assert.ok(has(problemsOf(state), 'STRUCTURE-SELF-SELECTED'))
})

test('rejects an acceptance without independent approval evidence', () => {
  for (const decisionState of ['ACCEPTED_BY_AUTHORIZED_PRODUCT_OWNER', 'REJECTED_BY_AUTHORIZED_PRODUCT_OWNER', 'RETURNED_FOR_REWORK']) {
    const state = fresh()
    recordOf(state, 'steward').state = decisionState
    assert.ok(has(problemsOf(state), 'DECISION-NO-EVIDENCE'), decisionState)
  }
  const cases = {
    'a placeholder decision maker': (evidence) => { evidence.decisionMaker.name = 'Cursor Agent' },
    'the preparer': (evidence) => { evidence.decisionMaker.name = 'Gate 0C.2 engineering' },
    'the wrong role': (evidence) => { evidence.decisionMaker.role = 'ENGINEERING_LEAD' },
    'no date': (evidence) => { delete evidence.decidedOn },
    'an invented date': (evidence) => { evidence.decidedOn = '2026-13-45' },
    'a stale version': (evidence) => { evidence.artifactVersion = '0.9' },
    'a stale hash': (evidence) => { evidence.artifactSha256 = 'b'.repeat(64) },
    'no scope': (evidence) => { evidence.scope = [] },
    'no approval document': (evidence) => { evidence.evidenceDocument = {} },
    'a non-independent approval': (evidence) => { evidence.independentOfPreparer = false },
  }
  for (const [label, mutate] of Object.entries(cases)) {
    const state = fresh()
    const record = recordOf(state, 'representative')
    record.state = 'ACCEPTED_BY_AUTHORIZED_PRODUCT_OWNER'
    record.approvalEvidence = validEvidence(state, 'representative')
    mutate(record.approvalEvidence)
    assert.ok(problemsOf(state).some((problem) => /^DECISION-/.test(problem)), label)
  }
  let state = fresh()
  state.registers.decisions.records[0].approvalEvidence = validEvidence(state, 'steward')
  assert.ok(has(problemsOf(state), 'DECISION-STATE'))
  state = fresh()
  const stale = recordOf(state, 'financial-officer')
  stale.artifact.sha256 = 'c'.repeat(64)
  assert.ok(has(problemsOf(state), 'DECISION-STALE-EVIDENCE'))
  const returned = fresh()
  const record = recordOf(returned, 'steward')
  record.state = 'RETURNED_FOR_REWORK'
  record.approvalEvidence = validEvidence(returned, 'steward')
  assert.ok(has(problemsOf(returned), 'DECISION-NO-EVIDENCE'))
})

test('a fully evidenced product decision is the only way a record leaves the proposed state', () => {
  for (const [decisionState, extra] of [['ACCEPTED_BY_AUTHORIZED_PRODUCT_OWNER', {}], ['REJECTED_BY_AUTHORIZED_PRODUCT_OWNER', {}], ['RETURNED_FOR_REWORK', { returnReasons: ['The domain gaps need a decision.'] }]]) {
    const state = fresh()
    const record = recordOf(state, 'representative')
    record.state = decisionState
    record.approvalEvidence = validEvidence(state, 'representative')
    Object.assign(record, extra)
    assert.deepEqual(problemsOf(state), [], decisionState)
  }
  const state = fresh()
  const record = recordOf(state, 'steward')
  assert.deepEqual(validateDecisionRecord(record, sha256Of(state.registers.packages.steward), state.registers.packages.steward.version), [])
  assert.ok(validateDecisionRecord({ ...record, state: 'RATIFIED' }, 'x', '1').some((problem) => /DECISION-STATE/.test(problem)))
})

test('rejects a product approval represented as an institutional grant', () => {
  let state = fresh()
  const record = recordOf(state, 'representative')
  record.state = 'ACCEPTED_BY_AUTHORIZED_PRODUCT_OWNER'
  record.approvalEvidence = validEvidence(state, 'representative')
  record.approvalEvidence.scope = ['PRODUCT_SPECIFICATION_BASELINE', 'INSTITUTIONAL_AUTHORITY']
  assert.ok(has(problemsOf(state), 'DECISION-GRANT-AS-APPROVAL'))
  state = fresh()
  recordOf(state, 'financial-officer').institutionalGrants.issuedByThisRecord = 79
  assert.ok(has(problemsOf(state), 'DECISION-GRANT-AS-APPROVAL'))
  state = fresh()
  recordOf(state, 'steward').institutionalGrants.grantsInstitutionalAuthority = true
  assert.ok(has(problemsOf(state), 'DECISION-GRANT-AS-APPROVAL'))
  state = fresh()
  state.src.baselineDecisions.decisions.find((decision) => decision.id === 'DEC-IA-16').status = 'ADOPTED'
  assert.ok(has(problemsOf(state), 'DECISION-GRANT-AS-APPROVAL'))
  state = fresh()
  state.src.baselineDecisions.decisions = state.src.baselineDecisions.decisions.filter((decision) => decision.id !== 'DEC-IA-16')
  assert.ok(has(problemsOf(state), 'FROZEN-CHANGED'))
})

test('rejects a silent change to accepted Gate 0B or Gate 0C.1 evidence', () => {
  let state = fresh()
  state.frozen.matrix.personaActions[7].definition = 'CHANGED'
  assert.ok(has(problemsOf(state), 'FROZEN-CHANGED'))
  state = fresh()
  state.src.matrix.routeClassification0b7.files.manifest.sha256 = 'd'.repeat(64)
  assert.ok(has(problemsOf(state), 'FROZEN-CHANGED'))
  state = fresh()
  state.src.matrix.routeClassification0c1.files.classification.sha256 = 'e'.repeat(64)
  assert.ok(has(problemsOf(state), 'FROZEN-CHANGED'))
  state = fresh()
  state.src.matrix.gate0cHandoff.sha256 = 'f'.repeat(64)
  assert.ok(has(problemsOf(state), 'FROZEN-CHANGED'))
  state = fresh()
  state.src.matrix.capabilities.pop()
  assert.ok(has(problemsOf(state), 'FROZEN-CHANGED'))
  state = fresh()
  state.src.matrix.routeInventoryTotals = { ...state.src.matrix.routeInventoryTotals, changed: true }
  assert.ok(has(problemsOf(state), 'FROZEN-CHANGED'))
  state = fresh()
  state.src.matrix.decisionBoundExceptions.sha256 = '0'.repeat(64)
  assert.ok(has(problemsOf(state), 'FROZEN-CHANGED'))
  state = fresh()
  state.src.matrix.proposedPersonaBaselines.data.steward.sha256 = '1'.repeat(64)
  assert.ok(has(problemsOf(state), 'BASELINE-CHANGED'))
  state = fresh()
  state.frozen = {}
  assert.ok(has(problemsOf(state), 'FROZEN-ABSENT'))
  state = fresh()
  state.registers.packages.steward.lineage.proposedBaselineSha256 = '2'.repeat(64)
  assert.ok(has(problemsOf(state), 'BASELINE-CHANGED'))
})

test('rejects a claim that implementation, security or runtime qualification is complete', () => {
  let state = fresh()
  state.registers.packages['financial-officer'].claims.implementationComplete = true
  assert.ok(has(problemsOf(state), 'IMPLEMENTATION-CLAIM'))
  state = fresh()
  state.registers.packages.steward.claims.runtimeQualification = 'QUALIFIED'
  assert.ok(has(problemsOf(state), 'IMPLEMENTATION-CLAIM'))
  state = fresh()
  state.registers.packages.representative.claims.securityStatusChanged = true
  assert.ok(has(problemsOf(state), 'IMPLEMENTATION-CLAIM'))
  state = fresh()
  rowOf(state, 'F10').implementationStatus = 'COMPLETE'
  assert.ok(has(problemsOf(state), 'IMPLEMENTATION-CLAIM'))
  state = fresh()
  state.registers.reconciliation.status = 'ready'
  state.registers.preservation.verdict = 'delivered'
  assert.ok(has(problemsOf(state), 'IMPLEMENTATION-CLAIM'))
  state = fresh()
  state.registers.structure.note = '"state":"PROVEN_IN_STAGING"'
  assert.ok(has(problemsOf(state), 'IMPLEMENTATION-CLAIM'))
})

test('rejects a drifted package or a domain with no requirement and no product decision', () => {
  let state = fresh()
  state.registers.packages.steward.actionUniverse.requirements = 54
  assert.ok(has(problemsOf(state), 'REGISTER-DRIFT'))
  state = fresh()
  const domain = state.registers.packages.steward.visibilityWorkflowMatrix.find((entry) => entry.domain === 'REVOCATION_TERMINATION_HISTORY')
  domain.gapDecisionIds = []
  assert.ok(has(problemsOf(state), 'MATRIX-DOMAIN'))
  state = fresh()
  state.registers.packages.representative.visibilityWorkflowMatrix.pop()
  assert.ok(has(problemsOf(state), 'MATRIX-DOMAIN'))
  state = fresh()
  rowOf(state, 'F11').negativeCriteria.criterionIds = []
  assert.ok(has(problemsOf(state), 'NEGATIVE-CRITERIA'))
  state = fresh()
  rowOf(state, 'F11').acceptanceEvidence = []
  assert.ok(has(problemsOf(state), 'ACCEPTANCE-EVIDENCE'))
  state = fresh()
  state.registers = { ...state.registers, packages: { steward: state.registers.packages.steward } }
  assert.deepEqual(problemsOf(state), ['READINESS-ABSENT: a Gate 0C.2 register is missing'])
})

test('the review documents state the proposal, the hash and the separation of product and institutional decisions', () => {
  for (const persona of PERSONAS) {
    const text = readFileSync(join(ROOT, DOCS_0C2[persona]), 'utf8')
    assert.ok(text.includes('PROPOSED_FOR_RATIFICATION'))
    assert.ok(text.includes(sha256Of(live.registers.packages[persona])))
    assert.ok(text.includes('Historical canonical recovered: **no**'))
    assert.ok(text.includes('A product approval does not:'))
    assert.ok(existsSync(join(ROOT, FILES_0C2[persona])))
  }
  const index = readFileSync(join(ROOT, DOCS_0C2.index), 'utf8')
  assert.ok(/Recommended: `OPT-C-SCOPED-PROFILE`\. Not selected\. Not ratified\./.test(index))
})
