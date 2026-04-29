import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryJournalService } from './journal.js'
import { InMemoryLedgerStore } from './ledger.js'

describe('InMemoryJournalService', () => {
  let service: InMemoryJournalService
  let store: InMemoryLedgerStore

  beforeEach(() => {
    service = new InMemoryJournalService()
    store = new InMemoryLedgerStore()
  })

  it('opens a draft batch', () => {
    const batch = service.openBatch('org-1', 'user-1')
    expect(batch.orgId).toBe('org-1')
    expect(batch.status).toBe('draft')
    expect(batch.entries).toHaveLength(0)
  })

  it('adds entries and tracks totals', () => {
    let batch = service.openBatch('org-1', 'user-1')
    batch = service.addEntry(batch, {
      orgId: 'org-1',
      accountId: 'acc-1',
      entryType: 'debit',
      amountCents: 5000,
      currency: 'ZAR',
      description: 'Test debit',
    })
    batch = service.addEntry(batch, {
      orgId: 'org-1',
      accountId: 'acc-2',
      entryType: 'credit',
      amountCents: 5000,
      currency: 'ZAR',
      description: 'Test credit',
    })
    expect(batch.totalDebits).toBe(5000)
    expect(batch.totalCredits).toBe(5000)
    expect(batch.balanced).toBe(true)
  })

  it('throws when posting an unbalanced batch', () => {
    let batch = service.openBatch('org-1', 'user-1')
    batch = service.addEntry(batch, {
      orgId: 'org-1',
      accountId: 'acc-1',
      entryType: 'debit',
      amountCents: 5000,
      currency: 'ZAR',
      description: 'Only debit',
    })
    expect(() => service.postBatch(batch)).toThrow('unbalanced')
  })

  it('posts a balanced batch', () => {
    let batch = service.openBatch('org-1', 'user-1')
    batch = service.addEntry(batch, {
      orgId: 'org-1',
      accountId: 'acc-1',
      entryType: 'debit',
      amountCents: 3000,
      currency: 'ZAR',
      description: 'Debit',
    })
    batch = service.addEntry(batch, {
      orgId: 'org-1',
      accountId: 'acc-2',
      entryType: 'credit',
      amountCents: 3000,
      currency: 'ZAR',
      description: 'Credit',
    })
    const posted = service.postBatch(batch)
    expect(posted.status).toBe('posted')
    expect(posted.postedAt).toBeTruthy()
  })

  it('entries are immutable (immutable flag set)', async () => {
    let batch = service.openBatch('org-1', 'user-1')
    batch = service.addEntry(batch, {
      orgId: 'org-1',
      accountId: 'acc-1',
      entryType: 'debit',
      amountCents: 2000,
      currency: 'ZAR',
      description: 'Debit',
    })
    const entry = batch.entries[0]
    expect(entry?.immutable).toBe(true)
    if (entry) {
      await store.appendEntry(entry)
    }
    const fetched = await store.getEntriesForAccount('org-1', 'acc-1')
    expect(fetched).toHaveLength(1)
    expect(fetched[0]?.immutable).toBe(true)
  })
})
