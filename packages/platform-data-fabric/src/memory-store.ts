/**
 * @nzila/platform-data-fabric — In-Memory Store
 */
import type { OntologyEntityType as _OntologyEntityType } from '@nzila/platform-ontology'
import type {
  CanonicalRecord,
  LineageRecord,
  ConflictRecord,
  SyncJob,
  DataFabricStore,
} from './types'

export function createInMemoryDataFabricStore(): DataFabricStore {
  const canonicals: CanonicalRecord[] = []
  const lineage: LineageRecord[] = []
  const conflicts: ConflictRecord[] = []
  const syncJobs: SyncJob[] = []

  return {
    async persistCanonical(record) {
      canonicals.push(record)
    },
    async persistLineage(record) {
      lineage.push(record)
    },
    async persistConflict(conflict) {
      conflicts.push(conflict)
    },
    async persistSyncJob(job) {
      syncJobs.push(job)
    },
    async updateSyncJob(id, update) {
      const idx = syncJobs.findIndex((j) => j.id === id)
      if (idx >= 0) {
        syncJobs[idx] = { ...syncJobs[idx], ...update }
      }
    },
    async getLineage(entityType, resourceId) {
      const matching = canonicals.filter(
        (c) => c.entityType === entityType && c.resourceId === resourceId,
      )
      return lineage.filter((l) =>
        matching.some((c) => c.id === l.canonicalRecordId),
      )
    },
    async getConflicts(tenantId, entityType) {
      return conflicts.filter(
        (c) =>
          c.tenantId === tenantId &&
          (!entityType || c.entityType === entityType),
      )
    },
  }
}
