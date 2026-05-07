/**
 * @nzila/platform-data-fabric — Types
 *
 * Canonical data plane types for ingestion, mapping, sync, and reconciliation.
 */
import { z } from 'zod'
import type { OntologyEntityType } from '@nzila/platform-ontology'

// ── Source System Categories ────────────────────────────────────────────────

export const SourceSystemCategories = {
  CRM: 'crm',
  ERP: 'erp',
  EMAIL: 'email',
  DOCUMENT_STORAGE: 'document_storage',
  MESSAGING: 'messaging',
  PAYMENT_PROCESSOR: 'payment_processor',
  CASE_SYSTEM: 'case_system',
  SPREADSHEET: 'spreadsheet',
  CUSTOM_API: 'custom_api',
} as const

export type SourceSystemCategory =
  (typeof SourceSystemCategories)[keyof typeof SourceSystemCategories]

// ── Sync Statuses ───────────────────────────────────────────────────────────

export const SyncStatuses = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  PARTIAL: 'partial',
} as const

export type SyncStatus = (typeof SyncStatuses)[keyof typeof SyncStatuses]

// ── Conflict Resolution Strategies ─────────────────────────────────────────

export const ResolutionStrategies = {
  SOURCE_WINS: 'source_wins',
  CANONICAL_WINS: 'canonical_wins',
  LATEST_WINS: 'latest_wins',
  MANUAL: 'manual',
} as const

export type ResolutionStrategy =
  (typeof ResolutionStrategies)[keyof typeof ResolutionStrategies]

// ── Source Record ───────────────────────────────────────────────────────────

export interface SourceRecord {
  readonly id: string
  readonly sourceSystem: string
  readonly sourceCategory: SourceSystemCategory
  readonly sourceRecordId: string
  readonly tenantId: string
  readonly rawPayload: Record<string, unknown>
  readonly ingestedAt: string
}

// ── Canonical Record ────────────────────────────────────────────────────────

export interface CanonicalRecord {
  readonly id: string
  readonly tenantId: string
  readonly entityType: OntologyEntityType
  readonly resourceId: string
  readonly sourceSystem: string
  readonly sourceRecordId: string
  readonly mappingVersion: number
  readonly transformationLog: readonly string[]
  readonly payload: Record<string, unknown>
  readonly ingestedAt: string
  readonly mappedAt: string
}

// ── Mapping Rule ────────────────────────────────────────────────────────────

export interface MappingRule {
  readonly id: string
  readonly sourceSystem: string
  readonly sourceField: string
  readonly targetEntityType: OntologyEntityType
  readonly targetField: string
  readonly transformExpression: string
  readonly version: number
  readonly active: boolean
}

// ── Sync Job ────────────────────────────────────────────────────────────────

export interface SyncJob {
  readonly id: string
  readonly tenantId: string
  readonly sourceSystem: string
  readonly status: SyncStatus
  readonly recordsProcessed: number
  readonly recordsFailed: number
  readonly startedAt: string
  readonly completedAt?: string
  readonly errorLog?: string
}

// ── Lineage Record ──────────────────────────────────────────────────────────

export interface LineageRecord {
  readonly id: string
  readonly canonicalRecordId: string
  readonly sourceSystem: string
  readonly sourceRecordId: string
  readonly mappingVersion: number
  readonly transformationLog: readonly string[]
  readonly ingestedAt: string
}

// ── Conflict Record ─────────────────────────────────────────────────────────

export interface ConflictRecord {
  readonly id: string
  readonly tenantId: string
  readonly entityType: OntologyEntityType
  readonly resourceId: string
  readonly sourceSystemA: string
  readonly sourceSystemB: string
  readonly conflictingField: string
  readonly valueA: unknown
  readonly valueB: unknown
  readonly resolution?: ResolutionStrategy
  readonly resolvedAt?: string
  readonly resolvedBy?: string
  readonly detectedAt: string
}

// ── Source Adapter Interface ────────────────────────────────────────────────

export interface SourceAdapter {
  readonly sourceSystem: string
  readonly category: SourceSystemCategory
  fetchRecords(tenantId: string, since?: string): Promise<readonly SourceRecord[]>
}

// ── Data Fabric Store Interface ─────────────────────────────────────────────

export interface DataFabricStore {
  persistCanonical(record: CanonicalRecord): Promise<void>
  persistLineage(record: LineageRecord): Promise<void>
  persistConflict(conflict: ConflictRecord): Promise<void>
  persistSyncJob(job: SyncJob): Promise<void>
  updateSyncJob(id: string, update: Partial<SyncJob>): Promise<void>
  getLineage(entityType: OntologyEntityType, resourceId: string): Promise<readonly LineageRecord[]>
  getConflicts(tenantId: string, entityType?: OntologyEntityType): Promise<readonly ConflictRecord[]>
}

// ── Zod Schemas ─────────────────────────────────────────────────────────────

export const SourceRecordSchema = z.object({
  id: z.string().uuid(),
  sourceSystem: z.string().min(1),
  sourceCategory: z.enum(Object.values(SourceSystemCategories) as [string, ...string[]]),
  sourceRecordId: z.string().min(1),
  tenantId: z.string().uuid(),
  rawPayload: z.record(z.unknown()),
  ingestedAt: z.string().datetime(),
})

export const CanonicalRecordSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  entityType: z.string().min(1),
  resourceId: z.string().uuid(),
  sourceSystem: z.string().min(1),
  sourceRecordId: z.string().min(1),
  mappingVersion: z.number().int().positive(),
  transformationLog: z.array(z.string()),
  payload: z.record(z.unknown()),
  ingestedAt: z.string().datetime(),
  mappedAt: z.string().datetime(),
})
