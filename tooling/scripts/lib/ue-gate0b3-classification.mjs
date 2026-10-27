/**
 * Gate 0B.3 route-classification validator.
 *
 * The tranche is the one operation Gate 0B.2 left unresolved plus the next 99 previously unexamined SCOPE_UNDECIDED
 * operations. The record rules are the shared Gate 0B.2 rules (ownership is accountability, never authorization; a
 * role floor is not a kernel decision; a declared audit is not atomic without source; reachable cross-tenant data is
 * not authorized by being reachable). This validator adds the tranche freeze, the preservation of every earlier
 * classification, decision and defect, and the caller, required-audit and dependency fields Gate 0B.3 introduced.
 */
import { compareCodeUnit, nonEmpty, trancheHash } from './ue-gate0b1-classification.mjs'
import { RECORD_FIELDS_0B2, contractHash, selectNewOperations, validateRecordGeneric } from './ue-gate0b2-classification.mjs'
import {
  ANCHOR_COMMIT, CAPABILITY_DOMAINS, CARRY_FORWARD_COUNT, CARRY_FORWARD_FROM, CAPABILITY_IDS_0B3, NEW_UNEXAMINED_COUNT, OWNERSHIP_GROUPS, TRANCHE_ID, TRANCHE_SIZE, UNRESOLVED_OPERATION,
} from './ue-gate0b3-groups.mjs'

export const FILES_0B3 = {
  manifest: 'docs/union-eyes/convergence/register/ue-route-tranche-0b3-manifest.json',
  classification: 'docs/union-eyes/convergence/register/ue-route-classification-0b3.json',
}

export const RECORD_FIELDS_0B3 = [...RECORD_FIELDS_0B2, 'requiredAudit', 'dependencyGates', 'callers', 'callerFinding']
export const NEW_CAPABILITY_IDS = Object.values(CAPABILITY_IDS_0B3)
export const ACCEPTED_DEFECT_TRANCHES = ['0B.1', '0B.2', '0B.3']
export const CARRIED_OPERATION = 'alerts/realtime/route.ts|GET'

export const OPTIONS_0B3 = {
  gate: '0B.3',
  rulePrefix: 'RULE-0B3-',
  carryFrom: CARRY_FORWARD_FROM,
  domains: CAPABILITY_DOMAINS,
  groups: OWNERSHIP_GROUPS,
  fields: RECORD_FIELDS_0B3,
}

export function validateTranche3({ manifest, ledger, universe, anchoredEntries, classification0b2, manifest0b1, manifest0b2 }) {
  const problems = []
  if (!manifest || manifest.schemaVersion !== 1 || manifest.tranche !== TRANCHE_ID) return ['tranche manifest is missing or is not the GATE-0B.3 manifest']
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
  if (!recorded) problems.push('classification ledger does not record the GATE-0B.3 tranche version and hash')
  else if (manifest.version < recorded.version) problems.push('tranche version moved backwards against the ledger')
  else if (manifest.version === recorded.version && recorded.operationsHash !== hash) problems.push('tranche order or membership changed without a new versioned reason')
  else if (manifest.version > recorded.version) {
    const next = log.find((item) => item.version === manifest.version)
    if (!next || !nonEmpty(next.reason, 20)) problems.push('tranche changed without a versioned reason')
  }
  for (const id of ops) if (!universe.has(id)) problems.push(`tranche operation ${id} does not exist in the route-method universe`)

  const carry = Array.isArray(manifest.carryForward) ? manifest.carryForward : []
  const fresh = Array.isArray(manifest.newOperations) ? manifest.newOperations : []
  if (carry.length !== CARRY_FORWARD_COUNT) problems.push(`tranche must carry forward exactly ${CARRY_FORWARD_COUNT} unresolved operation`)
  if (fresh.length !== NEW_UNEXAMINED_COUNT) problems.push(`tranche must add exactly ${NEW_UNEXAMINED_COUNT} previously unexamined operations`)
  if (!carry.includes(CARRIED_OPERATION)) problems.push(`the carry-forward operation ${CARRIED_OPERATION} was dropped from the tranche`)
  if ([...carry, ...fresh].sort(compareCodeUnit).join('\n') !== ops.join('\n')) problems.push('tranche operations are not the carry-forward operation plus the new operations')
  const unresolved0b2 = (classification0b2?.operations ?? []).filter((record) => record.status === 'UNRESOLVED').map((record) => record.id).sort(compareCodeUnit)
  if (unresolved0b2.join('\n') !== [...carry].sort(compareCodeUnit).join('\n')) problems.push('carry-forward operation is not exactly the operation Gate 0B.2 left unresolved')
  const examined = new Set([...(manifest0b1?.operations ?? []), ...(manifest0b2?.operations ?? [])])
  for (const id of fresh) if (examined.has(id)) problems.push(`new operation ${id} was already examined in an earlier tranche`)
  if (manifest.anchorCommit !== ANCHOR_COMMIT) problems.push('tranche anchor commit is not the recorded Gate 0B.2 commit')
  if (manifest.carryForwardFrom !== CARRY_FORWARD_FROM) problems.push('tranche does not record its provenance to the Gate 0B.2 ledger')
  if (manifest.version === 1 && anchoredEntries) {
    const expected = selectNewOperations(anchoredEntries, carry, NEW_UNEXAMINED_COUNT)
    if (expected.join('\n') !== fresh.join('\n')) problems.push('new operations are not the next 99 SCOPE_UNDECIDED operations in ascending order at the anchor commit')
  }
  return problems
}

