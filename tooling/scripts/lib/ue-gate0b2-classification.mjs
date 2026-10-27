/**
 * Gate 0B.2 route-classification validator.
 *
 * The tranche is the 19 operations Gate 0B.1 left unresolved plus the next 81 previously unexamined SCOPE_UNDECIDED
 * operations. A record is accepted as classified only when it names a capability whose business domain covers the
 * route through a Gate 0B.2 ownership group, cites source that was read, and states the authorization, tenant scope
 * and audit the code actually applies. Ownership is accountability, never authorization: a role floor is not a kernel
 * decision, a manifest audit class is a declaration, and public cross-tenant data is not authorized by being public.
 */
import { createHash } from 'node:crypto'
import { UNDECIDED_OWNER } from './ue-gate0-route-ownership.mjs'
import {
  AUTH_CATEGORIES, IMPLEMENTATION_STATUSES, MUTATING_METHODS, MUTATION_AUDITS, RECORD_FIELDS, CRUD_GOVERNANCE_FILE, KERNEL_EVIDENCE,
  ROLE_FLOOR_CONTROLS, compareCodeUnit, evidenceProblems, governanceClassOf, nonEmpty, trancheHash,
} from './ue-gate0b1-classification.mjs'
import {
  ANCHOR_COMMIT, CAPABILITY_DOMAINS, CARRY_FORWARD_COUNT, CARRY_FORWARD_FROM, NEW_UNEXAMINED_COUNT, OWNERSHIP_GROUPS, TRANCHE_ID, TRANCHE_SIZE,
} from './ue-gate0b2-groups.mjs'

export const FILES_0B2 = {
  manifest: 'docs/union-eyes/convergence/register/ue-route-tranche-0b2-manifest.json',
  classification: 'docs/union-eyes/convergence/register/ue-route-classification-0b2.json',
}

export const MUTATION_AUDITS_0B2 = [...MUTATION_AUDITS, 'SEPARATE_AUDIT_EVENT_NOT_ATOMIC', 'ATOMIC_AUDIT_LOCAL_PART_ONLY']
export const RECORD_FIELDS_0B2 = [
  ...RECORD_FIELDS, 'authenticationMechanism', 'dataOwnership', 'privacyDisclosure', 'implementedBehavior', 'requiredGate', 'requiredFutureGuard', 'institutionalDecisions',
]
export const UNRESOLVED_FIELDS_0B2 = ['evidenceGap', 'softwareOwnerCandidate']
export const CATCH_ALL_CAPABILITIES = [UNDECIDED_OWNER]
export const SEPARATE_AUDIT_QUOTES = /auditAiInteraction|auditAIInvocation|auditLog|logApiAuditEvent/

export function contractHash(record) {
  return createHash('sha256').update(JSON.stringify({ exposureContract: record.exposureContract ?? null, requiredSecurityContract: record.requiredSecurityContract ?? null, securityContract: record.securityContract ?? null })).digest('hex')
}

export function selectNewOperations(anchoredEntries, carryForward, size = NEW_UNEXAMINED_COUNT) {
  const held = new Set(carryForward)
  return anchoredEntries
    .filter((entry) => entry[4] === 'SCOPE_UNDECIDED')
    .map((entry) => `${entry[0]}|${entry[1]}`)
    .filter((id) => !held.has(id))
    .sort(compareCodeUnit)
    .slice(0, size)
}

