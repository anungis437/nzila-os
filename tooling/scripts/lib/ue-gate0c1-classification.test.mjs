import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FILES, loadContext, routeBaselineHash, validateGate0 } from './ue-gate0-scope-lock.mjs'
import { routeKeys } from './ue-gate0-route-ownership.mjs'
import { FILES_0B1 } from './ue-gate0b1-classification.mjs'
import { FILES_0B12 } from './ue-gate0b12-classification.mjs'
import { FILE_EXCEPTIONS, inventoryTotals } from './ue-gate0b6-exceptions.mjs'
import { FILES_0C1, validateClassification0c1 } from './ue-gate0c1-classification.mjs'
import { ADDED_OPERATIONS, ANCHOR_COMMIT, DECISION_BOUND_OPERATIONS } from './ue-gate0c1-ids.mjs'
import { DEFECTS } from './ue-gate0c1-facts.mjs'
import { FILE_HANDOFF, handoffFacts, validateHandoffRegister } from './ue-gate0c1-handoff.mjs'
import { FILE_TRANSITION, FROZEN_TRANCHE_FILES, handlerMethodsOf, historicalView, routeBaselineHashOf, routeOperations, validateUniverseTransition } from './ue-gate0c1-universe.mjs'
import { buildAll, diskRouteKeys } from './ue-gate0c1-build.mjs'
import { ACCEPTED, countsAt, fileAt, ledgerAt, ownershipEntriesAt } from './ue-gate0-history.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const base = loadContext(ROOT)
const matrix = JSON.parse(readFileSync(join(ROOT, FILES.matrix), 'utf8'))
const clone = (value) => JSON.parse(JSON.stringify(value))
const sha = (value) => createHash('sha256').update(value).digest('hex')
const text = (file) => readFileSync(join(ROOT, file), 'utf8')
const existsCache = new Map()
const textCache = new Map()
const exists = (file) => {
  if (!existsCache.has(file)) existsCache.set(file, existsSync(join(ROOT, file)))
  return existsCache.get(file)
}
const readText = (file) => {
  if (!textCache.has(file)) textCache.set(file, readFileSync(join(ROOT, file), 'utf8'))
  return textCache.get(file)
}

const GET = 'reviews/route.ts|GET'
const POST = 'reviews/route.ts|POST'
const REVIEW_CAP = 'UE-CAP-REVIEW-INTAKE'
const CARBON = 'carbon/validate/route.ts|POST'
const hasProblem = (problems, pattern) => (Array.isArray(problems) ? problems : problems.problems).some((problem) => pattern.test(problem))
const capabilityById = new Map(matrix.capabilities.map((capability) => [capability.id, capability]))

function universeFixture() {
  return {
    record: clone(base.universeTransition),
    routes: clone(base.routes),
    routeSummaryCount: base.routeSummaryCount,
    diskRouteKeys: [...base.diskRouteKeys],
    entries: clone(base.ownership.entries),
    ownershipUninventoried: [],
    history: base.universeHistory,
    liveManifestSha256: base.manifestSha256,
    liveFileSha: (file) => sha(readFileSync(join(ROOT, file))),
    tranche0c1: clone(base.tranche0c1),
    classification0c1: clone(base.classification0c1),
    ledger0c: clone(base.ledger0c),
    ledger0bSha256: base.ledgerSha256,
    exceptionOperations: [...DECISION_BOUND_OPERATIONS],
    capabilityIds: matrix.capabilities.map((capability) => capability.id),
    lockIds: [...base.lock.capabilityIds],
    exists,
    readText,
    ledgerClassified0b: clone(base.ledger0b1.classified),
  }
}

function classificationFixture() {
  return {
    classification: clone(base.classification0c1),
    manifest: clone(base.tranche0c1),
    ledger0b: clone(base.ledger0b1),
    ledger0c: clone(base.ledger0c),
    classification0b12: clone(base.classification0b12),
    manifest0b: [base.tranche0b1, base.tranche0b2, base.tranche0b3, base.tranche0b4, base.tranche0b5, base.tranche0b6, base.tranche0b7, base.tranche0b8, base.tranche0b9, base.tranche0b10, base.tranche0b11, base.tranche0b12].map(clone),
    reviewQueue: clone(base.reviewQueue0b7),
    entries: clone(base.ownership.entries),
    capabilityById,
    universe: new Set(routeKeys(base.routes)),
    exists,
    readText,
    anchoredOperations: new Set(base.universeHistory.entries.map((entry) => `${entry[0]}|${entry[1]}`)),
    exceptionIds: new Set(DECISION_BOUND_OPERATIONS),
  }
}

const runUniverse = (args) => validateUniverseTransition(args)
const runClassification = (args) => validateClassification0c1(args)
const recordOf = (args, id) => args.classification.operations.find((item) => item.id === id)
const entryOf = (entries, id) => entries.find((entry) => `${entry[0]}|${entry[1]}` === id)
const routeOf = (routes, file) => routes.find((route) => route.route === file)

