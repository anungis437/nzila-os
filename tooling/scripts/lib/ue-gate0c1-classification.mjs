/**
 * Gate 0C.1 route-classification validator.
 *
 * The canonical route universe gained two operations after Gate 0B froze its 1,644-operation inventory: GET and POST of
 * app/api/reviews/route.ts, which the route-coverage manifest had omitted. This tranche classifies exactly those two
 * operations under the Gate 0B record contract. The record rules are the shared Gate 0B.2 rules plus the Gate 0B.4
 * provenance proof. The twelve Gate 0B tranches are not re-opened here; the universe-transition validator proves they
 * are byte-identical to their accepted commits. Ownership is accountability, not authorization.
 */
import { compareCodeUnit, nonEmpty, trancheHash } from './ue-gate0b1-classification.mjs'
import { RECORD_FIELDS_0B2, contractHash, validateRecordGeneric } from './ue-gate0b2-classification.mjs'
import { recordProvenanceProblems } from './ue-gate0b4-provenance.mjs'
import { RECORD_FIELDS_0B6 } from './ue-gate0b6-classification.mjs'
import { releaseDispositionProblems, validateReviewQueue } from './ue-gate0b7-release-dispositions.mjs'
import { riskCategoryProblems, riskDefectProblems } from './ue-gate0b9-risk-screen.mjs'
import { crossTenantFlagProblems } from './ue-gate0b10-exposure.mjs'
import { callerFindingOf } from './ue-gate0b3-callers.mjs'
import { ADDED_OPERATIONS, ANCHOR_COMMIT, PRIOR_TRANCHES, TRANCHE_DEFECT, TRANCHE_ID } from './ue-gate0c1-ids.mjs'
import { CAPABILITY_DOMAINS, OWNERSHIP_GROUPS } from './ue-gate0c1-groups.mjs'

export const FILES_0C1 = {
  manifest: 'docs/union-eyes/convergence/register/ue-route-tranche-0c1-manifest.json',
  classification: 'docs/union-eyes/convergence/register/ue-route-classification-0c1.json',
  ledger: 'docs/union-eyes/convergence/register/ue-route-classification-ledger-0c.json',
}

export const RECORD_FIELDS_0C1 = [...new Set([...RECORD_FIELDS_0B2, ...RECORD_FIELDS_0B6, 'riskScreen'])]

