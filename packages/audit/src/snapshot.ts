import { randomUUID } from 'node:crypto'
import type { AuditStore } from './store.js'
import type { RootHashSnapshot } from './schema.js'

// ─── Daily Root Hash Snapshots ──────────────────────────────────────────────

export interface SnapshotStore {
  saveSnapshot(snapshot: RootHashSnapshot): Promise<void>
  getSnapshot(tenantId: string, date: string): Promise<RootHashSnapshot | undefined>
  getSnapshots(tenantId: string): Promise<RootHashSnapshot[]>
}

export class InMemorySnapshotStore implements SnapshotStore {
  private readonly snapshots: RootHashSnapshot[] = []

  async saveSnapshot(snapshot: RootHashSnapshot): Promise<void> {
    this.snapshots.push(Object.freeze({ ...snapshot }))
  }

  async getSnapshot(tenantId: string, date: string): Promise<RootHashSnapshot | undefined> {
    return this.snapshots.find(
      (s) => s.tenantId === tenantId && s.timestamp.startsWith(date),
    )
  }

  async getSnapshots(tenantId: string): Promise<RootHashSnapshot[]> {
    return this.snapshots.filter((s) => s.tenantId === tenantId)
  }
}

export async function createRootHashSnapshot(
  auditStore: AuditStore,
  snapshotStore: SnapshotStore,
  tenantId: string,
): Promise<RootHashSnapshot> {
  const entries = await auditStore.getEntries(tenantId, { limit: 100_000 })

  if (entries.length === 0) {
    throw new Error(`No audit entries for tenant ${tenantId}`)
  }

  const firstEntry = entries[0]
  const lastEntry = entries[entries.length - 1]

  const snapshot: RootHashSnapshot = {
    id: randomUUID(),
    tenantId,
    timestamp: new Date().toISOString(),
    entryCount: entries.length,
    rootHash: lastEntry.hash,
    firstEntryId: firstEntry.id,
    lastEntryId: lastEntry.id,
  }

  await snapshotStore.saveSnapshot(snapshot)
  return snapshot
}
