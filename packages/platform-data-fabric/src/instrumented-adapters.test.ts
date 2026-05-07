import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  instrumentedMapSourceRecord,
  instrumentedReconcile,
} from '../src/instrumented-adapters'
import { createInMemoryDataFabricStore } from '../src/memory-store'
import type { SourceRecord } from '../src/types'

// ── Helpers ─────────────────────────────────────────────────────────────────

function createTestSourceRecord(overrides: Partial<SourceRecord> = {}): SourceRecord {
  return {
    id: 'src-1',
    tenantId: 'tenant-1',
    sourceSystem: 'quickbooks',
    sourceCategory: 'erp',
    sourceRecordId: 'qb-inv-42',
    rawPayload: { amount: 1000, currency: 'USD' },
    ingestedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('instrumentedMapSourceRecord', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('maps a source record to canonical with telemetry', () => {
    const source = createTestSourceRecord()

    const canonical = instrumentedMapSourceRecord({
      sourceRecord: source,
      targetEntityType: 'Policy',
      resourceId: 'entity-1',
      mappingVersion: 1,
      transformFn: (raw) => ({ normalized_amount: raw.amount }),
    })

    expect(canonical.entityType).toBe('Policy')
    expect(canonical.resourceId).toBe('entity-1')
    expect(canonical.sourceSystem).toBe('quickbooks')
    expect(canonical.payload).toEqual({ normalized_amount: 1000 })
    expect(canonical.mappingVersion).toBe(1)
  })

  it('includes source record ID in canonical', () => {
    const source = createTestSourceRecord({ sourceRecordId: 'custom-id-99' })

    const canonical = instrumentedMapSourceRecord({
      sourceRecord: source,
      targetEntityType: 'Policy',
      resourceId: 'entity-2',
      mappingVersion: 2,
      transformFn: (raw) => raw,
    })

    expect(canonical.sourceRecordId).toBe('custom-id-99')
  })
})

describe('instrumentedReconcile', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('persists a canonical record with telemetry', async () => {
    const store = createInMemoryDataFabricStore()
    const source = createTestSourceRecord()

    const canonical = instrumentedMapSourceRecord({
      sourceRecord: source,
      targetEntityType: 'Policy',
      resourceId: 'entity-1',
      mappingVersion: 1,
      transformFn: (raw) => raw,
    })

    const result = await instrumentedReconcile(store, canonical)

    expect(result.persisted).toBe(true)
    expect(result.conflicts).toHaveLength(0)
  })

  it('detects conflicts from different source systems', async () => {
    const store = createInMemoryDataFabricStore()

    // First ingestion from quickbooks
    const source1 = createTestSourceRecord({ sourceSystem: 'quickbooks', sourceRecordId: 'qb-1' })
    const canonical1 = instrumentedMapSourceRecord({
      sourceRecord: source1,
      targetEntityType: 'Policy',
      resourceId: 'entity-1',
      mappingVersion: 1,
      transformFn: (raw) => raw,
    })
    await instrumentedReconcile(store, canonical1)

    // Second ingestion from xero — same entity
    const source2 = createTestSourceRecord({ sourceSystem: 'xero', sourceRecordId: 'xero-1' })
    const canonical2 = instrumentedMapSourceRecord({
      sourceRecord: source2,
      targetEntityType: 'Policy',
      resourceId: 'entity-1',
      mappingVersion: 1,
      transformFn: (raw) => raw,
    })
    const result2 = await instrumentedReconcile(store, canonical2)

    expect(result2.persisted).toBe(true)
    expect(result2.conflicts.length).toBeGreaterThanOrEqual(1)
    expect(result2.conflicts[0].sourceSystemA).toBe('quickbooks')
    expect(result2.conflicts[0].sourceSystemB).toBe('xero')
  })

  it('works with empty store', async () => {
    const store = createInMemoryDataFabricStore()
    const source = createTestSourceRecord()

    const canonical = instrumentedMapSourceRecord({
      sourceRecord: source,
      targetEntityType: 'Policy',
      resourceId: 'new-entity',
      mappingVersion: 1,
      transformFn: (raw) => raw,
    })

    const result = await instrumentedReconcile(store, canonical)
    expect(result.persisted).toBe(true)
    expect(result.conflicts).toHaveLength(0)
  })
})
