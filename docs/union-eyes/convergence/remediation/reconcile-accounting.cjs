// Reconciles the two Gate 0 accounting paths so that neither silently disagrees with the other.
//
//   ue-gate0-defect-elimination.json   built only from elimination-batches.json (this run's batches)
//   ue-all-777-remediation-register.json  the canonical per-defect overlay, which also holds corrections made by earlier runs
//
// Every defect the overlay marks implemented must be accounted for exactly once: either by an elimination batch, or by an earlier run
// whose record cites existing source. The script writes ue-gate0-accounting-reconciliation.json and exits non-zero on any inconsistency.
// It never edits the frozen register, the overlay or the ledger.
const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '../../../..')
const register = JSON.parse(fs.readFileSync(path.join(root, 'docs/union-eyes/convergence/register/ue-route-classification-0c1.json'), 'utf8')).defectRegister
const overlay = JSON.parse(fs.readFileSync(path.join(__dirname, 'ue-all-777-remediation-register.json'), 'utf8'))
const ledger = JSON.parse(fs.readFileSync(path.join(__dirname, 'ue-gate0-defect-elimination.json'), 'utf8'))
const IMPL = 'IMPLEMENTED_SOURCE_PENDING_VS_VALIDATION'
const PART = 'PARTIAL_SOURCE_REMAINING_WORK'
const LEDGER_IMPL = 'IMPLEMENTED_PENDING_QUALIFICATION'

const byId = new Map(overlay.records.map((r) => [r.defectId, r]))
const problems = []
const earlierRunCredits = []
let batchCredits = 0
let sameBatchAgreement = 0
const batchDisagreements = []
// Every one of the 777 frozen IDs falls into exactly one of these three buckets (verified below, not assumed):
// a defect with no engineeringCorrection at all is UNTOUCHED, never counted as PARTIAL. "outstanding"/"remaining"
// has always meant PARTIAL + UNTOUCHED together (see overlay.summary.engineeringRemaining); the two are not additive
// with each other, and partial is a strict subset of outstanding, not a disjoint addition to it.
const untouchedIds = []
const partialIds = []
const implementedIds = []

for (const d of register) {
  const record = byId.get(d.id)
  if (!record) {
    problems.push(`not in overlay: ${d.id}`)
    continue
  }
  const o = record.engineeringCorrection
  const l = ledger.entries[d.id]
  if (o == null) untouchedIds.push(d.id)
  else if (o.state === PART) partialIds.push(d.id)
  else if (o.state === IMPL) implementedIds.push(d.id)
  else problems.push(`unrecognized engineeringCorrection.state on ${d.id}: ${o.state}`)
  const overlayImpl = o?.state === IMPL
  const ledgerImpl = l?.status === LEDGER_IMPL
  if (ledgerImpl && !overlayImpl) problems.push(`ledger credits a defect the overlay does not: ${d.id}`)
  if (overlayImpl && ledgerImpl) {
    batchCredits += 1
    if (o.batch === l.batch) sameBatchAgreement += 1
    else batchDisagreements.push({ defectId: d.id, overlayBatch: o.batch ?? null, ledgerBatch: l.batch })
  }
  if (overlayImpl && !ledgerImpl) {
    const files = String(o.path || '').split(/;\s*/).filter(Boolean)
    const missing = files.filter((f) => !fs.existsSync(path.join(root, f)))
    if (files.length === 0) problems.push(`earlier-run credit cites no source: ${d.id}`)
    if (missing.length > 0) problems.push(`earlier-run credit cites missing files: ${d.id} -> ${missing.join(', ')}`)
    earlierRunCredits.push({
      defectId: d.id,
      batch: o.batch ?? null,
      sourceCommit: o.sourceCommit ?? null,
      regressionTest: o.regressionTest ?? o.regressionPath ?? null,
      files,
      hasIndependentRegressionEvidence: Boolean(o.regressionTest || o.regressionPath),
    })
  }
  const overlayPartial = o?.state === PART
  const ledgerPartial = l?.status === 'PARTIAL'
  if (ledgerPartial && !overlayPartial && !overlayImpl) problems.push(`ledger partial missing from overlay: ${d.id}`)
}

