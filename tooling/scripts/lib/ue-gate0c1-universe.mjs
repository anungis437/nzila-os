/**
 * Gate 0C.1 canonical route-universe reconciliation.
 *
 * Gate 0B froze a 1,644-operation inventory read from a route-coverage manifest that omitted one route file. The
 * canonical universe is the set of route-method operations in the regenerated manifest, and it is reconciled with the
 * route files on disk. This module holds:
 *   - the versioned transition record (old and new size and hash, added and removed operations, source evidence, reason,
 *     ownership counts and backward compatibility) and the code that builds it;
 *   - the validator that tells the historical 1,644 universe, the canonical universe, the versioned additions, the
 *     decision-bound exceptions and the Gate 0C classified operations apart.
 * Nothing here repairs application behavior, adopts an institutional decision or authorizes access.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { compareCodeUnit, nonEmpty, trancheHash } from './ue-gate0b1-classification.mjs'
import { FILES_0B1 } from './ue-gate0b1-classification.mjs'
import { FILES_0B2 } from './ue-gate0b2-classification.mjs'
import { FILES_0B3 } from './ue-gate0b3-classification.mjs'
import { FILES_0B4 } from './ue-gate0b4-classification.mjs'
import { FILES_0B5 } from './ue-gate0b5-classification.mjs'
import { FILES_0B6 } from './ue-gate0b6-classification.mjs'
import { FILES_0B7 } from './ue-gate0b7-classification.mjs'
import { FILES_0B8 } from './ue-gate0b8-classification.mjs'
import { FILES_0B9 } from './ue-gate0b9-classification.mjs'
import { FILES_0B10 } from './ue-gate0b10-classification.mjs'
import { FILES_0B11 } from './ue-gate0b11-classification.mjs'
import { FILES_0B12 } from './ue-gate0b12-classification.mjs'
import { INVENTORY_KEYS, inventoryTotals } from './ue-gate0b6-exceptions.mjs'
import { ownershipHash } from './ue-gate0-route-ownership.mjs'
import { ACCEPTED } from './ue-gate0-history.mjs'
import {
  ADDED_OPERATIONS, ADDED_ROUTE_FILES, ANCHOR_COMMIT, DECISION_BOUND_OPERATIONS, NEW_UNIVERSE_OPERATIONS, NEW_UNIVERSE_ROUTES, NEW_UNIVERSE_VERSION, OLD_UNIVERSE_OPERATIONS, OLD_UNIVERSE_ROUTES, OLD_UNIVERSE_VERSION, REMOVED_OPERATIONS, TRANCHE_ID,
} from './ue-gate0c1-ids.mjs'

export const FILE_TRANSITION = 'docs/union-eyes/convergence/register/ue-route-universe-transition.json'
export const FILE_MANIFEST = 'docs/union-eyes/convergence/register/ue-route-coverage-manifest.json'
export const FILE_OWNERSHIP = 'docs/union-eyes/convergence/register/ue-route-capability-ownership.json'
export const FILE_MATRIX = 'docs/union-eyes/convergence/register/ue-pre-vs-engineering-completion.json'
export const FILE_LOCK = 'docs/union-eyes/convergence/register/ue-gate0-capability-lock.json'
export const FILE_LEDGER_0B = FILES_0B1.ledger

export const FROZEN_TRANCHE_FILES = {
  '0B.1': FILES_0B1, '0B.2': FILES_0B2, '0B.3': FILES_0B3, '0B.4': FILES_0B4, '0B.5': FILES_0B5, '0B.6': FILES_0B6,
  '0B.7': FILES_0B7, '0B.8': FILES_0B8, '0B.9': FILES_0B9, '0B.10': FILES_0B10, '0B.11': FILES_0B11, '0B.12': FILES_0B12,
}
const TRANCHE_ORDER = Object.keys(FROZEN_TRANCHE_FILES)
const MANIFEST_AND_CLASSIFICATION = ['manifest', 'classification']
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const API_PREFIX = 'apps/union-eyes/app/api/'

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const unique = (items) => [...new Set(items)]
const keyOf = (entry) => `${entry[0]}|${entry[1]}`

/** The sha256 of a sorted `route|methods|guard` listing; the same function the route baseline in the matrix uses. */
export function routeBaselineHashOf(routes) {
  const lines = routes.map((route) => `${route.route}|${[].concat(route.methods).join(',')}|${route.guard}`).sort()
  return createHash('sha256').update(lines.join('\n')).digest('hex')
}

