/**
 * Gate 0A.2R revisions, applied to the generated proposed baselines.
 *
 * The Gate 0A.2 content modules keep the contract identifiers, titles, historical records and provenance. This layer
 * corrects the product contradictions found in review, and records on every changed contract what was revised and why.
 * It never edits a historical record, an identifier or an institutional decision's identity.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { AUTHORIZATION_BASES } from './ue-gate0a2-baseline-facts.mjs'
import {
  AUTHORITY_STATES_VOCABULARY, DISCLOSURE_CONTRACTS, DISCLOSURE_MODEL, FINANCE_RULES_BY_DOMAIN, LIFECYCLE_CONTRACTS, LIFECYCLE_MODEL, NAVIGATION_ADVERTISEMENT,
  PLATFORM_BILLING_BOUNDARY, PROHIBITED_WITHOUT_ADOPTION, REPORTING_CONTRACTS, REPORTING_MODEL, REP_SCOPE_AND_CONFLICT, REVISION_ROUND, SCENARIO_CONFIGURATION,
  SEGREGATION_MODEL, STEWARD_IDENTITY, STEWARD_NAVIGATION_POLICY, STEWARD_NAV_CAPABILITIES, deriveNavigationState, incompatibleDutiesFromSource, isPlatformEconomicsText,
} from './ue-gate0a2r-models.mjs'

const clone = (value) => JSON.parse(JSON.stringify(value))
const byId = (list, id) => {
  const found = list.find((c) => c.id === id)
  if (!found) throw new Error(`Gate 0A.2R: contract ${id} is absent`)
  return found
}

/** Applies path-keyed changes and records the round, the reason and the changed field names on the contract. */
function edit(c, reason, changes) {
  const fields = []
  for (const [path, value] of Object.entries(changes)) {
    const keys = path.split('.')
    let target = c
    for (const key of keys.slice(0, -1)) target = target[key]
    const last = keys[keys.length - 1]
    target[last] = typeof value === 'function' ? value(target[last]) : value
    fields.push(path)
  }
  const prior = c.revision ?? { round: REVISION_ROUND, reasons: [], changedFields: [] }
  c.revision = { round: REVISION_ROUND, reasons: [...new Set([...prior.reasons, reason])], changedFields: [...new Set([...prior.changedFields, ...fields])] }
}

const setLabel = (c, label, on) => {
  const has = c.labels.includes(label)
  if (on && !has) c.labels.push(label)
  if (!on && has) c.labels = c.labels.filter((l) => l !== label)
}

function addAdoption(c, ids) {
  const merged = [...new Set([...(c.institutionalAdoption?.decisionIds ?? []), ...ids])]
  c.institutionalAdoption = { required: merged.length > 0, decisionIds: merged }
  setLabel(c, 'REQUIRES_INSTITUTIONAL_ADOPTION', merged.length > 0)
  c.activation = merged.length > 0 ? 'INACTIVE_UNTIL_ADOPTED' : 'PROPOSAL_ONLY_NOT_ADOPTED'
}

function setStatus(c, status, note) {
  c.implementation.status = status
  if (note) c.implementation.note = note
  setLabel(c, 'IMPLEMENTED_SOURCE', status === 'SOURCE_PRESENT' || status === 'PARTIAL_SOURCE')
  if (c.financial) c.financial.currentImplementationStatus = status
}

const CASE_BASES = new Set(['CASE_OWNER_OR_ASSIGNEE', 'CASE_PRIMARY_HANDLER_ONLY', 'CASE_COLLABORATOR_EXPLICIT', 'CASE_MEMBER_OWN', 'DOCUMENT_CASE_RELATIONSHIP_AND_CLASS', 'THREAD_PARTICIPANT', 'DIRECTORY_SCOPE_BY_CASE_RELATIONSHIP', 'WORKAID_REFERRAL_WITH_CONSENT'])
const ISSUED_BASES = new Set(['CASE_SUPERVISORY_MANDATE', 'CASE_TRIAGE_DESIGNATION', 'THREAD_TRIAGE_DESIGNATION', 'CASE_EMERGENCY_GRANT', 'GOVERNANCE_MANDATE_THREAD_HOLD', 'REPRESENTATION_PROTOCOL_APPROVAL', 'ORG_ADMIN_OPERATIONS', 'UNDECIDED_INSTITUTIONAL_OFFICE'])

