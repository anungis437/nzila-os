/**
 * Builds the Gate 0C.1 artifacts: the tranche manifest, the classification register, the separate Gate 0C ledger, the
 * canonical-universe transition record and the Gate 0C handoff register. The two operations are the ones the canonical
 * route universe gained; no Gate 0B file is rewritten. Build order: generate-route-manifest.ts (apps/union-eyes),
 * ue-gate0-build-ownership.mjs through ue-gate0-build-matrix.mjs, this script, then ue-gate0-build-matrix.mjs again to pin
 * the written files.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compareCodeUnit, trancheHash } from './ue-gate0b1-classification.mjs'
import { contractHash } from './ue-gate0b2-classification.mjs'
import { FILES_0B1 } from './ue-gate0b1-classification.mjs'
import { FILES_0B12 } from './ue-gate0b12-classification.mjs'
import { FILE_REVIEW_QUEUE } from './ue-gate0b7-release-dispositions.mjs'
import { FILE_CHALLENGES } from './ue-gate0b11-challenge.mjs'
import { FILE_EXCEPTIONS } from './ue-gate0b6-exceptions.mjs'
import { callerFindingOf, callersOf, loadApiReferences } from './ue-gate0b3-callers.mjs'
import { FILES } from './ue-gate0-scope-lock.mjs'
import { ACCEPTED } from './ue-gate0-history.mjs'
import { ADDED_OPERATIONS, ANCHOR_COMMIT, DECISION_BOUND_OPERATIONS, PRIOR_TRANCHES, TRANCHE_DEFECT, TRANCHE_ID } from './ue-gate0c1-ids.mjs'
import { DEFECTS, DECISIONS, facts as factsFor, RISK_SCREENS } from './ue-gate0c1-facts.mjs'
import { groupOfRoute } from './ue-gate0c1-groups.mjs'
import { FILES_0C1, validateClassification0c1 } from './ue-gate0c1-classification.mjs'
import { opAuthoring } from './ue-gate0b4-fact-helpers.mjs'
import { FILE_TRANSITION, buildTransitionRecord, fileSha256, loadUniverseHistory, validateUniverseTransition } from './ue-gate0c1-universe.mjs'
import { FILE_HANDOFF, buildHandoffRegister, handoffFacts, validateHandoffRegister } from './ue-gate0c1-handoff.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const readJson = (file) => JSON.parse(readFileSync(join(ROOT, file), 'utf8'))
const exists = (file) => existsSync(join(ROOT, file))
const readText = (file) => readFileSync(join(ROOT, file), 'utf8')
const stable = (value) => `${JSON.stringify(value, null, 2)}\n`
const writeIfChanged = (file, text) => {
  if (!exists(file) || readText(file) !== text) writeFileSync(join(ROOT, file), text)
}

export const diskRouteKeys = () => execFileSync('git', ['ls-files', 'apps/union-eyes/app/api'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  .split('\n').filter((file) => file.endsWith('/route.ts')).map((file) => file.replace('apps/union-eyes/app/api/', ''))

const TRANSITION_EVIDENCE = [
  { ref: 'apps/union-eyes/app/api/reviews/route.ts', quote: 'export async function GET() {' },
  { ref: 'apps/union-eyes/app/api/reviews/route.ts', quote: 'export async function POST(request: Request) {' },
  { ref: 'apps/union-eyes/scripts/lib/route-coverage-scan.ts', quote: 'export function scanRoutes(root: string): RouteEntry[] {' },
  { ref: 'docs/union-eyes/convergence/register/ue-route-coverage-manifest.json', quote: '"route": "reviews/route.ts",' },
]

export function buildAll() {
  const ownership = readJson(FILES.ownership)
  const ledger0b = readJson(FILES_0B1.ledger)
  const classification0b12 = readJson(FILES_0B12.classification)
  const manifest = readJson('docs/union-eyes/convergence/register/ue-route-coverage-manifest.json')
  const matrix = readJson(FILES.matrix)
  const lock = readJson(FILES.lock)
  const reviewQueue = readJson(FILE_REVIEW_QUEUE)
  const challenges = readJson(FILE_CHALLENGES)
  const exceptionRegister = readJson(FILE_EXCEPTIONS)
  const history = loadUniverseHistory(ROOT)
  if (!history) throw new Error(`the Gate 0B.12 acceptance commit ${ANCHOR_COMMIT} cannot be read`)
  const capabilityById = new Map(matrix.capabilities.map((capability) => [capability.id, capability]))
  const entries = ownership.entries
  const entryByKey = new Map(entries.map((entry) => [`${entry[0]}|${entry[1]}`, entry]))
  const universe = new Set(manifest.routes.flatMap((route) => route.methods.map((method) => `${route.route}|${method}`)))

  const operations = [...ADDED_OPERATIONS].sort(compareCodeUnit)
  const hash = trancheHash(operations)
  let trancheManifest
  if (exists(FILES_0C1.manifest)) {
    trancheManifest = readJson(FILES_0C1.manifest)
    if (trancheManifest.version === 1 && trancheManifest.operations.join('\n') !== operations.join('\n')) throw new Error('the frozen Gate 0C.1 tranche differs from the operations the canonical universe gained')
  } else {
    trancheManifest = {
      schemaVersion: 1,
      tranche: TRANCHE_ID,
      version: 1,
      size: operations.length,
      selectionRule: 'Every operation the canonical route universe gained after the Gate 0B.12 acceptance commit: the exported handlers of route files that the regenerated route-coverage manifest lists and the historical manifest omitted, in ascending code-unit order of the string "<route file>|<METHOD>". No Gate 0B operation is re-examined, no decision-bound exception is re-examined and nothing is carried forward.',
      anchorCommit: ANCHOR_COMMIT,
      carryForward: [],
      excludedDecisionBound: [...DECISION_BOUND_OPERATIONS].sort(compareCodeUnit),
      priorTranches: PRIOR_TRANCHES.map((tranche) => ({ tranche, version: ledger0b.tranches[tranche].version, operationsHash: ledger0b.tranches[tranche].operationsHash })),
      newOperations: operations,
      operations,
      operationsHash: hash,
      versionLog: [{ version: 1, date: '2026-10-27', operationsHash: hash, reason: 'Initial freeze of the Gate 0C.1 tranche from the canonical route universe: the two exported handlers of app/api/reviews/route.ts that the route-coverage manifest had omitted. No later addition, removal or reorder is allowed without a new version and reason.' }],
    }
  }

  const references = loadApiReferences(ROOT)
  const records = []
  for (const id of trancheManifest.operations) {
    const [route, method] = id.split('|')
    const entry = entryByKey.get(id)
    if (!entry) throw new Error(`tranche operation ${id} is not in the ownership register`)
    const group = groupOfRoute(route, method)
    if (!group) throw new Error(`no Gate 0C.1 ownership group names ${id}`)
    const record = {
      id, route, method, status: 'CLASSIFIED', capabilityId: entry[3], control: entry[5], manifestAudit: entry[6],
      kernelAuthorization: false, ...factsFor(opAuthoring(id, readText, exists), readText), domain: group.domain,
    }
    record.callers = callersOf(route, references)
    record.callerFinding = callerFindingOf(record.callers)
    record.institutionalDecisions = record.institutionalDecisions ?? []
    record.riskScreen = RISK_SCREENS[id] ?? {}
    for (const key of Object.keys(record)) if (record[key] === undefined) delete record[key]
    for (const field of ['defects', 'manifestCorrections']) record[field] = record[field] ?? []
    records.push(record)
  }

  const defectRegister = [
    ...classification0b12.defectRegister,
    ...DEFECTS.map((defect) => ({ ...defect, tranche: TRANCHE_DEFECT, releaseBlocking: defect.releaseDisposition?.disposition === 'RELEASE_BLOCKING' })),
  ]
  const classification = {
    schemaVersion: 1,
    tranche: TRANCHE_ID,
    trancheVersion: trancheManifest.version,
    operationsHash: hash,
    note: 'Source-evidenced classification of the two operations the canonical route universe gained (GET and POST of app/api/reviews/route.ts). The record rules are the Gate 0B record contract: exact handler and method, owning capability, authentication and authorization, tenant and data boundary, mutation and audit behavior, implementation status, handler-specific evidence, defects and downstream gates. Ownership is accountability, not authorization. No institutional decision is adopted, no capability is created and no application behavior is repaired. The Gate 0B decisions, defects and exposures are carried unchanged.',
    institutionalDecisions: [...classification0b12.institutionalDecisions, ...DECISIONS],
    defectRegister,
    releaseBlockingExposures: classification0b12.releaseBlockingExposures,
    operations: records,
  }
  const ledger0c = {
    schemaVersion: 1,
    register: 'GATE-0C-CLASSIFICATION-LEDGER',
    note: 'Classification ledger for operations the canonical route universe gained after Gate 0B. The Gate 0B ledger is frozen at the Gate 0B.12 acceptance commit and is not rewritten; an operation appears in exactly one of the two ledgers.',
    anchorCommit: ANCHOR_COMMIT,
    tranches: { [TRANCHE_ID]: { version: trancheManifest.version, operationsHash: hash } },
    classified: Object.fromEntries(records.map((record) => [record.id, record.capabilityId])),
    classifiedIn: Object.fromEntries(records.map((record) => [record.id, TRANCHE_ID])),
  }

  const allManifests = Object.values(frozenManifests())
  const result = validateClassification0c1({
    classification: { ...classification, summary: undefined },
    manifest: trancheManifest,
    ledger0b,
    ledger0c,
    classification0b12,
    manifest0b: allManifests,
    reviewQueue,
    entries,
    capabilityById,
    universe,
    exists,
    readText,
    anchoredOperations: new Set(history.entries.map((entry) => `${entry[0]}|${entry[1]}`)),
    exceptionIds: new Set(DECISION_BOUND_OPERATIONS),
  })
  classification.summary = result.summary

  const transition = buildTransitionRecord({
    history, routes: manifest.routes, entries, manifestSha256: fileSha256(ROOT, 'docs/union-eyes/convergence/register/ue-route-coverage-manifest.json'),
    accepted: ACCEPTED, liveFileSha: (file) => fileSha256(ROOT, file), lockIds: [...lock.capabilityIds], capabilityIds: matrix.capabilities.map((capability) => capability.id), evidence: TRANSITION_EVIDENCE,
  })
  const universeProblems = validateUniverseTransition({
    record: transition,
    routes: manifest.routes,
    routeSummaryCount: manifest.summary.routes,
    diskRouteKeys: diskRouteKeys(),
    entries,
    ownershipUninventoried: ownership.uninventoriedRoutes,
    history,
    liveManifestSha256: fileSha256(ROOT, 'docs/union-eyes/convergence/register/ue-route-coverage-manifest.json'),
    liveFileSha: (file) => fileSha256(ROOT, file),
    tranche0c1: trancheManifest,
    classification0c1: classification,
    ledger0c,
    ledger0bSha256: fileSha256(ROOT, FILES_0B1.ledger),
    exceptionOperations: [...DECISION_BOUND_OPERATIONS],
    capabilityIds: matrix.capabilities.map((capability) => capability.id),
    lockIds: [...lock.capabilityIds],
    exists,
    readText,
    ledgerClassified0b: ledger0b.classified,
  })

  const facts = handoffFacts({
    matrix, classification, reviewQueue, challenges, exceptionRegister, exceptionOperations: [...DECISION_BOUND_OPERATIONS], entries,
    fileSha: (file) => fileSha256(ROOT, file),
  })
  const newDefectIds = DEFECTS.map((defect) => defect.id)
  const handoff = buildHandoffRegister({
    facts,
    newDefects: newDefectIds,
    files: { transition: FILE_TRANSITION, classification: FILES_0C1.classification, manifest: FILES_0C1.manifest, ledger: FILES_0C1.ledger },
  })
  const handoffProblems = validateHandoffRegister({ register: handoff, facts, newDefectIds })
  return { trancheManifest, classification, ledger0c, transition, handoff, problems: [...result.problems, ...universeProblems, ...handoffProblems], contractHash }
}

function frozenManifests() {
  const out = {}
  for (const name of ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'b10', 'b11', 'b12']) out[name] = readJson(MANIFEST_FILES[name])
  return out
}

const MANIFEST_FILES = Object.fromEntries(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map((n) => [`b${n}`, `docs/union-eyes/convergence/register/ue-route-tranche-0b${n}-manifest.json`]))

export function writeAll() {
  const built = buildAll()
  if (built.problems.length > 0) throw new Error(`Gate 0C.1 has ${built.problems.length} problem(s):\n${built.problems.slice(0, 80).join('\n')}`)
  writeIfChanged(FILES_0C1.manifest, stable(built.trancheManifest))
  writeIfChanged(FILES_0C1.classification, stable(built.classification))
  writeIfChanged(FILES_0C1.ledger, stable(built.ledger0c))
  writeIfChanged(FILE_TRANSITION, stable(built.transition))
  writeIfChanged(FILE_HANDOFF, stable(built.handoff))
  return { classification: built.classification.summary, transition: { canonical: built.transition.canonicalUniverse.operations, historical: built.transition.historicalUniverse.operations, added: built.transition.transitions[0].added }, handoffObligations: built.handoff.obligations.length }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    const built = buildAll()
    console.log(JSON.stringify({ problems: built.problems.length }, null, 2))
    for (const problem of built.problems.slice(0, 120)) console.log(`  - ${problem}`)
    process.exit(built.problems.length === 0 ? 0 : 1)
  }
  console.log(JSON.stringify(writeAll(), null, 2))
}