const handoffFixture = () => ({
  register: clone(base.handoffRegister),
  facts: handoffFacts({
    matrix, classification: base.classification0c1, reviewQueue: base.reviewQueue0b7, challenges: base.challenges0b11, exceptionRegister: base.exceptionRegister,
    exceptionOperations: [...DECISION_BOUND_OPERATIONS], entries: base.ownership.entries, fileSha: (file) => sha(readFileSync(join(ROOT, file))),
  }),
  newDefectIds: DEFECTS.map((defect) => defect.id),
})

test('the canonical universe is rebuilt from the route files on disk and holds exactly the operations the files export', () => {
  const disk = diskRouteKeys()
  const fromFiles = disk.flatMap((key) => handlerMethodsOf(readText(`apps/union-eyes/app/api/${key}`)).map((method) => `${key}|${method}`)).sort()
  const fromManifest = routeOperations(base.routes)
  assert.deepEqual([...fromManifest].sort(), fromFiles, 'every exported handler is in the manifest and every manifest operation has a handler')
  assert.equal(base.routes.length, disk.length)
  assert.equal(base.routes.length, 994)
  assert.equal(fromManifest.length, 1646, 'the count is the actual route-method count, not a number chosen in advance')
  assert.equal(new Set(fromManifest).size, fromManifest.length, 'no duplicate route-method identity')
  assert.equal(base.routeSummaryCount, 994)
  assert.ok(base.routes.every((route) => disk.includes(route.route)), 'no stale manifest route')
  assert.equal(routeBaselineHash(base.routes), routeBaselineHashOf(base.routes))
  assert.equal(matrix.routeBaseline.routeCount, 994)
  assert.equal(matrix.routeBaseline.hash, routeBaselineHash(base.routes))
})

test('the two reviews operations are genuine exported handlers and the only difference from the historical universe', () => {
  const source = readText('apps/union-eyes/app/api/reviews/route.ts')
  assert.deepEqual(handlerMethodsOf(source), ['GET', 'POST'])
  assert.match(source, /export async function GET\(\)/)
  assert.match(source, /export async function POST\(request: Request\)/)
  const history = ownershipEntriesAt(ANCHOR_COMMIT)
  const historical = new Set(history.map((entry) => `${entry[0]}|${entry[1]}`))
  const live = routeOperations(base.routes)
  assert.equal(historical.size, 1644)
  assert.deepEqual(live.filter((id) => !historical.has(id)), [GET, POST])
  assert.deepEqual([...historical].filter((id) => !live.includes(id)), [], 'nothing was removed')
  assert.deepEqual(ADDED_OPERATIONS, [GET, POST])
  assert.deepEqual(base.ownership.uninventoriedRoutes, [], 'the file is no longer an exception to the inventory')
})

test('the previous 1,644 operations keep their accepted ownership entries, six-class totals and the carbon exceptions stay explicit and non-authorizing', () => {
  const history = ownershipEntriesAt(ANCHOR_COMMIT)
  const now = new Map(base.ownership.entries.map((entry) => [`${entry[0]}|${entry[1]}`, entry]))
  for (const old of history) assert.deepEqual(now.get(`${old[0]}|${old[1]}`), old, `${old[0]}|${old[1]}`)
  const totals = inventoryTotals(base.ownership.entries, new Set(DECISION_BOUND_OPERATIONS))
  assert.deepEqual(totals, { OWNED: 1505, SCOPE_UNDECIDED_AWAITING_CLASSIFICATION: 0, DECISION_BOUND_SCOPE_EXCEPTION: 4, RETIRED_501: 97, STUB_501: 31, SYSTEM: 9, operations: 1646 })
  assert.deepEqual(inventoryTotals(history, new Set(DECISION_BOUND_OPERATIONS)), { OWNED: 1503, SCOPE_UNDECIDED_AWAITING_CLASSIFICATION: 0, DECISION_BOUND_SCOPE_EXCEPTION: 4, RETIRED_501: 97, STUB_501: 31, SYSTEM: 9, operations: 1644 })
  assert.deepEqual(matrix.routeInventoryTotals, totals)
  assert.equal(matrix.routeOwnership.operations, 1646)
  for (const id of DECISION_BOUND_OPERATIONS) {
    const entry = now.get(id)
    assert.equal(entry[4], 'SCOPE_UNDECIDED')
    assert.equal(entry[3], 'UE-OMIT-ROUTE-DOMAIN-SCOPE')
    assert.ok(!(id in base.ledger0b1.classified) && !(id in base.ledger0c.classified), `${id} is never recorded as classified`)
  }
})

