/**
 * Gate 0C.2: persona canonical ratification readiness.
 *
 * Everything here prepares a product-owner decision. It ratifies no persona specification, adopts no institutional
 * decision, issues no mandate and changes no implementation, security, release or runtime status. The builders derive the
 * registers from the three unchanged proposed baselines, the completion matrix and the recovery register. The validator
 * recomputes them and rejects fabricated historical evidence, lost or duplicated requirement identifiers, an action with
 * no accountable persona, role-derived authority, hierarchy-derived cross-tenant visibility, a proposal represented as
 * accepted, an acceptance without independent approval evidence, a product approval represented as an institutional grant,
 * a silent change to accepted evidence and a claim that implementation or runtime qualification is complete.
 */
import { createHash } from 'node:crypto'
import { compareCodeUnit } from './ue-gate0b1-classification.mjs'
import {
  ANCHOR_COMMIT,
  AUTHORITY_CLASSES,
  BASELINE_FILES,
  COVERAGE_STATES,
  DECISION_STATES,
  DOMAINS,
  DOCS_0C2,
  FILES_0C2,
  GATE_ID,
  HISTORICAL_CLASSES,
  PERSONAS,
  PREPARED_ON,
  PROPOSED_CANONICALS,
  RECORD_IDS,
} from './ue-gate0c2-ids.mjs'
import {
  APPROVAL_OPTIONS,
  DOMAIN_COVERAGE,
  DOMAIN_LABELS,
  DOMAIN_OVERRIDES,
  NEGATIVE_SECURITY_CRITERIA,
  NEW_PRODUCT_DECISIONS,
  PERSONA_FACTS,
  PRODUCT_APPROVAL_DOES_NOT,
  SHARED_OBLIGATIONS,
  STEWARD_STRUCTURE,
} from './ue-gate0c2-facts.mjs'

export const OWNER_ROLE = 'AUTHORIZED_PRODUCT_OWNER'
export const PROPOSED_STATE = 'PROPOSED_FOR_RATIFICATION'
export const IMPLEMENTATION_STATUSES = ['SOURCE_PRESENT', 'PARTIAL_SOURCE', 'NOT_IMPLEMENTED', 'UNAVAILABLE_501']
export const APPROVAL_SCOPES = ['PRODUCT_SPECIFICATION_BASELINE']
const NON_DECISION_MAKERS = /\b(cursor|agent|assistant|claude|gpt|copilot|bot|engineering|preparer|gate[- ]?0c)\b/i
const FORBIDDEN_STATUS = /"(status|state|implementationStatus|runtimeQualification|verdict)"\s*:\s*"(complete|completed|green|ready|delivered|PROVEN_IN_STAGING)"/i
const TRACKING_FALLBACK = { steward: 'UE-OMIT-STEWARD-CANONICAL-ABSENT', representative: 'UE-OMIT-REP-CANONICAL-ABSENT', 'financial-officer': 'UE-OMIT-FINANCE-RANGE-UNSPECIFIED' }

const sorted = (items) => [...items].sort(compareCodeUnit)
const unique = (items) => [...new Set(items)]
export const sha256Text = (text) => createHash('sha256').update(text).digest('hex')
export const serialize = (value) => `${JSON.stringify(value, null, 2)}\n`
export const sha256Of = (value) => sha256Text(serialize(value))
const clone = (value) => JSON.parse(JSON.stringify(value))

export const requirementsOf = (baseline) => [...(baseline?.contracts ?? []), ...(baseline?.journeys ?? []), ...(baseline?.scenarios ?? [])]

function historicalClassOf(historical) {
  if (!historical) return 'NONE'
  if (historical.kind === 'GROUP_LABEL') return 'GROUP_LABEL_ONLY'
  if (historical.kind === 'STATUS_ONLY') return 'STATUS_ONLY'
  if (historical.individuallyEvidenced === true) return 'DIRECT_INDIVIDUAL'
  return 'NAME_RANGE_ONLY'
}

const EVIDENCE_CLASSIFICATION = {
  DIRECT_INDIVIDUAL: 'HISTORICAL_DIRECT',
  GROUP_LABEL_ONLY: 'RECONSTRUCTED_UNDER_HISTORICAL_LABEL',
  STATUS_ONLY: 'RECONSTRUCTED_UNDER_HISTORICAL_LABEL',
  NAME_RANGE_ONLY: 'RECONSTRUCTED_UNDER_HISTORICAL_LABEL',
  NONE: 'NEW_DESIGN_NO_HISTORICAL_SOURCE',
}

const BASIS_DOMAIN = {
  ACTIVE_MEMBERSHIP_NAVIGATION: 'CASE_MEMBER_DOCUMENT_VISIBILITY',
  DOCUMENT_CASE_RELATIONSHIP_AND_CLASS: 'CASE_MEMBER_DOCUMENT_VISIBILITY',
  DIRECTORY_SCOPE_BY_CASE_RELATIONSHIP: 'CASE_MEMBER_DOCUMENT_VISIBILITY',
  CASE_OWNER_OR_ASSIGNEE: 'RECORD_CREATION_UPDATE',
  CASE_PRIMARY_HANDLER_ONLY: 'CONFIDENTIALITY_PRIVILEGED',
  CASE_MEMBER_OWN: 'CASE_MEMBER_DOCUMENT_VISIBILITY',
  CASE_FILING_CAPACITY: 'RECORD_CREATION_UPDATE',
  CASE_COLLABORATOR_EXPLICIT: 'DELEGATION_SUBSTITUTION',
  CASE_SUPERVISORY_MANDATE: 'DELEGATION_SUBSTITUTION',
  CASE_TRIAGE_DESIGNATION: 'NOTIFICATIONS_WORKFLOW',
  THREAD_TRIAGE_DESIGNATION: 'NOTIFICATIONS_WORKFLOW',
  THREAD_PARTICIPANT: 'RECORD_CREATION_UPDATE',
  GOVERNANCE_MANDATE_THREAD_HOLD: 'CONFIDENTIALITY_PRIVILEGED',
  WORKAID_REFERRAL_WITH_CONSENT: 'CROSS_PERSONA_HANDOFFS',
  UNDECIDED_INSTITUTIONAL_OFFICE: 'ORG_FEDERATION_SCOPE',
  SELF_SCOPED: 'IDENTITY_ELIGIBILITY',
  ROLE_ELIGIBILITY_ONLY: 'IDENTITY_ELIGIBILITY',
  FINANCIAL_MANDATE_ADMINISTRATION: 'FINANCIAL_ADMIN_APPROVALS',
  FINANCIAL_MANDATE_PREPARE: 'FINANCIAL_ADMIN_APPROVALS',
  FINANCIAL_MANDATE_VIEW: 'CASE_MEMBER_DOCUMENT_VISIBILITY',
  FINANCIAL_MANDATE_APPROVE: 'FINANCIAL_ADMIN_APPROVALS',
  FINANCIAL_MANDATE_EXECUTE: 'FINANCIAL_ADMIN_APPROVALS',
  FINANCIAL_MANDATE_RECONCILE: 'FINANCIAL_ADMIN_APPROVALS',
  FINANCIAL_MANDATE_AUDIT: 'AUDIT_ACCOUNTABILITY',
  TRUSTEE_APPOINTMENT_DUTY: 'AUDIT_ACCOUNTABILITY',
  AUDITOR_APPOINTMENT_DUTY: 'AUDIT_ACCOUNTABILITY',
  PLATFORM_BOUNDARY_NO_AUTHORITY: 'FINANCIAL_ADMIN_APPROVALS',
}

export function primaryDomain(requirement) {
  if (DOMAIN_OVERRIDES[requirement.id]) return DOMAIN_OVERRIDES[requirement.id]
  if (requirement.kind === 'JOURNEY') return 'NOTIFICATIONS_WORKFLOW'
  if (requirement.kind === 'SCENARIO') return 'ORG_FEDERATION_SCOPE'
  const basis = requirement.authorization?.basisId
  const text = `${requirement.title ?? ''} ${requirement.permittedAction ?? ''}`
  if (requirement.kind === 'DENIAL') {
    if (/financ|payment|budget|mandate|money|billing/i.test(text)) return 'FINANCIAL_ADMIN_APPROVALS'
    if (/privileg|counsel|legal hold|retention/i.test(text)) return 'CONFIDENTIALITY_PRIVILEGED'
    if (/delegat|assign|lend|substitut/i.test(text)) return 'DELEGATION_SUBSTITUTION'
    if (/recus|audit/i.test(text)) return 'AUDIT_ACCOUNTABILITY'
    if (/organi[sz]ation|tenant|scope|hierarch/i.test(text)) return 'ORG_FEDERATION_SCOPE'
    return 'IDENTITY_ELIGIBILITY'
  }
  if (requirement.kind === 'NAVIGATION') return String(basis).startsWith('FINANCIAL') ? 'FINANCIAL_ADMIN_APPROVALS' : 'CASE_MEMBER_DOCUMENT_VISIBILITY'
  return BASIS_DOMAIN[basis] ?? 'RECORD_CREATION_UPDATE'
}