export function routeOperations(routes) {
  return routes.flatMap((route) => [].concat(route.methods).map((method) => `${route.route}|${method}`)).sort(compareCodeUnit)
}

/** The route-coverage scanner's own method detection, repeated so a manifest entry can be checked against its file. */
export function handlerMethodsOf(source) {
  const found = new Set()
  for (const method of METHODS) {
    if (new RegExp(`export\\s+(?:async\\s+function|const|let|function)\\s+${method}\\b`).test(source)) found.add(method)
  }
  for (const block of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of block[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim()
      if (name && METHODS.includes(name)) found.add(name)
    }
  }
  return [...found].sort()
}

const dynamicCount = (operations) => operations.filter((id) => id.split('|')[0].includes('[')).length

export function universeSnapshot({ routes, entries, manifestSha256, exceptions, version }) {
  const operations = routeOperations(routes)
  return {
    version,
    operations: operations.length,
    routes: routes.length,
    operationsHash: trancheHash(operations),
    routeBaselineHash: routeBaselineHashOf(routes),
    manifestSha256,
    ownershipEntriesHash: ownershipHash(entries),
    inventoryTotals: inventoryTotals(entries, new Set(exceptions)),
    dynamicParameterOperations: dynamicCount(operations),
  }
}

const git = (root, args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 })
const gitShowOrNull = (root, commit, file) => {
  try {
    return git(root, ['show', `${commit}:${file}`])
  } catch {
    return null
  }
}

/** The historical universe and the frozen files, read from the commits that accepted them. */
export function loadUniverseHistory(root) {
  const manifestText = gitShowOrNull(root, ANCHOR_COMMIT, FILE_MANIFEST)
  const ownershipText = gitShowOrNull(root, ANCHOR_COMMIT, FILE_OWNERSHIP)
  if (manifestText === null || ownershipText === null) return null
  const matrixText = gitShowOrNull(root, ANCHOR_COMMIT, FILE_MATRIX)
  const lockText = gitShowOrNull(root, ANCHOR_COMMIT, FILE_LOCK)
  const ledgerText = gitShowOrNull(root, ANCHOR_COMMIT, FILE_LEDGER_0B)
  const acceptedFileSha = {}
  for (const tranche of TRANCHE_ORDER) {
    acceptedFileSha[tranche] = {}
    for (const kind of MANIFEST_AND_CLASSIFICATION) {
      const text = gitShowOrNull(root, ACCEPTED[tranche], FROZEN_TRANCHE_FILES[tranche][kind])
      acceptedFileSha[tranche][kind] = text === null ? null : sha256(text)
    }
  }
  return {
    routes: JSON.parse(manifestText).routes,
    manifestSha256: sha256(manifestText),
    entries: JSON.parse(ownershipText).entries,
    capabilityIds: matrixText === null ? null : JSON.parse(matrixText).capabilities.map((capability) => capability.id).sort(),
    lockIds: lockText === null ? null : [...JSON.parse(lockText).capabilityIds].sort(),
    ledgerSha256: ledgerText === null ? null : sha256(ledgerText),
    acceptedCommits: { ...ACCEPTED },
    acceptedFileSha,
  }
}

export const fileSha256 = (root, file) => sha256(readFileSync(join(root, file)))

/** The twelve frozen tranches in historical order, restricted to the operations of one view of the universe. */
export function historicalView({ routes, entries, addedOperations }) {
  const added = new Set(addedOperations ?? [])
  const keep = (id) => !added.has(id)
  return {
    routes: routes.filter((route) => [].concat(route.methods).length === 0 || [].concat(route.methods).some((method) => keep(`${route.route}|${method}`))).map((route) => ({
      ...route,
      methods: [].concat(route.methods).filter((method) => keep(`${route.route}|${method}`)),
    })),
    entries: entries.filter((entry) => keep(keyOf(entry))),
  }
}