test('the two new operations are fully classified under the Gate 0B record contract and owned by the existing review-intake capability', () => {
  const args = classificationFixture()
  const result = runClassification(args)
  assert.deepEqual(result.problems, [])
  assert.equal(result.summary.classified, 2)
  assert.equal(result.summary.newCapabilities, 0)
  const get = recordOf(args, GET)
  const post = recordOf(args, POST)
  for (const item of [get, post]) {
    assert.equal(item.status, 'CLASSIFIED')
    assert.equal(item.capabilityId, REVIEW_CAP)
    assert.equal(item.kernelAuthorization, false, 'a membership check is not a kernel decision')
    assert.equal(item.control, 'SESSION_ONLY')
    assert.equal(item.accessJustifiedBy, undefined, 'ownership is not authorization')
    assert.ok(item.evidence.some((evidence) => evidence.ref === 'apps/union-eyes/app/api/reviews/route.ts'), 'handler-specific evidence')
    assert.ok(item.defects.length > 0)
    assert.ok(item.requiredGate >= 1 && item.requiredGate <= 15)
  }
  assert.equal(get.mutationAudit, 'NOT_MUTATING')
  assert.equal(post.mutationAudit, 'ATOMIC_AUDIT_IN_TRANSACTION')
  assert.ok(post.evidence.some((evidence) => /auditAuthorityMutation/.test(evidence.quote)), 'the audit claim is backed by the audit write')
  assert.equal(entryOf(base.ownership.entries, GET)[2], 'RULE-0C1-MEMBER-REVIEW-INTAKE')
  assert.equal(entryOf(base.ownership.entries, POST)[2], 'RULE-0C1-MEMBER-REVIEW-INTAKE')
  assert.deepEqual(base.ledger0c.classified, { [GET]: REVIEW_CAP, [POST]: REVIEW_CAP })
})

test('the new defects enter the completion matrix with one owner each and none is repaired or adopted', () => {
  const ids = DEFECTS.map((defect) => defect.id)
  assert.equal(ids.length, 7)
  assert.equal(new Set(ids).size, 7)
  for (const defect of base.classification0c1.defectRegister.filter((item) => item.tranche === '0C.1')) {
    assert.ok(ids.includes(defect.id))
    assert.equal(defect.ownerCapabilityId, REVIEW_CAP)
    assert.equal(defect.gate, capabilityById.get(REVIEW_CAP).primaryGate)
    assert.ok(['MEDIUM', 'LOW'].includes(defect.severity))
    const inMatrix = matrix.routeDefects.find((item) => item.id === defect.id)
    assert.equal(inMatrix.ownerCapabilityId, REVIEW_CAP)
    assert.equal(inMatrix.gate, defect.gate)
  }
  assert.equal(matrix.routeDefects.length, 777)
  assert.ok(base.classification0c1.institutionalDecisions.every((decision) => decision.status === 'OUTSTANDING'))
  assert.equal(JSON.stringify(base.classification0c1.institutionalDecisions), JSON.stringify(base.classification0b12.institutionalDecisions), 'no decision is added, closed or adopted')
})

test('the twelve Gate 0B tranche manifests and classifications and the Gate 0B ledger are byte-identical to the commits that accepted them', () => {
  assert.equal(ACCEPTED['0B.12'], ANCHOR_COMMIT)
  for (const [tranche, files] of Object.entries(FROZEN_TRANCHE_FILES)) {
    for (const file of [files.manifest, files.classification]) assert.equal(text(file), fileAt(ACCEPTED[tranche], file), `${tranche} ${file}`)
  }
  assert.equal(text(FILES_0B1.ledger), fileAt(ANCHOR_COMMIT, FILES_0B1.ledger), 'the Gate 0B ledger is not regenerated')
  assert.deepEqual(ledgerAt(ANCHOR_COMMIT), base.ledger0b1)
  assert.equal(countsAt(ANCHOR_COMMIT).operations, 1644, 'the accepted universe is read from git, not rebuilt')
  for (const pin of ['routeClassification0b12', 'routeClassification0c1']) {
    for (const [key, entry] of Object.entries(matrix[pin].files)) assert.equal(entry.sha256, sha(text(entry.file)), `${pin} ${key}`)
  }
  assert.equal(matrix.routeUniverseTransition.sha256, sha(text(FILE_TRANSITION)))
  assert.equal(matrix.gate0cHandoff.sha256, sha(text(FILE_HANDOFF)))
})

test('the independent capability lock keeps all 111 identifiers and Gate 0C.1 adds no capability', () => {
  assert.equal(base.lock.capabilityIds.length, 111)
  assert.equal(matrix.capabilities.length, 111)
  assert.deepEqual([...base.universeHistory.lockIds], [...base.lock.capabilityIds].sort())
  assert.deepEqual(base.universeHistory.capabilityIds, matrix.capabilities.map((capability) => capability.id).sort())
  assert.deepEqual(base.universeTransition.capabilityLock.added, [])
  assert.deepEqual(base.classification0c1.operations.map((item) => item.capabilityId), [REVIEW_CAP, REVIEW_CAP])
})