export function authorityClassOf(requirement) {
  if (requirement.institutionalAdoption?.required === true) return 'PROPOSED_PERMISSION'
  const status = requirement.implementation?.status
  if ((requirement.labels ?? []).includes('IMPLEMENTED_SOURCE') && (status === 'SOURCE_PRESENT' || status === 'PARTIAL_SOURCE')) return 'IMPLEMENTED_SOURCE_BEHAVIOR'
  return 'ENGINEERING_REQUIREMENT'
}

const firstString = (...values) => values.find((value) => typeof value === 'string' && value.trim() !== '') ?? ''

function sharedIndex() {
  const index = new Map()
  for (const obligation of SHARED_OBLIGATIONS) for (const member of obligation.members) index.set(member.id, { id: obligation.id, role: member.role, ownerPersona: obligation.ownerPersona })
  return index
}

/** The one completion owner of a requirement: matrix action capability, then the contract capability, then the persona tracking capability. */
export function completionOwnerOf({ requirement, persona, matrix, actionByIdentifier }) {
  const capabilities = new Map((matrix.capabilities ?? []).map((capability) => [capability.id, capability]))
  const tracking = (matrix.personaCompleteness ?? []).find((item) => item.persona === persona)?.trackingCapability ?? TRACKING_FALLBACK[persona]
  const action = actionByIdentifier.get(requirement.id)
  const contractCapability = requirement.implementation?.capabilityId ?? null
  let id
  let resolvedBy
  if (action && capabilities.has(action.capabilityId)) {
    id = action.capabilityId
    resolvedBy = 'COMPLETION_MATRIX_PERSONA_ACTION'
  } else if (contractCapability && capabilities.has(contractCapability)) {
    id = contractCapability
    resolvedBy = 'CONTRACT_CAPABILITY_IN_LOCK'
  } else {
    id = tracking
    resolvedBy = 'PERSONA_TRACKING_CAPABILITY'
  }
  const capability = capabilities.get(id)
  return {
    capabilityId: id,
    resolvedBy,
    engineeringGate: capability?.primaryGate ?? null,
    relatedImplementationCapability: contractCapability && contractCapability !== id ? contractCapability : null,
  }
}

function negativeIndex(persona) {
  const out = new Map()
  for (const criterion of NEGATIVE_SECURITY_CRITERIA[persona] ?? []) for (const id of criterion.requirementIds) out.set(id, [...(out.get(id) ?? []), criterion.id])
  return out
}

function acceptanceEvidenceFor(requirement, owner, negativeIds) {
  const evidence = [{ id: 'AE-FUNCTIONAL', kind: 'SYNTHETIC_FIXTURE_FUNCTIONAL_TEST', statement: firstString(requirement.userVisibleOutcome, requirement.expectedPersistedResult, requirement.proposedMeaning, requirement.title) }]
  const audit = requirement.audit?.classId
  if (audit && !String(audit).startsWith('AUDIT_NONE')) evidence.push({ id: 'AE-AUDIT', kind: 'AUDIT_RECORD_CHECK', statement: `An audit record of class ${audit} commits with the result, and a failed audit record rolls the result back where the class is atomic.` })
  if ((requirement.implementation?.status ?? 'NOT_IMPLEMENTED') !== 'SOURCE_PRESENT') {
    evidence.push({ id: 'AE-TRUTHFUL-STATE', kind: 'TRUTHFUL_STATE_CHECK', statement: 'Until the behavior exists the destination states NOT_IMPLEMENTED or returns HTTP 501, is not advertised as usable and reports no success. No completion is claimed from this requirement alone.' })
  }
  evidence.push({ id: 'AE-NEGATIVE', kind: 'NEGATIVE_TEST', statement: `The negative criteria ${negativeIds.join(', ')} hold for this requirement, and the owning capability ${owner.capabilityId} supplies the executable proof at engineering gate ${owner.engineeringGate}.` })
  return evidence
}

function actionIndex(matrix) {
  return new Map((matrix.personaActions ?? []).map((action) => [action.actionId, action]))
}

/** The reconciled requirement rows, one per contract, journey and scenario of the three proposed baselines. */
export function buildRows({ baselines, matrix }) {
  const shared = sharedIndex()
  const actions = actionIndex(matrix)
  const rows = []
  for (const persona of PERSONAS) {
    const negatives = negativeIndex(persona)
    const tenant = (NEGATIVE_SECURITY_CRITERIA[persona] ?? []).find((criterion) => criterion.class === 'TENANT_ISOLATION')?.id
    const hierarchy = (NEGATIVE_SECURITY_CRITERIA[persona] ?? []).find((criterion) => /HIERARCHY|SENIORITY/.test(criterion.class))?.id
    const baseline = baselines[persona]
    for (const requirement of requirementsOf(baseline)) {
      const hist = historicalClassOf(requirement.historical)
      const action = actions.get(requirement.id)
      const owner = completionOwnerOf({ requirement, persona, matrix, actionByIdentifier: actions })
      const implementationStatus = requirement.implementation?.status ?? 'NOT_IMPLEMENTED'
      const institutionalDecisionIds = sorted(requirement.institutionalAdoption?.decisionIds ?? [])
      const domain = primaryDomain(requirement)
      const gapDecisions = DOMAIN_COVERAGE[persona]?.[domain]?.gapDecisionIds ?? []
      const productDecisionIds = sorted(unique([...(requirement.completeness?.openQuestionIds ?? []), ...gapDecisions]))
      const negativeIds = sorted(unique([...(negatives.get(requirement.id) ?? []), ...(tenant ? [tenant] : []), ...(hierarchy ? [hierarchy] : [])]))
      const share = shared.get(requirement.id) ?? null
      rows.push({
        requirementId: requirement.id,
        persona,
        kind: requirement.kind,
        title: requirement.title,
        canonicalPackageId: PROPOSED_CANONICALS[persona].id,
        sharedObligation: share ? { id: share.id, role: share.role, ownerPersona: share.ownerPersona } : null,
        historical: {
          class: hist,
          sourceId: requirement.historical?.sourceId ?? null,
          individuallyEvidenced: requirement.historical?.individuallyEvidenced === true,
          inCompletionMatrix: Boolean(action),
          matrixDefinition: action?.definition ?? null,
        },
        evidenceClassification: EVIDENCE_CLASSIFICATION[hist],
        meaningOrigin: requirement.meaningOrigin ?? 'NEW_DESIGN',
        provenanceClass: requirement.provenance?.evidenceClass ?? 'DESIGN_ONLY',
        evidence: {
          directlyEvidencedHistorical: hist === 'DIRECT_INDIVIDUAL',
          reconstructedFromRelatedArtifacts: EVIDENCE_CLASSIFICATION[hist] === 'RECONSTRUCTED_UNDER_HISTORICAL_LABEL' || requirement.provenance?.evidenceClass === 'SUPPORTED_BY_RECOVERED_EVIDENCE',
          newlyDesigned: String(requirement.meaningOrigin ?? 'NEW_DESIGN').startsWith('NEW_DESIGN') || requirement.meaningOrigin === 'HISTORICAL_TITLE_WITH_NEW_SPECIFICATION',
          existingSourceImplementation: implementationStatus === 'SOURCE_PRESENT' || implementationStatus === 'PARTIAL_SOURCE',
          proposedFutureBehavior: implementationStatus !== 'SOURCE_PRESENT',
          productDecisionRequired: productDecisionIds.length > 0,
          institutionalDecisionRequired: institutionalDecisionIds.length > 0,
        },
        authorityClass: authorityClassOf(requirement),
        authorizationBasis: requirement.authorization?.basisId ?? null,
        authorizationRequirement: requirement.authorization?.requirement ?? null,
        liveAuthorityCreated: requirement.liveAuthorityCreated === true,
        activation: requirement.activation ?? null,
        domain,
        scope: { organizationScope: 'ACTIVE_ORGANIZATION_ONLY', crossOrganizationVisibility: 'NONE', inferredFromHierarchy: false },
        routes: sorted((requirement.implementation?.routes ?? []).map((route) => route.file)),
        services: sorted((requirement.implementation?.services ?? []).map((service) => service.file)),
        implementationStatus,
        completionOwner: { capabilityId: owner.capabilityId, resolvedBy: owner.resolvedBy },
        relatedImplementationCapability: owner.relatedImplementationCapability,
        engineeringGate: owner.engineeringGate,
        productDecisionIds,
        institutionalDecisionIds,
        negativeCriteria: { criterionIds: negativeIds, denialClass: requirement.denialAndRecovery?.class ?? null },
        acceptanceEvidence: acceptanceEvidenceFor(requirement, owner, negativeIds),
      })
    }
  }
  return rows
}

export function buildSharedObligations(rows) {
  const byId = new Map(rows.map((row) => [row.requirementId, row]))
  return SHARED_OBLIGATIONS.map((obligation) => ({
    id: obligation.id,
    title: obligation.title,
    ownerPersona: obligation.ownerPersona,
    ownerRequirementId: obligation.members.find((member) => member.role === 'OWNER')?.id ?? null,
    note: obligation.note,
    accountabilityNotAuthorization: true,
    members: obligation.members.map((member) => ({ id: member.id, persona: member.persona, role: member.role, title: byId.get(member.id)?.title ?? null })),
  }))
}

