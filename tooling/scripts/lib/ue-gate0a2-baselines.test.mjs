import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { FILES, ROOT, loadContext, validateGate0 } from './ue-gate0-scope-lock.mjs'
import { BASELINE_DATA, BASELINE_DOCS, deriveFileFacts } from './ue-gate0a2-baseline-facts.mjs'
import { loadBaselines, sha256File, validateBaselines } from './ue-gate0a2-validate-baselines.mjs'

const clone = (value) => JSON.parse(JSON.stringify(value))
const data = () => clone(loadBaselines(ROOT))
const matrix = () => JSON.parse(readFileSync(`${ROOT}/${FILES.matrix}`, 'utf8'))
const run = (edit) => {
  const baselines = data()
  edit(baselines)
  return validateBaselines(ROOT, { data: baselines }).problems
}
const has = (problems, code) => problems.some((problem) => problem.startsWith(`${code}:`))
const contract = (baselines, persona, id) => baselines[persona].contracts.find((c) => c.id === id)
const base = loadContext()

test('the three proposed baselines pass and measure three separate things', () => {
  const result = validateBaselines(ROOT)
  assert.deepEqual(result.problems, [])
  const { personas, decisions, historicalVersusProposed } = result.summary
  assert.equal(personas.steward.stewardActionCount, 40)
  assert.deepEqual([personas.representative.identifierCoverage.universe, personas.representative.identifierCoverage.covered.length ?? personas.representative.identifierCoverage.covered], [56, 56])
  assert.equal(personas['financial-officer'].identifierCoverage.universe, 38)
  assert.equal(personas['financial-officer'].identifierCoverage.covered, 38)
  for (const persona of Object.values(personas)) {
    assert.ok('identifierCoverage' in persona && 'behavioralSpecification' in persona && 'implementedFunctionality' in persona)
    assert.equal(persona.behavioralSpecification.withAllRequiredFields, persona.behavioralSpecification.contracts)
  }
  assert.equal(decisions.outstanding, decisions.productDesign + decisions.institutionalAuthority)
  assert.equal(historicalVersusProposed.steward.historicallyEvidenced, 0)
  assert.equal(historicalVersusProposed.steward.newDesignOnly, historicalVersusProposed.steward.contracts)
})

test('every baseline is proposed, not adopted, frozen, or recovered, and creates no live authority', () => {
  const baselines = data()
  for (const key of Object.keys(BASELINE_DATA)) {
    assert.equal(baselines[key].status, 'PROPOSED_NOT_ADOPTED', key)
    assert.equal(baselines[key].adopted, false)
    assert.equal(baselines[key].frozen, false)
    assert.equal(baselines[key].originalRecovered, false)
  }
  for (const persona of ['steward', 'representative', 'financial-officer']) {
    const all = [...baselines[persona].contracts, ...(baselines[persona].journeys ?? []), ...(baselines[persona].scenarios ?? [])]
    for (const item of all) {
      assert.equal(item.liveAuthorityCreated, false, item.id)
      assert.ok(item.labels.includes('PROPOSED_NEW_BASELINE'), item.id)
    }
  }
})

test('a missing Financial Officer identifier is reported', () => {
  const problems = run((b) => {
    b['financial-officer'].contracts = b['financial-officer'].contracts.filter((c) => c.id !== 'F11')
  })
  assert.ok(problems.some((p) => /F11/.test(p) && /^(FO-|DOC-)/.test(p)), problems.join('\n'))
})

test('a missing Representative identifier is reported', () => {
  const problems = run((b) => {
    b.representative.contracts = b.representative.contracts.filter((c) => c.id !== 'R07')
  })
  assert.ok(problems.some((p) => /R07/.test(p)), problems.join('\n'))
})

test('a Steward action without a stable identity or an evidence class is reported', () => {
  assert.ok(has(run((b) => { contract(b, 'steward', 'STW-ACT-03').id = 'ACT-3' }), 'STEWARD-ID'))
  assert.ok(has(run((b) => { delete contract(b, 'steward', 'STW-ACT-03').id }), 'STEWARD-ID'))
  const noEvidence = run((b) => { delete contract(b, 'steward', 'STW-ACT-03').provenance.evidenceClass })
  assert.ok(has(noEvidence, 'STEWARD-EVIDENCE') && has(noEvidence, 'EVIDENCE-CLASS'), noEvidence.join('\n'))
})

test('historical and proposed meaning cannot be silently interchanged', () => {
  const problems = run((b) => {
    const r01 = contract(b, 'representative', 'R01')
    r01.proposedMeaning = r01.historical.quote
  })
  assert.ok(has(problems, 'MEANING-INTERCHANGED'), problems.join('\n'))
  const flipped = run((b) => {
    const f = contract(b, 'financial-officer', 'F05')
    f.meaningOrigin = 'NEW_DESIGN'
  })
  assert.ok(has(flipped, 'MEANING-ORIGIN'), flipped.join('\n'))
})

test('an action without an authorization boundary is reported', () => {
  const problems = run((b) => { delete contract(b, 'steward', 'STW-ACT-05').authorization })
  assert.ok(has(problems, 'AUTH-BASIS') && has(problems, 'STEWARD-BOUNDARY'), problems.join('\n'))
  const noBasis = run((b) => { contract(b, 'steward', 'STW-ACT-05').authorization.basisId = 'ANY_STEWARD' })
  assert.ok(has(noBasis, 'AUTH-BASIS'), noBasis.join('\n'))
})

