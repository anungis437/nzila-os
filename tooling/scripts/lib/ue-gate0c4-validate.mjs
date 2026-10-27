/**
 * Validator for the Gate 0C.4 registers. Each problem starts with a stable code so a negative test can name the failure it
 * expects. The registers are checked against the live sources, against the accepted Gate 0C.3 commit, and last against a
 * full regeneration, so a mutation that no specific rule names still surfaces as drift.
 */
import { createHash } from 'node:crypto'
import { CARBON_DECISION_ID, CARBON_OPERATIONS, CHALLENGE_IDS, EXPOSURE_OPERATIONS, FILES_0C3, DOCS_0C3 } from './ue-gate0c3-ids.mjs'
import {
  ANCHOR_0C3_COMMIT,
  CERTIFICATION_CHECKS,
  DOCS_0C4,
  DOCUMENTARY_LABEL,
  FILES_0C4,
  GATE_ID,
  MATRIX_FILE,
  OVERBROAD_CLAIMS,
  PRESENTATION,
  REVIEWER_ROLE,
  REVIEW_INDEPENDENCE,
  REVIEW_STATUSES,
  SCOPE_LOCK_DISPOSITIONS,
} from './ue-gate0c4-ids.mjs'
import { buildAll, evaluateCertification, serialize, sha256Of, sorted, unique } from './ue-gate0c4-reconcile.mjs'
import { renderDocs } from './ue-gate0c4-render.mjs'

export const PIN_KEY = 'qualification0c4'
export const REPORT_FILE = 'docs/union-eyes/convergence/GATE_0_SCOPE_LOCK_REPORT.md'

const FORBIDDEN_STATUS = /"(status|state|implementationStatus|runtimeQualification|verdict|releaseEffect)"\s*:\s*"(complete|completed|green|ready|delivered|PROVEN_IN_STAGING|APPROVED|ACCEPTED|ADOPTED|GO)"/i
const PRODUCTION_GO = /"(productionGo|releaseGranted|releaseAuthorized)"\s*:\s*true|"releaseAuthorization"\s*:\s*"(GRANTED|AUTHORIZED)"|\bProduction GO: true\b|\bRelease authorization: (GRANTED|AUTHORIZED)\b/i
const CRITERIA_SATISFIED = /\b(?:7|seven) of (?:7|seven)\b|\b(?:7|seven) (?:record |documentary )?criteria\b[^.]*\b(?:satisfied|met|complete)/i
const REVIEW_KEYS = ['reviewerRole', 'independence', 'authorityIndependent']
const EFFECT_KEYS = ['dispositionChanged', 'severityChanged', 'historicalRecordAltered', 'acceptsAnything']
const REQUIRED_RECORDS = [
  'SUP-0C4-CARBON-SOURCE-EXISTENCE',
  'CLAR-0C4-PER-CAPITA-SEVERITY-RELATIONSHIP',
  'CLAR-0C4-CHALLENGE-0B10-OPL-01',
  'CLAR-0C4-CHALLENGE-0B10-OPL-07',
  'CLAR-0C4-OPL-FLAG-DEPENDENT-UNCHALLENGED',
  'CLAR-0C4-PUBLIC-EXPOSURE-ALLOWLIST',
  'CLAR-0C4-RETENTION-SCHEDULER-ABSENCE',
  'CLAR-0C4-DOCUMENTARY-CRITERIA-PRESENTATION',
]

/** A broad claim may be quoted only to mark it superseded; a certification phrase may be quoted only to deny or forbid it. */
const qualifiedFor = (pattern) => (pattern.source.includes('carbon') ? /\b(?:superseded|frozen)\b/i : /\b(?:not|never|cannot|must|forbidden)\b/i)
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const sha = (text) => createHash('sha256').update(text).digest('hex')

function strings(value, out = []) {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) for (const item of value) strings(item, out)
  else if (value && typeof value === 'object') for (const item of Object.values(value)) strings(item, out)
  return out
}

