/**
 * Gate 0A.2R machine checks.
 *
 * These checks keep the corrected product specification honest. They refuse a Steward identity that grants authority, a
 * mandatory linear case lifecycle, a member-visible note decided by a client flag, an invented universal
 * different-person rule, platform billing presented as union finance, an institutional activation presented as product
 * acceptance, and any silent change to historical provenance.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BASELINE_DATA } from './ue-gate0a2-baseline-facts.mjs'
import { gitShowAt } from './ue-gate0a-persona-recovery.mjs'
import {
  ANCHOR_COMMIT, DISCLOSURE_CONTRACTS, FINANCE_DUTY_BY_BASIS, LIFECYCLE_ENTITY_IDS, PD_DISPOSITIONS, PROHIBITED_WITHOUT_ADOPTION, REVISION_ROUND, SEPARATION_EVALUATED_AGAINST,
  deriveNavigationState, incompatibleDutiesFromSource, isPlatformEconomicsText,
} from './ue-gate0a2r-models.mjs'

const norm = (text) => String(text ?? '').replace(/\s+/g, ' ').trim()
const asText = (value) => JSON.stringify(value ?? '')

const DISCLOSURE_PATHS = ['DISC-PATH-COMMUNICATION', 'DISC-PATH-STRUCTURED-ENTRY', 'DISC-PATH-RECORD']
const IDENTITY_DIMENSIONS = ['UI_PERSONA', 'UNION_OFFICE', 'PLATFORM_ROLE', 'CASE_RELATIONSHIP', 'ISSUED_AUTHORITY']
const AUTHORITY_CARRIERS = ['CASE_RELATIONSHIP', 'ISSUED_AUTHORITY']
const REPORTING_DIMENSIONS = ['DISCLOSED_FIELDS', 'AGGREGATION', 'SCOPE', 'SENSITIVITY', 'EXPORT', 'INFERENCE']
const MEMBER_VISIBLE_TEXT = /member-visible|member visible|visible to the member|shown to the member|member communication/i
const LINEAR_PHRASES = [
  /four stages/i, /move the case to the grievance stage/i, /case becomes a grievance/i, /every case (becomes|reaches|progresses)/i,
  /inquiry,? (then )?service request,? (then )?case,? (then )?grievance/i, /intake,? (then )?case,? (then )?grievance,? (then )?appeal/i,
  /must (first )?(become|be) (a )?(case|grievance)/i, /mandatory (linear )?(sequence|progression|stages)/i,
]
const UNIVERSAL_DIFFERENT_PERSON = /\b(different|distinct|separate|another|second)\s+(holder|person|people|principal|individual|user|member)s?\b/i
const UNIVERSAL_EXEMPT_CONTRACTS = new Set(['F01'])

const revisionOf = (c) => c.revision ?? null

function checkAuthorityHeader(key, baseline, fail) {
  const states = baseline.authorityStatesVocabulary
  for (const name of ['ENGINEERING_IMPLEMENTATION', 'SYNTHETIC_AUTHORIZED_PATH_TESTING', 'PRODUCTION_INSTITUTIONAL_ACTIVATION', 'EXTERNAL_OR_INSTITUTIONAL_ADOPTION']) {
    if (!states?.states?.[name]) fail('AUTHORITY-STATES', `${key} does not define the authority state ${name}`)
  }
  if (!/^PERMITTED/.test(states?.states?.ENGINEERING_IMPLEMENTATION ?? '') || !/^PERMITTED/.test(states?.states?.SYNTHETIC_AUTHORIZED_PATH_TESTING ?? '')) fail('AUTHORITY-STATES', `${key} does not permit engineering and synthetic testing`)
  if (!/^PROHIBITED/.test(states?.states?.PRODUCTION_INSTITUTIONAL_ACTIVATION ?? '')) fail('AUTHORITY-STATES', `${key} does not prohibit production activation`)
  if (!/^REQUIRED/.test(states?.states?.EXTERNAL_OR_INSTITUTIONAL_ADOPTION ?? '')) fail('AUTHORITY-STATES', `${key} does not require adoption`)
  if (states?.syntheticAuthority?.scope !== 'SYNTHETIC_ORGANIZATIONS_ONLY' || states?.syntheticAuthority?.mayBeIssuedInRealOrganization !== false) fail('AUTHORITY-STATES', `${key} lets synthetic authority reach a real organization`)
  const prohibited = new Set((baseline.prohibitedWithoutInstitutionalAdoption ?? []).map((p) => p.id))
  for (const p of PROHIBITED_WITHOUT_ADOPTION) if (!prohibited.has(p.id)) fail('AUTHORITY-PROHIBITION', `${key} drops the prohibition ${p.id}`)
}

function checkAuthorityStates(key, baseline, fail) {
  for (const c of [...(baseline.contracts ?? []), ...(baseline.journeys ?? []), ...(baseline.scenarios ?? [])]) {
    const a = c.authorityStates
    const where = `${key}:${c.id}`
    if (!a) { fail('AUTHORITY-STATES', `${where} carries no authority states`); continue }
    if (a.engineeringImplementationPermitted !== true || a.syntheticAuthorizedPathTestingPermitted !== true) fail('AUTHORITY-STATES', `${where} does not separate engineering from activation`)
    if (a.syntheticAuthorityScope !== 'SYNTHETIC_ORGANIZATIONS_ONLY') fail('AUTHORITY-STATES', `${where} synthetic authority scope is ${a.syntheticAuthorityScope}`)
    const required = Boolean(c.institutionalAdoption?.required)
    if (a.externalOrInstitutionalAdoptionRequired !== required) fail('AUTHORITY-STATES', `${where} adoption flag disagrees with its decisions`)
    if (required && a.productionInstitutionalActivation !== 'PROHIBITED_UNTIL_ADOPTED') fail('AUTHORITY-STATES', `${where} needs adoption and does not prohibit activation`)
    if (!required && a.productionInstitutionalActivation !== 'NOT_APPLICABLE') fail('AUTHORITY-STATES', `${where} needs no adoption and states ${a.productionInstitutionalActivation}`)
  }
}

function checkDecisionStates(decisions, fail) {
  for (const d of decisions.decisions ?? []) {
    if (d.type === 'INSTITUTIONAL_AUTHORITY') {
      const a = d.authorityStates
      if (!a) { fail('IA-STATES', `${d.id} carries no authority states`); continue }
      if (a.engineeringImplementation !== 'PERMITTED' || a.syntheticAuthorizedPathTesting !== 'PERMITTED') fail('IA-STATES', `${d.id} does not permit engineering and synthetic testing`)
      if (a.productionInstitutionalActivation !== 'PROHIBITED_UNTIL_ADOPTED') fail('IA-STATES', `${d.id} does not prohibit production activation`)
      if (a.externalOrInstitutionalAdoption !== 'REQUIRED') fail('IA-STATES', `${d.id} does not require adoption`)
      if (a.syntheticAuthorityScope !== 'SYNTHETIC_ORGANIZATIONS_ONLY') fail('IA-STATES', `${d.id} lets synthetic authority reach a real organization`)
      if (d.status !== 'OUTSTANDING' || d.activation !== 'INACTIVE') fail('IA-STATES', `${d.id} is not OUTSTANDING and INACTIVE`)
      if (!norm(d.engineeringMayBuild)) fail('IA-STATES', `${d.id} does not say what engineering may build`)
      if (!norm(d.syntheticTestMay)) fail('IA-STATES', `${d.id} does not say what a synthetic test may do`)
      if (!/synthetic|stub|fixture|test/i.test(d.syntheticTestMay ?? '')) fail('IA-STATES', `${d.id} synthetic testing does not name a synthetic fixture`)
      if (/real (mandate|payment|office)|production/i.test(`${d.engineeringMayBuild} ${d.syntheticTestMay}`) && !/no real|not issued|issues? no|nothing real/i.test(`${d.engineeringMayBuild} ${d.syntheticTestMay}`)) fail('IA-STATES', `${d.id} permits real or production activation`)
    } else {
      const r = d.reviewerRecommendation
      if (!r) { fail('PD-RECOMMENDATION', `${d.id} carries no reviewer recommendation`); continue }
      if (!PD_DISPOSITIONS.includes(r.disposition)) fail('PD-RECOMMENDATION', `${d.id} disposition ${r.disposition} is not recognised`)
      if (r.adoptedByInstitution !== false) fail('PD-RECOMMENDATION', `${d.id} recommendation claims institutional adoption`)
      if (d.status !== 'OUTSTANDING') fail('PD-RECOMMENDATION', `${d.id} recommendation settled the decision`)
      if (!norm(r.qualification)) fail('PD-RECOMMENDATION', `${d.id} recommendation has no qualification`)
    }
  }
}

function checkProvenance(root, data, matrix, fail) {
  const anchorOf = (file) => {
    const text = gitShowAt(root, ANCHOR_COMMIT, file)
    return text === null ? null : JSON.parse(text)
  }
  for (const key of ['steward', 'representative', 'financial-officer']) {
    const prior = anchorOf(BASELINE_DATA[key])
    if (!prior) { fail('PROVENANCE-DRIFT', `the anchor ${ANCHOR_COMMIT.slice(0, 9)} version of ${BASELINE_DATA[key]} cannot be read from git`); continue }
    const now = new Map([...(data[key].contracts ?? []), ...(data[key].journeys ?? []), ...(data[key].scenarios ?? [])].map((c) => [c.id, c]))
    for (const before of [...(prior.contracts ?? []), ...(prior.journeys ?? []), ...(prior.scenarios ?? [])]) {
      const after = now.get(before.id)
      const where = `${key}:${before.id}`
      if (!after) { fail('PROVENANCE-DRIFT', `${where} was removed after the anchor`); continue }
      if (asText(before.historical ?? null) !== asText(after.historical ?? null)) fail('PROVENANCE-DRIFT', `${where} historical record changed`)
      if (before.meaningOrigin !== after.meaningOrigin) fail('PROVENANCE-DRIFT', `${where} meaning origin changed from ${before.meaningOrigin} to ${after.meaningOrigin}`)
      if (before.title !== after.title) {
        if (before.historical?.individuallyEvidenced) fail('PROVENANCE-DRIFT', `${where} historical title was redefined`)
        else if (!revisionOf(after)?.changedFields?.includes('title')) fail('PROVENANCE-DRIFT', `${where} title changed without a revision record`)
      }
      if (asText(before.provenance?.evidenceIds ?? []) !== asText(after.provenance?.evidenceIds ?? [])) fail('PROVENANCE-DRIFT', `${where} evidence identifiers changed`)
    }
  }
  const priorDecisions = anchorOf(BASELINE_DATA.decisions)
  if (!priorDecisions) fail('PROVENANCE-DRIFT', 'the anchor decision register cannot be read from git')
  else {
    const now = new Map((data.decisions.decisions ?? []).map((d) => [d.id, d]))
    if (priorDecisions.decisions.length !== 46 || now.size !== 46) fail('PROVENANCE-DRIFT', `the decision register holds ${now.size} decisions; 46 are required`)
    for (const before of priorDecisions.decisions) {
      const after = now.get(before.id)
      if (!after) { fail('PROVENANCE-DRIFT', `decision ${before.id} was removed`); continue }
      if (before.title !== after.title) fail('PROVENANCE-DRIFT', `decision ${before.id} title was redefined`)
      if (before.type !== after.type) fail('PROVENANCE-DRIFT', `decision ${before.id} type changed`)
    }
    const count = (type) => (data.decisions.decisions ?? []).filter((d) => d.type === type).length
    if (count('PRODUCT_DESIGN') !== 14 || count('INSTITUTIONAL_AUTHORITY') !== 32) fail('PROVENANCE-DRIFT', 'the register must hold 14 product design and 32 institutional authority decisions')
  }

  const priorMatrixText = gitShowAt(root, ANCHOR_COMMIT, 'docs/union-eyes/convergence/register/ue-pre-vs-engineering-completion.json')
  if (priorMatrixText === null) fail('PROVENANCE-DRIFT', 'the anchor matrix cannot be read from git')
  else {
    const priorUniverse = Object.fromEntries(JSON.parse(priorMatrixText).personaCompleteness.map((p) => [p.persona, p.universe]))
    const nowUniverse = Object.fromEntries((matrix?.personaCompleteness ?? []).map((p) => [p.persona, p.universe]))
    let total = 0
    for (const [persona, ids] of Object.entries(priorUniverse)) {
      total += ids.length
      if (asText(ids) !== asText(nowUniverse[persona])) fail('PROVENANCE-DRIFT', `the ${persona} identifier universe changed`)
    }
    if (total !== 182) fail('PROVENANCE-DRIFT', `the identifier universe totals ${total}; 182 are required`)
  }
}

function checkSteward(steward, fail) {
  const model = steward.identityModel
  if (!model) { fail('STEWARD-IDENTITY', 'the steward identity model is absent'); return }
  if (model.distinctInstitutionalOfficeImplied !== false) fail('STEWARD-IDENTITY', 'the steward persona implies a distinct institutional office')
  if (model.officeAndCapacityConfigurablePerOrganization !== true) fail('STEWARD-IDENTITY', 'office and capacity are not configurable per organization')
  for (const [name, value] of Object.entries(model.focusedWorkspaceGrants ?? {})) if (value !== false) fail('STEWARD-IDENTITY', `the focused workspace grants ${name}`)
  for (const name of ['organizationWideVisibility', 'triage', 'reassignment', 'privilegedDisclosure']) if (!(name in (model.focusedWorkspaceGrants ?? {}))) fail('STEWARD-IDENTITY', `the focused workspace does not state ${name}`)
  const ids = (model.dimensions ?? []).map((d) => d.id)
  if (asText(ids) !== asText(IDENTITY_DIMENSIONS)) fail('STEWARD-IDENTITY', `identity dimensions are ${ids.join(', ')}`)
  for (const d of model.dimensions ?? []) {
    const carries = AUTHORITY_CARRIERS.includes(d.id)
    if (d.grantsAuthorityByItself !== carries) fail('STEWARD-IDENTITY', `${d.id} grantsAuthorityByItself is ${d.grantsAuthorityByItself}`)
    if (!carries) for (const flag of ['impliesOrganizationWideVisibility', 'impliesTriage', 'impliesReassignment', 'impliesPrivilegedDisclosure']) if (d[flag] !== false) fail('STEWARD-IDENTITY', `${d.id} ${flag} is not false`)
    if (d.id === 'ISSUED_AUTHORITY' && d.issuedByThisBaseline !== false) fail('STEWARD-IDENTITY', 'the baseline claims to issue authority')
    if (d.id === 'CASE_RELATIONSHIP' && d.authorityScope !== 'ONE_CASE_ONLY') fail('STEWARD-IDENTITY', 'a case relationship is not limited to one case')
  }
  for (const c of steward.contracts ?? []) {
    if (c.kind === 'NAVIGATION' && c.authorityDerivedFrom?.length) fail('STEWARD-IDENTITY', `${c.id} navigation derives authority`)
    if (c.kind === 'ACTION' || c.kind === 'DENIAL') {
      if (!Array.isArray(c.authorityDerivedFrom)) fail('STEWARD-IDENTITY', `${c.id} does not state what its authority derives from`)
      for (const from of c.authorityDerivedFrom ?? []) if (!AUTHORITY_CARRIERS.includes(from)) fail('STEWARD-IDENTITY', `${c.id} derives authority from ${from}`)
    }
    if (c.kind === 'ACTION' && /\b(because|as) (a|the) steward\b/i.test(`${c.permittedAction} ${c.authorization?.requirement}`)) fail('STEWARD-IDENTITY', `${c.id} derives authority from the steward title`)
  }
  const policy = steward.navigationPolicy
  const nav = (steward.contracts ?? []).filter((c) => c.kind === 'NAVIGATION')
  if (policy?.fixedDestinationCount !== false || policy?.hiddenWhenNoUsableCapability !== true || policy?.neverAdvertisesRouteThatResolvesTo404 !== true) fail('STEWARD-NAV', 'navigation promises a fixed destination count or advertises an unusable route')
  if (policy?.candidateDestinations !== nav.length) fail('STEWARD-NAV', `the policy names ${policy?.candidateDestinations} candidates and ${nav.length} exist`)
  const actionIds = new Set((steward.contracts ?? []).filter((c) => c.kind === 'ACTION').map((c) => c.id))
  for (const n of nav) {
    const v = n.navigationVisibility
    if (!v || v.fixedPromise !== false || v.shownOnlyWhenUsable !== true || v.hiddenWhenNoUsableCapability !== true) { fail('STEWARD-NAV', `${n.id} does not make visibility depend on a usable capability`); continue }
    if (!(v.requiredCapabilityContractIds ?? []).length) fail('STEWARD-NAV', `${n.id} names no capability that makes it usable`)
    for (const id of v.requiredCapabilityContractIds ?? []) if (!actionIds.has(id)) fail('STEWARD-NAV', `${n.id} names unknown capability ${id}`)
    const fresh = { SOURCE_PRESENT: 0, PARTIAL_SOURCE: 0, NOT_IMPLEMENTED: 0, UNAVAILABLE_501: 0 }
    for (const id of v.requiredCapabilityContractIds ?? []) fresh[(steward.contracts ?? []).find((c) => c.id === id)?.implementation?.status] += 1
    if (asText(fresh) !== asText(v.currentSourceState)) fail('STEWARD-NAV', `${n.id} recorded capability state is stale`)
  }
}

function checkLifecycle(key, baseline, root, matrix, capabilityText, fail) {
  const model = baseline.lifecycleModel
  if (!model) { fail('LIFECYCLE-LINEAR', `${key} has no lifecycle model`); return }
  if (model.mandatoryLinearSequence !== false) fail('LIFECYCLE-LINEAR', `${key} makes the lifecycle a mandatory sequence`)
  if (asText((model.entityTypes ?? []).map((e) => e.id)) !== asText(LIFECYCLE_ENTITY_IDS) || LIFECYCLE_ENTITY_IDS.length !== 7) fail('LIFECYCLE-ENTITY', `${key} does not name the seven distinct entity types`)
  for (const e of model.entityTypes ?? []) {
    if (e.requiresPriorEntity !== false || e.mayStandAlone !== true) fail('LIFECYCLE-LINEAR', `${key}:${e.id} requires a prior entity`)
    if (!norm(e.evidence?.class) || !norm(e.evidence?.note)) fail('LIFECYCLE-ENTITY', `${key}:${e.id} carries no evidence classification`)
    if (e.evidence?.class === 'SOURCE_BACKED') {
      const path = join(root, e.evidence.file)
      if (!existsSync(path) || !norm(readFileSync(path, 'utf8')).includes(norm(e.evidence.quote))) fail('LIFECYCLE-EVIDENCE', `${key}:${e.id} quote is not in ${e.evidence.file}`)
    }
  }
  const entityIds = new Set(LIFECYCLE_ENTITY_IDS)
  for (const l of model.allowedLinks ?? []) {
    if (!entityIds.has(l.from) || !entityIds.has(l.to)) fail('LIFECYCLE-LINK', `${key} link ${l.from} to ${l.to} names an unknown entity`)
    if (l.required !== false || l.exclusive !== false) fail('LIFECYCLE-LINEAR', `${key} link ${l.from} to ${l.to} is required or exclusive`)
  }
  const t = model.transitions
  if (t?.everyTransitionConfigurable !== true || t?.configurationScope !== 'PER_ORGANIZATION_PROTOCOL' || t?.defaultsAreProposalsOnly !== true) fail('LIFECYCLE-LINEAR', `${key} transitions are not configurable per organization`)
  for (const d of t?.proposedDefaults ?? []) if (d.configurable !== true) fail('LIFECYCLE-LINEAR', `${key} default ${d.from} to ${d.to} is not configurable`)
  const canonical = model.canonicalEntityDecision
  if (canonical?.status !== 'UNRESOLVED_UNDER_GATE_4' || canonical?.settledByThisBaseline !== false || canonical?.gate !== 4) fail('LIFECYCLE-CANONICAL', `${key} settles the claims versus grievances decision that belongs to Gate 4`)
  const gate = (matrix?.capabilities ?? []).find((c) => c.id === canonical?.capabilityId)
  if (!gate && !capabilityText.includes(`'${canonical?.capabilityId}'`)) fail('LIFECYCLE-CANONICAL', `${key} cites capability ${canonical?.capabilityId}, which is not recorded`)
  if (gate && Number(gate.primaryGate) !== 4) fail('LIFECYCLE-CANONICAL', `${canonical.capabilityId} is Gate ${gate.primaryGate}, not Gate 4`)
  if (gate && gate.sourceStatus === undefined) fail('LIFECYCLE-CANONICAL', `${canonical.capabilityId} has no recorded source status`)
  for (const c of [...(baseline.contracts ?? []), ...(baseline.journeys ?? [])]) {
    const text = asText([c.proposedMeaning, c.permittedAction, c.persistedResult, c.userVisibleOutcome, c.expectedPersistedResult, c.testableAssertions, (c.steps ?? []).map((s) => s.assertion)])
    for (const phrase of LINEAR_PHRASES) if (phrase.test(text)) fail('LIFECYCLE-LINEAR', `${key}:${c.id} presents a mandatory lifecycle (${phrase})`)
    if (c.lifecycle) {
      const l = c.lifecycle
      if (l.assumesPriorEntity !== false || l.mandatorySequence !== false || l.transitionsConfigurable !== true || l.canonicalClaimsVersusGrievancesSettled !== false) fail('LIFECYCLE-LINEAR', `${key}:${c.id} lifecycle block assumes a sequence`)
      for (const id of l.entityTypes ?? []) if (!entityIds.has(id)) fail('LIFECYCLE-ENTITY', `${key}:${c.id} names unknown entity ${id}`)
      if (!(l.entityTypes ?? []).length) fail('LIFECYCLE-ENTITY', `${key}:${c.id} names no entity type`)
    }
  }
  for (const v of model.organizationVariations ?? []) if (baseline.scenarios && !(baseline.scenarios ?? []).some((s) => s.id === v.scenarioId)) fail('LIFECYCLE-LINK', `${key} variation names unknown scenario ${v.scenarioId}`)
}

function checkDisclosure(key, baseline, fail) {
  const model = baseline.disclosureModel
  if (!model) { fail('DISCLOSURE-MODEL', `${key} has no disclosure model`); return }
  if (model.defaultVisibility !== 'STAFF_ONLY' || model.clientVisibilityFlagSufficient !== false || model.decisionEvaluatedServerSide !== true || model.independentOfAuthoringAuthority !== true) fail('DISCLOSURE-MODEL', `${key} disclosure model lets a client flag or the author decide`)
  if (asText(model.memberVisibleRequires) !== asText(['CLASSIFICATION', 'AUTHORIZED_DISCLOSURE_DECISION'])) fail('DISCLOSURE-MODEL', `${key} member visibility does not require both a classification and an authorized decision`)
  if (asText((model.paths ?? []).map((p) => p.id)) !== asText(DISCLOSURE_PATHS)) fail('DISCLOSURE-MODEL', `${key} disclosure paths are incomplete`)
  for (const never of ['privileged', 'counsel-controlled', 'third-party restricted']) if (!(model.neverDisclosable ?? []).includes(never)) fail('DISCLOSURE-MODEL', `${key} does not exclude ${never} material`)
  if (!/not yet classify|does not classify|records no classification/i.test(model.sourceBehaviourToday ?? '')) fail('DISCLOSURE-MODEL', `${key} overstates what source does today`)
  for (const c of baseline.contracts ?? []) {
    const d = c.disclosure
    const where = `${key}:${c.id}`
    if (d) {
      if (d.defaultVisibility !== 'STAFF_ONLY') fail('DISCLOSURE-DEFAULT', `${where} default visibility is ${d.defaultVisibility}`)
      if (d.classificationRequired !== true || !norm(d.classification)) fail('DISCLOSURE-CLASSIFICATION', `${where} does not require a classification`)
      if (d.decisionEvaluatedServerSide !== true) fail('DISCLOSURE-SERVER', `${where} does not evaluate the decision on the server`)
      if (d.clientVisibilityFlagSufficient !== false) fail('DISCLOSURE-CLIENT-FLAG', `${where} lets a client flag decide visibility`)
      if (d.independentOfAuthoringAuthority !== true) fail('DISCLOSURE-INDEPENDENT', `${where} ties disclosure to the authoring authority`)
      if (!DISCLOSURE_PATHS.includes(d.pathId)) fail('DISCLOSURE-PATH', `${where} names path ${d.pathId}`)
      if (!d.decisionAuthority?.basisId || !(d.decisionAuthority?.kernelActions ?? []).length) fail('DISCLOSURE-AUTHORITY', `${where} names no authority for the disclosure decision`)
      if (!norm(d.decisionRecord)) fail('DISCLOSURE-RECORD', `${where} records no disclosure decision`)
      for (const never of ['privileged', 'counsel-controlled', 'third-party restricted']) if (!(d.neverDisclosable ?? []).includes(never)) fail('DISCLOSURE-RESTRICTED', `${where} does not exclude ${never} material`)
      if (d.pathId !== 'DISC-PATH-STRUCTURED-ENTRY' && !(c.institutionalAdoption?.decisionIds ?? []).includes('DEC-IA-05')) fail('DISCLOSURE-ADOPTION', `${where} releases labelled content without DEC-IA-05`)
    } else if (c.kind !== 'DENIAL' && c.kind !== 'NAVIGATION' && /request flag|visibility flag|member-visible flag|toggle/i.test(`${c.permittedAction} ${c.preconditions?.join(' ')}`) && !/not|never|ignored/i.test(`${c.permittedAction}`)) {
      fail('DISCLOSURE-CLIENT-FLAG', `${where} appears to let a client flag choose visibility`)
    }
    if (!d && (c.kind === 'ACTION' || c.kind === 'DOMAIN') && (c.id in DISCLOSURE_CONTRACTS || (!/^None\b/.test(norm(c.persistedResult)) && MEMBER_VISIBLE_TEXT.test(`${c.permittedAction} ${c.persistedResult} ${(c.preconditions ?? []).join(' ')}`)))) {
      fail('DISCLOSURE-MISSING', `${where} describes member-visible content and carries no disclosure block`)
    }
  }
}

function dutyOf(step) {
  return FINANCE_DUTY_BY_BASIS[step.authorizationBasisId] ?? null
}

function checkSegregation(root, fin, fail) {
  const model = fin.segregationModel
  if (!model) { fail('FO-SEGREGATION-UNIVERSAL', 'the segregation model is absent'); return }
  if (model.stance !== 'CONFIGURABLE_NOT_UNIVERSAL' || model.universalDifferentPersonPerStep !== false) fail('FO-SEGREGATION-UNIVERSAL', 'the model asserts a universal different-person-per-step rule')
  if (asText(model.distinctDuties) !== asText(['view', 'prepare', 'approve', 'execute', 'reconcile', 'audit'])) fail('FO-DUTIES', 'the six financial powers are not kept separate')
  if (asText(model.evaluatedAgainst) !== asText(SEPARATION_EVALUATED_AGAINST)) fail('FO-SEGREGATION-EVALUATION', 'separation is not evaluated against the transaction, account, amount, mandate, approval and principal')
  const file = (path) => (existsSync(join(root, path)) ? norm(readFileSync(join(root, path), 'utf8')) : null)
  for (const p of model.technicalProtections ?? []) {
    if (p.kind !== 'MANDATORY_TECHNICAL_PROTECTION' || p.institutionalRequirement !== false) fail('FO-SEGREGATION-KINDS', `${p.id} is not a mandatory technical protection`)
    const text = file(p.source?.file)
    if (text === null || !text.includes(norm(p.source?.quote))) fail('FO-SEGREGATION-SOURCE', `${p.id} quote is not in ${p.source?.file}`)
  }
  if ((model.technicalProtections ?? []).length !== 6) fail('FO-SEGREGATION-KINDS', 'six mandatory technical protections are required')
  const financeSource = file('apps/union-eyes/lib/authority/policies/finance.ts') ?? ''
  const sourcePairs = incompatibleDutiesFromSource(readFileSync(join(root, 'apps/union-eyes/lib/authority/policies/finance.ts'), 'utf8'))
  const ruleIds = new Set()
  for (const r of model.separationRules ?? []) {
    ruleIds.add(r.id)
    if (!['IMPLEMENTED_SOFTWARE_RULE', 'PROPOSED_INSTITUTIONAL_SEPARATION'].includes(r.kind)) fail('FO-SEGREGATION-KINDS', `${r.id} has kind ${r.kind}`)
    if (r.universal !== false || r.institutionallyAdopted !== false) fail('FO-SEGREGATION-UNIVERSAL', `${r.id} is universal or institutionally adopted`)
    if (/CONSECUTIVE/.test(r.scope ?? '')) fail('FO-SEGREGATION-UNIVERSAL', `${r.id} applies to consecutive steps`)
    if (!(r.adoptionDecisionIds ?? []).length) fail('FO-SEGREGATION-ADOPTION', `${r.id} names no adoption decision`)
    if (asText(r.evaluatedAgainst) !== asText(SEPARATION_EVALUATED_AGAINST)) fail('FO-SEGREGATION-EVALUATION', `${r.id} is not evaluated against the actual transaction facts`)
    if (r.kind === 'IMPLEMENTED_SOFTWARE_RULE') {
      const text = file(r.source?.file)
      if (text === null || !text.includes(norm(r.source?.quote))) fail('FO-SEGREGATION-SOURCE', `${r.id} quote is not in ${r.source?.file}`)
      if (r.configurableInSource !== false) fail('FO-SEGREGATION-SOURCE', `${r.id} claims source configurability that source does not show`)
    } else if (r.source) fail('FO-SEGREGATION-KINDS', `${r.id} is proposed and cites source`)
    if (r.id === 'SEP-SW-06' && asText(r.prohibitedCombinations) !== asText(sourcePairs)) fail('FO-SEGREGATION-SOURCE', 'SEP-SW-06 restates the incompatible duty pairs differently from source')
  }
  if (!/INCOMPATIBLE_DUTIES/.test(financeSource) || sourcePairs.length === 0) fail('FO-SEGREGATION-SOURCE', 'the incompatible duty pairs cannot be read from source')
  if ((model.separationRules ?? []).filter((r) => r.kind === 'PROPOSED_INSTITUTIONAL_SEPARATION').length === 0) fail('FO-SEGREGATION-KINDS', 'no proposed institutional separation is recorded')
  if (!/not proof that an institution adopted it/.test(model.threePersonIssuance ?? '')) fail('FO-SEGREGATION-UNIVERSAL', 'the three-person issuance design is presented as universal adoption')
  const sw07 = (model.separationRules ?? []).find((r) => r.id === 'SEP-SW-07')
  if (!sw07 || sw07.kind !== 'IMPLEMENTED_SOFTWARE_RULE' || sw07.institutionallyAdopted !== false) fail('FO-SEGREGATION-UNIVERSAL', 'SEP-SW-07 is not recorded as an implemented software rule that is not adopted')

  for (const c of (fin.contracts ?? []).filter((x) => x.kind === 'DOMAIN' && /^F\d{2}$/.test(x.id))) {
    const s = c.financial?.requiredSegregationOfDuties
    if (!s || typeof s !== 'object' || s.universalDifferentPersonRule !== false || !norm(s.summary)) fail('FO-SEGREGATION-UNIVERSAL', `${c.id} states a universal different-person rule`)
    for (const id of s?.ruleIds ?? []) if (!ruleIds.has(id)) fail('FO-SEGREGATION-RULE', `${c.id} names unknown rule ${id}`)
    if (!UNIVERSAL_EXEMPT_CONTRACTS.has(c.id)) {
      const text = asText([c.proposedMeaning, c.permittedAction, c.preconditions, c.userVisibleOutcome, c.financial?.operationalCapability, c.financial?.requiredSegregationOfDuties])
      if (UNIVERSAL_DIFFERENT_PERSON.test(text)) fail('FO-SEGREGATION-UNIVERSAL', `${c.id} invents a universal different-person requirement`)
    }
  }
  const f01 = (fin.contracts ?? []).find((c) => c.id === 'F01')
  if (!f01?.softwareRuleEvidence || f01.softwareRuleEvidence.institutionallyAdopted !== false) fail('FO-SEGREGATION-UNIVERSAL', 'F01 presents the issuance rule as adopted')

  let sharedSlot = false
  for (const j of fin.journeys ?? []) {
    const where = `${j.id}`
    if (j.consecutiveStepsRequireDifferentPerson !== false || j.separationStance !== 'RULE_DRIVEN_NOT_UNIVERSAL') fail('FO-JOURNEY-SEGREGATION', `${where} assumes consecutive steps need different people`)
    if (UNIVERSAL_DIFFERENT_PERSON.test(asText([j.proposedMeaning, j.preconditions, j.testableAssertions, j.expectedPersistedResult, (j.steps ?? []).map((s) => [s.action, s.assertion])]))) fail('FO-JOURNEY-SEGREGATION', `${where} invents a universal different-person requirement`)
    const slots = new Map((j.steps ?? []).map((s) => [s.n, s.actorSlot]))
    for (const s of j.steps ?? []) if (!norm(s.actorSlot)) fail('FO-JOURNEY-SEGREGATION', `${where} step ${s.n} names no actor slot`)
    for (let i = 1; i < (j.steps ?? []).length; i += 1) if (j.steps[i].actorSlot === j.steps[i - 1].actorSlot) sharedSlot = true
    if (!Array.isArray(j.separationChecks)) { fail('FO-JOURNEY-SEGREGATION', `${where} lists no separation checks`); continue }
    for (const check of j.separationChecks) {
      const rule = (model.separationRules ?? []).find((r) => r.id === check.ruleId)
      if (!rule) { fail('FO-JOURNEY-SEGREGATION', `${where} names unknown rule ${check.ruleId}`); continue }
      for (const n of check.stepNumbers ?? []) if (!slots.has(n)) fail('FO-JOURNEY-SEGREGATION', `${where} check ${check.ruleId} names missing step ${n}`)
      if (!Array.isArray(rule.prohibitedCombinations)) continue
      const steps = (j.steps ?? []).filter((s) => (check.stepNumbers ?? []).includes(s.n))
      for (const [a, b] of rule.prohibitedCombinations) {
        for (const x of steps) {
          for (const y of steps) {
            if (x === y) continue
            const dx = dutyOf(x)
            const dy = dutyOf(y)
            const matches = dx && dy && ((dx === a && (dy === b || b === '*')) || (a === '*' && dy === b))
            if (matches && x.actorSlot === y.actorSlot) fail('FO-JOURNEY-SEGREGATION', `${where} lets one actor slot hold ${dx} and ${dy} against ${check.ruleId}`)
          }
        }
      }
    }
  }
  if (!sharedSlot) fail('FO-JOURNEY-SEGREGATION', 'no journey lets one actor slot hold consecutive steps; the baseline assumes a universal different-person rule')
}

function checkReporting(fin, fail) {
  const m = fin.reportingModel
  if (!m) { fail('FO-REPORTING', 'the reporting model is absent'); return }
  for (const flag of ['viewDutyAloneSufficientForReport', 'viewDutyAloneSufficientForMemberLevelRows', 'viewDutyAloneSufficientForExport', 'unionFinanceReportEngineExists']) if (m[flag] !== false) fail('FO-REPORTING', `the reporting model sets ${flag}`)
  if (m.exportIsSeparateDutyCheckedAction !== true) fail('FO-REPORTING', 'an export is not a separate duty-checked action')
  if (asText((m.authorizationDimensions ?? []).map((d) => d.id)) !== asText(REPORTING_DIMENSIONS)) fail('FO-REPORTING', 'the reporting authorization dimensions are incomplete')
  for (const id of ['F22', 'F25', 'F27', 'F08', 'FO-NAV-6']) {
    const c = (fin.contracts ?? []).find((x) => x.id === id)
    const r = c?.reporting
    if (!r || r.viewDutyAloneSufficient !== false || r.exportRequiresSeparateAuthorization !== true || r.platformBillingExcluded !== true) fail('FO-REPORTING', `${id} does not authorize reports and exports separately from a view duty`)
    else if (asText(r.authorizationDimensionIds) !== asText(REPORTING_DIMENSIONS)) fail('FO-REPORTING', `${id} omits an authorization dimension`)
    if (id !== 'F25' && r?.exportAllowedByThisContract !== false) fail('FO-REPORTING', `${id} allows an export`)
  }
}

function checkPlatformBilling(root, fin, fail) {
  const b = fin.platformBillingBoundary
  if (!b || b.isUnionFinance !== false || b.separateFromUnionFinance !== true) fail('PLATFORM-BILLING-AS-UNION-FINANCE', 'the baseline does not keep platform billing separate from union finance')
  for (const e of b?.evidence ?? []) {
    const path = join(root, e.file)
    if (!existsSync(path) || !norm(readFileSync(path, 'utf8')).includes(norm(e.quote))) fail('PLATFORM-BILLING-EVIDENCE', `the platform billing quote is not in ${e.file}`)
  }
  if (!(b?.evidence ?? []).length) fail('PLATFORM-BILLING-EVIDENCE', 'no platform billing evidence is recorded')
  for (const c of fin.contracts ?? []) {
    for (const cited of [...(c.implementation?.routes ?? []), ...(c.implementation?.services ?? [])]) {
      const path = join(root, cited.file)
      if (existsSync(path) && isPlatformEconomicsText(readFileSync(path, 'utf8'))) fail('PLATFORM-BILLING-AS-UNION-FINANCE', `${c.id} cites ${cited.file}, a platform billing surface, as union finance evidence`)
    }
    for (const surface of c.implementation?.platformBillingSurfaces ?? []) if (surface.isUnionFinanceEvidence !== false) fail('PLATFORM-BILLING-AS-UNION-FINANCE', `${c.id} treats ${surface.file} as union finance evidence`)
  }
  const f28 = (fin.contracts ?? []).find((c) => c.id === 'F28')
  if (f28 && f28.implementation?.status !== 'NOT_IMPLEMENTED') fail('PLATFORM-BILLING-AS-UNION-FINANCE', 'F28 claims implementation on the strength of a platform billing page')
}

function checkFinanceNavigation(fin, fail) {
  const adv = fin.navigationAdvertisement
  if (!adv?.NOT_ADVERTISED_UNTIL_IMPLEMENTED || !adv?.SHOWN_WITH_STATE_LABELS || !adv?.SHOWN_WHEN_USABLE) fail('FO-NAV-STATE', 'the navigation advertisement states are absent')
  if (fin.taxonomyIsEvidenceOfFunctionality !== false) fail('FO-NAV-STATE', 'the taxonomy is presented as evidence of functionality')
  const byId = new Map((fin.contracts ?? []).map((c) => [c.id, c]))
  for (const n of (fin.contracts ?? []).filter((c) => c.kind === 'NAVIGATION')) {
    const s = n.capabilityState
    if (!s || s.impliesOperationalFinanceEngine !== false) { fail('FO-NAV-STATE', `${n.id} has no capability state or implies an engine`); continue }
    const statuses = Object.fromEntries(Object.keys(s.byCapability ?? {}).map((id) => [id, byId.get(id)?.implementation?.status]))
    if (asText(statuses) !== asText(s.byCapability)) fail('FO-NAV-STATE', `${n.id} capability state is stale`)
    const derived = deriveNavigationState(statuses)
    if (derived.advertisement !== s.advertisement || derived.aggregate !== s.aggregate) fail('FO-NAV-STATE', `${n.id} advertisement ${s.advertisement} disagrees with its capabilities (${derived.advertisement})`)
  }
}

function checkScenariosAndJourneys(key, baseline, fail) {
  const keys = new Set()
  for (const s of baseline.scenarios ?? []) {
    const c = s.configuration
    if (!c || c.independentlyConfigurable !== true || (c.sharesConfigurationWith ?? []).length !== 0 || c.validation?.independentlyValidated !== true) fail('SCENARIO-CONFIG', `${key}:${s.id} is not independently configurable and validated`)
    if (keys.has(c?.configurationKey)) fail('SCENARIO-CONFIG', `${key}:${s.id} shares configuration ${c?.configurationKey}`)
    keys.add(c?.configurationKey)
    if (c?.validation?.status !== 'NOT_YET_VALIDATED') fail('SCENARIO-CONFIG', `${key}:${s.id} claims validation`)
  }
  for (const j of baseline.journeys ?? []) {
    if (j.executionStatus !== 'NOT_EXECUTED' || j.countsAsPassed !== false) fail('JOURNEY-EXECUTION', `${key}:${j.id} counts as passed without an execution`)
  }
}

function checkRepScope(rep, fail) {
  const s = rep.scopeAndConflictBoundaries
  if (!s || s.scopeIsNeverInferredFromOfficeOrSeniority !== true || s.conflictDenialPrecedesEverySourceOfAuthority !== true) fail('REP-SCOPE', 'the representative scope and conflict boundaries are absent or inferred from office')
  if (!(s?.territoryAndUnitScopeInactiveUntil ?? []).includes('DEC-IA-10')) fail('REP-SCOPE', 'territory and unit scope are active without DEC-IA-10')
}

function checkRevisionLog(key, baseline, fail) {
  const log = baseline.revisionLog
  if (!log || log.round !== REVISION_ROUND) { fail('REVISION-LOG', `${key} carries no ${REVISION_ROUND} revision log`); return }
  const revised = [...(baseline.contracts ?? []), ...(baseline.journeys ?? []), ...(baseline.scenarios ?? [])].filter((c) => c.revision).map((c) => c.id)
  if (asText(revised) !== asText(log.revisedContractIds)) fail('REVISION-LOG', `${key} revision log disagrees with the revised contracts`)
  for (const c of [...(baseline.contracts ?? []), ...(baseline.journeys ?? [])]) {
    if (c.revision && (c.revision.round !== REVISION_ROUND || !(c.revision.reasons ?? []).length)) fail('REVISION-LOG', `${key}:${c.id} revision lacks a round or reason`)
  }
}

export function validateRevisions(ctx) {
  const { root, data, matrix, fail, capabilityText } = ctx
  for (const key of ['steward', 'representative', 'financial-officer', 'decisions']) checkAuthorityHeader(key, data[key], fail)
  for (const key of ['steward', 'representative', 'financial-officer']) {
    checkAuthorityStates(key, data[key], fail)
    checkRevisionLog(key, data[key], fail)
    checkScenariosAndJourneys(key, data[key], fail)
  }
  checkDecisionStates(data.decisions, fail)
  checkProvenance(root, data, matrix, fail)
  checkSteward(data.steward, fail)
  for (const key of ['steward', 'representative']) {
    checkLifecycle(key, data[key], root, matrix, capabilityText, fail)
    checkDisclosure(key, data[key], fail)
  }
  checkRepScope(data.representative, fail)
  const fin = data['financial-officer']
  checkSegregation(root, fin, fail)
  checkReporting(fin, fail)
  checkPlatformBilling(root, fin, fail)
  checkFinanceNavigation(fin, fail)
}
