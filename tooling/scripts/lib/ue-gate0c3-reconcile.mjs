/**
 * Gate 0C.3: institutional scope exceptions and release-debt reconciliation.
 *
 * Everything here reconciles records that earlier gates froze. It repairs no defect, accepts no release disposition, adopts
 * no institutional or product decision, ratifies no persona baseline, selects no carbon option and changes no application
 * source, security status, migration or runtime qualification. The builders derive each register from the frozen defect
 * register, the operation records, the review queue, the challenge register, the exception register, the handoff register
 * and the Gate 0C.2 decision records. Authored judgement (the proposed dispositions, the carbon options, the defect
 * clusters, the decision overlaps and the closure criteria) lives in the facts modules and is labelled as a proposal.
 */
import { createHash } from 'node:crypto'
import { compareCodeUnit } from './ue-gate0b1-classification.mjs'
import { defectHash } from './ue-gate0b7-release-dispositions.mjs'
import {
  ANCHOR_COMMIT,
  ASSESSMENT_STATE,
  CARBON_DECISION_ID,
  CARBON_OPERATIONS,
  CARBON_OPTIONS as CARBON_OPTION_IDS,
  CHALLENGES_FILE,
  CHALLENGE_FLAG,
  CHALLENGE_IDS,
  CHALLENGE_POSITION,
  CLASSIFICATION_FILE,
  DECISION_FAMILIES,
  DOCS_0C3,
  EVIDENCE_BASIS,
  EXPOSURE_OPERATIONS,
  FILES_0C3,
  FROZEN_TOTALS,
  GATE_ID,
  HANDOFF_FILE,
  OPL_DEFECTS,
  PREPARED_ON,
  PROPOSED_DISPOSITIONS,
  QUEUE_FILE,
  RATCHETS_FILE,
  RECORD_TYPES,
  RUNTIME_PROOFS,
  TRACKED_ITEMS,
  CERTIFICATION_RULING_DOC,
} from './ue-gate0c3-ids.mjs'
import { ACTIVATION_CODES, ASSESSMENTS, IMPACT_CODES, RUBRIC } from './ue-gate0c3-assess-facts.mjs'
import {
  CARBON_OPTIONS as CARBON_OPTION_FACTS,
  CARBON_ROUTE_EVIDENCE,
  CARBON_SERVICE_EVIDENCE,
  CLOSURE_LEVEL_1,
  CLOSURE_LEVEL_2,
  CLUSTERS,
  DECISION_OVERLAPS,
  FAMILY_TEXT,
} from './ue-gate0c3-facts.mjs'

export const PERSONAS = ['steward', 'representative', 'financial-officer']
export const PROPOSED_STATE = 'PROPOSED_FOR_RATIFICATION'
export const IMPACT_VOCABULARY = Object.values(IMPACT_CODES)
export const ACTIVATION_VOCABULARY = Object.values(ACTIVATION_CODES)
export const REPORTING_CLASSES = ['RELEASE_BLOCKING', 'CONDITIONALLY_BLOCKING', 'CONDITIONALLY_BLOCKING_CHALLENGED', 'AWAITING_ACCEPTED_DISPOSITION', 'TRACKED_ENGINEERING_DEBT']
export const CATEGORIES = {
  RB: 'RELEASE_BLOCKING_DISPOSITION',
  CB: 'CONDITIONAL_DISPOSITION',
  QUEUE: 'EARLIER_HIGH_AWAITING_ASSESSMENT',
  EXPOSURE: 'PUBLIC_EXPOSURE_CONTRACT',
  TRACKED: 'TRACKED_RATCHET_OR_TEST',
  CHALLENGE: 'OPL_CHALLENGE',
}
const IMPACT_PROOFS = {
  CROSS_TENANT_DISCLOSURE: ['RLS_TENANT_ISOLATION', 'NATIVE_POSTGRES'],
  SAME_TENANT_OVER_DISCLOSURE: ['ROLE_AUTHORIZATION'],
  UNAUTHORIZED_MUTATION: ['ROLE_AUTHORIZATION'],
  PRIVACY_OR_CONSENT: ['ROLE_AUTHORIZATION'],
  FINANCIAL_INTEGRITY: ['ROLE_AUTHORIZATION'],
  FALSE_ATTESTATION_OR_OUTCOME: ['REPAIR_REGRESSION_ONLY'],
  AVAILABILITY_OR_DATA_LOSS: ['REPAIR_REGRESSION_ONLY'],
  DATA_QUALITY: ['REPAIR_REGRESSION_ONLY'],
}

export const sorted = (items) => [...items].sort(compareCodeUnit)
export const unique = (items) => [...new Set(items)]
export const sha256Text = (text) => createHash('sha256').update(text).digest('hex')
export const serialize = (value) => `${JSON.stringify(value, null, 2)}\n`
export const sha256Of = (value) => sha256Text(serialize(value))
const clone = (value) => JSON.parse(JSON.stringify(value))
const countBy = (items, key) => {
  const out = {}
  for (const item of items) out[key(item)] = (out[key(item)] ?? 0) + 1
  return Object.fromEntries(sorted(Object.keys(out)).map((name) => [name, out[name]]))
}

/* ---------------------------------------------------------------------------------------------------------------- */
/* Indexes over the frozen sources.                                                                                   */

/** One record per operation identity; a later tranche replaces the carried-forward record of an earlier one. */
export function operationIndex(src) {
  const map = new Map()
  for (const tranche of src.tranches) for (const operation of tranche.operations) map.set(operation.id, operation)
  return map
}

export function opsByDefect(src) {
  const map = new Map()
  for (const operation of sorted([...operationIndex(src).keys()]).map((id) => operationIndex(src).get(id))) {
    for (const defectId of operation.defects ?? []) map.set(defectId, [...(map.get(defectId) ?? []), operation])
  }
  return map
}

const defectIndex = (src) => new Map(src.classification.defectRegister.map((defect) => [defect.id, defect]))
const capabilityIndex = (src) => new Map(src.matrix.capabilities.map((capability) => [capability.id, capability]))

function need(map, key, what) {
  const value = map.get(key)
  if (value === undefined) throw new Error(`Gate 0C.3 source is missing ${what} ${key}`)
  return value
}

function operationDecisions(operations) {
  return sorted(unique(operations.flatMap((operation) => operation.institutionalDecisions ?? [])))
}

