/**
 * Gate 0C.4 builders: the qualification registers, the supersession and clarification records, the product-owner and
 * institutional dossiers and the deterministic Gate 0 certification model. Every builder is pure. Nothing here accepts,
 * ratifies, adopts or authorizes anything, and no builder reads a Gate 0C.3 register except as the claim under review.
 */
import { CARBON_DECISION_ID, CARBON_OPERATIONS, CHALLENGE_IDS, EXPOSURE_OPERATIONS, FILES_0C3, OPL_DEFECTS } from './ue-gate0c3-ids.mjs'
import { serialize, sha256Of, sorted, unique } from './ue-gate0c3-reconcile.mjs'
import {
  ANCHOR_0C3_COMMIT,
  CERTIFICATION_CHECKS,
  DOCUMENTARY_LABEL,
  GATE_ID,
  PER_CAPITA,
  PERSONA_PACKAGES,
  PRESENTATION,
  PREPARED_ON,
  RETENTION_DEFECT,
  REVIEW_STATUSES,
  THEMES,
} from './ue-gate0c4-ids.mjs'
import { qualifyAll, recordingReader, reviewProvenance, verifyCarbon, verifyChallenges, verifyDeduplication, verifyExposures, verifyPerCapita, verifyRetentionScheduler } from './ue-gate0c4-qualify.mjs'

export { serialize, sha256Of, sorted, unique }

const tally = (items) => Object.fromEntries(sorted(unique(items)).map((key) => [key, items.filter((item) => item === key).length]))
const header = (register, status, note) => ({ schemaVersion: 1, register, gate: GATE_ID, version: 1, anchorCommit: ANCHOR_0C3_COMMIT, preparedOn: PREPARED_ON, status, note })

const CB_DEPENDENCIES = {
  CB_AUD: 'An institutional decision on the audience that may read the records.',
  CB_PLAT: 'Who holds the platform role title and under which adopted mandate.',
  CB_INERT: 'Whether the route is reachable or advertised as a working capability.',
  CB_DEP: 'A deployment or scheduler fact the repository cannot establish.',
  CB_INT: 'The population of role-restricted callers who can reach the route.',
}

export function buildQualification(src, qualification) {
  return {
    ...header(
      'UE-HIGH-DEFECT-QUALIFICATION',
      'QUALIFICATION_NOT_ACCEPTANCE',
      'An independent-in-method source qualification of the 71 proposed Gate 0C.3 dispositions. It records what the route source supports, contests or cannot show. It accepts no disposition, changes no severity and fills no approval field.',
    ),
    review: reviewProvenance(),
    lineage: { assessmentFile: FILES_0C3.assessment, assessmentSha256: src.regSha.assessment, queueDefects: 71 },
    statusDefinitions: {
      SOURCE_VERIFIED: 'Every check the route source can settle agrees with the assessment and no absence claim is made that source cannot prove.',
      PARTIALLY_VERIFIED: 'The route source supports part of the assessment and contests, narrows or cannot prove another part. The named findings say which.',
      INFERENCE_ONLY: 'The route source recomputes nothing the assessment states.',
      REQUIRES_RUNTIME_PROOF: 'The disposition rests on a fact (row-level security, a database, a deployment value or a browser) that no reading of the repository can supply. This status takes precedence over the source-verification status of the same record; the source status is carried separately.',
    },
    separation: 'A qualification record is not an acceptance. The proposed disposition keeps state PROPOSED_NOT_ACCEPTED and every approval field stays empty.',
    totals: qualification.totals,
    qualifications: qualification.items,
  }
}

function conditionalProposals(src, qualification) {
  const byId = new Map(qualification.items.map((item) => [item.defectId, item]))
  return src.reg.assessment.assessments
    .filter((assessment) => assessment.proposedDisposition.value === 'CONDITIONALLY_BLOCKING')
    .map((assessment) => ({
      defectId: assessment.defectId,
      rubricKey: assessment.proposedDisposition.rubricKey,
      condition: assessment.proposedDisposition.condition,
      activationAssumption: { stated: assessment.sourceExposure.activationState, sourceVerdict: byId.get(assessment.defectId).sourceChecks.activation.verdict },
      dependsOn: CB_DEPENDENCIES[assessment.proposedDisposition.rubricKey] ?? 'A fact the record does not name.',
      resolvableFromRepository: false,
      institutionalDecisionIds: assessment.institutionalDecisionIds,
      reviewStatus: byId.get(assessment.defectId).reviewStatus,
      sensitivity: byId.get(assessment.defectId).dispositionSensitivity,
    }))
}

