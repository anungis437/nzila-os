/**
 * Validator for the Gate 0C.3 registers. It checks the registers against live sources and against the evidence the accepted
 * Gate 0C.2 commit froze, then against a full regeneration. Each problem starts with a stable code so a negative test can
 * name the failure it expects.
 */
import { defectHash } from './ue-gate0b7-release-dispositions.mjs'
import {
  ANCHOR_COMMIT,
  ASSESSMENT_STATE,
  CARBON_DECISION_ID,
  CARBON_OPERATIONS,
  CERTIFICATION_RULING_DOC,
  CHALLENGE_IDS,
  CHALLENGE_POSITION,
  DOCS_0C3,
  EVIDENCE_BASIS,
  EXPOSURE_OPERATIONS,
  FILES_0C3,
  FROZEN_TOTALS,
  GATE_ID,
  HANDOFF_FILE,
  OPL_DEFECTS,
  QUEUE_FILE,
  RECORD_TYPES,
  TRACKED_ITEMS,
} from './ue-gate0c3-ids.mjs'
import { buildAll, serialize, sha256Of, unique } from './ue-gate0c3-reconcile.mjs'
import { renderDocs } from './ue-gate0c3-render.mjs'

const FORBIDDEN_STATUS = /"(status|state|implementationStatus|runtimeQualification|verdict|releaseEffect)"\s*:\s*"(complete|completed|green|ready|delivered|PROVEN_IN_STAGING|APPROVED|ACCEPTED|ADOPTED|GO)"/i
const PRODUCTION_GO = /"(productionGo|releaseGranted|releaseAuthorized)"\s*:\s*true|"releaseAuthorization"\s*:\s*"(GRANTED|AUTHORIZED)"|\bProduction GO: true\b|\bRelease authorization: (GRANTED|AUTHORIZED)\b/i
const PRODUCT_FAMILIES = ['BASELINE_PRODUCT', 'GATE_0C2_PRODUCT', 'PERSONA_RATIFICATION']
const INSTITUTIONAL_FAMILIES = ['INVENTORY_INSTITUTIONAL', 'BASELINE_INSTITUTIONAL_AUTHORITY']
const HISTORICAL_TOTAL_KEYS = ['routeInventoryTotals', 'personaCompleteness', 'proposedPersonaBaselines']
const PIN_BLOCKS = [
  'routeClassification',
  'routeClassification0b2',
  'routeClassification0b3',
  'routeClassification0b4',
  'routeClassification0b5',
  'routeClassification0b6',
  'routeClassification0b7',
  'routeClassification0b8',
  'routeClassification0b9',
  'routeClassification0b10',
  'routeClassification0b11',
  'routeClassification0b12',
  'routeClassification0c1',
  'routeUniverseTransition',
  'gate0cHandoff',
  'personaReadiness0c2',
  'releaseDispositionChallenges',
  'decisionBoundExceptions',
]

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const pinOf = (block) => block?.files ?? { file: block?.file, sha256: block?.sha256 }
const sameIds = (a, b) => a.length === b.length && a.every((value, index) => value === b[index])

function quotePairs(value, out = []) {
  if (Array.isArray(value)) for (const item of value) quotePairs(item, out)
  else if (value && typeof value === 'object') {
    if (typeof value.ref === 'string' && typeof value.quote === 'string') out.push({ ref: value.ref, quote: value.quote })
    for (const item of Object.values(value)) quotePairs(item, out)
  }
  return out
}

/**
 * Validates the Gate 0C.3 registers. `frozen` carries the accepted Gate 0C.2 evidence; a missing `frozen` is itself a problem
 * so the freeze cannot be skipped silently. `readText(path)` returns repository file text for quote and ruling checks.
 */