export const OPTIONS_0C1 = {
  gate: '0C.1',
  rulePrefix: 'RULE-0C1-',
  carryFrom: null,
  domains: CAPABILITY_DOMAINS,
  groups: OWNERSHIP_GROUPS,
  fields: RECORD_FIELDS_0C1,
  readWriteAudits: ['NONE'],
  extraWriteQuotes: /writeFileSync|writeRecord\(/,
  atomicAuditTokens: ['persistAtomicAudit', 'auditAuthorityMutation'],
}

const PRIOR_DISPOSITION_TRANCHES = ['0B.7', '0B.8', '0B.9', '0B.10', '0B.11', '0B.12']

export function validateTranche0c1({ manifest, ledger0b, ledger0c, universe, anchoredOperations, earlierManifests, exceptionIds }) {
  const problems = []
  if (!manifest || manifest.schemaVersion !== 1 || manifest.tranche !== TRANCHE_ID) return ['tranche manifest is missing or is not the GATE-0C.1 manifest']
  const ops = Array.isArray(manifest.operations) ? manifest.operations : []
  if (manifest.size !== ADDED_OPERATIONS.length || ops.length !== ADDED_OPERATIONS.length) problems.push(`tranche ${TRANCHE_ID} must freeze exactly ${ADDED_OPERATIONS.length} operations`)
  if (new Set(ops).size !== ops.length) problems.push('tranche has duplicate operations')
  for (let i = 1; i < ops.length; i += 1) {
    if (compareCodeUnit(ops[i - 1], ops[i]) >= 0) {
      problems.push(`tranche order is not deterministic ascending route/method order at ${ops[i]}`)
      break
    }
  }
  const hash = trancheHash(ops)
  if (manifest.operationsHash !== hash) problems.push('tranche operationsHash does not match the frozen operation list')
  if (ops.join('\n') !== ADDED_OPERATIONS.join('\n')) problems.push('tranche operations are not the operations the canonical universe gained')
  const log = Array.isArray(manifest.versionLog) ? manifest.versionLog : []
  if (!Number.isInteger(manifest.version) || manifest.version < 1) problems.push('tranche version is invalid')
  else {
    for (let v = 1; v <= manifest.version; v += 1) {
      const entry = log.find((item) => item.version === v)
      if (!entry || !nonEmpty(entry.reason, 20)) problems.push(`tranche version ${v} has no versioned reason`)
    }
    const last = log.find((item) => item.version === manifest.version)
    if (last && last.operationsHash !== hash) problems.push('tranche versionLog does not record the current operation list')
  }
  const recorded = ledger0c?.tranches?.[TRANCHE_ID]
  if (!recorded) problems.push('Gate 0C ledger does not record the GATE-0C.1 tranche version and hash')
  else if (manifest.version === recorded.version && recorded.operationsHash !== hash) problems.push('tranche order or membership changed without a new versioned reason')
  else if (manifest.version < recorded.version) problems.push('tranche version moved backwards against the Gate 0C ledger')
  for (const id of ops) if (!universe.has(id)) problems.push(`tranche operation ${id} does not exist in the canonical route-method universe`)
  for (const id of ops) if (anchoredOperations?.has(id)) problems.push(`tranche operation ${id} was already in the historical universe; Gate 0C.1 classifies only operations the universe gained`)
  const examined = new Set((earlierManifests ?? []).flatMap((item) => item?.operations ?? []))
  for (const id of ops) if (examined.has(id)) problems.push(`new operation ${id} was already examined in a Gate 0B tranche`)
  for (const id of ops) if ((exceptionIds ?? new Set()).has(id)) problems.push(`tranche operation ${id} is a decision-bound scope exception and may not be re-examined`)
  if (manifest.anchorCommit !== ANCHOR_COMMIT) problems.push('tranche anchor commit is not the recorded Gate 0B.12 acceptance commit')
  const prior = Array.isArray(manifest.priorTranches) ? manifest.priorTranches : []
  for (const tranche of PRIOR_TRANCHES) {
    const item = prior.find((candidate) => candidate.tranche === tranche)
    const ledgerItem = ledger0b?.tranches?.[tranche]
    if (!item || !ledgerItem || item.version !== ledgerItem.version || item.operationsHash !== ledgerItem.operationsHash) problems.push(`tranche does not record the provenance of ${tranche} as the Gate 0B ledger holds it`)
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
    if (nonEmpty(record.callerFinding, 20) && record.callerFinding !== callerFindingOf(record.callers)) out.push(`${label} has a caller finding that does not match its callers`)
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

/** The record rules of one operation, shared by the validator and the authoring harness. */
export function validateRecord0c1(record, ctx, options = OPTIONS_0C1) {
  const own = validateRecordGeneric(record, ctx, options)
  const problems = [...own]
  if (own.length === 0 || !own.some((item) => item.includes('is missing'))) problems.push(...recordExtraProblems(record, ctx))
  return problems
}

export function validateClassification0c1({
  classification, manifest, ledger0b, ledger0c, classification0b12, manifest0b = [], reviewQueue, entries, capabilityById, universe, exists, readText, anchoredOperations, exceptionIds,
}) {
  const problems = []
  const entryByKey = new Map((entries ?? []).map((entry) => [`${entry[0]}|${entry[1]}`, entry]))
  problems.push(...validateTranche0c1({ manifest, ledger0b, ledger0c, universe, anchoredOperations, earlierManifests: manifest0b, exceptionIds }))
  const result = { problems, summary: null, registeredReleaseBlocking: new Set(), releaseBlockingDispositionDefects: [] }
  if (!classification || classification.schemaVersion !== 1 || classification.tranche !== TRANCHE_ID) {
    problems.push('route classification file is missing or is not the GATE-0C.1 classification')
    return result
  }
  const frozen = manifest?.operations ?? []
  const frozenSet = new Set(frozen)
  if (classification.trancheVersion !== manifest?.version || classification.operationsHash !== trancheHash(frozen)) problems.push('classification does not match the frozen tranche version and hash')

  const decisions = Array.isArray(classification.institutionalDecisions) ? classification.institutionalDecisions : []
  const priorDecisions = classification0b12?.institutionalDecisions ?? []
  if (JSON.stringify(decisions) !== JSON.stringify(priorDecisions)) problems.push('Gate 0C.1 institutional decisions differ from the frozen Gate 0B.12 set; the tranche adopts, closes and adds none')
  const decisionIds = new Set()
  for (const decision of decisions) {
    decisionIds.add(decision.id)
    if (decision.status !== 'OUTSTANDING') problems.push(`institutional decision ${decision.id} is ${decision.status}; Gate 0C.1 can record only outstanding decisions and none can justify access`)
  }

  const register = Array.isArray(classification.defectRegister) ? classification.defectRegister : []
  const priorRegister = Array.isArray(classification0b12?.defectRegister) ? classification0b12.defectRegister : []
  const defectIds = new Set()
  const byId = new Map()
  for (const defect of register) {
    if (!nonEmpty(defect.id) || defectIds.has(defect.id)) problems.push(`defect ${defect.id ?? '(missing id)'} has a missing or duplicate id`)
    defectIds.add(defect.id)
    byId.set(defect.id, defect)
  }
  for (const old of priorRegister) {
    const kept = byId.get(old.id)
    if (!kept) problems.push(`earlier defect ${old.id} is missing from the defect register`)
    else if (JSON.stringify(kept) !== JSON.stringify(old)) problems.push(`earlier defect ${old.id} was altered in the defect register`)
  }
  const fresh = register.filter((defect) => defect.tranche === TRANCHE_DEFECT)
  if (register.length - fresh.length !== priorRegister.length) problems.push('defect register holds an earlier-tranche defect that no earlier tranche recorded')
  for (const defect of fresh) {
    if (!defect.id.startsWith('DEF-0C1-')) problems.push(`defect ${defect.id} must carry the DEF-0C1- prefix`)
    if (!Number.isInteger(defect.gate) || defect.gate < 1 || defect.gate > 15) problems.push(`defect ${defect.id} has no owner gate`)
    if (!nonEmpty(defect.title, 20)) problems.push(`defect ${defect.id} is incomplete`)
    if (!['HIGH', 'MEDIUM', 'LOW'].includes(defect.severity)) problems.push(`defect ${defect.id} has an invalid severity ${JSON.stringify(defect.severity)}`)
    if (!nonEmpty(defect.ownerCapabilityId) || !capabilityById.has(defect.ownerCapabilityId)) problems.push(`defect ${defect.id} has no responsible engineering capability`)
    else if (capabilityById.get(defect.ownerCapabilityId).primaryGate !== defect.gate) problems.push(`defect ${defect.id} is repaired in gate ${defect.gate} but ${defect.ownerCapabilityId} owns gate ${capabilityById.get(defect.ownerCapabilityId).primaryGate}`)
    if (typeof defect.releaseBlocking !== 'boolean') problems.push(`defect ${defect.id} records no release-blocking mark`)
    problems.push(...releaseDispositionProblems(defect, { exists, readText }))
    problems.push(...riskDefectProblems(defect))
    if (defect.releaseBlocking === true && defect.releaseDisposition?.disposition === 'RELEASE_BLOCKING') {
      result.releaseBlockingDispositionDefects.push({ defectId: defect.id, gate: defect.gate, ownerCapabilityId: defect.ownerCapabilityId })
    }
  }
  for (const defect of register.filter((item) => PRIOR_DISPOSITION_TRANCHES.includes(item.tranche))) {
    if (defect.releaseBlocking === true && defect.releaseDisposition?.disposition === 'RELEASE_BLOCKING') {
      result.releaseBlockingDispositionDefects.push({ defectId: defect.id, gate: defect.gate, ownerCapabilityId: defect.ownerCapabilityId })
    }
  }
  const newDefectById = new Map(fresh.map((defect) => [defect.id, defect]))

  const ctx = { entryByKey, capabilityById, exists, readText, defectIds, decisionIds, carry: new Set(), resolvedLater: new Set() }
  const records = Array.isArray(classification.operations) ? classification.operations : []
  const seen = new Set()
  const cited = new Set()
  for (const record of records) {
    if (seen.has(record.id)) problems.push(`classification ${record.id} is recorded twice`)
    seen.add(record.id)
    if (!frozenSet.has(record.id)) problems.push(`classification ${record.id} is not in the frozen tranche`)
    problems.push(...validateRecord0c1(record, ctx))
    problems.push(...riskCategoryProblems(record, newDefectById, { exists, readText }))
    problems.push(...crossTenantFlagProblems(record, newDefectById))
    for (const id of record.defects ?? []) {
      cited.add(id)
      if (!byId.has(id)) problems.push(`classification ${record.id} cites unknown defect ${id}`)
    }
  }
  for (const id of frozen) if (!seen.has(id)) problems.push(`tranche operation ${id} has no classification record`)
  for (const defect of fresh) if (!cited.has(defect.id)) problems.push(`defect ${defect.id} is recorded but no classification cites it`)
  for (const entry of entries ?? []) {
    const id = `${entry[0]}|${entry[1]}`
    if (typeof entry[2] === 'string' && entry[2].startsWith(OPTIONS_0C1.rulePrefix) && !frozenSet.has(id)) problems.push(`ownership rule ${entry[2]} owns ${id}, which is outside the frozen Gate 0C.1 tranche`)
  }

  const classified = records.filter((record) => record.status === 'CLASSIFIED')
  const unresolved = records.filter((record) => record.status === 'UNRESOLVED')
  if (unresolved.length > 0) problems.push(`operation ${unresolved[0].id} is unresolved; Gate 0C.1 records none`)
  const recorded = ledger0c?.classified ?? {}
  const classifiedIn = ledger0c?.classifiedIn ?? {}
  for (const record of classified) {
    if (recorded[record.id] !== record.capabilityId) problems.push(`classified operation ${record.id} is not recorded in the Gate 0C ledger`)
    if (classifiedIn[record.id] !== TRANCHE_ID) problems.push(`classified operation ${record.id} does not record ${TRANCHE_ID} in the Gate 0C ledger`)
  }
  for (const [id, tranche] of Object.entries(classifiedIn)) {
    if (tranche === TRANCHE_ID && !classified.some((record) => record.id === id)) problems.push(`Gate 0C ledger records ${id} as classified in ${TRANCHE_ID} but no classification exists`)
  }
  for (const id of Object.keys(recorded)) if (ledger0b?.classified?.[id]) problems.push(`Gate 0C ledger classifies ${id}, which the Gate 0B ledger already classified`)

  const listed = Array.isArray(classification.releaseBlockingExposures) ? classification.releaseBlockingExposures : []
  const priorListed = Array.isArray(classification0b12?.releaseBlockingExposures) ? classification0b12.releaseBlockingExposures : []
  if (JSON.stringify(listed) !== JSON.stringify(priorListed)) problems.push('the three unjustified public exposures are not preserved exactly as Gate 0B.12 froze them')
  for (const item of listed) result.registeredReleaseBlocking.add(item.id)

  const summary = {
    tranche: TRANCHE_ID,
    examined: records.length,
    classified: classified.length,
    unresolved: unresolved.length,
    newDefects: fresh.length,
    defectsTotal: register.length,
    newDefectsBySeverity: Object.fromEntries(['HIGH', 'MEDIUM', 'LOW'].map((name) => [name, fresh.filter((defect) => defect.severity === name).length])),
    institutionalDecisions: decisions.length,
    newCapabilities: 0,
    operations: frozen,
    ownedBy: [...new Set(classified.map((record) => record.capabilityId))],
    contractHashes: Object.fromEntries(listed.map((item) => [item.id, item.contractSha256])),
    reviewQueue: (reviewQueue?.entries ?? []).length,
  }
  problems.push(...validateReviewQueue({ queue: reviewQueue, defectRegister: register }))
  if (classification.summary && JSON.stringify(classification.summary) !== JSON.stringify(summary)) problems.push('classification summary does not match its records')
  result.summary = summary
  return result
}

export { contractHash }