function reviewRequired(src, qualification, retention) {
  const byId = new Map(qualification.items.map((item) => [item.defectId, item]))
  return src.reg.assessment.assessments
    .filter((assessment) => assessment.proposedDisposition.value === 'REVIEW_REQUIRED')
    .map((assessment) => ({
      defectId: assessment.defectId,
      namedMissingEvidence: assessment.proposedDisposition.reviewReasons,
      reviewStatus: byId.get(assessment.defectId).reviewStatus,
      decidedHere: false,
      retentionSchedulerFinding: assessment.defectId === RETENTION_DEFECT ? retention : null,
    }))
}

export function buildEvidence(src, qualification, reader) {
  const retention = verifyRetentionScheduler(src, reader)
  const exposures = verifyExposures(src, reader)
  const challenges = verifyChallenges(src)
  const perCapita = verifyPerCapita(src, reader)
  const carbon = verifyCarbon(src, reader)
  const deduplication = verifyDeduplication(src)
  const rb = qualification.items.filter((item) => item.proposedDisposition.value === 'RELEASE_BLOCKING')
  return {
    ...header(
      'UE-EVIDENCE-QUALIFICATION',
      'QUALIFICATION_NOT_ACCEPTANCE',
      'Independent-in-method qualification of the Gate 0C.3 evidence other than the 71 per-defect records: the 150-item index, the two OPL challenges, the three public exposures, the per-capita relationship, the carbon evidence and the retention scheduler search. Statuses use SOURCE_VERIFIED, PARTIALLY_VERIFIED, INFERENCE_ONLY and REQUIRES_RUNTIME_PROOF only.',
    ),
    statusVocabulary: REVIEW_STATUSES,
    review: reviewProvenance(),
    deduplication,
    releaseBlockingProposals: {
      count: rb.length,
      byRubric: tally(rb.map((item) => item.sourceChecks.rubric.key)),
      byRubricResult: tally(rb.map((item) => item.sourceChecks.rubric.result)),
      byReviewStatus: tally(rb.map((item) => item.reviewStatus)),
      note: 'These remain proposals. Each stays PROPOSED_NOT_ACCEPTED.',
    },
    conditionalProposals: { count: 0, items: conditionalProposals(src, qualification) },
    reviewRequiredProposals: reviewRequired(src, qualification, retention),
    challenges,
    exposures,
    perCapita,
    carbon,
    sourceBlobs: Object.entries(reader.pins()).map(([file, sha256]) => ({ sha256, file })),
    limitations: [
      'No test, database, browser, deployment, role-title or scheduler check was run.',
      'A source reading shows what the repository declares. It does not show what a deployment enforces.',
      'The reviewer is method-independent only and is not an authority-independent approver.',
    ],
  }
}

function frozenRef(src, key) {
  return { register: FILES_0C3[key], registerSha256: src.history.registers[key].sha256 }
}

const CLAIM_CODES = {
  FLOOR_UNDERSTATED: 'The stated floor understates who can reach the operation.',
  FLOOR_OVERSTATED: 'The stated floor overstates who can reach the operation.',
  STATED_FLOOR_ROLE_NOT_DECLARED: 'The stated floor names a role the route declarations do not use.',
  ABSENCE_CLAIM_CONTESTED: 'An absence claim is contested by a token in the cited source.',
  RUBRIC_PRECONDITION_NOT_MET: 'The rubric the proposal applies requires a fact the record does not show.',
  RUBRIC_PRECEDENCE_AMBIGUOUS: 'Two rubric keys could both apply; the proposal applies the less severe one.',
  LOCAL_GUARD_RETURNS_TRUE: 'A route-local access guard returns true unconditionally.',
}

