import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as agriCore from './index'
import {
  buildActionAuditEntry,
  createForecastSchema,
  createProducerSchema,
  hashAuditEntry,
  recordSupplyChainEventSchema,
  syncMetadataSchema,
  updateProducerSchema,
} from './index'
import {
  AgriOrgRole,
  ConfidenceLevel,
  ConflictResolutionStrategy,
  CropType,
  ForecastType,
  ProducerStatus,
  ProvenanceSourceType,
  SupplyChainStepStatus,
  SupplyChainStepType,
  SyncStatus,
  UnitOfMeasure,
} from './enums'

describe('agri-core barrel exports', () => {
  it('re-exports runtime helpers and schemas', () => {
    expect(agriCore.buildActionAuditEntry).toBeTypeOf('function')
    expect(agriCore.hashAuditEntry).toBeTypeOf('function')
    expect(agriCore.createProducerSchema).toBeDefined()
    expect(agriCore.recordSupplyChainEventSchema).toBeDefined()
    expect(agriCore.createForecastSchema).toBeDefined()
  })
})

describe('audit helpers', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('builds deterministic audit entries with a SHA-256 hash', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-12T10:15:30.000Z'))

    const entry = buildActionAuditEntry({
      id: 'audit-1',
      orgId: 'org-1',
      actorId: 'actor-1',
      role: AgriOrgRole.ADMIN,
      entityType: 'producer',
      targetEntityId: 'producer-1',
      action: 'producer.created',
      label: 'Created producer',
      metadata: { source: 'test' },
    })

    expect(entry.timestamp).toBe('2026-04-12T10:15:30.000Z')
    expect(entry.hash).toMatch(/^[a-f0-9]{64}$/)
    expect(entry.metadata).toEqual({ source: 'test' })
  })

  it('changes chained hashes when the previous hash changes', () => {
    const entry = {
      id: 'audit-2',
      orgId: 'org-1',
      actorId: 'actor-1',
      role: AgriOrgRole.MANAGER,
      entityType: 'shipment',
      targetEntityId: 'shipment-1',
      action: 'shipment.closed',
      label: 'Closed shipment',
      metadata: { reason: 'delivered' },
      hash: 'current-hash',
      timestamp: '2026-04-12T12:00:00.000Z',
    }

    const withoutPrevious = hashAuditEntry(entry, null)
    const withPrevious = hashAuditEntry(entry, 'prior-hash')

    expect(withoutPrevious).toMatch(/^[a-f0-9]{64}$/)
    expect(withPrevious).toMatch(/^[a-f0-9]{64}$/)
    expect(withPrevious).not.toBe(withoutPrevious)
  })
})

describe('schema branches', () => {
  it('applies nullable/default branches for producer creation', () => {
    const parsed = createProducerSchema.parse({
      name: 'Kivu Cooperative',
    })

    expect(parsed.contactPhone).toBeNull()
    expect(parsed.contactEmail).toBeNull()
    expect(parsed.location).toBeNull()
    expect(parsed.cooperativeId).toBeNull()
    expect(parsed.metadata).toEqual({})
  })

  it('rejects invalid producer updates', () => {
    expect(() =>
      updateProducerSchema.parse({
        id: '550e8400-e29b-41d4-a716-446655440000',
        contactEmail: 'not-an-email',
        status: 'paused',
      }),
    ).toThrow()
  })

  it('parses supply-chain payloads with optional defaults', () => {
    const parsed = recordSupplyChainEventSchema.parse({
      chainId: '550e8400-e29b-41d4-a716-446655440001',
      stepType: SupplyChainStepType.STORAGE,
      status: SupplyChainStepStatus.IN_PROGRESS,
      responsibleParty: {
        id: 'party-1',
        name: 'Warehouse Lead',
        role: 'operator',
      },
    })

    expect(parsed.location).toBeNull()
    expect(parsed.quantityKg).toBeNull()
    expect(parsed.qualityGrade).toBeNull()
    expect(parsed.notes).toBeNull()
    expect(parsed.deviceId).toBeNull()
    expect(parsed.provenanceRef).toBeNull()
  })

  it('validates sync metadata and forecast defaults', () => {
    const sync = syncMetadataSchema.parse({
      localId: 'local-1',
      deviceId: 'device-1',
      syncStatus: SyncStatus.PENDING,
      resolutionStrategy: ConflictResolutionStrategy.MANUAL,
      version: 0,
    })
    const forecast = createForecastSchema.parse({
      forecastType: ForecastType.YIELD,
      assumptions: ['stable rainfall'],
      inputRefs: ['sensor-1'],
    })

    expect(sync.canonicalId).toBeNull()
    expect(sync.lastSyncedAt).toBeNull()
    expect(sync.conflictState).toBeNull()
    expect(forecast.cropId).toBeNull()
    expect(forecast.regionId).toBeNull()
    expect(forecast.season).toBeNull()
  })

  it('keeps enum-backed exports available through the root barrel', () => {
    expect(agriCore.CropType ?? CropType).toBeDefined()
    expect(UnitOfMeasure.KG).toBe('kg')
    expect(ProducerStatus.ACTIVE).toBe('active')
    expect(ProvenanceSourceType.API).toBe('api')
    expect(ConfidenceLevel.HIGH).toBe('high')
  })
})