/**
 * Builds the Gate 0B.7 tranche manifest, classification register, ledger entries and the decision-bound scope
 * exception register. The tranche is selected from the ownership register at the Gate 0B.6 acceptance commit and then
 * frozen: an existing manifest is verified, never regenerated. Build order: ue-gate0-build-ownership.mjs,
 * ue-gate0-build-matrix.mjs, this script, ue-gate0-update-lock.mjs, then ue-gate0-build-matrix.mjs again to pin the
 * written files.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FILES_0B1, compareCodeUnit, trancheHash } from './ue-gate0b1-classification.mjs'
import { FILES_0B2, contractHash, selectNewOperations } from './ue-gate0b2-classification.mjs'
import { FILES_0B3 } from './ue-gate0b3-classification.mjs'
import { FILES_0B4 } from './ue-gate0b4-classification.mjs'
import { FILES_0B5 } from './ue-gate0b5-classification.mjs'
import { FILES_0B6 } from './ue-gate0b6-classification.mjs'
import { FILE_REVIEW_QUEUE, buildReviewQueue } from './ue-gate0b7-release-dispositions.mjs'
import { FILES_0B7, validateClassification7 } from './ue-gate0b7-classification.mjs'
import { ANCHOR_COMMIT, DECISION_BOUND_OPERATIONS, PRIOR_TRANCHES, TRANCHE_ID, TRANCHE_SIZE } from './ue-gate0b7-ids.mjs'
import { groupOfRoute } from './ue-gate0b7-groups.mjs'
import { DECISIONS_0B7, DEFECTS_0B7, UNRESOLVED_0B7, factsFor } from './ue-gate0b7-modules.mjs'
import { FILE_EXCEPTIONS, validateDecisionBoundExceptions } from './ue-gate0b6-exceptions.mjs'
import { callerFindingOf, callersOf, loadApiReferences } from './ue-gate0b3-callers.mjs'
import { FILES } from './ue-gate0-scope-lock.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const readJson = (file) => JSON.parse(readFileSync(join(ROOT, file), 'utf8'))
const exists = (file) => existsSync(join(ROOT, file))
const readText = (file) => readFileSync(join(ROOT, file), 'utf8')
const stable = (value) => `${JSON.stringify(value, null, 2)}\n`

function writeIfChanged(file, text) {
  if (!exists(file) || readText(file) !== text) writeFileSync(join(ROOT, file), text)
}

const gitShow = (commit, file) => execFileSync('git', ['show', `${commit}:${file}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
export const anchoredEntries = (commit = ANCHOR_COMMIT) => JSON.parse(gitShow(commit, FILES.ownership)).entries
const anchoredLedger = (commit = ANCHOR_COMMIT) => JSON.parse(gitShow(commit, FILES_0B1.ledger))

export function buildClassification7() {
  const anchored = anchoredEntries()
  const classification0b1 = readJson(FILES_0B1.classification)
  const classification0b2 = readJson(FILES_0B2.classification)
  const classification0b3 = readJson(FILES_0B3.classification)
  const classification0b4 = readJson(FILES_0B4.classification)
  const classification0b5 = readJson(FILES_0B5.classification)
  const classification0b6 = readJson(FILES_0B6.classification)
  const manifests = [FILES_0B1, FILES_0B2, FILES_0B3, FILES_0B4, FILES_0B5, FILES_0B6].map((files) => readJson(files.manifest))
  const priorLedger = exists(FILES_0B1.ledger) ? readJson(FILES_0B1.ledger) : anchoredLedger()
  const operations = selectNewOperations(anchored, DECISION_BOUND_OPERATIONS, TRANCHE_SIZE)

  let manifest
  if (exists(FILES_0B7.manifest)) {
    manifest = readJson(FILES_0B7.manifest)
    if (manifest.version === 1 && manifest.operations.join('\n') !== operations.join('\n')) {
      throw new Error(`the frozen Gate 0B.7 tranche differs from the next ${TRANCHE_SIZE} SCOPE_UNDECIDED operations at the anchor commit`)
    }
  } else {
    const hash = trancheHash(operations)
    manifest = {
      schemaVersion: 1,
      tranche: TRANCHE_ID,
      version: 1,
      size: TRANCHE_SIZE,
      selectionRule: `The next ${TRANCHE_SIZE} operations with disposition SCOPE_UNDECIDED in the ownership register at the anchor commit that no earlier tranche examined, selected in ascending code-unit order of the string "<route file>|<METHOD>". The four decision-bound scope exceptions that Gate 0B.4 and Gate 0B.5 examined are excluded from selection (excludedDecisionBound) and nothing is carried forward.`,
      anchorCommit: ANCHOR_COMMIT,
      carryForward: [],
      excludedDecisionBound: [...DECISION_BOUND_OPERATIONS].sort(compareCodeUnit),
      priorTranches: PRIOR_TRANCHES.map((tranche) => ({ tranche, version: priorLedger.tranches[tranche].version, operationsHash: priorLedger.tranches[tranche].operationsHash })),
      newOperations: operations,
      operations,
      operationsHash: hash,
      versionLog: [{ version: 1, date: '2026-10-27', operationsHash: hash, reason: 'Initial freeze of the Gate 0B.7 tranche from the Gate 0B.6 ownership register and classification. No later addition, removal or reorder is allowed without a new version and reason.' }],
    }
  }

  const ownership = readJson(FILES.ownership)
  const entryByKey = new Map(ownership.entries.map((entry) => [`${entry[0]}|${entry[1]}`, entry]))
  const references = loadApiReferences(ROOT)
  const records = []
  for (const id of manifest.operations) {
    if (UNRESOLVED_0B7.has(id)) throw new Error(`${id} is listed unresolved; Gate 0B.7 records none`)
    const [route, method] = id.split('|')
    const entry = entryByKey.get(id)
    if (!entry) throw new Error(`tranche operation ${id} is not in the ownership register`)
    const group = groupOfRoute(route, method)
    if (!group) throw new Error(`no Gate 0B.7 ownership group names ${id}`)
    const record = {
      id, route, method, status: 'CLASSIFIED', capabilityId: entry[3], control: entry[5], manifestAudit: entry[6],
      kernelAuthorization: false, ...factsFor(id, readText, exists), domain: group.domain,
    }
    record.callers = callersOf(route, references)
    record.callerFinding = callerFindingOf(record.callers)
    record.institutionalDecisions = record.institutionalDecisions ?? []
    for (const key of Object.keys(record)) if (record[key] === undefined) delete record[key]
    for (const field of ['defects', 'manifestCorrections']) record[field] = record[field] ?? []
    records.push(record)
  }

  const exposures = classification0b1.unauthenticated.filter((record) => record.disposition === 'UNJUSTIFIED_EXPOSURE')
  const defectRegister = [
    ...classification0b6.defectRegister,
    ...DEFECTS_0B7.map((defect) => ({ ...defect, tranche: '0B.7', releaseBlocking: defect.releaseDisposition?.disposition === 'RELEASE_BLOCKING' })),
  ]
  const hash = trancheHash(manifest.operations)
  const classification = {
    schemaVersion: 1,
    tranche: TRANCHE_ID,
    trancheVersion: manifest.version,
    operationsHash: hash,
    note: 'Source-evidenced classification of the Gate 0B.7 tranche. Ownership is accountability, not authorization: a classified operation names the engineering capability responsible for it, and every gap between that operation and a kernel decision is a recorded defect with one responsible capability. Every material claim of a record cites provenance: the exact method handler, an import it uses, a service it reaches or a schema it resolves. A missing institutional mandate does not prevent an engineering owner and no capability was invented to reduce SCOPE_UNDECIDED. No institutional decision recorded here is adopted, and none justifies access. The four carbon operations are not part of this tranche; they are held in the decision-bound scope exception register.',
    institutionalDecisions: [...classification0b6.institutionalDecisions, ...DECISIONS_0B7],
    defectRegister,
    releaseBlockingExposures: exposures.map((record) => ({
      id: record.id, ownerGate: record.ownerGate, releaseBlocking: true, defects: record.defects, contractSha256: contractHash(record),
    })),
    operations: records,
  }

  const ledger = {
    ...priorLedger,
    tranches: { ...priorLedger.tranches, [TRANCHE_ID]: { version: manifest.version, operationsHash: hash } },
    classified: { ...priorLedger.classified },
    classifiedIn: { ...(priorLedger.classifiedIn ?? {}) },
  }
  for (const record of records) {
    ledger.classified[record.id] = record.capabilityId
    ledger.classifiedIn[record.id] = TRANCHE_ID
  }

  const capabilities = readJson('docs/union-eyes/convergence/register/ue-pre-vs-engineering-completion.json').capabilities
  const capabilityById = new Map(capabilities.map((capability) => [capability.id, capability]))
  const universe = new Set(ownership.entries.map((entry) => `${entry[0]}|${entry[1]}`))
  const exceptionRegister = readJson(FILE_EXCEPTIONS)
  const reviewQueue = exists(FILE_REVIEW_QUEUE) ? readJson(FILE_REVIEW_QUEUE) : buildReviewQueue({ defectRegister: classification0b6.defectRegister, anchorCommit: ANCHOR_COMMIT })
  const exceptionResult = validateDecisionBoundExceptions({
    register: exceptionRegister, classification0b4, classification0b5, latestDecisions: classification.institutionalDecisions, defectRegister,
    ledger, entries: ownership.entries, capabilityById, universe, laterOperations: new Set([...(manifests[5].operations ?? []), ...manifest.operations]),
  })
  const result = validateClassification7({
    classification: { ...classification, summary: undefined },
    manifest,
    ledger,
    classification0b1, classification0b2, classification0b3, classification0b4, classification0b5, classification0b6,
    manifest0b1: manifests[0], manifest0b2: manifests[1], manifest0b3: manifests[2], manifest0b4: manifests[3], manifest0b5: manifests[4], manifest0b6: manifests[5],
    reviewQueue,
    entries: ownership.entries,
    capabilityById,
    universe,
    exists,
    readText,
    anchoredEntries: anchored,
    exceptionIds: exceptionResult.operations,
  })
  result.problems.push(...exceptionResult.problems)
  return { manifest, classification, ledger, result, reviewQueue }
}

export function writeClassification7() {
  const { manifest, classification, ledger, result, reviewQueue } = buildClassification7()
  if (result.problems.length > 0) throw new Error(`Gate 0B.7 classification has ${result.problems.length} problem(s):\n${result.problems.slice(0, 80).join('\n')}`)
  classification.summary = result.summary
  writeIfChanged(FILES_0B7.manifest, stable(manifest))
  writeIfChanged(FILES_0B7.classification, stable(classification))
  writeIfChanged(FILES_0B1.ledger, stable(ledger))
  writeIfChanged(FILE_REVIEW_QUEUE, stable(reviewQueue))
  return result.summary
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(writeClassification7(), null, 2))
}