test('a proposed action that creates live authority is reported', () => {
  const problems = run((b) => { contract(b, 'steward', 'STW-ACT-05').liveAuthorityCreated = true })
  assert.ok(has(problems, 'LIVE-AUTHORITY'), problems.join('\n'))
  const activated = run((b) => { contract(b, 'steward', 'STW-ACT-05').activation = 'ACTIVE' })
  assert.ok(has(activated, 'LIVE-AUTHORITY'), activated.join('\n'))
})

test('a grouped identifier that shares a title and specification is reported', () => {
  const problems = run((b) => {
    const r03 = contract(b, 'representative', 'R03')
    const r04 = contract(b, 'representative', 'R04')
    r04.title = r03.title
  })
  assert.ok(has(problems, 'REP-GROUPED'), problems.join('\n'))
})

test('a Steward contract cannot claim a historical source', () => {
  const problems = run((b) => {
    contract(b, 'steward', 'STW-ACT-05').historical = { sourceId: 'REP-DISPOSITION-V1', quote: '| R01 identity/mandates | PARTIAL |', kind: 'ROW', individuallyEvidenced: true, note: null }
  })
  assert.ok(has(problems, 'STEWARD-FALSE-HISTORY'), problems.join('\n'))
})

test('a false historical quote is reported', () => {
  const problems = run((b) => { contract(b, 'representative', 'R01').historical.quote = '| R01 invented text | DONE |' })
  assert.ok(has(problems, 'HISTORICAL-QUOTE'), problems.join('\n'))
})

test('a removed institutional decision is reported', () => {
  const problems = run((b) => {
    b.decisions.decisions = b.decisions.decisions.filter((d) => d.id !== 'DEC-IA-07')
  })
  assert.ok(has(problems, 'DECISION-UNKNOWN'), problems.join('\n'))
})

test('a settled or owner-named institutional decision is reported', () => {
  const settled = run((b) => { b.decisions.decisions.find((d) => d.type === 'INSTITUTIONAL_AUTHORITY').status = 'ADOPTED' })
  assert.ok(has(settled, 'DECISION-STATUS'), settled.join('\n'))
  const owner = run((b) => { b.decisions.decisions.find((d) => d.type === 'INSTITUTIONAL_AUTHORITY').decisionOwner = 'Local President' })
  assert.ok(has(owner, 'DECISION-OWNER'), owner.join('\n'))
})

test('R18 keeps both historical dispositions', () => {
  const problems = run((b) => { b.representative.r18VersionedRecord = null })
  assert.ok(has(problems, 'R18-VERSIONED'), problems.join('\n'))
})

test('an implementation status the cited source cannot support is reported', () => {
  const problems = run((b) => {
    const c = contract(b, 'steward', 'STW-ACT-25')
    c.implementation.status = 'SOURCE_PRESENT'
  })
  assert.ok(has(problems, 'IMPL-OVERCLAIM'), problems.join('\n'))
  const conformance = run((b) => { contract(b, 'steward', 'STW-ACT-06').implementation.conformanceChecked = true })
  assert.ok(has(conformance, 'IMPL-CONFORMANCE'), conformance.join('\n'))
})

test('institutional scenarios cannot be merged or made interchangeable', () => {
  const problems = run((b) => {
    const [first, second] = b.representative.scenarios
    second.operatingModel = first.operatingModel
    second.behavior = first.behavior
  })
  assert.ok(problems.some((p) => /^SCENARIO-/.test(p)), problems.join('\n'))
})

test('Financial Officer duties stay separate and a role title never issues a mandate', () => {
  const duties = run((b) => {
    for (const c of b['financial-officer'].contracts) {
      if (c.kind === 'DOMAIN') c.authorization.kernelActions = (c.authorization.kernelActions ?? []).filter((a) => a !== 'finance:approve')
    }
  })
  assert.ok(has(duties, 'FO-DUTIES'), duties.join('\n'))
  const title = run((b) => {
    contract(b, 'financial-officer', 'F05').financial.requiredFinancialAuthority.derivedFromRoleTitle = true
  })
  assert.ok(has(title, 'FO-ROLE-TITLE'), title.join('\n'))
})

test('a Financial Officer navigation destination that claims to be recovered is reported', () => {
  const problems = run((b) => {
    const nav = b['financial-officer'].contracts.find((c) => c.kind === 'NAVIGATION' && c.navigationNameOrigin === 'PROPOSED_NEW_NAME')
    nav.navigationNameOrigin = 'RECOVERED_HISTORICAL_NAME'
  })
  assert.ok(problems.some((p) => /^FO-NAV/.test(p)), problems.join('\n'))
})

test('Gate 0 records the proposed baselines as available for review and not adopted', () => {
  const record = matrix().proposedPersonaBaselines
  assert.equal(record.status, 'READY_FOR_PRODUCT_SPECIFICATION_REVIEW')
  assert.equal(record.adopted, false)
  for (const [key, file] of Object.entries(BASELINE_DATA)) assert.equal(record.data[key].sha256, sha256File(ROOT, file))
  assert.deepEqual(record.documents, BASELINE_DOCS)
  const result = validateGate0(matrix(), { base })
  assert.deepEqual(result.problems, [])
  assert.equal(result.summary.verdict, 'IN_PROGRESS')
  for (const persona of ['steward', 'representative', 'financial-officer']) assert.equal(result.summary.persona[persona].resolved, false, persona)
  assert.equal(result.summary.persona.steward.identifiers, 0)
  assert.equal(result.summary.persona.representative.identifiers, 56)
  assert.equal(result.summary.persona['financial-officer'].identifiers, 38)
})