export function buildSupersessions(src, qualification, evidence) {
  const records = []
  const add = (record) => records.push({ ...record, effect: { dispositionChanged: false, severityChanged: false, historicalRecordAltered: false, acceptsAnything: false } })
  const carbonRegister = src.reg.carbon
  const exceptionTargets = src.base.exceptions.exceptions.filter((entry) => JSON.stringify(entry).includes('No table, service, persona source')).map((entry) => entry.id ?? entry.operationId)

  add({
    id: 'SUP-0C4-CARBON-SOURCE-EXISTENCE',
    kind: 'SUPERSESSION',
    title: 'The frozen statement that no source names carbon accounting is superseded by a narrower supported finding.',
    targets: [
      { ...frozenRef(src, 'carbon'), recordPath: 'priorEvidenceGap.frozenStatement', recordSha256: sha256Of(carbonRegister.priorEvidenceGap) },
      { register: 'docs/union-eyes/convergence/register/ue-route-decision-bound-exceptions.json', registerSha256: src.base.fileSha['docs/union-eyes/convergence/register/ue-route-decision-bound-exceptions.json'], recordIds: sorted(unique(exceptionTargets)) },
    ],
    supersededStatement: evidence.carbon.supersededStatement,
    supersedingFinding: evidence.carbon.narrowerSupportedFinding,
    notEstablished: evidence.carbon.notEstablished,
    evidence: { filesNamingCarbonAccounting: evidence.carbon.filesNamingCarbonAccounting.length, filesImportingACarbonService: evidence.carbon.filesImportingACarbonService, reachableFromTheFourRoutes: evidence.carbon.reachableFromTheFourRoutes },
    carriedInto: ['CERTIFICATION_CHECKLIST', 'CARBON_DECISION_DOSSIER'],
    frozenTextPreserved: true,
  })

  add({
    id: 'CLAR-0C4-PER-CAPITA-SEVERITY-RELATIONSHIP',
    kind: 'CLARIFICATION',
    title: 'The MEDIUM health-and-welfare record and the HIGH tax-path record describe separate paths over one table at one floor.',
    targets: PER_CAPITA_TARGETS(src),
    statement: evidence.perCapita.finding,
    sharedTable: evidence.perCapita.sharedTable,
    distinctExposurePaths: evidence.perCapita.records,
    carriedGap: evidence.perCapita.carriedGap,
    treatment: 'Both original records are kept as recorded. Neither severity is changed. The difference is for an authorized severity review.',
    carriedInto: ['CERTIFICATION_CHECKLIST'],
  })

  for (const challenge of src.reg.challenges.challenges) {
    add({
      id: `CLAR-0C4-${challenge.challengeId}`,
      kind: 'CLARIFICATION',
      title: `The conditional disposition of ${challenge.challengedDefectId} and the challenge to it are two separate records.`,
      targets: [{ ...frozenRef(src, 'challenges'), recordPath: `challenges[${challenge.challengeId}]`, recordSha256: sha256Of(challenge) }],
      statement: `The frozen disposition ${challenge.frozenRecord.disposition} is kept as the frozen record. The challenge ${challenge.challengeId} takes the position ${challenge.challengePosition} pending containment proof. Neither supersedes the other, the challenge is not an additional defect, and no accepted release decision exists for either.`,
      frozenDisposition: challenge.frozenRecord.disposition,
      challengePosition: challenge.challengePosition,
      carriedInto: ['CERTIFICATION_CHECKLIST'],
    })
  }

  const flagDependent = src.reg.challenges.flagDependentDispositions.filter((entry) => !entry.challenged).map((entry) => entry.defectId)
  add({
    id: 'CLAR-0C4-OPL-FLAG-DEPENDENT-UNCHALLENGED',
    kind: 'CLARIFICATION',
    title: 'Unchallenged conditional dispositions rest on the same flag assumption as the two challenged ones.',
    targets: [{ ...frozenRef(src, 'challenges'), recordPath: 'flagDependentDispositions', recordSha256: sha256Of(src.reg.challenges.flagDependentDispositions) }],
    statement: `${flagDependent.length} further conditional dispositions depend on the flag ${src.reg.challenges.flag.name}. The flag is not shown to be enforced in every release path, so the assumption that softens them is unproven. No challenge is opened here and no disposition is changed; an authorized reviewer decides whether to challenge them.`,
    defectIds: sorted(flagDependent),
    carriedInto: ['CERTIFICATION_CHECKLIST'],
  })

  add({
    id: 'CLAR-0C4-PUBLIC-EXPOSURE-ALLOWLIST',
    kind: 'CLARIFICATION',
    title: 'The three public exposure contracts rest on the handler declaration; reachability depends on the proxy allowlist.',
    targets: [{ ...frozenRef(src, 'relationships'), recordPath: 'exposures', recordSha256: sha256Of(src.reg.relationships.exposures) }],
    statement: evidence.exposures.finding,
    operations: evidence.exposures.operations.map((entry) => ({ operation: entry.operation, inProxyAllowlist: entry.inProxyAllowlist, justification: entry.allowlistJustification })),
    carriedInto: ['CERTIFICATION_CHECKLIST'],
  })

  const retentionAssessment = src.reg.assessment.assessments.find((entry) => entry.defectId === RETENTION_DEFECT)
  add({
    id: 'CLAR-0C4-RETENTION-SCHEDULER-ABSENCE',
    kind: 'CLARIFICATION',
    title: 'A repository search that finds no scheduler does not show that no retention mechanism exists.',
    targets: [{ ...frozenRef(src, 'assessment'), recordPath: `assessments[${RETENTION_DEFECT}]`, recordSha256: sha256Of(retentionAssessment) }],
    statement: `${evidence.reviewRequiredProposals.find((entry) => entry.defectId === RETENTION_DEFECT).retentionSchedulerFinding.repositorySearchFinding} The absence of a repository reference is evidence about repository content only.`,
    doesNotEstablish: evidence.reviewRequiredProposals.find((entry) => entry.defectId === RETENTION_DEFECT).retentionSchedulerFinding.doesNotEstablish,
    carriedInto: ['CERTIFICATION_CHECKLIST'],
  })

  add({
    id: 'CLAR-0C4-DOCUMENTARY-CRITERIA-PRESENTATION',
    kind: 'CLARIFICATION',
    title: 'The seven Gate 0 criteria are documentary criteria and are never displayed as certification.',
    targets: [{ ...frozenRef(src, 'closure'), recordPath: 'level1.criteriaSatisfiedByRecord', recordSha256: sha256Of(src.reg.closure.level1.criteria) }],
    statement: `The seven criteria describe whether the record is complete. They carry the label ${DOCUMENTARY_LABEL}. Independent Gate 0 certification, persona ratification, institutional authority decisions, release authorization and production readiness are recorded separately and none is satisfied by them.`,
    carriedInto: ['CERTIFICATION_CHECKLIST', 'GATE_0_REPORT'],
  })

  const byId = new Map(qualification.items.map((item) => [item.defectId, item]))
  const assessmentById = new Map(src.reg.assessment.assessments.map((entry) => [entry.defectId, entry]))
  for (const item of qualification.items) {
    for (const found of item.independentFindings) {
      if (!CLAIM_CODES[found.code] || found.severity === 'INFO') continue
      add({
        id: `CLAR-0C4-${item.defectId}-${found.code}`,
        kind: 'CLARIFICATION',
        title: CLAIM_CODES[found.code],
        targets: [{ ...frozenRef(src, 'assessment'), recordPath: `assessments[${item.defectId}]`, recordSha256: sha256Of(assessmentById.get(item.defectId)) }],
        defectId: item.defectId,
        findingCode: found.code,
        statement: found.statement,
        proposedDisposition: item.proposedDisposition.value,
        proposalState: byId.get(item.defectId).proposedDisposition.state,
        dispositionSensitivity: item.dispositionSensitivity,
        carriedInto: ['QUALIFICATION_REGISTER'],
      })
    }
  }

  records.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return {
    ...header('UE-SUPERSESSION-CLARIFICATION', 'RECORDS_NOT_ACCEPTANCE', 'Explicit supersession and clarification records. Each names the frozen record it concerns by hash. No frozen record is edited, and the Gate 0C.3 registers are byte-identical to the accepted commit.'),
    historyAnchor: { commit: ANCHOR_0C3_COMMIT, rule: 'Every target register hash equals the hash of that register at the anchor commit and at the working tree.' },
    totals: { records: records.length, byKind: tally(records.map((record) => record.kind)), unsupportedClaimRecords: records.filter((record) => record.findingCode).length },
    records,
  }
}