test('the transition record states the old and new size and hash, the additions, the reason and the compatibility', () => {
  const record = base.universeTransition
  assert.equal(record.historicalUniverse.operations, 1644)
  assert.equal(record.canonicalUniverse.operations, 1646)
  assert.equal(record.historicalUniverse.routes, 993)
  assert.equal(record.canonicalUniverse.routes, 994)
  assert.notEqual(record.historicalUniverse.operationsHash, record.canonicalUniverse.operationsHash)
  assert.notEqual(record.historicalUniverse.routeBaselineHash, record.canonicalUniverse.routeBaselineHash)
  assert.equal(record.manifestHashesIdentical, false)
  const [transition] = record.transitions
  assert.deepEqual(transition.added, [GET, POST])
  assert.deepEqual(transition.removed, [])
  assert.deepEqual(transition.capabilityOperationCountsBefore, { [REVIEW_CAP]: 0 })
  assert.deepEqual(transition.capabilityOperationCountsAfter, { [REVIEW_CAP]: 2 })
  assert.ok(transition.reason.length > 60)
  assert.equal(transition.backwardCompatibility.historicalTranchesFrozen, true)
  assert.deepEqual(runUniverse(universeFixture()), [])
})

test('the view of the canonical universe restricted to the historical operations is the accepted universe', () => {
  const view = historicalView({ routes: base.routes, entries: base.ownership.entries, addedOperations: ADDED_OPERATIONS })
  assert.equal(routeOperations(view.routes).length, 1644)
  assert.equal(view.entries.length, 1644)
  assert.equal(view.routes.length, 993)
  assert.equal(routeBaselineHashOf(view.routes), base.universeTransition.historicalUniverse.routeBaselineHash)
})

test('Gate 0 stays IN_PROGRESS on the canonical universe, with the uninventoried route resolved and the carbon exceptions distinct', () => {
  const result = validateGate0(matrix, { base })
  assert.deepEqual(result.problems, [])
  assert.equal(result.summary.verdict, 'IN_PROGRESS')
  assert.equal(result.summary.capabilityCount, 111)
  assert.ok(!result.blockers.some((item) => item.code === 'ROUTE_UNINVENTORIED'), 'reviews/route.ts is now inside the canonical universe')
  assert.ok(!result.blockers.some((item) => item.code === 'ROUTE_SCOPE_UNDECIDED'))
  assert.ok(result.blockers.some((item) => item.code === 'ROUTE_DECISION_BOUND_SCOPE_EXCEPTION' && item.operations === 4))
  assert.equal(result.summary.universe.canonicalOperations, 1646)
  assert.equal(result.summary.universe.historicalOperations, 1644)
  assert.equal(result.summary.inventory.operations, 1646)
  assert.equal(result.summary.classification0c1.classified, 2)
  assert.equal(result.summary.classification0b12.coverage.operations, 1644, 'the Gate 0B.12 coverage still describes the accepted universe')
})

test('the Gate 0C handoff register records every open obligation, resolves none and keeps specification acceptance apart from institutional authority', () => {
  const args = handoffFixture()
  assert.deepEqual(validateHandoffRegister(args), [])
  const register = base.handoffRegister
  assert.equal(register.status, 'RECORDED_NOT_RESOLVED')
  const byId = Object.fromEntries(register.obligations.map((item) => [item.id, item]))
  assert.equal(byId['OBL-0C-INSTITUTIONAL-DECISIONS'].count, 79)
  assert.equal(byId['OBL-0C-CARBON-SCOPE-EXCEPTIONS'].operations.length, 4)
  assert.equal(byId['OBL-0C-HIGH-DEFECTS-AWAITING-REVIEW'].count, 71)
  assert.equal(byId['OBL-0C-RELEASE-DISPOSITIONS'].releaseBlocking.count, 32)
  assert.equal(byId['OBL-0C-RELEASE-DISPOSITIONS'].conditionallyBlocking.count, 41)
  assert.equal(byId['OBL-0C-OPL-CHALLENGES'].challenges.length, 2)
  assert.equal(byId['OBL-0C-UNJUSTIFIED-PUBLIC-EXPOSURES'].operations.length, 3)
  assert.equal(byId['OBL-0C-TRACKED-RATCHET-AND-TEST-DEFECTS'].defects.length, 4)
  assert.equal(byId['OBL-0C-RUNTIME-QUALIFICATION'].nativeVerified, false)
  assert.equal(byId['OBL-0C-RUNTIME-QUALIFICATION'].browserVerified, false)
  for (const persona of byId['OBL-0C-PERSONA-BASELINES'].personas) {
    assert.equal(persona.productSpecificationRatification, 'NOT_RATIFIED')
    assert.equal(persona.institutionalGrantOfAuthority, 'NOT_GRANTED')
    assert.equal(persona.resolvedInMatrix, false)
  }
  assert.ok(register.separation.productSpecificationAcceptance && register.separation.institutionalGrantOfAuthority)
})

test('the Gate 0C.1 artifacts rebuild deterministically from the sources', () => {
  const built = buildAll()
  assert.deepEqual(built.problems, [])
  const same = (value, file) => assert.equal(`${JSON.stringify(value, null, 2)}\n`, text(file), file)
  same(built.trancheManifest, FILES_0C1.manifest)
  same(built.classification, FILES_0C1.classification)
  same(built.ledger0c, FILES_0C1.ledger)
  same(built.transition, FILE_TRANSITION)
  same(built.handoff, FILE_HANDOFF)
})