test('Gate 0 fails when a baseline file changes after the matrix recorded its hash', () => {
  const stale = matrix()
  stale.proposedPersonaBaselines.data.steward.sha256 = '0'.repeat(64)
  assert.ok(validateGate0(stale, { base }).problems.some((p) => p.startsWith('PROPOSED-BASELINES-HASH:')))
})

test('Gate 0 fails when a baseline is recorded as adopted or a persona as resolved', () => {
  const adopted = matrix()
  adopted.proposedPersonaBaselines.adopted = true
  assert.ok(validateGate0(adopted, { base }).problems.some((p) => p.startsWith('PROPOSED-BASELINES-ADOPTED:')))
  const resolved = matrix()
  resolved.personaCompleteness.find((p) => p.persona === 'steward').resolved = true
  assert.ok(validateGate0(resolved, { base }).problems.some((p) => p.startsWith('PROPOSED-BASELINES-RESOLVED:')))
  const absent = matrix()
  delete absent.proposedPersonaBaselines
  assert.ok(validateGate0(absent, { base }).problems.some((p) => p.startsWith('PROPOSED-BASELINES-ABSENT:')))
})

// ---------------------------------------------------------------------------------------------------------------------
// Gate 0A.2R: adversarial product specification corrections
// ---------------------------------------------------------------------------------------------------------------------

const runWithMatrix = (edit, editMatrix) => {
  const baselines = data()
  const m = matrix()
  edit(baselines)
  editMatrix?.(m)
  return validateBaselines(ROOT, { data: baselines, matrix: m }).problems
}
const dimension = (b, id) => b.steward.identityModel.dimensions.find((d) => d.id === id)
const fo = (b, id) => contract(b, 'financial-officer', id)
const decision = (b, id) => b.decisions.decisions.find((d) => d.id === id)

test('the corrected baselines pass every Gate 0A.2R check', () => {
  assert.deepEqual(validateBaselines(ROOT).problems, [])
})

test('Steward UI identity does not grant authority', () => {
  const ui = run((b) => { dimension(b, 'UI_PERSONA').grantsAuthorityByItself = true })
  assert.ok(has(ui, 'STEWARD-IDENTITY'), ui.join('\n'))
  const office = run((b) => { dimension(b, 'UNION_OFFICE').impliesTriage = true })
  assert.ok(has(office, 'STEWARD-IDENTITY'), office.join('\n'))
  const role = run((b) => { dimension(b, 'PLATFORM_ROLE').impliesOrganizationWideVisibility = true })
  assert.ok(has(role, 'STEWARD-IDENTITY'), role.join('\n'))
  const workspace = run((b) => { b.steward.identityModel.focusedWorkspaceGrants.reassignment = true })
  assert.ok(has(workspace, 'STEWARD-IDENTITY'), workspace.join('\n'))
  const officeImplied = run((b) => { b.steward.identityModel.distinctInstitutionalOfficeImplied = true })
  assert.ok(has(officeImplied, 'STEWARD-IDENTITY'), officeImplied.join('\n'))
  const derived = run((b) => { contract(b, 'steward', 'STW-ACT-03').authorityDerivedFrom = ['UI_PERSONA'] })
  assert.ok(has(derived, 'STEWARD-IDENTITY'), derived.join('\n'))
  const navAuthority = run((b) => { contract(b, 'steward', 'STW-NAV-1').authorityDerivedFrom = ['UNION_OFFICE'] })
  assert.ok(has(navAuthority, 'STEWARD-IDENTITY'), navAuthority.join('\n'))
  const absent = run((b) => { delete b.steward.identityModel })
  assert.ok(has(absent, 'STEWARD-IDENTITY'), absent.join('\n'))
})

test('Steward navigation follows usable capability and never promises a fixed page count', () => {
  const fixed = run((b) => { b.steward.navigationPolicy.fixedDestinationCount = true })
  assert.ok(has(fixed, 'STEWARD-NAV'), fixed.join('\n'))
  const promise = run((b) => { contract(b, 'steward', 'STW-NAV-3').navigationVisibility.fixedPromise = true })
  assert.ok(has(promise, 'STEWARD-NAV'), promise.join('\n'))
  const unconditional = run((b) => { delete contract(b, 'steward', 'STW-NAV-4').navigationVisibility })
  assert.ok(has(unconditional, 'STEWARD-NAV'), unconditional.join('\n'))
  const stale = run((b) => { contract(b, 'steward', 'STW-NAV-2').navigationVisibility.currentSourceState.SOURCE_PRESENT += 1 })
  assert.ok(has(stale, 'STEWARD-NAV'), stale.join('\n'))
})

