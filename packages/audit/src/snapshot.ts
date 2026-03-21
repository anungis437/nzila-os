import { randomUUID } from 'node:crypto'
import type { AuditStore } from './store.js'
import type { RootHashSnapshot } from './schema.js'

// ─── Daily Root Hash Snapshots ──────────────────────────────────────────────

export interface SnapshotStore {
  saveSnapshot(snapshot: RootHashSnapshot): Promise<void>
  getSnapshot(orgId: string, date: string): Promise<RootHashSnapshot | undefined>
  getSnapshots(orgId: string): Promise<RootHashSnapshot[]>
}

export class InMemorySnapshotStore implements SnapshotStore {
  private readonly snapshots: RootHashSnapshot[] = []

  async saveSnapshot(snapshot: RootHashSnapshot): Promise<void> {
    this.snapshots.push(Object.freeze({ ...snapshot }))
  }

  async getSnapshot(orgId: string, date: string): Promise<RootHashSnapshot | undefined> {
    return this.snapshots.find(
      (s) => s.orgId === orgId && s.timestamp.startsWith(date),
    )
  }

  async getSnapshots(orgId: string): Promise<RootHashSnapshot[]> {
    return this.snapshots.filter((s) => s.orgId === orgId)
  }
}

export async function createRootHashSnapshot(
  auditStore: AuditStore,
  snapshotStore: SnapshotStore,
  orgId: string,
): Promise<RootHashSnapshot> {
  const entries = await auditStore.getEntries(orgId, { limit: 100_000 })

  if (entries.length === 0) {
    throw new Error(`No audit entries for org ${orgId}`)
  }

  const firstEntry = entries[0]
  const lastEntry = entries[entries.length - 1]

  const snapshot: RootHashSnapshot = {
    id: randomUUID(),
    orgId,
    timestamp: new Date().toISOString(),
    entryCount: entries.length,
    rootHash: lastEntry.hash,
    firstEntryId: firstEntry.id,
    lastEntryId: lastEntry.id,
  }

  await snapshotStore.saveSnapshot(snapshot)
  return snapshot
}
