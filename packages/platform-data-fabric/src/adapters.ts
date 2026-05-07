/**
 * @nzila/platform-data-fabric — Adapter Registry & Operations
 */
import type { OntologyEntityType } from '@nzila/platform-ontology'
import type {
  SourceAdapter,
  SourceRecord,
  CanonicalRecord,
  LineageRecord,
  ConflictRecord,
  DataFabricStore,
} from './types'

// ── Adapter Registry ────────────────────────────────────────────────────────

const adapters = new Map<string, SourceAdapter>()

export function registerSourceAdapter(adapter: SourceAdapter): void {
  adapters.set(adapter.sourceSystem, adapter)
}

export function getSourceAdapter(sourceSystem: string): SourceAdapter | undefined {
  return adapters.get(sourceSystem)
}

export function listSourceAdapters(): readonly SourceAdapter[] {
  return Array.from(adapters.values())
}

export function resetAdapterRegistry(): void {
  adapters.clear()
}

// ── Mapping ─────────────────────────────────────────────────────────────────

let idCounter = 0
function generateId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  idCounter++
  return `00000000-0000-0000-0000-${String(idCounter).padStart(12, '0')}`
}

export interface MapSourceRecordOptions {
  sourceRecord: SourceRecord
  targetEntityType: OntologyEntityType
  resourceId: string
  mappingVersion: number
  transformFn: (raw: Record<string, unknown>) => Record<string, unknown>
}

/**
 * Map a source record to a canonical record using a transform function.
 */
export function mapSourceRecordToCanonical(
  options: MapSourceRecordOptions,
): CanonicalRecord {
  const { sourceRecord, targetEntityType, resourceId, mappingVersion, transformFn } = options
  const now = new Date().toISOString()
  const payload = transformFn(sourceRecord.rawPayload)

  return {
    id: generateId(),
    tenantId: sourceRecord.tenantId,
    entityType: targetEntityType,
    resourceId,
    sourceSystem: sourceRecord.sourceSystem,
    sourceRecordId: sourceRecord.sourceRecordId,
    mappingVersion,
    transformationLog: [`mapped from ${sourceRecord.sourceSystem}:${sourceRecord.sourceRecordId}`],
    payload,
    ingestedAt: sourceRecord.ingestedAt,
    mappedAt: now,
  }
}

/**
 * Reconcile a canonical entity — check for duplicates or conflicts.
 */
export async function reconcileCanonicalEntity(
  store: DataFabricStore,
  record: CanonicalRecord,
): Promise<{ persisted: boolean; conflicts: readonly ConflictRecord[] }> {
  const existing = await store.getLineage(record.entityType, record.resourceId)
  const conflicts: ConflictRecord[] = []

  // Check for source conflicts
  for (const lineage of existing) {
    if (
      lineage.sourceSystem !== record.sourceSystem &&
      lineage.sourceRecordId !== record.sourceRecordId
    ) {
      const conflict: ConflictRecord = {
        id: generateId(),
        tenantId: record.tenantId,
        entityType: record.entityType,
        resourceId: record.resourceId,
        sourceSystemA: lineage.sourceSystem,
        sourceSystemB: record.sourceSystem,
        conflictingField: 'source_identity',
        valueA: lineage.sourceRecordId,
        valueB: record.sourceRecordId,
        detectedAt: new Date().toISOString(),
      }
      conflicts.push(conflict)
      await store.persistConflict(conflict)
    }
  }

  await store.persistCanonical(record)
  await store.persistLineage({
    id: generateId(),
    canonicalRecordId: record.id,
    sourceSystem: record.sourceSystem,
    sourceRecordId: record.sourceRecordId,
    mappingVersion: record.mappingVersion,
    transformationLog: record.transformationLog,
    ingestedAt: record.ingestedAt,
  })

  return { persisted: true, conflicts }
}

/**
 * Get lineage for an entity — trace all source records.
 */
export async function getLineageForEntity(
  store: DataFabricStore,
  entityType: OntologyEntityType,
  resourceId: string,
): Promise<readonly LineageRecord[]> {
  return store.getLineage(entityType, resourceId)
}

/**
 * Resolve a conflict with a given strategy.
 */
export async function resolveConflict(
  store: DataFabricStore,
  conflictId: string,
  resolution: ConflictRecord['resolution'],
  resolvedBy: string,
): Promise<void> {
  // In a real implementation this would update the conflict record in the store
  // For now this is a placeholder — the store interface would need an updateConflict method
  void store
  void conflictId
  void resolution
  void resolvedBy
}
