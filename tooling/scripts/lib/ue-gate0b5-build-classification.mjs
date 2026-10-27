/**
 * Builds the Gate 0B.5 tranche manifest, classification register and ledger entries. The tranche is selected from the
 * ownership register at the Gate 0B.4 commit and then frozen: an existing manifest is verified, never regenerated.
 * Build order: ue-gate0-build-ownership.mjs, ue-gate0-build-matrix.mjs, this script, ue-gate0-update-lock.mjs, then
 * ue-gate0-build-matrix.mjs again to pin the written files.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FILES_0B1, compareCodeUnit, trancheHash } from './ue-gate0b1-classification.mjs'
import { FILES_0B2, contractHash, selectNewOperations } from './ue-gate0b2-classification.mjs'
import { FILES_0B3 } from './ue-gate0b3-classification.mjs'
import { FILES_0B4 } from './ue-gate0b4-classification.mjs'
import { FILES_0B5, validateClassification5 } from './ue-gate0b5-classification.mjs'
import { ANCHOR_COMMIT, CARRIED_OPERATIONS, CARRY_FORWARD_FROM, NEW_UNEXAMINED_COUNT, TRANCHE_ID, TRANCHE_SIZE, groupOfRoute } from './ue-gate0b5-groups.mjs'
import { CAPABILITY_GATES_0B5, DEFECTS_0B5, factsFor, institutionalDecisions0b5, isUnresolved } from './ue-gate0b5-facts.mjs'
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

export function buildClassification5() {
  const anchored = anchoredEntries()
  const classification0b1 = readJson(FILES_0B1.classification)
  const manifest0b1 = readJson(FILES_0B1.manifest)
  const classification0b2 = readJson(FILES_0B2.classification)
  const manifest0b2 = readJson(FILES_0B2.manifest)
  const classification0b3 = readJson(FILES_0B3.classification)
  const manifest0b3 = readJson(FILES_0B3.manifest)
  const classification0b4 = readJson(FILES_0B4.classification)
  const manifest0b4 = readJson(FILES_0B4.manifest)
  const carryForward = classification0b4.operations.filter((record) => record.status === 'UNRESOLVED').map((record) => record.id).sort(compareCodeUnit)
  if (carryForward.join('\n') !== [...CARRIED_OPERATIONS].sort(compareCodeUnit).join('\n')) throw new Error('the operations Gate 0B.4 left unresolved are not the four carbon operations')
  const newOperations = selectNewOperations(anchored, carryForward, NEW_UNEXAMINED_COUNT)
  const operations = [...carryForward, ...newOperations].sort(compareCodeUnit)

  let manifest
  if (exists(FILES_0B5.manifest)) {
    manifest = readJson(FILES_0B5.manifest)
    if (manifest.version === 1 && manifest.operations.join('\n') !== operations.join('\n')) {
      throw new Error(`the frozen Gate 0B.5 tranche differs from the carry-forward operations plus the next ${NEW_UNEXAMINED_COUNT} SCOPE_UNDECIDED operations at the anchor commit`)
    }
  } else {
    const hash = trancheHash(operations)
    manifest = {
      schemaVersion: 1,
      tranche: TRANCHE_ID,
      version: 1,
      size: TRANCHE_SIZE,
      selectionRule: `The four operations Gate 0B.4 left UNRESOLVED (carryForward), plus the next ${NEW_UNEXAMINED_COUNT} operations with disposition SCOPE_UNDECIDED in the ownership register at the anchor commit that no earlier tranche examined (newOperations), selected in ascending code-unit order of the string "<route file>|<METHOD>". The tranche lists both sets together in that order.`,
      anchorCommit: ANCHOR_COMMIT,
      carryForwardFrom: CARRY_FORWARD_FROM,
      carryForward,
      newOperations,
      operations,
      operationsHash: hash,
      versionLog: [{ version: 1, date: '2026-10-26', operationsHash: hash, reason: 'Initial freeze of the Gate 0B.5 tranche from the Gate 0B.4 ownership register and classification. No later addition, removal or reorder is allowed without a new version and reason.' }],
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
    const unresolved = isUnresolved(id)
    const group = groupOfRoute(route, method)
    const facts = factsFor(id, readText, exists)
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
      if (!group) throw new Error(`no Gate 0B.5 ownership group names ${id}`)
      record.domain = group.domain
    }
    if (manifest.carryForward.includes(id)) record.carriedForwardFrom = CARRY_FORWARD_FROM
    record.callers = callersOf(route, references)
    record.callerFinding = callerFindingOf(record.callers)
    record.institutionalDecisions = record.institutionalDecisions ?? []
    for (const key of Object.keys(record)) if (record[key] === undefined) delete record[key]
    for (const field of ['defects', 'manifestCorrections']) record[field] = record[field] ?? []
    records.push(record)
  }

  const exposures = classification0b1.unauthenticated.filter((record) => record.disposition === 'UNJUSTIFIED_EXPOSURE')
  const defectRegister = [
    ...classification0b4.defectRegister,
    ...DEFECTS_0B5.map((defect) => ({ ...defect, tranche: '0B.5', releaseBlocking: false })),
  ]

  const hash = trancheHash(manifest.operations)
  const classification = {
    schemaVersion: 1,
    tranche: TRANCHE_ID,
    trancheVersion: manifest.version,
    operationsHash: hash,
    note: 'Source-evidenced classification of the Gate 0B.5 tranche. Ownership is accountability, not authorization: a classified operation names the capability responsible for it, and every gap between that operation and a kernel decision is a recorded defect with one responsible capability. Every material claim of a record cites provenance: the exact method handler, an import it uses, a service it reaches or a schema it resolves. An unresolved operation stays SCOPE_UNDECIDED with its exact evidence gap and a scope disposition that lists the options and adopts none. No institutional decision recorded here is adopted, and none justifies access.',
    institutionalDecisions: institutionalDecisions0b5(classification0b4.institutionalDecisions),
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
  for (const [id, gate] of Object.entries(CAPABILITY_GATES_0B5)) {
    if (capabilityById.get(id)?.primaryGate !== gate) throw new Error(`capability ${id} is not owned by gate ${gate}`)
  }
  const result = validateClassification5({
    classification: { ...classification, summary: undefined },
    manifest,
    ledger,
    classification0b1,
    classification0b2,
    classification0b3,
    classification0b4,
    manifest0b1,
    manifest0b2,
    manifest0b3,
    manifest0b4,
    entries: ownership.entries,
    capabilityById,
    universe: new Set(ownership.entries.map((entry) => `${entry[0]}|${entry[1]}`)),
    exists,
    readText,
    anchoredEntries: anchored,
  })
  return { manifest, classification, ledger, result }
}

export function writeClassification5() {
  const { manifest, classification, ledger, result } = buildClassification5()
  if (result.problems.length > 0) throw new Error(`Gate 0B.5 classification has ${result.problems.length} problem(s):\n${result.problems.slice(0, 80).join('\n')}`)
  classification.summary = result.summary
  writeIfChanged(FILES_0B5.manifest, stable(manifest))
  writeIfChanged(FILES_0B5.classification, stable(classification))
  writeIfChanged(FILES_0B1.ledger, stable(ledger))
  return result.summary
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(writeClassification5(), null, 2))
}