/** Paragraphs of a document or the string values of a register. A claim is judged inside its own paragraph. */
const paragraphsOf = (text) => text.split(/\n\s*\n/)

function reviewProblems(review, label, problems) {
  if (review?.reviewerRole !== REVIEWER_ROLE || review?.independence !== REVIEW_INDEPENDENCE || review?.authorityIndependent !== false) {
    problems.push(`FALSE-INDEPENDENCE: ${label} records review provenance other than ${REVIEW_INDEPENDENCE} by ${REVIEWER_ROLE} with authorityIndependent false`)
  }
  if (REVIEW_KEYS.some((key) => !(key in (review ?? {})))) problems.push(`FALSE-INDEPENDENCE: ${label} omits a provenance field`)
}

export function validateQualification0c4({ registers, src, docs, readText: readRaw, liveFileSha }) {
  const problems = []
  const readText = readRaw
    ? (file) => {
        try {
          return readRaw(file)
        } catch {
          return null
        }
      }
    : null
  const keys = Object.keys(FILES_0C4)
  const missing = keys.filter((key) => !registers?.[key])
  if (missing.length > 0) return [`REGISTER-ABSENT: ${missing.map((key) => FILES_0C4[key]).join(', ')} missing`]
  const { qualification, evidence, supersessions, certification, product, institutional } = registers

  let expected
  try {
    expected = buildAll(src)
  } catch (error) {
    return [`BUILD-FAILED: the registers cannot be regenerated from the sources: ${error.message}`]
  }

  // History: nothing at or before the accepted Gate 0C.3 commit changed.
  const history = src.history
  if (!history?.matrix || Object.values(history.registers ?? {}).some((entry) => entry.sha256 === null)) problems.push(`HISTORY-ABSENT: the accepted Gate 0C.3 commit ${ANCHOR_0C3_COMMIT.slice(0, 12)} is not available for comparison`)
  else {
    for (const [key, file] of Object.entries(FILES_0C3)) {
      const live = liveFileSha ? liveFileSha(file) : src.regSha?.[key]
      if (live !== history.registers[key].sha256) problems.push(`HISTORY-MUTATED: ${file} differs from the accepted Gate 0C.3 commit and carries no supersession record`)
      if (src.regSha?.[key] !== history.registers[key].sha256) problems.push(`HISTORY-MUTATED: the loaded ${key} register differs from the accepted Gate 0C.3 commit`)
    }
    for (const file of Object.values(DOCS_0C3)) {
      const text = readText ? readText(file) : null
      if (text !== null && history.docs[file]?.sha256 !== sha(text)) problems.push(`HISTORY-MUTATED: ${file} differs from the accepted Gate 0C.3 commit and carries no supersession record`)
    }
    const liveMatrix = JSON.parse(JSON.stringify(src.base.matrix))
    delete liveMatrix[PIN_KEY]
    if (!same(liveMatrix, history.matrix)) problems.push('HISTORY-MUTATED: the matrix differs from the accepted Gate 0C.3 matrix in more than the Gate 0C.4 pin')
    if (src.base.matrix.gate0Verdict !== 'IN_PROGRESS') problems.push(`GATE0-AS-GO: the Gate 0 verdict is ${src.base.matrix.gate0Verdict}, not IN_PROGRESS`)
  }

  // The 71 qualifications: proposals stay proposals, review provenance is honest, no runtime evidence is invented.
  const queueIds = (src.base.queue?.entries ?? []).map((entry) => entry.defectId)
  const assessments = src.reg.assessment.assessments
  const qualified = qualification.qualifications ?? []
  if (!same(qualified.map((item) => item.defectId), queueIds) || queueIds.length !== 71) problems.push(`QUALIFICATION-INCOMPLETE: ${qualified.length} qualifications for ${queueIds.length} queued defects, expected all 71 in queue order`)
  reviewProblems(qualification.review, 'the qualification register', problems)
  reviewProblems(evidence.review, 'the evidence register', problems)
  if (qualification.lineage?.assessmentSha256 !== src.regSha?.assessment) problems.push('HISTORY-MUTATED: the qualification lineage pins an assessment register that is not the Gate 0C.3 file')
  for (const item of qualified) {
    const label = item.defectId
    const assessment = assessments.find((entry) => entry.defectId === label)
    const disposition = item.proposedDisposition ?? {}
    if (assessment && item.assessmentRecordSha256 !== sha256Of(assessment)) problems.push(`HISTORY-MUTATED: ${label} qualification pins an assessment record that is not the Gate 0C.3 record`)
    if (disposition.state !== 'PROPOSED_NOT_ACCEPTED' || disposition.acceptedBy !== null || disposition.acceptedOn !== null || item.review?.approval !== null || item.review?.acceptedBy !== null || item.review?.acceptedOn !== null) problems.push(`DISPOSITION-AS-ACCEPTED: ${label} proposed disposition is recorded as accepted or approved`)
    if (assessment && disposition.value !== assessment.proposedDisposition.value) problems.push(`DISPOSITION-AS-ACCEPTED: ${label} disposition ${disposition.value} differs from the proposal ${assessment.proposedDisposition.value}`)
    if (disposition.severityChanged !== false) problems.push(`SEVERITY-CHANGED: ${label} records a severity change`)
    reviewProblems(item.review, label, problems)
    if (!REVIEW_STATUSES.includes(item.reviewStatus)) problems.push(`FALSE-INDEPENDENCE: ${label} review status ${item.reviewStatus} is not in the vocabulary`)
    if ((item.executedProof ?? []).length > 0 || item.runtimeEvidence !== null) problems.push(`FABRICATED-RUNTIME-EVIDENCE: ${label} records executed proof or runtime evidence that no run produced`)
    if (item.runtimeDependency?.required === true && item.reviewStatus !== 'REQUIRES_RUNTIME_PROOF') problems.push(`FABRICATED-RUNTIME-EVIDENCE: ${label} depends on runtime proof and reports ${item.reviewStatus}`)
    if (item.reviewStatus === 'REQUIRES_RUNTIME_PROOF' && item.runtimeDependency?.required !== true) problems.push(`FABRICATED-RUNTIME-EVIDENCE: ${label} reports a runtime need with no named runtime proof`)
  }
  if (qualification.status !== 'QUALIFICATION_NOT_ACCEPTANCE' || qualification.totals?.accepted !== 0 || qualification.totals?.executedProofs !== 0) problems.push('DISPOSITION-AS-ACCEPTED: the qualification register reports accepted dispositions or executed proofs')
  if (evidence.status !== 'QUALIFICATION_NOT_ACCEPTANCE') problems.push('DISPOSITION-AS-ACCEPTED: the evidence register is not recorded as a qualification and not an acceptance')
  if (!same(qualification.totals?.byProposedDisposition, { CONDITIONALLY_BLOCKING: 25, RELEASE_BLOCKING: 43, REVIEW_REQUIRED: 3 })) problems.push('DEBT-DROPPED: the proposed-disposition totals differ from the 43, 25 and 3 of Gate 0C.3')

  // Evidence register.
  for (const challenge of evidence.challenges?.challenges ?? []) {
    if (challenge.supersedesFrozenDisposition !== false || challenge.isAdditionalDefect !== false || challenge.executedProofOnFile !== 0) problems.push(`FABRICATED-RUNTIME-EVIDENCE: ${challenge.challengeId} is recorded as superseding the frozen disposition, as a defect, or as proven`)
  }
  if (!same((evidence.challenges?.challenges ?? []).map((challenge) => challenge.challengeId), CHALLENGE_IDS)) problems.push('HISTORY-MUTATED: the evidence register does not list both OPL challenges')
  if (!same((evidence.exposures?.operations ?? []).map((operation) => operation.operation), EXPOSURE_OPERATIONS)) problems.push('DEBT-DROPPED: the evidence register does not list the three public exposures')
  for (const operation of evidence.exposures?.operations ?? []) if (operation.statuses?.publicReachability !== 'REQUIRES_RUNTIME_PROOF') problems.push(`FABRICATED-RUNTIME-EVIDENCE: ${operation.operation} states public reachability without runtime proof`)
  if (evidence.perCapita?.severityChanged !== false || evidence.perCapita?.reratedHere !== false) problems.push('SEVERITY-CHANGED: the per-capita relationship records a severity change')
  const carbon = evidence.carbon ?? {}
  if (carbon.status !== 'PARTIALLY_VERIFIED' || (carbon.reachableFromTheFourRoutes ?? []).length > 0 || carbon.narrowerFindingHolds !== true) problems.push('CARBON-AUTHORIZED: the carbon evidence is recorded as more than a partially verified, non-authorizing finding')
  const dedup = evidence.deduplication ?? {}
  if (dedup.matches !== true || dedup.uniqueRecomputed !== 150 || dedup.indexedItems !== 150 || (dedup.overlapsBetweenGroups ?? []).length > 0 || dedup.indexedItemsDuplicated !== 0 || (dedup.missingFromIndex ?? []).length > 0) problems.push('DEBT-DOUBLE-COUNTED: the deduplication record does not show 150 unique items counted once')
  const pinned = new Map((evidence.sourceBlobs ?? []).map((entry) => [entry.file, entry.sha256]))
  const wanted = new Map(expected.evidence.sourceBlobs.map((entry) => [entry.file, entry.sha256]))
  for (const [file, digest] of wanted) if (pinned.get(file) !== digest) problems.push(`SOURCE-DRIFT: ${file} no longer has the content the evidence register pins`)
  for (const file of pinned.keys()) if (!wanted.has(file)) problems.push(`SOURCE-DRIFT: the evidence register pins ${file}, which the review no longer reads`)

  // Supersession and clarification records.
  const records = supersessions.records ?? []
  const recordIds = records.map((record) => record.id)
  if (unique(recordIds).length !== recordIds.length) problems.push('DEBT-DOUBLE-COUNTED: two supersession records share an identifier')
  for (const id of REQUIRED_RECORDS) if (!recordIds.includes(id)) problems.push(`SUPERSESSION-MISSING: ${id} is absent`)
  for (const id of expected.supersessions.records.map((record) => record.id)) if (!recordIds.includes(id)) problems.push(`SUPERSESSION-MISSING: ${id} is absent although a finding requires it`)
  for (const record of records) {
    if (!(record.targets ?? []).length) problems.push(`SUPERSESSION-MISSING: ${record.id} names no frozen record`)
    for (const target of record.targets ?? []) {
      const key = Object.keys(FILES_0C3).find((name) => FILES_0C3[name] === target.register)
      const anchor = key ? history?.registers?.[key]?.sha256 : history?.fileSha?.[target.register]
      const now = key ? src.regSha?.[key] : src.base.fileSha?.[target.register]
      if (!anchor || target.registerSha256 !== anchor || target.registerSha256 !== now) problems.push(`HISTORY-MUTATED: ${record.id} targets ${target.register} with a hash that is not the register at the anchor commit and now`)
    }
    if (!same(Object.keys(record.effect ?? {}), EFFECT_KEYS) || EFFECT_KEYS.some((key) => record.effect[key] !== false)) problems.push(`HISTORY-MUTATED: ${record.id} changes a disposition, a severity or a historical record or accepts something`)
  }
  if (supersessions.historyAnchor?.commit !== ANCHOR_0C3_COMMIT) problems.push('HISTORY-MUTATED: the supersession records anchor a commit other than the accepted Gate 0C.3 commit')

  // Product dossier: decide nothing.
  const sourceRecords = src.base.productDecisions?.records ?? []
  if ((product.personas ?? []).length !== 3 || sourceRecords.length !== 3) problems.push('PERSONA-MARKED-RESOLVED: the product dossier does not cover exactly the three persona records')
  for (const persona of product.personas ?? []) {
    const record = sourceRecords.find((entry) => entry.recordId === persona.recordId)
    if (!record || persona.currentState !== record.state || persona.currentState !== 'PROPOSED_FOR_RATIFICATION') problems.push(`PERSONA-MARKED-RESOLVED: ${persona.persona} is ${persona.currentState} in the dossier and ${record?.state} in its record`)
    if (persona.selfRatification !== false || persona.approvalEvidenceOnFile !== null || persona.claims?.productSpecificationRatified !== false || persona.claims?.institutionalAuthorityGranted !== false || persona.claims?.implementationComplete !== false) problems.push(`PERSONA-MARKED-RESOLVED: ${persona.persona} is recorded as ratified, self-ratified or implemented`)
    if ((persona.listedInstitutionalAuthorityDecisions ?? []).length > 0 && persona.institutionalBoundary === undefined) problems.push(`INSTITUTIONAL-SILENTLY-GRANTED: ${persona.persona} lists institutional decisions with no boundary statement`)
  }
  if (product.stewardStructure?.selected !== null || product.stewardStructure?.ratified !== false || product.stewardStructure?.recommendationOnly !== true) problems.push('PERSONA-MARKED-RESOLVED: the Steward structure recommendation is recorded as selected or ratified')
  if (product.approvalFieldsFilled !== 0) problems.push('PERSONA-MARKED-RESOLVED: the product dossier fills an approval field')
  for (const item of product.outstandingProductDecisions?.items ?? []) if (item.currentState !== 'OUTSTANDING' || item.adopted !== false) problems.push(`PERSONA-MARKED-RESOLVED: product decision ${item.decisionId} is recorded as settled`)
  if (product.outstandingProductDecisions?.count !== 24) problems.push(`DEBT-DROPPED: the product dossier holds ${product.outstandingProductDecisions?.count} outstanding product decisions, expected 24`)
  if (product.institutionalBoundary?.productRatificationIssuesInstitutionalPermissions !== false) problems.push('INSTITUTIONAL-SILENTLY-GRANTED: product ratification is recorded as issuing institutional permissions')

  // Institutional dossier: every decision retained, none adopted.
  const decisions = institutional.decisions ?? []
  const ids = decisions.map((decision) => decision.decisionId)
  if (unique(ids).length !== ids.length) problems.push('DEBT-DOUBLE-COUNTED: the institutional dossier lists a decision twice')
  const sourceIds = (src.reg.decisions.decisions ?? []).filter((decision) => decision.ownerRole !== 'AUTHORIZED_PRODUCT_OWNER' && ['INVENTORY_INSTITUTIONAL', 'BASELINE_INSTITUTIONAL_AUTHORITY'].includes(decision.family)).map((decision) => decision.decisionId)
  for (const id of sourceIds) if (!ids.includes(id)) problems.push(`DEBT-DROPPED: institutional decision ${id} is absent from the dossier`)
  for (const id of ids) if (!sourceIds.includes(id)) problems.push(`DEBT-DROPPED: dossier decision ${id} is not an institutional decision of the Gate 0C.3 index`)
  for (const decision of src.base.classification?.institutionalDecisions ?? []) if (!ids.includes(decision.id)) problems.push(`DEBT-DROPPED: inventory decision ${decision.id} is absent from the dossier`)
  for (const decision of decisions) {
    const label = decision.decisionId
    if (decision.adopted !== false || decision.closedByThisDossier !== false || decision.grantsInstitutionalAuthority !== false || decision.originalState !== 'OUTSTANDING' || decision.originalIdentifierRetained !== true) problems.push(`INSTITUTIONAL-SILENTLY-GRANTED: ${label} is recorded as adopted, closed or granting authority`)
    if (!SCOPE_LOCK_DISPOSITIONS.includes(decision.scopeLockDisposition)) problems.push(`INSTITUTIONAL-SILENTLY-GRANTED: ${label} carries scope-lock disposition ${decision.scopeLockDisposition}`)
    if (decision.scopeLockDisposition === 'DEFERRED_NON_AUTHORIZING' && !decision.nonAuthorizingTreatment) problems.push(`INSTITUTIONAL-SILENTLY-GRANTED: ${label} is deferred with no explicit non-authorizing treatment`)
  }
  if (institutional.totals?.adopted !== 0 || institutional.totals?.grantsInstitutionalAuthority !== 0) problems.push('INSTITUTIONAL-SILENTLY-GRANTED: the dossier totals report adopted decisions or granted authority')
  for (const decision of src.base.classification?.institutionalDecisions ?? []) if (decision.status !== 'OUTSTANDING') problems.push(`INSTITUTIONAL-SILENTLY-GRANTED: inventory decision ${decision.id} is ${decision.status}`)
  const carbonDecision = institutional.carbonDecision ?? {}
  if (carbonDecision.decisionId !== CARBON_DECISION_ID || carbonDecision.selected !== null || carbonDecision.recommendationOnly !== true || carbonDecision.exceptionsOwned !== false || carbonDecision.exceptionsAuthorized !== false || !same(carbonDecision.scopeExceptionOperations, CARBON_OPERATIONS)) problems.push('CARBON-AUTHORIZED: the carbon decision is recorded as selected, or its scope exceptions as owned or authorized')
  if (!(institutional.requiredBeforeCertification ?? []).includes(CARBON_DECISION_ID)) problems.push('DEBT-DROPPED: the carbon scope decision is not listed as required before certification')

  // Certification model: documentary completeness is not certification and certification is not release.
  const presentation = certification.presentation ?? {}
  for (const [key, value] of Object.entries(PRESENTATION)) if (presentation[key] !== value) problems.push(`DOCUMENTARY-AS-CERTIFICATION: presentation ${key} is ${presentation[key]}, required ${value}`)
  if (presentation.documentaryCriteria?.label !== DOCUMENTARY_LABEL) problems.push('DOCUMENTARY-AS-CERTIFICATION: the seven criteria are not labelled documentary')
  if (certification.gate0Verdict !== 'IN_PROGRESS') problems.push(`GATE0-AS-GO: the certification model carries Gate 0 verdict ${certification.gate0Verdict}`)
  if (!same(certification.checklist?.checks, CERTIFICATION_CHECKS) || !same((certification.checklist?.items ?? []).map((item) => item.check), CERTIFICATION_CHECKS)) problems.push('DOCUMENTARY-AS-CERTIFICATION: the checklist does not separate the eight checks')
  const decision = certification.checklist?.certificationDecision ?? {}
  if (decision.granted !== false || decision.decidedBy !== null || decision.decidedOn !== null || decision.artifactSha256 !== null || decision.evidenceDocumentSha256 !== null) problems.push('CERTIFICATION-GRANTED-WITHOUT-EVIDENCE: a certification decision is recorded with no independent evidence')
  if (decision.impliesReleaseAuthorization !== false || decision.impliesProductionGo !== false) problems.push('CERTIFICATION-IMPLIES-RELEASE: the certification decision is recorded as authorizing a release or a production GO')
  const evaluation = certification.checklist ? evaluateCertification(certification) : null
  if (!evaluation || !same(evaluation, certification.evaluation)) problems.push('CERTIFICATION-GRANTED-WITHOUT-EVIDENCE: the recorded evaluation differs from the evaluation of the checklist')
  if (evaluation && (evaluation.certificationGranted !== false || evaluation.impliesReleaseAuthorization !== false || evaluation.impliesProductionGo !== false || evaluation.readinessUnchanged !== 'NO_GO')) problems.push('CERTIFICATION-IMPLIES-RELEASE: the evaluation grants certification, release or production GO')
  for (const item of certification.checklist?.items ?? []) {
    if (item.evidenceKind === 'AUTHORITY_EVIDENCE' && item.state === 'SATISFIED_BY_AUTHORITY' && !(item.authorityEvidence?.authorityIndependent === true)) problems.push(`CERTIFICATION-GRANTED-WITHOUT-EVIDENCE: ${item.id} is satisfied by authority with no independent authority evidence`)
    if (item.evidenceKind === 'AUTHORITY_EVIDENCE' && item.authorityEvidence === null && item.state !== 'NOT_SATISFIED') problems.push(`CERTIFICATION-GRANTED-WITHOUT-EVIDENCE: ${item.id} is ${item.state} with no authority evidence`)
    if (item.evidenceKind === 'NOT_PART_OF_GATE_0' && (item.state !== 'NO_GO' || item.canBeSatisfiedByGate0Certification !== false)) problems.push(`CERTIFICATION-IMPLIES-RELEASE: ${item.id} lets a Gate 0 certification satisfy release readiness`)
    if (item.evidenceKind === 'RECORD_DERIVED' && item.sufficientAlone !== false) problems.push(`DOCUMENTARY-AS-CERTIFICATION: ${item.id} treats a record-derived item as sufficient alone`)
  }
  if (certification.checklist?.items?.find((item) => item.id === 'CL-2')?.authorityIndependentReviewOnFile !== false) problems.push('FALSE-INDEPENDENCE: CL-2 records an authority-independent review that no authority performed')
  const debtItems = src.reg.debt.items.map((item) => item.itemId)
  const obligations = certification.downstreamObligations ?? {}
  if (unique(obligations.itemIds ?? []).length !== (obligations.itemIds ?? []).length) problems.push('DEBT-DOUBLE-COUNTED: the downstream obligations list an item twice')
  for (const id of debtItems) if (!(obligations.itemIds ?? []).includes(id)) problems.push(`DEBT-DROPPED: release-debt item ${id} is not carried by the certification model`)
  for (const id of obligations.itemIds ?? []) if (!debtItems.includes(id)) problems.push(`DEBT-DOUBLE-COUNTED: ${id} is carried by the certification model and is not in the Gate 0C.3 index`)
  if (obligations.itemCount !== debtItems.length || obligations.carriedOnce !== true || obligations.debtIndexSha256 !== src.regSha?.debt) problems.push('DEBT-DROPPED: the downstream obligation count or index pin differs from the Gate 0C.3 release-debt index')
  if (!same(sorted(obligations.itemIds ?? []), sorted(debtItems))) problems.push('DEBT-DROPPED: the downstream obligation ids differ from the Gate 0C.3 release-debt index')
  if (obligations.proposedDispositionsAwaitingAcceptance !== 71) problems.push('DEBT-DROPPED: the 71 proposed dispositions awaiting acceptance are not carried')

  // Claims anywhere in the registers and documents.
  for (const [name, value] of Object.entries(registers)) {
    const text = JSON.stringify(value)
    if (FORBIDDEN_STATUS.test(text)) problems.push(`IMPLEMENTATION-CLAIM: ${name} records a forbidden completion, approval or adoption status`)
    if (/PROVEN_IN_STAGING/.test(text)) problems.push(`IMPLEMENTATION-CLAIM: ${name} records PROVEN_IN_STAGING`)
    if (PRODUCTION_GO.test(text)) problems.push(`CERTIFICATION-IMPLIES-RELEASE: ${name} records a production GO or a release authorization`)
    if (value.anchorCommit !== ANCHOR_0C3_COMMIT || value.gate !== GATE_ID) problems.push(`REGISTER-DRIFT: ${name} names an anchor commit or gate other than ${GATE_ID} at ${ANCHOR_0C3_COMMIT.slice(0, 12)}`)
    for (const phrase of strings(value)) {
      for (const pattern of OVERBROAD_CLAIMS) {
        if (pattern.test(phrase) && !qualifiedFor(pattern).test(phrase)) problems.push(`OVERBROAD-CERTIFICATION-CLAIM: ${name} states "${phrase.slice(0, 80)}"`)
      }
    }
    for (const paragraph of strings(value)) if (CRITERIA_SATISFIED.test(paragraph) && !/documentary/i.test(paragraph)) problems.push(`DOCUMENTARY-AS-CERTIFICATION: ${name} states that the seven criteria are satisfied without saying they are documentary`)
  }
  const reportText = readText ? readText(REPORT_FILE) : null
  const section = typeof reportText === 'string' ? reportText.split(/^## /m).filter((part) => /^Gate 0C\.4\b/.test(part)) : []
  const scanned = [...Object.entries(docs ?? {}).filter(([, text]) => typeof text === 'string').map(([file, text]) => [file, text]), ...section.map((text) => [`${REPORT_FILE} (Gate 0C.4)`, text])]
  for (const [file, text] of scanned) {
    for (const paragraph of paragraphsOf(text)) {
      if (CRITERIA_SATISFIED.test(paragraph) && !/documentary/i.test(paragraph)) problems.push(`DOCUMENTARY-AS-CERTIFICATION: ${file} states that the seven criteria are satisfied without saying they are documentary`)
      for (const pattern of OVERBROAD_CLAIMS) if (pattern.test(paragraph) && !qualifiedFor(pattern).test(paragraph)) problems.push(`OVERBROAD-CERTIFICATION-CLAIM: ${file} states an unsupported claim: ${pattern}`)
    }
    if (PRODUCTION_GO.test(text)) problems.push(`CERTIFICATION-IMPLIES-RELEASE: ${file} reads as a release authorization`)
  }

  // Pins.
  const pin = src.base.matrix?.[PIN_KEY]
  if (liveFileSha) {
    if (!pin?.files) problems.push(`PIN-DRIFT: the matrix carries no ${PIN_KEY} pin`)
    else {
      const pinned = { ...FILES_0C4, ...Object.fromEntries(Object.entries(DOCS_0C4).map(([key, file]) => [`doc-${key}`, file])) }
      for (const [key, file] of Object.entries(pinned)) if (pin.files[key]?.file !== file || pin.files[key]?.sha256 !== liveFileSha(file)) problems.push(`PIN-DRIFT: ${file} is not the file the matrix pins`)
      for (const key of Object.keys(pin.files)) if (!pinned[key]) problems.push(`PIN-DRIFT: the matrix pins an unknown Gate 0C.4 file ${key}`)
    }
  }

  // Regeneration.
  for (const key of keys) if (serialize(registers[key]) !== serialize(expected[key])) problems.push(`REGISTER-DRIFT: ${FILES_0C4[key]} differs from its regeneration`)
  if (docs) {
    const rendered = renderDocs(expected)
    for (const file of Object.values(DOCS_0C4)) {
      const text = docs[file]
      if (typeof text !== 'string') problems.push(`DOC-ABSENT: ${file} is missing`)
      else if (text !== rendered[file]) problems.push(`DOC-DRIFT: ${file} differs from its regeneration`)
    }
  }
  return unique(problems)
}

export function qualificationSummary({ registers }) {
  const { qualification, evidence, supersessions, certification, product, institutional } = registers
  return {
    gate: GATE_ID,
    highDefectsQualified: qualification.totals.assessed,
    byReviewStatus: qualification.totals.byReviewStatus,
    withQualifyingOrChallengeFinding: qualification.totals.withQualifyingOrChallengeFinding,
    dispositionsAccepted: qualification.totals.accepted,
    debtIndexMatches: evidence.deduplication.matches,
    supersessionRecords: supersessions.totals.records,
    personasPresented: product.personas.length,
    institutionalDecisions: institutional.totals.institutionalDecisions,
    requiredBeforeCertification: institutional.totals.requiredBeforeCertification,
    unmetCertificationItems: certification.evaluation.unmet,
    certificationGranted: certification.evaluation.certificationGranted,
    gate0Verdict: certification.gate0Verdict,
    readiness: certification.presentation.ueSaasOperationalReadiness,
  }
}