export function buildTransitionRecord({ history, routes, entries, manifestSha256, accepted, liveFileSha, lockIds, capabilityIds, evidence }) {
  const exceptions = [...DECISION_BOUND_OPERATIONS]
  const historical = universeSnapshot({ routes: history.routes, entries: history.entries, manifestSha256: history.manifestSha256, exceptions, version: OLD_UNIVERSE_VERSION })
  const canonical = universeSnapshot({ routes, entries, manifestSha256, exceptions, version: NEW_UNIVERSE_VERSION })
  const classCounts = (entriesOf, ids) => {
    const set = new Set(ids)
    return Object.fromEntries(unique(entriesOf.filter((entry) => set.has(keyOf(entry))).map((entry) => entry[3])).sort().map((capabilityId) => [capabilityId, entriesOf.filter((entry) => entry[3] === capabilityId).length]))
  }
  const owned = classCounts(entries, ADDED_OPERATIONS)
  const before = Object.fromEntries(Object.keys(owned).map((capabilityId) => [capabilityId, history.entries.filter((entry) => entry[3] === capabilityId).length]))
  return {
    schemaVersion: 1,
    register: 'UE-GATE0C1-CANONICAL-UNIVERSE-TRANSITION',
    note: 'Versioned transition of the canonical route-method universe. Gate 0B froze a 1,644-operation inventory from a route-coverage manifest that omitted app/api/reviews/route.ts. Gate 0C.1 regenerated the manifest from the route files, found that file to be the only difference and added exactly its two exported handlers. The historical universe is kept as a first-class record and the twelve Gate 0B tranches are not rewritten: their manifests, classifications and ledger are proved byte-identical to their accepted commits. Ownership is accountability, not authorization.',
    anchorCommit: ANCHOR_COMMIT,
    historicalUniverse: historical,
    canonicalUniverse: canonical,
    manifestHashesIdentical: historical.routeBaselineHash === canonical.routeBaselineHash,
    transitions: [{
      version: NEW_UNIVERSE_VERSION,
      from: OLD_UNIVERSE_VERSION,
      to: NEW_UNIVERSE_VERSION,
      date: '2026-10-27',
      tranche: TRANCHE_ID,
      added: [...ADDED_OPERATIONS],
      removed: [...REMOVED_OPERATIONS],
      addedRouteFiles: [...ADDED_ROUTE_FILES],
      size: { before: historical.operations, after: canonical.operations, routesBefore: historical.routes, routesAfter: canonical.routes },
      hash: { before: historical.operationsHash, after: canonical.operationsHash },
      reason: 'The route-coverage manifest was generated before app/api/reviews/route.ts existed and was never regenerated, so the Gate 0B inventory could not contain its GET and POST handlers although both are exported, reachable and owned by the member review-intake capability. The previous ownership register recorded the file as an uninventoried route. Gate 0C.1 regenerates the manifest from the route files and adds exactly the two operations the regeneration produced; it removes none.',
      sourceEvidence: evidence,
      ownershipCountsBefore: historical.inventoryTotals,
      ownershipCountsAfter: canonical.inventoryTotals,
      capabilityOperationCountsBefore: before,
      capabilityOperationCountsAfter: owned,
      backwardCompatibility: {
        historicalTranchesFrozen: true,
        historicalOperationsKeepEntries: true,
        gate0BLedgerUnchanged: true,
        capabilityLockUnchanged: true,
        newCapabilities: [],
        explanation: 'Every one of the 1,644 historical operations keeps its exact ownership entry. The twelve Gate 0B manifests and classifications and the Gate 0B ledger are not regenerated; the two new operations are classified in a separate Gate 0C ledger. No capability is added.',
      },
    }],
    frozenTranches: TRANCHE_ORDER.map((tranche) => ({
      tranche,
      acceptedCommit: accepted[tranche],
      files: Object.fromEntries(MANIFEST_AND_CLASSIFICATION.map((kind) => [kind, { file: FROZEN_TRANCHE_FILES[tranche][kind], sha256: liveFileSha(FROZEN_TRANCHE_FILES[tranche][kind]) }])),
    })),
    frozenLedger: { file: FILE_LEDGER_0B, acceptedCommit: ANCHOR_COMMIT, sha256: liveFileSha(FILE_LEDGER_0B) },
    carbonExceptions: {
      operations: [...DECISION_BOUND_OPERATIONS].sort(compareCodeUnit),
      disposition: 'SCOPE_UNDECIDED',
      nonAuthorizing: true,
      note: 'The four carbon operations stay decision-bound scope exceptions. They are not owned, not classified and not authorized by this transition.',
    },
    capabilityLock: {
      capabilityCount: lockIds.length,
      matrixCapabilityCount: capabilityIds.length,
      added: [],
      note: 'The independent capability lock keeps every anchored identifier. Gate 0C.1 adds no capability: UE-CAP-REVIEW-INTAKE already owns the two operations.',
    },
  }
}