export function domainTable(rows, persona) {
  return DOMAINS.map((domain) => {
    const inDomain = rows.filter((row) => row.persona === persona && row.domain === domain)
    const coverage = DOMAIN_COVERAGE[persona]?.[domain]
    const authorityCounts = Object.fromEntries(AUTHORITY_CLASSES.map((name) => [name, inDomain.filter((row) => row.authorityClass === name).length]))
    return {
      domain,
      label: DOMAIN_LABELS[domain],
      coverage: coverage?.coverage ?? null,
      summary: coverage?.summary ?? null,
      gapDecisionIds: coverage?.gapDecisionIds ?? [],
      requirementIds: inDomain.map((row) => row.requirementId),
      authorityClassCounts: authorityCounts,
    }
  })
}

const countBy = (items, key) => {
  const out = {}
  for (const item of items) out[key(item)] = (out[key(item)] ?? 0) + 1
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => compareCodeUnit(a, b)))
}

export function buildReconciliation({ baselines, matrix, baselineSha }) {
  const rows = buildRows({ baselines, matrix })
  return {
    schemaVersion: 1,
    register: 'UE-PERSONA-REQUIREMENT-RECONCILIATION',
    gate: '0C.2',
    status: PROPOSED_STATE,
    anchorCommit: ANCHOR_COMMIT,
    preparedOn: PREPARED_ON,
    note: 'One row per requirement of the three proposed baselines. Each requirement has one accountable persona and one completion owner. A shared obligation names its single owner. Ownership is accountability and never authorization: no role name, membership status or hierarchy is promoted into an issued mandate. The proposed baselines are unchanged.',
    baselines: Object.fromEntries(PERSONAS.map((persona) => [persona, { file: BASELINE_FILES[persona], sha256: baselineSha[persona], status: 'PROPOSED_NOT_ADOPTED', changedByGate0C2: false }])),
    totals: {
      requirements: rows.length,
      byPersona: countBy(rows, (row) => row.persona),
      byKind: countBy(rows, (row) => `${row.persona}|${row.kind}`),
      byAuthorityClass: countBy(rows, (row) => row.authorityClass),
      byEvidenceClassification: countBy(rows, (row) => row.evidenceClassification),
      byImplementationStatus: countBy(rows, (row) => row.implementationStatus),
      byDomain: countBy(rows, (row) => row.domain),
      adoptedInstitutionalAuthorizations: 0,
    },
    sharedObligations: buildSharedObligations(rows),
    rows,
  }
}

export function buildPreservation({ matrix, recovery, baselines }) {
  const recoveredLevel = new Map((recovery.identifiers ?? []).map((item) => [item.id, item.level]))
  const grouped = new Map()
  for (const group of recovery.groups ?? []) for (const id of group.ids) grouped.set(id, group.level)
  const baselineIds = new Set(PERSONAS.flatMap((persona) => requirementsOf(baselines[persona]).map((item) => item.id)))
  const identifiers = (matrix.personaActions ?? []).map((action) => ({
    id: action.actionId,
    persona: action.persona,
    source: action.source,
    matrixDefinition: action.definition,
    capabilityId: action.capabilityId,
    mandatory: action.mandatory,
    recoveryLevel: recoveredLevel.get(action.actionId) ?? grouped.get(action.actionId) ?? null,
    mappedToProposedBaseline: baselineIds.has(action.actionId),
  }))
  const digest = sha256Text(JSON.stringify((matrix.personaActions ?? []).map((a) => [a.persona, a.actionId, a.source, a.definition, a.capabilityId, a.mandatory])))
  const perPersona = countBy(identifiers, (item) => item.persona)
  const unresolved = (matrix.personaCompleteness ?? []).filter((item) => item.resolved !== true).map((item) => ({ persona: item.persona, resolved: false, canonicalFileFound: item.canonicalFileFound, identifiers: item.universe.length, individuallyDefined: item.individuallyDefined.length, groupedOnly: item.groupedOnly.length, unspecified: item.unspecified.length, trackingCapability: item.trackingCapability }))
  return {
    schemaVersion: 1,
    register: 'UE-PERSONA-HISTORICAL-IDENTIFIER-PRESERVATION',
    gate: '0C.2',
    anchorCommit: ANCHOR_COMMIT,
    note: 'The 182 historical persona identifiers of the completion matrix and the evidence status each currently carries. An identifier whose historical source is incomplete is preserved and never dropped. Mapping an identifier to a proposed requirement does not recover the historical definition.',
    total: identifiers.length,
    perPersona,
    digestSha256: digest,
    unresolvedPersonas: unresolved,
    identifiers,
  }
}

export function buildStructure({ rows, recovery, baselines }) {
  const steward = rows.filter((row) => row.persona === 'steward')
  const representativeIds = new Set(requirementsOf(baselines.representative).map((item) => item.id))
  const naming = requirementsOf(baselines.steward).filter((item) => (item.provenance?.relatedIds ?? []).some((id) => representativeIds.has(id))).length
  const stewardInShared = steward.filter((row) => row.sharedObligation).length
  const evidence = recovery.steward?.evidence ?? []
  return {
    schemaVersion: 1,
    register: 'UE-PERSONA-STEWARD-STRUCTURE-RECOMMENDATION',
    gate: '0C.2',
    status: 'RECOMMENDATION_ONLY_NOT_SELECTED',
    anchorCommit: ANCHOR_COMMIT,
    decisionId: 'DEC-PD-01',
    decisionOwnerRole: OWNER_ROLE,
    question: STEWARD_STRUCTURE.question,
    evidence: {
      recoveryDecision: recovery.steward?.decision ?? null,
      authoritativeStewardActions: recovery.steward?.authoritativeActions ?? null,
      recoveredEvidenceIds: sorted(evidence.map((item) => item.id)),
      recoveryInference: recovery.steward?.inference ?? null,
      stewardContracts: steward.length,
      stewardContractsNamingRepresentativeCounterpart: naming,
      stewardContractsInSharedObligations: stewardInShared,
      stewardContractsWithoutSharedObligation: steward.length - stewardInShared,
      historicalStewardIdentifiers: 0,
    },
    options: STEWARD_STRUCTURE.options,
    recommendation: STEWARD_STRUCTURE.recommendation,
    selected: null,
    ratified: false,
  }
}

function dependenciesOf(persona, rows, baselines) {
  const idToPersona = new Map(rows.map((row) => [row.requirementId, row.persona]))
  const out = new Map()
  const add = (other, via, ids) => {
    if (other === persona) return
    const key = `${other}|${via}`
    out.set(key, { onPersona: other, via, ids: sorted(unique([...(out.get(key)?.ids ?? []), ...ids])) })
  }
  for (const row of rows.filter((item) => item.persona === persona)) {
    if (row.sharedObligation) {
      const obligation = SHARED_OBLIGATIONS.find((item) => item.id === row.sharedObligation.id)
      for (const member of obligation.members) if (member.persona !== persona) add(member.persona, 'SHARED_OBLIGATION', [row.sharedObligation.id])
    }
  }
  for (const requirement of requirementsOf(baselines[persona])) {
    for (const related of requirement.provenance?.relatedIds ?? []) {
      const other = idToPersona.get(related)
      if (other && other !== persona) add(other, 'RELATED_REQUIREMENT', [`${requirement.id}->${related}`])
    }
  }
  return [...out.values()].sort((a, b) => compareCodeUnit(`${a.onPersona}|${a.via}`, `${b.onPersona}|${b.via}`))
}

