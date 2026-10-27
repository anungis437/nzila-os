/**
 * Gate 0B.8 route-classification validator.
 *
 * The tranche is 100 previously unexamined SCOPE_UNDECIDED operations. The four decision-bound operations that Gate
 * 0B.4 and Gate 0B.5 examined are excluded from selection and are never carried in: they live in the separate
 * decision-bound scope exception register. The record rules are the shared Gate 0B.2 rules (ownership is
 * accountability, never authorization; a role floor is not a kernel decision; a declared audit is not atomic without
 * source; reachable cross-tenant data is not authorized by being reachable) plus the Gate 0B.4 provenance proof.
 */
import { compareCodeUnit, nonEmpty, trancheHash } from './ue-gate0b1-classification.mjs'
import { RECORD_FIELDS_0B2, contractHash, selectNewOperations, validateRecordGeneric } from './ue-gate0b2-classification.mjs'
import { recordProvenanceProblems } from './ue-gate0b4-provenance.mjs'
import { RECORD_FIELDS_0B6 } from './ue-gate0b6-classification.mjs'
import { releaseDispositionProblems, validateReviewQueue } from './ue-gate0b7-release-dispositions.mjs'
import { ANCHOR_COMMIT, DECISION_BOUND_OPERATIONS, PRIOR_TRANCHES, TRANCHE_ID, TRANCHE_SIZE } from './ue-gate0b8-ids.mjs'
import { CAPABILITY_DOMAINS, OWNERSHIP_GROUPS } from './ue-gate0b8-groups.mjs'
import { CAPABILITY_RECORDS, UNRESOLVED_0B8 } from './ue-gate0b8-modules.mjs'

export const FILES_0B8 = {
  manifest: 'docs/union-eyes/convergence/register/ue-route-tranche-0b8-manifest.json',
  classification: 'docs/union-eyes/convergence/register/ue-route-classification-0b8.json',
}

export const RECORD_FIELDS_0B8 = [...new Set([...RECORD_FIELDS_0B2, ...RECORD_FIELDS_0B6])]
export const NEW_CAPABILITY_IDS = CAPABILITY_RECORDS.map((record) => record.id)
const TRANCHE_DEFECT = '0B.8'
const PRIOR_DISPOSITION_TRANCHE = '0B.7'
export const ACCEPTED_DEFECT_TRANCHES = ['0B.1', '0B.2', '0B.3', '0B.4', '0B.5', '0B.6', '0B.7', '0B.8']