test('a route file that is missing from the canonical universe fails', () => {
  const args = universeFixture()
  args.diskRouteKeys.push('reviews/new-intake/route.ts')
  assert.ok(hasProblem(runUniverse(args), /UNIVERSE-MISSING-ROUTE: route file reviews\/new-intake\/route\.ts exists and is not in the canonical universe/))
  const full = validateGate0(matrix, { base, diskRouteKeys: args.diskRouteKeys })
  assert.ok(hasProblem(full, /UNIVERSE-MISSING-ROUTE/))
  assert.ok(hasProblem(full, /neither in the route-coverage manifest nor recorded as uninventoried/))
})

test('a manifest entry without a real handler, a stale manifest route and an unlisted handler fail', () => {
  const noHandler = universeFixture()
  routeOf(noHandler.routes, 'reviews/route.ts').methods = ['DELETE', 'GET', 'POST']
  assert.ok(hasProblem(runUniverse(noHandler), /UNIVERSE-NO-HANDLER: manifest operation reviews\/route\.ts\|DELETE has no exported DELETE handler/))
  const stale = universeFixture()
  stale.routes.push({ ...clone(routeOf(stale.routes, 'reviews/route.ts')), route: 'reviews/ghost/route.ts' })
  assert.ok(hasProblem(runUniverse(stale), /UNIVERSE-STALE-ROUTE: manifest route reviews\/ghost\/route\.ts has no route file/))
  const unlisted = universeFixture()
  routeOf(unlisted.routes, 'reviews/route.ts').methods = ['GET']
  assert.ok(hasProblem(runUniverse(unlisted), /UNIVERSE-MISSING-ROUTE: reviews\/route\.ts exports a POST handler that the manifest does not list/))
})

test('a newly inventoried operation without ownership or a Gate 0C classification fails', () => {
  const noEntry = universeFixture()
  noEntry.entries = noEntry.entries.filter((entry) => `${entry[0]}|${entry[1]}` !== GET)
  assert.ok(hasProblem(runUniverse(noEntry), /UNIVERSE-NO-OWNERSHIP: operation reviews\/route\.ts\|GET has no ownership entry/))
  const undecided = universeFixture()
  const entry = entryOf(undecided.entries, POST)
  entry[3] = 'UE-OMIT-ROUTE-DOMAIN-SCOPE'
  entry[4] = 'SCOPE_UNDECIDED'
  assert.ok(hasProblem(runUniverse(undecided), /UNIVERSE-NO-OWNERSHIP: newly inventoried operation reviews\/route\.ts\|POST has no engineering owner/))
  const generic = universeFixture()
  entryOf(generic.entries, GET)[2] = 'RULE-REVIEWS'
  assert.ok(hasProblem(runUniverse(generic), /not a Gate 0C\.1 business-evidence rule/))
  const unclassified = universeFixture()
  unclassified.classification0c1.operations = unclassified.classification0c1.operations.filter((item) => item.id !== GET)
  assert.ok(hasProblem(runUniverse(unclassified), /UNIVERSE-UNCLASSIFIED: newly inventoried operation reviews\/route\.ts\|GET has no Gate 0C\.1 classification/))
})

test('a duplicate or changed route-method identity and a changed dynamic parameter fail', () => {
  const duplicate = universeFixture()
  duplicate.routes.push(clone(routeOf(duplicate.routes, 'reviews/route.ts')))
  assert.ok(hasProblem(runUniverse(duplicate), /UNIVERSE-DUPLICATE: a route-method pair is listed twice/))
  const ownershipDuplicate = universeFixture()
  ownershipDuplicate.entries.push(clone(entryOf(ownershipDuplicate.entries, GET)))
  assert.ok(hasProblem(runUniverse(ownershipDuplicate), /UNIVERSE-DUPLICATE: the ownership register holds a route-method identity twice/))
  const renamed = universeFixture()
  const dynamic = renamed.routes.find((route) => route.route.includes('[') && route.methods.length > 0)
  const original = dynamic.route
  dynamic.route = original.replace(/\[([^\]]+)\]/, '[renamed$1]')
  const problems = runUniverse(renamed)
  assert.ok(hasProblem(problems, new RegExp(`UNIVERSE-UNRECORDED-REMOVAL: historical operation ${original.replace(/[[\]|.]/g, '\\$&')}`)), 'the original identity left the manifest')
  assert.ok(hasProblem(problems, /UNIVERSE-UNRECORDED-ADDITION/), 'the renamed identity is an unrecorded addition')
  assert.ok(hasProblem(problems, /UNIVERSE-IDENTITY|UNIVERSE-ORPHAN-OWNERSHIP/))
})

