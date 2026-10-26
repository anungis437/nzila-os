/**
 * Machine checks for the Gate 0A.2 proposed persona baselines.
 *
 * A proposed baseline is a design for product specification review. These checks keep it honest: identifiers stay
 * accounted for, every actionable contract names an authorization boundary and a recusal rule, historical meanings stay
 * separate from proposed meanings, implementation claims cannot exceed what the cited source shows, and nothing a
 * baseline says creates live institutional authority. The checks report three separate measures: identifier coverage,
 * behavioural specification depth, and implemented functionality.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  AUDIT_CLASSES, AUTHORIZATION_BASES, BASELINE_DATA, BASELINE_DOCS, CONTRACT_KINDS, DENIAL_CLASSES, EVIDENCE_CLASSES,
  FINANCIAL_DUTIES, HISTORICAL_KINDS, IMPLEMENTATION_STATUSES, LABELS, PRIVACY_CLASSES, ROUTE_SIGNALS, deriveFileFacts, loadOntologyActions,
} from './ue-gate0a2-baseline-facts.mjs'
import { gitBlobAt, gitShowAt, loadRecovery } from './ue-gate0a-persona-recovery.mjs'
import { validateRevisions } from './ue-gate0a2r-validate.mjs'

const norm = (text) => String(text ?? '').replace(/\s+/g, ' ').trim()
const filled = (value) => (Array.isArray(value) ? value.length > 0 && value.every((item) => norm(item).length > 0) : norm(value).length > 0)
const SEGREGATED_DUTIES = ['approve', 'execute', 'reconcile', 'audit']
const MEANING_ORIGINS = ['NEW_DESIGN', 'HISTORICAL_TITLE_WITH_NEW_SPECIFICATION', 'NEW_DESIGN_UNDER_HISTORICAL_STATUS', 'NEW_DESIGN_UNDER_HISTORICAL_GROUP']

/** The Phase 4 fields a proposed action contract must carry. Returns the names of the missing ones. */
export function specFieldsMissing(c) {
  const missing = []
  const need = (name, ok) => { if (!ok) missing.push(name) }
  need('id', filled(c.id))
  need('title', filled(c.title))
  need('proposedMeaning', filled(c.proposedMeaning))
  need('actor', filled(c.actor))
  need('trigger', filled(c.trigger))
  need('resource', filled(c.resource))
  need('preconditions', filled(c.preconditions))
  need('permittedAction', filled(c.permittedAction))
  need('persistedResult', filled(c.persistedResult))
  need('authorization.basisId', filled(c.authorization?.basisId))
  need('authorization.requirement', filled(c.authorization?.requirement))
  need('authorization.recusal', filled(c.authorization?.recusal))
  need('audit', filled(c.audit?.classId) && filled(c.audit?.note))
  need('privacy', filled(c.privacy?.classId) && filled(c.privacy?.note))
  need('userVisibleOutcome', filled(c.userVisibleOutcome))
  need('denialAndRecovery', filled(c.denialAndRecovery?.class) && filled(c.denialAndRecovery?.behavior))
  need('implementation.status', filled(c.implementation?.status))
  need('provenance', filled(c.provenance?.design) && filled(c.provenance?.evidenceClass))
  need('institutionalAdoption', typeof c.institutionalAdoption?.required === 'boolean' && Array.isArray(c.institutionalAdoption?.decisionIds))
  need('labels', Array.isArray(c.labels) && c.labels.length > 0)
  return missing
}

export function journeyFieldsMissing(j) {
  const missing = []
  const need = (name, ok) => { if (!ok) missing.push(name) }
  need('id', filled(j.id)); need('title', filled(j.title)); need('proposedMeaning', filled(j.proposedMeaning)); need('actor', filled(j.actor))
  need('preconditions', filled(j.preconditions)); need('steps', Array.isArray(j.steps) && j.steps.length >= 2)
  need('expectedPersistedResult', filled(j.expectedPersistedResult)); need('denialAndRecovery', filled(j.denialAndRecovery))
  need('testableAssertions', filled(j.testableAssertions)); need('provenance', filled(j.provenance?.design))
  need('institutionalAdoption', typeof j.institutionalAdoption?.required === 'boolean')
  return missing
}

export function loadBaselines(root) {
  const out = {}
  for (const [key, file] of Object.entries(BASELINE_DATA)) {
    try {
      out[key] = JSON.parse(readFileSync(join(root, file), 'utf8'))
    } catch {
      out[key] = null
    }
  }
  return out
}

export function sha256File(root, file) {
  return createHash('sha256').update(readFileSync(join(root, file))).digest('hex')
}

function allContracts(baseline) {
  return [...(baseline.contracts ?? []), ...(baseline.journeys ?? []), ...(baseline.scenarios ?? [])]
}

function universeOf(matrix, persona) {
  return (matrix?.personaCompleteness ?? []).find((p) => p.persona === persona)?.universe ?? []
}

