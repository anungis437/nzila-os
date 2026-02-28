// ---------------------------------------------------------------------------
// @nzila/agri-traceability — Evidence Pack Builders
// ---------------------------------------------------------------------------
// Each builder produces a self-contained evidence pack following the
// @nzila/evidence sealing protocol (SHA-256 → Merkle root → HMAC seal).
// ---------------------------------------------------------------------------

import { createHash } from 'node:crypto'
import { computeMerkleRoot, generateSeal } from '@nzila/evidence'
import type {
  EvidencePack,
  EvidenceArtifact,
  SealEnvelope,
  PackIndex,
} from '@nzila/agri-core'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

function artifact(label: string, payload: unknown): EvidenceArtifact {
  const json = JSON.stringify(payload)
  return {
    label,
    sha256: sha256(json),
    mimeType: 'application/json',
    sizeBytes: Buffer.byteLength(json, 'utf8'),
  }
}

function buildPackIndex(
  packType: string,
  orgId: string,
  artifacts: EvidenceArtifact[],
  metadata: Record<string, unknown> = {},
): PackIndex {
  const merkleRoot = computeMerkleRoot(artifacts.map((a) => a.sha256))
  const index: PackIndex = {
    schemaVersion: '1.0',
    packType,
    orgId,
    createdAt: new Date().toISOString(),
    artifactCount: artifacts.length,
    merkleRoot,
    artifacts,
    ...metadata,
  }
  return index
}

function sealPack(
  index: PackIndex,
  opts: { hmacKey?: string } = {},
): EvidencePack {
  const seal = generateSeal(index as Record<string, unknown>, opts) as unknown as SealEnvelope
  return { ...index, seal }
}

// ---------------------------------------------------------------------------
// Pack #1 — Lot Certification
// ---------------------------------------------------------------------------

export interface LotCertificationInput {
  orgId: string
  lotId: string
  producers: Array<{ producerId: string; contributionKg: number }>
  qualityInspection: {
    inspectorId: string
    grade: string
    moisturePercent: number
    foreignMatterPercent: number
    inspectedAt: string
  }
  certifications: Array<{ type: string; issuedBy: string; validUntil: string }>
}

export function buildLotCertificationPack(
  input: LotCertificationInput,
  opts: { hmacKey?: string } = {},
): EvidencePack {
  const artifacts: EvidenceArtifact[] = [
    artifact('lot-summary', { lotId: input.lotId, producerCount: input.producers.length }),
    artifact('quality-inspection', input.qualityInspection),
    artifact('certifications', input.certifications),
    artifact('producer-contributions', input.producers),
  ]
  const index = buildPackIndex('lot_certification', input.orgId, artifacts, {
    lotId: input.lotId,
  })
  return sealPack(index, opts)
}

// ---------------------------------------------------------------------------
// Pack #2 — Shipment Manifest
// ---------------------------------------------------------------------------

export interface ShipmentManifestInput {
  orgId: string
  shipmentId: string
  lots: Array<{ lotId: string; weightKg: number }>
  milestones: Array<{ event: string; timestamp: string; location?: string }>
  carrier: { name: string; trackingRef: string }
}

export function buildShipmentManifestPack(
  input: ShipmentManifestInput,
  opts: { hmacKey?: string } = {},
): EvidencePack {
  const artifacts: EvidenceArtifact[] = [
    artifact('shipment-summary', {
      shipmentId: input.shipmentId,
      lotCount: input.lots.length,
      totalKg: input.lots.reduce((s, l) => s + l.weightKg, 0),
    }),
    artifact('lot-allocations', input.lots),
    artifact('milestones', input.milestones),
    artifact('carrier', input.carrier),
  ]
  const index = buildPackIndex('shipment_manifest', input.orgId, artifacts, {
    shipmentId: input.shipmentId,
  })
  return sealPack(index, opts)
}

// ---------------------------------------------------------------------------
// Pack #3 — Payment Distribution
// ---------------------------------------------------------------------------

export interface PaymentDistributionInput {
  orgId: string
  planId: string
  lotId: string
  payments: Array<{
    producerId: string
    amountCents: number
    currency: string
    method: string
  }>
  totalCents: number
}

export function buildPaymentDistributionPack(
  input: PaymentDistributionInput,
  opts: { hmacKey?: string } = {},
): EvidencePack {
  const artifacts: EvidenceArtifact[] = [
    artifact('distribution-summary', {
      planId: input.planId,
      lotId: input.lotId,
      paymentCount: input.payments.length,
      totalCents: input.totalCents,
    }),
    artifact('payment-details', input.payments),
  ]
  const index = buildPackIndex('payment_distribution', input.orgId, artifacts, {
    planId: input.planId,
    lotId: input.lotId,
  })
  return sealPack(index, opts)
}

// ---------------------------------------------------------------------------
// Pack #4 — Traceability Chain
// ---------------------------------------------------------------------------

export interface TraceabilityChainInput {
  orgId: string
  chainId: string
  entries: Array<{
    entityType: string
    subjectId: string
    action: string
    timestamp: string
    hash: string
  }>
}

export function buildTraceabilityChainPack(
  input: TraceabilityChainInput,
  opts: { hmacKey?: string } = {},
): EvidencePack {
  const artifacts: EvidenceArtifact[] = [
    artifact('chain-summary', {
      chainId: input.chainId,
      entryCount: input.entries.length,
    }),
    artifact('chain-entries', input.entries),
  ]
  const index = buildPackIndex('traceability_chain', input.orgId, artifacts, {
    chainId: input.chainId,
  })
  return sealPack(index, opts)
}