test('a silent modification of a frozen Gate 0B tranche or of the Gate 0B ledger fails', () => {
  for (const tranche of ['0B.1', '0B.7', '0B.12']) {
    const args = universeFixture()
    const file = FROZEN_TRANCHE_FILES[tranche].classification
    args.liveFileSha = (path) => (path === file ? sha(`${text(path)} `) : sha(readFileSync(join(ROOT, path))))
    assert.ok(hasProblem(runUniverse(args), new RegExp(`UNIVERSE-FROZEN: Gate ${tranche.replace('.', '\\.')} classification was modified after its accepted commit`)), tranche)
  }
  const manifestEdit = universeFixture()
  manifestEdit.liveFileSha = (path) => (path === FROZEN_TRANCHE_FILES['0B.5'].manifest ? sha('regenerated') : sha(readFileSync(join(ROOT, path))))
  assert.ok(hasProblem(runUniverse(manifestEdit), /UNIVERSE-FROZEN: Gate 0B\.5 manifest was modified/))
  const rewrittenRecord = universeFixture()
  rewrittenRecord.record.frozenTranches.find((item) => item.tranche === '0B.3').files.classification.sha256 = sha('rewritten')
  assert.ok(hasProblem(runUniverse(rewrittenRecord), /UNIVERSE-FROZEN: the recorded hash of Gate 0B\.3 classification is not the hash at its accepted commit/))
  const ledger = universeFixture()
  ledger.ledger0bSha256 = sha('a ledger regenerated for the new operations')
  assert.ok(hasProblem(runUniverse(ledger), /UNIVERSE-FROZEN: the Gate 0B ledger was modified/))
  const endToEnd = validateGate0(matrix, { base, liveFileSha: (path) => (path === FROZEN_TRANCHE_FILES['0B.4'].classification ? sha('edited') : sha(readFileSync(join(ROOT, path)))) })
  assert.ok(hasProblem(endToEnd, /UNIVERSE-FROZEN: Gate 0B\.4 classification was modified/))
})

test('reclassifying a carbon exception as owned fails and the exceptions stay non-authorizing', () => {
  const args = universeFixture()
  const entry = entryOf(args.entries, CARBON)
  entry[3] = REVIEW_CAP
  entry[4] = 'OWNED'
  assert.ok(hasProblem(runUniverse(args), /UNIVERSE-CARBON: carbon exception carbon\/validate\/route\.ts\|POST was reclassified as OWNED/))
  const classified = universeFixture()
  classified.ledger0c.classified[CARBON] = REVIEW_CAP
  assert.ok(hasProblem(runUniverse(classified), /UNIVERSE-CARBON: carbon exception carbon\/validate\/route\.ts\|POST is classified/))
  const authorizing = universeFixture()
  authorizing.record.carbonExceptions.nonAuthorizing = false
  assert.ok(hasProblem(runUniverse(authorizing), /UNIVERSE-CARBON: the four carbon exceptions are not recorded explicitly as non-authorizing/))
  const shrunk = universeFixture()
  shrunk.exceptionOperations = shrunk.exceptionOperations.filter((id) => id !== CARBON)
  assert.ok(hasProblem(runUniverse(shrunk), /UNIVERSE-CARBON: the decision-bound exception register no longer names exactly the four carbon operations/))
  const endToEnd = clone(base.ownership)
  const live = entryOf(endToEnd.entries, CARBON)
  live[3] = REVIEW_CAP
  live[4] = 'OWNED'
  assert.ok(hasProblem(validateGate0(matrix, { base, ownership: endToEnd }), /UNIVERSE-CARBON/))
})

test('an unexplained change of the canonical universe count fails', () => {
  const added = universeFixture()
  added.routes.push({ ...clone(routeOf(added.routes, 'reviews/route.ts')), route: 'reviews/unrecorded/route.ts', methods: ['GET'] })
  added.entries.push(['reviews/unrecorded/route.ts', 'GET', 'RULE-0C1-MEMBER-REVIEW-INTAKE', REVIEW_CAP, 'OWNED', 'SESSION_ONLY', 'NOT_APPLICABLE:READ', 'CAPABILITY', 'x'])
  const addedProblems = runUniverse(added)
  assert.ok(hasProblem(addedProblems, /UNIVERSE-COUNT-UNEXPLAINED/))
  assert.ok(hasProblem(addedProblems, /UNIVERSE-UNRECORDED-ADDITION: reviews\/unrecorded\/route\.ts\|GET is in the manifest/))
  const removed = universeFixture()
  removed.routes = removed.routes.filter((route) => route.route !== 'version/route.ts')
  const removedProblems = runUniverse(removed)
  assert.ok(hasProblem(removedProblems, /UNIVERSE-UNRECORDED-REMOVAL: historical operation version\/route\.ts\|GET left the manifest/))
  assert.ok(hasProblem(removedProblems, /UNIVERSE-COUNT-UNEXPLAINED/))
  const noRecord = universeFixture()
  noRecord.record.transitions = []
  assert.ok(hasProblem(runUniverse(noRecord), /UNIVERSE-TRANSITION-ABSENT/))
  const wrongSize = universeFixture()
  wrongSize.record.transitions[0].size.after = 1648
  assert.ok(hasProblem(runUniverse(wrongSize), /UNIVERSE-COUNT-UNEXPLAINED: universe transition 2 records 1648 operations/))
  const forced = universeFixture()
  forced.record.canonicalUniverse.operations = 1648
  assert.ok(hasProblem(runUniverse(forced), /UNIVERSE-COUNT-UNEXPLAINED: the recorded canonical operations/))
})