export function buildPackage({ persona, rows, baselines, baselineDecisions, baselineSha, reconciliationSha, matrix, recovery, classification }) {
  const mine = rows.filter((row) => row.persona === persona)
  const canonical = PROPOSED_CANONICALS[persona]
  const decisionsById = new Map((baselineDecisions.decisions ?? []).map((decision) => [decision.id, decision]))
  const productIds = sorted(unique([...mine.flatMap((row) => row.productDecisionIds.filter((id) => decisionsById.has(id))), ...(baselineDecisions.decisions ?? []).filter((d) => d.type === 'PRODUCT_DESIGN' && (d.personas ?? []).includes(persona)).map((d) => d.id)]))
  const institutionalIds = sorted(unique([...mine.flatMap((row) => row.institutionalDecisionIds), ...(baselineDecisions.decisions ?? []).filter((d) => d.type === 'INSTITUTIONAL_AUTHORITY' && (d.personas ?? []).includes(persona)).map((d) => d.id)]))
  const newDecisions = NEW_PRODUCT_DECISIONS.filter((decision) => decision.persona === persona || decision.persona === 'all')
  const gates = unique(mine.map((row) => row.engineeringGate)).sort((a, b) => a - b)
  const personaMatrix = (matrix.personaCompleteness ?? []).find((item) => item.persona === persona)
  const historicalCounts = countBy(mine, (row) => row.historical.class)
  const baselineFile = BASELINE_FILES[persona]
  return {
    schemaVersion: 1,
    register: 'UE-PERSONA-DECISION-PACKAGE',
    gate: '0C.2',
    packageId: canonical.id,
    version: canonical.version,
    persona,
    displayName: PERSONA_FACTS[persona].displayName,
    status: PROPOSED_STATE,
    anchorCommit: ANCHOR_COMMIT,
    preparedOn: PREPARED_ON,
    selfRatification: false,
    banner: 'PROPOSED FOR RATIFICATION. This package is prepared for a decision by an authorized product owner. It is not a ratified canonical, not the recovered historical canonical and not an institutional authorization. Engineering cannot accept it.',
    lineage: {
      proposedBaselineFile: baselineFile,
      proposedBaselineSha256: baselineSha[persona],
      proposedBaselineStatus: 'PROPOSED_NOT_ADOPTED',
      baselineArtifactChangedByGate0C2: false,
      historicalIdentifier: canonical.historicalIdentifier,
      historicalCanonicalRecovered: false,
      relationship: canonical.historicalIdentifier ? 'RECONSTRUCTION_CANDIDATE_OF_CITED_HISTORICAL_CANONICAL' : 'NEW_DESIGN_NO_HISTORICAL_IDENTIFIER',
      statement: canonical.historicalIdentifier
        ? `${canonical.historicalIdentifier} is cited by a frozen disposition and its text was not recovered. This package is a reconstruction candidate built from the proposed baseline and is not that document.`
        : 'No Steward canonical exists in any scanned reference. This package is a new design and is not a recovered historical document.',
      reconciliation: { file: FILES_0C2.reconciliation, sha256: reconciliationSha },
      completionMatrixPersonaState: { resolved: personaMatrix?.resolved === true, trackingCapability: personaMatrix?.trackingCapability ?? null },
    },
    actionUniverse: {
      requirements: mine.length,
      byKind: countBy(mine, (row) => row.kind),
      byAuthorityClass: countBy(mine, (row) => row.authorityClass),
      byImplementationStatus: countBy(mine, (row) => row.implementationStatus),
      byEvidenceClassification: countBy(mine, (row) => row.evidenceClassification),
      requirementIds: mine.map((row) => row.requirementId),
    },
    authorityClassLegend: {
      ENGINEERING_REQUIREMENT: 'A requirement the engineering gates must build or prove. It grants nothing.',
      IMPLEMENTED_SOURCE_BEHAVIOR: 'Behavior that source already shows. It is not a statement that the behavior is complete or qualified.',
      PROPOSED_PERMISSION: 'A permission proposed for product acceptance that stays inactive until the named institutional decision is adopted.',
      ADOPTED_INSTITUTIONAL_AUTHORIZATION: 'Not used. No institutional authorization has been adopted and none can be created by this package.',
    },
    visibilityWorkflowMatrix: domainTable(rows, persona),
    actionVisibilityRows: mine.map((row) => ({
      requirementId: row.requirementId,
      kind: row.kind,
      title: row.title,
      domain: row.domain,
      authorityClass: row.authorityClass,
      authorizationBasis: row.authorizationBasis,
      visibilityAndAuthority: row.authorizationRequirement,
      sharedObligation: row.sharedObligation,
      implementationStatus: row.implementationStatus,
      engineeringGate: row.engineeringGate,
      functionalAcceptance: row.acceptanceEvidence[0].statement,
    })),
    functionalAcceptanceCriteria: mine.map((row) => ({ requirementId: row.requirementId, evidence: row.acceptanceEvidence.map((item) => ({ id: item.id, kind: item.kind })), statement: row.acceptanceEvidence[0].statement })),
    negativeSecurityAndTenantIsolationCriteria: NEGATIVE_SECURITY_CRITERIA[persona],
    dependenciesOnOtherPersonas: dependenciesOf(persona, rows, baselines),
    sharedObligationsInvolved: sorted(unique(mine.filter((row) => row.sharedObligation).map((row) => row.sharedObligation.id))),
    outstandingProductDecisions: {
      baseline: productIds.map((id) => ({ id, title: decisionsById.get(id)?.title ?? null, status: decisionsById.get(id)?.status ?? 'OUTSTANDING' })),
      raisedByGate0C2: newDecisions.map((decision) => ({ id: decision.id, title: decision.title, status: decision.status, recommendedOption: null })),
    },
    outstandingInstitutionalAuthorityDecisions: {
      note: 'These are institutional decisions. A product acceptance of this package cannot issue them. They are outstanding and stay so.',
      baseline: institutionalIds.map((id) => ({ id, title: decisionsById.get(id)?.title ?? null, status: decisionsById.get(id)?.status ?? 'OUTSTANDING', decisionOwner: decisionsById.get(id)?.decisionOwner ?? null })),
      inventoryLevelInstitutionalDecisionsOutstanding: classification?.institutionalDecisions?.length ?? 0,
    },
    knownSourceGaps: {
      sourceGaps: PERSONA_FACTS[persona].sourceGaps,
      historicalEvidenceByClass: historicalCounts,
      implementationStatusCounts: countBy(mine, (row) => row.implementationStatus),
      irreducibleHistoricalUncertainty: PERSONA_FACTS[persona].sourceGaps.filter((gap) => gap.kind === 'IRREDUCIBLE_HISTORICAL').map((gap) => gap.id),
      identifiersWithNoRecoverableDefinition: mine.filter((row) => row.historical.inCompletionMatrix && row.historical.class !== 'DIRECT_INDIVIDUAL').map((row) => row.requirementId),
    },
    implementationObligationsByGate: gates.map((gate) => {
      const inGate = mine.filter((row) => row.engineeringGate === gate)
      return { gate, name: matrix.gates?.[String(gate)] ?? null, requirementIds: inGate.map((row) => row.requirementId), implementationStatusCounts: countBy(inGate, (row) => row.implementationStatus), note: 'Obligation to build and prove. Nothing is claimed delivered.' }
    }),
    stewardStructure: persona === 'financial-officer' ? null : { register: FILES_0C2.structure, recommendation: STEWARD_STRUCTURE.recommendation.optionId, recommendationOnly: true, selected: null },
    decisionOwnerRole: OWNER_ROLE,
    consultedRolesAdvisoryOnly: PERSONA_FACTS[persona].consultedRolesAdvisoryOnly,
    approvalOptions: APPROVAL_OPTIONS,
    productApprovalDoesNot: PRODUCT_APPROVAL_DOES_NOT,
    claims: { implementationComplete: false, runtimeQualification: 'NOT_QUALIFIED', securityStatusChanged: false, institutionalAuthorityGranted: false, productSpecificationRatified: false },
  }
}

export function buildDecisionRegister({ packages, packageShas, baselineSha, institutionalOutstanding }) {
  return {
    schemaVersion: 1,
    register: 'UE-PERSONA-PRODUCT-DECISION-REGISTER',
    gate: '0C.2',
    registerVersion: 1,
    anchorCommit: ANCHOR_COMMIT,
    note: 'Versioned product-decision records for the three persona baselines. A record leaves PROPOSED_FOR_RATIFICATION only on independent documentary approval evidence from an authorized product owner for the exact artifact version and hash. Product acceptance sets the engineering canonical. It cannot issue any institutional authority grant.',
    permittedStates: DECISION_STATES,
    approvalEvidenceSchema: {
      required: ['decisionMaker.name', 'decisionMaker.role', 'decidedOn', 'artifactVersion', 'artifactSha256', 'scope', 'evidenceDocument.reference', 'evidenceDocument.sha256', 'independentOfPreparer'],
      decisionMakerRole: OWNER_ROLE,
      permittedScopes: APPROVAL_SCOPES,
      note: 'The decision maker is a person authorized to decide product specification. An engineering agent, the preparer or a role placeholder is not.',
    },
    records: PERSONAS.map((persona) => ({
      recordId: RECORD_IDS[persona],
      recordVersion: 1,
      persona,
      state: PROPOSED_STATE,
      artifact: { packageId: packages[persona].packageId, version: packages[persona].version, file: FILES_0C2[persona], sha256: packageShas[persona], baselineFile: BASELINE_FILES[persona], baselineSha256: baselineSha[persona] },
      decisionOwnerRole: OWNER_ROLE,
      approvalEvidence: null,
      selfRatification: false,
      permittedScopes: APPROVAL_SCOPES,
      productDecisionsToSettle: [...packages[persona].outstandingProductDecisions.baseline.map((d) => d.id), ...packages[persona].outstandingProductDecisions.raisedByGate0C2.map((d) => d.id)],
      institutionalGrants: { issuedByThisRecord: 0, grantsInstitutionalAuthority: false, outstandingInstitutionalDecisions: institutionalOutstanding, note: 'A product approval can establish the engineering canonical. It cannot issue the outstanding institutional authority decisions.' },
      stateHistory: [{ version: 1, state: PROPOSED_STATE, recordedOn: PREPARED_ON, recordedBy: 'GATE-0C.2 engineering preparation', basis: 'Prepared for a decision. No decision is recorded and none is implied.' }],
    })),
    raisedByGate0C2: NEW_PRODUCT_DECISIONS,
  }
}

export function buildAll({ baselines, baselineDecisions, matrix, recovery, classification, baselineSha }) {
  const reconciliation = buildReconciliation({ baselines, matrix, baselineSha })
  const reconciliationSha = sha256Of(reconciliation)
  const rows = reconciliation.rows
  const packages = {}
  for (const persona of PERSONAS) packages[persona] = buildPackage({ persona, rows, baselines, baselineDecisions, baselineSha, reconciliationSha, matrix, recovery, classification })
  const packageShas = Object.fromEntries(PERSONAS.map((persona) => [persona, sha256Of(packages[persona])]))
  return {
    preservation: buildPreservation({ matrix, recovery, baselines }),
    structure: buildStructure({ rows, recovery, baselines }),
    reconciliation,
    packages,
    decisions: buildDecisionRegister({ packages, packageShas, baselineSha, institutionalOutstanding: classification?.institutionalDecisions?.length ?? 0 }),
  }
}