function PER_CAPITA_TARGETS(src) {
  const defects = new Map(src.base.classification.defectRegister.map((defect) => [defect.id, defect]))
  return [PER_CAPITA.mediumDefect, PER_CAPITA.highDefect].map((id) => ({
    register: 'docs/union-eyes/convergence/register/ue-route-classification-0c1.json',
    registerSha256: src.base.fileSha['docs/union-eyes/convergence/register/ue-route-classification-0c1.json'],
    recordIds: [id],
    recordSha256: sha256Of(defects.get(id)),
  }))
}

export function buildProductDossier(src) {
  const records = new Map(src.base.productDecisions.records.map((record) => [record.persona, record]))
  const productDecisions = src.reg.decisions.decisions.filter((decision) => decision.ownerRole === 'AUTHORIZED_PRODUCT_OWNER' && decision.family !== 'PERSONA_RATIFICATION')
  const listedBy = {}
  for (const record of src.base.productDecisions.records) for (const id of record.productDecisionsToSettle) (listedBy[id] ??= []).push(record.recordId)
  const personas = Object.entries(PERSONA_PACKAGES).map(([persona, file]) => {
    const pkg = src.persona[persona].json
    const record = records.get(persona)
    const settles = record.productDecisionsToSettle.filter((id) => id.startsWith('DEC-PD'))
    const institutionalListed = record.productDecisionsToSettle.filter((id) => !id.startsWith('DEC-PD'))
    const gaps = pkg.knownSourceGaps.sourceGaps
    return {
      persona,
      recordId: record.recordId,
      proposedCanonical: { packageId: pkg.packageId, version: pkg.version, file, sha256: src.persona[persona].sha256 },
      currentState: record.state,
      decisionOwnerRole: record.decisionOwnerRole,
      selfRatification: record.selfRatification,
      approvalEvidenceOnFile: record.approvalEvidence,
      decisionsAvailable: pkg.approvalOptions.map((option) => ({ option: option.id, resultingState: option.resultingState, effect: option.effect })),
      requiredApprovalEvidence: src.base.productDecisions.approvalEvidenceSchema.required,
      productDecisionsToSettle: settles,
      listedInstitutionalAuthorityDecisions: institutionalListed,
      institutionalBoundary: 'The decision identifiers beginning DEC-IA are institutional authority decisions. Approving the package cannot settle, adopt or issue them; they stay outstanding.',
      decisionsSharedWithOtherPersonaRecords: settles.filter((id) => listedBy[id].length > 1).map((id) => ({ decisionId: id, listedBy: sorted(listedBy[id]) })),
      dependsOnPersonas: sorted(unique(pkg.dependenciesOnOtherPersonas.map((entry) => `${entry.onPersona} via ${entry.via}`))),
      evidenceStillUnavailable: gaps.map((gap) => ({ gapId: gap.id, kind: gap.kind, statement: gap.statement })),
      productApprovalDoesNot: pkg.productApprovalDoesNot,
      claims: pkg.claims,
    }
  })
  const structure = src.structure.json
  return {
    ...header('UE-PRODUCT-RATIFICATION-DOSSIER', 'PREPARED_FOR_DECISION_NOT_DECIDED', 'A dossier for the authorized product owner. It states what each decision would do and what it depends on. It decides nothing, ratifies nothing and carries no approval.'),
    separation: 'A product ratification fixes a product-specification baseline only. It cannot issue an institutional permission, mandate, office, delegation or authority decision, and it changes no implementation, security, release or runtime status.',
    personas,
    stewardStructure: {
      decisionId: structure.decisionId,
      options: structure.options.map((option) => ({ optionId: option.id, title: option.title })),
      preparerRecommendation: structure.recommendation.optionId,
      recommendationOnly: true,
      selected: structure.selected,
      ratified: structure.ratified,
      effectOfRecommendation: 'The recommendation is not a selection. If the product owner selects another option, the Steward package is returned or rejected rather than approved as written.',
      changesBaselineProposal: structure.recommendation.changesBaselineProposal,
    },
    ratificationOrder: {
      dependency: 'The Steward structure decision and DEC-PD-01 are listed by more than one persona record, and DEC-PD-0C2-10 asks for the order of product acceptance.',
      sharedDecisions: sorted(unique(personas.flatMap((persona) => persona.decisionsSharedWithOtherPersonaRecords.map((entry) => entry.decisionId)))),
      preparerSequencingOpinion: null,
    },
    outstandingProductDecisions: {
      count: productDecisions.length,
      byFamily: tally(productDecisions.map((decision) => decision.family)),
      items: productDecisions.map((decision) => ({
        decisionId: decision.decisionId,
        family: decision.family,
        title: decision.title,
        question: decision.question,
        personas: decision.dependents.personas,
        settledByRecords: sorted(listedBy[decision.decisionId] ?? []),
        currentState: decision.currentState,
        adopted: false,
        decisionRequested: 'Settle or explicitly defer this decision through approval, rejection or return of each persona record that lists it.',
      })),
    },
    institutionalBoundary: {
      outstandingInstitutionalDecisions: src.reg.decisions.totals.institutionalRecords,
      statement: 'None of the institutional decisions is settled by a product ratification. They are carried in the institutional decision dossier.',
      productRatificationIssuesInstitutionalPermissions: false,
    },
    approvalFieldsFilled: 0,
  }
}