function authorityDerivation(basisId) {
  if (CASE_BASES.has(basisId)) return ['CASE_RELATIONSHIP']
  if (ISSUED_BASES.has(basisId)) return ['ISSUED_AUTHORITY']
  return []
}

function annotateAuthorityStates(c) {
  const required = Boolean(c.institutionalAdoption?.required)
  c.authorityStates = {
    engineeringImplementationPermitted: true,
    syntheticAuthorizedPathTestingPermitted: true,
    productionInstitutionalActivation: required ? 'PROHIBITED_UNTIL_ADOPTED' : 'NOT_APPLICABLE',
    externalOrInstitutionalAdoptionRequired: required,
    syntheticAuthorityScope: 'SYNTHETIC_ORGANIZATIONS_ONLY',
  }
}

function markJourneys(journeys) {
  for (const j of journeys) {
    j.executionStatus = 'NOT_EXECUTED'
    j.countsAsPassed = false
  }
}

function lifecycleBlock(id, entityTypes) {
  return { entityTypes, assumesPriorEntity: false, mandatorySequence: false, transitionsConfigurable: true, canonicalClaimsVersusGrievancesSettled: false, canonicalDecisionGate: 4 }
}

function applyLifecycle(contracts, journeys) {
  const all = [...contracts, ...journeys]
  for (const [id, types] of Object.entries(LIFECYCLE_CONTRACTS)) {
    const c = all.find((x) => x.id === id)
    if (!c) continue
    edit(c, 'The contract names the entity types it handles and assumes no prior entity or mandatory sequence.', { lifecycle: lifecycleBlock(id, types) })
  }
}

function applyDisclosure(contracts, ids) {
  for (const [id, d] of Object.entries(DISCLOSURE_CONTRACTS)) {
    const c = contracts.find((x) => x.id === id)
    if (!c || (ids && !ids.includes(id))) continue
    edit(c, 'Member visibility needs a classification and an authorized server-side disclosure decision.', {
      disclosure: {
        defaultVisibility: 'STAFF_ONLY',
        pathId: d.path,
        classification: d.classification,
        classificationRequired: true,
        decisionEvaluatedServerSide: true,
        clientVisibilityFlagSufficient: false,
        independentOfAuthoringAuthority: true,
        decisionAuthority: { basisId: d.basis, kernelActions: d.actions },
        decisionRecord: DISCLOSURE_MODEL.decisionRecord,
        neverDisclosable: DISCLOSURE_MODEL.neverDisclosable,
        memberDisclosableLabelsDecision: 'DEC-IA-05',
      },
    })
    if (d.path !== 'DISC-PATH-STRUCTURED-ENTRY') addAdoption(c, ['DEC-IA-05'])
  }
}

const PARTIAL_NOTE = 'The route lets the request body choose an internal or member-visible note, and decides a member-visible note with case:comment. No classification step or separate disclosure decision record exists.'

// ---------------------------------------------------------------------------------------------------------------------
// Steward
// ---------------------------------------------------------------------------------------------------------------------

