import type { AuditEntry } from './schema.js'

// ─── Store Interface ────────────────────────────────────────────────────────

export interface AuditStore {
  append(entry: AuditEntry): Promise<void>
  getLastEntry(tenantId: string): Promise<AuditEntry | undefined>
  getEntry(id: string): Promise<AuditEntry | undefined>
  getEntries(
    tenantId: string,
    options?: { limit?: number; offset?: number; fromDate?: string; toDate?: string },
  ): Promise<AuditEntry[]>
  getEntryCount(tenantId: string): Promise<number>
}

// ─── In-Memory Store (testing / development) ────────────────────────────────

export class InMemoryAuditStore implements AuditStore {
  private readonly entries: AuditEntry[] = []

  async append(entry: AuditEntry): Promise<void> {
    this.entries.push(Object.freeze({ ...entry }))
  }

  async getLastEntry(tenantId: string): Promise<AuditEntry | undefined> {
    for (let i = this.entries.length - 1; i >= 0; i--) {
      if (this.entries[i].tenantId === tenantId) {
        return this.entries[i]
      }
    }
    return undefined
  }

  async getEntry(id: string): Promise<AuditEntry | undefined> {
    return this.entries.find((e) => e.id === id)
  }

  async getEntries(
    tenantId: string,
    options?: { limit?: number; offset?: number; fromDate?: string; toDate?: string },
  ): Promise<AuditEntry[]> {
    let filtered = this.entries.filter((e) => e.tenantId === tenantId)

    if (options?.fromDate) {
      filtered = filtered.filter((e) => e.timestamp >= options.fromDate!)
    }
    if (options?.toDate) {
      filtered = filtered.filter((e) => e.timestamp <= options.toDate!)
    }

    const offset = options?.offset ?? 0
    const limit = options?.limit ?? 1000

    return filtered.slice(offset, offset + limit)
  }

  async getEntryCount(tenantId: string): Promise<number> {
    return this.entries.filter((e) => e.tenantId === tenantId).length
  }

  /** Test helper — returns all entries */
  getAll(): readonly AuditEntry[] {
    return this.entries
  }
}