test('a linear intake-to-grievance lifecycle is not mandatory', () => {
  const sequence = run((b) => { b.representative.lifecycleModel.mandatoryLinearSequence = true })
  assert.ok(has(sequence, 'LIFECYCLE-LINEAR'), sequence.join('\n'))
  const prior = run((b) => { b.steward.lifecycleModel.entityTypes.find((e) => e.id === 'GRIEVANCE').requiresPriorEntity = true })
  assert.ok(has(prior, 'LIFECYCLE-LINEAR'), prior.join('\n'))
  const link = run((b) => { b.representative.lifecycleModel.allowedLinks[0].required = true })
  assert.ok(has(link, 'LIFECYCLE-LINEAR'), link.join('\n'))
  const transitions = run((b) => { b.steward.lifecycleModel.transitions.everyTransitionConfigurable = false })
  assert.ok(has(transitions, 'LIFECYCLE-LINEAR'), transitions.join('\n'))
  const block = run((b) => { contract(b, 'representative', 'R06').lifecycle.mandatorySequence = true })
  assert.ok(has(block, 'LIFECYCLE-LINEAR'), block.join('\n'))
  const text = run((b) => { contract(b, 'representative', 'REP-ACT-19').proposedMeaning = 'The handler must move the case to the grievance stage.' })
  assert.ok(has(text, 'LIFECYCLE-LINEAR'), text.join('\n'))
  const collapsed = run((b) => { b.representative.lifecycleModel.entityTypes = b.representative.lifecycleModel.entityTypes.filter((e) => e.id !== 'INQUIRY') })
  assert.ok(has(collapsed, 'LIFECYCLE-ENTITY'), collapsed.join('\n'))
})

test('the claims versus grievances decision stays unresolved under Gate 4', () => {
  const settled = run((b) => { b.steward.lifecycleModel.canonicalEntityDecision.status = 'RESOLVED' })
  assert.ok(has(settled, 'LIFECYCLE-CANONICAL'), settled.join('\n'))
  const byThisBaseline = run((b) => { b.representative.lifecycleModel.canonicalEntityDecision.settledByThisBaseline = true })
  assert.ok(has(byThisBaseline, 'LIFECYCLE-CANONICAL'), byThisBaseline.join('\n'))
  const unknown = run((b) => { b.representative.lifecycleModel.canonicalEntityDecision.capabilityId = 'UE-CAP-X-999' })
  assert.ok(has(unknown, 'LIFECYCLE-CANONICAL'), unknown.join('\n'))
  const baselines = data()
  assert.equal(baselines.representative.lifecycleModel.canonicalEntityDecision.capabilityId, 'UE-CAP-C-001')
  assert.equal(baselines.representative.lifecycleModel.canonicalEntityDecision.gate, 4)
})

test('member disclosure requires an independently authorized server-side decision', () => {
  const flag = run((b) => { contract(b, 'steward', 'STW-ACT-08').disclosure.clientVisibilityFlagSufficient = true })
  assert.ok(has(flag, 'DISCLOSURE-CLIENT-FLAG'), flag.join('\n'))
  const modelFlag = run((b) => { b.representative.disclosureModel.clientVisibilityFlagSufficient = true })
  assert.ok(has(modelFlag, 'DISCLOSURE-MODEL'), modelFlag.join('\n'))
  const memberDefault = run((b) => { contract(b, 'representative', 'REP-ACT-06').disclosure.defaultVisibility = 'MEMBER_VISIBLE' })
  assert.ok(has(memberDefault, 'DISCLOSURE-DEFAULT'), memberDefault.join('\n'))
  const clientSide = run((b) => { contract(b, 'steward', 'STW-ACT-09').disclosure.decisionEvaluatedServerSide = false })
  assert.ok(has(clientSide, 'DISCLOSURE-SERVER'), clientSide.join('\n'))
  const unclassified = run((b) => { contract(b, 'representative', 'R10').disclosure.classificationRequired = false })
  assert.ok(has(unclassified, 'DISCLOSURE-CLASSIFICATION'), unclassified.join('\n'))
  const author = run((b) => { contract(b, 'steward', 'STW-ACT-17').disclosure.independentOfAuthoringAuthority = false })
  assert.ok(has(author, 'DISCLOSURE-INDEPENDENT'), author.join('\n'))
  const noAuthority = run((b) => { contract(b, 'steward', 'STW-ACT-17').disclosure.decisionAuthority.kernelActions = [] })
  assert.ok(has(noAuthority, 'DISCLOSURE-AUTHORITY'), noAuthority.join('\n'))
  const privileged = run((b) => { contract(b, 'steward', 'STW-ACT-13').disclosure.neverDisclosable = [] })
  assert.ok(has(privileged, 'DISCLOSURE-RESTRICTED'), privileged.join('\n'))
  const missing = run((b) => { delete contract(b, 'steward', 'STW-ACT-08').disclosure })
  assert.ok(has(missing, 'DISCLOSURE-MISSING'), missing.join('\n'))
  const labelled = run((b) => { contract(b, 'steward', 'STW-ACT-17').institutionalAdoption = { required: false, decisionIds: [] } })
  assert.ok(has(labelled, 'DISCLOSURE-ADOPTION'), labelled.join('\n'))
})

test('a staff note is staff-only in the baseline and source is recorded as only partial', () => {
  const baselines = data()
  for (const [persona, id] of [['steward', 'STW-ACT-08'], ['representative', 'REP-ACT-06']]) {
    const c = contract(baselines, persona, id)
    assert.equal(c.disclosure.defaultVisibility, 'STAFF_ONLY', id)
    assert.equal(c.implementation.status, 'PARTIAL_SOURCE', id)
    assert.ok(c.labels.includes('REQUIRES_INSTITUTIONAL_ADOPTION'), id)
  }
  assert.equal(contract(baselines, 'representative', 'REP-ACT-06').title, 'Add note (internal / member-visible)')
})

