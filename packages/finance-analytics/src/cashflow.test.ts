import { describe, it, expect } from 'vitest'
import { summarizeCashflow } from './cashflow.js'
import type { LedgerEntry } from '@nzila/finance-ledger'

const makeEntry = (id: string, entryType: 'debit' | 'credit', amountCents: number, createdAt: string): LedgerEntry => ({
  id,
  orgId: 'org-1',
  journalBatchId: 'batch-1',
  accountId: 'acc-1',
  entryType,
  amountCents,
  currency: 'ZAR',
  description: 'Test entry',
  createdAt,
  immutable: true,
})

describe('summarizeCashflow', () => {
  it('summarizes inflows and outflows correctly', () => {
    const entries: LedgerEntry[] = [
      makeEntry('e1', 'credit', 10000, '2024-01-15T00:00:00.000Z'),
      makeEntry('e2', 'credit', 5000, '2024-01-20T00:00:00.000Z'),
      makeEntry('e3', 'debit', 3000, '2024-01-25T00:00:00.000Z'),
    ]
    const summary = summarizeCashflow('org-1', entries, '2024-01-01T00:00:00.000Z', '2024-01-31T23:59:59.999Z', 'ZAR')
    expect(summary.totalInflowCents).toBe(15000)
    expect(summary.totalOutflowCents).toBe(3000)
    expect(summary.netCents).toBe(12000)
  })

  it('excludes entries outside the period', () => {
    const entries: LedgerEntry[] = [
      makeEntry('e1', 'credit', 10000, '2024-01-15T00:00:00.000Z'),
      makeEntry('e2', 'credit', 5000, '2024-02-01T00:00:00.000Z'),
    ]
    const summary = summarizeCashflow('org-1', entries, '2024-01-01T00:00:00.000Z', '2024-01-31T23:59:59.999Z', 'ZAR')
    expect(summary.totalInflowCents).toBe(10000)
  })
})
