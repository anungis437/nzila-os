import { createHash } from 'node:crypto'
import type { JournalBatch, LedgerEntry } from './types.js'

function generateId(seed: string): string {
  return createHash('sha256').update(seed).digest('hex').slice(0, 32)
}

export function reverseBatch(batch: JournalBatch, reversedBy: string): { original: JournalBatch; reversal: JournalBatch } {
  if (batch.status !== 'posted') {
    throw new Error('Only posted batches can be reversed')
  }
  const now = new Date().toISOString()
  const reversalId = generateId(`reversal:${batch.id}:${reversedBy}:${now}`)

  const reversedEntries: LedgerEntry[] = batch.entries.map((entry) => ({
    ...entry,
    id: generateId(`rev-entry:${entry.id}:${reversalId}`),
    journalBatchId: reversalId,
    entryType: entry.entryType === 'debit' ? 'credit' : 'debit',
    description: `REVERSAL: ${entry.description}`,
    createdAt: now,
    immutable: true as const,
  }))

  const reversalBatch: JournalBatch = {
    id: reversalId,
    orgId: batch.orgId,
    entries: reversedEntries,
    totalDebits: batch.totalCredits,
    totalCredits: batch.totalDebits,
    balanced: true,
    postedAt: now,
    createdBy: reversedBy,
    status: 'posted',
  }

  const updatedOriginal: JournalBatch = {
    ...batch,
    status: 'reversed',
    reversalBatchId: reversalId,
  }

  return { original: updatedOriginal, reversal: reversalBatch }
}
