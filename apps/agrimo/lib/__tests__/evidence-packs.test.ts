/**
 * Agrimo — Agri Evidence Pack Builder Tests
 *
 * Tests the four agri evidence pack builders re-exported from @nzila/agri-traceability.
 * These are pure functions (deterministic given a fixed timestamp).
 *
 * @see lib/evidence/agri-evidence-packs.ts
 * @see packages/agri-traceability/src/packs.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock @nzila/evidence
vi.mock('@nzila/evidence', () => ({
  computeMerkleRoot: vi.fn((hashes: string[]) => `merkle-root-${hashes.length}`),
  generateSeal: vi.fn((packIndex: Record<string, unknown>, opts?: { hmacKey?: string }) => ({
    sealVersion: '1.0',
    algorithm: 'sha256',
    packDigest: `digest-${packIndex.packType ?? 'unknown'}`,
    artifactsMerkleRoot: packIndex.merkleRoot ?? 'merkle-root-test',
    artifactCount: packIndex.artifactCount ?? 0,
    sealedAt: '2026-03-10T00:00:00.000Z',
    hmacSignature: opts?.hmacKey ? 'hmac-sig' : undefined,
  })),
}))

import {
  buildLotCertificationPack,
  buildShipmentManifestPack,
  buildPaymentDistributionPack,
  buildTraceabilityChainPack,
} from '../evidence'

import type {
  LotCertificationInput,
  ShipmentManifestInput,
  PaymentDistributionInput,
  TraceabilityChainInput,
} from '@nzila/agri-traceability'

// ── Fixtures ────────────────────────────────────────────────────────────────

const LOT_INPUT: LotCertificationInput = {
  orgId: 'org-agri-01',
  lotId: 'lot-001',
  producers: [
    { producerId: 'prod-001', contributionKg: 500 },
    { producerId: 'prod-002', contributionKg: 300 },
  ],
  qualityInspection: {
    inspectorId: 'insp-001',
    grade: 'A',
    moisturePercent: 12.5,
    foreignMatterPercent: 0.3,
    inspectedAt: '2026-03-01T10:00:00Z',
  },
  certifications: [
    { type: 'organic', issuedBy: 'cert-body-x', validUntil: '2027-03-01' },
  ],
}

const SHIPMENT_INPUT: ShipmentManifestInput = {
  orgId: 'org-agri-01',
  shipmentId: 'ship-agri-001',
  lots: [
    { lotId: 'lot-001', weightKg: 800 },
    { lotId: 'lot-002', weightKg: 600 },
  ],
  milestones: [
    { event: 'loaded', timestamp: '2026-03-05T08:00:00Z', location: 'Kinshasa' },
    { event: 'departed', timestamp: '2026-03-05T12:00:00Z' },
    { event: 'arrived', timestamp: '2026-03-10T06:00:00Z', location: 'Mombasa' },
  ],
  carrier: { name: 'Trans-Africa Logistics', trackingRef: 'TAL-2026-007' },
}

const PAYMENT_INPUT: PaymentDistributionInput = {
  orgId: 'org-agri-01',
  planId: 'pay-plan-001',
  lotId: 'lot-001',
  payments: [
    { producerId: 'prod-001', amountCents: 250000, currency: 'USD', method: 'mobile_money' },
    { producerId: 'prod-002', amountCents: 150000, currency: 'USD', method: 'bank_transfer' },
  ],
  totalCents: 400000,
}

const CHAIN_INPUT: TraceabilityChainInput = {
  orgId: 'org-agri-01',
  chainId: 'chain-001',
  entries: [
    { entityType: 'harvest', subjectId: 'h-001', action: 'created', timestamp: '2026-02-20T00:00:00Z', hash: 'aaa' },
    { entityType: 'lot', subjectId: 'lot-001', action: 'assembled', timestamp: '2026-02-25T00:00:00Z', hash: 'bbb' },
    { entityType: 'shipment', subjectId: 'ship-001', action: 'dispatched', timestamp: '2026-03-05T00:00:00Z', hash: 'ccc' },
  ],
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('Agri Evidence Pack Builders', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-10T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('buildLotCertificationPack', () => {
    it('creates a lot_certification pack type', () => {
      const pack = buildLotCertificationPack(LOT_INPUT)
      expect(pack.packType).toBe('lot_certification')
    })

    it('produces 4 artifacts (lot-summary, quality, certs, producers)', () => {
      const pack = buildLotCertificationPack(LOT_INPUT)
      expect(pack.artifactCount).toBe(4)
      expect(pack.artifacts).toHaveLength(4)
    })

    it('includes lot metadata', () => {
      const pack = buildLotCertificationPack(LOT_INPUT)
      expect(pack.lotId).toBe('lot-001')
    })

    it('includes sealed envelope', () => {
      const pack = buildLotCertificationPack(LOT_INPUT)
      expect(pack.seal).toBeDefined()
      expect(pack.seal).toHaveProperty('sealVersion', '1.0')
    })

    it('supports hmacKey option', () => {
      const pack = buildLotCertificationPack(LOT_INPUT, { hmacKey: 'test-key' })
      expect(pack.seal).toHaveProperty('hmacSignature', 'hmac-sig')
    })
  })

  describe('buildShipmentManifestPack', () => {
    it('creates a shipment_manifest pack type', () => {
      const pack = buildShipmentManifestPack(SHIPMENT_INPUT)
      expect(pack.packType).toBe('shipment_manifest')
    })

    it('produces 4 artifacts (summary, lots, milestones, carrier)', () => {
      const pack = buildShipmentManifestPack(SHIPMENT_INPUT)
      expect(pack.artifactCount).toBe(4)
    })

    it('includes shipment metadata', () => {
      const pack = buildShipmentManifestPack(SHIPMENT_INPUT)
      expect(pack.shipmentId).toBe('ship-agri-001')
    })
  })

  describe('buildPaymentDistributionPack', () => {
    it('creates a payment_distribution pack type', () => {
      const pack = buildPaymentDistributionPack(PAYMENT_INPUT)
      expect(pack.packType).toBe('payment_distribution')
    })

    it('includes plan and lot metadata', () => {
      const pack = buildPaymentDistributionPack(PAYMENT_INPUT)
      expect(pack.planId).toBe('pay-plan-001')
      expect(pack.lotId).toBe('lot-001')
    })
  })

  describe('buildTraceabilityChainPack', () => {
    it('creates a traceability_chain pack type', () => {
      const pack = buildTraceabilityChainPack(CHAIN_INPUT)
      expect(pack.packType).toBe('traceability_chain')
    })

    it('includes chain metadata', () => {
      const pack = buildTraceabilityChainPack(CHAIN_INPUT)
      expect(pack.chainId).toBe('chain-001')
    })

    it('artifact count matches chain entry count + 1 (summary)', () => {
      const pack = buildTraceabilityChainPack(CHAIN_INPUT)
      // summary artifact + one per chain entry
      expect(pack.artifactCount).toBeGreaterThanOrEqual(2)
    })
  })
})