const list = (items) => (items.length === 0 ? '_none_' : items.join(', '))

export function renderPackageDoc(pkg, sha, record) {
  const lines = []
  lines.push(`# ${pkg.displayName} — Decision Package ${pkg.version}`)
  lines.push('')
  lines.push(`**Status: ${pkg.status}.** ${pkg.banner}`)
  lines.push('')
  lines.push(`- Package: \`${pkg.packageId}\` version \`${pkg.version}\``)
  lines.push(`- Package register: \`${FILES_0C2[pkg.persona]}\``)
  lines.push(`- Package sha256: \`${sha}\``)
  lines.push(`- Decision record: \`${record.recordId}\` state \`${record.state}\``)
  lines.push(`- Decision-owner role: \`${pkg.decisionOwnerRole}\``)
  lines.push(`- Source baseline: \`${pkg.lineage.proposedBaselineFile}\` (\`${pkg.lineage.proposedBaselineSha256}\`), unchanged, status \`${pkg.lineage.proposedBaselineStatus}\``)
  lines.push(`- Historical canonical recovered: **no**. ${pkg.lineage.statement}`)
  lines.push('')
  lines.push('## Action universe')
  lines.push('')
  lines.push(`${pkg.actionUniverse.requirements} requirements. Kinds: ${Object.entries(pkg.actionUniverse.byKind).map(([k, v]) => `${k} ${v}`).join(', ')}. Authority classes: ${Object.entries(pkg.actionUniverse.byAuthorityClass).map(([k, v]) => `${k} ${v}`).join(', ')}. Adopted institutional authorizations: 0.`)
  lines.push('')
  lines.push('## Visibility and workflow matrix (eleven domains)')
  lines.push('')
  lines.push('| Domain | Coverage | Requirements | Open product decision |')
  lines.push('| --- | --- | --- | --- |')
  for (const domain of pkg.visibilityWorkflowMatrix) lines.push(`| ${domain.label} | ${domain.coverage} | ${list(domain.requirementIds)} | ${list(domain.gapDecisionIds)} |`)
  lines.push('')
  for (const domain of pkg.visibilityWorkflowMatrix) lines.push(`- **${domain.label}** (${domain.coverage}): ${domain.summary}`)
  lines.push('')
  lines.push('## Action and visibility rows')
  lines.push('')
  lines.push('| Requirement | Kind | Domain | Authority class | Implementation | Gate |')
  lines.push('| --- | --- | --- | --- | --- | --- |')
  for (const row of pkg.actionVisibilityRows) lines.push(`| ${row.requirementId} | ${row.kind} | ${row.domain} | ${row.authorityClass} | ${row.implementationStatus} | ${row.engineeringGate} |`)
  lines.push('')
  lines.push('## Negative security and tenant-isolation criteria')
  lines.push('')
  for (const criterion of pkg.negativeSecurityAndTenantIsolationCriteria) lines.push(`- **${criterion.id}** (${criterion.class}): ${criterion.statement} Requirements: ${list(criterion.requirementIds)}.`)
  lines.push('')
  lines.push('## Dependencies on other personas')
  lines.push('')
  if (pkg.dependenciesOnOtherPersonas.length === 0) lines.push('_none_')
  for (const dependency of pkg.dependenciesOnOtherPersonas) lines.push(`- ${dependency.onPersona} via ${dependency.via}: ${list(dependency.ids)}`)
  lines.push('')
  lines.push('## Outstanding product decisions')
  lines.push('')
  for (const decision of [...pkg.outstandingProductDecisions.baseline, ...pkg.outstandingProductDecisions.raisedByGate0C2]) lines.push(`- \`${decision.id}\` ${decision.title} (${decision.status})`)
  lines.push('')
  lines.push('## Outstanding institutional authority decisions')
  lines.push('')
  lines.push(pkg.outstandingInstitutionalAuthorityDecisions.note)
  lines.push('')
  for (const decision of pkg.outstandingInstitutionalAuthorityDecisions.baseline) lines.push(`- \`${decision.id}\` ${decision.title} (${decision.status}, owner ${decision.decisionOwner})`)
  lines.push('')
  lines.push('## Known source gaps and irreducible historical uncertainty')
  lines.push('')
  for (const gap of pkg.knownSourceGaps.sourceGaps) lines.push(`- \`${gap.id}\` (${gap.kind}): ${gap.statement}`)
  lines.push('')
  lines.push(`Historical evidence by class: ${Object.entries(pkg.knownSourceGaps.historicalEvidenceByClass).map(([k, v]) => `${k} ${v}`).join(', ')}.`)
  lines.push('')
  lines.push('## Implementation obligations by engineering gate')
  lines.push('')
  for (const gate of pkg.implementationObligationsByGate) lines.push(`- Gate ${gate.gate} (${gate.name}): ${gate.requirementIds.length} requirements. ${Object.entries(gate.implementationStatusCounts).map(([k, v]) => `${k} ${v}`).join(', ')}.`)
  lines.push('')
  lines.push('Obligations to build and prove. Nothing here claims an implementation, a security status or a runtime qualification.')
  lines.push('')
  lines.push('## Decision options')
  lines.push('')
  for (const option of pkg.approvalOptions) lines.push(`- **${option.id}** → \`${option.resultingState}\`. ${option.effect}`)
  lines.push('')
  lines.push('A product approval does not:')
  lines.push('')
  for (const item of pkg.productApprovalDoesNot) lines.push(`- ${item}`)
  lines.push('')
  return `${lines.join('\n')}\n`
}

export function renderIndexDoc(all, shas) {
  const lines = []
  lines.push('# Persona Canonical Ratification Readiness — Gate 0C.2')
  lines.push('')
  lines.push('**Status: all three baselines are PROPOSED_FOR_RATIFICATION.** Gate 0C.2 prepares decision packages. It ratifies none, adopts no institutional decision and issues no mandate.')
  lines.push('')
  lines.push('| Persona | Package | Version | Requirements | Decision record | State | Package sha256 |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- |')
  for (const persona of PERSONAS) {
    const pkg = all.packages[persona]
    const record = all.decisions.records.find((item) => item.persona === persona)
    lines.push(`| ${pkg.displayName} | \`${pkg.packageId}\` | ${pkg.version} | ${pkg.actionUniverse.requirements} | \`${record.recordId}\` | \`${record.state}\` | \`${shas[persona]}\` |`)
  }
  lines.push('')
  lines.push('## Steward structural recommendation (recommendation only)')
  lines.push('')
  lines.push(`Recommended: \`${all.structure.recommendation.optionId}\`. Not selected. Not ratified. Decision \`DEC-PD-01\` belongs to the ${OWNER_ROLE}.`)
  lines.push('')
  lines.push(all.structure.recommendation.rationale)
  lines.push('')
  for (const option of all.structure.options) {
    lines.push(`### ${option.id}: ${option.title}`)
    lines.push('')
    lines.push(option.description)
    lines.push('')
    for (const [dimension, text] of Object.entries(option.consequences)) lines.push(`- ${dimension}: ${text}`)
    for (const tradeOff of option.tradeOffs) lines.push(`- Trade-off: ${tradeOff}`)
    lines.push('')
  }
  lines.push('## Preservation')
  lines.push('')
  lines.push(`${all.preservation.total} historical identifiers are preserved (${Object.entries(all.preservation.perPersona).map(([k, v]) => `${k} ${v}`).join(', ')}). The three proposed baseline artifacts are unchanged.`)
  lines.push('')
  lines.push('## Shared obligations')
  lines.push('')
  for (const obligation of all.reconciliation.sharedObligations) lines.push(`- \`${obligation.id}\` ${obligation.title}: owner ${obligation.ownerPersona} (${obligation.ownerRequirementId}), ${obligation.members.length} members.`)
  lines.push('')
  lines.push('## New product decisions raised by Gate 0C.2')
  lines.push('')
  for (const decision of all.decisions.raisedByGate0C2) lines.push(`- \`${decision.id}\` (${decision.persona}) ${decision.title}`)
  lines.push('')
  return `${lines.join('\n')}\n`
}

export function renderDocs(all) {
  const shas = Object.fromEntries(PERSONAS.map((persona) => [persona, sha256Of(all.packages[persona])]))
  const docs = { [DOCS_0C2.index]: renderIndexDoc(all, shas) }
  for (const persona of PERSONAS) docs[DOCS_0C2[persona]] = renderPackageDoc(all.packages[persona], shas[persona], all.decisions.records.find((item) => item.persona === persona))
  return docs
}

/* ---------------------------------------------------------------------------------------------------------------- */