test('Financial duties do not enforce an invented universal different-person rule', () => {
  const stance = run((b) => { fo(b, 'F15').financial.requiredSegregationOfDuties.universalDifferentPersonRule = true })
  assert.ok(has(stance, 'FO-SEGREGATION-UNIVERSAL'), stance.join('\n'))
  const model = run((b) => { b['financial-officer'].segregationModel.universalDifferentPersonPerStep = true })
  assert.ok(has(model, 'FO-SEGREGATION-UNIVERSAL'), model.join('\n'))
  const rule = run((b) => { b['financial-officer'].segregationModel.separationRules.find((r) => r.id === 'SEP-SW-01').universal = true })
  assert.ok(has(rule, 'FO-SEGREGATION-UNIVERSAL'), rule.join('\n'))
  const consecutive = run((b) => { b['financial-officer'].segregationModel.separationRules.find((r) => r.id === 'SEP-PI-07').scope = 'ANY_CONSECUTIVE_STEP' })
  assert.ok(has(consecutive, 'FO-SEGREGATION-UNIVERSAL'), consecutive.join('\n'))
  const text = run((b) => { fo(b, 'F12').proposedMeaning = 'Every step must be taken by a different person.' })
  assert.ok(has(text, 'FO-SEGREGATION-UNIVERSAL'), text.join('\n'))
  const journeyFlag = run((b) => { b['financial-officer'].journeys[3].consecutiveStepsRequireDifferentPerson = true })
  assert.ok(has(journeyFlag, 'FO-JOURNEY-SEGREGATION'), journeyFlag.join('\n'))
  const everyDistinct = run((b) => {
    for (const j of b['financial-officer'].journeys) j.steps.forEach((s, i) => { s.actorSlot = `U${i}` })
  })
  assert.ok(has(everyDistinct, 'FO-JOURNEY-SEGREGATION'), everyDistinct.join('\n'))
})

test('a journey cannot place one actor slot on duties that a listed rule separates', () => {
  const problems = run((b) => {
    const fj05 = b['financial-officer'].journeys.find((j) => j.id === 'FJ05')
    fj05.steps[1].actorSlot = fj05.steps[0].actorSlot
  })
  assert.ok(has(problems, 'FO-JOURNEY-SEGREGATION') && problems.some((p) => /SEP-SW-01/.test(p)), problems.join('\n'))
  const baselines = data()
  const fj04 = baselines['financial-officer'].journeys.find((j) => j.id === 'FJ04')
  assert.equal(fj04.steps[0].actorSlot, fj04.steps[1].actorSlot)
  assert.equal(fj04.consecutiveStepsRequireDifferentPerson, false)
})

test('technical protections, implemented software rules and proposed institutional rules stay distinct and adopted by nobody', () => {
  const model = data()['financial-officer'].segregationModel
  assert.equal(model.technicalProtections.length, 6)
  assert.ok(model.technicalProtections.every((p) => p.institutionalRequirement === false))
  const software = model.separationRules.filter((r) => r.kind === 'IMPLEMENTED_SOFTWARE_RULE')
  const proposed = model.separationRules.filter((r) => r.kind === 'PROPOSED_INSTITUTIONAL_SEPARATION')
  assert.equal(software.length, 8)
  assert.equal(proposed.length, 10)
  for (const r of [...software, ...proposed]) {
    assert.equal(r.universal, false, r.id)
    assert.equal(r.institutionallyAdopted, false, r.id)
  }
  const adopted = run((b) => { b['financial-officer'].segregationModel.separationRules.find((r) => r.id === 'SEP-SW-07').institutionallyAdopted = true })
  assert.ok(has(adopted, 'FO-SEGREGATION-UNIVERSAL'), adopted.join('\n'))
  const asProtection = run((b) => { b['financial-officer'].segregationModel.technicalProtections[0].institutionalRequirement = true })
  assert.ok(has(asProtection, 'FO-SEGREGATION-KINDS'), asProtection.join('\n'))
  const falseQuote = run((b) => { b['financial-officer'].segregationModel.technicalProtections[2].source.quote = 'a quote that is not in source' })
  assert.ok(has(falseQuote, 'FO-SEGREGATION-SOURCE'), falseQuote.join('\n'))
  const pairs = run((b) => { b['financial-officer'].segregationModel.separationRules.find((r) => r.id === 'SEP-SW-06').prohibitedCombinations = [['view', 'audit']] })
  assert.ok(has(pairs, 'FO-SEGREGATION-SOURCE'), pairs.join('\n'))
  const issuance = run((b) => { b['financial-officer'].segregationModel.threePersonIssuance = 'Every institution requires three different people.' })
  assert.ok(has(issuance, 'FO-SEGREGATION-UNIVERSAL'), issuance.join('\n'))
})

test('F01 presents the three-person issuance rule as software evidence and not as institutional adoption', () => {
  const f01 = fo(data(), 'F01')
  assert.equal(f01.softwareRuleEvidence.institutionallyAdopted, false)
  assert.equal(f01.financial.requiredSegregationOfDuties.universalDifferentPersonRule, false)
  const adopted = run((b) => { fo(b, 'F01').softwareRuleEvidence.institutionallyAdopted = true })
  assert.ok(has(adopted, 'FO-SEGREGATION-UNIVERSAL'), adopted.join('\n'))
})

