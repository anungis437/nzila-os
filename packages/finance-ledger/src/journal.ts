import { createHash } from 'node:crypto'
import type { LedgerEntry, JournalBatch } from './types.js'

function generateId(seed: string): string {
  return createHash('sha256').update(seed).digest('hex').slice(0, 32)
}

export interface JournalService {
  openBatch(orgId: string, createdBy: string): JournalBatch
  addEntry(batch: JournalBatch, entry: Omit<LedgerEntry, 'id' | 'journalBatchId' | 'createdAt' | 'immutable'>): JournalBatch
  postBatch(batch: JournalBatch): JournalBatch
}

export class InMemoryJournalService implements JournalService {
  openBatch(orgId: string, createdBy: string): JournalBatch {
    const now = new Date().toISOString()
    return {
      id: generateId(`${orgId}:${createdBy}:${now}`),
      orgId,
      entries: [],
      totalDebits: 0,
      totalCredits: 0,
      balanced: false,
      postedAt: '',
      createdBy,
      status: 'draft',
    }
  }

  addEntry(
    batch: JournalBatch,
    entry: Omit<LedgerEntry, 'id' | 'journalBatchId' | 'createdAt' | 'immutable'>,
  ): JournalBatch {
    if (batch.status !== 'draft') {
      throw new Error('Cannot add entries to a non-draft batch')
    }
    const now = new Date().toISOString()
    const ledgerEntry: LedgerEntry = {
      ...entry,
      id: generateId(`${batch.id}:${entry.accountId}:${entry.entryType}:${now}`),
      journalBatchId: batch.id,
      createdAt: now,
      immutable: true,
    }
    const newEntries = [...batch.entries, ledgerEntry]
    const totalDebits = newEntries
      .filter((e) => e.entryType === 'debit')
      .reduce((sum, e) => sum + e.amountCents, 0)
    const totalCredits = newEntries
      .filter((e) => e.entryType === 'credit')
      .reduce((sum, e) => sum + e.amountCents, 0)
    return {
      ...batch,
      entries: newEntries,
      totalDebits,
      totalCredits,
      balanced: totalDebits === totalCredits,
    }
  }

  postBatch(batch: JournalBatch): JournalBatch {
    if (batch.status !== 'draft') {
      throw new Error('Only draft batches can be posted')
    }
    if (!batch.balanced) {
      throw new Error(
        `Journal batch is unbalanced: debits=${batch.totalDebits} credits=${batch.totalCredits}`,
      )
    }
    return {
      ...batch,
      status: 'posted',
      postedAt: new Date().toISOString(),
    }
  }
}