export function reviseSteward(steward) {
  const list = steward.contracts
  steward.identityModel = clone(STEWARD_IDENTITY)
  steward.navigationPolicy = clone(STEWARD_NAVIGATION_POLICY)
  steward.lifecycleModel = clone(LIFECYCLE_MODEL)
  steward.disclosureModel = clone(DISCLOSURE_MODEL)

  for (const c of list) {
    if (c.kind === 'ACTION' || c.kind === 'NAVIGATION' || c.kind === 'DENIAL') c.authorityDerivedFrom = authorityDerivation(c.authorization.basisId)
  }

  edit(byId(list, 'STW-ACT-08'), 'A working note is staff-only. Member visibility is a separate classified and authorized disclosure decision.', {
    proposedMeaning: 'The steward records a working note on a held case. The note is staff-only. It cannot be made member-visible by editing the note or by a flag in the request: that needs a classification and a separate authorized disclosure decision taken on the server.',
    preconditions: ['A live relationship to the case that carries note writing.', 'Text is present and within the length limit.', 'A request for member visibility is a request for a disclosure decision. It is not applied to the note.'],
    permittedAction: 'Append one staff-only note with author and time. A request for member visibility is routed to the disclosure decision: STW-ACT-09 for a communication to the member, STW-ACT-17 for a staff-held record.',
    persistedResult: 'One claim update row. It is staff-only whenever this action writes it.',
    'authorization.requirement': 'A kernel decision for write_notes on this case. This action never makes a note member-visible.',
    userVisibleOutcome: 'The note appears on the timeline labelled staff-only. An offer to share it with the member opens the disclosure decision.',
    'privacy.note': 'Staff-only. Member visibility needs a classification and an authorized server-side disclosure decision. A client-supplied visibility flag is ignored.',
  })
  setStatus(byId(list, 'STW-ACT-08'), 'PARTIAL_SOURCE', `The route resolves the case through the kernel and defaults a representative note to internal. ${PARTIAL_NOTE}`)

  edit(byId(list, 'STW-ACT-09'), 'A member-visible communication is classified and authorized on the server for each communication.', {
    proposedMeaning: 'The steward sends the member a communication written for the member. It is a different act from a working note and is never produced by changing a note\u2019s visibility. The server classifies it as a member communication and refuses restricted content before the member can see it.',
    preconditions: ['A live relationship that carries commenting.', 'The server classifies the text as a member communication.', 'The comment contains no internal assessment, reserve, privileged, counsel-controlled or third-party restricted content.'],
    permittedAction: 'Append a member-visible comment after the server-side disclosure decision allows it.',
    'authorization.requirement': 'A kernel decision for comment on this case, taken on the server for each comment. A client flag cannot supply it.',
  })
  setStatus(byId(list, 'STW-ACT-09'), 'PARTIAL_SOURCE', `Comments share the notes route and no separate comment route exists. ${PARTIAL_NOTE}`)

  edit(byId(list, 'STW-ACT-10'), 'The member-visible entry is a structured entry. Its content is not chosen by the author.', {
    'privacy.note': 'The reason is staff-only. The member-visible entry is a structured entry holding only the from and to states. It carries no free text from the steward, and a client flag cannot widen it.',
  })

  edit(byId(list, 'STW-ACT-13'), 'Evidence is staff-only until the primary handler takes a disclosure decision.', {
    'privacy.note': 'Evidence is staff-only. It becomes member-visible only through the separate disclosure decision in STW-ACT-17.',
  })

  edit(byId(list, 'STW-ACT-17'), 'Disclosure of a staff-held record needs a classification and a per-record decision.', {
    preconditions: (old) => [...old, 'The record has been classified, and its classification is one the institution lists as member-disclosable (DEC-IA-05).'],
    permittedAction: 'Take a disclosure decision for one record and, if it allows, make that record visible to the member.',
    persistedResult: 'One disclosure record naming the classification, the record, the member, the discloser, the authority source and the time.',
  })

  edit(byId(list, 'STW-ACT-18'), 'A formal grievance is a distinct entity. A case does not have to become one, and a case state change is not implied.', {
    proposedMeaning: 'Where the organization protocol allows, the steward opens a formal grievance linked to a held case, with the facts and the clause or basis recorded. A grievance is a distinct entity. A case need not become one, and the case keeps its own state unless a configured transition says otherwise.',
    permittedAction: 'Create the formal grievance entity linked to the case. Any change to the case\u2019s own state is a separate configured transition and is not implied.',
    persistedResult: 'One grievance row and one link to the case. No case state change unless a configured transition applies.',
    userVisibleOutcome: 'The grievance opens and the case shows the link. If the protocol forbids escalation, the steward is told to request senior review.',
    'implementation.note': (old) => `${old} The route may change the case state on escalation. This contract does not rely on that behaviour.`,
  })

  edit(byId(list, 'STW-ACT-23'), 'Requesting an extension does not change the deadline or its legal or contractual effect.', {
    persistedResult: 'One extension-request record linked to the deadline. The request changes no deadline and does not alter any legal or contractual effect of the deadline.',
  })

  for (const nav of list.filter((c) => c.kind === 'NAVIGATION')) {
    const ids = STEWARD_NAV_CAPABILITIES[nav.id]
    const currentSourceState = { SOURCE_PRESENT: 0, PARTIAL_SOURCE: 0, NOT_IMPLEMENTED: 0, UNAVAILABLE_501: 0 }
    for (const id of ids) currentSourceState[byId(list, id).implementation.status] += 1
    edit(nav, 'Navigation follows the capabilities a principal can use, not a fixed page count.', {
      navigationVisibility: {
        fixedPromise: false,
        shownOnlyWhenUsable: true,
        hiddenWhenNoUsableCapability: true,
        requiredCapabilityContractIds: ids,
        usableCapabilityMeans: STEWARD_NAVIGATION_POLICY.usableCapabilityMeans,
        currentSourceState,
      },
      preconditions: (old) => [...old, 'At least one capability behind this destination is usable by the principal now. If none is, the entry is not shown and nothing is advertised.'],
      userVisibleOutcome: (old) => `${old} The entry is absent whenever no capability behind it is usable.`,
    })
  }

  applyLifecycle(list, [])
  applyDisclosure(list)
  return steward
}