export const THEME_RULES = [
  ['CARBON_SCOPE', 'carbon'],
  ['CROSS_ORGANIZATION_DISCLOSURE', 'cross[- ](?:tenant|organization|org)|another organization|other organizations|across organizations|shared (?:library|dataset|across)|platform[- ](?:operator|staff|role)|source[- ]organization|benchmark|federation|affiliate|parent body|clc|directory'],
  ['CASE_MEMBER_DOCUMENT_CONFIDENTIALITY', 'confidential|privileg|grievance|\\bcase\\b|member (?:data|record|file|information)|personal|document|attachment|medical|accommodation|disclos|retention|privacy|anonym|survey|notes?\\b|evidence|communicat'],
  ['FINANCIAL_MANDATE_AND_SENSITIVE_RECORDS', 'financ|mandate|treasur|remittance|dues|payment|invoice|per-capita|billing|ledger|strike fund|audit|payroll|pension|tax'],
  ['EXTERNAL_PROCESSOR_AND_CONSENT', 'processor|vendor|third[- ]party|consent|external|\\bai\\b|model|provider|oauth|calendar|webhook|integration|e-?mail|sms|stripe|docusign|whop|shopify|azure|geolocation|location'],
]
const THEME_PATTERNS = THEME_RULES.map(([theme, source]) => [theme, new RegExp(source, 'i')])

export function themeOf(decision) {
  const text = `${decision.decisionId} ${decision.question}`
  const hits = THEME_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([theme]) => theme)
  return { primary: hits[0] ?? 'OTHER', secondary: hits.slice(1) }
}