test('a false claim that the historical and current manifest hashes are identical fails', () => {
  const claim = universeFixture()
  claim.record.manifestHashesIdentical = true
  assert.ok(hasProblem(runUniverse(claim), /UNIVERSE-FALSE-HASH-CLAIM/))
  const copied = universeFixture()
  copied.record.canonicalUniverse.routeBaselineHash = copied.record.historicalUniverse.routeBaselineHash
  copied.record.canonicalUniverse.manifestSha256 = copied.record.historicalUniverse.manifestSha256
  const problems = runUniverse(copied)
  assert.ok(hasProblem(problems, /UNIVERSE-FALSE-HASH-CLAIM: the historical and current manifest hashes are recorded as the same although the operations differ/))
  assert.ok(hasProblem(problems, /UNIVERSE-COUNT-UNEXPLAINED: the recorded canonical routeBaselineHash/))
  const wrongHistory = universeFixture()
  wrongHistory.record.historicalUniverse.operationsHash = sha('another universe')
  assert.ok(hasProblem(runUniverse(wrongHistory), /UNIVERSE-HISTORICAL-RECORD: the recorded historical operationsHash/))
  const endToEnd = clone(base.universeTransition)
  endToEnd.manifestHashesIdentical = true
  assert.ok(hasProblem(validateGate0(matrix, { base, universeTransition: endToEnd }), /UNIVERSE-FALSE-HASH-CLAIM/))
})

test('adding a capability, dropping an anchored identifier or hiding the ledger overlap fails', () => {
  const added = universeFixture()
  added.capabilityIds.push('UE-CAP-INVENTED')
  added.lockIds.push('UE-CAP-INVENTED')
  assert.ok(hasProblem(runUniverse(added), /UNIVERSE-LOCK: Gate 0C\.1 may not add a capability/))
  const dropped = universeFixture()
  dropped.lockIds = dropped.lockIds.slice(1)
  assert.ok(hasProblem(runUniverse(dropped), /UNIVERSE-LOCK: the independent capability lock dropped 1 anchored capability id/))
  const overlap = universeFixture()
  overlap.ledgerClassified0b[GET] = REVIEW_CAP
  assert.ok(hasProblem(runUniverse(overlap), /UNIVERSE-UNCLASSIFIED: newly inventoried operation reviews\/route\.ts\|GET is also in the Gate 0B ledger/))
  const uninventoried = universeFixture()
  uninventoried.ownershipUninventoried = [{ route: 'reviews/route.ts' }]
  assert.ok(hasProblem(runUniverse(uninventoried), /UNIVERSE-UNINVENTORIED/))
})

test('the Gate 0C.1 classification rejects an unsupported, kernel-claiming, generically owned or widened record', () => {
  const kernel = classificationFixture()
  recordOf(kernel, POST).kernelAuthorization = true
  assert.ok(hasProblem(runClassification(kernel), /inconsistent about kernel authorization|claims kernel authorization/))

  const noAudit = classificationFixture()
  recordOf(noAudit, POST).evidence = recordOf(noAudit, POST).evidence.filter((item) => !/auditAuthorityMutation/.test(item.quote))
  assert.ok(hasProblem(runClassification(noAudit), /marked atomically audited without citing an in-transaction audit write/))

  const fakeQuote = classificationFixture()
  recordOf(fakeQuote, GET).evidence[0].quote = 'this line is not in the route file'
  assert.ok(hasProblem(runClassification(fakeQuote), /quote|provenance|not in/i))

  const generic = classificationFixture()
  entryOf(generic.entries, GET)[2] = 'RULE-REVIEWS'
  assert.ok(hasProblem(runClassification(generic), /not a Gate 0C\.1 business-evidence rule/))

  const justified = classificationFixture()
  recordOf(justified, GET).accessJustifiedBy = 'UE-INST-REVIEW-OVERSIGHT'
  assert.ok(hasProblem(runClassification(justified), /ownership is not authorization/))

  const widened = classificationFixture()
  widened.manifest.operations = [...widened.manifest.operations, 'carbon/validate/route.ts|POST']
  assert.ok(hasProblem(runClassification(widened), /tranche operations are not the operations the canonical universe gained|carbon|decision-bound/))

  const historical = classificationFixture()
  historical.manifest.operations = ['version/route.ts|GET']
  assert.ok(hasProblem(runClassification(historical), /was already in the historical universe|already examined in a Gate 0B tranche/))

  const decision = classificationFixture()
  decision.classification.institutionalDecisions[0].status = 'ADOPTED'
  assert.ok(hasProblem(runClassification(decision), /can record only outstanding decisions|differ from the frozen Gate 0B\.12 set/))

  const alteredDefect = classificationFixture()
  alteredDefect.classification.defectRegister[0].severity = 'LOW'
  assert.ok(hasProblem(runClassification(alteredDefect), /was altered in the defect register/))

  const orphan = classificationFixture()
  recordOf(orphan, GET).defects = []
  assert.ok(hasProblem(runClassification(orphan), /is recorded but no classification cites it/))

  const ledger = classificationFixture()
  ledger.ledger0b.classified[GET] = REVIEW_CAP
  assert.ok(hasProblem(runClassification(ledger), /Gate 0C ledger classifies reviews\/route\.ts\|GET, which the Gate 0B ledger already classified/))

  const exposures = classificationFixture()
  exposures.classification.releaseBlockingExposures.pop()
  assert.ok(hasProblem(runClassification(exposures), /three unjustified public exposures are not preserved exactly/))
})