// ---------------------------------------------------------------------------------------------------------------------
// Representative
// ---------------------------------------------------------------------------------------------------------------------

export function reviseRepresentative(rep) {
  const list = rep.contracts
  rep.lifecycleModel = clone(LIFECYCLE_MODEL)
  rep.disclosureModel = clone(DISCLOSURE_MODEL)
  rep.scopeAndConflictBoundaries = clone(REP_SCOPE_AND_CONFLICT)

  edit(byId(list, 'R03'), 'Intake carries one named entity type. Inquiry, request, case, grievance, complaint, appeal and reconsideration are not one sequence.', {
    proposedMeaning: 'A request, inquiry, complaint, appeal or reconsideration from a member or a staff member is received as an intake record of one named entity type. An inquiry or service request is not yet a case. The type is chosen from the organization\u2019s configured set, and any type may be opened directly without a prior one.',
    permittedAction: 'Create the intake record with its entity type.',
    persistedResult: 'One intake row with entity type, filer, subject member, category and time.',
    'implementation.note': 'The intake route carries a kernel signal and creates a case directly. Typing an intake as an inquiry, service request, complaint, appeal or reconsideration is not implemented. Complaint, appeal and reconsideration use a separate review-intake route.',
  })
  edit(byId(list, 'R06'), 'Escalation is one possible outcome of a case, not a stage every case reaches.', {
    proposedMeaning: 'A handler may open a formal grievance from a case with a stated basis, and may request a senior review first where the protocol requires it. Escalation is one possible outcome of a case and is not a stage of it.',
    permittedAction: 'Create the escalation record and the linked grievance entity.',
    persistedResult: 'One escalation row and one linked grievance. Any case state change is a configured transition.',
    userVisibleOutcome: 'The case shows the linked grievance and its clock.',
  })
  edit(byId(list, 'R07'), 'Case states come from the configured lifecycle, not one universal sequence.', {
    proposedMeaning: 'A case moves through the named states of the organization\u2019s configured lifecycle. The states and transitions come from protocol and are not one universal sequence. Each change is recorded with actor, reason and time.',
  })
  edit(byId(list, 'REP-ACT-19'), 'A grievance is a distinct entity linked to a case. No case state change is implied.', {
    proposedMeaning: 'Where the protocol allows, the handler opens a formal grievance linked to a held case, with a stated basis. The grievance starts its own clock and formal states. A case need not become one.',
    permittedAction: 'Create the escalation and the linked grievance entity, and notify the member in member-safe words. Any change to the case\u2019s own state is a configured transition.',
    persistedResult: 'One escalation row and one linked grievance. No case state change unless a configured transition applies.',
    userVisibleOutcome: 'The case shows the linked grievance with its clock. A refusal names the state that blocks it.',
  })
  edit(byId(list, 'REP-ACT-08'), 'The grievance state machine is one configuration, not a universal sequence.', {
    proposedMeaning: 'The representative moves a grievance through the formal states the organization\u2019s protocol allows, with a reason. The source finite-state machine is evidence of one configuration.',
  })

  edit(byId(list, 'REP-ACT-06'), 'A working note is staff-only. Member visibility is a separate classified and authorized disclosure decision.', {
    proposedMeaning: 'The representative adds a note to a held case. An internal note is staff-only and is the only kind this action writes. A member-visible communication is a separate act that needs a classification and an authorized server-side disclosure decision.',
    preconditions: ['A live owner, assignee or explicit collaborator relationship.', 'The text is not empty.', 'A member-visible communication additionally needs a server-side classification and a disclosure decision. A flag on the request is not enough.'],
    permittedAction: 'Persist the note as staff-only. Route a member-visible request to the disclosure decision.',
    persistedResult: 'One note row with author, case, visibility and time. Visibility is member-visible only when a disclosure decision allowed it.',
    'authorization.requirement': 'case:write_notes for an internal note. A member communication needs the disclosure decision, which uses case:comment and is taken on the server.',
    userVisibleOutcome: 'The note appears labelled Internal. Sharing with the member opens the disclosure decision and is not a toggle on the note.',
    'privacy.note': 'Internal notes are staff-only. A member-visible communication is shown to the member only after a classification and a disclosure decision, and must not carry internal assessment.',
  })
  setStatus(byId(list, 'REP-ACT-06'), 'PARTIAL_SOURCE', `The route carries a kernel signal and records the internal default. ${PARTIAL_NOTE}`)
  const components = byId(list, 'REP-ACT-06').components
  components[1].title = 'Member communication'
  components[1].implementationStatus = 'PARTIAL_SOURCE'
  components[1].institutionalAdoptionDecisionIds = ['DEC-IA-05']
  components[1].note = 'Visibility is a classified and authorized server-side decision and is never inferred from a request flag.'

  edit(byId(list, 'REP-ACT-07'), 'The member-visible entry is structured and its content is not chosen by the author.', {
    'privacy.note': 'The member sees a structured state entry and a member-safe reason. The author cannot widen it with a request flag. The disposition records an open leak of the transition reason that this contract treats as a defect to close.',
  })
  edit(byId(list, 'R10'), 'A member-visible update is a classified communication authorized on the server.', {
    proposedMeaning: 'The representative sends the member a member-safe update on the case after the server classifies it and an authorized disclosure decision allows it. The member receives a content-free notice that an update exists.',
    permittedAction: 'Take the disclosure decision, persist the member-visible update and queue a notice that carries no content.',
    'authorization.requirement': 'case:comment on this case, taken on the server for each update. A request flag cannot supply it. Disclosure of a labelled record is separate (DEC-IA-05).',
  })

  const r18 = byId(list, 'REP-ACT-18')
  edit(r18, 'Requesting an extension does not change the deadline or its legal or contractual effect.', {
    proposedMeaning: (old) => `${old} Requesting an extension records a request only. It does not change a deadline or its legal or contractual effect.`,
  })

  const journeys = rep.journeys
  edit(byId(journeys, 'REP-JRN-A'), 'A request does not have to become a case, and the journey assumes no mandatory sequence.', {
    title: 'Journey A: a member request is received and, where the institution accepts it, handled as a case',
    proposedMeaning: 'A member raises a request, a triage designee sorts it, an assigner assigns it where the protocol requires assignment, and the assignee acknowledges and opens it. A request may instead be answered, declined or referred without becoming a case.',
    expectedPersistedResult: 'An intake, a triage record, an assignment event and an acknowledgement. Whether the same person may hold two of these steps is decided by the rules in force and not assumed here.',
  })
  byId(journeys, 'REP-JRN-A').steps[0].assertion = 'An intake of the type service request exists and the member has no access to any other case.'
  edit(byId(journeys, 'REP-JRN-B'), 'Escalation is one possible outcome. A case can be resolved, closed or appealed without a grievance.', {
    title: 'Journey B: a case is escalated to a formal grievance where the protocol allows',
    proposedMeaning: 'A handler assesses a case, requests a senior review where the protocol requires it, and opens a formal grievance linked to the case. Escalation is one possible outcome. A case may be resolved, closed or appealed without a grievance.',
    expectedPersistedResult: 'An assessment, a review request and a linked grievance. Any case state change is a configured transition.',
  })
  byId(journeys, 'REP-JRN-B').steps[3].assertion = 'A grievance is linked to the case with its clock. Any case state change is a configured transition.'
  edit(byId(journeys, 'REP-JRN-D'), 'Member-visible content follows the disclosure decision.', {
    testableAssertions: (old) => [...old, 'A member-visible update exists only when a server-side classification and disclosure decision allowed it. A request flag alone never makes content visible.'],
  })
  byId(journeys, 'REP-JRN-D').steps[1].action = 'Add an internal note and request a member-visible update.'
  byId(journeys, 'REP-JRN-D').steps[1].assertion = 'The internal note is absent from the member view. The update is visible only after the disclosure decision.'
  edit(byId(journeys, 'REP-JRN-F'), 'Requesting an extension does not change the deadline or its legal or contractual effect.', {
    testableAssertions: (old) => [...old, 'A recorded extension request changes no deadline and no legal or contractual effect.'],
  })
  markJourneys(journeys)

  applyLifecycle(list, journeys)
  applyDisclosure(list)

  for (const s of rep.scenarios) {
    s.configuration = {
      configurationKey: SCENARIO_CONFIGURATION.REP[s.id],
      independentlyConfigurable: true,
      sharesConfigurationWith: [],
      validation: { independentlyValidated: true, status: 'NOT_YET_VALIDATED', note: 'Each scenario is validated on its own. A pass for one says nothing about another.' },
    }
  }
  const lifecycle = rep.lifecycleModel.organizationVariations
  for (const v of lifecycle) if (!rep.scenarios.some((s) => s.id === v.scenarioId)) throw new Error(`lifecycle variation names unknown scenario ${v.scenarioId}`)
  return rep
}

