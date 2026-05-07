/**
 * @nzila/platform-data-fabric — Instrumented Adapters
 *
 * Wraps data fabric operations with telemetry from platform-observability.
 * Emits structured lifecycle events for:
 *   record_ingested → mapping_applied → reconciliation_performed → lineage_updated
 *   conflict_detected (when conflicts found)
 */
import type { OntologyEntityType as _OntologyEntityType } from '@nzila/platform-ontology'
import type {
  CanonicalRecord,
  ConflictRecord,
  DataFabricStore,
} from './types'
import {
  mapSourceRecordToCanonical,
  reconcileCanonicalEntity,
  type MapSourceRecordOptions,
} from './adapters'
import {
  dataFabricTelemetry,
  governanceTelemetry,
} from '@nzila/platform-observability'
import { createLogger } from '@nzila/platform-observability'

const logger = createLogger({ org_id: 'platform' })

// ── Instrumented Mapping ────────────────────────────────────────────────────

/**
 * Map a source record to canonical form with telemetry.
 *
 * Emits:
 *   - `data_fabric_ingestion_total` counter
 *   - Structured log: `record_ingested`, `mapping_applied`
 */
export function instrumentedMapSourceRecord(
  options: MapSourceRecordOptions,
): CanonicalRecord {
  const tel = dataFabricTelemetry(options.sourceRecord.sourceSystem)

  tel.recordIngested(options.targetEntityType)

  const result = mapSourceRecordToCanonical(options)

  tel.mappingApplied(
    `v${options.mappingVersion}`,
    options.targetEntityType,
  )

  logger.info('data_fabric_mapping_completed', {
    sourceSystem: options.sourceRecord.sourceSystem,
    sourceRecordId: options.sourceRecord.sourceRecordId,
    entityType: options.targetEntityType,
    resourceId: options.resourceId,
    mappingVersion: options.mappingVersion,
  })

  return result
}

// ── Instrumented Reconciliation ─────────────────────────────────────────────

/**
 * Reconcile a canonical entity with telemetry.
 *
 * Emits:
 *   - `data_fabric_reconciliation_failures_total` (on unmatched)
 *   - `data_fabric_mapping_conflicts_total` (per conflict)
 *   - `governance_audit_events_total` (reconciliation audit)
 *   - Structured logs: `reconciliation_performed`, `conflict_detected`, `lineage_updated`
 */
export async function instrumentedReconcile(
  store: DataFabricStore,
  record: CanonicalRecord,
): Promise<{ persisted: boolean; conflicts: readonly ConflictRecord[] }> {
  const tel = dataFabricTelemetry(record.sourceSystem)
  const gov = governanceTelemetry(record.tenantId)

  const startMs = performance.now()
  const result = await reconcileCanonicalEntity(store, record)
  const durationMs = Math.round(performance.now() - startMs)

  // Emit reconciliation telemetry
  tel.reconciliationPerformed(record.resourceId, result.conflicts.length === 0)

  // Emit conflict telemetry
  for (const conflict of result.conflicts) {
    tel.conflictDetected(conflict.resourceId, conflict.conflictingField)
    logger.warn('data_fabric_conflict_detected', {
      resourceId: conflict.resourceId,
      entityType: conflict.entityType,
      sourceA: conflict.sourceSystemA,
      sourceB: conflict.sourceSystemB,
      field: conflict.conflictingField,
    })
  }

  // Lineage update
  tel.lineageUpdated(record.resourceId)

  // Audit event
  gov.auditEmitted('data_fabric_reconciliation', {
    resourceId: record.resourceId,
    entityType: record.entityType,
    sourceSystem: record.sourceSystem,
    conflictCount: result.conflicts.length,
    durationMs,
  })

  logger.info('data_fabric_reconciliation_completed', {
    resourceId: record.resourceId,
    entityType: record.entityType,
    sourceSystem: record.sourceSystem,
    persisted: result.persisted,
    conflictCount: result.conflicts.length,
    durationMs,
  })

  return result
}