export function validateReleaseDebt({ registers, src, frozen, docs, liveFileSha, readText: readRaw }) {
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
  const keys = Object.keys(FILES_0C3)
  const missing = keys.filter((key) => !registers?.[key])
  if (missing.length > 0) return [`REGISTER-ABSENT: ${missing.map((key) => FILES_0C3[key]).join(', ')} missing`]
  const { assessment, debt, challenges, carbon, decisions, relationships, closure } = registers

  let expected
  try {
    expected = buildAll(src)
  } catch (error) {
    return [`BUILD-FAILED: the registers cannot be regenerated from the sources: ${error.message}`]
  }

  const defects = new Map((src.classification?.defectRegister ?? []).map((defect) => [defect.id, defect]))
  const queueEntries = src.queue?.entries ?? []

  // Frozen evidence is unchanged.
  if (!frozen?.matrix || !frozen.classification || !frozen.queue || !frozen.challenges || !frozen.exceptions || !frozen.handoff) problems.push('FROZEN-ABSENT: the accepted Gate 0C.2 evidence is not available for comparison')
  else {
    for (const [name, live, anchor] of [
      ['classification', src.classification, frozen.classification],
      ['review queue', src.queue, frozen.queue],
      ['challenge register', src.challenges, frozen.challenges],
      ['decision-bound exception register', src.exceptions, frozen.exceptions],
      ['handoff register', src.handoff, frozen.handoff],
    ]) {
      if (!same(live, anchor)) problems.push(`HISTORY-MUTATED: the ${name} differs from the accepted Gate 0C.2 commit ${ANCHOR_COMMIT.slice(0, 12)}`)
    }
    for (const name of PIN_BLOCKS) {
      if (name === 'personaReadiness0c2' && !frozen.matrix[name]) continue
      if (!same(pinOf(frozen.matrix[name]), pinOf(src.matrix[name]))) problems.push(`HISTORY-MUTATED: ${name} no longer matches the accepted Gate 0C.2 evidence`)
    }
    for (const name of HISTORICAL_TOTAL_KEYS) if (!same(frozen.matrix[name], src.matrix[name])) problems.push(`HISTORY-MUTATED: ${name} differs from the accepted Gate 0C.2 matrix`)
    if (!same((frozen.matrix.capabilities ?? []).map((item) => item.id), (src.matrix.capabilities ?? []).map((item) => item.id))) problems.push('HISTORY-MUTATED: the capability lock differs from the accepted Gate 0C.2 matrix')
    if (src.matrix.routeInventoryTotals?.operations !== FROZEN_TOTALS.operations) problems.push(`HISTORY-MUTATED: the route inventory holds ${src.matrix.routeInventoryTotals?.operations} operations, the accepted total is ${FROZEN_TOTALS.operations}`)
    if (src.matrix.gate0Verdict !== frozen.matrix.gate0Verdict) problems.push('GATE0-AS-GO: the Gate 0 verdict differs from the accepted Gate 0C.2 matrix')
  }
  for (const [name, accepted] of Object.entries(FROZEN_TOTALS)) {
    const entry = debt.frozenEvidence?.totals?.[name]
    if (!entry || entry.accepted !== accepted) problems.push(`FROZEN-TOTALS: ${name} is not recorded against the accepted total ${accepted}`)
    else if (entry.matchesAccepted !== (entry.observed === accepted)) problems.push(`FROZEN-TOTALS: ${name} misreports whether the observed total matches`)
  }
  for (const [name, entry] of Object.entries(debt.frozenEvidence?.totals ?? {})) if (entry.matchesAccepted !== true) problems.push(`FROZEN-TOTALS: ${name} observed ${entry.observed}, accepted ${entry.accepted}`)

  // 71 earlier HIGH defects: all present, hashes and severities as frozen.
  const queueIds = queueEntries.map((entry) => entry.defectId)
  const assessed = (assessment.assessments ?? []).map((item) => item.defectId)
  if (queueIds.length !== FROZEN_TOTALS.earlierHighAwaitingQualification) problems.push(`HIGH-MISSING: the review queue holds ${queueIds.length} defects, the accepted total is ${FROZEN_TOTALS.earlierHighAwaitingQualification}`)
  for (const id of queueIds) if (!assessed.includes(id)) problems.push(`HIGH-MISSING: ${id} has no release assessment`)
  for (const id of assessed) if (!queueIds.includes(id)) problems.push(`HIGH-MISSING: assessment ${id} is not a review-queue defect`)
  for (const entry of queueEntries) {
    const defect = defects.get(entry.defectId)
    if (!defect) problems.push(`HIGH-MISSING: ${entry.defectId} is not in the consolidated defect register`)
    else if (defect.severity !== 'HIGH') problems.push(`SEVERITY-CHANGED: ${entry.defectId} is ${defect.severity} in the defect register and HIGH in the review queue`)
  }
  if (unique(assessed).length !== assessed.length) problems.push('DUPLICATE-INFLATION: the assessment lists a defect more than once')
  for (const item of assessment.assessments ?? []) {
    const label = item.defectId
    const defect = defects.get(label)
    const queued = queueEntries.find((entry) => entry.defectId === label)
    if (defect && item.frozenRecord?.defectSha256 !== defectHash(defect)) problems.push(`FROZEN-HASH: ${label} assessment hash is not the hash of the frozen defect record`)
    if (queued && item.frozenRecord?.defectSha256 !== queued.defectSha256) problems.push(`FROZEN-HASH: ${label} assessment hash is not the review queue hash`)
    if (queued && defect && queued.defectSha256 !== defectHash(defect)) problems.push(`FROZEN-HASH: ${label} defect record no longer matches its queue hash`)
    if (defect && (item.frozenRecord?.originalSeverity !== defect.severity || item.proposedDisposition?.severityChanged !== false)) problems.push(`SEVERITY-CHANGED: ${label} severity differs from the frozen record`)
    if (item.frozenRecord?.modifiedByGate0C3 !== false) problems.push(`HISTORY-MUTATED: ${label} is recorded as modified by Gate 0C.3`)
    if (item.containment?.verified !== false || (item.containment?.executedProof ?? []).length > 0 || (item.evidence?.executedProof ?? []).length > 0) problems.push(`INVENTED-CONTAINMENT: ${label} records containment or executed proof that no run produced`)
    if (item.evidence?.basis !== EVIDENCE_BASIS) problems.push(`INVENTED-CONTAINMENT: ${label} evidence basis is ${item.evidence?.basis}`)
    if (item.proposedDisposition?.state !== ASSESSMENT_STATE || item.proposedDisposition?.acceptedBy !== null || item.proposedDisposition?.acceptedOn !== null) problems.push(`UNRESOLVED-AS-APPROVED: ${label} proposed disposition is recorded as accepted`)
    if (item.proposedDisposition?.value === 'REVIEW_REQUIRED' && !(item.proposedDisposition.reviewReasons?.length > 0)) problems.push(`UNRESOLVED-AS-APPROVED: ${label} is under-evidenced and states no review reasons`)
    if (item.proposedDisposition?.value !== 'REVIEW_REQUIRED' && !item.proposedDisposition?.rubricKey) problems.push(`UNRESOLVED-AS-APPROVED: ${label} proposes a disposition with no rubric`)
    if (!(item.affected?.operationCount >= 0) || !item.impact?.classes || !item.sourceExposure?.activationState || typeof item.runtimeQualification?.needed !== 'boolean') problems.push(`OWNERSHIP-INCOMPLETE: ${label} omits exposure, impact, activation or runtime qualification`)
  }
  if (assessment.status !== ASSESSMENT_STATE || assessment.totals?.accepted !== 0 || assessment.totals?.executedProofs !== 0 || assessment.totals?.severityChanged !== 0) problems.push('UNRESOLVED-AS-APPROVED: the assessment register reports accepted determinations, executed proofs or changed severities')
  if (assessment.queue?.sha256 !== undefined && liveFileSha && assessment.queue.sha256 !== liveFileSha(QUEUE_FILE)) problems.push('FROZEN-HASH: the assessment pins a review queue that is not the file on disk')

  // Release-debt index: nothing omitted, nothing counted twice, every item owned.
  const items = debt.items ?? []
  const itemIds = items.map((item) => item.itemId)
  if (unique(itemIds).length !== itemIds.length) problems.push('DUPLICATE-INFLATION: the release-debt index lists an item more than once')
  const sourceIds = items.map((item) => item.sourceId)
  if (unique(sourceIds).length !== sourceIds.length) problems.push('DUPLICATE-INFLATION: two release-debt items share one source record')
  const obligationIds = items.map((item) => item.engineeringObligation?.obligationId)
  if (unique(obligationIds).length !== obligationIds.length) problems.push('DUPLICATE-INFLATION: two release-debt items share one repair obligation')
  if (debt.totals?.uniqueItems !== items.length || debt.totals?.repairObligations !== items.length) problems.push(`DUPLICATE-INFLATION: the index reports ${debt.totals?.uniqueItems} items and holds ${items.length}`)
  if (debt.totals?.listedInstances - debt.totals?.duplicateInflationAvoided !== items.length) problems.push('DUPLICATE-INFLATION: listings minus avoided duplicates is not the unique item count')

  const required = new Set()
  for (const defect of defects.values()) {
    const disposition = defect.releaseDisposition?.disposition
    if (defect.releaseBlocking === true || disposition === 'RELEASE_BLOCKING' || disposition === 'CONDITIONALLY_BLOCKING') required.add(defect.id)
  }
  for (const id of queueIds) required.add(id)
  for (const operation of src.tranches.flatMap((tranche) => tranche.operations)) if (EXPOSURE_OPERATIONS.includes(operation.id)) for (const id of operation.defects ?? []) if (defects.get(id)?.releaseBlocking === true) required.add(id)
  for (const id of OPL_DEFECTS) required.add(id)
  for (const id of required) if (!sourceIds.includes(id)) problems.push(`DEBT-OMISSION: ${id} is release-blocking, conditional, awaiting qualification or challenged and is not in the release-debt index`)
  for (const id of Object.keys(TRACKED_ITEMS)) if (!sourceIds.includes(id)) problems.push(`DEBT-OMISSION: tracked item ${id} is not in the release-debt index`)
  for (const id of EXPOSURE_OPERATIONS) {
    if (!(relationships.exposures ?? []).some((item) => item.operationId === id)) problems.push(`DEBT-OMISSION: public exposure ${id} is not in the relationship map`)
  }
  const handoff = src.handoff?.obligations ?? []
  for (const obligation of handoff) {
    const entry = (debt.handoffObligations ?? []).find((item) => item.obligationId === obligation.id)
    if (!entry) problems.push(`DEBT-OMISSION: handoff obligation ${obligation.id} is not carried by the release-debt index`)
    else if (entry.closed !== false || entry.statusAfterGate0C3 !== entry.statusBefore) problems.push(`UNRESOLVED-AS-APPROVED: handoff obligation ${obligation.id} is recorded as closed or changed`)
  }

  for (const item of items) {
    const label = item.itemId
    const obligation = item.engineeringObligation ?? {}
    if (!obligation.ownerCapabilityId || !obligation.ownerBasis || obligation.targetGate === undefined || obligation.targetGate === null || !obligation.sourceReference?.register || !obligation.acceptanceCondition?.behavior || !obligation.acceptanceCondition?.release) problems.push(`OWNERSHIP-INCOMPLETE: ${label} lacks an owner, a target gate, a source reference or an acceptance condition`)
    else if (!src.matrix.capabilities.some((capability) => capability.id === obligation.ownerCapabilityId)) problems.push(`OWNERSHIP-INCOMPLETE: ${label} owner ${obligation.ownerCapabilityId} is not in the capability lock`)
    if (obligation.ownerBasis !== 'ACCOUNTABILITY_NOT_AUTHORIZATION') problems.push(`OWNERSHIP-INCOMPLETE: ${label} does not state that ownership is accountability and not authorization`)
    if (obligation.state !== 'OPEN') problems.push(`UNRESOLVED-AS-APPROVED: ${label} repair obligation is ${obligation.state} with no repair or proof on file`)
    if (!same(Object.keys(item.recordTypes ?? {}), RECORD_TYPES)) problems.push(`OWNERSHIP-INCOMPLETE: ${label} does not keep the six record types distinct`)
    if (item.recordTypes?.acceptedReleaseDecision !== null) problems.push(`UNRESOLVED-AS-APPROVED: ${label} carries an accepted release decision and none exists`)
    const defect = defects.get(item.sourceId)
    if (defect) {
      if (item.frozenDefectSha256 !== defectHash(defect)) problems.push(`FROZEN-HASH: ${label} pins a hash that is not the frozen defect record`)
      if (item.severity !== defect.severity) problems.push(`SEVERITY-CHANGED: ${label} severity ${item.severity} differs from the frozen ${defect.severity}`)
      if (item.frozenReleaseBlocking !== (defect.releaseBlocking ?? null) || item.frozenDisposition !== (defect.releaseDisposition?.disposition ?? null)) problems.push(`HISTORY-MUTATED: ${label} misstates the frozen release disposition`)
      if (defect.releaseDisposition?.disposition === 'RELEASE_BLOCKING' && item.reportingClass !== 'RELEASE_BLOCKING') problems.push(`UNRESOLVED-AS-APPROVED: ${label} is a frozen RELEASE_BLOCKING disposition reported as ${item.reportingClass}`)
      if (defect.releaseBlocking === true && !['RELEASE_BLOCKING', 'CONDITIONALLY_BLOCKING_CHALLENGED'].includes(item.reportingClass)) problems.push(`UNRESOLVED-AS-APPROVED: ${label} is frozen release blocking and reported as ${item.reportingClass}`)
      if (defect.releaseDisposition?.disposition === 'CONDITIONALLY_BLOCKING' && !['CONDITIONALLY_BLOCKING', 'CONDITIONALLY_BLOCKING_CHALLENGED'].includes(item.reportingClass)) problems.push(`UNRESOLVED-AS-APPROVED: ${label} is a frozen CONDITIONALLY_BLOCKING disposition reported as ${item.reportingClass}`)
    } else if (!TRACKED_ITEMS[item.sourceId]) problems.push(`DEBT-OMISSION: ${label} names a source record that is neither a frozen defect nor a tracked item`)
  }
  const classCounts = {}
  for (const item of items) classCounts[item.reportingClass] = (classCounts[item.reportingClass] ?? 0) + 1
  if (!same(Object.fromEntries(Object.entries(classCounts).sort(([a], [b]) => (a < b ? -1 : 1))), debt.totals?.byReportingClass)) problems.push('DUPLICATE-INFLATION: the reporting-class totals do not equal the items they count')
  if (debt.totals?.acceptedReleaseDecisions !== 0 || debt.totals?.closedObligations !== 0) problems.push('UNRESOLVED-AS-APPROVED: the index reports accepted release decisions or closed obligations')

  // OPL challenges are preserved and never superseded.
  const frozenChallenges = frozen?.challenges?.challenges ?? src.challenges?.challenges ?? []
  for (const challenge of frozenChallenges) if (!(challenges.challenges ?? []).some((item) => item.challengeId === challenge.id || item.challengeId === challenge.challengeId)) problems.push(`CHALLENGE-REMOVED: ${challenge.id ?? challenge.challengeId} is missing from the challenge treatment`)
  if (!sameIds((challenges.challenges ?? []).map((item) => item.challengeId), CHALLENGE_IDS)) problems.push(`CHALLENGE-REMOVED: the challenge treatment lists ${(challenges.challenges ?? []).length} challenges, expected ${CHALLENGE_IDS.join(', ')}`)
  if ((src.challenges?.challenges ?? []).length !== CHALLENGE_IDS.length) problems.push('CHALLENGE-REMOVED: the challenge register no longer holds both challenges')
  for (const challenge of challenges.challenges ?? []) {
    const label = challenge.challengeId
    const treatment = challenge.treatment ?? {}
    if (challenge.challengePosition !== CHALLENGE_POSITION || treatment.effectivePosture !== CHALLENGE_POSITION) problems.push(`CHALLENGE-REMOVED: ${label} no longer holds ${CHALLENGE_POSITION}`)
    if (treatment.challengePreserved !== true || treatment.supersededBy !== null || treatment.withdrawn !== false || treatment.frozenDispositionModified !== false) problems.push(`CHALLENGE-REMOVED: ${label} is recorded as superseded, withdrawn or resolved`)
    if (treatment.acceptedReleaseDecision !== null) problems.push(`UNRESOLVED-AS-APPROVED: ${label} carries an accepted release decision`)
    if (challenge.containment?.verified !== false || challenge.containment?.executedProofOnFile !== 0) problems.push(`INVENTED-CONTAINMENT: ${label} records verified containment with no executed proof`)
    if (challenge.frozenRecord?.disposition !== 'CONDITIONALLY_BLOCKING' || challenge.frozenRecord?.modifiedByGate0C3 !== false) problems.push(`HISTORY-MUTATED: ${label} frozen CONDITIONALLY_BLOCKING record was altered`)
    const defect = defects.get(challenge.challengedDefectId)
    if (!defect || defect.releaseDisposition?.disposition !== 'CONDITIONALLY_BLOCKING' || challenge.frozenRecord?.defectSha256 !== defectHash(defect)) problems.push(`FROZEN-HASH: ${label} frozen defect hash or disposition differs from the defect register`)
    const item = items.find((entry) => entry.sourceId === challenge.challengedDefectId)
    if (!item || item.reportingClass !== 'CONDITIONALLY_BLOCKING_CHALLENGED' || item.challengePosition !== CHALLENGE_POSITION || item.recordTypes?.challenge !== label) problems.push(`CHALLENGE-REMOVED: ${label} is not carried by the release-debt index as a challenged item`)
  }
  if (challenges.flag?.enforcedInAllReleasePaths !== expected.challenges.flag.enforcedInAllReleasePaths) problems.push('INVENTED-CONTAINMENT: the challenge treatment misstates whether the canonical bootstrap flag is enforced in every release path')
  if (challenges.newSourceEvidence?.materialChange !== expected.challenges.newSourceEvidence.materialChange) problems.push('CHALLENGE-REMOVED: the new-source-evidence finding differs from the repository comparison with the challenge commit')
  for (const pair of relationships.challengePairs ?? []) if (pair.frozenDispositionSupersededByChallenge !== false || pair.challengeSupersededByFrozenDisposition !== false) problems.push(`CHALLENGE-REMOVED: ${pair.challengeId} is recorded as superseding or superseded`)
  if ((relationships.challengePairs ?? []).length !== CHALLENGE_IDS.length) problems.push('CHALLENGE-REMOVED: the relationship map does not pair both challenges with their frozen dispositions')

  // Carbon: decision-ready, nothing selected or adopted.
  if (carbon.decisionId !== CARBON_DECISION_ID || carbon.state !== 'OUTSTANDING' || carbon.selected !== null || carbon.institutionalDecision !== null || carbon.decisionRecord !== null) problems.push('CARBON-ADOPTED: the carbon scope decision is recorded as selected, decided or backed by a decision record')
  if ((carbon.options ?? []).length !== 3 || (carbon.options ?? []).some((option) => option.selected !== false || option.adopted !== false)) problems.push('CARBON-ADOPTED: a carbon option is recorded as selected or adopted')
  if (carbon.recommendation?.recommendationOnly !== true || carbon.recommendation?.notSelected !== true || carbon.recommendation?.notAdopted !== true) problems.push('CARBON-ADOPTED: the carbon recommendation is not recorded as a recommendation only')
  if (!sameIds((carbon.operations ?? []).map((operation) => operation.operationId), CARBON_OPERATIONS)) problems.push('CARBON-ADOPTED: the carbon record does not cover exactly the four decision-bound operations')
  for (const operation of carbon.operations ?? []) {
    if (operation.inventoryClassification !== 'DECISION_BOUND_SCOPE_EXCEPTION' || operation.adopted !== false || operation.authorized !== false || operation.operationallyApproved !== false || operation.productionReady !== false || operation.countedAsOwned !== false || operation.independentDecisionRecord !== null || operation.scopeDisposition?.anyOptionChosen !== false) problems.push(`CARBON-ADOPTED: ${operation.operationId} is no longer a non-authorizing decision-bound scope exception`)
  }
  if (carbon.preservedObligation?.gate !== 8 || carbon.preservedObligation?.satisfiedByGate0C3 !== false || carbon.preservedObligation?.closesInstitutionalDecision !== false) problems.push('CARBON-ADOPTED: the Gate 8 obligation to prevent unsupported success responses is not preserved')
  const carbonDecision = (decisions.decisions ?? []).find((decision) => decision.decisionId === CARBON_DECISION_ID)
  if (!carbonDecision || carbonDecision.adopted !== false || carbonDecision.currentState !== 'OUTSTANDING') problems.push('CARBON-ADOPTED: the decision index records the carbon decision as adopted or absent')
  if (carbon.exceptionRegister?.modifiedByGate0C3 !== false) problems.push('HISTORY-MUTATED: the carbon exception register is recorded as modified')
  for (const exception of src.exceptions?.exceptions ?? src.exceptions?.entries ?? []) if (exception.status && exception.status !== 'OUTSTANDING' && exception.decisionId === CARBON_DECISION_ID) problems.push('CARBON-ADOPTED: the frozen carbon exception no longer waits on an outstanding decision')

  // Decisions: indexed, none adopted, product acceptance never an institutional grant.
  const records = decisions.decisions ?? []
  const decisionIds = records.map((record) => record.decisionId)
  if (unique(decisionIds).length !== decisionIds.length) problems.push('DUPLICATE-INFLATION: the decision index lists one decision identifier twice')
  for (const record of records) {
    const label = record.decisionId
    if (record.adopted !== false || record.closedByThisIndex !== false) problems.push(`DECISION-ADOPTED: ${label} is recorded as adopted or closed by an index`)
    if (!['OUTSTANDING', 'PROPOSED_FOR_RATIFICATION'].includes(record.currentState)) problems.push(`DECISION-ADOPTED: ${label} state ${record.currentState} has no independent decision evidence`)
    if (record.grantsInstitutionalAuthority !== false) problems.push(`PRODUCT-AS-INSTITUTIONAL: ${label} is recorded as granting institutional authority`)
    if (PRODUCT_FAMILIES.includes(record.family) && record.ownerRole !== 'AUTHORIZED_PRODUCT_OWNER') problems.push(`PRODUCT-AS-INSTITUTIONAL: product decision ${label} names ${record.ownerRole} as its owner`)
    if (INSTITUTIONAL_FAMILIES.includes(record.family) && record.ownerRole === 'AUTHORIZED_PRODUCT_OWNER') problems.push(`PRODUCT-AS-INSTITUTIONAL: institutional decision ${label} is owned by the product owner`)
    if (!record.requiredApprovalEvidence || !record.ownerRole || !record.consequenceOfDeferral || !record.blocks?.scopeLock || !record.blocks?.implementation || !record.blocks?.release || !record.source?.file) problems.push(`OWNERSHIP-INCOMPLETE: decision ${label} omits an owner, evidence requirement, blocking statement or source`)
  }
  if (decisions.totals?.adopted !== 0 || decisions.totals?.closed !== 0) problems.push('DECISION-ADOPTED: the decision index reports adopted or closed decisions')
  for (const decision of src.classification?.institutionalDecisions ?? []) if (decision.status !== 'OUTSTANDING') problems.push(`DECISION-ADOPTED: inventory decision ${decision.id} is ${decision.status}`)
  for (const decision of src.baselineDecisions?.decisions ?? []) if (decision.status !== 'OUTSTANDING') problems.push(`DECISION-ADOPTED: baseline decision ${decision.id} is ${decision.status}`)
  for (const record of src.productDecisions?.records ?? []) {
    if (record.institutionalGrants?.issuedByThisRecord !== 0 || record.institutionalGrants?.grantsInstitutionalAuthority !== false) problems.push(`PRODUCT-AS-INSTITUTIONAL: ${record.recordId} product ratification issues an institutional grant`)
    const indexed = records.find((entry) => entry.decisionId === record.recordId)
    if (indexed && indexed.currentState !== record.state) problems.push(`DECISION-ADOPTED: ${record.recordId} is ${record.state} in its register and ${indexed.currentState} in the index`)
  }
  for (const [family, count] of Object.entries({ INVENTORY_INSTITUTIONAL: FROZEN_TOTALS.institutionalDecisions, PERSONA_RATIFICATION: 3 })) if (records.filter((record) => record.family === family).length !== count) problems.push(`FROZEN-TOTALS: the decision index holds ${records.filter((record) => record.family === family).length} ${family} records, expected ${count}`)
  for (const overlap of decisions.overlaps ?? []) if (overlap.merged !== false || overlap.closes !== false) problems.push(`DECISION-ADOPTED: overlap ${overlap.ids?.join(' / ')} is merged or closes a decision`)

  // Relationships: no silent merge, no severity change.
  if (relationships.totals?.defectsMerged !== 0 || relationships.totals?.severitiesChanged !== 0) problems.push('SEVERITY-CHANGED: the relationship map reports a merge or a severity change')
  for (const cluster of relationships.clusters ?? []) {
    for (const member of [...(cluster.members ?? []), ...(cluster.related ?? [])]) {
      const defect = defects.get(member.defectId)
      if (!defect) problems.push(`HISTORY-MUTATED: relationship member ${member.defectId} is not a frozen defect`)
      else if (member.severity !== defect.severity || member.severityChangedByGate0C3 !== false) problems.push(`SEVERITY-CHANGED: ${member.defectId} severity in ${cluster.clusterId} differs from the frozen ${defect.severity}`)
      if (member.merged !== false) problems.push(`DUPLICATE-INFLATION: ${member.defectId} is merged into another defect in ${cluster.clusterId}`)
    }
    if (cluster.obligationsStayPerDefect !== true) problems.push(`DUPLICATE-INFLATION: ${cluster.clusterId} does not keep one obligation per defect`)
  }
  const perCapita = relationships.perCapitaSeverityPair
  if (!perCapita || perCapita.changed !== false || !(perCapita.members ?? []).some((member) => member.severity === 'MEDIUM') || !(perCapita.members ?? []).some((member) => member.severity === 'HIGH')) problems.push('SEVERITY-CHANGED: the per-capita remittance MEDIUM and HIGH severities are not both preserved')
  for (const exposure of relationships.exposures ?? []) for (const member of exposure.defects ?? []) {
    const defect = defects.get(member.defectId)
    if (defect && (member.severity !== defect.severity || member.severityChangedByGate0C3 !== false)) problems.push(`SEVERITY-CHANGED: exposure defect ${member.defectId} severity differs from the frozen ${defect.severity}`)
  }

  // Closure model: a Gate 0 verdict is never a release authorization.
  const level1 = closure.level1 ?? {}
  const level2 = closure.level2 ?? {}
  if (closure.gate0Verdict !== src.matrix.gate0Verdict || src.matrix.gate0Verdict !== 'IN_PROGRESS') problems.push(`GATE0-AS-GO: the Gate 0 verdict is ${closure.gate0Verdict} in the closure model and ${src.matrix.gate0Verdict} in the matrix; Gate 0C.3 leaves it IN_PROGRESS`)
  if (level2.releaseAuthorization !== 'NOT_GRANTED' || level2.productionGo !== false) problems.push('GATE0-AS-GO: the closure model records a release authorization or a production GO')
  if (level2.readinessGate?.ruling !== 'NO_GO') problems.push('GATE0-AS-GO: the closure model does not carry the NO_GO readiness ruling')
  else if (readText) {
    const ruling = readText(CERTIFICATION_RULING_DOC)
    if (typeof ruling !== 'string' || !/UE_SAAS_OPERATIONAL_READINESS[^\n]*NO_GO/.test(ruling)) problems.push(`GATE0-AS-GO: ${CERTIFICATION_RULING_DOC} does not state UE_SAAS_OPERATIONAL_READINESS NO_GO`)
  }
  if ((level1.certificationBlockers ?? []).length > 0 && level1.certifiable !== false) problems.push('GATE0-AS-GO: the closure model marks Gate 0 certifiable while certification blockers remain')
  if (!same(closure.level1?.certificationBlockers, expected.closure.level1.certificationBlockers)) problems.push('GATE0-AS-GO: the Gate 0 certification blockers differ from the sources that define them')
  if ((level2.criteria ?? []).some((criterion) => !['OPEN', 'NOT_STARTED'].includes(criterion.state))) problems.push('GATE0-AS-GO: a release-acceptance criterion is recorded as met with no proof on file')
  if (closure.separation !== expected.closure.separation) problems.push('GATE0-AS-GO: the closure model does not state that a Gate 0 verdict is not a release authorization')

  // Claims anywhere in the registers.
  for (const [name, value] of Object.entries(registers)) {
    const text = JSON.stringify(value)
    if (FORBIDDEN_STATUS.test(text)) problems.push(`IMPLEMENTATION-CLAIM: ${name} records a forbidden completion, approval or adoption status`)
    if (/PROVEN_IN_STAGING/.test(text)) problems.push(`IMPLEMENTATION-CLAIM: ${name} records PROVEN_IN_STAGING`)
    if (PRODUCTION_GO.test(text)) problems.push(`GATE0-AS-GO: ${name} records a production GO or a release authorization`)
    if (value.anchorCommit !== ANCHOR_COMMIT || value.gate !== GATE_ID) problems.push(`REGISTER-DRIFT: ${name} names an anchor commit or gate other than ${GATE_ID} at ${ANCHOR_COMMIT.slice(0, 12)}`)
  }

  // Source quotes exist where they are cited.
  if (readText) {
    const seen = new Set()
    for (const [name, value] of Object.entries(registers)) {
      for (const pair of quotePairs(value)) {
        const key = `${pair.ref}\u0000${pair.quote}`
        if (seen.has(key)) continue
        seen.add(key)
        const text = readText(pair.ref)
        if (typeof text !== 'string') problems.push(`EVIDENCE-QUOTE: ${name} cites ${pair.ref}, which cannot be read`)
        else if (!text.includes(pair.quote)) problems.push(`EVIDENCE-QUOTE: ${name} quotes ${pair.ref}: "${pair.quote.slice(0, 60)}" and the file does not contain it`)
      }
    }
  }

  // Regeneration.
  for (const key of keys) if (serialize(registers[key]) !== serialize(expected[key])) problems.push(`REGISTER-DRIFT: ${FILES_0C3[key]} differs from its regeneration`)

  // Documents.
  if (docs) {
    const rendered = renderDocs(expected)
    for (const file of Object.values(DOCS_0C3)) {
      const text = docs[file]
      if (typeof text !== 'string') problems.push(`DOC-ABSENT: ${file} is missing`)
      else {
        if (text !== rendered[file]) problems.push(`DOC-DRIFT: ${file} differs from its regeneration`)
        if (/\*\*Status: (ACCEPTED|APPROVED|ADOPTED)/.test(text) || PRODUCTION_GO.test(text)) problems.push(`GATE0-AS-GO: ${file} reads as accepted, adopted or authorized for release`)
      }
    }
  }
  if (liveFileSha) {
    for (const [file, sha] of Object.entries(src.fileSha ?? {})) if (liveFileSha(file) !== sha) problems.push(`FROZEN-HASH: ${file} changed while the validator ran`)
    if (liveFileSha(HANDOFF_FILE) !== src.fileSha?.[HANDOFF_FILE]) problems.push('FROZEN-HASH: the handoff register changed')
  }
  return problems
}

export function releaseDebtSummary({ registers }) {
  const { assessment, debt, challenges, carbon, decisions, relationships, closure } = registers
  return {
    gate: GATE_ID,
    uniqueDebtItems: debt.totals.uniqueItems,
    releaseBlockingRegisterDefects: debt.totals.releaseBlockingRegisterDefects,
    conditionallyBlockingChallenged: debt.totals.conditionallyBlockingChallenged,
    earlierHighAssessed: assessment.totals.defects,
    proposedDispositions: assessment.totals.byProposedDisposition,
    acceptedDispositions: assessment.totals.accepted,
    challengesPreserved: challenges.challenges.filter((challenge) => challenge.treatment.challengePreserved).length,
    carbonOptionSelected: carbon.selected,
    decisionRecords: decisions.totals.distinctRecords,
    decisionsAdopted: decisions.totals.adopted,
    relationshipClusters: relationships.totals.clusters,
    gate0Verdict: closure.gate0Verdict,
    releaseAuthorization: closure.level2.releaseAuthorization,
    sha256: sha256Of(debt),
  }
}