const overlayImplemented = overlay.records.filter((r) => r.engineeringCorrection?.state === IMPL).length
const overlayPartial = overlay.records.filter((r) => r.engineeringCorrection?.state === PART).length
const ledgerImplemented = Object.values(ledger.entries).filter((e) => e.status === LEDGER_IMPL).length
const ledgerPartial = Object.values(ledger.entries).filter((e) => e.status === 'PARTIAL').length

if (overlayImplemented !== ledgerImplemented + earlierRunCredits.length) {
  problems.push(`credit does not reconcile: overlay ${overlayImplemented} != ledger ${ledgerImplemented} + earlier runs ${earlierRunCredits.length}`)
}
if (overlay.summary.engineeringCorrected !== overlayImplemented) problems.push('overlay summary.engineeringCorrected does not match its records')
if (implementedIds.length !== overlayImplemented) problems.push(`ID-level implemented count ${implementedIds.length} != aggregate overlayImplemented ${overlayImplemented}`)
if (partialIds.length !== overlayPartial) problems.push(`ID-level partial count ${partialIds.length} != aggregate overlayPartial ${overlayPartial}`)
if (implementedIds.length + partialIds.length + untouchedIds.length !== register.length) {
  problems.push(`mutually-exclusive buckets do not sum to the population: ${implementedIds.length} + ${partialIds.length} + ${untouchedIds.length} != ${register.length}`)
}
const dup = (ids) => ids.length !== new Set(ids).size
if (dup(implementedIds) || dup(partialIds) || dup(untouchedIds)) problems.push('duplicate defect ID found within a single accounting bucket')

const doc = {
  record: 'UE-GATE0-ACCOUNTING-RECONCILIATION',
  population: register.length,
  rule: 'Each corrected defect is counted once. The overlay total equals the elimination-ledger credits plus the credits earlier runs recorded with cited source; any other difference fails this check.',
  totals: {
    overlayImplemented,
    ledgerImplemented,
    creditedByEarlierRuns: earlierRunCredits.length,
    earlierRunCreditsWithIndependentRegressionEvidence: earlierRunCredits.filter((c) => c.hasIndependentRegressionEvidence).length,
    overlayPartial,
    ledgerPartial,
    // DEPRECATED NAME, kept for existing consumers: this is partial + untouched together, NOT additional to overlayPartial.
    // Use untouchedByOverlay (disjoint from overlayPartial) for a true "zero engineering work done" count.
    unresolvedByOverlay: register.length - overlayImplemented,
    untouchedByOverlay: untouchedIds.length,
    qualificationVerified: 0,
    closed: 0,
  },
  mutuallyExclusiveAccounting: {
    rule: 'Every one of the 777 frozen defect IDs is counted in exactly one of these three buckets. implemented + partial + untouched always equals the population. "outstanding"/"remaining" in prose means partial + untouched together, never partial added on top of an outstanding figure that already includes it.',
    population: register.length,
    implemented: implementedIds.length,
    partial: partialIds.length,
    untouched: untouchedIds.length,
    partialIds,
    untouchedIds,
  },
  agreement: { creditedByBoth: batchCredits, sameBatchLabel: sameBatchAgreement, differentBatchLabel: batchDisagreements.length },
  batchLabelDifferences: batchDisagreements,
  earlierRunCredits,
  consistent: problems.length === 0,
  problems,
}
fs.writeFileSync(path.join(__dirname, 'ue-gate0-accounting-reconciliation.json'), JSON.stringify(doc, null, 2) + '\n')
console.log(JSON.stringify({
  totals: doc.totals,
  mutuallyExclusiveAccounting: { ...doc.mutuallyExclusiveAccounting, partialIds: undefined, untouchedIds: undefined },
  agreement: doc.agreement,
  consistent: doc.consistent,
  problems: problems.slice(0, 10),
}))
if (problems.length > 0) process.exit(1)
