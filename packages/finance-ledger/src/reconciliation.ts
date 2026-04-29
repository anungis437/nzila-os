import { createHash } from 'node:crypto'
import type { ReconciliationRun, LedgerEntry } from './types.js'

function generateId(seed: string): string {
  return createHash('sha256').update(seed).digest('hex').slice(0, 32)
}

export interface ExternalEntry {
  id: string
  amountCents: number
  currency: string
  reference: string
}

export interface MatchResult {
  matched: Array<{ ledger: LedgerEntry; external: ExternalEntry }>
  unmatched: ExternalEntry[]
}

export function startReconciliation(
  orgId: string,
  periodStart: string,
  periodEnd: string,
  runBy: string,
): ReconciliationRun {
  const now = new Date().toISOString()
  return {
    id: generateId(`${orgId}:recon:${periodStart}:${periodEnd}:${now}`),
    orgId,
    periodStart,
    periodEnd,
    state: 'in_progress',
    totalMatched: 0,
    totalUnmatched: 0,
    runBy,
  }
}

export function matchEntries(
  run: ReconciliationRun,
  ledgerEntries: LedgerEntry[],
  externalEntries: ExternalEntry[],
): MatchResult {
  const matched: MatchResult['matched'] = []
  const unmatchedExternal = [...externalEntries]

  for (const ledger of ledgerEntries) {
    const idx = unmatchedExternal.findIndex(
      (ext) => ext.amountCents === ledger.amountCents && ext.currency === ledger.currency,
    )
    if (idx !== -1) {
      const external = unmatchedExternal.splice(idx, 1)[0]
      if (external) {
        matched.push({ ledger, external })
      }
    }
  }

  return { matched, unmatched: unmatchedExternal }
}

export function completeReconciliation(run: ReconciliationRun, matched: number, unmatched: number): ReconciliationRun {
  if (run.state !== 'in_progress') {
    throw new Error('Only in-progress reconciliation runs can be completed')
  }
  return {
    ...run,
    state: 'reconciled',
    reconciledAt: new Date().toISOString(),
    totalMatched: matched,
    totalUnmatched: unmatched,
  }
}

export function disputeReconciliation(run: ReconciliationRun, _reason: string): ReconciliationRun {
  if (run.state !== 'in_progress' && run.state !== 'reconciled') {
    throw new Error('Cannot dispute a reconciliation that is not in progress or reconciled')
  }
  return {
    ...run,
    state: 'disputed',
  }
}