export function validateBaselines(root, options = {}) {
  const problems = []
  const fail = (code, message) => problems.push(`${code}: ${message}`)
  const data = options.data ?? loadBaselines(root)
  const recovery = loadRecovery(root)
  const matrixPath = join(root, 'docs/union-eyes/convergence/register/ue-pre-vs-engineering-completion.json')
  const matrix = options.matrix ?? (existsSync(matrixPath) ? JSON.parse(readFileSync(matrixPath, 'utf8')) : null)
  const ontology = new Set(loadOntologyActions(root))
  const summary = { personas: {}, decisions: {}, historicalVersusProposed: {} }

  for (const [key, file] of Object.entries(BASELINE_DATA)) if (!data[key]) fail('BASELINE-MISSING', `${file} is absent or unreadable`)
  for (const [key, file] of Object.entries(BASELINE_DOCS)) if (!options.data && !existsSync(join(root, file))) fail('BASELINE-DOC-MISSING', `${file} is absent (${key})`)
  if (problems.length > 0) return { problems, summary }

  const decisions = data.decisions
  const decisionIds = new Set((decisions.decisions ?? []).map((d) => d.id))
  const registrySources = new Map((recovery?.sources ?? []).map((s) => [s.id, s]))
  const capabilityText = existsSync(join(root, 'apps/union-eyes/lib/reality/capability-registry.ts')) ? readFileSync(join(root, 'apps/union-eyes/lib/reality/capability-registry.ts'), 'utf8') : ''
  const matrixCapabilityIds = new Set((matrix?.capabilities ?? []).map((c) => c.id))
  const referencedDecisions = new Set()
  const allIds = new Set()
  const quoteCache = new Map()

  const sourceText = (sourceId) => {
    const source = registrySources.get(sourceId)
    if (!source) return null
    if (!quoteCache.has(sourceId)) {
      const text = gitShowAt(root, source.commit, source.path)
      quoteCache.set(sourceId, text === null ? null : norm(text))
    }
    return quoteCache.get(sourceId)
  }

  // Decision register
  const pdCount = (decisions.decisions ?? []).filter((d) => d.type === 'PRODUCT_DESIGN').length
  const iaCount = (decisions.decisions ?? []).filter((d) => d.type === 'INSTITUTIONAL_AUTHORITY').length
  summary.decisions = { productDesign: pdCount, institutionalAuthority: iaCount, outstanding: (decisions.decisions ?? []).filter((d) => d.status === 'OUTSTANDING').length }
  for (const d of decisions.decisions ?? []) {
    if (!['PRODUCT_DESIGN', 'INSTITUTIONAL_AUTHORITY'].includes(d.type)) fail('DECISION-TYPE', `${d.id} has type ${d.type}`)
    if (d.status !== 'OUTSTANDING') fail('DECISION-STATUS', `${d.id} is ${d.status}; a proposed baseline cannot settle a decision`)
    if (!filled(d.inactiveBehaviorUntilAdopted)) fail('DECISION-INACTIVE-BEHAVIOR', `${d.id} does not state the behaviour that stays inactive`)
    if (d.type === 'INSTITUTIONAL_AUTHORITY') {
      if (d.activation !== 'INACTIVE') fail('DECISION-ACTIVATION', `${d.id} is not INACTIVE`)
      if (d.decisionOwner !== 'TO_BE_NAMED_BY_INSTITUTION') fail('DECISION-OWNER', `${d.id} names an owner; the institution names it`)
      if (d.baselineProposal !== null) fail('DECISION-PROPOSAL', `${d.id} carries a proposal for an institutional authority decision`)
    } else if (d.activation !== 'PROPOSAL_ONLY_NOT_ADOPTED') fail('DECISION-ACTIVATION', `${d.id} activation is ${d.activation}`)
  }

  const checkStatusFields = (key, baseline) => {
    if (baseline.status !== 'PROPOSED_NOT_ADOPTED') fail('BASELINE-STATUS', `${key} status is ${baseline.status}`)
    if (baseline.adopted !== false || baseline.frozen !== false || baseline.originalRecovered !== false) fail('BASELINE-FALSE-CLAIM', `${key} claims adopted, frozen or recovered`)
    if (!Array.isArray(baseline.banner) || !baseline.banner[0]?.includes('PROPOSED NEW BASELINE')) fail('BASELINE-BANNER', `${key} lacks the proposed-baseline banner`)
  }

  const checkContract = (key, c) => {
    const where = `${key}:${c.id}`
    if (allIds.has(`${key}:${c.id}`)) fail('CONTRACT-DUPLICATE', `${where} is defined twice`)
    allIds.add(`${key}:${c.id}`)
    if (!CONTRACT_KINDS.includes(c.kind)) fail('CONTRACT-KIND', `${where} has kind ${c.kind}`)
    const isJourney = c.kind === 'JOURNEY'
    const isScenario = c.kind === 'SCENARIO'
    if (isScenario) return
    const missing = isJourney ? journeyFieldsMissing(c) : specFieldsMissing(c)
    if (missing.length > 0) fail('SPEC-FIELDS-MISSING', `${where} lacks ${missing.join(', ')}`)

    for (const label of c.labels ?? []) if (!LABELS.includes(label)) fail('LABEL-UNKNOWN', `${where} has label ${label}`)
    if (!(c.labels ?? []).includes('PROPOSED_NEW_BASELINE')) fail('LABEL-PROPOSED', `${where} is not labelled PROPOSED_NEW_BASELINE`)
    const hasLabel = (name) => (c.labels ?? []).includes(name)
    if (hasLabel('HISTORICALLY_EVIDENCED') !== Boolean(c.historical?.individuallyEvidenced)) fail('LABEL-CONFLATION', `${where} HISTORICALLY_EVIDENCED label disagrees with its historical record`)
    const hasSource = ['SOURCE_PRESENT', 'PARTIAL_SOURCE'].includes(c.implementation?.status)
    if (hasLabel('IMPLEMENTED_SOURCE') !== hasSource) fail('LABEL-CONFLATION', `${where} IMPLEMENTED_SOURCE label disagrees with implementation status ${c.implementation?.status}`)
    if (hasLabel('REQUIRES_INSTITUTIONAL_ADOPTION') !== (c.institutionalAdoption?.decisionIds ?? []).length > 0) fail('LABEL-CONFLATION', `${where} REQUIRES_INSTITUTIONAL_ADOPTION label disagrees with its decision ids`)
    if (c.institutionalAdoption?.required !== (c.institutionalAdoption?.decisionIds ?? []).length > 0) fail('ADOPTION-INCONSISTENT', `${where} adoption.required disagrees with decision ids`)

    if (!MEANING_ORIGINS.includes(c.meaningOrigin)) fail('MEANING-ORIGIN', `${where} has meaningOrigin ${c.meaningOrigin}`)
    if (!c.historical && c.meaningOrigin !== 'NEW_DESIGN') fail('MEANING-ORIGIN', `${where} has no historical source but meaningOrigin ${c.meaningOrigin}`)
    if (c.historical) {
      const h = c.historical
      if (!HISTORICAL_KINDS.includes(h.kind)) fail('HISTORICAL-KIND', `${where} has historical kind ${h.kind}`)
      if (c.meaningOrigin === 'NEW_DESIGN') fail('MEANING-ORIGIN', `${where} has a historical source but meaningOrigin NEW_DESIGN`)
      if (!h.individuallyEvidenced && c.meaningOrigin === 'HISTORICAL_TITLE_WITH_NEW_SPECIFICATION') fail('MEANING-INTERCHANGED', `${where} presents a group or status as an individual historical meaning`)
      if (h.kind === 'GROUP_LABEL' && h.individuallyEvidenced) fail('MEANING-INTERCHANGED', `${where} marks a group label as individually evidenced`)
      if (h.kind === 'STATUS_ONLY' && h.individuallyEvidenced) fail('MEANING-INTERCHANGED', `${where} marks a status-only reference as individually evidenced`)
      const text = sourceText(h.sourceId)
      if (text === null) fail('HISTORICAL-SOURCE', `${where} cites source ${h.sourceId} that cannot be read from git`)
      else if (!text.includes(norm(h.quote))) fail('HISTORICAL-QUOTE', `${where} quotes text that is not in ${h.sourceId}: ${h.quote}`)
      if (norm(c.proposedMeaning) === norm(h.quote)) fail('MEANING-INTERCHANGED', `${where} proposed meaning is the historical quote`)
    }
    if (isJourney) return

    const basis = AUTHORIZATION_BASES[c.authorization?.basisId]
    if (!basis) fail('AUTH-BASIS', `${where} names unknown authorization basis ${c.authorization?.basisId}`)
    for (const action of c.authorization?.kernelActions ?? []) if (!ontology.has(action)) fail('AUTH-KERNEL-ACTION', `${where} names ${action}, which is not a kernel action`)
    if (basis?.requiresInstitutionalInstrument && !(c.institutionalAdoption?.decisionIds ?? []).length) fail('ADOPTION-MISSING', `${where} rests on ${c.authorization.basisId}, which needs an institutional instrument, but names no decision`)
    if (c.liveAuthorityCreated !== false) fail('LIVE-AUTHORITY', `${where} claims or implies live authority`)
    if (!['INACTIVE_UNTIL_ADOPTED', 'PROPOSAL_ONLY_NOT_ADOPTED'].includes(c.activation)) fail('LIVE-AUTHORITY', `${where} activation is ${c.activation}`)
    if (c.institutionalAdoption?.required && c.activation !== 'INACTIVE_UNTIL_ADOPTED') fail('LIVE-AUTHORITY', `${where} needs adoption but is not INACTIVE_UNTIL_ADOPTED`)
    if (!AUDIT_CLASSES[c.audit?.classId]) fail('AUDIT-CLASS', `${where} audit class ${c.audit?.classId}`)
    if (!PRIVACY_CLASSES[c.privacy?.classId]) fail('PRIVACY-CLASS', `${where} privacy class ${c.privacy?.classId}`)
    if (!DENIAL_CLASSES.includes(c.denialAndRecovery?.class)) fail('DENIAL-CLASS', `${where} denial class ${c.denialAndRecovery?.class}`)
    if (!EVIDENCE_CLASSES.includes(c.provenance?.evidenceClass)) fail('EVIDENCE-CLASS', `${where} evidence class ${c.provenance?.evidenceClass}`)
    if (c.provenance?.evidenceClass === 'SUPPORTED_BY_RECOVERED_EVIDENCE' && !(c.provenance.evidenceIds ?? []).length) fail('EVIDENCE-CLASS', `${where} claims recovered evidence and cites none`)
    if (c.provenance?.evidenceClass === 'DESIGN_ONLY' && (c.provenance.evidenceIds ?? []).length) fail('EVIDENCE-CLASS', `${where} is DESIGN_ONLY but cites evidence`)

    const impl = c.implementation
    if (!IMPLEMENTATION_STATUSES.includes(impl?.status)) fail('IMPL-STATUS', `${where} implementation status ${impl?.status}`)
    if (impl?.conformanceChecked !== false) fail('IMPL-CONFORMANCE', `${where} claims conformance was checked`)
    for (const group of [impl?.routes ?? [], impl?.services ?? []]) {
      for (const cited of group) {
        const fresh = deriveFileFacts(root, cited.file)
        if (!ROUTE_SIGNALS.includes(cited.signal)) fail('IMPL-SIGNAL', `${where} ${cited.file} has signal ${cited.signal}`)
        if (fresh.signal === 'FILE_ABSENT') fail('IMPL-FILE-ABSENT', `${where} cites ${cited.file}, which is absent`)
        else if (fresh.signal !== cited.signal) fail('IMPL-STALE', `${where} ${cited.file} signal is ${fresh.signal}, recorded ${cited.signal}`)
        else if (cited.methods && JSON.stringify(fresh.methods) !== JSON.stringify(cited.methods)) fail('IMPL-STALE', `${where} ${cited.file} methods changed`)
      }
    }
    const cited = [...(impl?.routes ?? []), ...(impl?.services ?? [])]
    if (impl?.status === 'SOURCE_PRESENT' && cited.length === 0) fail('IMPL-OVERCLAIM', `${where} claims SOURCE_PRESENT and cites no file`)
    if (impl?.status === 'SOURCE_PRESENT' && c.kind !== 'NAVIGATION' && c.kind !== 'DENIAL' && !cited.some((f) => f.signal === 'KERNEL_SIGNAL_IN_ROUTE')) fail('IMPL-OVERCLAIM', `${where} claims SOURCE_PRESENT but no cited file shows a kernel signal`)
    if (impl?.status === 'PARTIAL_SOURCE' && cited.length === 0) fail('IMPL-OVERCLAIM', `${where} claims PARTIAL_SOURCE and cites no file`)
    if (impl?.status === 'UNAVAILABLE_501' && !(impl.routes ?? []).some((r) => r.signal === 'NOT_IMPLEMENTED_501_ONLY') && c.kind !== 'NAVIGATION') fail('IMPL-OVERCLAIM', `${where} claims UNAVAILABLE_501 and no cited route answers 501`)
    if (impl?.status === 'NOT_IMPLEMENTED' && (impl.routes ?? []).some((r) => r.signal === 'KERNEL_SIGNAL_IN_ROUTE') && c.kind !== 'NAVIGATION') fail('IMPL-UNDERCLAIM', `${where} claims NOT_IMPLEMENTED but cites a route with a kernel signal`)
    if (impl?.capabilityId && !capabilityText.includes(`'${impl.capabilityId}'`) && !matrixCapabilityIds.has(impl.capabilityId)) fail('IMPL-CAPABILITY', `${where} cites capability ${impl.capabilityId}, which is not recorded`)

    for (const id of c.institutionalAdoption?.decisionIds ?? []) {
      referencedDecisions.add(id)
      if (!decisionIds.has(id)) fail('DECISION-UNKNOWN', `${where} names decision ${id}, which is not recorded`)
    }
    for (const id of c.completeness?.openQuestionIds ?? []) {
      referencedDecisions.add(id)
      if (!decisionIds.has(id)) fail('DECISION-UNKNOWN', `${where} names open question ${id}, which is not recorded`)
    }
    for (const component of c.components ?? []) {
      if (!component.id?.startsWith(`${c.id}.`)) fail('COMPONENT-ID', `${where} component ${component.id} is not under ${c.id}`)
      if (!AUTHORIZATION_BASES[component.authorizationBasisId]) fail('COMPONENT-BASIS', `${where} component ${component.id} basis ${component.authorizationBasisId}`)
      if (!IMPLEMENTATION_STATUSES.includes(component.implementationStatus)) fail('COMPONENT-STATUS', `${where} component ${component.id} status ${component.implementationStatus}`)
      if (AUTHORIZATION_BASES[component.authorizationBasisId]?.requiresInstitutionalInstrument && !(component.institutionalAdoptionDecisionIds ?? []).length) fail('COMPONENT-ADOPTION', `${where} component ${component.id} needs an instrument and names no decision`)
      for (const id of component.institutionalAdoptionDecisionIds ?? []) {
        referencedDecisions.add(id)
        if (!decisionIds.has(id)) fail('DECISION-UNKNOWN', `${where} component ${component.id} names ${id}`)
      }
    }
  }

  const checkJourney = (key, j, knownIds) => {
    const where = `${key}:${j.id}`
    if (j.liveAuthorityCreated !== false) fail('LIVE-AUTHORITY', `${where} claims live authority`)
    if (j.implementation?.conformanceChecked !== false || j.implementation?.status !== 'NOT_IMPLEMENTED') fail('IMPL-OVERCLAIM', `${where} claims a journey run or implementation`)
    let needsInstrument = false
    for (const step of j.steps ?? []) {
      const basis = AUTHORIZATION_BASES[step.authorizationBasisId]
      if (!basis) fail('JOURNEY-STEP-BASIS', `${where} step ${step.n} names basis ${step.authorizationBasisId}`)
      if (basis?.requiresInstitutionalInstrument) needsInstrument = true
      if (!filled(step.actor) || !filled(step.action) || !filled(step.assertion)) fail('JOURNEY-STEP-FIELDS', `${where} step ${step.n} lacks an actor, action or assertion`)
      if (!(step.contractIds ?? []).length) fail('JOURNEY-STEP-LINK', `${where} step ${step.n} names no contract`)
      for (const id of step.contractIds ?? []) if (!knownIds.has(id)) fail('JOURNEY-STEP-LINK', `${where} step ${step.n} names unknown contract ${id}`)
    }
    if (needsInstrument && !(j.institutionalAdoption?.decisionIds ?? []).length) fail('ADOPTION-MISSING', `${where} has a step that needs an institutional instrument and names no decision`)
    for (const id of [...(j.institutionalAdoption?.decisionIds ?? []), ...(j.completeness?.openQuestionIds ?? [])]) {
      referencedDecisions.add(id)
      if (!decisionIds.has(id)) fail('DECISION-UNKNOWN', `${where} names ${id}`)
    }
  }

  const checkScenarios = (key, scenarios) => {
    if ((scenarios ?? []).length !== 4) fail('SCENARIO-COUNT', `${key} defines ${(scenarios ?? []).length} scenarios; CAPE, CUPE, LIUNA and small local are required`)
    const models = new Set()
    const distinct = new Set()
    const behaviours = new Set()
    for (const s of scenarios ?? []) {
      const where = `${key}:${s.id}`
      if (s.historical) {
        const text = sourceText(s.historical.sourceId)
        if (text === null || !text.includes(norm(s.historical.quote))) fail('HISTORICAL-QUOTE', `${where} quotes text that is not in ${s.historical.sourceId}: ${s.historical.quote}`)
        if (s.historical.individuallyEvidenced) fail('MEANING-INTERCHANGED', `${where} marks a scenario name as an individual historical meaning`)
      }
      if (models.has(s.operatingModel)) fail('SCENARIO-INTERCHANGEABLE', `${where} repeats operating model ${s.operatingModel}`)
      models.add(s.operatingModel)
      if (distinct.has(norm(s.notInterchangeableBecause))) fail('SCENARIO-INTERCHANGEABLE', `${where} repeats another scenario's distinction`)
      distinct.add(norm(s.notInterchangeableBecause))
      if (behaviours.has(norm(s.behavior))) fail('SCENARIO-INTERCHANGEABLE', `${where} repeats another scenario's behaviour`)
      behaviours.add(norm(s.behavior))
      if (!['SOURCE_BACKED_PROTOCOL', 'HYPOTHESIS_ONLY'].includes(s.sourceBacking)) fail('SCENARIO-BACKING', `${where} backing ${s.sourceBacking}`)
      if (s.sourceBacking === 'SOURCE_BACKED_PROTOCOL' && !(s.facts ?? []).some((f) => f.file && f.quote)) fail('SCENARIO-BACKING', `${where} claims source backing without a quoted source fact`)
      for (const f of s.facts ?? []) {
        if (f.file) {
          const path = join(root, f.file)
          if (!existsSync(path)) fail('SCENARIO-FACT', `${where} cites ${f.file}, which is absent`)
          else if (f.quote && !norm(readFileSync(path, 'utf8')).includes(norm(f.quote))) fail('SCENARIO-FACT', `${where} quote not found in ${f.file}: ${f.quote}`)
        }
      }
      if (!(s.denials ?? []).length || !(s.appliesToContractIds ?? []).length) fail('SCENARIO-FIELDS', `${where} lacks denials or contract links`)
      if (!['SOURCE_BACKED_PROTOCOL', 'HYPOTHESIS_ONLY'].includes(s.sourceBacking) || (s.sourceBacking === 'HYPOTHESIS_ONLY' && s.provenance?.evidenceClass !== 'DESIGN_ONLY')) fail('SCENARIO-BACKING', `${where} hypothesis is not DESIGN_ONLY`)
      if (s.liveAuthorityCreated !== false) fail('LIVE-AUTHORITY', `${where} claims live authority`)
      for (const id of s.institutionalAdoption?.decisionIds ?? []) {
        referencedDecisions.add(id)
        if (!decisionIds.has(id)) fail('DECISION-UNKNOWN', `${where} names ${id}`)
      }
    }
    for (const must of ['CAPE', 'CUPE', 'LIUNA', 'SMALL-LOCAL']) if (!(scenarios ?? []).some((s) => s.id.endsWith(must))) fail('SCENARIO-MISSING', `${key} lacks the ${must} scenario`)
  }

  const tally = (baseline) => {
    const all = allContracts(baseline)
    const counts = { contracts: all.length, historicallyEvidenced: 0, historicalGroupOrStatusOnly: 0, newDesignOnly: 0, requiresInstitutionalAdoption: 0 }
    for (const c of all) {
      if (c.historical?.individuallyEvidenced) counts.historicallyEvidenced += 1
      else if (c.historical) counts.historicalGroupOrStatusOnly += 1
      else counts.newDesignOnly += 1
      if (c.institutionalAdoption?.required) counts.requiresInstitutionalAdoption += 1
    }
    return counts
  }

  const measures = (key, baseline, universe) => {
    const contracts = baseline.contracts ?? []
    const contractIds = new Set(allContracts(baseline).map((c) => c.id))
    const covered = universe.filter((id) => contractIds.has(id))
    const withMissing = allContracts(baseline).filter((c) => c.kind !== 'SCENARIO' && (c.kind === 'JOURNEY' ? journeyFieldsMissing(c) : specFieldsMissing(c)).length > 0).length
    const statuses = Object.fromEntries(IMPLEMENTATION_STATUSES.map((s) => [s, 0]))
    for (const c of contracts) if (c.implementation?.status) statuses[c.implementation.status] += 1
    summary.personas[key] = {
      identifierCoverage: { universe: universe.length, covered: covered.length, uncovered: universe.filter((id) => !contractIds.has(id)) },
      behavioralSpecification: {
        contracts: allContracts(baseline).filter((c) => c.kind !== 'SCENARIO').length,
        withAllRequiredFields: allContracts(baseline).filter((c) => c.kind !== 'SCENARIO').length - withMissing,
        withOpenQuestions: allContracts(baseline).filter((c) => (c.completeness?.openQuestionIds ?? []).length > 0).length,
      },
      implementedFunctionality: { ...statuses, note: 'Counts the status the cited source supports. A cited file is not verification and no run exists.' },
    }
    summary.historicalVersusProposed[key] = tally(baseline)
  }

  // ---------- Steward ----------
  const steward = data.steward
  checkStatusFields('steward', steward)
  const stewardIds = new Set((steward.contracts ?? []).map((c) => c.id))
  const knownIdSets = { steward: stewardIds }
  for (const c of steward.contracts ?? []) {
    checkContract('steward', c)
    if (!/^STW-(NAV|ACT|DENY)-\d+$/.test(c.id)) fail('STEWARD-ID', `${c.id} is not a stable steward identifier`)
    if (c.historical) fail('STEWARD-FALSE-HISTORY', `${c.id} claims a historical source; no original steward canonical was recovered`)
    if (c.meaningOrigin !== 'NEW_DESIGN') fail('STEWARD-FALSE-HISTORY', `${c.id} meaningOrigin is ${c.meaningOrigin}`)
    if (!filled(c.provenance?.evidenceClass)) fail('STEWARD-EVIDENCE', `${c.id} has no evidence classification`)
    const stewardEvidence = (recovery?.steward?.evidence ?? []).map((e) => e.id)
    for (const id of c.provenance?.evidenceIds ?? []) if (!stewardEvidence.includes(id)) fail('STEWARD-EVIDENCE', `${c.id} cites unknown evidence ${id}`)
    if (c.kind === 'ACTION' && !['case', 'message', 'document', 'member', 'workaid', 'self', 'administration', 'role', 'navigation'].includes(AUTHORIZATION_BASES[c.authorization?.basisId]?.domain)) fail('STEWARD-BOUNDARY', `${c.id} has no case, thread or document relationship boundary`)
    if (c.kind === 'ACTION' && /\b(all cases|every case|organization-wide|any case)\b/i.test(`${c.actor} ${c.resource} ${c.permittedAction}`)) fail('STEWARD-BOUNDARY', `${c.id} describes organization-wide scope`)
  }
  const stewardActions = (steward.contracts ?? []).filter((c) => c.kind === 'ACTION')
  const stewardNav = (steward.contracts ?? []).filter((c) => c.kind === 'NAVIGATION')
  const stewardDenials = (steward.contracts ?? []).filter((c) => c.kind === 'DENIAL')
  if (stewardNav.length !== 7) fail('STEWARD-NAV', `steward defines ${stewardNav.length} navigation destinations`)
  if (stewardDenials.length < 4) fail('STEWARD-DENIALS', 'steward lacks the four prohibited-assumption denials')
  for (const id of ['STW-DENY-01', 'STW-DENY-02', 'STW-DENY-03', 'STW-DENY-04']) if (!stewardIds.has(id)) fail('STEWARD-DENIALS', `${id} is absent`)
  const stewardEvidenceUsed = new Set((steward.contracts ?? []).flatMap((c) => c.provenance?.evidenceIds ?? []))
  for (const e of recovery?.steward?.evidence ?? []) if (!stewardEvidenceUsed.has(e.id)) fail('STEWARD-EVIDENCE', `recovered steward evidence ${e.id} is not used by any contract`)
  for (const c of steward.contracts ?? []) {
    if (c.kind === 'ACTION' && (c.provenance?.relatedIds ?? []).length === 0) fail('STEWARD-RELATED', `${c.id} names no Representative contract it narrows`)
  }
  const triageIds = ['STW-ACT-28', 'STW-ACT-29', 'STW-ACT-30', 'STW-ACT-31']
  for (const id of triageIds) {
    const c = (steward.contracts ?? []).find((x) => x.id === id)
    if (c && !(c.institutionalAdoption?.decisionIds ?? []).length) fail('STEWARD-TRIAGE', `${id} treats unassigned-case triage as a role power; it is a separate authority decision`)
  }
  measures('steward', steward, [...stewardIds])
  summary.personas.steward.stewardActionCount = stewardActions.length
  summary.personas.steward.navigationCount = stewardNav.length
  summary.personas.steward.denialContractCount = stewardDenials.length

  // ---------- Representative ----------
  const rep = data.representative
  checkStatusFields('representative', rep)
  const repUniverse = universeOf(matrix, 'representative')
  if (repUniverse.length !== 56) fail('REP-UNIVERSE', `the Representative universe has ${repUniverse.length} identifiers, expected 56`)
  const repIds = new Set((rep.contracts ?? []).map((c) => c.id))
  for (const c of rep.contracts ?? []) {
    checkContract('representative', c)
    if (!repUniverse.includes(c.id)) fail('REP-ID', `${c.id} is not in the Representative universe`)
  }
  for (const id of repUniverse) if (!repIds.has(id)) fail('REP-COVERAGE', `${id} has no proposed contract`)
  for (const c of rep.contracts ?? []) {
    if (c.kind === 'DOMAIN' && /^R\d{2}$/.test(c.id)) {
      const group = (rep.contracts ?? []).filter((x) => x !== c && x.kind === 'DOMAIN' && norm(x.title) === norm(c.title))
      if (group.length) fail('REP-GROUPED', `${c.id} repeats the title of ${group.map((g) => g.id).join(', ')}; every grouped identifier needs its own meaning`)
      if (c.historical && !c.historical.individuallyEvidenced && c.meaningOrigin === 'HISTORICAL_TITLE_WITH_NEW_SPECIFICATION') fail('REP-GROUPED', `${c.id} presents a grouped label as its own historical title`)
    }
  }
  const resourcesByDomain = new Map()
  for (const c of (rep.contracts ?? []).filter((x) => x.kind === 'DOMAIN')) {
    const sig = norm(`${c.proposedMeaning}|${c.permittedAction}|${c.trigger}`)
    if (resourcesByDomain.has(sig)) fail('REP-GROUPED', `${c.id} is specified identically to ${resourcesByDomain.get(sig)}`)
    resourcesByDomain.set(sig, c.id)
  }
  const r18 = (rep.contracts ?? []).find((c) => c.id === 'R18')
  const r18Record = rep.r18VersionedRecord
  if (!r18Record) fail('R18-VERSIONED', 'the R18 versioned record is absent')
  else {
    const observations = (r18Record.historicalDispositions ?? []).map((d) => d.observation)
    if (!(observations.includes('BLOCKED') && observations.includes('MISSING'))) fail('R18-VERSIONED', 'the R18 record erased one of the historical dispositions (BLOCKED, MISSING)')
    for (const d of r18Record.historicalDispositions ?? []) {
      const text = sourceText(d.sourceId)
      if (text === null || !text.includes(norm(d.quote))) fail('R18-VERSIONED', `R18 disposition quote not found in ${d.sourceId}: ${d.quote}`)
    }
    if (r18Record.historicalConflict !== 'UNRESOLVED_AND_PRESERVED') fail('R18-VERSIONED', 'the R18 historical conflict was resolved by overwriting')
    if (!r18 || r18Record.currentImplementationStatus !== r18.implementation?.status) fail('R18-VERSIONED', 'the R18 current implementation status disagrees with the R18 contract')
    if (r18Record.currentImplementationStatus === (r18Record.historicalDispositions ?? [])[0]?.observation) fail('R18-VERSIONED', 'the current status was written over a historical disposition')
    if (!r18?.versionedStatus || r18.versionedStatus.currentImplementationStatus !== r18Record.currentImplementationStatus) fail('R18-VERSIONED', 'the R18 contract lacks the versioned status fields')
  }
  const repJourneys = rep.journeys ?? []
  if (repJourneys.length !== 7 || repJourneys.map((j) => j.id).join() !== ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((l) => `REP-JRN-${l}`).join()) fail('REP-JOURNEYS', 'Journeys A to G must be defined in order')
  const everyKnown = new Set([...repIds, ...stewardIds])
  for (const j of repJourneys) { checkContract('representative', j); checkJourney('representative', j, everyKnown) }
  checkScenarios('representative', rep.scenarios)
  measures('representative', rep, repUniverse)

  // ---------- Financial Officer ----------
  const fin = data['financial-officer']
  checkStatusFields('financial-officer', fin)
  const finUniverse = universeOf(matrix, 'financial-officer')
  if (finUniverse.length !== 38) fail('FO-UNIVERSE', `the Financial Officer universe has ${finUniverse.length} identifiers, expected 38`)
  const finIds = new Set([...(fin.contracts ?? []), ...(fin.journeys ?? [])].map((c) => c.id))
  for (const c of fin.contracts ?? []) {
    checkContract('financial-officer', c)
    if (c.kind === 'DOMAIN' && /^F\d{2}$/.test(c.id)) {
      const f = c.financial
      const required = ['historicalMeaningRecovered', 'operationalCapability', 'requiredFinancialAuthority', 'requiredSegregationOfDuties', 'dataAndReportingScope', 'integrationBoundary', 'currentImplementationStatus']
      for (const name of required) if (!f || !filled(typeof f[name] === 'object' ? JSON.stringify(f[name]) : f[name])) fail('FO-DISTINCTIONS', `${c.id} lacks ${name}`)
      if (f && f.currentImplementationStatus !== c.implementation?.status) fail('FO-DISTINCTIONS', `${c.id} current implementation status disagrees with the contract`)
      if (f && f.requiredFinancialAuthority?.derivedFromRoleTitle !== false) fail('FO-ROLE-TITLE', `${c.id} derives financial authority from a role title`)
      if (f && f.requiredFinancialAuthority?.mandateRequired !== true && c.authorization.basisId !== 'SELF_SCOPED') fail('FO-ROLE-TITLE', `${c.id} does not require a mandate`)
      if (f && c.historical === null && f.historicalMeaningRecovered !== 'NONE_RECOVERED') fail('FO-HISTORY', `${c.id} has no historical record but claims a recovered meaning`)
      if (f && c.historical?.individuallyEvidenced && c.historical.kind === 'TITLE' && !f.historicalMeaningRecovered.includes(c.historical.quote)) fail('FO-HISTORY', `${c.id} recovered meaning disagrees with its historical quote`)
      const segregated = (c.authorization.kernelActions ?? []).filter((a) => SEGREGATED_DUTIES.includes(a.replace('finance:', '')))
      if (segregated.length > 1) fail('FO-SEGREGATION', `${c.id} joins segregated duties ${segregated.join(', ')} in one contract`)
      if (!filled(f?.requiredSegregationOfDuties?.summary)) fail('FO-SEGREGATION', `${c.id} states no separation rule summary`)
    }
    if (c.authorization?.basisId === 'ROLE_ELIGIBILITY_ONLY' && c.kind !== 'DENIAL') fail('FO-ROLE-TITLE', `${c.id} rests on role eligibility alone`)
    if (c.kind !== 'DENIAL' && c.kind !== 'NAVIGATION' && AUTHORIZATION_BASES[c.authorization?.basisId]?.domain === 'finance' && c.authorization.basisId !== 'PLATFORM_BOUNDARY_NO_AUTHORITY' && !/mandate|appointment|own record|own settings/i.test(c.authorization.requirement)) fail('FO-ROLE-TITLE', `${c.id} authorization does not name a mandate`)
  }
  for (const id of finUniverse) if (!finIds.has(id)) fail('FO-COVERAGE', `${id} has no proposed contract`)
  for (const id of [...finIds]) if (!finUniverse.includes(id) && !/^FO-/.test(id)) fail('FO-ID', `${id} is not in the Financial Officer universe`)
  const finDomains = (fin.contracts ?? []).filter((c) => c.kind === 'DOMAIN' && /^F\d{2}$/.test(c.id))
  if (finDomains.length !== 28) fail('FO-COVERAGE', `${finDomains.length} F domains are defined, expected 28`)
  for (const duty of FINANCIAL_DUTIES) {
    if (!finDomains.some((c) => (c.authorization.kernelActions ?? []).includes(`finance:${duty}`))) fail('FO-DUTIES', `no F domain carries the distinct ${duty} duty`)
  }
  const finNav = (fin.contracts ?? []).filter((c) => c.kind === 'NAVIGATION')
  if (finNav.length !== 7) fail('FO-NAV', `${finNav.length} navigation destinations are defined, expected 7`)
  if (new Set(finNav.map((c) => c.title)).size !== finNav.length) fail('FO-NAV', 'navigation names are not distinct')
  const recoveredNames = finNav.filter((c) => c.navigationNameOrigin === 'RECOVERED_HISTORICAL_NAME').map((c) => c.title).sort()
  if (JSON.stringify(recoveredNames) !== JSON.stringify(['Accounts & Cash', 'Budgets & Spending', 'Funds & Programs'])) fail('FO-NAV', `recovered navigation names are ${recoveredNames.join(', ')}`)
  for (const c of finNav) {
    if ((c.navigationNameOrigin === 'RECOVERED_HISTORICAL_NAME') !== Boolean(c.historical?.individuallyEvidenced)) fail('FO-NAV', `${c.id} navigation name origin disagrees with its historical record`)
  }
  if (finNav.filter((c) => c.navigationNameOrigin === 'PROPOSED_NEW_NAME').length !== 4) fail('FO-NAV', 'exactly four proposed new navigation names are required')
  for (const c of finNav) {
    if (c.implementation?.status === 'SOURCE_PRESENT') fail('FO-NAV-OVERCLAIM', `${c.id} claims a source-present destination; the disposition records the destinations as not implemented`)
  }
  const finJourneys = fin.journeys ?? []
  const expectedFj = Array.from({ length: 10 }, (_, i) => `FJ${String(i + 1).padStart(2, '0')}`)
  if (finJourneys.map((j) => j.id).join() !== expectedFj.join()) fail('FO-JOURNEYS', 'FJ01 to FJ10 must be defined in order')
  const finKnown = new Set([...finIds, ...repIds, ...stewardIds])
  for (const j of finJourneys) {
    checkContract('financial-officer', j)
    checkJourney('financial-officer', j, finKnown)
  }
  checkScenarios('financial-officer', fin.scenarios)
  if (!(fin.contracts ?? []).some((c) => c.id === 'FO-BND-WORKAID')) fail('FO-BOUNDARY', 'the WorkAid boundary is absent')
  for (const id of ['FO-DENY-01', 'FO-DENY-02', 'FO-DENY-03', 'FO-DENY-04', 'FO-DENY-05']) if (!(fin.contracts ?? []).some((c) => c.id === id)) fail('FO-DENIALS', `${id} is absent`)
  measures('financial-officer', fin, finUniverse)

  // ---------- Gate 0A.2R corrections ----------
  validateRevisions({ root, data, matrix, fail, capabilityText })

  // ---------- Decisions referenced ----------
  for (const d of decisions.decisions ?? []) {
    if (d.type === 'INSTITUTIONAL_AUTHORITY' && !referencedDecisions.has(d.id)) fail('DECISION-UNREFERENCED', `${d.id} is not referenced by any contract; a recorded decision must govern something`)
  }
  for (const d of decisions.decisions ?? []) {
    const personas = d.personas ?? []
    if (!personas.length) fail('DECISION-PERSONAS', `${d.id} names no persona`)
  }

  // ---------- Documents ----------
  if (!options.data) {
    for (const [key, file] of Object.entries(BASELINE_DOCS)) {
      const text = readFileSync(join(root, file), 'utf8')
      if (!text.includes('PROPOSED NEW BASELINE')) fail('DOC-BANNER', `${file} lacks the proposed-baseline banner`)
      const dataHash = sha256File(root, BASELINE_DATA[key])
      if (!text.includes(`Data hash: ${dataHash}`)) fail('DOC-STALE', `${file} was not generated from the current ${BASELINE_DATA[key]}`)
      if (/\bSTATUS:\s*ADOPTED\b/i.test(text) || /\bNot proposed\b/.test(text)) fail('DOC-FALSE-CLAIM', `${file} claims adoption`)
      if (key !== 'decisions') {
        for (const c of allContracts(data[key])) if (!text.includes(`### ${c.id} `) && !text.includes(`### ${c.id}\n`)) fail('DOC-MISSING-CONTRACT', `${file} has no section for ${c.id}`)
      } else {
        for (const d of decisions.decisions ?? []) if (!text.includes(d.id)) fail('DOC-MISSING-CONTRACT', `${file} omits ${d.id}`)
      }
    }
  }

  return { problems, summary }
}
