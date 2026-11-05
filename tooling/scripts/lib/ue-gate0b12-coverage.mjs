/**
 * Gate 0B.12 coverage reconciliation. Gate 0B.12 is the final route-ownership classification tranche, so the register
 * must now account for every route-method operation exactly once. These rules read only the ownership register, the
 * classification ledger, the frozen tranche manifests and the decision-bound exception list; they never grant access.
 * Ownership is accountability, not authorization, and the four carbon exceptions stay non-authorizing.
 */
import { INVENTORY_KEYS, inventoryTotals } from './ue-gate0b6-exceptions.mjs'

export const SIX_CLASSES = INVENTORY_KEYS
const FROZEN_DISPOSITIONS = ['RETIRED_501', 'STUB_501', 'SYSTEM']
const CLASSIFIED_DISPOSITIONS = ['OWNED', ...FROZEN_DISPOSITIONS]

export function coverageProblems({ entries, anchoredEntries, ledger, manifests, exceptionIds, frozen, unresolved = [] }) {
  const problems = []
  const keyOf = (entry) => `${entry[0]}|${entry[1]}`
  const seen = new Map()
  for (const entry of entries ?? []) {
    const key = keyOf(entry)
    seen.set(key, (seen.get(key) ?? 0) + 1)
  }
  for (const [key, count] of seen) if (count !== 1) problems.push(`coverage: operation ${key} has ${count} dispositions; exactly one is required`)

  const exceptions = new Set(exceptionIds ?? [])
  for (const entry of entries ?? []) {
    const key = keyOf(entry)
    if (entry[4] === 'SCOPE_UNDECIDED') {
      if (!exceptions.has(key)) problems.push(`coverage: operation ${key} is still SCOPE_UNDECIDED and is not a decision-bound scope exception`)
    } else if (!CLASSIFIED_DISPOSITIONS.includes(entry[4])) problems.push(`coverage: operation ${key} has disposition ${JSON.stringify(entry[4])}, which is not one of the six inventory classes`)
  }
  for (const id of exceptions) {
    const entry = (entries ?? []).find((candidate) => keyOf(candidate) === id)
    if (!entry) problems.push(`coverage: decision-bound exception ${id} is not in the ownership register`)
    else if (entry[4] !== 'SCOPE_UNDECIDED') problems.push(`coverage: decision-bound exception ${id} was given disposition ${entry[4]}; an exception is non-authorizing and stays SCOPE_UNDECIDED`)
    if (ledger?.classified?.[id]) problems.push(`coverage: decision-bound exception ${id} is recorded as classified in the ledger`)
    if ((frozen ?? []).includes(id)) problems.push(`coverage: decision-bound exception ${id} is inside the frozen Gate 0B.12 selection`)
  }
  for (const id of frozen ?? []) {
    const entry = (entries ?? []).find((candidate) => keyOf(candidate) === id)
    if (!entry) continue
    if (entry[4] === 'SCOPE_UNDECIDED') problems.push(`coverage: never-examined operation ${id} stays SCOPE_UNDECIDED after the final tranche`)
  }
  for (const id of unresolved) problems.push(`coverage: operation ${id} is an unresolved evidence gap; the route inventory cannot be reconciled as complete`)

  const examined = new Set()
  for (const manifest of manifests ?? []) for (const id of manifest?.operations ?? []) examined.add(id)
  for (const id of examined) {
    if (exceptions.has(id)) continue
    if (!ledger?.classified?.[id]) problems.push(`coverage: operation ${id} was examined by a tranche but the ledger does not record a classification`)
  }
  const classifiedInLedger = new Set(Object.keys(ledger?.classified ?? {}))
  for (const id of classifiedInLedger) {
    if (!seen.has(id)) problems.push(`coverage: ledger classification ${id} is not in the ownership register`)
  }

  const anchored = new Map((anchoredEntries ?? []).map((entry) => [keyOf(entry), entry]))
  for (const [key, old] of anchored) {
    if (!FROZEN_DISPOSITIONS.includes(old[4])) continue
    const current = (entries ?? []).find((candidate) => keyOf(candidate) === key)
    if (!current || current[4] !== old[4] || current[3] !== old[3]) problems.push(`coverage: retired, stub or system operation ${key} changed from ${old[4]}/${old[3]}`)
  }

  const totals = inventoryTotals(entries ?? [], exceptions)
  if (totals.SCOPE_UNDECIDED_AWAITING_CLASSIFICATION !== 0) problems.push(`coverage: ${totals.SCOPE_UNDECIDED_AWAITING_CLASSIFICATION} operation(s) still await classification`)
  if (totals.OTHER) problems.push('coverage: the register holds a disposition outside the six inventory classes')
  const sum = SIX_CLASSES.reduce((total, key) => total + totals[key], 0)
  if (sum !== totals.operations) problems.push(`coverage: the six classes add to ${sum}, not ${totals.operations} operations`)
  return problems
}

export function coverageSummary({ entries, exceptionIds, manifests }) {
  const totals = inventoryTotals(entries ?? [], new Set(exceptionIds ?? []))
  const examined = new Set()
  for (const manifest of manifests ?? []) for (const id of manifest?.operations ?? []) examined.add(id)
  return {
    classes: Object.fromEntries(SIX_CLASSES.map((key) => [key, totals[key]])),
    operations: totals.operations,
    examinedByTranches: examined.size,
    decisionBoundExceptions: [...(exceptionIds ?? [])].sort(),
  }
}