test('platform billing is not union finance', () => {
  const flag = run((b) => { b['financial-officer'].platformBillingBoundary.isUnionFinance = true })
  assert.ok(has(flag, 'PLATFORM-BILLING-AS-UNION-FINANCE'), flag.join('\n'))
  const cited = run((b) => {
    const file = 'apps/union-eyes/app/[locale]/dashboard/finance/page.tsx'
    const f = deriveFileFacts(ROOT, file)
    fo(b, 'F07').implementation.routes = [{ file, signal: f.signal, methods: f.methods }]
  })
  assert.ok(has(cited, 'PLATFORM-BILLING-AS-UNION-FINANCE'), cited.join('\n'))
  const f28 = run((b) => { fo(b, 'F28').implementation.status = 'SOURCE_PRESENT' })
  assert.ok(has(f28, 'PLATFORM-BILLING-AS-UNION-FINANCE'), f28.join('\n'))
  const surface = run((b) => {
    const c = (b['financial-officer'].contracts ?? []).find((x) => x.implementation?.platformBillingSurfaces?.length)
    c.implementation.platformBillingSurfaces[0].isUnionFinanceEvidence = true
  })
  assert.ok(has(surface, 'PLATFORM-BILLING-AS-UNION-FINANCE'), surface.join('\n'))
  const evidence = run((b) => { b['financial-officer'].platformBillingBoundary.evidence[0].quote = 'not in the file' })
  assert.ok(has(evidence, 'PLATFORM-BILLING-EVIDENCE'), evidence.join('\n'))
  const baselines = data()
  assert.equal(baselines['financial-officer'].platformBillingBoundary.isUnionFinance, false)
  assert.equal(fo(baselines, 'F28').implementation.status, 'NOT_IMPLEMENTED')
})

test('financial navigation shows actual capability state and implies no engine', () => {
  const mismatch = run((b) => {
    const nav = (b['financial-officer'].contracts ?? []).find((c) => c.kind === 'NAVIGATION' && c.capabilityState.advertisement === 'SHOWN_WITH_STATE_LABELS')
    nav.capabilityState.advertisement = 'SHOWN_WHEN_USABLE'
  })
  assert.ok(has(mismatch, 'FO-NAV-STATE'), mismatch.join('\n'))
  const engine = run((b) => { (b['financial-officer'].contracts ?? []).find((c) => c.kind === 'NAVIGATION').capabilityState.impliesOperationalFinanceEngine = true })
  assert.ok(has(engine, 'FO-NAV-STATE'), engine.join('\n'))
  const evidence = run((b) => { b['financial-officer'].taxonomyIsEvidenceOfFunctionality = true })
  assert.ok(has(evidence, 'FO-NAV-STATE'), evidence.join('\n'))
})

test('reports and exports are authorized separately from a view duty', () => {
  const view = run((b) => { fo(b, 'F22').reporting.viewDutyAloneSufficient = true })
  assert.ok(has(view, 'FO-REPORTING'), view.join('\n'))
  const exportDuty = run((b) => { fo(b, 'F25').reporting.exportRequiresSeparateAuthorization = false })
  assert.ok(has(exportDuty, 'FO-REPORTING'), exportDuty.join('\n'))
  const dimensions = run((b) => { b['financial-officer'].reportingModel.authorizationDimensions.pop() })
  assert.ok(has(dimensions, 'FO-REPORTING'), dimensions.join('\n'))
  const engine = run((b) => { b['financial-officer'].reportingModel.unionFinanceReportEngineExists = true })
  assert.ok(has(engine, 'FO-REPORTING'), engine.join('\n'))
  const rows = run((b) => { fo(b, 'F08').reporting.exportAllowedByThisContract = true })
  assert.ok(has(rows, 'FO-REPORTING'), rows.join('\n'))
})

test('product acceptance does not activate institutional mandates', () => {
  const activation = run((b) => { decision(b, 'DEC-IA-16').activation = 'ACTIVE' })
  assert.ok(has(activation, 'DECISION-ACTIVATION'), activation.join('\n'))
  const states = run((b) => { decision(b, 'DEC-IA-16').authorityStates.productionInstitutionalActivation = 'PERMITTED' })
  assert.ok(has(states, 'IA-STATES'), states.join('\n'))
  const adoption = run((b) => { decision(b, 'DEC-IA-17').authorityStates.externalOrInstitutionalAdoption = 'NOT_REQUIRED' })
  assert.ok(has(adoption, 'IA-STATES'), adoption.join('\n'))
  const synthetic = run((b) => { decision(b, 'DEC-IA-20').authorityStates.syntheticAuthorityScope = 'REAL_ORGANIZATIONS' })
  assert.ok(has(synthetic, 'IA-STATES'), synthetic.join('\n'))
  const accepted = run((b) => { decision(b, 'DEC-PD-11').status = 'ACCEPTED' })
  assert.ok(has(accepted, 'DECISION-STATUS') && has(accepted, 'PD-RECOMMENDATION'), accepted.join('\n'))
  const adopted = run((b) => { decision(b, 'DEC-PD-01').reviewerRecommendation.adoptedByInstitution = true })
  assert.ok(has(adopted, 'PD-RECOMMENDATION'), adopted.join('\n'))
  const contractState = run((b) => { fo(b, 'F01').authorityStates.productionInstitutionalActivation = 'ACTIVATED' })
  assert.ok(has(contractState, 'AUTHORITY-STATES'), contractState.join('\n'))
  const prohibition = run((b) => { b['financial-officer'].prohibitedWithoutInstitutionalAdoption = b['financial-officer'].prohibitedWithoutInstitutionalAdoption.filter((p) => p.id !== 'REAL_FINANCIAL_MANDATES') })
  assert.ok(has(prohibition, 'AUTHORITY-PROHIBITION'), prohibition.join('\n'))
  const counsel = run((b) => { b.decisions.prohibitedWithoutInstitutionalAdoption = b.decisions.prohibitedWithoutInstitutionalAdoption.filter((p) => p.id !== 'COUNSEL_EXECUTION') })
  assert.ok(has(counsel, 'AUTHORITY-PROHIBITION'), counsel.join('\n'))
  const mayIssue = run((b) => { b.steward.authorityStatesVocabulary.syntheticAuthority.mayBeIssuedInRealOrganization = true })
  assert.ok(has(mayIssue, 'AUTHORITY-STATES'), mayIssue.join('\n'))
})