export function buildInstitutionalDossier(src) {
  const institutional = src.reg.decisions.decisions.filter((decision) => decision.ownerRole === 'INSTITUTION_TO_BE_NAMED')
  const carbonOps = new Set(CARBON_OPERATIONS)
  const items = institutional.map((decision) => {
    const theme = themeOf(decision)
    const required = decision.decisionId === CARBON_DECISION_ID || decision.dependents.operations.some((operation) => carbonOps.has(operation))
    return {
      decisionId: decision.decisionId,
      family: decision.family,
      theme: theme.primary,
      secondaryThemes: theme.secondary,
      priority: THEMES.indexOf(theme.primary) + 1,
      question: decision.question,
      originalState: decision.currentState,
      originalIdentifierRetained: true,
      scopeLockDisposition: required ? 'REQUIRED_BEFORE_CERTIFICATION' : 'DEFERRED_NON_AUTHORIZING',
      dispositionBasis: required
        ? 'The decision determines whether four classified operations are owned, retired or kept as decision-bound scope exceptions, so the scope cannot be certified while it is open.'
        : 'The decision governs who may use an in-scope capability. The scope lock describes and owns the operations and does not authorize their use, so the decision may stay open under the non-authorizing disposition.',
      nonAuthorizingTreatment: required ? null : 'The dependent operations stay classified with an engineering owner and a non-authorizing contract. The capability stays deny-by-default. No permission, mandate, delegation, office or instrument is issued or implied.',
      adopted: false,
      closedByThisDossier: false,
      grantsInstitutionalAuthority: false,
      releaseBlocking: decision.blocks.release,
      dependentOperations: decision.dependents.operationCount,
      dependentDebtItems: decision.dependents.debtItemIds.length,
      requiredApprovalEvidence: decision.requiredApprovalEvidence,
      consequenceOfDeferral: decision.consequenceOfDeferral,
    }
  })
  items.sort((a, b) => a.priority - b.priority || (a.decisionId < b.decisionId ? -1 : a.decisionId > b.decisionId ? 1 : 0))
  const required = items.filter((item) => item.scopeLockDisposition === 'REQUIRED_BEFORE_CERTIFICATION')
  const deferred = items.filter((item) => item.scopeLockDisposition === 'DEFERRED_NON_AUTHORIZING')
  const carbon = src.reg.carbon
  return {
    ...header('UE-INSTITUTIONAL-DECISION-DOSSIER', 'PREPARED_FOR_DECISION_NOT_DECIDED', 'A dossier for the institutional deciding authorities. It keeps every outstanding decision and its original identifier, orders them by the priority themes and states which may stay open under an explicitly non-authorizing scope-lock disposition. It adopts nothing and grants no authority.'),
    deferralIsNotAdoption: 'A non-authorizing scope-lock disposition records that a decision stays open without blocking the documentary scope lock. It is not adoption, not approval and not acceptance of release risk, and the decision keeps its OUTSTANDING state.',
    themeRules: { basis: 'KEYWORD_PRIORITISATION_NOT_A_DECISION', order: THEMES, rules: THEME_RULES.map(([theme, source]) => ({ theme, pattern: source })) },
    totals: {
      institutionalDecisions: items.length,
      byTheme: tally(items.map((item) => item.theme)),
      byFamily: tally(items.map((item) => item.family)),
      requiredBeforeCertification: required.length,
      deferredNonAuthorizing: deferred.length,
      deferredAndReleaseBlocking: deferred.filter((item) => item.releaseBlocking === 'YES').length,
      adopted: 0,
      grantsInstitutionalAuthority: 0,
    },
    requiredBeforeCertification: required.map((item) => item.decisionId),
    carbonDecision: {
      decisionId: CARBON_DECISION_ID,
      question: carbon.question,
      options: carbon.options.map((option) => option.id),
      preparerRecommendation: carbon.recommendation.optionId,
      recommendationOnly: true,
      selected: carbon.selected,
      scopeExceptionOperations: CARBON_OPERATIONS,
      exceptionsOwned: false,
      exceptionsAuthorized: false,
      carriedFinding: 'SUP-0C4-CARBON-SOURCE-EXISTENCE',
      whyBeforeCertification: 'The four operations are decision-bound scope exceptions that no engineering capability owns. A certified scope cannot contain four operations whose ownership is unresolved.',
      obligationRegardlessOfOption: carbon.preservedObligation.obligation,
    },
    decisions: items,
  }
}

