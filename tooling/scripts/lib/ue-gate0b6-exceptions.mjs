/**
 * The decision-bound scope exception register.
 *
 * A DECISION_BOUND_SCOPE_EXCEPTION is an operation whose inventory work is finished and whose scope is not. The
 * operation was inspected, the available source and product evidence was exhausted, the exact institutional decision it
 * waits on is recorded and still outstanding, the candidate capability has not been adopted, the operation is not
 * authorized by the disposition, and its containment obligation has an engineering owner. It is not an operation
 * awaiting source classification, and it is never counted as OWNED or as operationally approved.
 *
 * The register overlays the ownership register. It does not edit the frozen Gate 0B.4 and Gate 0B.5 records that first
 * described the operations: the register pins the hash of each of those records and the validator re-reads them.
 * Only an independent decision record can convert an exception, and no such record exists.
 */
import { createHash } from 'node:crypto'
import { compareCodeUnit, nonEmpty } from './ue-gate0b1-classification.mjs'
import { UNDECIDED_OWNER } from './ue-gate0-route-ownership.mjs'
import { DECISION_BOUND_OPERATIONS, DECISION_IDS_0B6 } from './ue-gate0b6-ids.mjs'

export const FILE_EXCEPTIONS = 'docs/union-eyes/convergence/register/ue-route-decision-bound-exceptions.json'
export const EXCEPTION_CLASS = 'DECISION_BOUND_SCOPE_EXCEPTION'
export const FILES_EXCEPTION_REGISTER = { register: FILE_EXCEPTIONS }

const FLAG_FIELDS = ['adopted', 'authorized', 'operationallyApproved', 'productionReady', 'countedAsOwned']

export const recordHash = (record) => createHash('sha256').update(JSON.stringify(record)).digest('hex')

/** Builds the register from the frozen Gate 0B.4 and Gate 0B.5 classification files. Used only by the builder. */
export function buildExceptionRegister({ classification0b4, classification0b5, anchorCommit }) {
  const decision = classification0b5.institutionalDecisions.find((item) => item.id === DECISION_IDS_0B6.CARBON)
  const exceptions = DECISION_BOUND_OPERATIONS.map((id) => {
    const older = classification0b4.operations.find((record) => record.id === id)
    const newer = classification0b5.operations.find((record) => record.id === id)
    if (!older || !newer || newer.status !== 'UNRESOLVED') throw new Error(`${id} is not an operation Gate 0B.4 and Gate 0B.5 examined and left unresolved`)
    const [route, method] = id.split('|')
    return {
      id,
      route,
      method,
      inventoryClassification: EXCEPTION_CLASS,
      examinedIn: ['GATE-0B.4', 'GATE-0B.5'],
      frozenRecords: { 'GATE-0B.4': recordHash(older), 'GATE-0B.5': recordHash(newer) },
      decisionId: DECISION_IDS_0B6.CARBON,
      unresolvedDecision: decision.question,
      evidenceExhausted: {
        statement: 'Gate 0B.4 and Gate 0B.5 each read the route, the schema, the services, the capability registry, the register and the product callers. No source names a data owner, a measured data source or a persona. A third pass over the same sources adds no evidence, so the operation is not selected for source investigation again.',
        evidenceGap: newer.evidenceGap,
      },
      candidateCapability: { proposed: newer.proposedCapability, adopted: false },
      scopeDisposition: {
        recordedIn: 'GATE-0B.5',
        disposition: newer.scopeDisposition.disposition,
        optionIds: newer.scopeDisposition.options.map((option) => option.id),
        anyOptionChosen: false,
      },
      containmentObligation: {
        capabilityId: newer.implementationObligation.capabilityId,
        gate: newer.implementationObligation.gate,
        obligation: newer.implementationObligation.obligation,
        closesInstitutionalDecision: false,
      },
      defects: newer.defects,
      adopted: false,
      authorized: false,
      operationallyApproved: false,
      productionReady: false,
      countedAsOwned: false,
      independentDecisionRecord: null,
    }
  })
  return {
    schemaVersion: 1,
    register: EXCEPTION_CLASS,
    note: 'Operations that have been inspected, whose available evidence is exhausted and whose scope waits on an outstanding institutional decision. They are reported apart from operations awaiting source classification and are never counted as OWNED. An exception is not an approval: the candidate capability is not adopted, the operation is not authorized, and the containment obligation holds whichever way the decision goes. Only an independent decision record can convert an exception, and none exists.',
    anchorCommit,
    exceptions,
    summary: { exceptions: exceptions.length, decisionIds: [...new Set(exceptions.map((item) => item.decisionId))] },
  }
}