test('all 32 institutional decisions stay outstanding and inactive while engineering and synthetic testing are permitted', () => {
  const ia = data().decisions.decisions.filter((d) => d.type === 'INSTITUTIONAL_AUTHORITY')
  assert.equal(ia.length, 32)
  for (const d of ia) {
    assert.equal(d.status, 'OUTSTANDING', d.id)
    assert.equal(d.activation, 'INACTIVE', d.id)
    assert.equal(d.decisionOwner, 'TO_BE_NAMED_BY_INSTITUTION', d.id)
    assert.equal(d.baselineProposal, null, d.id)
    assert.equal(d.authorityStates.engineeringImplementation, 'PERMITTED', d.id)
    assert.equal(d.authorityStates.syntheticAuthorizedPathTesting, 'PERMITTED', d.id)
    assert.equal(d.authorityStates.productionInstitutionalActivation, 'PROHIBITED_UNTIL_ADOPTED', d.id)
    assert.equal(d.authorityStates.externalOrInstitutionalAdoption, 'REQUIRED', d.id)
    assert.equal(d.authorityStates.syntheticAuthorityScope, 'SYNTHETIC_ORGANIZATIONS_ONLY', d.id)
    assert.ok(d.engineeringMayBuild.length > 0 && d.syntheticTestMay.length > 0, d.id)
  }
  assert.deepEqual(ia.map((d) => d.id), Array.from({ length: 32 }, (_, i) => `DEC-IA-${String(i + 1).padStart(2, '0')}`))
})

test('the 14 product design decisions carry the reviewer dispositions as recommendations only', () => {
  const expected = {
    'DEC-PD-01': 'ACCEPT_DESIGN', 'DEC-PD-02': 'REVISE', 'DEC-PD-03': 'ACCEPT', 'DEC-PD-04': 'REVISE', 'DEC-PD-05': 'ACCEPT', 'DEC-PD-06': 'ACCEPT_AS_PROPOSED_TAXONOMY',
    'DEC-PD-07': 'ACCEPT', 'DEC-PD-08': 'ACCEPT_AS_TEST_DESIGNS', 'DEC-PD-09': 'ACCEPT_AS_PROPOSED_TAXONOMY', 'DEC-PD-10': 'REVISE', 'DEC-PD-11': 'REVISE', 'DEC-PD-12': 'ACCEPT',
    'DEC-PD-13': 'ACCEPT_WITH_CONTROLS', 'DEC-PD-14': 'ACCEPT_AS_SCENARIO_HYPOTHESES',
  }
  const pd = data().decisions.decisions.filter((d) => d.type === 'PRODUCT_DESIGN')
  assert.equal(pd.length, 14)
  for (const d of pd) {
    assert.equal(d.reviewerRecommendation.disposition, expected[d.id], d.id)
    assert.equal(d.reviewerRecommendation.adoptedByInstitution, false, d.id)
    assert.equal(d.status, 'OUTSTANDING', d.id)
  }
  const invented = run((b) => { decision(b, 'DEC-PD-02').reviewerRecommendation.disposition = 'APPROVED_AND_FROZEN' })
  assert.ok(has(invented, 'PD-RECOMMENDATION'), invented.join('\n'))
})

test('historical provenance is unchanged from the Gate 0A.2 anchor', () => {
  const quote = run((b) => { contract(b, 'representative', 'R01').historical.quote = '| R01 identity/mandates | DONE |' })
  assert.ok(has(quote, 'PROVENANCE-DRIFT') && has(quote, 'HISTORICAL-QUOTE'), quote.join('\n'))
  const origin = run((b) => { contract(b, 'representative', 'R01').meaningOrigin = 'NEW_DESIGN_UNDER_HISTORICAL_GROUP' })
  assert.ok(has(origin, 'PROVENANCE-DRIFT'), origin.join('\n'))
  const promoted = run((b) => { contract(b, 'representative', 'R05').historical = null })
  assert.ok(has(promoted, 'PROVENANCE-DRIFT'), promoted.join('\n'))
  const title = run((b) => { contract(b, 'representative', 'R01').title = 'Identity and mandates (redefined)' })
  assert.ok(has(title, 'PROVENANCE-DRIFT'), title.join('\n'))
  const silent = run((b) => { contract(b, 'financial-officer', 'F05').title = 'Quietly retitled' })
  assert.ok(has(silent, 'PROVENANCE-DRIFT'), silent.join('\n'))
  const removed = run((b) => { b.representative.contracts = b.representative.contracts.filter((c) => c.id !== 'R12') })
  assert.ok(has(removed, 'PROVENANCE-DRIFT'), removed.join('\n'))
  const iaTitle = run((b) => { decision(b, 'DEC-IA-04').title = 'Redefined title' })
  assert.ok(has(iaTitle, 'PROVENANCE-DRIFT'), iaTitle.join('\n'))
  const dropped = run((b) => { b.decisions.decisions = b.decisions.decisions.filter((d) => d.id !== 'DEC-IA-32') })
  assert.ok(has(dropped, 'PROVENANCE-DRIFT'), dropped.join('\n'))
  const r18 = run((b) => { b.representative.r18VersionedRecord.historicalDispositions = b.representative.r18VersionedRecord.historicalDispositions.slice(0, 1) })
  assert.ok(has(r18, 'R18-VERSIONED'), r18.join('\n'))
  const evidence = run((b) => { contract(b, 'steward', 'STW-DENY-01').provenance.evidenceIds = ['S1'] })
  assert.ok(has(evidence, 'PROVENANCE-DRIFT'), evidence.join('\n'))
})