export function validateTranche2({ manifest, ledger, universe, anchoredEntries, classification0b1, manifest0b1 }) {
  const problems = []
  if (!manifest || manifest.schemaVersion !== 1 || manifest.tranche !== TRANCHE_ID) return ['tranche manifest is missing or is not the GATE-0B.2 manifest']
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
  if (!recorded) problems.push('classification ledger does not record the GATE-0B.2 tranche version and hash')
  else if (manifest.version < recorded.version) problems.push('tranche version moved backwards against the ledger')
  else if (manifest.version === recorded.version && recorded.operationsHash !== hash) problems.push('tranche order or membership changed without a new versioned reason')
  else if (manifest.version > recorded.version) {
    const next = log.find((item) => item.version === manifest.version)
    if (!next || !nonEmpty(next.reason, 20)) problems.push('tranche changed without a versioned reason')
  }
  for (const id of ops) if (!universe.has(id)) problems.push(`tranche operation ${id} does not exist in the route-method universe`)

  const carry = Array.isArray(manifest.carryForward) ? manifest.carryForward : []
  const fresh = Array.isArray(manifest.newOperations) ? manifest.newOperations : []
  if (carry.length !== CARRY_FORWARD_COUNT) problems.push(`tranche must carry forward exactly ${CARRY_FORWARD_COUNT} unresolved operations`)
  if (fresh.length !== NEW_UNEXAMINED_COUNT) problems.push(`tranche must add exactly ${NEW_UNEXAMINED_COUNT} previously unexamined operations`)
  if ([...carry, ...fresh].sort(compareCodeUnit).join('\n') !== ops.join('\n')) problems.push('tranche operations are not the carry-forward operations plus the new operations')
  const unresolved0b1 = (classification0b1?.operations ?? []).filter((record) => record.status === 'UNRESOLVED').map((record) => record.id).sort(compareCodeUnit)
  if (unresolved0b1.join('\n') !== [...carry].sort(compareCodeUnit).join('\n')) problems.push('carry-forward operations are not exactly the operations Gate 0B.1 left unresolved')
  const examined0b1 = new Set(manifest0b1?.operations ?? [])
  for (const id of fresh) if (examined0b1.has(id)) problems.push(`new operation ${id} was already examined in Gate 0B.1`)
  if (manifest.anchorCommit !== ANCHOR_COMMIT) problems.push('tranche anchor commit is not the recorded Gate 0B.1 commit')
  if (manifest.version === 1 && anchoredEntries) {
    const expected = selectNewOperations(anchoredEntries, carry)
    if (expected.join('\n') !== fresh.join('\n')) problems.push('new operations are not the next 81 SCOPE_UNDECIDED operations in ascending order at the anchor commit')
  }
  return problems
}

function groupFor(record) {
  return OWNERSHIP_GROUPS.find((group) => group.routes.includes(record.route) && (!group.methods || group.methods.includes(record.method)))
}