function distinctEvidence(operations, limit) {
  const seen = new Set()
  const out = []
  for (const operation of operations) {
    for (const item of operation.evidence ?? []) {
      const key = `${item.ref}\u0000${item.quote}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ ref: item.ref, quote: item.quote })
      if (out.length >= limit) return out
    }
  }
  return out
}

/* ---------------------------------------------------------------------------------------------------------------- */
/* 1. Assessment of the 71 earlier HIGH defects.                                                                      */

export function buildAssessment(src) {
  const defects = defectIndex(src)
  const byDefect = opsByDefect(src)
  const entries = src.queue.entries
  if (entries.length !== ASSESSMENTS.length) throw new Error(`The review queue holds ${entries.length} entries and the assessment table ${ASSESSMENTS.length}`)
  const rows = entries.map((entry, index) => {
    const [short, value, rubricKey, activation, impacts, floor, statement, proofs, extraDecisions, reason] = ASSESSMENTS[index]
    const defectId = `DEF-${short}`
    if (entry.defectId !== defectId) throw new Error(`Assessment row ${index} is ${defectId} and the review queue holds ${entry.defectId}`)
    if (!PROPOSED_DISPOSITIONS.includes(value)) throw new Error(`${defectId} has an unknown proposed disposition ${value}`)
    if (!RUBRIC[rubricKey]) throw new Error(`${defectId} cites an unknown rubric ${rubricKey}`)
    if (!ACTIVATION_CODES[activation]) throw new Error(`${defectId} cites an unknown activation ${activation}`)
    const classes = impacts.split(',').map((code) => {
      if (!IMPACT_CODES[code]) throw new Error(`${defectId} cites an unknown impact code ${code}`)
      return IMPACT_CODES[code]
    })
    const proofList = proofs.split(',')
    for (const proof of proofList) if (!RUNTIME_PROOFS.includes(proof)) throw new Error(`${defectId} cites an unknown runtime proof ${proof}`)
    const defect = need(defects, defectId, 'defect')
    const operations = byDefect.get(defectId) ?? []
    if (operations.length === 0) throw new Error(`${defectId} is carried by no operation`)
    const capabilityIds = sorted(unique(operations.map((operation) => operation.capabilityId)))
    return {
      defectId,
      tranche: defect.tranche,
      gate: defect.gate,
      ownerCapabilityId: defect.ownerCapabilityId,
      title: defect.title,
      frozenRecord: {
        originalSeverity: defect.severity,
        originalReleaseBlocking: defect.releaseBlocking,
        defectSha256: defectHash(defect),
        queueDefectSha256: entry.defectSha256,
        matchesQueue: defectHash(defect) === entry.defectSha256,
        carriesReleaseDisposition: defect.releaseDisposition !== undefined && defect.releaseDisposition !== null,
        queueStatus: entry.status,
        modifiedByGate0C3: false,
      },
      affected: {
        operationCount: operations.length,
        operations: sorted(operations.map((operation) => operation.id)),
        capabilityIds,
        authorizationCategories: countBy(operations, (operation) => operation.authorizationCategory),
        implementationStatuses: countBy(operations, (operation) => operation.implementationStatus),
        crossTenantExposureMarkedOperations: operations.filter((operation) => operation.crossTenantExposure === true).length,
        operationsWithProductCallers: operations.filter((operation) => (operation.callers ?? []).length > 0).length,
      },
      sourceExposure: {
        activationState: ACTIVATION_CODES[activation],
        floor,
        statement,
      },
      impact: { classes: sorted(classes) },
      containment: {
        verified: false,
        executedProof: [],
        statement: 'No executed containment proof is on file for this defect, so containment is not verified.',
      },
      evidence: {
        basis: EVIDENCE_BASIS,
        executedProof: [],
        sourceQuotes: distinctEvidence(operations, 3),
      },
      proposedDisposition: {
        value,
        state: ASSESSMENT_STATE,
        rubricKey,
        rubric: RUBRIC[rubricKey],
        condition: value === 'CONDITIONALLY_BLOCKING' ? reason : null,
        reviewReasons: value === 'REVIEW_REQUIRED' ? reason : null,
        acceptedBy: null,
        acceptedOn: null,
        severityChanged: false,
      },
      institutionalDecisionIds: sorted(unique([...operationDecisions(operations), ...extraDecisions])),
      runtimeQualification: {
        needed: proofList.some((proof) => proof !== 'REPAIR_REGRESSION_ONLY'),
        proofs: sorted(proofList),
      },
    }
  })
  return {
    schemaVersion: 1,
    register: 'UE-HIGH-DEFECT-RELEASE-ASSESSMENT',
    gate: GATE_ID,
    version: 1,
    anchorCommit: ANCHOR_COMMIT,
    preparedOn: PREPARED_ON,
    status: ASSESSMENT_STATE,
    evidenceBasis: EVIDENCE_BASIS,
    note: 'Independent, versioned assessment of the 71 HIGH defects of Gates 0B.1 to 0B.6 that carry no release disposition. Every proposed disposition is a preparer recommendation derived from the frozen defect record, the operation records that carry the defect and the source quotes they cite. None is an accepted determination, executed proof or a change to a frozen severity or hash. A defect whose frozen record under-evidences the question is REVIEW_REQUIRED.',
    separation: 'A proposed disposition is a release-disposition assessment. It is distinct from the defect, from a challenge, from an exposure contract, from an engineering repair obligation and from an accepted release decision.',
    queue: { file: QUEUE_FILE, sha256: src.fileSha[QUEUE_FILE], entries: entries.length, frozen: true },
    rubric: RUBRIC,
    totals: {
      defects: rows.length,
      byTranche: countBy(rows, (row) => row.tranche),
      byProposedDisposition: countBy(rows, (row) => row.proposedDisposition.value),
      reviewRequired: sorted(rows.filter((row) => row.proposedDisposition.value === 'REVIEW_REQUIRED').map((row) => row.defectId)),
      runtimeQualificationNeeded: rows.filter((row) => row.runtimeQualification.needed).length,
      executedProofs: 0,
      accepted: 0,
      severityChanged: 0,
    },
    assessments: rows,
  }
}

/* ---------------------------------------------------------------------------------------------------------------- */
/* 2. Deduplicated release-debt index.                                                                                */

function proofsFromImpact(classes) {
  return sorted(unique(classes.flatMap((name) => IMPACT_PROOFS[name] ?? ['REPAIR_REGRESSION_ONLY'])))
}

function acceptanceFor({ behavior, guards, proofs }) {
  return {
    behavior,
    requiredGuards: guards,
    runtimeProofs: proofs,
    regression: 'A test that fails against the current behavior and passes after the repair is on file.',
    release: 'An independent, authorized release decision names the repair evidence or accepts the residual risk. None exists.',
  }
}

function obligationFor({ sourceId, ownerCapabilityId, capability, targetGate, sourceReference, acceptance }) {
  return {
    obligationId: `REPAIR-${sourceId}`,
    ownerCapabilityId,
    ownerBasis: 'ACCOUNTABILITY_NOT_AUTHORIZATION',
    primaryGate: capability.primaryGate,
    targetGate,
    sourceReference,
    acceptanceCondition: acceptance,
    state: 'OPEN',
  }
}

const RELEASE_EFFECT = {
  RELEASE_BLOCKING: 'BLOCKS_RELEASE_UNTIL_REPAIRED_AND_PROVEN_OR_AUTHORIZED',
  CONDITIONALLY_BLOCKING: 'BLOCKS_RELEASE_WHEN_THE_RECORDED_CONDITION_HOLDS',
  CONDITIONALLY_BLOCKING_CHALLENGED: 'TREATED_AS_RELEASE_BLOCKING_PENDING_CONTAINMENT_PROOF',
  AWAITING_ACCEPTED_DISPOSITION: 'UNDETERMINED_UNTIL_AN_INDEPENDENT_DISPOSITION_IS_ACCEPTED',
  TRACKED_ENGINEERING_DEBT: 'ENGINEERING_DEBT_WITH_NO_RELEASE_DISPOSITION',
}

export function observedTotals(src) {
  const register = src.classification.defectRegister
  return {
    operations: src.matrix.routeInventoryTotals?.operations,
    capabilities: src.matrix.capabilities.length,
    defects: register.length,
    institutionalDecisions: src.classification.institutionalDecisions.length,
    releaseBlockingDispositions: register.filter((defect) => defect.releaseDisposition?.disposition === 'RELEASE_BLOCKING').length,
    conditionallyBlockingDispositions: register.filter((defect) => defect.releaseDisposition?.disposition === 'CONDITIONALLY_BLOCKING').length,
    earlierHighAwaitingQualification: src.queue.entries.length,
    challenges: src.challenges.challenges.length,
    publicExposures: src.classification.releaseBlockingExposures.length,
    carbonExceptions: src.exceptions.exceptions.length,
    proposedPersonaBaselines: Object.keys(src.matrix.proposedPersonaBaselines?.data ?? {}).filter((name) => PERSONAS.includes(name)).length,
  }
}

export function buildDebtIndex(src, assessment) {
  const defects = defectIndex(src)
  const byDefect = opsByDefect(src)
  const capabilities = capabilityIndex(src)
  const assessed = new Map(assessment.assessments.map((row) => [row.defectId, row]))
  const challengeOf = new Map(src.challenges.challenges.map((challenge) => [challenge.challengedDefectId, challenge]))
  const exposureOperations = new Map()
  const relatedExposureDefects = new Set()
  for (const exposure of src.classification.releaseBlockingExposures) {
    for (const defectId of exposure.defects) {
      if (need(defects, defectId, 'defect').releaseBlocking === true) exposureOperations.set(defectId, [...(exposureOperations.get(defectId) ?? []), exposure.id])
      else relatedExposureDefects.add(defectId)
    }
  }
  const register = src.classification.defectRegister
  const candidates = unique([
    ...register.filter((defect) => defect.releaseDisposition).map((defect) => defect.id),
    ...src.queue.entries.map((entry) => entry.defectId),
    ...exposureOperations.keys(),
  ])
  const items = sorted(candidates).map((defectId) => {
    const defect = need(defects, defectId, 'defect')
    const operations = byDefect.get(defectId) ?? []
    const disposition = defect.releaseDisposition?.disposition ?? null
    const inQueue = assessed.has(defectId)
    const exposure = exposureOperations.has(defectId)
    const challenge = challengeOf.get(defectId) ?? null
    const categories = []
    if (disposition === 'RELEASE_BLOCKING') categories.push(CATEGORIES.RB)
    if (disposition === 'CONDITIONALLY_BLOCKING') categories.push(CATEGORIES.CB)
    if (inQueue) categories.push(CATEGORIES.QUEUE)
    if (exposure) categories.push(CATEGORIES.EXPOSURE)
    if (challenge) categories.push(CATEGORIES.CHALLENGE)
    let reportingClass
    if (disposition === 'RELEASE_BLOCKING' || exposure) reportingClass = 'RELEASE_BLOCKING'
    else if (disposition === 'CONDITIONALLY_BLOCKING') reportingClass = challenge ? 'CONDITIONALLY_BLOCKING_CHALLENGED' : 'CONDITIONALLY_BLOCKING'
    else reportingClass = 'AWAITING_ACCEPTED_DISPOSITION'
    const assessment = assessed.get(defectId) ?? null
    const impactClasses = assessment ? assessment.impact.classes : (defect.releaseDisposition?.potentialImpact?.classes ?? [])
    const proofs = assessment ? assessment.runtimeQualification.proofs : exposure ? ['ROLE_AUTHORIZATION'] : proofsFromImpact(impactClasses)
    const guards = sorted(unique(operations.map((operation) => operation.requiredFutureGuard).filter((guard) => typeof guard === 'string' && guard !== '')))
    const capability = need(capabilities, defect.ownerCapabilityId, 'capability')
    const decisionIds = assessment ? assessment.institutionalDecisionIds : operationDecisions(operations)
    return {
      itemId: `DEBT:${defectId}`,
      itemKind: 'DEFECT',
      sourceId: defectId,
      title: defect.title,
      severity: defect.severity,
      tranche: defect.tranche,
      gate: defect.gate,
      ownerCapabilityId: defect.ownerCapabilityId,
      frozenDefectSha256: defectHash(defect),
      frozenReleaseBlocking: defect.releaseBlocking,
      frozenDisposition: disposition,
      proposedDisposition: assessment ? assessment.proposedDisposition.value : null,
      challengePosition: challenge ? challenge.reviewerPosition : null,
      reportingClass,
      releaseEffect: RELEASE_EFFECT[reportingClass],
      listedIn: sorted(categories),
      recordTypes: {
        defect: true,
        releaseDispositionAssessment: disposition ? 'FROZEN_IN_DEFECT_RECORD' : inQueue ? 'PROPOSED_BY_GATE_0C3_NOT_ACCEPTED' : null,
        challenge: challenge ? challenge.id : null,
        exposureContract: exposure ? sorted(exposureOperations.get(defectId)) : [],
        engineeringRepairObligation: `REPAIR-${defectId}`,
        acceptedReleaseDecision: null,
      },
      impactClasses: sorted(impactClasses),
      decisionIds,
      relatedNonBlockingDefects: exposure ? sorted([...relatedExposureDefects]) : [],
      engineeringObligation: obligationFor({
        sourceId: defectId,
        ownerCapabilityId: defect.ownerCapabilityId,
        capability,
        targetGate: defect.gate,
        sourceReference: { register: CLASSIFICATION_FILE, defectId, defectSha256: defectHash(defect) },
        acceptance: acceptanceFor({ behavior: `The behavior stated in the frozen defect record no longer reproduces: ${defect.title}`, guards, proofs }),
      }),
    }
  })

  const handoff = src.handoff.obligations.find((obligation) => obligation.id === 'OBL-0C-TRACKED-RATCHET-AND-TEST-DEFECTS')
  if (!handoff) throw new Error('The handoff register has no tracked ratchet and test defect obligation')
  const rules = new Map(src.ratchets.rules.map((rule) => [rule.id, rule]))
  const tracked = sorted(handoff.defects.map((item) => item.id)).map((id) => {
    const item = handoff.defects.find((entry) => entry.id === id)
    const meta = TRACKED_ITEMS[id]
    if (!meta || meta.kind !== item.kind || meta.capabilityId !== item.capabilityId) throw new Error(`Tracked item ${id} differs from its Gate 0C.3 declaration`)
    const capability = need(capabilities, item.capabilityId, 'capability')
    const rule = item.kind === 'RATCHET' ? need(rules, id.split('@')[0], 'ratchet rule') : null
    const behavior =
      item.kind === 'TEST_SUITE'
        ? `The suite ${item.file} runs to completion at setup in the repository test run. Recorded gap: ${capability.gap}`
        : item.kind === 'RATCHET'
          ? `The ratchet rule ${rule.id} no longer reports ${item.file}. Recorded gap: ${capability.gap}`
          : `${capability.businessOutcome} ${capability.negativeAndRecovery}`
    return {
      itemId: `DEBT:${id}`,
      itemKind: 'TRACKED_ITEM',
      sourceId: id,
      title: `${item.kind} ${item.file}`,
      severity: null,
      tranche: null,
      gate: capability.primaryGate,
      ownerCapabilityId: item.capabilityId,
      frozenDefectSha256: null,
      frozenReleaseBlocking: null,
      frozenDisposition: null,
      proposedDisposition: null,
      challengePosition: null,
      reportingClass: 'TRACKED_ENGINEERING_DEBT',
      releaseEffect: RELEASE_EFFECT.TRACKED_ENGINEERING_DEBT,
      listedIn: [CATEGORIES.TRACKED],
      recordTypes: {
        defect: false,
        releaseDispositionAssessment: null,
        challenge: null,
        exposureContract: [],
        engineeringRepairObligation: `REPAIR-${id}`,
        acceptedReleaseDecision: null,
      },
      impactClasses: [],
      decisionIds: [],
      relatedNonBlockingDefects: [],
      trackedKind: item.kind,
      trackedFile: item.file,
      engineeringObligation: obligationFor({
        sourceId: id,
        ownerCapabilityId: item.capabilityId,
        capability,
        targetGate: capability.primaryGate,
        sourceReference: { register: HANDOFF_FILE, obligationId: handoff.id, itemId: id, file: item.file, ...(rule ? { ratchetRegister: RATCHETS_FILE, ratchetRule: rule.id } : {}) },
        acceptance: acceptanceFor({ behavior, guards: [], proofs: ['REPAIR_REGRESSION_ONLY'] }),
      }),
    }
  })
  const all = sorted([...items, ...tracked].map((item) => item.itemId)).map((id) => [...items, ...tracked].find((item) => item.itemId === id))

  const frozenTotals = Object.fromEntries(
    Object.entries(observedTotals(src)).map(([name, observed]) => [name, { accepted: FROZEN_TOTALS[name], observed, matchesAccepted: observed === FROZEN_TOTALS[name] }]),
  )
  const listings = {
    [CATEGORIES.RB]: all.filter((item) => item.listedIn.includes(CATEGORIES.RB)).length,
    [CATEGORIES.CB]: all.filter((item) => item.listedIn.includes(CATEGORIES.CB)).length,
    [CATEGORIES.QUEUE]: all.filter((item) => item.listedIn.includes(CATEGORIES.QUEUE)).length,
    [CATEGORIES.EXPOSURE]: src.classification.releaseBlockingExposures.length,
    [CATEGORIES.CHALLENGE]: src.challenges.challenges.length,
    [CATEGORIES.TRACKED]: tracked.length,
  }
  const listed = Object.values(listings).reduce((sum, value) => sum + value, 0)
  const handoffObligations = src.handoff.obligations.map((obligation) => ({
    obligationId: obligation.id,
    ownerGate: obligation.ownerGate,
    statusBefore: obligation.status,
    statusAfterGate0C3: obligation.status,
    closed: false,
    treatment: HANDOFF_TREATMENT[obligation.id] ?? 'NO_GATE_0C3_ACTION_RECORDED',
  }))
  return {
    schemaVersion: 1,
    register: 'UE-RELEASE-DEBT-INDEX',
    gate: GATE_ID,
    version: 1,
    anchorCommit: ANCHOR_COMMIT,
    preparedOn: PREPARED_ON,
    status: 'RECONCILED_NOT_ACCEPTED',
    note: 'One deduplicated index of the release debt that earlier gates recorded: the 32 release-blocking and 41 conditionally blocking dispositions, the 71 earlier HIGH defects, the two OPL challenges, the three unjustified public exposures and the tracked ratchet and test defects. A defect, a release-disposition assessment, a challenge, an exposure contract, an engineering repair obligation and an accepted release decision are distinct record types. One item may appear under several of them without becoming several defects. Every item has one engineering repair obligation with an owner, a target gate, a source reference and an acceptance condition. No obligation is closed, no release decision is accepted and nothing here repairs a defect.',
    recordTypes: RECORD_TYPES,
    frozenEvidence: {
      anchorCommit: ANCHOR_COMMIT,
      totals: frozenTotals,
      files: sorted(Object.keys(src.fileSha)).map((file) => ({ file, sha256: src.fileSha[file] })),
    },
    lineage: { assessmentSha256: sha256Of(assessment) },
    totals: {
      uniqueItems: all.length,
      uniqueRegisterDefects: items.length,
      trackedItems: tracked.length,
      repairObligations: all.length,
      byReportingClass: countBy(all, (item) => item.reportingClass),
      releaseBlockingRegisterDefects: items.filter((item) => item.frozenReleaseBlocking === true).length,
      releaseBlockingDispositions: items.filter((item) => item.frozenDisposition === 'RELEASE_BLOCKING').length,
      conditionallyBlockingDispositions: items.filter((item) => item.frozenDisposition === 'CONDITIONALLY_BLOCKING').length,
      conditionallyBlockingChallenged: items.filter((item) => item.reportingClass === 'CONDITIONALLY_BLOCKING_CHALLENGED').length,
      earlierHighAwaitingDisposition: items.filter((item) => item.listedIn.includes(CATEGORIES.QUEUE)).length,
      publicExposureOperations: src.classification.releaseBlockingExposures.length,
      publicExposureReleaseBlockingDefects: exposureOperations.size,
      listings,
      listedInstances: listed,
      duplicateInflationAvoided: listed - all.length,
      acceptedReleaseDecisions: 0,
      closedObligations: 0,
    },
    items: all,
    handoffObligations,
  }
}

const HANDOFF_TREATMENT = {
  'OBL-0C-PERSONA-BASELINES': 'CARRIED_UNCHANGED_PRODUCT_OWNER_DECISION_PENDING_NOT_PART_OF_THIS_GATE',
  'OBL-0C-INSTITUTIONAL-DECISIONS': 'INDEXED_WITH_THE_OTHER_DECISION_FAMILIES_NONE_ADOPTED',
  'OBL-0C-CARBON-SCOPE-EXCEPTIONS': 'DECISION_READY_RECORD_PREPARED_NO_OPTION_SELECTED',
  'OBL-0C-HIGH-DEFECTS-AWAITING-REVIEW': 'PROPOSED_ASSESSMENT_PREPARED_ACCEPTANCE_REQUIRED_FROM_AN_INDEPENDENT_AUTHORITY',
  'OBL-0C-RELEASE-DISPOSITIONS': 'INDEXED_WITH_OWNERS_NO_RELEASE_DECISION_ACCEPTED',
  'OBL-0C-OPL-CHALLENGES': 'PRESERVED_UNCHANGED_NO_CONTAINMENT_PROOF_ON_FILE',
  'OBL-0C-UNJUSTIFIED-PUBLIC-EXPOSURES': 'INDEXED_AS_RELEASE_BLOCKING_DEBT_NOT_REPAIRED',
  'OBL-0C-TRACKED-RATCHET-AND-TEST-DEFECTS': 'INDEXED_WITH_OWNERS_NOT_REPAIRED',
  'OBL-0C-RUNTIME-QUALIFICATION': 'NOT_STARTED_OUT_OF_SCOPE_FOR_THIS_GATE',
}

/* ---------------------------------------------------------------------------------------------------------------- */
/* 3. OPL-01 and OPL-07 challenge treatment.                                                                          */

export function buildChallengeTreatment(src, debt) {
  const defects = defectIndex(src)
  const evidence = src.challengeEvidence
  if (!evidence) throw new Error('The challenge evidence comparison is not loaded')
  const changedCited = sorted(evidence.cited.filter((item) => item.anchorBlob !== item.liveBlob).map((item) => item.file))
  const flagAdded = sorted(evidence.flagFilesLive.filter((file) => !evidence.flagFilesAtAnchor.includes(file)))
  const flagRemoved = sorted(evidence.flagFilesAtAnchor.filter((file) => !evidence.flagFilesLive.includes(file)))
  const material = changedCited.length > 0 || flagAdded.length > 0 || flagRemoved.length > 0
  const reach = src.challenges.challenges[0].reachabilityInIntendedReleaseConfiguration
  const enforced = reach.legacyBranchExcludedFromReleasedRuntime === true
  const treatments = src.challenges.challenges.map((challenge) => {
    const defect = need(defects, challenge.challengedDefectId, 'defect')
    return {
      challengeId: challenge.id,
      challengedDefectId: challenge.challengedDefectId,
      frozenRecord: {
        disposition: defect.releaseDisposition?.disposition ?? null,
        releaseBlocking: defect.releaseBlocking,
        severity: defect.severity,
        defectSha256: defectHash(defect),
        challengeRecordedDefectSha256: challenge.challengedDefectSha256,
        matchesChallengeRecord: defectHash(defect) === challenge.challengedDefectSha256,
        modifiedByGate0C3: false,
      },
      challengePosition: challenge.reviewerPosition,
      challengeStatus: challenge.status,
      blocksGate: challenge.blocksGate,
      containment: {
        verified: challenge.containment.verified,
        executedProofOnFile: challenge.containment.executedProof.length,
        claimedMechanisms: challenge.containment.claimedMechanisms.length,
        requiredProof: challenge.containment.requiredProof,
      },
      debtItemId: debt.items.find((item) => item.sourceId === challenge.challengedDefectId)?.itemId ?? null,
      treatment: {
        challengePreserved: true,
        supersededBy: null,
        withdrawn: false,
        frozenDispositionModified: false,
        acceptedReleaseDecision: null,
        effectivePosture: challenge.reviewerPosition,
      },
    }
  })
  const flagDependent = src.classification.defectRegister
    .filter((defect) => JSON.stringify(defect.releaseDisposition ?? {}).includes(CHALLENGE_FLAG))
    .map((defect) => {
      const challenged = src.challenges.challenges.some((challenge) => challenge.challengedDefectId === defect.id)
      const disposition = defect.releaseDisposition.disposition
      return {
        defectId: defect.id,
        severity: defect.severity,
        frozenDisposition: disposition,
        challenged,
        frozenBlockingCondition: disposition === 'CONDITIONALLY_BLOCKING' ? defect.releaseDisposition.blockingCondition : null,
        treatment: challenged ? 'CHALLENGE_PRESERVED' : disposition === 'RELEASE_BLOCKING' ? 'ALREADY_RELEASE_BLOCKING' : 'FROZEN_CONDITIONAL_PRESERVED_FOR_INDEPENDENT_REVIEW',
        note:
          challenged || disposition === 'RELEASE_BLOCKING'
            ? 'The flag is not shown to be enforced in every release path, so the disposition is not softened by it.'
            : 'The frozen condition depends on the flag. The flag is not shown to be enforced in every release path. An independent reviewer decides whether this disposition needs its own challenge; this gate neither challenges nor changes it.',
      }
    })
    .sort((a, b) => compareCodeUnit(a.defectId, b.defectId))
  return {
    schemaVersion: 1,
    register: 'UE-OPL-CHALLENGE-TREATMENT',
    gate: GATE_ID,
    version: 1,
    anchorCommit: ANCHOR_COMMIT,
    preparedOn: PREPARED_ON,
    status: 'CHALLENGES_PRESERVED_UNRESOLVED',
    note: 'Treatment of the independent challenges of the frozen Gate 0B.10 dispositions of DEF-0B10-OPL-01 and DEF-0B10-OPL-07. The original CONDITIONALLY_BLOCKING records stay frozen. The challenge positions stay RELEASE_BLOCKING_PENDING_CONTAINMENT_PROOF. This record checks whether new source evidence changes the challenge, supersedes nothing and records no containment.',
    challengeRegister: { file: CHALLENGES_FILE, sha256: src.fileSha[CHALLENGES_FILE], anchorCommit: src.challenges.anchorCommit, provisionalPositions: src.challenges.provisionalPositions },
    flag: {
      name: CHALLENGE_FLAG,
      canonicalValue: '1',
      legacyValues: ['unset', '0'],
      enforcedInAllReleasePaths: enforced,
      basis: [
        `Legacy branch excluded from the released runtime: ${reach.legacyBranchExcludedFromReleasedRuntime}.`,
        `Startup refusal of a legacy value: ${reach.startupRefusalOfLegacyValue}.`,
        `The flag reader accepts the legacy values (${reach.flagReaderAcceptsLegacyValues.quote}).`,
        `The canonical value is set in the deployment template (${reach.canonicalValueInDeploymentTemplate.ref}), which is a deployment parameter and not a code guard.`,
        `A repository workflow runs the application with the legacy value (${reach.legacyValueInRepositoryWorkflows.map((item) => item.ref).join(', ')}).`,
      ],
      assumption: 'This record does not assume the flag is enforced in every release path.',
    },
    newSourceEvidence: {
      comparedAgainst: evidence.anchorCommit,
      citedFilesCompared: evidence.cited.length,
      changedCitedFiles: changedCited,
      filesNamingTheFlagAtTheChallengeCommit: evidence.flagFilesAtAnchor.length,
      filesNamingTheFlagNow: evidence.flagFilesLive.length,
      flagFilesAdded: flagAdded,
      flagFilesRemoved: flagRemoved,
      materialChange: material,
      conclusion: material ? 'NEW_SOURCE_EVIDENCE_REQUIRES_INDEPENDENT_REVIEW' : 'NO_NEW_SOURCE_EVIDENCE_THE_CHALLENGES_ARE_UNCHANGED',
    },
    challenges: treatments,
    flagDependentDispositions: flagDependent,
    flagDependentCount: flagDependent.length,
  }
}

/* ---------------------------------------------------------------------------------------------------------------- */
/* 4. Carbon scope decision record.                                                                                   */

export function buildCarbonDecision(src, assessment) {
  const exceptions = src.exceptions.exceptions
  const retire = CARBON_OPTION_FACTS.find((option) => option.id === 'OPT-RETIRE-ROUTES')
  const obligation = exceptions[0].containmentObligation
  const operations = exceptions.map((exception) => ({
    operationId: exception.id,
    inventoryClassification: exception.inventoryClassification,
    frozenRecords: exception.frozenRecords,
    scopeDisposition: { recordedIn: exception.scopeDisposition.recordedIn, disposition: exception.scopeDisposition.disposition, anyOptionChosen: exception.scopeDisposition.anyOptionChosen },
    defects: exception.defects,
    adopted: exception.adopted,
    authorized: exception.authorized,
    operationallyApproved: exception.operationallyApproved,
    productionReady: exception.productionReady,
    countedAsOwned: exception.countedAsOwned,
    independentDecisionRecord: exception.independentDecisionRecord,
  }))
  const assessed = assessment.assessments.find((row) => row.defectId === 'DEF-0B4-CARBON-FABRICATED-MEASUREMENTS-RETURNED-200')
  return {
    schemaVersion: 1,
    register: 'UE-CARBON-SCOPE-DECISION-RECORD',
    gate: GATE_ID,
    version: 1,
    anchorCommit: ANCHOR_COMMIT,
    preparedOn: PREPARED_ON,
    decisionId: CARBON_DECISION_ID,
    status: 'DECISION_READY_NOT_DECIDED',
    state: 'OUTSTANDING',
    note: 'A decision-ready record for the institutional decision that the four carbon operations wait on. It states three options, the evidence for and against each and a preparer recommendation. It selects nothing, adopts nothing and does not change the four decision-bound scope exceptions, which are not owned, authorized, adopted, approved or production ready.',
    question: exceptions[0].unresolvedDecision,
    decisionOwnerRole: FAMILY_TEXT.INVENTORY_INSTITUTIONAL.ownerRole,
    requiredApprovalEvidence: FAMILY_TEXT.INVENTORY_INSTITUTIONAL.approvalEvidence,
    exceptionRegister: { file: 'docs/union-eyes/convergence/register/ue-route-decision-bound-exceptions.json', sha256: src.fileSha['docs/union-eyes/convergence/register/ue-route-decision-bound-exceptions.json'], modifiedByGate0C3: false },
    operations,
    currentBehavior: {
      statement: 'The dashboard and infrastructure routes return emissions totals, regional breakdowns, renewable percentages and optimization advice as literals in the handler with success true and status 200, and the validate routes compute a certification-shaped verdict from caller-supplied data points. No route reads a table or a service.',
      fabricatedMeasurementDefect: { defectId: assessed.defectId, severity: assessed.frozenRecord.originalSeverity, proposedDisposition: assessed.proposedDisposition.value, state: assessed.proposedDisposition.state },
      routeEvidence: CARBON_ROUTE_EVIDENCE,
    },
    evidenceFound: {
      note: 'Sources outside the four route files that name carbon accounting.',
      sources: CARBON_SERVICE_EVIDENCE,
    },
    priorEvidenceGap: {
      frozenStatement: exceptions[0].evidenceExhausted.evidenceGap,
      discrepancy: 'The frozen Gate 0B.4 and Gate 0B.5 statement says no source names carbon accounting. A Next.js service, an integration service, a backend viewset and a database migration do name it. None is reachable from the four routes and every figure in them is an estimate or a caller-entered amount, so the four routes still have no measured source, owner or persona. The frozen statement is preserved and not edited.',
      materialToDecision: true,
      reviewRequired: 'An independent reviewer confirms whether the backend recording path is part of the released scope; that is a separate scope question from the four routes.',
    },
    options: CARBON_OPTION_FACTS.map((option) => ({ ...option, selected: false, adopted: false })),
    recommendation: {
      optionId: retire.id,
      status: 'PREPARER_RECOMMENDATION_NOT_SELECTED',
      recommendationOnly: true,
      notSelected: true,
      notAdopted: true,
      basis: retire.evidenceFor,
      caveats: [
        ...retire.evidenceAgainst,
        'If the deciding authority names a measured data source and an owning office, a measured option replaces this recommendation.',
        'Retirement is a scope action. It is taken only by the deciding authority and this record retires no route.',
      ],
    },
    selected: null,
    institutionalDecision: null,
    decisionRecord: null,
    preservedObligation: {
      capabilityId: obligation.capabilityId,
      gate: obligation.gate,
      obligation: obligation.obligation,
      closesInstitutionalDecision: obligation.closesInstitutionalDecision,
      statedBy: 'The frozen exception register, unchanged.',
      satisfiedByGate0C3: false,
      note: 'Whichever option the institution chooses, the four routes must not return an unsupported success response. This gate does not return 501 from them; the repair is owned by Gate 8 and stays open.',
    },
  }
}

/* ---------------------------------------------------------------------------------------------------------------- */
/* 5. Decision index.                                                                                                 */

function personaRows(src) {
  const productOf = new Map()
  const institutionOf = new Map()
  for (const row of src.reconciliation.rows) {
    for (const id of row.productDecisionIds ?? []) productOf.set(id, [...(productOf.get(id) ?? []), row.persona])
    for (const id of row.institutionalDecisionIds ?? []) institutionOf.set(id, [...(institutionOf.get(id) ?? []), row.persona])
  }
  return { productOf, institutionOf }
}

function decisionRecord(family, base, text) {
  return { family, ...base, ownerRole: text.ownerRole, ownerBasis: text.ownerBasis, requiredApprovalEvidence: text.approvalEvidence, adopted: false, closedByThisIndex: false, grantsInstitutionalAuthority: false }
}

export function buildDecisionIndex(src, debt) {
  const operations = operationIndex(src)
  const { productOf, institutionOf } = personaRows(src)
  const records = []
  const pdrsFor = (id) => sorted(src.productDecisions.records.filter((record) => record.productDecisionsToSettle.includes(id)).map((record) => record.recordId))
  const referencing = (id) => debt.items.filter((item) => item.decisionIds.includes(id))

  for (const decision of src.classification.institutionalDecisions) {
    const dependentOperations = sorted([...operations.values()].filter((operation) => (operation.institutionalDecisions ?? []).includes(decision.id)).map((operation) => operation.id))
    const carbon = decision.id === CARBON_DECISION_ID ? CARBON_OPERATIONS : []
    const allOperations = sorted(unique([...dependentOperations, ...carbon]))
    const capabilityIds = sorted(unique([...(decision.softwareOwners ?? []), ...allOperations.map((id) => operations.get(id)?.capabilityId).filter(Boolean)]))
    records.push(
      decisionRecord(
        'INVENTORY_INSTITUTIONAL',
        {
          decisionId: decision.id,
          title: decision.id,
          question: decision.question,
          source: { file: CLASSIFICATION_FILE, sha256: src.fileSha[CLASSIFICATION_FILE], sourceState: decision.sourceState },
          recordedDecisionOwner: null,
          currentState: decision.status,
          dependents: { personas: [], operationCount: allOperations.length, operations: allOperations, capabilityIds, personaRatificationRecords: [] },
        },
        FAMILY_TEXT.INVENTORY_INSTITUTIONAL,
      ),
    )
  }
  const baseline = src.baselineDecisions.decisions
  for (const decision of baseline.filter((item) => item.type === 'INSTITUTIONAL_AUTHORITY')) {
    records.push(
      decisionRecord(
        'BASELINE_INSTITUTIONAL_AUTHORITY',
        {
          decisionId: decision.id,
          title: decision.title,
          question: decision.question,
          source: { file: 'docs/union-eyes/convergence/register/ue-persona-proposed-baseline-decisions.json', sha256: src.fileSha['docs/union-eyes/convergence/register/ue-persona-proposed-baseline-decisions.json'] },
          recordedDecisionOwner: decision.decisionOwner,
          currentState: decision.status,
          dependents: { personas: sorted(unique([...(decision.personas ?? []).filter((p) => PERSONAS.includes(p)), ...(institutionOf.get(decision.id) ?? [])])), operationCount: 0, operations: [], capabilityIds: [], personaRatificationRecords: pdrsFor(decision.id) },
        },
        FAMILY_TEXT.BASELINE_INSTITUTIONAL_AUTHORITY,
      ),
    )
  }
  for (const decision of baseline.filter((item) => item.type === 'PRODUCT_DESIGN')) {
    records.push(
      decisionRecord(
        'BASELINE_PRODUCT',
        {
          decisionId: decision.id,
          title: decision.title,
          question: decision.question,
          source: { file: 'docs/union-eyes/convergence/register/ue-persona-proposed-baseline-decisions.json', sha256: src.fileSha['docs/union-eyes/convergence/register/ue-persona-proposed-baseline-decisions.json'] },
          recordedDecisionOwner: decision.decisionOwner,
          currentState: decision.status,
          dependents: { personas: sorted(unique([...(decision.personas ?? []).filter((p) => PERSONAS.includes(p)), ...(productOf.get(decision.id) ?? [])])), operationCount: 0, operations: [], capabilityIds: [], personaRatificationRecords: pdrsFor(decision.id) },
        },
        FAMILY_TEXT.BASELINE_PRODUCT,
      ),
    )
  }
  for (const decision of src.productDecisions.raisedByGate0C2) {
    records.push(
      decisionRecord(
        'GATE_0C2_PRODUCT',
        {
          decisionId: decision.id,
          title: decision.title,
          question: decision.question,
          source: { file: 'docs/union-eyes/convergence/register/ue-persona-product-decision-register-0c2.json', sha256: src.fileSha['docs/union-eyes/convergence/register/ue-persona-product-decision-register-0c2.json'] },
          recordedDecisionOwner: decision.decisionOwnerRole,
          currentState: decision.status,
          dependents: { personas: [decision.persona], operationCount: 0, operations: [], capabilityIds: [], personaRatificationRecords: pdrsFor(decision.id) },
        },
        FAMILY_TEXT.GATE_0C2_PRODUCT,
      ),
    )
  }
  for (const record of src.productDecisions.records) {
    records.push(
      decisionRecord(
        'PERSONA_RATIFICATION',
        {
          decisionId: record.recordId,
          title: `Ratification of ${record.artifact.packageId}`,
          question: `Does an authorized product owner accept ${record.artifact.packageId} ${record.artifact.version} as the product-specification baseline for the ${record.persona} persona?`,
          source: { file: 'docs/union-eyes/convergence/register/ue-persona-product-decision-register-0c2.json', sha256: src.fileSha['docs/union-eyes/convergence/register/ue-persona-product-decision-register-0c2.json'] },
          recordedDecisionOwner: record.decisionOwnerRole,
          currentState: record.state,
          dependents: { personas: [record.persona], operationCount: 0, operations: [], capabilityIds: [], personaRatificationRecords: [], settles: sorted(record.productDecisionsToSettle), dependentRequirements: src.reconciliation.rows.filter((row) => row.persona === record.persona).length },
        },
        FAMILY_TEXT.PERSONA_RATIFICATION,
      ),
    )
  }
  for (const record of records) {
    const items = referencing(record.decisionId)
    record.dependents.debtItemIds = sorted(items.map((item) => item.itemId))
    const releaseBlockingRefs = items.filter((item) => item.reportingClass === 'RELEASE_BLOCKING' || (item.reportingClass === 'AWAITING_ACCEPTED_DISPOSITION' && item.proposedDisposition === 'RELEASE_BLOCKING'))
    const text = FAMILY_TEXT[record.family]
    record.blocks = {
      scopeLock: text.scopeLock,
      implementation: text.implementation,
      release: record.family === 'PERSONA_RATIFICATION' || releaseBlockingRefs.length > 0 ? 'YES' : 'CONDITIONAL',
    }
    record.releaseBlockingBasis =
      record.family === 'PERSONA_RATIFICATION'
        ? 'A persona with no ratified canonical cannot have its journeys accepted in a credentialed browser run.'
        : `Referenced by ${items.length} release-debt items, ${releaseBlockingRefs.length} of them release blocking or proposed release blocking.`
    record.consequenceOfDeferral = text.consequence
  }
  records.sort((a, b) => compareCodeUnit(`${DECISION_FAMILIES.indexOf(a.family)}:${a.decisionId}`, `${DECISION_FAMILIES.indexOf(b.family)}:${b.decisionId}`))

  const ids = records.map((record) => record.decisionId)
  const duplicateIds = sorted(unique(ids.filter((id, index) => ids.indexOf(id) !== index)))
  const questions = records.map((record) => record.question.replace(/\s+/g, ' ').trim().toLowerCase())
  const duplicateQuestions = sorted(unique(records.filter((record, index) => questions.indexOf(questions[index]) !== index).map((record) => record.decisionId)))
  const known = new Set(ids)
  const overlaps = DECISION_OVERLAPS.map((overlap) => {
    for (const id of overlap.ids) if (!known.has(id)) throw new Error(`Decision overlap names the unknown decision ${id}`)
    return { ids: overlap.ids, relation: overlap.relation, note: overlap.note, merged: false, closes: false }
  })
  const institutional = records.filter((record) => record.ownerRole === 'INSTITUTION_TO_BE_NAMED')
  const parent = new Map(institutional.map((record) => [record.decisionId, record.decisionId]))
  const find = (id) => (parent.get(id) === id ? id : find(parent.get(id)))
  for (const overlap of overlaps) {
    if (overlap.relation !== 'OVERLAPPING_SCOPE') continue
    const [a, b] = overlap.ids
    if (parent.has(a) && parent.has(b)) parent.set(find(a), find(b))
  }
  const clusters = unique(institutional.map((record) => find(record.decisionId))).length
  return {
    schemaVersion: 1,
    register: 'UE-DECISION-INDEX',
    gate: GATE_ID,
    version: 1,
    anchorCommit: ANCHOR_COMMIT,
    preparedOn: PREPARED_ON,
    status: 'INDEXED_NONE_ADOPTED',
    note: 'One index over the five decision families that earlier gates recorded. Totals are not added blindly: the families are separate record types, an exact duplicate identifier is rejected, and overlapping scopes are listed as pairs and never merged or closed. No decision is adopted, closed or recommended by this index. A product approval of a persona package is a product-specification baseline and never an institutional grant.',
    families: DECISION_FAMILIES.map((family) => ({
      family,
      count: records.filter((record) => record.family === family).length,
      ownerRole: FAMILY_TEXT[family].ownerRole,
      requiredApprovalEvidence: FAMILY_TEXT[family].approvalEvidence,
      blocksScopeLock: FAMILY_TEXT[family].scopeLock,
      blocksImplementation: FAMILY_TEXT[family].implementation,
    })),
    lineage: { debtIndexSha256: sha256Of(debt) },
    totals: {
      distinctRecords: records.length,
      byFamily: countBy(records, (record) => record.family),
      byOwnerRole: countBy(records, (record) => record.ownerRole),
      byCurrentState: countBy(records, (record) => record.currentState),
      exactDuplicateIds: duplicateIds,
      duplicateQuestions,
      overlapPairs: overlaps.length,
      overlapByRelation: countBy(overlaps, (overlap) => overlap.relation),
      institutionalRecords: institutional.length,
      institutionalScopeClustersAfterOverlap: clusters,
      clusterNote: 'The cluster count collapses only the reviewed OVERLAPPING_SCOPE pairs. It is an upper bound on independent institutional authorities, not a claim that the overlap list is exhaustive.',
      adopted: 0,
      closed: 0,
      blockingRelease: records.filter((record) => record.blocks.release === 'YES').length,
    },
    overlaps,
    decisions: records,
  }
}

/* ---------------------------------------------------------------------------------------------------------------- */
/* 6. Defect overlap relationship map.                                                                                */

export function buildRelationshipMap(src, assessment, debt) {
  const defects = defectIndex(src)
  const itemOf = new Map(debt.items.map((item) => [item.sourceId, item]))
  const member = (id) => {
    const defect = need(defects, id.startsWith('DEF-') ? id : `DEF-${id}`, 'defect')
    const item = itemOf.get(defect.id) ?? null
    return {
      defectId: defect.id,
      severity: defect.severity,
      releaseBlocking: defect.releaseBlocking,
      frozenDisposition: defect.releaseDisposition?.disposition ?? null,
      debtItemId: item?.itemId ?? null,
      merged: false,
      severityChangedByGate0C3: false,
    }
  }
  const clusters = CLUSTERS.map((cluster) => ({
    clusterId: cluster.id,
    relation: cluster.relation,
    rootCause: cluster.rootCause,
    members: cluster.members.map(member),
    related: cluster.related.map(member),
    relatedNote: cluster.relatedNote,
    severityFinding: cluster.severityFinding,
    repairImplication: cluster.repairImplication,
    obligationsStayPerDefect: true,
  }))
  const perCapita = ['DEF-0B8-JUR-HEALTH-WELFARE-PLANS-PATH-IS-THE-PER-CAPITA-REMITTANCE-LEDGER-AT-MEMBER-FLOOR', 'DEF-0B12-CRUD-TAX-PATHS-SERVE-THE-PER-CAPITA-REMITTANCE-LEDGER-TO-ANY-MEMBER'].map(member)
  const challenges = src.challenges.challenges.map((challenge) => ({
    challengeId: challenge.id,
    relation: 'CHALLENGE_OF_FROZEN_DISPOSITION',
    defect: member(challenge.challengedDefectId),
    challengePosition: challenge.reviewerPosition,
    frozenDispositionSupersededByChallenge: false,
    challengeSupersededByFrozenDisposition: false,
    debtItemId: itemOf.get(challenge.challengedDefectId)?.itemId ?? null,
  }))
  const exposures = src.classification.releaseBlockingExposures.map((exposure) => ({
    operationId: exposure.id,
    ownerGate: exposure.ownerGate,
    releaseBlocking: exposure.releaseBlocking,
    contractSha256: exposure.contractSha256,
    defects: exposure.defects.map(member),
  }))
  const exposureDefects = sorted(unique(src.classification.releaseBlockingExposures.flatMap((exposure) => exposure.defects)))
  const ratchetItems = debt.items.filter((item) => item.itemKind === 'TRACKED_ITEM')
  const ratchets = src.ratchets.rules.map((rule) => {
    const tracked = ratchetItems.filter((item) => item.trackedKind === 'RATCHET' && item.sourceId.split('@')[0] === rule.id)
    return {
      ruleId: rule.id,
      trackedItems: tracked.map((item) => ({ itemId: item.itemId, file: item.trackedFile, ownerCapabilityId: item.ownerCapabilityId })),
      exactRegisterDefect: null,
    }
  })
  const relatedRatchet = {
    ruleId: 'DIRECT-MANDATORY-AUDIT-IMPORT',
    trackedItemId: 'DEBT:DIRECT-MANDATORY-AUDIT-IMPORT@election-succession',
    relatedDefect: member('DEF-0B1-NON-ATOMIC-AUDIT-INTENT-OUTCOME'),
    relation: 'SAME_OWNER_CAPABILITY_RELATED_AUDIT_ATOMICITY_THEME',
    note: 'Both sit under the audit-atomicity capability. The register defect concerns a manifest claim of atomic audit in route handlers and the ratchet concerns a direct import in one module. Neither is a duplicate of the other, they are not merged and neither severity changes.',
    merged: false,
  }
  return {
    schemaVersion: 1,
    register: 'UE-DEFECT-RELATIONSHIP-MAP',
    gate: GATE_ID,
    version: 1,
    anchorCommit: ANCHOR_COMMIT,
    preparedOn: PREPARED_ON,
    status: 'RELATIONSHIPS_RECORDED_NO_MERGE_NO_DOWNGRADE',
    note: 'A map of defects that share a root cause or operations. It merges no defect, changes no severity and drops no obligation. A relationship explains why one repair can cover several defects; each defect keeps its own record, its own owner and its own acceptance condition.',
    lineage: { debtIndexSha256: sha256Of(debt), assessmentSha256: sha256Of(assessment) },
    totals: {
      clusters: clusters.length,
      clusterMembers: clusters.reduce((sum, cluster) => sum + cluster.members.length, 0),
      defectsMerged: 0,
      severitiesChanged: 0,
      challengePairs: challenges.length,
      exposureOperations: exposures.length,
      exposureDefects: exposureDefects.length,
      exposureReleaseBlockingDefects: exposureDefects.filter((id) => need(defects, id, 'defect').releaseBlocking === true).length,
      ratchetRules: ratchets.length,
      trackedItems: ratchetItems.length,
    },
    perCapitaSeverityPair: {
      members: perCapita,
      finding: CLUSTERS.find((cluster) => cluster.id === 'CLUSTER-PER-CAPITA-LEDGER-GENERIC-CRUD').severityFinding,
      changed: false,
      reviewRequired: 'An independent severity review decides whether the MEDIUM health-and-welfare path should carry the HIGH rating of the four tax paths that serve the same ledger at the same floor.',
    },
    clusters,
    challengePairs: challenges,
    exposures,
    ratchets: { rules: ratchets, relatedRegisterDefect: relatedRatchet, trackedItemsWithNoRegisterCounterpart: ratchetItems.map((item) => item.itemId) },
  }
}

/* ---------------------------------------------------------------------------------------------------------------- */
/* 7. Two-level closure model.                                                                                        */

export function buildClosureModel(src, assessment, debt, decisions, challenges, carbon) {
  const handoffRuntime = src.handoff.obligations.find((obligation) => obligation.id === 'OBL-0C-RUNTIME-QUALIFICATION')
  const totals = src.matrix.routeInventoryTotals
  const unresolvedPersonas = (src.matrix.personaCompleteness ?? []).filter((persona) => persona.resolved === false).map((persona) => persona.persona)
  const classified = Object.entries(totals).filter(([name]) => name !== 'operations').reduce((sum, [, value]) => sum + value, 0)
  const level1State = {
    EXHAUSTIVE_ROUTE_INVENTORY: [classified === totals.operations && totals.SCOPE_UNDECIDED_AWAITING_CLASSIFICATION === 0, [`${totals.operations} route-method operations, each in exactly one of six classes, 0 awaiting classification.`], []],
    OWNERSHIP_OR_EXCEPTION: [
      carbon.operations.every((op) => op.adopted === false && op.authorized === false && op.countedAsOwned === false),
      [`${totals.OWNED} owned, ${totals.RETIRED_501} retired, ${totals.STUB_501} stubbed, ${totals.SYSTEM} system and ${totals.DECISION_BOUND_SCOPE_EXCEPTION} non-authorizing decision-bound scope exceptions.`],
      [`${totals.DECISION_BOUND_SCOPE_EXCEPTION} carbon operations wait on ${CARBON_DECISION_ID}.`],
    ],
    PERSONA_TRACEABILITY: [
      decisions.decisions.filter((decision) => decision.family === 'PERSONA_RATIFICATION').length === unresolvedPersonas.length,
      [`${unresolvedPersonas.length} unresolved personas each carry a proposed baseline, a decision package and a versioned decision record.`],
      unresolvedPersonas.map((persona) => `${persona} has no ratified canonical.`),
    ],
    HISTORICAL_UNCERTAINTY: [true, ['The 182 historical identifiers, the unrecovered canonicals and the 0B and 0C tranche records keep their evidence status and their hashes.'], []],
    DOWNSTREAM_OWNERSHIP: [
      debt.items.every((item) => item.engineeringObligation.ownerCapabilityId && item.engineeringObligation.targetGate !== undefined && item.engineeringObligation.sourceReference && item.engineeringObligation.acceptanceCondition),
      [`${debt.totals.uniqueItems} unique release-debt items each carry an engineering owner, a target gate, a source reference and an acceptance condition.`],
      ['The 71 proposed dispositions are not accepted; ownership does not depend on their acceptance.'],
    ],
    UNRESOLVED_DECISIONS_EXPLICIT: [decisions.totals.adopted === 0, [`${decisions.totals.distinctRecords} decision records are listed with their state; ${decisions.totals.adopted} are adopted.`], []],
    NO_FABRICATED_ACCEPTANCE: [assessment.totals.accepted === 0 && debt.totals.acceptedReleaseDecisions === 0 && carbon.selected === null, ['No persona, disposition, challenge, decision or carbon option is recorded as accepted or selected.'], []],
  }
  const level1 = CLOSURE_LEVEL_1.map(([id, label, requirement]) => {
    const [ok, evidence, remaining] = level1State[id]
    return { id, label, requirement, state: ok ? 'SATISFIED_BY_RECORD' : 'NOT_SATISFIED', evidence, remainingItems: remaining }
  })
  const level2State = {
    AUTHORIZED_SECURITY_AND_BUSINESS_DECISIONS: ['OPEN', `${decisions.totals.adopted} of ${decisions.totals.distinctRecords} decision records are adopted.`],
    CORRECTIVE_IMPLEMENTATION: ['NOT_STARTED', `${debt.totals.repairObligations} repair obligations are open; none is repaired.`],
    RUNTIME_TENANT_ISOLATION_PROOF: ['NOT_STARTED', `0 executed isolation proofs are on file; ${challenges.challenges.length} challenged dispositions have no containment proof.`],
    NATIVE_DATABASE_AND_MIGRATION_QUALIFICATION: ['NOT_STARTED', `Native verification is ${handoffRuntime.nativeVerified}; ${handoffRuntime.nativePending} of ${handoffRuntime.capabilities} capabilities are pending.`],
    CREDENTIALED_BROWSER_ACCEPTANCE: ['NOT_STARTED', `Browser verification is ${handoffRuntime.browserVerified}; ${handoffRuntime.browserPending} capabilities are pending.`],
    REGRESSION_AND_GOVERNANCE_CONTROLS: ['OPEN', 'The focused governance suites run and are not release regression evidence.'],
    RELEASE_DEBT_CLOSED_OR_AUTHORIZED: ['OPEN', `${debt.totals.releaseBlockingRegisterDefects} release-blocking register defects, ${debt.totals.closedObligations} closed obligations and ${debt.totals.acceptedReleaseDecisions} accepted release decisions.`],
  }
  const level2 = CLOSURE_LEVEL_2.map(([id, label, requirement]) => ({ id, label, requirement, state: level2State[id][0], evidence: level2State[id][1] }))
  const blockers = [
    ...unresolvedPersonas.map((persona) => ({ id: `PERSONA-${persona.toUpperCase()}`, kind: 'PRODUCT_OWNER_DECISION', description: `${persona} has no ratified canonical. The product owner decides the proposed package; this gate does not.` })),
    { id: 'CARBON-DECISION-BOUND-EXCEPTIONS', kind: 'INSTITUTIONAL_DECISION', description: `${totals.DECISION_BOUND_SCOPE_EXCEPTION} carbon operations stay decision-bound exceptions until ${CARBON_DECISION_ID} is decided by the deciding authority.` },
    { id: 'GATE-0C3-INDEPENDENT-REVIEW', kind: 'INDEPENDENT_REVIEW', description: 'The Gate 0C.3 registers are not accepted until an independent adversarial review accepts them.' },
  ]
  return {
    schemaVersion: 1,
    register: 'UE-CLOSURE-MODEL',
    gate: GATE_ID,
    version: 1,
    anchorCommit: ANCHOR_COMMIT,
    preparedOn: PREPARED_ON,
    status: 'MODEL_NOT_A_VERDICT',
    note: 'Two separate levels of closure. Gate 0 scope-lock completion is about whether the scope is fully described, owned and honestly unresolved. Release acceptance additionally needs authorized decisions, repairs, runtime proof and credentialed acceptance. A Gate 0 verdict is never a release authorization.',
    gate0Verdict: src.matrix.gate0Verdict,
    separation: 'A Gate 0 verdict is never a release authorization.',
    lineage: { assessmentSha256: sha256Of(assessment), debtIndexSha256: sha256Of(debt), decisionIndexSha256: sha256Of(decisions), challengeTreatmentSha256: sha256Of(challenges), carbonRecordSha256: sha256Of(carbon) },
    level1: {
      name: 'GATE_0_SCOPE_LOCK_COMPLETION',
      criteria: level1,
      criteriaSatisfiedByRecord: level1.filter((criterion) => criterion.state === 'SATISFIED_BY_RECORD').length,
      certificationBlockers: blockers,
      certifiable: false,
      note: 'The criteria describe what the record must show. The blockers are the unfinished Gate 0 scope that the completion matrix carries. Both must clear before a Gate 0 certification is proposed.',
    },
    level2: {
      name: 'RELEASE_ACCEPTANCE',
      additionalTo: 'GATE_0_SCOPE_LOCK_COMPLETION',
      criteria: level2,
      releaseAuthorization: 'NOT_GRANTED',
      productionGo: false,
      readinessGate: { id: 'UE_SAAS_OPERATIONAL_READINESS', ruling: 'NO_GO', source: CERTIFICATION_RULING_DOC },
    },
  }
}

/* ---------------------------------------------------------------------------------------------------------------- */

export function buildAll(src) {
  const assessment = buildAssessment(src)
  const debt = buildDebtIndex(src, assessment)
  const challenges = buildChallengeTreatment(src, debt)
  const carbon = buildCarbonDecision(src, assessment)
  const decisions = buildDecisionIndex(src, debt)
  const relationships = buildRelationshipMap(src, assessment, debt)
  const closure = buildClosureModel(src, assessment, debt, decisions, challenges, carbon)
  return { assessment, debt, challenges, carbon, decisions, relationships, closure }
}

export { CHALLENGE_IDS, CHALLENGE_POSITION, EXPOSURE_OPERATIONS, OPL_DEFECTS, CARBON_OPTION_IDS, DOCS_0C3, FILES_0C3, clone }