export function buildCertification(src, parts) {
  const debtIds = sorted(src.reg.debt.items.map((item) => item.itemId))
  const criteria = src.reg.closure.level1.criteria.map((criterion) => ({ id: criterion.id, label: criterion.label, state: criterion.state, remainingItems: criterion.remainingItems }))
  const required = parts.institutional.requiredBeforeCertification
  const personas = parts.product.personas
  const checks = [
    {
      id: 'CL-1',
      check: 'DOCUMENTARY_SCOPE_COMPLETENESS',
      tier: 'DOCUMENTARY',
      requirement: 'Every route-method operation has one classification, every defect and obligation has an owner, and every unresolved decision is listed. The counts reconcile.',
      state: 'SATISFIED_BY_RECORD',
      evidenceKind: 'RECORD_DERIVED',
      sufficientAlone: false,
      note: 'Reconciling counts shows the record is complete. It shows nothing about whether the record is right, approved or safe.',
    },
    {
      id: 'CL-2',
      check: 'INDEPENDENT_EVIDENCE_QUALIFICATION',
      tier: 'AUTHORITY_INDEPENDENT_REVIEW',
      requirement: 'An authority-independent reviewer accepts or contests the Gate 0C.3 and Gate 0C.4 evidence and names the artifact hashes reviewed.',
      state: 'NOT_SATISFIED',
      evidenceKind: 'AUTHORITY_EVIDENCE',
      methodIndependentReviewCompleted: true,
      authorityIndependentReviewOnFile: false,
      openQualifyingFindings: parts.qualification.totals.withQualifyingOrChallengeFinding,
      note: 'The Gate 0C.4 review is independent in method only. It is not an authority-independent approval and cannot satisfy this item.',
    },
    {
      id: 'CL-3',
      check: 'PRODUCT_SPECIFICATION_RATIFICATION',
      tier: 'AUTHORIZED_PRODUCT_OWNER',
      requirement: 'An authorized product owner approves, rejects or returns each of the three persona canonicals with the approval evidence the Gate 0C.2 schema requires.',
      state: 'NOT_SATISFIED',
      evidenceKind: 'AUTHORITY_EVIDENCE',
      personasRequired: personas.map((persona) => persona.persona),
      personasRatified: 0,
      note: 'A product ratification fixes a specification baseline only and issues no institutional permission.',
    },
    {
      id: 'CL-4A',
      check: 'DEFERRED_DECISIONS_NON_AUTHORIZING',
      tier: 'DOCUMENTARY',
      requirement: 'Every institutional decision that is not decided carries an explicit non-authorizing scope-lock disposition, keeps its identifier and stays OUTSTANDING.',
      state: 'SATISFIED_BY_RECORD',
      evidenceKind: 'RECORD_DERIVED',
      deferred: parts.institutional.totals.deferredNonAuthorizing,
      sufficientAlone: false,
      note: 'Deferral is not adoption and is not acceptance of release risk.',
    },
    {
      id: 'CL-4B',
      check: 'REQUIRED_INSTITUTIONAL_DECISIONS_ADOPTED',
      tier: 'INSTITUTIONAL_AUTHORITY',
      requirement: 'Each institutional decision marked REQUIRED_BEFORE_CERTIFICATION is adopted by the deciding authority with an adopted decision record.',
      state: 'NOT_SATISFIED',
      evidenceKind: 'AUTHORITY_EVIDENCE',
      decisionsRequired: required,
      decisionsAdopted: 0,
      note: 'No institutional decision record format is adopted in the repository, so none exists.',
    },
    {
      id: 'CL-5',
      check: 'EXCEPTION_GOVERNANCE_ACCEPTED',
      tier: 'INSTITUTIONAL_AUTHORITY',
      requirement: 'The four decision-bound carbon scope exceptions and the three public exposure contracts are accepted, owned or retired by an authority.',
      state: 'NOT_SATISFIED',
      evidenceKind: 'AUTHORITY_EVIDENCE',
      exceptions: CARBON_OPERATIONS,
      exposureContracts: EXPOSURE_OPERATIONS,
      exceptionsOwned: 0,
      exceptionsAuthorized: 0,
      note: 'A carbon exception is non-authorizing. It is not owned, authorized or counted as owned.',
    },
    {
      id: 'CL-6',
      check: 'DOWNSTREAM_RELEASE_OBLIGATIONS_CARRIED',
      tier: 'DOCUMENTARY',
      requirement: 'Every release-debt item is carried once, with an owner and a target gate, and none is dropped or counted twice.',
      state: 'SATISFIED_BY_RECORD',
      evidenceKind: 'RECORD_DERIVED',
      sufficientAlone: false,
      note: 'Carrying an obligation is not discharging it.',
    },
    {
      id: 'CL-7',
      check: 'ACTUAL_RELEASE_READINESS',
      tier: 'RELEASE',
      requirement: 'Release readiness is decided by the release gate and is outside Gate 0 certification.',
      state: 'NO_GO',
      evidenceKind: 'NOT_PART_OF_GATE_0',
      canBeSatisfiedByGate0Certification: false,
      rulingDocument: 'docs/union-eyes/reality-remediation/25_UE_SAAS_OPERATIONAL_READINESS_RERUN.md',
    },
  ].map((item) => ({ ...item, authorityEvidence: null }))
  const model = {
    ...header('UE-GATE0-CERTIFICATION-MODEL', 'MODEL_NOT_A_VERDICT', 'The Gate 0 completion presentation and the deterministic certification checklist. Documentary completeness is shown as documentary only. The checklist is evaluated by a pure function that cannot grant certification from counts and cannot convert a scope-lock decision into a release or production decision.'),
    gate0Verdict: 'IN_PROGRESS',
    presentation: {
      ...PRESENTATION,
      documentaryCriteria: { label: DOCUMENTARY_LABEL, satisfiedByRecord: criteria.filter((criterion) => criterion.state === 'SATISFIED_BY_RECORD').length, of: criteria.length, criteria },
      displayRule: 'Any statement that the seven criteria are satisfied must carry the label DOCUMENTARY_SCOPE_RECORD_COMPLETE or the word documentary, and must be accompanied by the five qualifiers recorded beside it.',
    },
    checklist: {
      checks: CERTIFICATION_CHECKS,
      items: checks,
      grantRules: [
        'Certification may be decided only when CL-1, CL-4A and CL-6 are satisfied by record and CL-2, CL-3, CL-4B and CL-5 each carry authority evidence.',
        'Authority evidence names a decision maker who is independent of the preparer, a date, the exact artifact hash and a hashed evidence document.',
        'CL-7 cannot be satisfied by a Gate 0 certification. A certification decision never authorizes a release, never changes the readiness ruling and never starts Gate 1 or Phase 3B.',
        'Reconciling counts is never sufficient.',
      ],
      certificationDecision: { granted: false, scope: 'GATE_0_SCOPE_LOCK_ONLY', decidedBy: null, decidedOn: null, artifactSha256: null, evidenceDocumentSha256: null, impliesReleaseAuthorization: false, impliesProductionGo: false },
    },
    downstreamObligations: {
      debtIndexFile: FILES_0C3.debt,
      debtIndexSha256: src.regSha.debt,
      itemCount: debtIds.length,
      itemIds: debtIds,
      handoffObligations: src.reg.debt.handoffObligations.map((entry) => entry.obligationId),
      proposedDispositionsAwaitingAcceptance: parts.qualification.totals.assessed,
      challenges: CHALLENGE_IDS,
      challengedDefects: OPL_DEFECTS,
      publicExposureOperations: EXPOSURE_OPERATIONS,
      carbonExceptions: CARBON_OPERATIONS,
      carriedOnce: true,
    },
    counts: {
      operations: src.base.matrix.routeInventoryTotals.operations,
      highDefectsQualified: parts.qualification.totals.assessed,
      institutionalDecisions: parts.institutional.totals.institutionalDecisions,
      productDecisions: parts.product.outstandingProductDecisions.count,
      personaRatifications: personas.length,
    },
  }
  model.evaluation = evaluateCertification(model)
  model.remainingBlockers = model.evaluation.unmet.map((id) => {
    const item = model.checklist.items.find((entry) => entry.id === id)
    return { id, check: item.check, tier: item.tier, requirement: item.requirement }
  })
  return model
}

