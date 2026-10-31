/**
 * Builds the Gate 0B.3 tranche manifest, classification register and ledger entries. The tranche is selected from the
 * ownership register at the Gate 0B.2 commit and then frozen: an existing manifest is verified, never regenerated.
 * Build order: ue-gate0-build-matrix.mjs, this script, then ue-gate0-build-matrix.mjs again to pin the written files.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FILES_0B1, compareCodeUnit, trancheHash } from './ue-gate0b1-classification.mjs'
import { FILES_0B2, contractHash, selectNewOperations } from './ue-gate0b2-classification.mjs'
import { FILES_0B3, validateClassification3 } from './ue-gate0b3-classification.mjs'
import { ANCHOR_COMMIT, CARRY_FORWARD_FROM, NEW_UNEXAMINED_COUNT, TRANCHE_ID, TRANCHE_SIZE, groupOfRoute } from './ue-gate0b3-groups.mjs'
import { CAPABILITY_GATES_0B3, DEFECTS_0B3, INSTITUTIONAL_DECISIONS_0B3, UNRESOLVED_0B3, factsFor } from './ue-gate0b3-facts.mjs'
import { callerFindingOf, callersOf, loadApiReferences } from './ue-gate0b3-callers.mjs'
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

export function buildClassification3() {
  const anchored = anchoredEntries()
  const classification0b1 = readJson(FILES_0B1.classification)
  const manifest0b1 = readJson(FILES_0B1.manifest)
  const classification0b2 = readJson(FILES_0B2.classification)
  const manifest0b2 = readJson(FILES_0B2.manifest)
  const carryForward = classification0b2.operations.filter((record) => record.status === 'UNRESOLVED').map((record) => record.id).sort(compareCodeUnit)
  const newOperations = selectNewOperations(anchored, carryForward, NEW_UNEXAMINED_COUNT)
  const operations = [...carryForward, ...newOperations].sort(compareCodeUnit)

  let manifest
  if (exists(FILES_0B3.manifest)) {
    manifest = readJson(FILES_0B3.manifest)
    if (manifest.version === 1 && manifest.operations.join('\n') !== operations.join('\n')) {
      throw new Error('the frozen Gate 0B.3 tranche differs from the carry-forward operation plus the next 99 SCOPE_UNDECIDED operations at the anchor commit')
    }
  } else {
    const hash = trancheHash(operations)
    manifest = {
      schemaVersion: 1,
      tranche: TRANCHE_ID,
      version: 1,
      size: TRANCHE_SIZE,
      selectionRule: 'The operation Gate 0B.2 left UNRESOLVED (carryForward), plus the next 99 operations with disposition SCOPE_UNDECIDED in the ownership register at the anchor commit that no earlier tranche examined (newOperations), selected in ascending code-unit order of the string "<route file>|<METHOD>". The tranche lists both sets together in that order.',
      anchorCommit: ANCHOR_COMMIT,
      carryForwardFrom: CARRY_FORWARD_FROM,
      carryForward,
      newOperations,
      operations,
      operationsHash: hash,
      versionLog: [{ version: 1, date: '2026-10-26', operationsHash: hash, reason: 'Initial freeze of the Gate 0B.3 tranche from the Gate 0B.2 ownership register and classification. No later addition, removal or reorder is allowed without a new version and reason.' }],
    }
  }

  const ownership = readJson(FILES.ownership)
  const entryByKey = new Map(ownership.entries.map((entry) => [`${entry[0]}|${entry[1]}`, entry]))
  const references = loadApiReferences(ROOT)
  const records = []
  for (const id of manifest.operations) {
    const [route, method] = id.split('|')
    const entry = entryByKey.get(id)
    if (!entry) throw new Error(`tranche operation ${id} is not in the ownership register`)
    const group = groupOfRoute(route, method)
    const unresolved = UNRESOLVED_0B3[id]
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
      if (!group) throw new Error(`no Gate 0B.3 ownership group names ${id}`)
      record.domain = group.domain
    }
    if (manifest.carryForward.includes(id)) record.carriedForwardFrom = CARRY_FORWARD_FROM
    record.callers = callersOf(route, references)
    record.callerFinding = callerFindingOf(record.callers)
    record.institutionalDecisions = record.institutionalDecisions ?? []
    if (record.mutationAudit === 'INTENT_OUTCOME_AUDIT_NOT_ATOMIC' && !record.evidence.some((item) => item.quote.includes('performAuditedOperation'))) {
      record.evidence = [...record.evidence, { ref: `apps/union-eyes/app/api/${route}`, quote: 'performAuditedOperation' }]
    }
    for (const key of Object.keys(record)) if (record[key] === undefined) delete record[key]
    for (const field of ['defects', 'manifestCorrections']) record[field] = record[field] ?? []
    records.push(record)
  }

  const exposures = classification0b1.unauthenticated.filter((record) => record.disposition === 'UNJUSTIFIED_EXPOSURE')
  const defectRegister = [
    ...classification0b2.defectRegister,
    ...DEFECTS_0B3.map((defect) => ({ ...defect, tranche: '0B.3', releaseBlocking: false })),
  ]

  const hash = trancheHash(manifest.operations)
  const classification = {
    schemaVersion: 1,
    tranche: TRANCHE_ID,
    trancheVersion: manifest.version,
    operationsHash: hash,
    note: 'Source-evidenced classification of the Gate 0B.3 tranche. Ownership is accountability, not authorization: a classified operation names the capability responsible for it, and every gap between that operation and a kernel decision is a recorded defect with one responsible capability. An unresolved operation stays SCOPE_UNDECIDED with its exact evidence gap. No institutional decision recorded here is adopted, and none justifies access.',
    institutionalDecisions: [...classification0b2.institutionalDecisions, ...INSTITUTIONAL_DECISIONS_0B3.filter((decision) => !classification0b2.institutionalDecisions.some((prior) => prior.id === decision.id))],
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
  for (const [id, gate] of Object.entries(CAPABILITY_GATES_0B3)) {
    if (capabilityById.get(id)?.primaryGate !== gate) throw new Error(`capability ${id} is not owned by gate ${gate}`)
  }
  const result = validateClassification3({
    classification: { ...classification, summary: undefined },
    manifest,
    ledger,
    classification0b1,
    classification0b2,
    manifest0b1,
    manifest0b2,
    entries: ownership.entries,
    capabilityById,
    universe: new Set(ownership.entries.map((entry) => `${entry[0]}|${entry[1]}`)),
    exists,
    readText,
    anchoredEntries: anchored,
  })
  return { manifest, classification, ledger, result }
}

export function writeClassification3() {
  const { manifest, classification, ledger, result } = buildClassification3()
  if (result.problems.length > 0) throw new Error(`Gate 0B.3 classification has ${result.problems.length} problem(s):\n${result.problems.slice(0, 60).join('\n')}`)
  classification.summary = result.summary
  writeIfChanged(FILES_0B3.manifest, stable(manifest))
  writeIfChanged(FILES_0B3.classification, stable(classification))
  writeIfChanged(FILES_0B1.ledger, stable(ledger))
  return result.summary
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(writeClassification3(), null, 2))
}