function validateEvidence(record, artifactSha, artifactVersion) {
  const out = []
  const label = record.recordId
  const evidence = record.approvalEvidence
  if (!evidence || typeof evidence !== 'object') return [`DECISION-NO-EVIDENCE: ${label} is ${record.state} with no independent approval evidence`]
  const maker = evidence.decisionMaker ?? {}
  if (typeof maker.name !== 'string' || maker.name.trim().length < 3) out.push(`DECISION-NO-EVIDENCE: ${label} names no decision maker`)
  else if (NON_DECISION_MAKERS.test(maker.name)) out.push(`DECISION-NOT-INDEPENDENT: ${label} names "${maker.name}", which is not an independent decision maker`)
  if (maker.role !== OWNER_ROLE) out.push(`DECISION-NO-EVIDENCE: ${label} decision maker role is not ${OWNER_ROLE}`)
  if (typeof evidence.decidedOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(evidence.decidedOn) || Number.isNaN(Date.parse(evidence.decidedOn))) out.push(`DECISION-NO-EVIDENCE: ${label} records no decision date`)
  if (evidence.artifactVersion !== artifactVersion) out.push(`DECISION-STALE-EVIDENCE: ${label} approval names version ${evidence.artifactVersion}, not ${artifactVersion}`)
  if (evidence.artifactSha256 !== artifactSha) out.push(`DECISION-STALE-EVIDENCE: ${label} approval names an artifact hash that is not the current package`)
  if (!Array.isArray(evidence.scope) || evidence.scope.length === 0) out.push(`DECISION-NO-EVIDENCE: ${label} records no approval scope`)
  else if (evidence.scope.some((item) => !APPROVAL_SCOPES.includes(item))) out.push(`DECISION-GRANT-AS-APPROVAL: ${label} approval scope ${evidence.scope.filter((item) => !APPROVAL_SCOPES.includes(item)).join(', ')} is outside product specification`)
  if (typeof evidence.evidenceDocument?.reference !== 'string' || evidence.evidenceDocument.reference.trim() === '' || !/^[0-9a-f]{64}$/.test(evidence.evidenceDocument?.sha256 ?? '')) out.push(`DECISION-NO-EVIDENCE: ${label} cites no approval document with a hash`)
  if (evidence.independentOfPreparer !== true) out.push(`DECISION-NOT-INDEPENDENT: ${label} approval is not recorded as independent of the preparer`)
  return out
}

export function validateDecisionRecord(record, artifactSha, artifactVersion) {
  const out = []
  const label = record?.recordId ?? 'UNNAMED-RECORD'
  if (!DECISION_STATES.includes(record?.state)) return [`DECISION-STATE: ${label} state ${record?.state} is not permitted`]
  if (record.selfRatification !== false) out.push(`DECISION-SELF-RATIFICATION: ${label} does not state selfRatification false`)
  if (record.institutionalGrants?.issuedByThisRecord !== 0 || record.institutionalGrants?.grantsInstitutionalAuthority !== false) out.push(`DECISION-GRANT-AS-APPROVAL: ${label} records an institutional grant issued by a product decision`)
  if (record.state === PROPOSED_STATE) {
    if (record.approvalEvidence !== null && record.approvalEvidence !== undefined) out.push(`DECISION-STATE: ${label} is ${PROPOSED_STATE} yet carries approval evidence`)
    if (record.artifact?.sha256 !== artifactSha) out.push(`DECISION-STALE-EVIDENCE: ${label} artifact hash is not the current package`)
  } else {
    out.push(...validateEvidence(record, artifactSha, artifactVersion))
    if (record.state === 'RETURNED_FOR_REWORK' && (!Array.isArray(record.returnReasons) || record.returnReasons.length === 0)) out.push(`DECISION-NO-EVIDENCE: ${label} is returned for rework with no recorded reasons`)
  }
  for (const entry of record.stateHistory ?? []) {
    if (!DECISION_STATES.includes(entry.state)) out.push(`DECISION-STATE: ${label} history state ${entry.state} is not permitted`)
    if (entry.state !== PROPOSED_STATE && NON_DECISION_MAKERS.test(String(entry.recordedBy ?? ''))) out.push(`DECISION-NOT-INDEPENDENT: ${label} history records ${entry.state} by ${entry.recordedBy}`)
  }
  return out
}

function stripDecisionOutcome(register) {
  const copy = clone(register)
  for (const record of copy.records ?? []) {
    record.state = PROPOSED_STATE
    record.approvalEvidence = null
    record.stateHistory = []
    delete record.returnReasons
  }
  return copy
}

const sameIds = (a, b) => a.length === b.length && a.every((value, index) => value === b[index])

/**
 * Validates the Gate 0C.2 registers against live sources. `frozen` carries the accepted-commit evidence the checks compare
 * against; a missing `frozen` is itself a problem so that the freeze cannot be skipped silently.
 */
