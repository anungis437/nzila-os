import { describe, it, expect } from 'vitest'
import {
  buildLotCertificationPack,
  buildShipmentManifestPack,
  buildPaymentDistributionPack,
  buildTraceabilityChainPack,
} from './packs'
import { buildTraceabilityChain, verifyTraceabilityChain } from './chain'
import { verifySeal } from '@nzila/evidence'

const HMAC_KEY = 'test-seal-key-32bytes-minimum!!'

// ---------------------------------------------------------------------------
// Evidence packs
// ---------------------------------------------------------------------------
describe('lot certification pack', () => {
  it('builds and seals a valid pack', () => {
    const pack = buildLotCertificationPack(
      {
        orgId: 'org_1',
        lotId: 'lot_1',
        producers: [{ producerId: 'p1', contributionKg: 500 }],
        qualityInspection: {
          inspectorId: 'insp_1',
          grade: 'A',
          moisturePercent: 12,
          foreignMatterPercent: 0.5,
          inspectedAt: '2025-01-15T10:00:00Z',
        },
        certifications: [
          { type: 'organic', issuedBy: 'certBody1', validUntil: '2026-01-15' },
        ],
      },
      { hmacKey: HMAC_KEY },
    )

    expect(pack.seal).toBeDefined()
    expect(pack.artifacts).toHaveLength(4)
    expect(pack.packType).toBe('lot_certification')

    const result = verifySeal(pack as Record<string, unknown>, { hmacKey: HMAC_KEY })
    expect(result.valid).toBe(true)
    expect(result.digestMatch).toBe(true)
    expect(result.signatureVerified).toBe(true)
  })
})

describe('shipment manifest pack', () => {
  it('builds and seals a valid pack', () => {
    const pack = buildShipmentManifestPack(
      {
        orgId: 'org_1',
        shipmentId: 'ship_1',
        lots: [{ lotId: 'lot_1', weightKg: 1000 }],
        milestones: [
          { event: 'packed', timestamp: '2025-01-16T08:00:00Z', location: 'Warehouse A' },
        ],
        carrier: { name: 'TransCo', trackingRef: 'TC-12345' },
      },
      { hmacKey: HMAC_KEY },
    )

    expect(pack.seal).toBeDefined()
    expect(pack.artifacts).toHaveLength(4)

    const result = verifySeal(pack as Record<string, unknown>, { hmacKey: HMAC_KEY })
    expect(result.valid).toBe(true)
  })
})

describe('payment distribution pack', () => {
  it('builds and seals a valid pack', () => {
    const pack = buildPaymentDistributionPack(
      {
        orgId: 'org_1',
        planId: 'plan_1',
        lotId: 'lot_1',
        payments: [
          { producerId: 'p1', amountCents: 50000, currency: 'USD', method: 'mobile_money' },
        ],
        totalCents: 50000,
      },
      { hmacKey: HMAC_KEY },
    )

    expect(pack.seal).toBeDefined()
    expect(pack.artifacts).toHaveLength(2)

    const result = verifySeal(pack as Record<string, unknown>, { hmacKey: HMAC_KEY })
    expect(result.valid).toBe(true)
  })
})

describe('traceability chain pack', () => {
  it('builds and seals a valid pack', () => {
    const pack = buildTraceabilityChainPack(
      {
        orgId: 'org_1',
        chainId: 'chain_1',
        entries: [
          {
            entityType: 'harvest',
            subjectId: 'h1',
            action: 'created',
            timestamp: '2025-01-10T06:00:00Z',
            hash: 'abc123',
          },
        ],
      },
      { hmacKey: HMAC_KEY },
    )

    expect(pack.seal).toBeDefined()
    expect(pack.artifacts).toHaveLength(2)

    const result = verifySeal(pack as Record<string, unknown>, { hmacKey: HMAC_KEY })
    expect(result.valid).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Hash chain
// ---------------------------------------------------------------------------
describe('traceability chain builder', () => {
  it('builds a valid hash chain', () => {
    const chain = buildTraceabilityChain('org_1', [
      { entityType: 'harvest', subjectId: 'h1', action: 'created', timestamp: '2025-01-10T06:00:00Z' },
      { entityType: 'lot', subjectId: 'l1', action: 'aggregated', timestamp: '2025-01-11T09:00:00Z' },
      { entityType: 'shipment', subjectId: 's1', action: 'dispatched', timestamp: '2025-01-12T14:00:00Z' },
    ])

    expect(chain.entryCount).toBe(3)
    expect(chain.entries).toHaveLength(3)
    // Each entry's previousHash links to prior entry's hash
    expect(chain.entries[1]!.previousHash).toBe(chain.entries[0]!.hash)
    expect(chain.entries[2]!.previousHash).toBe(chain.entries[1]!.hash)
  })

  it('verifies a valid chain', () => {
    const chain = buildTraceabilityChain('org_1', [
      { entityType: 'harvest', subjectId: 'h1', action: 'created', timestamp: '2025-01-10T06:00:00Z' },
      { entityType: 'lot', subjectId: 'l1', action: 'aggregated', timestamp: '2025-01-11T09:00:00Z' },
    ])
    expect(verifyTraceabilityChain(chain)).toBe(true)
  })

  it('detects tampered chain', () => {
    const chain = buildTraceabilityChain('org_1', [
      { entityType: 'harvest', subjectId: 'h1', action: 'created', timestamp: '2025-01-10T06:00:00Z' },
      { entityType: 'lot', subjectId: 'l1', action: 'aggregated', timestamp: '2025-01-11T09:00:00Z' },
    ])
    // Tamper with an entry
    chain.entries[0]!.hash = 'tampered'
    expect(verifyTraceabilityChain(chain)).toBe(false)
  })

  it('handles empty chain', () => {
    const chain = buildTraceabilityChain('org_1', [])
    expect(chain.entryCount).toBe(0)
    expect(verifyTraceabilityChain(chain)).toBe(true)
  })
})