function validateRecord2(record, ctx) {
  const { entryByKey, capabilityById, exists, readText, defectIds, decisionIds, carry } = ctx
  const label = `classification ${record?.id ?? '(missing id)'}`
  const out = []
  for (const field of RECORD_FIELDS_0B2) {
    if (record.status === 'UNRESOLVED' && ['proposedCapability', 'unresolvedReason'].includes(field)) continue
    if (!(field in record)) out.push(`${label} is missing ${field}`)
  }
  if (out.length > 0) return out
  const entry = entryByKey.get(record.id)
  if (!entry) return [`${label} has no route ownership entry`]
  if (record.id !== `${record.route}|${record.method}`) out.push(`${label} id does not match its route and method`)
  if (!['CLASSIFIED', 'UNRESOLVED'].includes(record.status)) out.push(`${label} has an invalid status`)
  if (!AUTH_CATEGORIES.includes(record.authorizationCategory)) out.push(`${label} has an invalid authorization category`)
  if (!MUTATION_AUDITS_0B2.includes(record.mutationAudit)) out.push(`${label} has an invalid mutation/audit obligation`)
  if (!IMPLEMENTATION_STATUSES.includes(record.implementationStatus)) out.push(`${label} has an invalid implementation status`)
  for (const field of ['persona', 'serviceOwner', 'authorizationDetail', 'tenantScope', 'dataSensitivity', 'auditDetail', 'authenticationMechanism', 'dataOwnership', 'privacyDisclosure', 'implementedBehavior', 'requiredFutureGuard']) {
    if (!nonEmpty(record[field], 8)) out.push(`${label} has an empty ${field}`)
  }
  if (!Number.isInteger(record.requiredGate) || record.requiredGate < 1 || record.requiredGate > 15) out.push(`${label} names no required engineering gate`)
  if (!Array.isArray(record.institutionalDecisions)) out.push(`${label} must list its institutional decisions, even when empty`)
  for (const id of record.institutionalDecisions ?? []) if (!decisionIds.has(id)) out.push(`${label} cites unknown institutional decision ${id}`)
  out.push(...evidenceProblems(label, record.evidence, exists, readText, { requireFile: `apps/union-eyes/app/api/${record.route}` }))

  const quotes = (record.evidence ?? []).map((item) => String(item.quote ?? ''))
  const quoted = (text) => quotes.some((quote) => quote.includes(text))

  if (record.accessJustifiedBy !== undefined) {
    out.push(`${label} justifies access by ${JSON.stringify(record.accessJustifiedBy)}, but no institutional authority decision is adopted; ownership is not authorization`)
  }

  if (carry.has(record.id)) {
    if (record.carriedForwardFrom !== CARRY_FORWARD_FROM) out.push(`${label} is carried forward but does not record ${CARRY_FORWARD_FROM}`)
  } else if (record.carriedForwardFrom !== undefined) out.push(`${label} claims to be carried forward but is a new operation`)

  const group = groupFor(record)
  if (record.status === 'CLASSIFIED') {
    if (!capabilityById.has(record.capabilityId) || CATCH_ALL_CAPABILITIES.includes(record.capabilityId)) out.push(`${label} names an invalid capability ${record.capabilityId}`)
    if (entry[3] !== record.capabilityId) out.push(`${label} is owned by ${record.capabilityId} but the ownership register names ${entry[3]}`)
    if (entry[4] === 'SCOPE_UNDECIDED') out.push(`${label} is classified but the ownership register still records SCOPE_UNDECIDED`)
    if (!String(entry[2]).startsWith('RULE-0B2-')) out.push(`${label} is owned through ${entry[2]}, not a Gate 0B.2 business-evidence rule; a generic or earlier rule is not business evidence`)
    const domains = CAPABILITY_DOMAINS[record.capabilityId]
    if (!domains || !domains.includes(record.domain)) out.push(`${label} is in the domain ${record.domain}, which ${record.capabilityId} does not cover`)
    if (!group) out.push(`${label} is classified but no Gate 0B.2 ownership group names its route and method`)
    else {
      if (group.capabilityId !== record.capabilityId || group.domain !== record.domain) out.push(`${label} is assigned to ${record.capabilityId} (${record.domain}) but the route belongs to ${group.capabilityId} (${group.domain})`)
      if (entry[2] !== group.id) out.push(`${label} is owned through ${entry[2]} but its group is ${group.id}`)
      if (!Array.isArray(group.evidence) || group.evidence.length === 0) out.push(`${label} belongs to ${group.id}, which has no business evidence`)
    }
  } else if (record.status === 'UNRESOLVED') {
    if (entry[4] !== 'SCOPE_UNDECIDED' || entry[3] !== UNDECIDED_OWNER) out.push(`${label} is unresolved but the ownership register assigns it`)
    if (record.capabilityId !== UNDECIDED_OWNER) out.push(`${label} is unresolved and must name ${UNDECIDED_OWNER}`)
    if (record.domain !== 'UNRESOLVED') out.push(`${label} is unresolved and must use the domain UNRESOLVED`)
    for (const field of UNRESOLVED_FIELDS_0B2) if (!nonEmpty(record[field], 30)) out.push(`${label} is unresolved without ${field}`)
    if (!nonEmpty(record.proposedCapability, 20)) out.push(`${label} is unresolved without a capability candidate`)
    if (!nonEmpty(record.unresolvedReason, 30)) out.push(`${label} is unresolved without a reason`)
    if (!Array.isArray(record.institutionalDecisions) || record.institutionalDecisions.length === 0) out.push(`${label} is unresolved without naming the institutional decision it waits on`)
  }

  if (record.control !== entry[5]) out.push(`${label} records control ${record.control} but the ownership register derives ${entry[5]}`)
  if (record.manifestAudit !== entry[6]) out.push(`${label} records manifest audit ${record.manifestAudit} but the ownership register derives ${entry[6]}`)

  if (typeof record.kernelAuthorization !== 'boolean') out.push(`${label} kernelAuthorization must be true or false`)
  const kernelClaim = record.kernelAuthorization === true || record.authorizationCategory === 'KERNEL_AUTHORITY'
  if (kernelClaim) {
    if (record.kernelAuthorization !== true || record.authorizationCategory !== 'KERNEL_AUTHORITY') out.push(`${label} is inconsistent about kernel authorization`)
    if (!quotes.some((quote) => KERNEL_EVIDENCE.test(quote))) out.push(`${label} claims kernel authorization but cites no kernel decision; a role floor is not a kernel decision`)
    if (ROLE_FLOOR_CONTROLS.includes(entry[5])) out.push(`${label} claims kernel authorization while the guard is the role floor ${entry[5]}`)
  }
  if (record.authorizationCategory === 'ROLE_FLOOR' && record.kernelAuthorization !== false) out.push(`${label} is a role floor and must record kernelAuthorization false`)

  const mutating = MUTATING_METHODS.includes(record.method)
  if (record.crudTable) {
    const governed = governanceClassOf(readText(CRUD_GOVERNANCE_FILE), record.crudTable)
    if (governed !== record.crudGovernanceClass) out.push(`${label} records ${record.crudTable} as ${record.crudGovernanceClass} but the CRUD governance table says ${governed}`)
    if (mutating && governed !== 'OPERATIONAL' && record.mutationAudit !== 'WRITE_REFUSED_BY_GOVERNANCE') out.push(`${label} writes ${record.crudTable}, which is ${governed}: the generic route refuses the write, so it cannot be recorded as audited`)
    if (mutating && governed === 'OPERATIONAL' && record.mutationAudit !== 'ATOMIC_AUDIT_IN_TRANSACTION') out.push(`${label} writes an OPERATIONAL table through the factory, which audits atomically`)
  }
  if (record.mutationAudit === 'NOT_MUTATING' && mutating && !nonEmpty(record.nonMutationReason, 15)) out.push(`${label} is ${record.method} but is marked not mutating without a reason`)
  if (!mutating && !['NOT_MUTATING', 'SEPARATE_AUDIT_EVENT_NOT_ATOMIC'].includes(record.mutationAudit)) out.push(`${label} is a read method but records a mutation obligation`)
  if (record.mutationAudit === 'ATOMIC_AUDIT_IN_TRANSACTION') {
    if (!quoted('persistAtomicAudit')) out.push(`${label} is marked atomically audited without citing an in-transaction audit write`)
  }
  if (record.mutationAudit === 'ATOMIC_AUDIT_LOCAL_PART_ONLY') {
    if (!quoted('persistAtomicAudit')) out.push(`${label} is marked atomic for its local part without citing an in-transaction audit write`)
    if (!(record.manifestCorrections ?? []).some((item) => item.field === 'audit')) out.push(`${label} is audited atomically for its local part only and must correct the manifest audit declaration`)
  }
  if (record.mutationAudit === 'SEPARATE_AUDIT_EVENT_NOT_ATOMIC') {
    if (!quotes.some((quote) => SEPARATE_AUDIT_QUOTES.test(quote))) out.push(`${label} records a separate audit event without citing it`)
    if (!mutating && !quotes.some((quote) => /\.insert\(|\.update\(|\.delete\(/.test(quote))) out.push(`${label} is a read that records a write without citing the write`)
    if (!mutating && !(record.manifestCorrections ?? []).some((item) => item.field === 'mutating')) out.push(`${label} is a GET that writes a row and must correct the manifest read-only classification`)
  }
  if (record.mutationAudit === 'INTENT_OUTCOME_AUDIT_NOT_ATOMIC' && !quoted('performAuditedOperation')) out.push(`${label} records intent/outcome audit without citing it`)
  if (record.mutationAudit === 'LOG_ONLY' && !quoted('logApiAuditEvent')) out.push(`${label} records log-only audit without citing it`)
  if (record.mutationAudit === 'WRITE_REFUSED_BY_GOVERNANCE' && !quoted('assertCrudWrite')) out.push(`${label} records a refused write without citing the refusal`)
  if (entry[6].startsWith('AUDIT_DECLARED_ATOMIC') && record.mutationAudit !== 'ATOMIC_AUDIT_IN_TRANSACTION' && !(record.manifestCorrections ?? []).some((item) => item.field === 'audit')) {
    out.push(`${label} is declared atomically audited by the manifest but the source does not show it, and no correction is recorded`)
  }
  for (const correction of record.manifestCorrections ?? []) {
    if (!nonEmpty(correction.field) || !nonEmpty(correction.manifest) || !nonEmpty(correction.actual, 8)) out.push(`${label} has a malformed manifest correction`)
  }

  const publicRowQuoted = quotes.some((quote) => /is_public = true|\.isPublic|isPublic\)/.test(quote))
  if (record.crossTenantExposure === true) {
    if (record.crossTenantAuthorized !== false) out.push(`${label} exposes cross-tenant data and records it as authorized; public or cross-tenant data is not authorized by being reachable`)
    if (!nonEmpty(record.exposureContract, 30)) out.push(`${label} exposes cross-tenant data without an exposure contract`)
    if (!Array.isArray(record.defects) || record.defects.length === 0) out.push(`${label} exposes cross-tenant data without a recorded defect`)
  } else {
    if (record.crossTenantAuthorized === true) out.push(`${label} records cross-tenant access as authorized`)
    if (publicRowQuoted) out.push(`${label} cites a public-row read across organizations but does not record the cross-tenant exposure`)
  }
  for (const id of record.defects ?? []) if (!defectIds.has(id)) out.push(`${label} cites unknown defect ${id}`)
  return out
}

export function validateClassification2({
  classification, manifest, ledger, classification0b1, manifest0b1, entries, capabilityById, universe, exists, readText, anchoredEntries,
}) {
  const problems = []
  const entryByKey = new Map(entries.map((entry) => [`${entry[0]}|${entry[1]}`, entry]))
  problems.push(...validateTranche2({ manifest, ledger, universe, anchoredEntries, classification0b1, manifest0b1 }))
  const result = { problems, summary: null, registeredReleaseBlocking: new Set(), releaseBlockingDefects: [] }
  if (!classification || classification.schemaVersion !== 1 || classification.tranche !== TRANCHE_ID) {
    problems.push('route classification file is missing or is not the GATE-0B.2 classification')
    return result
  }
  const hash = trancheHash(manifest?.operations ?? [])
  if (classification.trancheVersion !== manifest?.version || classification.operationsHash !== hash) problems.push('classification does not match the frozen tranche version and hash')

  const decisions = Array.isArray(classification.institutionalDecisions) ? classification.institutionalDecisions : []
  const decisionIds = new Set()
  for (const decision of decisions) {
    if (!nonEmpty(decision.id) || decisionIds.has(decision.id)) problems.push(`institutional decision ${decision.id ?? '(missing id)'} has a missing or duplicate id`)
    decisionIds.add(decision.id)
    if (decision.status !== 'OUTSTANDING') problems.push(`institutional decision ${decision.id} is ${decision.status}; Gate 0B.2 can record only outstanding decisions and none can justify access`)
    if (!nonEmpty(decision.question, 20) || !nonEmpty(decision.sourceState, 30)) problems.push(`institutional decision ${decision.id} is incomplete`)
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
    if (!['0B.1', '0B.2'].includes(defect.tranche)) problems.push(`defect ${defect.id} does not record the tranche that found it`)
  }
  const defects0b1 = Array.isArray(classification0b1?.defects) ? classification0b1.defects : []
  for (const old of defects0b1) {
    const kept = byId.get(old.id)
    if (!kept) problems.push(`Gate 0B.1 defect ${old.id} is missing from the defect register`)
    else if (kept.gate !== old.gate || kept.severity !== old.severity || kept.tranche !== '0B.1') problems.push(`Gate 0B.1 defect ${old.id} was altered in the defect register`)
  }
  if (register.filter((defect) => defect.tranche === '0B.1').length !== defects0b1.length) problems.push('defect register holds a Gate 0B.1 defect that Gate 0B.1 did not record')

  const carry = new Set(manifest?.carryForward ?? [])
  const ctx = { entryByKey, capabilityById, exists, readText, defectIds, decisionIds, carry }
  const records = Array.isArray(classification.operations) ? classification.operations : []
  const frozen = manifest?.operations ?? []
  const frozenSet = new Set(frozen)
  const seen = new Set()
  const cited = new Set()
  for (const record of records) {
    if (seen.has(record.id)) problems.push(`classification ${record.id} is recorded twice`)
    seen.add(record.id)
    if (!frozenSet.has(record.id)) problems.push(`classification ${record.id} is not in the frozen tranche`)
    problems.push(...validateRecord2(record, ctx))
    for (const id of record.defects ?? []) cited.add(id)
  }
  for (const id of frozen) if (!seen.has(id)) problems.push(`tranche operation ${id} has no classification record`)
  for (const defect of register) {
    if (defect.tranche === '0B.2' && !cited.has(defect.id)) problems.push(`defect ${defect.id} is recorded but no classification cites it`)
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
    newDefects: register.filter((defect) => defect.tranche === '0B.2').length,
    defectsTotal: register.length,
    institutionalDecisions: decisions.length,
    crossTenantExposures: records.filter((record) => record.crossTenantExposure === true).length,
  }
  if (classification.summary && JSON.stringify(classification.summary) !== JSON.stringify(summary)) problems.push('classification summary does not match its records')
  result.summary = summary
  return result
}