const AUTHORITY_FIELDS = ['decidedBy', 'decidedOn', 'artifactSha256', 'evidenceDocumentSha256']

/**
 * The only function that decides whether a certification decision could be considered. It reads the checklist and
 * nothing else. Counts, documents and presentation labels do not enter it.
 */
export function evaluateCertification(model) {
  const unmet = []
  const reasons = {}
  for (const item of model.checklist.items) {
    if (item.evidenceKind === 'NOT_PART_OF_GATE_0') continue
    let met
    if (item.evidenceKind === 'RECORD_DERIVED') met = item.state === 'SATISFIED_BY_RECORD'
    else {
      const evidence = item.authorityEvidence
      met = item.state === 'SATISFIED_BY_AUTHORITY' && evidence !== null && evidence.authorityIndependent === true && AUTHORITY_FIELDS.every((field) => typeof evidence[field] === 'string' && evidence[field].length > 0)
    }
    if (!met) {
      unmet.push(item.id)
      reasons[item.id] = item.evidenceKind === 'RECORD_DERIVED' ? 'The record-derived item is not satisfied by record.' : 'The item has no authority-independent evidence with a decision maker, a date and artifact hashes.'
    }
  }
  const authorityItems = model.checklist.items.filter((item) => item.evidenceKind === 'AUTHORITY_EVIDENCE')
  return {
    unmet,
    reasons,
    eligibleForCertificationDecision: unmet.length === 0 && authorityItems.length > 0,
    certificationGranted: false,
    impliesReleaseAuthorization: false,
    impliesProductionGo: false,
    readinessUnchanged: 'NO_GO',
  }
}

export function buildAll(src) {
  const reader = recordingReader(src.app)
  const qualification = qualifyAll(src, reader)
  const qualificationRegister = buildQualification(src, qualification)
  const evidence = buildEvidence(src, qualification, reader)
  evidence.conditionalProposals.count = evidence.conditionalProposals.items.length
  const supersessions = buildSupersessions(src, qualification, evidence)
  const product = buildProductDossier(src)
  const institutional = buildInstitutionalDossier(src)
  const certification = buildCertification(src, { qualification, product, institutional })
  return { qualification: qualificationRegister, evidence, supersessions, certification, product, institutional }
}