export function validateDecisionBoundExceptions({
  register, classification0b4, classification0b5, latestDecisions, defectRegister, ledger, entries, capabilityById, universe, laterOperations,
}) {
  const problems = []
  if (!register || register.schemaVersion !== 1 || register.register !== EXCEPTION_CLASS) return { problems: ['the decision-bound scope exception register is missing or malformed'], operations: new Set(), summary: null }
  const list = Array.isArray(register.exceptions) ? register.exceptions : []
  const entryByKey = new Map(entries.map((entry) => [`${entry[0]}|${entry[1]}`, entry]))
  const decisions = new Map((latestDecisions ?? []).map((decision) => [decision.id, decision]))
  const defects = new Map((defectRegister ?? []).map((defect) => [defect.id, defect]))
  const seen = new Set()
  for (const item of list) {
    const label = `decision-bound exception ${item?.id ?? '(missing id)'}`
    if (seen.has(item.id)) problems.push(`${label} is recorded twice`)
    seen.add(item.id)
    if (item.id !== `${item.route}|${item.method}`) problems.push(`${label} id does not match its route and method`)
    if (!universe.has(item.id)) problems.push(`${label} is not in the route-method universe`)
    if (item.inventoryClassification !== EXCEPTION_CLASS) problems.push(`${label} is not classified ${EXCEPTION_CLASS}`)
    for (const flag of FLAG_FIELDS) {
      if (item[flag] !== false) problems.push(`${label} records ${flag} ${JSON.stringify(item[flag])}; a decision-bound exception is not adopted, authorized, operationally approved, production ready or counted as owned without an independent decision record`)
    }
    if (item.independentDecisionRecord !== null) problems.push(`${label} claims an independent decision record; none exists, so the exception cannot be converted`)
    const decision = decisions.get(item.decisionId)
    if (!decision) problems.push(`${label} names the institutional decision ${item.decisionId}, which is missing; a decision cannot be removed to close an exception`)
    else {
      if (decision.status !== 'OUTSTANDING') problems.push(`${label} waits on ${item.decisionId}, which is ${decision.status}; an exception is closed only by an independent decision record`)
      if (item.unresolvedDecision !== decision.question) problems.push(`${label} does not record the exact unresolved question of ${item.decisionId}`)
    }
    const older = classification0b4?.operations?.find((record) => record.id === item.id)
    const newer = classification0b5?.operations?.find((record) => record.id === item.id)
    if (!older || !newer) problems.push(`${label} has no frozen Gate 0B.4 and Gate 0B.5 record`)
    else {
      if (newer.status !== 'UNRESOLVED') problems.push(`${label} is no longer unresolved in its frozen Gate 0B.5 record`)
      if (item.frozenRecords?.['GATE-0B.4'] !== recordHash(older)) problems.push(`${label} no longer matches its frozen Gate 0B.4 record; a historical record was changed`)
      if (item.frozenRecords?.['GATE-0B.5'] !== recordHash(newer)) problems.push(`${label} no longer matches its frozen Gate 0B.5 record; a historical record was changed`)
      if (JSON.stringify(item.defects ?? []) !== JSON.stringify(newer.defects ?? [])) problems.push(`${label} does not preserve the defects of its frozen Gate 0B.5 record`)
    }
    if (JSON.stringify(item.examinedIn) !== JSON.stringify(['GATE-0B.4', 'GATE-0B.5'])) problems.push(`${label} does not record the tranches that examined it`)
    if (!nonEmpty(item.evidenceExhausted?.statement, 40) || !nonEmpty(item.evidenceExhausted?.evidenceGap, 30)) problems.push(`${label} does not state that the evidence is exhausted and what is missing`)
    if (item.candidateCapability?.adopted !== false || !nonEmpty(item.candidateCapability?.proposed, 20)) problems.push(`${label} candidate capability is adopted or is not described`)
    if (item.scopeDisposition?.anyOptionChosen !== false || !Array.isArray(item.scopeDisposition?.optionIds) || item.scopeDisposition.optionIds.length < 2) problems.push(`${label} scope disposition has fewer than two options or marks one chosen`)
    const obligation = item.containmentObligation
    if (!obligation || !capabilityById.has(obligation.capabilityId)) problems.push(`${label} containment obligation has no engineering owner`)
    else {
      if (capabilityById.get(obligation.capabilityId).primaryGate !== obligation.gate) problems.push(`${label} containment obligation gate ${obligation.gate} is not the primary gate of ${obligation.capabilityId}`)
      if (obligation.closesInstitutionalDecision !== false) problems.push(`${label} containment obligation claims to close the institutional decision`)
      if (!nonEmpty(obligation.obligation, 40)) problems.push(`${label} containment obligation is not described`)
    }
    for (const id of item.defects ?? []) if (!defects.has(id)) problems.push(`${label} cites unknown defect ${id}`)
    const entry = entryByKey.get(item.id)
    if (!entry) problems.push(`${label} has no ownership entry`)
    else if (entry[4] !== 'SCOPE_UNDECIDED' || entry[3] !== UNDECIDED_OWNER) problems.push(`${label} is recorded as ${entry[4]} owned by ${entry[3]} in the ownership register; an exception is not owned`)
    if (ledger?.classified?.[item.id] !== undefined) problems.push(`${label} appears in the classification ledger as classified; an exception is not a classification`)
    if ((laterOperations ?? new Set()).has(item.id)) problems.push(`${label} was re-examined by a later tranche; a decision-bound exception is not selected for source investigation again`)
  }
  const expected = DECISION_BOUND_OPERATIONS.slice().sort(compareCodeUnit)
  const actual = list.map((item) => item.id).sort(compareCodeUnit)
  for (const id of expected) if (!seen.has(id)) problems.push(`decision-bound exception ${id} was dropped from the register`)
  for (const id of actual) if (!expected.includes(id)) problems.push(`decision-bound exception ${id} was added without an independent decision record and the evidence a frozen tranche requires`)
  const unresolvedBefore = (classification0b5?.operations ?? []).filter((record) => record.status === 'UNRESOLVED').map((record) => record.id).sort(compareCodeUnit)
  if (unresolvedBefore.join('\n') !== expected.join('\n')) problems.push('the operations Gate 0B.5 left unresolved are not the decision-bound operations')
  const summary = { exceptions: list.length, decisionIds: [...new Set(list.map((item) => item.decisionId))] }
  if (register.summary && JSON.stringify(register.summary) !== JSON.stringify(summary)) problems.push('decision-bound exception summary does not match its entries')
  return { problems, operations: new Set(actual), summary }
}

