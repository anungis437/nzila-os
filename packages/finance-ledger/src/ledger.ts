import type { LedgerEntry, JournalBatch } from './types.js'

export interface LedgerStore {
  appendEntry(entry: LedgerEntry): Promise<void>
  getEntriesForAccount(orgId: string, accountId: string): Promise<LedgerEntry[]>
  getBatch(orgId: string, batchId: string): Promise<JournalBatch | null>
  listBatches(orgId: string): Promise<JournalBatch[]>
}

export class InMemoryLedgerStore implements LedgerStore {
  private entries: LedgerEntry[] = []
  private batches = new Map<string, JournalBatch>()

  async appendEntry(entry: LedgerEntry): Promise<void> {
    this.entries.push(Object.freeze({ ...entry }))
  }

  async getEntriesForAccount(orgId: string, accountId: string): Promise<LedgerEntry[]> {
    return this.entries.filter((e) => e.orgId === orgId && e.accountId === accountId)
  }

  async getBatch(orgId: string, batchId: string): Promise<JournalBatch | null> {
    const batch = this.batches.get(`${orgId}:${batchId}`)
    return batch ?? null
  }

  async listBatches(orgId: string): Promise<JournalBatch[]> {
    return Array.from(this.batches.values()).filter((b) => b.orgId === orgId)
  }

  async storeBatch(batch: JournalBatch): Promise<void> {
    this.batches.set(`${batch.orgId}:${batch.id}`, batch)
  }
}
