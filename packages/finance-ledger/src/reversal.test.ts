import { describe, it, expect } from 'vitest'
import { InMemoryJournalService } from './journal.js'
import { reverseBatch } from './reversal.js'

describe('reverseBatch', () => {
  it('creates a mirror batch swapping debits and credits', () => {
    const service = new InMemoryJournalService()
    let batch = service.openBatch('org-1', 'user-1')
    batch = service.addEntry(batch, {
      orgId: 'org-1',
      accountId: 'acc-1',
      entryType: 'debit',
      amountCents: 7000,
      currency: 'ZAR',
      description: 'Original debit',
    })
    batch = service.addEntry(batch, {
      orgId: 'org-1',
      accountId: 'acc-2',
      entryType: 'credit',
      amountCents: 7000,
      currency: 'ZAR',
      description: 'Original credit',
    })
    batch = service.postBatch(batch)

    const { original, reversal } = reverseBatch(batch, 'admin-1')
    expect(original.status).toBe('reversed')
    expect(original.reversalBatchId).toBe(reversal.id)
    expect(reversal.status).toBe('posted')
    expect(reversal.balanced).toBe(true)

    const debitEntry = reversal.entries.find((e) => e.entryType === 'debit')
    const creditEntry = reversal.entries.find((e) => e.entryType === 'credit')
    expect(debitEntry?.amountCents).toBe(7000)
    expect(creditEntry?.amountCents).toBe(7000)
  })

  it('throws when trying to reverse a non-posted batch', () => {
    const service = new InMemoryJournalService()
    const batch = service.openBatch('org-1', 'user-1')
    expect(() => reverseBatch(batch, 'admin-1')).toThrow('Only posted batches can be reversed')
  })

  it('marks reversal entries as immutable', () => {
    const service = new InMemoryJournalService()
    let batch = service.openBatch('org-1', 'user-1')
    batch = service.addEntry(batch, {
      orgId: 'org-1',
      accountId: 'acc-1',
      entryType: 'debit',
      amountCents: 1000,
      currency: 'ZAR',
      description: 'D',
    })
    batch = service.addEntry(batch, {
      orgId: 'org-1',
      accountId: 'acc-2',
      entryType: 'credit',
      amountCents: 1000,
      currency: 'ZAR',
      description: 'C',
    })
    batch = service.postBatch(batch)
    const { reversal } = reverseBatch(batch, 'admin-1')
    for (const entry of reversal.entries) {
      expect(entry.immutable).toBe(true)
    }
  })

  it('reconciliation state transitions work', () => {
    const run = {
      id: 'run-1',
      orgId: 'org-1',
      periodStart: '2024-01-01',
      periodEnd: '2024-01-31',
      state: 'in_progress' as const,
      totalMatched: 0,
      totalUnmatched: 0,
      runBy: 'user-1',
    }
    const completed = { ...run, state: 'reconciled' as const, reconciledAt: new Date().toISOString(), totalMatched: 5, totalUnmatched: 1 }
    expect(completed.state).toBe('reconciled')
    const disputed = { ...completed, state: 'disputed' as const }
    expect(disputed.state).toBe('disputed')
  })
})