/**
 * The six-way inventory of the whole route-method universe. A decision-bound exception is held in the ownership
 * register as SCOPE_UNDECIDED (it has no owner); the inventory reports it once, apart from the operations still
 * awaiting source classification, so no operation is counted in two categories.
 */
export const INVENTORY_KEYS = ['OWNED', 'SCOPE_UNDECIDED_AWAITING_CLASSIFICATION', 'DECISION_BOUND_SCOPE_EXCEPTION', 'RETIRED_501', 'STUB_501', 'SYSTEM']

export function inventoryTotals(entries, exceptionIds) {
  const totals = Object.fromEntries(INVENTORY_KEYS.map((key) => [key, 0]))
  const other = {}
  for (const entry of entries) {
    const key = `${entry[0]}|${entry[1]}`
    if (entry[4] === 'SCOPE_UNDECIDED') {
      if (exceptionIds.has(key)) totals.DECISION_BOUND_SCOPE_EXCEPTION += 1
      else totals.SCOPE_UNDECIDED_AWAITING_CLASSIFICATION += 1
    } else if (entry[4] in totals) totals[entry[4]] += 1
    else other[entry[4]] = (other[entry[4]] ?? 0) + 1
  }
  return { ...totals, ...(Object.keys(other).length > 0 ? { OTHER: other } : {}), operations: entries.length }
}

export function inventoryTotalsProblems(recorded, computed) {
  const out = []
  if (!recorded || typeof recorded !== 'object') return ['INVENTORY-TOTALS-ABSENT: the matrix records no routeInventoryTotals block']
  for (const key of [...INVENTORY_KEYS, 'operations']) {
    if (recorded[key] !== computed[key]) out.push(`INVENTORY-TOTALS-DRIFT: ${key} is ${recorded[key]} but the ownership register and the exception register give ${computed[key]}`)
  }
  const other = Object.values(computed.OTHER ?? {}).reduce((sum, count) => sum + count, 0)
  const sum = INVENTORY_KEYS.reduce((total, key) => total + (recorded[key] ?? 0), 0) + other
  if (sum !== computed.operations) out.push(`INVENTORY-TOTALS-SUM: the categories add to ${sum}, not the ${computed.operations} route-method operations; an operation is double counted or omitted`)
  return out
}