// ---------------------------------------------------------------------------------------------------------------------
// Financial Officer
// ---------------------------------------------------------------------------------------------------------------------

const DUTY_NOTE = 'under the separation rules in force'

export function softenSeparationText(text) {
  return String(text)
    .replace(/approve the plan by a different holder/g, `approval of the plan is a separate duty held ${DUTY_NOTE}`)
    .replace(/approve it by a different holder/g, `approval is a separate duty held ${DUTY_NOTE}`)
    .replace(/prepared and approved by different holders/g, `prepared and approved as separate duties ${DUTY_NOTE}`)
    .replace(/records prepared and approved by different holders/g, `records prepared and approved as separate duties ${DUTY_NOTE}`)
    .replace(/No transaction participation that segregates the duty, and no recusal\./g, 'No separation rule in force prohibits this duty for this principal on this transaction, account or record, and no recusal.')
}

function partitionPlatformSurfaces(root, c) {
  const moved = []
  const keep = (group) => group.filter((cited) => {
    const path = join(root, cited.file)
    if (existsSync(path) && isPlatformEconomicsText(readFileSync(path, 'utf8'))) {
      moved.push(cited.file)
      return false
    }
    return true
  })
  const routes = keep(c.implementation.routes ?? [])
  const services = keep(c.implementation.services ?? [])
  if (moved.length === 0) return
  c.implementation.routes = routes
  c.implementation.services = services
  c.implementation.platformBillingSurfaces = moved.map((file) => ({ file, isUnionFinanceEvidence: false }))
  const remaining = [...routes, ...services]
  let status = c.implementation.status
  if ((status === 'SOURCE_PRESENT' || status === 'PARTIAL_SOURCE') && remaining.length === 0) status = 'NOT_IMPLEMENTED'
  if (status === 'SOURCE_PRESENT' && !remaining.some((f) => f.signal === 'KERNEL_SIGNAL_IN_ROUTE')) status = 'PARTIAL_SOURCE'
  const names = moved.map((f) => f.replace('apps/union-eyes/', '')).join(', ')
  setStatus(c, status, `${c.implementation.note} Platform economics surfaces (${names}) belong to Nzila platform billing. They are not union finance evidence and were removed from this contract.`)
  edit(c, 'Platform billing is not union finance. A platform economics surface is not evidence of a union finance capability.', { 'implementation.platformBillingSurfaces': c.implementation.platformBillingSurfaces })
}