function recordExtraProblems(record, { exists, readText }) {
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
  return out
}

export function validateClassification3({
  classification, manifest, ledger, classification0b1, classification0b2, manifest0b1, manifest0b2, entries, capabilityById, universe, exists, readText, anchoredEntries,
}) {
  const problems = []
  const entryByKey = new Map(entries.map((entry) => [`${entry[0]}|${entry[1]}`, entry]))
  problems.push(...validateTranche3({ manifest, ledger, universe, anchoredEntries, classification0b2, manifest0b1, manifest0b2 }))
  const result = { problems, summary: null, registeredReleaseBlocking: new Set(), releaseBlockingDefects: [] }
  if (!classification || classification.schemaVersion !== 1 || classification.tranche !== TRANCHE_ID) {
    problems.push('route classification file is missing or is not the GATE-0B.3 classification')
    return result
  }
  const hash = trancheHash(manifest?.operations ?? [])
  if (classification.trancheVersion !== manifest?.version || classification.operationsHash !== hash) problems.push('classification does not match the frozen tranche version and hash')

  const decisions = Array.isArray(classification.institutionalDecisions) ? classification.institutionalDecisions : []
  const decisionIds = new Set()
  for (const decision of decisions) {
    if (!nonEmpty(decision.id) || decisionIds.has(decision.id)) problems.push(`institutional decision ${decision.id ?? '(missing id)'} has a missing or duplicate id`)
    decisionIds.add(decision.id)
    if (decision.status !== 'OUTSTANDING') problems.push(`institutional decision ${decision.id} is ${decision.status}; Gate 0B.3 can record only outstanding decisions and none can justify access`)
    if (!nonEmpty(decision.question, 20) || !nonEmpty(decision.sourceState, 30)) problems.push(`institutional decision ${decision.id} is incomplete`)
  }
  for (const prior of classification0b2?.institutionalDecisions ?? []) {
    const kept = decisions.find((decision) => decision.id === prior.id)
    if (!kept) problems.push(`institutional decision ${prior.id} recorded by Gate 0B.2 is missing`)
    else if (kept.question !== prior.question || kept.status !== 'OUTSTANDING') problems.push(`institutional decision ${prior.id} was altered or adopted`)
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
  const prior = Array.isArray(classification0b2?.defectRegister) ? classification0b2.defectRegister : []
  for (const old of prior) {
    const kept = byId.get(old.id)
    if (!kept) problems.push(`earlier defect ${old.id} is missing from the defect register`)
    else if (JSON.stringify(kept) !== JSON.stringify(old)) problems.push(`earlier defect ${old.id} was altered in the defect register`)
  }
  if (register.filter((defect) => defect.tranche !== '0B.3').length !== prior.length) problems.push('defect register holds an earlier-tranche defect that no earlier tranche recorded')

  for (const id of NEW_CAPABILITY_IDS) if (!capabilityById.has(id)) problems.push(`Gate 0B.3 capability ${id} is not in the engineering completion matrix`)

  const carry = new Set(manifest?.carryForward ?? [])
  const resolvedLater = new Set()
  const ctx = { entryByKey, capabilityById, exists, readText, defectIds, decisionIds, carry, resolvedLater }
  const records = Array.isArray(classification.operations) ? classification.operations : []
  const frozen = manifest?.operations ?? []
  const frozenSet = new Set(frozen)
  const seen = new Set()
  const cited = new Set()
  for (const record of records) {
    if (seen.has(record.id)) problems.push(`classification ${record.id} is recorded twice`)
    seen.add(record.id)
    if (!frozenSet.has(record.id)) problems.push(`classification ${record.id} is not in the frozen tranche`)
    const own = validateRecordGeneric(record, ctx, OPTIONS_0B3)
    problems.push(...own)
    if (own.length === 0 || !own.some((item) => item.includes('is missing'))) problems.push(...recordExtraProblems(record, ctx))
    for (const id of record.defects ?? []) cited.add(id)
  }
  for (const id of frozen) if (!seen.has(id)) problems.push(`tranche operation ${id} has no classification record`)
  for (const defect of register) {
    if (defect.tranche === '0B.3' && !cited.has(defect.id)) problems.push(`defect ${defect.id} is recorded but no classification cites it`)
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
  for (const record of classification0b2?.operations ?? []) {
    if (record.status !== 'CLASSIFIED') continue
    const current = entryByKey.get(record.id)
    if (!current || current[4] === 'SCOPE_UNDECIDED' || current[3] !== record.capabilityId) problems.push(`Gate 0B.2 classification ${record.id} was changed or reverted`)
    if (recorded[record.id] !== record.capabilityId) problems.push(`Gate 0B.2 classification ${record.id} is missing or changed in the ledger`)
    if (classifiedIn[record.id] !== CARRY_FORWARD_FROM) problems.push(`Gate 0B.2 classification ${record.id} no longer records ${CARRY_FORWARD_FROM} in the ledger`)
  }
  for (const record of classification0b1?.operations ?? []) {
    if (record.status !== 'CLASSIFIED') continue
    const current = entryByKey.get(record.id)
    if (!current || current[4] === 'SCOPE_UNDECIDED' || current[3] !== record.capabilityId) problems.push(`Gate 0B.1 classification ${record.id} was changed or reverted`)
    if (recorded[record.id] !== record.capabilityId) problems.push(`Gate 0B.1 classification ${record.id} is missing or changed in the ledger`)
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
    if (record.id !== UNRESOLVED_OPERATION) problems.push(`operation ${record.id} is unresolved but is not a recorded evidence gap`)
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
  const notBlocking = register.filter((defect) => defect.releaseBlocking === true && !result.releaseBlockingDefects.some((entry) => entry.defectId === defect.id))
  for (const defect of notBlocking) problems.push(`defect ${defect.id} is marked release blocking without an unjustified exposure that requires it`)

  const summary = {
    tranche: TRANCHE_ID,
    examined: records.length,
    carriedForward: carry.size,
    newlyExamined: (manifest?.newOperations ?? []).length,
    classified: classified.length,
    unresolved: unresolved.length,
    carriedForwardResolved: classified.filter((record) => carry.has(record.id)).length,
    newDefects: register.filter((defect) => defect.tranche === '0B.3').length,
    defectsTotal: register.length,
    institutionalDecisions: decisions.length,
    crossTenantExposures: records.filter((record) => record.crossTenantExposure === true).length,
    newCapabilities: NEW_CAPABILITY_IDS.length,
  }
  if (classification.summary && JSON.stringify(classification.summary) !== JSON.stringify(summary)) problems.push('classification summary does not match its records')
  result.summary = summary
  return result
}