export const OPTIONS_0B8 = {
  gate: '0B.8',
  rulePrefix: 'RULE-0B8-',
  carryFrom: null,
  domains: CAPABILITY_DOMAINS,
  groups: OWNERSHIP_GROUPS,
  fields: RECORD_FIELDS_0B8,
  readWriteAudits: ['NONE'],
  extraWriteQuotes: /writeFileSync|writeRecord\(/,
}

export function validateTranche8({ manifest, ledger, universe, anchoredEntries, earlierManifests, exceptionIds }) {
  const problems = []
  if (!manifest || manifest.schemaVersion !== 1 || manifest.tranche !== TRANCHE_ID) return ['tranche manifest is missing or is not the GATE-0B.8 manifest']
  const ops = Array.isArray(manifest.operations) ? manifest.operations : []
  if (manifest.size !== TRANCHE_SIZE || ops.length !== TRANCHE_SIZE) problems.push(`tranche ${TRANCHE_ID} must freeze exactly ${TRANCHE_SIZE} operations`)
  if (new Set(ops).size !== ops.length) problems.push('tranche has duplicate operations')
  for (let i = 1; i < ops.length; i += 1) {
    if (compareCodeUnit(ops[i - 1], ops[i]) >= 0) {
      problems.push(`tranche order is not deterministic ascending route/method order at ${ops[i]}`)
      break
    }
  }
  const hash = trancheHash(ops)
  if (manifest.operationsHash !== hash) problems.push('tranche operationsHash does not match the frozen operation list')
  const log = Array.isArray(manifest.versionLog) ? manifest.versionLog : []
  if (!Number.isInteger(manifest.version) || manifest.version < 1) problems.push('tranche version is invalid')
  else {
    for (let v = 1; v <= manifest.version; v += 1) {
      const entry = log.find((item) => item.version === v)
      if (!entry) problems.push(`tranche version ${v} has no versionLog entry`)
      else if (!nonEmpty(entry.reason, 20)) problems.push(`tranche version ${v} has no versioned reason`)
    }
    const last = log.find((item) => item.version === manifest.version)
    if (last && last.operationsHash !== hash) problems.push('tranche versionLog does not record the current operation list')
  }
  const recorded = ledger?.tranches?.[TRANCHE_ID]
  if (!recorded) problems.push('classification ledger does not record the GATE-0B.8 tranche version and hash')
  else if (manifest.version < recorded.version) problems.push('tranche version moved backwards against the ledger')
  else if (manifest.version === recorded.version && recorded.operationsHash !== hash) problems.push('tranche order or membership changed without a new versioned reason')
  else if (manifest.version > recorded.version) {
    const next = log.find((item) => item.version === manifest.version)
    if (!next || !nonEmpty(next.reason, 20)) problems.push('tranche changed without a versioned reason')
  }
  for (const id of ops) if (!universe.has(id)) problems.push(`tranche operation ${id} does not exist in the route-method universe`)

  if (!Array.isArray(manifest.carryForward) || manifest.carryForward.length !== 0) problems.push('tranche carries forward operations; the decision-bound exceptions are never carried into a tranche')
  const excluded = Array.isArray(manifest.excludedDecisionBound) ? manifest.excludedDecisionBound : []
  if (excluded.slice().sort(compareCodeUnit).join('\n') !== DECISION_BOUND_OPERATIONS.slice().sort(compareCodeUnit).join('\n')) problems.push('tranche does not record the decision-bound operations it excludes from selection')
  for (const id of ops) {
    if (DECISION_BOUND_OPERATIONS.includes(id) || (exceptionIds ?? new Set()).has(id)) problems.push(`tranche operation ${id} is a decision-bound scope exception and may not be re-examined`)
  }
  const fresh = Array.isArray(manifest.newOperations) ? manifest.newOperations : []
  if (fresh.join('\n') !== ops.join('\n')) problems.push('tranche newOperations are not the frozen operations')
  const examined = new Set((earlierManifests ?? []).flatMap((item) => item?.operations ?? []))
  for (const id of ops) if (examined.has(id)) problems.push(`new operation ${id} was already examined in an earlier tranche`)
  if (manifest.anchorCommit !== ANCHOR_COMMIT) problems.push('tranche anchor commit is not the recorded Gate 0B.7 acceptance commit')
  const prior = Array.isArray(manifest.priorTranches) ? manifest.priorTranches : []
  for (const tranche of PRIOR_TRANCHES) {
    const item = prior.find((candidate) => candidate.tranche === tranche)
    const ledgerItem = ledger?.tranches?.[tranche]
    if (!item || !ledgerItem || item.version !== ledgerItem.version || item.operationsHash !== ledgerItem.operationsHash) problems.push(`tranche does not record the provenance of ${tranche} as the ledger holds it`)
  }
  if (manifest.version === 1 && anchoredEntries) {
    const expected = selectNewOperations(anchoredEntries, excluded, TRANCHE_SIZE)
    if (expected.join('\n') !== fresh.join('\n')) problems.push(`new operations are not the next ${TRANCHE_SIZE} SCOPE_UNDECIDED operations in ascending order at the anchor commit`)
  }
  return problems
}

function recordExtraProblems(record, ctx) {
  const { exists, readText } = ctx
  const out = []
  const label = `classification ${record?.id ?? '(missing id)'}`
  if (!Array.isArray(record.callers)) out.push(`${label} has no callers list`)
  else {
    for (const caller of record.callers) {
      if (!nonEmpty(caller?.ref) || !nonEmpty(caller?.quote)) out.push(`${label} has a malformed caller`)
      else if (!exists(caller.ref)) out.push(`${label} cites caller ${caller.ref}, which does not exist`)
      else if (!readText(caller.ref).includes(caller.quote)) out.push(`${label} cites a caller line that is not in ${caller.ref}`)
    }
  }
  if (!nonEmpty(record.callerFinding, 20)) out.push(`${label} has no caller finding`)
  else if (Array.isArray(record.callers)) {
    const none = record.callers.length === 0
    if (none && !record.callerFinding.startsWith('No caller')) out.push(`${label} lists no caller but its finding says one exists`)
    if (!none && record.callerFinding.startsWith('No caller')) out.push(`${label} lists callers but its finding says there are none`)
  }
  if (!nonEmpty(record.requiredAudit, 15)) out.push(`${label} states no required audit behavior`)
  if (!Array.isArray(record.dependencyGates) || record.dependencyGates.some((gate) => !Number.isInteger(gate) || gate < 1 || gate > 15)) out.push(`${label} has an invalid dependency gate list`)
  out.push(...recordProvenanceProblems(record, { exists, readText }))
  return out
}

/** The record rules of one operation, shared by the validator and the module check harness. */
export function validateRecord8(record, ctx, options = OPTIONS_0B8) {
  const own = validateRecordGeneric(record, ctx, options)
  const problems = [...own]
  if (own.length === 0 || !own.some((item) => item.includes('is missing'))) problems.push(...recordExtraProblems(record, ctx))
  return problems
}

export function validateClassification8({
  classification, manifest, ledger, classification0b1, classification0b2, classification0b3, classification0b4, classification0b5, classification0b6, classification0b7,
  manifest0b1, manifest0b2, manifest0b3, manifest0b4, manifest0b5, manifest0b6, manifest0b7, reviewQueue, entries, capabilityById, universe, exists, readText, anchoredEntries, exceptionIds,
}) {
  const problems = []
  const entryByKey = new Map(entries.map((entry) => [`${entry[0]}|${entry[1]}`, entry]))
  problems.push(...validateTranche8({ manifest, ledger, universe, anchoredEntries, earlierManifests: [manifest0b1, manifest0b2, manifest0b3, manifest0b4, manifest0b5, manifest0b6, manifest0b7], exceptionIds }))
  const result = { problems, summary: null, registeredReleaseBlocking: new Set(), releaseBlockingDefects: [], releaseBlockingDispositionDefects: [] }
  if (!classification || classification.schemaVersion !== 1 || classification.tranche !== TRANCHE_ID) {
    problems.push('route classification file is missing or is not the GATE-0B.8 classification')
    return result
  }
  const hash = trancheHash(manifest?.operations ?? [])
  if (classification.trancheVersion !== manifest?.version || classification.operationsHash !== hash) problems.push('classification does not match the frozen tranche version and hash')

  const decisions = Array.isArray(classification.institutionalDecisions) ? classification.institutionalDecisions : []
  const decisionIds = new Set()
  for (const decision of decisions) {
    if (!nonEmpty(decision.id) || decisionIds.has(decision.id)) problems.push(`institutional decision ${decision.id ?? '(missing id)'} has a missing or duplicate id`)
    decisionIds.add(decision.id)
    if (decision.status !== 'OUTSTANDING') problems.push(`institutional decision ${decision.id} is ${decision.status}; Gate 0B.8 can record only outstanding decisions and none can justify access`)
    if (!nonEmpty(decision.question, 20) || !nonEmpty(decision.sourceState, 30)) problems.push(`institutional decision ${decision.id} is incomplete`)
  }
  for (const prior of classification0b7?.institutionalDecisions ?? []) {
    const kept = decisions.find((decision) => decision.id === prior.id)
    if (!kept) problems.push(`institutional decision ${prior.id} recorded by an earlier tranche is missing; a decision cannot be silently closed by removal`)
    else if (kept.question !== prior.question || kept.sourceState !== prior.sourceState || kept.status !== 'OUTSTANDING') problems.push(`institutional decision ${prior.id} was altered or adopted`)
    else if (!(prior.softwareOwners ?? []).every((owner) => (kept.softwareOwners ?? []).includes(owner))) problems.push(`institutional decision ${prior.id} lost a software owner recorded by an earlier tranche`)
  }

  const register = Array.isArray(classification.defectRegister) ? classification.defectRegister : []
  const defectIds = new Set()
  const byId = new Map()
  for (const defect of register) {
    if (!nonEmpty(defect.id) || defectIds.has(defect.id)) problems.push(`defect ${defect.id ?? '(missing id)'} has a missing or duplicate id`)
    defectIds.add(defect.id)
    byId.set(defect.id, defect)
    if (!Number.isInteger(defect.gate) || defect.gate < 1 || defect.gate > 15) problems.push(`defect ${defect.id} has no owner gate`)
    if (!nonEmpty(defect.title, 20) || !nonEmpty(defect.severity)) problems.push(`defect ${defect.id} is incomplete`)
    if (!nonEmpty(defect.ownerCapabilityId) || !capabilityById.has(defect.ownerCapabilityId)) problems.push(`defect ${defect.id} has no responsible engineering capability`)
    else if (capabilityById.get(defect.ownerCapabilityId).primaryGate !== defect.gate) problems.push(`defect ${defect.id} is repaired in gate ${defect.gate} but ${defect.ownerCapabilityId} owns gate ${capabilityById.get(defect.ownerCapabilityId).primaryGate}`)
    if (!ACCEPTED_DEFECT_TRANCHES.includes(defect.tranche)) problems.push(`defect ${defect.id} does not record the tranche that found it`)
  }
  const prior = Array.isArray(classification0b7?.defectRegister) ? classification0b7.defectRegister : []
  for (const old of prior) {
    const kept = byId.get(old.id)
    if (!kept) problems.push(`earlier defect ${old.id} is missing from the defect register`)
    else if (JSON.stringify(kept) !== JSON.stringify(old)) problems.push(`earlier defect ${old.id} was altered in the defect register`)
  }
  if (register.filter((defect) => defect.tranche !== '0B.8').length !== prior.length) problems.push('defect register holds an earlier-tranche defect that no earlier tranche recorded')

  for (const id of NEW_CAPABILITY_IDS) if (!capabilityById.has(id)) problems.push(`Gate 0B.8 capability ${id} is not in the engineering completion matrix`)

  const resolvedLater = new Set(Object.entries(ledger?.classifiedIn ?? {}).filter(([, tranche]) => tranche !== TRANCHE_ID).map(([id]) => id))
  const ctx = { entryByKey, capabilityById, exists, readText, defectIds, decisionIds, carry: new Set(), resolvedLater }
  const records = Array.isArray(classification.operations) ? classification.operations : []
  const frozen = manifest?.operations ?? []
  const frozenSet = new Set(frozen)
  const seen = new Set()
  const cited = new Set()
  for (const record of records) {
    if (seen.has(record.id)) problems.push(`classification ${record.id} is recorded twice`)
    seen.add(record.id)
    if (!frozenSet.has(record.id)) problems.push(`classification ${record.id} is not in the frozen tranche`)
    problems.push(...validateRecord8(record, ctx))
    for (const id of record.defects ?? []) cited.add(id)
  }
  for (const id of frozen) if (!seen.has(id)) problems.push(`tranche operation ${id} has no classification record`)
  for (const defect of register) {
    if (defect.tranche === '0B.8' && !cited.has(defect.id)) problems.push(`defect ${defect.id} is recorded but no classification cites it`)
  }

  const classified = records.filter((record) => record.status === 'CLASSIFIED')
  const unresolved = records.filter((record) => record.status === 'UNRESOLVED')
  const recorded = ledger?.classified ?? {}
  const classifiedIn = ledger?.classifiedIn ?? {}
  for (const record of classified) {
    if (recorded[record.id] !== record.capabilityId) problems.push(`classified operation ${record.id} is not recorded in the classification ledger`)
    if (classifiedIn[record.id] !== TRANCHE_ID) problems.push(`classified operation ${record.id} does not record ${TRANCHE_ID} in the ledger`)
  }
  for (const [id, tranche] of Object.entries(classifiedIn)) {
    if (tranche === TRANCHE_ID && !classified.some((record) => record.id === id)) problems.push(`ledger records ${id} as classified in ${TRANCHE_ID} but no classification exists`)
  }
  const earlier = [
    [classification0b7, 'GATE-0B.7', 'Gate 0B.7'],
    [classification0b6, 'GATE-0B.6', 'Gate 0B.6'],
    [classification0b5, 'GATE-0B.5', 'Gate 0B.5'],
    [classification0b4, 'GATE-0B.4', 'Gate 0B.4'],
    [classification0b3, 'GATE-0B.3', 'Gate 0B.3'],
    [classification0b2, 'GATE-0B.2', 'Gate 0B.2'],
    [classification0b1, null, 'Gate 0B.1'],
  ]
  for (const [source, trancheId, name] of earlier) {
    for (const record of source?.operations ?? []) {
      if (record.status !== 'CLASSIFIED') continue
      const current = entryByKey.get(record.id)
      if (!current || current[4] === 'SCOPE_UNDECIDED' || current[3] !== record.capabilityId) problems.push(`${name} classification ${record.id} was changed or reverted`)
      if (recorded[record.id] !== record.capabilityId) problems.push(`${name} classification ${record.id} is missing or changed in the ledger`)
      if (trancheId && classifiedIn[record.id] !== trancheId) problems.push(`${name} classification ${record.id} no longer records ${trancheId} in the ledger`)
    }
  }
  for (const [id, capabilityId] of Object.entries(recorded)) {
    const current = entryByKey.get(id)
    if (!current) problems.push(`ledger operation ${id} no longer exists in the route-method universe`)
    else if (current[4] === 'SCOPE_UNDECIDED') problems.push(`previously classified operation ${id} was silently reverted to SCOPE_UNDECIDED`)
    else if (current[3] !== capabilityId) problems.push(`previously classified operation ${id} changed owner from ${capabilityId} to ${current[3]} without a versioned reason`)
  }
  if (anchoredEntries) {
    for (const old of anchoredEntries) {
      if (old[4] === 'SCOPE_UNDECIDED') continue
      const current = entryByKey.get(`${old[0]}|${old[1]}`)
      if (current && current[4] === 'SCOPE_UNDECIDED') problems.push(`previously classified operation ${old[0]}|${old[1]} was silently reverted to SCOPE_UNDECIDED`)
    }
  }
  for (const record of unresolved) {
    if (!UNRESOLVED_0B8.has(record.id)) problems.push(`operation ${record.id} is unresolved but is not a recorded evidence gap`)
  }

  const exposures = (classification0b1?.unauthenticated ?? []).filter((record) => record.disposition === 'UNJUSTIFIED_EXPOSURE')
  const listed = Array.isArray(classification.releaseBlockingExposures) ? classification.releaseBlockingExposures : []
  const listedIds = new Set()
  for (const exposure of exposures) {
    const item = listed.find((candidate) => candidate.id === exposure.id)
    if (!item) {
      problems.push(`unjustified exposure ${exposure.id} is not preserved as a release-blocking defect`)
      continue
    }
    listedIds.add(exposure.id)
    if (item.ownerGate !== exposure.ownerGate || item.releaseBlocking !== true) problems.push(`release-blocking exposure ${exposure.id} lost its owner gate or release-blocking mark`)
    if (item.contractSha256 !== contractHash(exposure)) problems.push(`release-blocking exposure ${exposure.id} no longer preserves its exposure contract and required security contract`)
    const expectedDefects = (exposure.defects ?? []).filter((id) => byId.get(id)?.gate === exposure.ownerGate)
    if (expectedDefects.length === 0) problems.push(`release-blocking exposure ${exposure.id} has no defect owned by gate ${exposure.ownerGate}`)
    for (const id of expectedDefects) {
      const defect = byId.get(id)
      if (!defect || defect.releaseBlocking !== true) problems.push(`defect ${id} must be registered as release blocking for ${exposure.id}`)
      else result.releaseBlockingDefects.push({ operation: exposure.id, defectId: id, gate: defect.gate, ownerCapabilityId: defect.ownerCapabilityId })
    }
    result.registeredReleaseBlocking.add(exposure.id)
  }
  for (const item of listed) if (!listedIds.has(item.id)) problems.push(`release-blocking exposure ${item.id} is not an unjustified exposure recorded by Gate 0B.1`)
  const notBlocking = register.filter((defect) => defect.tranche !== TRANCHE_DEFECT && defect.tranche !== PRIOR_DISPOSITION_TRANCHE && defect.releaseBlocking === true && !result.releaseBlockingDefects.some((entry) => entry.defectId === defect.id))
  for (const defect of notBlocking) problems.push(`defect ${defect.id} is marked release blocking without an unjustified exposure that requires it`)

  const newDefects = register.filter((defect) => defect.tranche === TRANCHE_DEFECT)
  for (const defect of newDefects) {
    if (typeof defect.releaseBlocking !== 'boolean') problems.push(`defect ${defect.id} records no release-blocking mark`)
    if (!['HIGH', 'MEDIUM', 'LOW'].includes(defect.severity)) problems.push(`defect ${defect.id} has an invalid severity ${JSON.stringify(defect.severity)}`)
    problems.push(...releaseDispositionProblems(defect, { exists, readText }))
    if (defect.releaseBlocking === true && defect.releaseDisposition?.disposition === 'RELEASE_BLOCKING') {
      result.releaseBlockingDispositionDefects.push({ defectId: defect.id, gate: defect.gate, ownerCapabilityId: defect.ownerCapabilityId })
    }
  }
  const preserved = register.filter((defect) => defect.tranche === PRIOR_DISPOSITION_TRANCHE)
  for (const defect of preserved) {
    problems.push(...releaseDispositionProblems(defect, { exists, readText }))
    if (defect.releaseBlocking === true && defect.releaseDisposition?.disposition === 'RELEASE_BLOCKING') {
      result.releaseBlockingDispositionDefects.push({ defectId: defect.id, gate: defect.gate, ownerCapabilityId: defect.ownerCapabilityId })
    }
  }
  for (const defect of register.filter((item) => item.tranche !== TRANCHE_DEFECT && item.tranche !== PRIOR_DISPOSITION_TRANCHE)) {
    if ('releaseDisposition' in defect) problems.push(`earlier defect ${defect.id} gained a release disposition; the frozen records are preserved and qualified through the review queue`)
  }
  problems.push(...validateReviewQueue({ queue: reviewQueue, defectRegister: register }))

  const summary = {
    tranche: TRANCHE_ID,
    examined: records.length,
    carriedForward: 0,
    decisionBoundExcluded: (manifest?.excludedDecisionBound ?? []).length,
    newlyExamined: (manifest?.newOperations ?? []).length,
    classified: classified.length,
    unresolved: unresolved.length,
    newDefects: register.filter((defect) => defect.tranche === '0B.8').length,
    defectsTotal: register.length,
    institutionalDecisions: decisions.length,
    crossTenantExposures: records.filter((record) => record.crossTenantExposure === true).length,
    newCapabilities: NEW_CAPABILITY_IDS.length,
    newHighDefects: newDefects.filter((defect) => defect.severity === 'HIGH').length,
    releaseDispositions: Object.fromEntries(['RELEASE_BLOCKING', 'CONDITIONALLY_BLOCKING', 'NON_BLOCKING_WITH_JUSTIFICATION'].map((name) => [name, newDefects.filter((defect) => defect.releaseDisposition?.disposition === name).length])),
    reviewQueue: (reviewQueue?.entries ?? []).length,
    preservedReleaseBlockingDispositions: preserved.filter((defect) => defect.releaseDisposition?.disposition === 'RELEASE_BLOCKING').length,
  }
  if (classification.summary && JSON.stringify(classification.summary) !== JSON.stringify(summary)) problems.push('classification summary does not match its records')
  result.summary = summary
  return result
}
