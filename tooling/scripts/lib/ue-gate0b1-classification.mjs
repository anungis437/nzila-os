/**
 * Gate 0B.1 route-classification validator.
 *
 * A route-method operation is classified only when a record cites source that was read, names an existing
 * capability whose business domain covers it, and states the control and audit the code actually applies.
 * The guard class and audit code in the route-coverage manifest are declarations, not evidence: this
 * validator never accepts them as proof of kernel authorization or of an atomic audit record.
 */
import { createHash } from 'node:crypto'
import { UNDECIDED_OWNER } from './ue-gate0-route-ownership.mjs'
import { CAPABILITY_DOMAINS, OWNERSHIP_GROUPS, TRANCHE_ID, TRANCHE_SIZE } from './ue-gate0b1-groups.mjs'

export const FILES_0B1 = {
  manifest: 'docs/union-eyes/convergence/register/ue-route-tranche-0b1-manifest.json',
  classification: 'docs/union-eyes/convergence/register/ue-route-classification-0b1.json',
  ledger: 'docs/union-eyes/convergence/register/ue-route-classification-ledger.json',
}

export const AUTH_CATEGORIES = [
  'KERNEL_AUTHORITY',
  'ROLE_FLOOR',
  'PLATFORM_ROLE_FLOOR',
  'PLATFORM_ADMIN_IDENTITY',
  'SESSION_ONLY',
  'EXTERNAL_TRUST',
  'NONE_PUBLIC',
  'REFUSED_501',
]
export const ROLE_FLOOR_CONTROLS = [
  'GENERIC_CRUD_ROLE_FLOOR',
  'ROLE_TITLE_CHECK',
  'ADMIN_ROLE_CHECK',
  'WITH_API_WRAPPER',
  'ORGANIZATION_ROLE_CHECK',
  'SESSION_ONLY',
]
export const MUTATION_AUDITS = [
  'NOT_MUTATING',
  'WRITE_REFUSED_BY_GOVERNANCE',
  'ATOMIC_AUDIT_IN_TRANSACTION',
  'INTENT_OUTCOME_AUDIT_NOT_ATOMIC',
  'LOG_ONLY',
  'NONE',
]
export const IMPLEMENTATION_STATUSES = [
  'IMPLEMENTED_IN_SOURCE',
  'PARTIAL',
  'FACADE_OVER_GENERIC_TABLE',
  'NOT_IMPLEMENTED_RETURNS_200',
  'HONEST_501',
  'LATENT_NOT_OPERATIONAL',
]
export const UNAUTH_DISPOSITIONS = [
  'INTENTIONALLY_PUBLIC',
  'EXTERNAL_TRUST_MECHANISM',
  'INTERNAL_MACHINE_TO_MACHINE',
  'HEALTH_OR_OPERATIONAL',
  'UNJUSTIFIED_EXPOSURE',
  'AUTHENTICATED_BY_UNDETECTED_GUARD',
]
export const RECORD_FIELDS = [
  'id', 'route', 'method', 'status', 'domain', 'capabilityId', 'persona', 'serviceOwner', 'authorizationCategory',
  'kernelAuthorization', 'authorizationDetail', 'tenantScope', 'dataSensitivity', 'mutationAudit', 'auditDetail',
  'implementationStatus', 'evidence', 'defects', 'manifestCorrections', 'control', 'manifestAudit',
]
const MUTATING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE']
const CRUD_GOVERNANCE_FILE = 'apps/union-eyes/lib/api/crud-governance.ts'
const KERNEL_EVIDENCE = /authorizeAction|authorize\(|kernelDecision|decideAction|authority kernel/

export function governanceClassOf(text, table) {
  for (const name of ['DENIED', 'SUBJECT_OWNED', 'OWN_ROWS_READ', 'READ_ONLY', 'OPERATIONAL']) {
    const block = text.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\] as const`))?.[1] ?? ''
    if (block.includes(`'${table}'`)) return name
  }
  return 'DENIED'
}

export function compareCodeUnit(a, b) {
  return a < b ? -1 : a > b ? 1 : 0
}

export function trancheHash(ids) {
  return createHash('sha256').update(ids.join('\n')).digest('hex')
}

export function selectTranche(undecidedIds, size = TRANCHE_SIZE) {
  return [...undecidedIds].sort(compareCodeUnit).slice(0, size)
}

const nonEmpty = (value, min = 1) => typeof value === 'string' && value.trim().length >= min

function evidenceProblems(label, evidence, exists, readText, { requireFile } = {}) {
  const out = []
  if (!Array.isArray(evidence) || evidence.length === 0) return [`${label} has no source evidence`]
  let sawRequired = !requireFile
  for (const item of evidence) {
    if (!item || !nonEmpty(item.ref) || !nonEmpty(item.quote, 6)) {
      out.push(`${label} has malformed evidence`)
      continue
    }
    if (item.ref === requireFile) sawRequired = true
    if (!exists(item.ref)) out.push(`${label} cites a missing file ${item.ref}`)
    else if (!readText(item.ref).includes(item.quote)) out.push(`${label} cites ${item.ref} but the quoted text is not in the file`)
  }
  if (!sawRequired) out.push(`${label} does not cite its own route file ${requireFile}`)
  return out
}

export function validateTranche({ manifest, ledger, universe, entryByKey, anchoredEntries }) {
  const problems = []
  if (!manifest || manifest.schemaVersion !== 1 || manifest.tranche !== TRANCHE_ID) {
    return ['tranche manifest is missing or is not the GATE-0B.1 manifest']
  }
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
  if (!recorded) problems.push('classification ledger does not record the tranche version and hash')
  else if (manifest.version < recorded.version) problems.push('tranche version moved backwards against the ledger')
  else if (manifest.version === recorded.version && recorded.operationsHash !== hash) {
    problems.push('tranche order or membership changed without a new versioned reason')
  } else if (manifest.version > recorded.version) {
    const log2 = log.find((item) => item.version === manifest.version)
    if (!log2 || !nonEmpty(log2.reason, 20)) problems.push('tranche changed without a versioned reason')
  }
  for (const id of ops) {
    if (!universe.has(id)) problems.push(`tranche operation ${id} does not exist in the route-method universe`)
  }
  if (manifest.version === 1 && anchoredEntries) {
    const undecided = anchoredEntries.filter((entry) => entry[4] === 'SCOPE_UNDECIDED').map((entry) => `${entry[0]}|${entry[1]}`)
    const expected = selectTranche(undecided)
    if (expected.join('\n') !== ops.join('\n')) problems.push('tranche is not the first 100 SCOPE_UNDECIDED operations in ascending order at the anchor commit')
  }
  void entryByKey
  return problems
}

function validateRecord(record, ctx) {
  const { entryByKey, capabilityById, exists, readText, defectIds } = ctx
  const label = `classification ${record?.id ?? '(missing id)'}`
  const out = []
  for (const field of RECORD_FIELDS) {
    if (!(field in record)) out.push(`${label} is missing ${field}`)
  }
  if (out.length > 0) return out
  const entry = entryByKey.get(record.id)
  if (!entry) return [`${label} has no route ownership entry`]
  if (record.id !== `${record.route}|${record.method}`) out.push(`${label} id does not match its route and method`)
  if (!['CLASSIFIED', 'UNRESOLVED'].includes(record.status)) out.push(`${label} has an invalid status`)
  if (!AUTH_CATEGORIES.includes(record.authorizationCategory)) out.push(`${label} has an invalid authorization category`)
  if (!MUTATION_AUDITS.includes(record.mutationAudit)) out.push(`${label} has an invalid mutation/audit obligation`)
  if (!IMPLEMENTATION_STATUSES.includes(record.implementationStatus)) out.push(`${label} has an invalid implementation status`)
  for (const field of ['persona', 'serviceOwner', 'authorizationDetail', 'tenantScope', 'dataSensitivity', 'auditDetail']) {
    if (!nonEmpty(record[field], 8)) out.push(`${label} has an empty ${field}`)
  }
  out.push(...evidenceProblems(label, record.evidence, exists, readText, { requireFile: `apps/union-eyes/app/api/${record.route}` }))

  const quotes = (record.evidence ?? []).map((item) => String(item.quote ?? ''))
  const quoted = (text) => quotes.some((quote) => quote.includes(text))

  if (record.status === 'CLASSIFIED') {
    if (!capabilityById.has(record.capabilityId) || record.capabilityId === UNDECIDED_OWNER) out.push(`${label} names an invalid capability ${record.capabilityId}`)
    if (entry[3] !== record.capabilityId) out.push(`${label} is owned by ${record.capabilityId} but the ownership register names ${entry[3]}`)
    if (entry[4] === 'SCOPE_UNDECIDED') out.push(`${label} is classified but the ownership register still records SCOPE_UNDECIDED`)
    const domains = CAPABILITY_DOMAINS[record.capabilityId]
    if (!domains || !domains.includes(record.domain)) out.push(`${label} is in the domain ${record.domain}, which ${record.capabilityId} does not cover`)
    const group = OWNERSHIP_GROUPS.find((item) => item.routes.includes(record.route))
    if (!group) out.push(`${label} is classified but no Gate 0B.1 ownership group names its route`)
    else if (group.capabilityId !== record.capabilityId || group.domain !== record.domain) {
      out.push(`${label} is assigned to ${record.capabilityId} (${record.domain}) but the route belongs to ${group.capabilityId} (${group.domain})`)
    }
  } else if (record.status === 'UNRESOLVED') {
    if (entry[4] !== 'SCOPE_UNDECIDED' || entry[3] !== UNDECIDED_OWNER) out.push(`${label} is unresolved but the ownership register assigns it`)
    if (record.capabilityId !== UNDECIDED_OWNER) out.push(`${label} is unresolved and must name ${UNDECIDED_OWNER}`)
    if (record.domain !== 'UNRESOLVED') out.push(`${label} is unresolved and must use the domain UNRESOLVED`)
    if (!nonEmpty(record.proposedCapability, 20)) out.push(`${label} is unresolved without a proposed capability candidate`)
    if (!nonEmpty(record.unresolvedReason, 30)) out.push(`${label} is unresolved without a reason`)
  }

  if (record.control !== entry[5]) out.push(`${label} records control ${record.control} but the ownership register derives ${entry[5]}`)
  if (record.manifestAudit !== entry[6]) out.push(`${label} records manifest audit ${record.manifestAudit} but the ownership register derives ${entry[6]}`)

  if (typeof record.kernelAuthorization !== 'boolean') out.push(`${label} kernelAuthorization must be true or false`)
  const kernelClaim = record.kernelAuthorization === true || record.authorizationCategory === 'KERNEL_AUTHORITY'
  if (kernelClaim) {
    if (record.kernelAuthorization !== true || record.authorizationCategory !== 'KERNEL_AUTHORITY') out.push(`${label} is inconsistent about kernel authorization`)
    if (!quotes.some((quote) => KERNEL_EVIDENCE.test(quote))) out.push(`${label} claims kernel authorization but cites no kernel decision; a role floor is not a kernel decision`)
    if (ROLE_FLOOR_CONTROLS.includes(entry[5]) && !(record.manifestCorrections ?? []).some((item) => item.field === 'guard')) {
      out.push(`${label} claims kernel authorization while the guard is the role floor ${entry[5]}`)
    }
  }

  const mutating = MUTATING_METHODS.includes(record.method)
  if (record.crudTable) {
    const governed = governanceClassOf(readText(CRUD_GOVERNANCE_FILE), record.crudTable)
    if (governed !== record.crudGovernanceClass) out.push(`${label} records ${record.crudTable} as ${record.crudGovernanceClass} but the CRUD governance table says ${governed}`)
    if (mutating && governed !== 'OPERATIONAL' && record.mutationAudit !== 'WRITE_REFUSED_BY_GOVERNANCE') {
      out.push(`${label} writes ${record.crudTable}, which is ${governed}: the generic route refuses the write, so it cannot be recorded as audited`)
    }
    if (mutating && governed === 'OPERATIONAL' && record.mutationAudit !== 'ATOMIC_AUDIT_IN_TRANSACTION') out.push(`${label} writes an OPERATIONAL table through the factory, which audits atomically`)
  }
  if (record.mutationAudit === 'NOT_MUTATING' && mutating && !nonEmpty(record.nonMutationReason, 15)) {
    out.push(`${label} is ${record.method} but is marked not mutating without a reason`)
  }
  if (!mutating && record.mutationAudit !== 'NOT_MUTATING') out.push(`${label} is a read method but records a mutation obligation`)
  if (record.mutationAudit === 'ATOMIC_AUDIT_IN_TRANSACTION') {
    if (!quoted('persistAtomicAudit')) out.push(`${label} is marked atomically audited without citing an in-transaction audit write`)
    if (quoted('performAuditedOperation') && !quoted('persistAtomicAudit')) out.push(`${label} is marked atomic but the cited audit is intent and outcome recording`)
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
  for (const id of record.defects ?? []) {
    if (!defectIds.has(id)) out.push(`${label} cites unknown defect ${id}`)
  }
  return out
}

function validateUnauthenticated(record, ctx) {
  const { entryByKey, exists, readText, defectIds } = ctx
  const label = `unauthenticated ${record?.id ?? '(missing id)'}`
  const out = []
  const entry = entryByKey.get(record?.id)
  if (!entry) return [`${label} has no route ownership entry`]
  if (entry[5] !== 'NO_AUTHENTICATION_DECLARED') out.push(`${label} is not an unauthenticated operation in the ownership register`)
  if (!UNAUTH_DISPOSITIONS.includes(record.disposition)) {
    out.push(`${label} has an invalid disposition`)
    return out
  }
  out.push(...evidenceProblems(label, record.evidence, exists, readText, { requireFile: `apps/union-eyes/app/api/${record.route}` }))
  if (!nonEmpty(record.securityContract, 30)) out.push(`${label} has no required security contract`)
  const exposure = record.exposureContract ?? {}
  const quotes = (record.evidence ?? []).map((item) => String(item.quote ?? ''))
  const d = record.disposition
  if (d === 'INTENTIONALLY_PUBLIC') {
    if (!nonEmpty(exposure.dataExposed, 10) || !Array.isArray(exposure.controls) || exposure.controls.length === 0 || !exposure.controls.every((item) => nonEmpty(item, 8))) {
      out.push(`${label} is public without a justified exposure contract (data exposed and abuse controls)`)
    }
    if (!['LISTED', 'NOT_LISTED'].includes(record.allowlist)) out.push(`${label} does not record its public-route allowlist status`)
  }
  if (d === 'HEALTH_OR_OPERATIONAL') {
    if (!nonEmpty(exposure.dataExposed, 10) || !nonEmpty(exposure.boundary, 20)) out.push(`${label} is an operational endpoint without a justified exposure boundary`)
  }
  if (d === 'EXTERNAL_TRUST_MECHANISM' || d === 'INTERNAL_MACHINE_TO_MACHINE') {
    if (!nonEmpty(exposure.trustMechanism, 10)) out.push(`${label} names no trust mechanism`)
    if (!quotes.some((quote) => /verify|signature|HMAC|hmac|token|Token/.test(quote))) out.push(`${label} cites no verification code for its trust mechanism`)
  }
  if (d === 'AUTHENTICATED_BY_UNDETECTED_GUARD') {
    if (!nonEmpty(record.actualGuard, 10)) out.push(`${label} names no actual guard`)
    if (!quotes.some((quote) => /authenticateUser|cognitionRoute|required: true|withApi/.test(quote))) out.push(`${label} cites no guard code`)
  }
  if (d === 'UNJUSTIFIED_EXPOSURE') {
    if (!nonEmpty(record.requiredSecurityContract, 30)) out.push(`${label} is an unjustified exposure without a required security contract`)
    if (!Number.isInteger(record.ownerGate) || record.ownerGate < 1 || record.ownerGate > 15) out.push(`${label} is an unjustified exposure without an owner gate`)
    if (!Array.isArray(record.defects) || record.defects.length === 0) out.push(`${label} is an unjustified exposure without a recorded defect`)
  }
  for (const id of record.defects ?? []) if (!defectIds.has(id)) out.push(`${label} cites unknown defect ${id}`)
  return out
}

export function validateClassification({ classification, manifest, ledger, entries, capabilityById, universe, exists, readText, anchoredEntries }) {
  const problems = []
  const entryByKey = new Map(entries.map((entry) => [`${entry[0]}|${entry[1]}`, entry]))
  problems.push(...validateTranche({ manifest, ledger, universe, entryByKey, anchoredEntries }))
  const result = { problems, summary: null, justifiedUnauthenticated: new Set(), unjustifiedExposure: [], blockers: [] }
  if (!classification || classification.schemaVersion !== 1 || classification.tranche !== TRANCHE_ID) {
    problems.push('route classification file is missing or is not the GATE-0B.1 classification')
    return result
  }
  const hash = trancheHash(manifest?.operations ?? [])
  if (classification.trancheVersion !== manifest?.version || classification.operationsHash !== hash) {
    problems.push('classification does not match the frozen tranche version and hash')
  }
  const defects = Array.isArray(classification.defects) ? classification.defects : []
  const defectIds = new Set()
  for (const defect of defects) {
    if (!nonEmpty(defect.id) || defectIds.has(defect.id)) problems.push(`defect ${defect.id ?? '(missing id)'} has a missing or duplicate id`)
    defectIds.add(defect.id)
    if (!Number.isInteger(defect.gate) || defect.gate < 1 || defect.gate > 15) problems.push(`defect ${defect.id} has no owner gate`)
    if (!nonEmpty(defect.title, 20) || !nonEmpty(defect.severity)) problems.push(`defect ${defect.id} is incomplete`)
  }

  const ctx = { entryByKey, capabilityById, exists, readText, defectIds }
  const records = Array.isArray(classification.operations) ? classification.operations : []
  const frozen = manifest?.operations ?? []
  const frozenSet = new Set(frozen)
  const seen = new Set()
  for (const record of records) {
    if (seen.has(record.id)) problems.push(`classification ${record.id} is recorded twice`)
    seen.add(record.id)
    if (!frozenSet.has(record.id)) problems.push(`classification ${record.id} is not in the frozen tranche`)
    problems.push(...validateRecord(record, ctx))
  }
  for (const id of frozen) {
    if (!seen.has(id)) problems.push(`tranche operation ${id} has no classification record`)
  }

  const classified = records.filter((record) => record.status === 'CLASSIFIED')
  const unresolved = records.filter((record) => record.status === 'UNRESOLVED')
  const recorded = ledger?.classified ?? {}
  for (const record of classified) {
    if (recorded[record.id] !== record.capabilityId) problems.push(`classified operation ${record.id} is not recorded in the classification ledger`)
  }
  for (const [id, capabilityId] of Object.entries(recorded)) {
    const entry = entryByKey.get(id)
    if (!entry) problems.push(`ledger operation ${id} no longer exists in the route-method universe`)
    else if (entry[4] === 'SCOPE_UNDECIDED') problems.push(`previously classified operation ${id} was silently reverted to SCOPE_UNDECIDED`)
    else if (entry[3] !== capabilityId) problems.push(`previously classified operation ${id} changed owner from ${capabilityId} to ${entry[3]} without a versioned reason`)
  }
  if (anchoredEntries) {
    for (const old of anchoredEntries) {
      if (old[4] === 'SCOPE_UNDECIDED') continue
      const current = entryByKey.get(`${old[0]}|${old[1]}`)
      if (current && current[4] === 'SCOPE_UNDECIDED') problems.push(`previously classified operation ${old[0]}|${old[1]} was silently reverted to SCOPE_UNDECIDED`)
    }
  }

  const unauthRecords = Array.isArray(classification.unauthenticated) ? classification.unauthenticated : []
  const unauthSeen = new Set()
  for (const record of unauthRecords) {
    if (unauthSeen.has(record.id)) problems.push(`unauthenticated ${record.id} is recorded twice`)
    unauthSeen.add(record.id)
    problems.push(...validateUnauthenticated(record, ctx))
    if (record.disposition === 'UNJUSTIFIED_EXPOSURE') result.unjustifiedExposure.push(record.id)
    else if (UNAUTH_DISPOSITIONS.includes(record.disposition)) result.justifiedUnauthenticated.add(record.id)
  }
  for (const entry of entries) {
    const key = `${entry[0]}|${entry[1]}`
    if (entry[5] === 'NO_AUTHENTICATION_DECLARED' && !unauthSeen.has(key) && !['RETIRED_501', 'STUB_501'].includes(entry[4])) {
      problems.push(`unauthenticated operation ${key} has no recorded disposition`)
    }
  }
  const dispositions = {}
  for (const record of unauthRecords) dispositions[record.disposition] = (dispositions[record.disposition] ?? 0) + 1
  if (result.unjustifiedExposure.length > 0) {
    result.blockers.push({ code: 'ROUTE_UNJUSTIFIED_EXPOSURE', operations: result.unjustifiedExposure.slice().sort(compareCodeUnit) })
  }
  const summary = {
    tranche: TRANCHE_ID,
    examined: records.length,
    classified: classified.length,
    unresolved: unresolved.length,
    unauthenticatedRecorded: unauthRecords.length,
    unauthenticatedDispositions: dispositions,
    defects: defects.length,
  }
  if (classification.summary && JSON.stringify(classification.summary) !== JSON.stringify(summary)) problems.push('classification summary does not match its records')
  result.summary = summary
  return result
}