test('all 182 identifiers are preserved and the persona universes are unchanged', () => {
  const universes = matrix().personaCompleteness.map((p) => p.universe.length)
  assert.equal(universes.reduce((a, b) => a + b, 0), 182)
  const dropped = runWithMatrix(() => {}, (m) => { m.personaCompleteness.find((p) => p.persona === 'member').universe.pop() })
  assert.ok(has(dropped, 'PROVENANCE-DRIFT'), dropped.join('\n'))
  const added = runWithMatrix(() => {}, (m) => { m.personaCompleteness.find((p) => p.persona === 'governance-officer').universe.push('G99') })
  assert.ok(has(added, 'PROVENANCE-DRIFT'), added.join('\n'))
})

test('scenarios stay independently configurable and journeys never count as passed', () => {
  const shared = run((b) => {
    const [first, second] = b.representative.scenarios
    second.configuration.configurationKey = first.configuration.configurationKey
  })
  assert.ok(has(shared, 'SCENARIO-CONFIG'), shared.join('\n'))
  const validated = run((b) => { b['financial-officer'].scenarios[0].configuration.validation.status = 'PASSED' })
  assert.ok(has(validated, 'SCENARIO-CONFIG'), validated.join('\n'))
  const borrowed = run((b) => { b['financial-officer'].scenarios[1].configuration.sharesConfigurationWith = ['FO-SCN-CAPE'] })
  assert.ok(has(borrowed, 'SCENARIO-CONFIG'), borrowed.join('\n'))
  const passed = run((b) => { b.representative.journeys[0].countsAsPassed = true })
  assert.ok(has(passed, 'JOURNEY-EXECUTION'), passed.join('\n'))
  const executed = run((b) => { b['financial-officer'].journeys[0].executionStatus = 'EXECUTED' })
  assert.ok(has(executed, 'JOURNEY-EXECUTION'), executed.join('\n'))
})

test('Representative scope is never inferred from office or seniority', () => {
  const inferred = run((b) => { b.representative.scopeAndConflictBoundaries.scopeIsNeverInferredFromOfficeOrSeniority = false })
  assert.ok(has(inferred, 'REP-SCOPE'), inferred.join('\n'))
  const active = run((b) => { b.representative.scopeAndConflictBoundaries.territoryAndUnitScopeInactiveUntil = [] })
  assert.ok(has(active, 'REP-SCOPE'), active.join('\n'))
})

test('counsel execution stays gated and the council vote stays unavailable', () => {
  const ia = data().decisions.decisions
  assert.ok(ia.every((d) => d.type !== 'INSTITUTIONAL_AUTHORITY' || d.activation === 'INACTIVE'))
  const prohibited = data().steward.prohibitedWithoutInstitutionalAdoption.find((p) => p.id === 'COUNSEL_EXECUTION')
  assert.match(prohibited.prohibited, /UE-CONV-G-003 stays an external gate/)
  const real = data().steward.prohibitedWithoutInstitutionalAdoption.find((p) => p.id === 'REAL_FINANCIAL_MANDATES')
  assert.match(real.prohibited, /FINANCIAL_MANDATES_NOT_ISSUED/)
})

test('every revised contract records its round and reason, and the log agrees', () => {
  const missing = run((b) => { delete contract(b, 'steward', 'STW-ACT-08').revision })
  assert.ok(has(missing, 'REVISION-LOG'), missing.join('\n'))
  const baselines = data()
  for (const persona of ['steward', 'representative', 'financial-officer']) {
    assert.equal(baselines[persona].revisionLog.round, 'GATE_0A_2R')
    assert.ok(baselines[persona].revisionLog.revisedContractCount > 0)
  }
})

test('the generated documents are current and carry the corrections', () => {
  const files = Object.values(BASELINE_DOCS).map((f) => readFileSync(`${ROOT}/${f}`, 'utf8'))
  for (const text of files) assert.match(text, /Production or institutional activation of the authority a decision governs is prohibited/)
  const steward = readFileSync(`${ROOT}/${BASELINE_DOCS.steward}`, 'utf8')
  assert.match(steward, /distinctInstitutionalOfficeImplied: false/)
  const finance = readFileSync(`${ROOT}/${BASELINE_DOCS['financial-officer']}`, 'utf8')
  assert.match(finance, /Mandatory technical protections/)
  assert.match(finance, /Platform billing boundary/)
})