/**
 * Validates the transition record against the live manifest, the route files on disk, the ownership register, the
 * frozen tranche files and the historical universe read from git.
 */
export function validateUniverseTransition({
  record, routes, routeSummaryCount, diskRouteKeys, entries, ownershipUninventoried, history, liveManifestSha256, liveFileSha, tranche0c1, classification0c1, ledger0c, ledger0bSha256,
  exceptionOperations, capabilityIds, lockIds, exists, readText, ledgerClassified0b,
}) {
  const problems = []
  if (!record || record.schemaVersion !== 1 || record.register !== 'UE-GATE0C1-CANONICAL-UNIVERSE-TRANSITION') return ['UNIVERSE-RECORD-ABSENT: the canonical-universe transition record is missing or has the wrong register']
  if (!history) return ['UNIVERSE-HISTORY-UNREADABLE: the historical universe cannot be read from the Gate 0B.12 acceptance commit']
  const live = routeOperations(routes)
  const liveSet = new Set(live)
  const historicalOps = routeOperations(history.routes)
  const historicalSet = new Set(historicalOps)
  const exceptions = new Set(exceptionOperations ?? [])

  if (record.anchorCommit !== ANCHOR_COMMIT) problems.push('UNIVERSE-ANCHOR: the transition record is not anchored at the Gate 0B.12 acceptance commit')
  if (historicalOps.length !== OLD_UNIVERSE_OPERATIONS || history.routes.length !== OLD_UNIVERSE_ROUTES) problems.push(`UNIVERSE-HISTORY: the accepted universe is ${historicalOps.length} operations in ${history.routes.length} routes, not ${OLD_UNIVERSE_OPERATIONS} in ${OLD_UNIVERSE_ROUTES}`)

  const oldSnapshot = universeSnapshot({ routes: history.routes, entries: history.entries, manifestSha256: history.manifestSha256, exceptions, version: OLD_UNIVERSE_VERSION })
  const newSnapshot = universeSnapshot({ routes, entries, manifestSha256: liveManifestSha256, exceptions, version: record.canonicalUniverse?.version })
  for (const field of ['operations', 'routes', 'operationsHash', 'routeBaselineHash', 'manifestSha256', 'ownershipEntriesHash', 'dynamicParameterOperations']) {
    if (record.historicalUniverse?.[field] !== oldSnapshot[field]) problems.push(`UNIVERSE-HISTORICAL-RECORD: the recorded historical ${field} is not the one the accepted commit holds`)
    if (record.canonicalUniverse?.[field] !== newSnapshot[field]) problems.push(`UNIVERSE-COUNT-UNEXPLAINED: the recorded canonical ${field} is not the one the live manifest and ownership register give`)
  }
  if (JSON.stringify(record.historicalUniverse?.inventoryTotals) !== JSON.stringify(oldSnapshot.inventoryTotals)) problems.push('UNIVERSE-TOTALS: the recorded historical six-class totals are not the accepted totals')
  if (JSON.stringify(record.canonicalUniverse?.inventoryTotals) !== JSON.stringify(newSnapshot.inventoryTotals)) problems.push('UNIVERSE-TOTALS: the recorded canonical six-class totals are not the live totals')
  const sixSum = (totals) => INVENTORY_KEYS.reduce((sum, key) => sum + (totals?.[key] ?? 0), 0)
  if (sixSum(newSnapshot.inventoryTotals) !== live.length) problems.push(`UNIVERSE-TOTALS: the six classes add to ${sixSum(newSnapshot.inventoryTotals)}, not the ${live.length} operations of the canonical universe`)

  const actuallyIdentical = oldSnapshot.routeBaselineHash === newSnapshot.routeBaselineHash && oldSnapshot.manifestSha256 === newSnapshot.manifestSha256
  if (record.manifestHashesIdentical !== actuallyIdentical) problems.push('UNIVERSE-FALSE-HASH-CLAIM: the record claims the historical and current manifest hashes are identical or different, and the hashes say the opposite')
  if (record.historicalUniverse?.routeBaselineHash === record.canonicalUniverse?.routeBaselineHash && live.join('\n') !== historicalOps.join('\n')) problems.push('UNIVERSE-FALSE-HASH-CLAIM: the historical and current manifest hashes are recorded as the same although the operations differ')

  const transitions = Array.isArray(record.transitions) ? record.transitions : []
  if (transitions.length === 0) problems.push('UNIVERSE-TRANSITION-ABSENT: the universe changed size and no versioned transition explains it')
  let expected = new Set(historicalSet)
  let version = OLD_UNIVERSE_VERSION
  for (const transition of transitions) {
    const label = `universe transition ${transition?.version ?? '(missing version)'}`
    if (transition.from !== version || transition.to !== transition.version || transition.version !== version + 1) problems.push(`UNIVERSE-VERSION: ${label} does not continue from version ${version}`)
    version = transition.to
    const added = Array.isArray(transition.added) ? transition.added : []
    const removed = Array.isArray(transition.removed) ? transition.removed : []
    for (const list of [added, removed]) {
      if (new Set(list).size !== list.length) problems.push(`UNIVERSE-DUPLICATE: ${label} lists an operation twice`)
      for (let i = 1; i < list.length; i += 1) if (compareCodeUnit(list[i - 1], list[i]) >= 0) { problems.push(`UNIVERSE-ORDER: ${label} is not in ascending code-unit order`); break }
    }
    for (const id of added) {
      if (expected.has(id)) problems.push(`UNIVERSE-ADDITION: ${label} adds ${id}, which the universe already held`)
      expected.add(id)
    }
    for (const id of removed) {
      if (!expected.has(id)) problems.push(`UNIVERSE-REMOVAL: ${label} removes ${id}, which the universe did not hold`)
      expected.delete(id)
    }
    if (!nonEmpty(transition.reason, 60)) problems.push(`UNIVERSE-REASON: ${label} has no versioned reason`)
    if (!Array.isArray(transition.sourceEvidence) || transition.sourceEvidence.length === 0) problems.push(`UNIVERSE-EVIDENCE: ${label} cites no source evidence`)
    for (const item of transition.sourceEvidence ?? []) {
      if (!nonEmpty(item?.ref) || !nonEmpty(item?.quote)) problems.push(`UNIVERSE-EVIDENCE: ${label} has malformed evidence`)
      else if (!exists(item.ref)) problems.push(`UNIVERSE-EVIDENCE: ${label} cites ${item.ref}, which does not exist`)
      else if (!readText(item.ref).includes(item.quote)) problems.push(`UNIVERSE-EVIDENCE: ${label} cites text that is not in ${item.ref}`)
    }
    if (transition.size?.after !== expected.size) problems.push(`UNIVERSE-COUNT-UNEXPLAINED: ${label} records ${transition.size?.after} operations but its additions and removals give ${expected.size}`)
    if (transition.size?.before !== expected.size - added.length + removed.length) problems.push(`UNIVERSE-COUNT-UNEXPLAINED: ${label} records ${transition.size?.before} operations before the change but its additions and removals imply ${expected.size - added.length + removed.length}`)
    if (transition.hash?.after !== trancheHash([...expected].sort(compareCodeUnit))) problems.push(`UNIVERSE-COUNT-UNEXPLAINED: ${label} does not record the hash of the universe it produces`)
    const bc = transition.backwardCompatibility ?? {}
    if (bc.historicalTranchesFrozen !== true || bc.historicalOperationsKeepEntries !== true || bc.gate0BLedgerUnchanged !== true || bc.capabilityLockUnchanged !== true || (bc.newCapabilities ?? []).length !== 0 || !nonEmpty(bc.explanation, 40)) problems.push(`UNIVERSE-COMPATIBILITY: ${label} does not record backward compatibility with the frozen Gate 0B universe`)
    if (JSON.stringify(transition.ownershipCountsAfter) !== JSON.stringify(newSnapshot.inventoryTotals) && transition.version === record.canonicalUniverse?.version) problems.push(`UNIVERSE-TOTALS: ${label} does not record the live ownership counts`)
    if (JSON.stringify(transition.ownershipCountsBefore) !== JSON.stringify(oldSnapshot.inventoryTotals) && transition.from === OLD_UNIVERSE_VERSION) problems.push(`UNIVERSE-TOTALS: ${label} does not record the accepted ownership counts`)
  }
  if (version !== record.canonicalUniverse?.version) problems.push('UNIVERSE-VERSION: the last transition does not produce the recorded canonical universe version')
  const expectedList = [...expected].sort(compareCodeUnit)
  if (expectedList.join('\n') !== live.join('\n')) problems.push(`UNIVERSE-COUNT-UNEXPLAINED: the historical universe plus the recorded transitions give ${expectedList.length} operations, but the live manifest holds ${live.length}`)
  const everAdded = new Set(transitions.flatMap((transition) => transition.added ?? []))
  const everRemoved = new Set(transitions.flatMap((transition) => transition.removed ?? []))
  for (const id of live) if (!historicalSet.has(id) && !everAdded.has(id)) problems.push(`UNIVERSE-UNRECORDED-ADDITION: ${id} is in the manifest but neither in the historical universe nor in a versioned addition`)
  for (const id of historicalOps) if (!liveSet.has(id) && !everRemoved.has(id)) problems.push(`UNIVERSE-UNRECORDED-REMOVAL: historical operation ${id} left the manifest without a versioned removal`)

  const routeKeys = routes.map((route) => route.route)
  if (new Set(routeKeys).size !== routeKeys.length) problems.push('UNIVERSE-DUPLICATE: a route file is listed twice in the manifest')
  const pairs = routes.flatMap((route) => [].concat(route.methods).map((method) => `${route.route}|${method}`))
  if (new Set(pairs).size !== pairs.length) problems.push('UNIVERSE-DUPLICATE: a route-method pair is listed twice in the manifest')
  if (routeSummaryCount !== routes.length) problems.push('UNIVERSE-COUNT: the manifest summary route count does not match its routes')
  const disk = new Set(diskRouteKeys ?? [])
  const manifestRoutes = new Set(routeKeys)
  for (const key of disk) if (!manifestRoutes.has(key)) problems.push(`UNIVERSE-MISSING-ROUTE: route file ${key} exists and is not in the canonical universe`)
  for (const route of routes) {
    if (!disk.has(route.route)) {
      problems.push(`UNIVERSE-STALE-ROUTE: manifest route ${route.route} has no route file`)
      continue
    }
    const file = `${API_PREFIX}${route.route}`
    if (!exists(file)) {
      problems.push(`UNIVERSE-STALE-ROUTE: manifest route ${route.route} has no route file`)
      continue
    }
    const handlers = new Set(handlerMethodsOf(readText(file)))
    for (const method of [].concat(route.methods)) if (!handlers.has(method)) problems.push(`UNIVERSE-NO-HANDLER: manifest operation ${route.route}|${method} has no exported ${method} handler`)
    for (const method of handlers) if (![].concat(route.methods).includes(method)) problems.push(`UNIVERSE-MISSING-ROUTE: ${route.route} exports a ${method} handler that the manifest does not list`)
  }
  if ((ownershipUninventoried ?? []).length > 0) problems.push('UNIVERSE-UNINVENTORIED: the ownership register still records an uninventoried route; the canonical universe has none')

  const entryByKey = new Map(entries.map((entry) => [keyOf(entry), entry]))
  if (entryByKey.size !== entries.length) problems.push('UNIVERSE-DUPLICATE: the ownership register holds a route-method identity twice')
  for (const id of live) if (!entryByKey.has(id)) problems.push(`UNIVERSE-NO-OWNERSHIP: operation ${id} has no ownership entry`)
  for (const key of entryByKey.keys()) if (!liveSet.has(key)) problems.push(`UNIVERSE-ORPHAN-OWNERSHIP: ownership entry ${key} has no manifest operation`)
  for (const old of history.entries) {
    const current = entryByKey.get(keyOf(old))
    if (!current) problems.push(`UNIVERSE-IDENTITY: historical operation ${keyOf(old)} has no current ownership entry`)
    else if (JSON.stringify(current) !== JSON.stringify(old)) problems.push(`UNIVERSE-RECLASSIFIED: historical operation ${keyOf(old)} no longer carries its accepted ownership entry`)
  }

  const classified0c = new Set(Object.keys(ledger0c?.classified ?? {}))
  const classifiedOps = new Set((classification0c1?.operations ?? []).filter((item) => item.status === 'CLASSIFIED').map((item) => item.id))
  const trancheOps = new Set(tranche0c1?.operations ?? [])
  for (const id of everAdded) {
    const entry = entryByKey.get(id)
    if (!entry) continue
    if (entry[4] !== 'OWNED' || !nonEmpty(entry[3]) || entry[3] === 'UE-OMIT-ROUTE-DOMAIN-SCOPE') problems.push(`UNIVERSE-NO-OWNERSHIP: newly inventoried operation ${id} has no engineering owner`)
    if (!String(entry[2]).startsWith('RULE-0C1-')) problems.push(`UNIVERSE-NO-OWNERSHIP: newly inventoried operation ${id} is owned through ${entry[2]}, not a Gate 0C.1 business-evidence rule`)
    if (!classifiedOps.has(id) || !classified0c.has(id) || !trancheOps.has(id)) problems.push(`UNIVERSE-UNCLASSIFIED: newly inventoried operation ${id} has no Gate 0C.1 classification, ledger entry and tranche membership`)
    if (ledgerClassified0b?.[id]) problems.push(`UNIVERSE-UNCLASSIFIED: newly inventoried operation ${id} is also in the Gate 0B ledger`)
  }
  for (const id of trancheOps) if (!everAdded.has(id)) problems.push(`UNIVERSE-UNRECORDED-ADDITION: Gate 0C.1 tranche operation ${id} is not a versioned addition`)

  const carbon = record.carbonExceptions
  const carbonList = [...DECISION_BOUND_OPERATIONS].sort(compareCodeUnit)
  if (!carbon || carbon.operations?.join('\n') !== carbonList.join('\n') || carbon.disposition !== 'SCOPE_UNDECIDED' || carbon.nonAuthorizing !== true) problems.push('UNIVERSE-CARBON: the four carbon exceptions are not recorded explicitly as non-authorizing SCOPE_UNDECIDED')
  if (exceptions.size !== carbonList.length || carbonList.some((id) => !exceptions.has(id))) problems.push('UNIVERSE-CARBON: the decision-bound exception register no longer names exactly the four carbon operations')
  for (const id of carbonList) {
    const entry = entryByKey.get(id)
    if (!entry) problems.push(`UNIVERSE-CARBON: carbon exception ${id} is not in the ownership register`)
    else if (entry[4] !== 'SCOPE_UNDECIDED' || entry[3] !== 'UE-OMIT-ROUTE-DOMAIN-SCOPE') problems.push(`UNIVERSE-CARBON: carbon exception ${id} was reclassified as ${entry[4]} owned by ${entry[3]}; an exception is non-authorizing`)
    if (classified0c.has(id) || trancheOps.has(id) || ledgerClassified0b?.[id]) problems.push(`UNIVERSE-CARBON: carbon exception ${id} is classified; an exception stays SCOPE_UNDECIDED`)
  }

  const frozen = Array.isArray(record.frozenTranches) ? record.frozenTranches : []
  for (const tranche of TRANCHE_ORDER) {
    const item = frozen.find((candidate) => candidate.tranche === tranche)
    if (!item) {
      problems.push(`UNIVERSE-FROZEN: the record does not list Gate ${tranche}`)
      continue
    }
    if (item.acceptedCommit !== history.acceptedCommits[tranche]) problems.push(`UNIVERSE-FROZEN: Gate ${tranche} is not anchored at its accepted commit`)
    for (const kind of MANIFEST_AND_CLASSIFICATION) {
      const file = FROZEN_TRANCHE_FILES[tranche][kind]
      const recorded = item.files?.[kind]
      const accepted = history.acceptedFileSha[tranche]?.[kind]
      if (!recorded || recorded.file !== file) problems.push(`UNIVERSE-FROZEN: Gate ${tranche} ${kind} is not recorded at ${file}`)
      else {
        if (!accepted) problems.push(`UNIVERSE-FROZEN: Gate ${tranche} ${kind} cannot be read from its accepted commit`)
        else if (recorded.sha256 !== accepted) problems.push(`UNIVERSE-FROZEN: the recorded hash of Gate ${tranche} ${kind} is not the hash at its accepted commit`)
        let current = null
        try { current = liveFileSha(file) } catch { current = null }
        if (current !== accepted) problems.push(`UNIVERSE-FROZEN: Gate ${tranche} ${kind} was modified after its accepted commit; the frozen tranche is not regenerated`)
      }
    }
  }
  if (record.frozenLedger?.file !== FILE_LEDGER_0B || record.frozenLedger?.sha256 !== history.ledgerSha256 || ledger0bSha256 !== history.ledgerSha256) problems.push('UNIVERSE-FROZEN: the Gate 0B ledger was modified after the Gate 0B.12 acceptance commit')

  const lock = record.capabilityLock
  const historicalLock = history.lockIds ?? []
  const missing = historicalLock.filter((id) => !(lockIds ?? []).includes(id))
  const extra = (lockIds ?? []).filter((id) => !historicalLock.includes(id))
  if (missing.length > 0) problems.push(`UNIVERSE-LOCK: the independent capability lock dropped ${missing.length} anchored capability id(s)`)
  if (extra.length > 0 || (history.capabilityIds ?? []).join('\n') !== [...(capabilityIds ?? [])].sort().join('\n')) problems.push('UNIVERSE-LOCK: Gate 0C.1 may not add a capability; the matrix capability set differs from the accepted set')
  if (!lock || lock.capabilityCount !== historicalLock.length || (lock.added ?? []).length !== 0) problems.push('UNIVERSE-LOCK: the record does not state that the capability lock is unchanged')

  if (record.canonicalUniverse?.operations !== NEW_UNIVERSE_OPERATIONS || record.canonicalUniverse?.routes !== NEW_UNIVERSE_ROUTES || record.canonicalUniverse?.version !== NEW_UNIVERSE_VERSION) {
    if (transitions.length === 1) problems.push(`UNIVERSE-COUNT-UNEXPLAINED: the canonical universe is not the ${NEW_UNIVERSE_OPERATIONS} operations in ${NEW_UNIVERSE_ROUTES} routes that Gate 0C.1 reconciled`)
  }
  return problems
}

export function universeSummary({ record, routes, entries }) {
  const operations = routeOperations(routes)
  return {
    historicalOperations: record?.historicalUniverse?.operations ?? null,
    canonicalOperations: operations.length,
    routes: routes.length,
    added: (record?.transitions ?? []).flatMap((transition) => transition.added ?? []),
    removed: (record?.transitions ?? []).flatMap((transition) => transition.removed ?? []),
    version: record?.canonicalUniverse?.version ?? null,
    historicalOperationsHash: record?.historicalUniverse?.operationsHash ?? null,
    canonicalOperationsHash: record?.canonicalUniverse?.operationsHash ?? null,
    inventory: inventoryTotals(entries, new Set(DECISION_BOUND_OPERATIONS)),
  }
}