export function validatePersonaReadiness({ registers, src, frozen, docs, liveFileSha }) {
  const problems = []
  const { preservation, structure, reconciliation, packages, decisions } = registers ?? {}
  if (!preservation || !structure || !reconciliation || !packages || !decisions || PERSONAS.some((persona) => !packages[persona])) return ['READINESS-ABSENT: a Gate 0C.2 register is missing']
  const expected = buildAll(src)
  const rows = reconciliation.rows ?? []

  // Identifiers: preserved, unique, none lost, none invented.
  const matrixActions = src.matrix.personaActions ?? []
  if (preservation.total !== matrixActions.length || preservation.identifiers?.length !== matrixActions.length) problems.push(`ID-PRESERVATION: the preservation register holds ${preservation.identifiers?.length ?? 0} identifiers, the matrix holds ${matrixActions.length}`)
  const preservedIds = (preservation.identifiers ?? []).map((item) => item.id)
  if (unique(preservedIds).length !== preservedIds.length) problems.push('ID-DUPLICATE: the preservation register repeats an identifier')
  for (const action of matrixActions) if (!preservedIds.includes(action.actionId)) problems.push(`ID-LOST: historical identifier ${action.actionId} is missing from the preservation register`)
  for (const id of preservedIds) if (!matrixActions.some((action) => action.actionId === id)) problems.push(`ID-INVENTED: ${id} is not a historical identifier of the completion matrix`)
  for (const item of preservation.identifiers ?? []) {
    const action = matrixActions.find((entry) => entry.actionId === item.id)
    if (action && (action.persona !== item.persona || action.definition !== item.matrixDefinition || action.capabilityId !== item.capabilityId || action.mandatory !== item.mandatory || action.source !== item.source)) problems.push(`ID-EVIDENCE-STATUS-CHANGED: ${item.id} no longer carries the evidence status of the completion matrix`)
  }
  const frozenActions = frozen?.matrix?.personaActions
  if (!frozenActions) problems.push('FROZEN-ABSENT: the accepted Gate 0C.1 matrix is not available for comparison')
  else {
    if (JSON.stringify(frozenActions) !== JSON.stringify(matrixActions)) problems.push('FROZEN-CHANGED: the 182 persona identifiers differ from the accepted Gate 0C.1 matrix')
    if (preservation.digestSha256 !== sha256Text(JSON.stringify(frozenActions.map((a) => [a.persona, a.actionId, a.source, a.definition, a.capabilityId, a.mandatory])))) problems.push('FROZEN-CHANGED: the preservation digest does not match the accepted Gate 0C.1 identifiers')
  }

  // Requirements: every baseline requirement has exactly one row.
  const expectedIds = PERSONAS.flatMap((persona) => requirementsOf(src.baselines[persona]).map((item) => item.id))
  if (unique(expectedIds).length !== expectedIds.length) problems.push('ID-DUPLICATE: a requirement identifier appears in more than one proposed baseline or twice in one')
  const rowIds = rows.map((row) => row.requirementId)
  if (unique(rowIds).length !== rowIds.length) problems.push(`ID-DUPLICATE: the reconciliation repeats ${rowIds.filter((id, index) => rowIds.indexOf(id) !== index).join(', ')}`)
  for (const id of expectedIds) if (!rowIds.includes(id)) problems.push(`ID-LOST: requirement ${id} has no reconciliation row`)
  for (const id of rowIds) if (!expectedIds.includes(id)) problems.push(`ID-INVENTED: reconciliation row ${id} is not a requirement of a proposed baseline`)
  for (const item of matrixActions.filter((action) => PERSONAS.includes(action.persona))) if (!rowIds.includes(item.actionId)) problems.push(`ID-LOST: historical identifier ${item.actionId} has no requirement row, so it would vanish with its incomplete source`)

  const owners = new Map()
  for (const row of rows) {
    const label = row.requirementId
    if (!PERSONAS.includes(row.persona)) problems.push(`NO-ACCOUNTABLE-PERSONA: ${label} names no canonical persona`)
    else if (!requirementsOf(src.baselines[row.persona]).some((item) => item.id === label)) problems.push(`NO-ACCOUNTABLE-PERSONA: ${label} is not a requirement of ${row.persona}`)
    if (!row.completionOwner?.capabilityId || row.engineeringGate === null || row.engineeringGate === undefined) problems.push(`ORPHANED-ACTION: ${label} has no completion owner or engineering gate`)
    else if (!src.matrix.capabilities.some((capability) => capability.id === row.completionOwner.capabilityId)) problems.push(`ORPHANED-ACTION: ${label} completion owner ${row.completionOwner.capabilityId} is not in the capability lock`)
    if (!DOMAINS.includes(row.domain)) problems.push(`MATRIX-DOMAIN: ${label} is in no authority domain`)
    if (!AUTHORITY_CLASSES.includes(row.authorityClass)) problems.push(`AUTHORITY-CLASS: ${label} has authority class ${row.authorityClass}`)
    if (row.authorityClass === 'ADOPTED_INSTITUTIONAL_AUTHORIZATION') problems.push(`FALSE-AUTHORITY: ${label} is labelled an adopted institutional authorization and none has been adopted`)
    if (row.liveAuthorityCreated !== false) problems.push(`FALSE-AUTHORITY: ${label} records live authority created from a role, membership or hierarchy`)
    if (row.institutionalDecisionIds?.length > 0 && row.authorityClass !== 'PROPOSED_PERMISSION') problems.push(`FALSE-AUTHORITY: ${label} depends on an institutional decision yet is not a proposed permission`)
    if (row.scope?.inferredFromHierarchy !== false || row.scope?.crossOrganizationVisibility !== 'NONE' || row.scope?.organizationScope !== 'ACTIVE_ORGANIZATION_ONLY') problems.push(`CROSS-TENANT-INFERENCE: ${label} grants visibility beyond the active organization or infers scope from the hierarchy`)
    if (!IMPLEMENTATION_STATUSES.includes(row.implementationStatus)) problems.push(`IMPLEMENTATION-CLAIM: ${label} implementation status ${row.implementationStatus} is not an evidenced status`)
    if (!HISTORICAL_CLASSES.includes(row.historical?.class)) problems.push(`HISTORICAL-CLASS: ${label} has historical class ${row.historical?.class}`)
    if (PERSONAS.includes(row.persona) && row.persona === 'steward' && row.historical?.class !== 'NONE') problems.push(`FABRICATED-HISTORICAL: Steward requirement ${label} claims historical evidence and no Steward canonical or action exists in any scanned reference`)
    if (row.historical?.class === 'DIRECT_INDIVIDUAL' && !row.historical.individuallyEvidenced) problems.push(`FABRICATED-HISTORICAL: ${label} is classified directly evidenced without an individual historical statement`)
    if (!(row.negativeCriteria?.criterionIds?.length > 0)) problems.push(`NEGATIVE-CRITERIA: ${label} has no negative test criterion`)
    if (!(row.acceptanceEvidence?.length > 0)) problems.push(`ACCEPTANCE-EVIDENCE: ${label} has no required acceptance evidence`)
    const share = row.sharedObligation
    if (share) {
      const obligation = (reconciliation.sharedObligations ?? []).find((item) => item.id === share.id)
      if (!obligation) problems.push(`DUPLICATE-OWNERSHIP: ${label} names an unknown shared obligation ${share.id}`)
      else if (!obligation.members.some((member) => member.id === label)) problems.push(`DUPLICATE-OWNERSHIP: ${label} claims shared obligation ${share.id} that does not list it`)
    }
    owners.set(label, [...(owners.get(label) ?? []), row.persona])
  }
  for (const [id, personas] of owners) if (unique(personas).length > 1) problems.push(`DUPLICATE-OWNERSHIP: ${id} is owned by ${unique(personas).join(' and ')}`)

  // Shared obligations: one owner each, members real, a requirement in at most one.
  const memberObligation = new Map()
  for (const obligation of reconciliation.sharedObligations ?? []) {
    const ownerMembers = obligation.members.filter((member) => member.role === 'OWNER')
    if (ownerMembers.length !== 1) problems.push(`DUPLICATE-OWNERSHIP: shared obligation ${obligation.id} has ${ownerMembers.length} owners`)
    if (ownerMembers[0] && ownerMembers[0].persona !== obligation.ownerPersona) problems.push(`NO-ACCOUNTABLE-PERSONA: shared obligation ${obligation.id} owner persona differs from its owner requirement`)
    if (obligation.accountabilityNotAuthorization !== true) problems.push(`FALSE-AUTHORITY: shared obligation ${obligation.id} does not state that ownership is accountability and not authorization`)
    for (const member of obligation.members) {
      const row = rows.find((item) => item.requirementId === member.id)
      if (!row) problems.push(`ORPHANED-ACTION: shared obligation ${obligation.id} member ${member.id} is not a requirement`)
      else if (row.persona !== member.persona) problems.push(`NO-ACCOUNTABLE-PERSONA: ${member.id} is listed under ${member.persona} but belongs to ${row.persona}`)
      if (memberObligation.has(member.id)) problems.push(`DUPLICATE-OWNERSHIP: ${member.id} belongs to ${memberObligation.get(member.id)} and ${obligation.id}`)
      memberObligation.set(member.id, obligation.id)
    }
  }

  // Domain matrix: each persona covers eleven domains, and a partial or missing domain cites a decision.
  const newDecisionIds = new Set(NEW_PRODUCT_DECISIONS.map((decision) => decision.id))
  for (const persona of PERSONAS) {
    const table = packages[persona].visibilityWorkflowMatrix ?? []
    if (!sameIds(table.map((entry) => entry.domain), DOMAINS)) problems.push(`MATRIX-DOMAIN: ${persona} matrix does not cover the eleven authority domains in order`)
    for (const entry of table) {
      if (!COVERAGE_STATES.includes(entry.coverage)) problems.push(`MATRIX-DOMAIN: ${persona} ${entry.domain} coverage ${entry.coverage} is not a coverage state`)
      if (entry.coverage === 'COVERED' && entry.requirementIds.length === 0) problems.push(`MATRIX-DOMAIN: ${persona} ${entry.domain} is covered by no requirement`)
      if (entry.coverage !== 'COVERED' && !(entry.gapDecisionIds?.length > 0 && entry.gapDecisionIds.every((id) => newDecisionIds.has(id)))) problems.push(`MATRIX-DOMAIN: ${persona} ${entry.domain} is ${entry.coverage} without a product decision`)
    }
  }
  for (const [persona, criteria] of Object.entries(NEGATIVE_SECURITY_CRITERIA)) {
    const classes = criteria.map((criterion) => criterion.class)
    if (!classes.includes('TENANT_ISOLATION')) problems.push(`CROSS-TENANT-INFERENCE: ${persona} has no tenant-isolation criterion`)
    if (!classes.some((name) => /HIERARCHY|SENIORITY/.test(name))) problems.push(`CROSS-TENANT-INFERENCE: ${persona} has no criterion rejecting scope inferred from hierarchy`)
    for (const criterion of criteria) for (const id of criterion.requirementIds) if (!rows.some((row) => row.requirementId === id && row.persona === persona)) problems.push(`NEGATIVE-CRITERIA: ${criterion.id} cites ${id}, which is not a ${persona} requirement`)
  }

  // Packages: proposed only, lineage honest, nothing claimed.
  const reconciliationSha = sha256Of(reconciliation)
  for (const persona of PERSONAS) {
    const pkg = packages[persona]
    if (pkg.status !== PROPOSED_STATE) problems.push(`PROPOSED-AS-ACCEPTED: ${pkg.packageId ?? persona} package status is ${pkg.status}`)
    if (pkg.selfRatification !== false) problems.push(`SELF-RATIFICATION: ${persona} package does not state selfRatification false`)
    if (pkg.packageId !== PROPOSED_CANONICALS[persona].id || pkg.version !== PROPOSED_CANONICALS[persona].version) problems.push(`PACKAGE-IDENTITY: ${persona} package is not ${PROPOSED_CANONICALS[persona].id} ${PROPOSED_CANONICALS[persona].version}`)
    if (pkg.lineage?.historicalCanonicalRecovered !== false) problems.push(`FABRICATED-HISTORICAL: ${persona} package claims the historical canonical was recovered`)
    if (pkg.lineage?.baselineArtifactChangedByGate0C2 !== false || pkg.lineage?.proposedBaselineSha256 !== expected.packages[persona].lineage.proposedBaselineSha256) problems.push(`BASELINE-CHANGED: the proposed ${persona} baseline differs from the pinned artifact`)
    if (pkg.lineage?.proposedBaselineStatus !== 'PROPOSED_NOT_ADOPTED') problems.push(`PROPOSED-AS-ACCEPTED: ${persona} baseline status is ${pkg.lineage?.proposedBaselineStatus}`)
    if (src.baselines[persona].originalRecovered !== false) problems.push(`FABRICATED-HISTORICAL: the ${persona} baseline claims originalRecovered`)
    if (src.baselines[persona].adopted !== false || src.baselines[persona].frozen !== false) problems.push(`PROPOSED-AS-ACCEPTED: the ${persona} baseline is marked adopted or frozen`)
    if (pkg.lineage?.reconciliation?.sha256 !== reconciliationSha) problems.push(`REGISTER-DRIFT: ${persona} package pins a reconciliation that is not the current register`)
    const claims = pkg.claims ?? {}
    if (claims.implementationComplete !== false) problems.push(`IMPLEMENTATION-CLAIM: ${persona} package claims implementation complete`)
    if (claims.runtimeQualification !== 'NOT_QUALIFIED') problems.push(`IMPLEMENTATION-CLAIM: ${persona} package claims runtime qualification ${claims.runtimeQualification}`)
    if (claims.securityStatusChanged !== false || claims.institutionalAuthorityGranted !== false || claims.productSpecificationRatified !== false) problems.push(`IMPLEMENTATION-CLAIM: ${persona} package changes a security status or claims a grant or a ratification`)
    if (pkg.decisionOwnerRole !== OWNER_ROLE) problems.push(`NO-ACCOUNTABLE-PERSONA: ${persona} package names no ${OWNER_ROLE}`)
    if (!sameIds((pkg.approvalOptions ?? []).map((option) => option.id), ['APPROVE', 'REJECT', 'RETURN_FOR_REWORK'])) problems.push(`PACKAGE-OPTIONS: ${persona} package lacks approve, reject and return-for-rework options`)
    if (pkg.actionUniverse?.byAuthorityClass?.ADOPTED_INSTITUTIONAL_AUTHORIZATION) problems.push(`FALSE-AUTHORITY: ${persona} package counts an adopted institutional authorization`)
  }
  if (structure.status !== 'RECOMMENDATION_ONLY_NOT_SELECTED' || structure.selected !== null || structure.ratified !== false || structure.recommendation?.recommendationOnly !== true || structure.recommendation?.notSelected !== true || structure.recommendation?.notRatified !== true) problems.push('STRUCTURE-SELF-SELECTED: the Steward structure is recorded as selected or ratified instead of recommended')

  // Decision register.
  if (JSON.stringify(decisions.permittedStates) !== JSON.stringify(DECISION_STATES)) problems.push('DECISION-STATE: the permitted decision states differ from the four allowed')
  for (const persona of PERSONAS) {
    const record = (decisions.records ?? []).find((item) => item.persona === persona)
    if (!record || record.recordId !== RECORD_IDS[persona]) {
      problems.push(`DECISION-ABSENT: ${persona} has no versioned decision record ${RECORD_IDS[persona]}`)
      continue
    }
    problems.push(...validateDecisionRecord(record, sha256Of(packages[persona]), packages[persona].version))
    if (record.artifact?.version !== packages[persona].version || record.artifact?.packageId !== packages[persona].packageId) problems.push(`DECISION-STALE-EVIDENCE: ${record.recordId} names an artifact that is not the current package`)
    if (record.state !== PROPOSED_STATE) {
      const matrixPersona = (src.matrix.personaCompleteness ?? []).find((item) => item.persona === persona)
      if (matrixPersona?.resolved === true && record.state !== 'ACCEPTED_BY_AUTHORIZED_PRODUCT_OWNER') problems.push(`PROPOSED-AS-ACCEPTED: ${persona} is resolved in the matrix without an accepted decision`)
    } else if ((src.matrix.personaCompleteness ?? []).find((item) => item.persona === persona)?.resolved === true) {
      problems.push(`PROPOSED-AS-ACCEPTED: ${persona} is resolved in the completion matrix while its decision record is ${PROPOSED_STATE}`)
    }
  }
  for (const decision of decisions.raisedByGate0C2 ?? []) {
    if (decision.status !== 'OUTSTANDING' || decision.adoptedByInstitution !== false || decision.recommendedOption !== null || decision.decisionOwnerRole !== OWNER_ROLE) problems.push(`DECISION-STATE: ${decision.id} is not an outstanding product decision with no preparer recommendation`)
  }
  const baselineDecisions = src.baselineDecisions?.decisions ?? []
  for (const decision of baselineDecisions) if (decision.status !== 'OUTSTANDING') problems.push(`DECISION-GRANT-AS-APPROVAL: baseline decision ${decision.id} is ${decision.status}`)
  if (baselineDecisions.filter((decision) => decision.type === 'INSTITUTIONAL_AUTHORITY').length !== 32) problems.push('FROZEN-CHANGED: the 32 baseline institutional authority decisions changed')

  // Regeneration, apart from the decision outcome fields that only an authorized decision may change.
  if (serialize(reconciliation) !== serialize(expected.reconciliation)) problems.push('REGISTER-DRIFT: the requirement reconciliation differs from its regeneration')
  if (serialize(preservation) !== serialize(expected.preservation)) problems.push('REGISTER-DRIFT: the identifier preservation register differs from its regeneration')
  if (serialize(structure) !== serialize(expected.structure)) problems.push('REGISTER-DRIFT: the Steward structure register differs from its regeneration')
  for (const persona of PERSONAS) if (serialize(packages[persona]) !== serialize(expected.packages[persona])) problems.push(`REGISTER-DRIFT: the ${persona} package differs from its regeneration`)
  if (serialize(stripDecisionOutcome(decisions)) !== serialize(stripDecisionOutcome(expected.decisions))) problems.push('REGISTER-DRIFT: the product decision register differs from its regeneration')

  // Frozen evidence: every pin the accepted matrix recorded is unchanged.
  const frozenMatrix = frozen?.matrix
  if (frozenMatrix) {
    for (const name of ['routeClassification', 'routeClassification0b2', 'routeClassification0b3', 'routeClassification0b4', 'routeClassification0b5', 'routeClassification0b6', 'routeClassification0b7', 'routeClassification0b8', 'routeClassification0b9', 'routeClassification0b10', 'routeClassification0b11', 'routeClassification0b12', 'routeClassification0c1', 'routeUniverseTransition', 'gate0cHandoff', 'releaseDispositionChallenges', 'decisionBoundExceptions']) {
      if (JSON.stringify(frozenMatrix[name]?.files ?? { file: frozenMatrix[name]?.file, sha256: frozenMatrix[name]?.sha256 }) !== JSON.stringify(src.matrix[name]?.files ?? { file: src.matrix[name]?.file, sha256: src.matrix[name]?.sha256 })) problems.push(`FROZEN-CHANGED: ${name} no longer matches the accepted Gate 0C.1 evidence`)
    }
    if (JSON.stringify(frozenMatrix.proposedPersonaBaselines?.data) !== JSON.stringify(src.matrix.proposedPersonaBaselines?.data)) problems.push('BASELINE-CHANGED: the pinned proposed baselines differ from the accepted Gate 0C.1 matrix')
    if (JSON.stringify((frozenMatrix.capabilities ?? []).map((c) => c.id)) !== JSON.stringify((src.matrix.capabilities ?? []).map((c) => c.id))) problems.push('FROZEN-CHANGED: the capability lock differs from the accepted Gate 0C.1 matrix')
    if (JSON.stringify(frozenMatrix.personaCompleteness) !== JSON.stringify(src.matrix.personaCompleteness)) problems.push('FROZEN-CHANGED: the persona completeness record differs from the accepted Gate 0C.1 matrix')
    if (JSON.stringify(frozenMatrix.routeInventoryTotals) !== JSON.stringify(src.matrix.routeInventoryTotals)) problems.push('FROZEN-CHANGED: the route inventory totals differ from the accepted Gate 0C.1 matrix')
  }

  // Claims anywhere in the registers.
  for (const [name, value] of Object.entries({ preservation, structure, reconciliation, decisions, ...Object.fromEntries(PERSONAS.map((persona) => [`package-${persona}`, packages[persona]])) })) {
    if (FORBIDDEN_STATUS.test(JSON.stringify(value))) problems.push(`IMPLEMENTATION-CLAIM: ${name} records a forbidden completion status`)
    if (/PROVEN_IN_STAGING/.test(JSON.stringify(value))) problems.push(`IMPLEMENTATION-CLAIM: ${name} records PROVEN_IN_STAGING`)
  }

  // Rendered documents.
  if (docs) {
    for (const persona of PERSONAS) {
      const text = docs[DOCS_0C2[persona]]
      const record = (decisions.records ?? []).find((item) => item.persona === persona)
      if (typeof text !== 'string') problems.push(`DOC-ABSENT: ${DOCS_0C2[persona]} is missing`)
      else {
        if (!text.includes(sha256Of(packages[persona]))) problems.push(`DOC-DRIFT: ${DOCS_0C2[persona]} does not carry the current package hash`)
        if (record?.state === PROPOSED_STATE && /\*\*Status: (ACCEPTED|REJECTED)/.test(text)) problems.push(`PROPOSED-AS-ACCEPTED: ${DOCS_0C2[persona]} reads as accepted while the record is ${PROPOSED_STATE}`)
      }
    }
    if (typeof docs[DOCS_0C2.index] !== 'string') problems.push(`DOC-ABSENT: ${DOCS_0C2.index} is missing`)
  }
  if (liveFileSha) {
    for (const persona of PERSONAS) if (liveFileSha(BASELINE_FILES[persona]) !== src.matrix.proposedPersonaBaselines?.data?.[persona]?.sha256) problems.push(`BASELINE-CHANGED: ${BASELINE_FILES[persona]} no longer matches its pinned hash`)
  }
  return problems
}

export function readinessSummary({ registers }) {
  const records = registers.decisions.records
  return {
    gate: GATE_ID,
    packages: Object.fromEntries(PERSONAS.map((persona) => [persona, { id: registers.packages[persona].packageId, version: registers.packages[persona].version, requirements: registers.packages[persona].actionUniverse.requirements, state: records.find((record) => record.persona === persona).state }])),
    requirements: registers.reconciliation.rows.length,
    identifiersPreserved: registers.preservation.total,
    sharedObligations: registers.reconciliation.sharedObligations.length,
    newProductDecisions: registers.decisions.raisedByGate0C2.length,
    stewardRecommendation: registers.structure.recommendation.optionId,
    ratified: records.filter((record) => record.state === 'ACCEPTED_BY_AUTHORIZED_PRODUCT_OWNER').length,
  }
}
