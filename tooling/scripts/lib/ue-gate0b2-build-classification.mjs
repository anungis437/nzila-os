/**
 * Builds the Gate 0B.2 tranche manifest, classification register and ledger entries. The tranche is selected from the
 * ownership register at the Gate 0B.1 commit and then frozen: an existing manifest is verified, never regenerated.
 * Build order: ue-gate0-build-matrix.mjs, this script, then ue-gate0-build-matrix.mjs again to pin the written files.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FILES_0B1, compareCodeUnit, trancheHash } from './ue-gate0b1-classification.mjs'
import { FILES_0B2, contractHash, selectNewOperations, validateClassification2 } from './ue-gate0b2-classification.mjs'
import { ANCHOR_COMMIT, CAPABILITY_DOMAINS, CARRY_FORWARD_FROM, TRANCHE_ID, TRANCHE_SIZE, groupOfRoute } from './ue-gate0b2-groups.mjs'
import { CAPABILITY_GATES, DEFECTS_0B2, INSTITUTIONAL_DECISIONS, ROUTE_DEFECT_OWNERS_0B1, UNRESOLVED_0B2, factsFor } from './ue-gate0b2-facts.mjs'
import { FILES } from './ue-gate0-scope-lock.mjs'
import { UNDECIDED_OWNER } from './ue-gate0-route-ownership.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const readJson = (file) => JSON.parse(readFileSync(join(ROOT, file), 'utf8'))
const exists = (file) => existsSync(join(ROOT, file))
const readText = (file) => readFileSync(join(ROOT, file), 'utf8')
const stable = (value) => `${JSON.stringify(value, null, 2)}\n`

function writeIfChanged(file, text) {
  if (!exists(file) || readText(file) !== text) writeFileSync(join(ROOT, file), text)
}

export function anchoredEntries(commit = ANCHOR_COMMIT) {
  const text = execFileSync('git', ['show', `${commit}:${FILES.ownership}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return JSON.parse(text).entries
}

function anchoredLedger(commit = ANCHOR_COMMIT) {
  return JSON.parse(execFileSync('git', ['show', `${commit}:${FILES_0B1.ledger}`], { cwd: ROOT, encoding: 'utf8' }))
}

export function buildClassification2() {
  const anchored = anchoredEntries()
  const classification0b1 = readJson(FILES_0B1.classification)
  const manifest0b1 = readJson(FILES_0B1.manifest)
  const carryForward = classification0b1.operations.filter((record) => record.status === 'UNRESOLVED').map((record) => record.id).sort(compareCodeUnit)
  const newOperations = selectNewOperations(anchored, carryForward)
  const operations = [...carryForward, ...newOperations].sort(compareCodeUnit)

  let manifest
  if (exists(FILES_0B2.manifest)) {
    manifest = readJson(FILES_0B2.manifest)
    if (manifest.version === 1 && manifest.operations.join('\n') !== operations.join('\n')) {
      throw new Error('the frozen Gate 0B.2 tranche differs from the carry-forward operations plus the next 81 SCOPE_UNDECIDED operations at the anchor commit')
    }
  } else {
    const hash = trancheHash(operations)
    manifest = {
      schemaVersion: 1,
      tranche: TRANCHE_ID,
      version: 1,
      size: TRANCHE_SIZE,
      selectionRule: 'The operations Gate 0B.1 left UNRESOLVED (carryForward), plus the next 81 operations with disposition SCOPE_UNDECIDED in the ownership register at the anchor commit that Gate 0B.1 did not examine (newOperations), selected in ascending code-unit order of the string "<route file>|<METHOD>". The tranche lists both sets together in that order.',
      anchorCommit: ANCHOR_COMMIT,
      carryForwardFrom: CARRY_FORWARD_FROM,
      carryForward,
      newOperations,
      operations,
      operationsHash: hash,
      versionLog: [{ version: 1, date: '2026-10-26', operationsHash: hash, reason: 'Initial freeze of the Gate 0B.2 tranche from the Gate 0B.1 ownership register and classification. No later addition, removal or reorder is allowed without a new version and reason.' }],
    }
  }

  const ownership = readJson(FILES.ownership)
  const entryByKey = new Map(ownership.entries.map((entry) => [`${entry[0]}|${entry[1]}`, entry]))
  const records = []
  for (const id of manifest.operations) {
    const [route, method] = id.split('|')
    const entry = entryByKey.get(id)
    if (!entry) throw new Error(`tranche operation ${id} is not in the ownership register`)
    const group = groupOfRoute(route)
    const unresolved = UNRESOLVED_0B2[id]
    const facts = unresolved ?? factsFor(id, readText)
    const record = {
      id,
      route,
      method,
      status: unresolved ? 'UNRESOLVED' : 'CLASSIFIED',
      capabilityId: unresolved ? UNDECIDED_OWNER : entry[3],
      control: entry[5],
      manifestAudit: entry[6],
      kernelAuthorization: false,
      ...facts,
    }
    if (!unresolved) {
      if (!group) throw new Error(`no Gate 0B.2 ownership group names ${id}`)
      record.domain = group.domain
    }
    record.institutionalDecisions = record.institutionalDecisions ?? []
    if (record.mutationAudit === 'INTENT_OUTCOME_AUDIT_NOT_ATOMIC' && !record.evidence.some((item) => item.quote.includes('performAuditedOperation'))) {
      record.evidence = [...record.evidence, { ref: `apps/union-eyes/app/api/${route}`, quote: 'performAuditedOperation' }]
    }
    for (const key of Object.keys(record)) if (record[key] === undefined) delete record[key]
    for (const field of ['defects', 'manifestCorrections']) record[field] = record[field] ?? []
    records.push(record)
  }

  const exposures = classification0b1.unauthenticated.filter((record) => record.disposition === 'UNJUSTIFIED_EXPOSURE')
  const releaseBlockingIds = new Set(exposures.flatMap((record) => record.defects.filter((defectId) => {
    const defect = classification0b1.defects.find((item) => item.id === defectId)
    return defect?.gate === record.ownerGate
  })))
  const defectRegister = [
    ...classification0b1.defects.map((defect) => {
      const ownerCapabilityId = ROUTE_DEFECT_OWNERS_0B1[defect.id]
      if (!ownerCapabilityId) throw new Error(`Gate 0B.1 defect ${defect.id} has no responsible engineering capability`)
      return { id: defect.id, gate: defect.gate, severity: defect.severity, ownerCapabilityId, tranche: '0B.1', releaseBlocking: releaseBlockingIds.has(defect.id), title: defect.title }
    }),
    ...DEFECTS_0B2.map((defect) => ({ ...defect, tranche: '0B.2', releaseBlocking: false })),
  ]

  const hash = trancheHash(manifest.operations)
  const classification = {
    schemaVersion: 1,
    tranche: TRANCHE_ID,
    trancheVersion: manifest.version,
    operationsHash: hash,
    note: 'Source-evidenced classification of the Gate 0B.2 tranche. Ownership is accountability, not authorization: a classified operation names the capability responsible for it, and every gap between that operation and a kernel decision is a recorded defect with one responsible capability. An unresolved operation stays SCOPE_UNDECIDED with its exact evidence gap. No institutional decision recorded here is adopted, and none justifies access.',
    institutionalDecisions: INSTITUTIONAL_DECISIONS,
    defectRegister,
    releaseBlockingExposures: exposures.map((record) => ({
      id: record.id,
      ownerGate: record.ownerGate,
      releaseBlocking: true,
      defects: record.defects,
      contractSha256: contractHash(record),
    })),
    operations: records,
  }

  const priorLedger = exists(FILES_0B1.ledger) ? readJson(FILES_0B1.ledger) : anchoredLedger()
  const ledger = {
    ...priorLedger,
    tranches: { ...priorLedger.tranches, [TRANCHE_ID]: { version: manifest.version, operationsHash: hash } },
    classified: { ...priorLedger.classified },
    classifiedIn: { ...(priorLedger.classifiedIn ?? {}) },
  }
  for (const record of records) {
    if (record.status !== 'CLASSIFIED') continue
    ledger.classified[record.id] = record.capabilityId
    ledger.classifiedIn[record.id] = TRANCHE_ID
  }

  const capabilities = readJson('docs/union-eyes/convergence/register/ue-pre-vs-engineering-completion.json').capabilities
  const capabilityById = new Map(capabilities.map((capability) => [capability.id, capability]))
  for (const [id, gate] of Object.entries(CAPABILITY_GATES)) {
    if (capabilityById.get(id)?.primaryGate !== gate) throw new Error(`capability ${id} is not owned by gate ${gate}`)
  }
  void CAPABILITY_DOMAINS
  const result = validateClassification2({
    classification: { ...classification, summary: undefined },
    manifest,
    ledger,
    classification0b1,
    manifest0b1,
    entries: ownership.entries,
    capabilityById,
    universe: new Set(ownership.entries.map((entry) => `${entry[0]}|${entry[1]}`)),
    exists,
    readText,
    anchoredEntries: anchored,
  })
  return { manifest, classification, ledger, result }
}

export function writeClassification2() {
  const { manifest, classification, ledger, result } = buildClassification2()
  if (result.problems.length > 0) throw new Error(`Gate 0B.2 classification has ${result.problems.length} problem(s):\n${result.problems.slice(0, 60).join('\n')}`)
  classification.summary = result.summary
  writeIfChanged(FILES_0B2.manifest, stable(manifest))
  writeIfChanged(FILES_0B2.classification, stable(classification))
  writeIfChanged(FILES_0B1.ledger, stable(ledger))
  return result.summary
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(writeClassification2(), null, 2))
}