export function reviseFinancial(fin, root) {
  const list = fin.contracts
  const rules = clone(SEGREGATION_MODEL.separationRules)
  const financePolicy = readFileSync(join(root, 'apps/union-eyes/lib/authority/policies/finance.ts'), 'utf8')
  for (const rule of rules) {
    if (rule.prohibitedCombinations === 'DERIVED_FROM_SOURCE') {
      rule.prohibitedCombinations = incompatibleDutiesFromSource(financePolicy)
      rule.derivedFrom = 'INCOMPATIBLE_DUTIES in the finance policy source'
    }
  }
  fin.segregationModel = { ...clone(SEGREGATION_MODEL), separationRules: rules }
  fin.reportingModel = clone(REPORTING_MODEL)
  fin.platformBillingBoundary = clone(PLATFORM_BILLING_BOUNDARY)
  fin.navigationAdvertisement = clone(NAVIGATION_ADVERTISEMENT)
  fin.taxonomyIsEvidenceOfFunctionality = false

  const domains = list.filter((c) => c.kind === 'DOMAIN' && /^F\d{2}$/.test(c.id))
  for (const c of [...list.filter((x) => x.kind === 'NAVIGATION'), ...domains]) partitionPlatformSurfaces(root, c)

  edit(byId(list, 'F28'), 'Only a platform billing page carries bilingual strings. That is not evidence of a union finance destination.', {})
  const f28 = byId(list, 'F28')
  if (f28.implementation.status !== 'NOT_IMPLEMENTED') setStatus(f28, 'NOT_IMPLEMENTED', 'No union finance destination exists to be bilingual. The only bilingual strings found belong to the platform billing page.')

  for (const c of domains) {
    const entry = FINANCE_RULES_BY_DOMAIN[c.id]
    if (!entry) throw new Error(`no separation rules recorded for ${c.id}`)
    edit(c, 'Separation is evaluated by rules against the actual transaction, account, amount, mandate, approval and principal. It is not a universal different-person requirement.', {
      'financial.requiredSegregationOfDuties': { universalDifferentPersonRule: false, ruleIds: entry.rules, summary: entry.summary },
      proposedMeaning: softenSeparationText,
      permittedAction: softenSeparationText,
      preconditions: (old) => old.map(softenSeparationText),
      userVisibleOutcome: softenSeparationText,
      'financial.operationalCapability': softenSeparationText,
    })
  }

  edit(byId(list, 'F01'), 'The three-person issuance design is an implemented software rule and not a universal institutional requirement.', {
    actor: 'The issuer, the holder and the approver of a mandate',
    preconditions: ['A live issuance rule adopted by the institution.', 'Where the implemented rule SEP-SW-07 applies, as it does in source today, the issuer, holder and approver are three different people. An institution has not adopted it as a requirement (DEC-IA-16).', 'The term is not expired.'],
    'financial.requiredSegregationOfDuties': { universalDifferentPersonRule: false, ruleIds: FINANCE_RULES_BY_DOMAIN.F01.rules, summary: FINANCE_RULES_BY_DOMAIN.F01.summary, softwareRuleEvidenceOnly: true },
  })
  byId(list, 'F01').softwareRuleEvidence = { ruleIds: ['SEP-SW-07', 'SEP-SW-08'], institutionallyAdopted: false }

  edit(byId(list, 'F22'), 'Reports, aggregates and exports are each authorized separately from a view duty.', { 'financial.dataAndReportingScope': 'Aggregates over named accounts. Member-level rows, further aggregation and exports need their own authorization (reporting model).' })
  for (const [id, r] of Object.entries(REPORTING_CONTRACTS)) {
    const c = byId(list, id)
    edit(c, 'Reports, aggregates and exports are each authorized separately from a view duty.', {
      reporting: {
        reportKind: r.reportKind,
        viewDutyAloneSufficient: false,
        exportRequiresSeparateAuthorization: true,
        exportAllowedByThisContract: r.exportAllowed,
        authorizationDimensionIds: REPORTING_MODEL.authorizationDimensions.map((d) => d.id),
        platformBillingExcluded: true,
      },
    })
  }

  const deny03 = byId(list, 'FO-DENY-03')
  edit(deny03, 'The denial named a universal second-duty ban that no source rule states. It now names the rules in force.', { title: deny03.title, proposedMeaning: deny03.proposedMeaning })

  edit(byId(list, 'FO-DENY-02'), 'Platform billing is not union finance.', {
    proposedMeaning: 'Nzila platform billing, platform economics services and a SaaS entitlement are not union finance. They confer no authority over union records and are never evidence that a union finance capability exists.',
  })

  const byIdAll = new Map(list.map((c) => [c.id, c]))
  for (const nav of list.filter((c) => c.kind === 'NAVIGATION')) {
    const related = (nav.provenance.relatedIds ?? []).filter((id) => /^F\d{2}$/.test(id))
    const statuses = Object.fromEntries(related.map((id) => [id, byIdAll.get(id).implementation.status]))
    const state = deriveNavigationState(statuses)
    edit(nav, 'Every destination has an actual capability state. A page existing does not imply an operational finance engine.', {
      capabilityState: { ...state, byCapability: statuses, impliesOperationalFinanceEngine: false },
      preconditions: (old) => [...old, 'The destination carries a capability state derived from the contracts behind it. A destination whose capabilities are all unavailable is not advertised.'],
    })
  }

  for (const j of fin.journeys) {
    edit(j, 'Separation is rule-driven and not universal. A journey is a design and has not been executed.', {})
  }
  markJourneys(fin.journeys)

  for (const s of fin.scenarios) {
    s.configuration = {
      configurationKey: SCENARIO_CONFIGURATION.FO[s.id],
      independentlyConfigurable: true,
      sharesConfigurationWith: [],
      validation: { independentlyValidated: true, status: 'NOT_YET_VALIDATED', note: 'Each scenario is validated on its own. A pass for one says nothing about another.' },
    }
  }
  return fin
}

// ---------------------------------------------------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------------------------------------------------

export function authorityHeader() {
  return {
    authorityStatesVocabulary: clone(AUTHORITY_STATES_VOCABULARY),
    prohibitedWithoutInstitutionalAdoption: clone(PROHIBITED_WITHOUT_ADOPTION),
  }
}

export function finalizeBaseline(baseline) {
  const all = [...(baseline.contracts ?? []), ...(baseline.journeys ?? []), ...(baseline.scenarios ?? [])]
  for (const c of all) annotateAuthorityStates(c)
  const revised = all.filter((c) => c.revision)
  baseline.revisionLog = {
    round: REVISION_ROUND,
    purpose: 'Adversarial product specification corrections. Identifiers, titles and historical records are unchanged.',
    revisedContractCount: revised.length,
    revisedContractIds: revised.map((c) => c.id),
  }
  return baseline
}

export { AUTHORIZATION_BASES }