test('the handoff register rejects a ratified persona, a drifted count, a resolved obligation and a collapsed separation', () => {
  const ratified = handoffFixture()
  ratified.register.obligations.find((item) => item.id === 'OBL-0C-PERSONA-BASELINES').personas[0].productSpecificationRatification = 'RATIFIED'
  assert.ok(hasProblem(validateHandoffRegister(ratified), /HANDOFF-PERSONA-RATIFIED: steward is recorded as product-ratified/))

  const granted = handoffFixture()
  granted.register.obligations.find((item) => item.id === 'OBL-0C-PERSONA-BASELINES').personas[1].institutionalGrantOfAuthority = 'GRANTED'
  assert.ok(hasProblem(validateHandoffRegister(granted), /HANDOFF-PERSONA-RATIFIED: representative is recorded as holding an institutional grant/))

  const adopted = handoffFixture()
  adopted.register.obligations.find((item) => item.id === 'OBL-0C-PERSONA-BASELINES').baselinesAdopted = true
  assert.ok(hasProblem(validateHandoffRegister(adopted), /HANDOFF-PERSONA-RATIFIED: the persona baselines are recorded or found adopted/))

  const drifted = handoffFixture()
  drifted.register.obligations.find((item) => item.id === 'OBL-0C-INSTITUTIONAL-DECISIONS').count = 78
  assert.ok(hasProblem(validateHandoffRegister(drifted), /HANDOFF-DECISIONS/))

  const resolved = handoffFixture()
  resolved.register.obligations.find((item) => item.id === 'OBL-0C-CARBON-SCOPE-EXCEPTIONS').status = 'RESOLVED'
  assert.ok(hasProblem(validateHandoffRegister(resolved), /HANDOFF-RESOLVED: OBL-0C-CARBON-SCOPE-EXCEPTIONS/))

  const merged = handoffFixture()
  delete merged.register.separation.institutionalGrantOfAuthority
  assert.ok(hasProblem(validateHandoffRegister(merged), /HANDOFF-SEPARATION/))

  const missing = handoffFixture()
  missing.register.obligations = missing.register.obligations.filter((item) => item.id !== 'OBL-0C-RUNTIME-QUALIFICATION')
  assert.ok(hasProblem(validateHandoffRegister(missing), /HANDOFF-OBLIGATION: OBL-0C-RUNTIME-QUALIFICATION is not recorded/))

  const verified = handoffFixture()
  verified.register.obligations.find((item) => item.id === 'OBL-0C-RUNTIME-QUALIFICATION').nativeVerified = true
  assert.ok(hasProblem(validateHandoffRegister(verified), /HANDOFF-RUNTIME/))

  const dispositions = handoffFixture()
  dispositions.register.obligations.find((item) => item.id === 'OBL-0C-RELEASE-DISPOSITIONS').releaseBlocking.count = 31
  assert.ok(hasProblem(validateHandoffRegister(dispositions), /HANDOFF-DISPOSITIONS/))
})

test('the matrix pins detect a changed Gate 0C.1 file and the pinned register paths are the ones the builders write', () => {
  const tampered = clone(matrix)
  tampered.routeClassification0c1.files.classification.sha256 = sha('edited')
  assert.ok(hasProblem(validateGate0(tampered, { base }), /CLASSIFICATION-PIN-HASH: .*ue-route-classification-0c1\.json/))
  const handoff = clone(matrix)
  handoff.gate0cHandoff.sha256 = sha('edited')
  assert.ok(hasProblem(validateGate0(handoff, { base }), /CLASSIFICATION-PIN-HASH: .*ue-gate0c-handoff-register\.json/))
  assert.equal(FILES_0C1.classification, matrix.routeClassification0c1.files.classification.file)
  assert.equal(FILES_0B12.classification, matrix.routeClassification0b12.files.classification.file)
  assert.equal(FILE_EXCEPTIONS, matrix.decisionBoundExceptions.file)
  assert.equal(FILES.ownership, matrix.routeOwnership.file)
})
