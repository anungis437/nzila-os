/**
 * Trade Evidence Packs
 *
 * Builds sealed evidence packs for terminal deal stages.
 * Three pack types as specified:
 *   - quote_acceptance_pack (when quote is accepted)
 *   - shipment_docs_pack (when shipment is delivered)
 *   - commission_settlement_pack (when commission is finalized)
 *
 * Uses @nzila/evidence for Merkle root computation and seal generation.
 */

import { createHash } from 'node:crypto'
import { computeMerkleRoot, generateSeal } from '@nzila/evidence'
import { TradeEvidenceType } from '@nzila/trade-core'
import type { TradeAuditEntry, TradeDeal, TradeQuote, TradeShipment, TradeCommission, TradeDocument } from '@nzila/trade-core'

// ── Types ───────────────────────────────────────────────────────────────────

interface EvidenceArtifact {
  name: string
  sha256: string
  data: Record<string, unknown>
}

interface EvidencePackResult {
  evidenceType: string
  packDigest: string
  artifactsMerkleRoot: string
  sealEnvelope: Record<string, unknown>
  artifacts: EvidenceArtifact[]
  metadata: Record<string, unknown>
}

// ── Shared helper ───────────────────────────────────────────────────────────

function hashData(data: Record<string, unknown>): string {
  const canonical = JSON.stringify(data, Object.keys(data).sort())
  return createHash('sha256').update(canonical).digest('hex')
}

function buildPackIndex(
  evidenceType: string,
  entityId: string,
  dealId: string,
  artifacts: EvidenceArtifact[],
  metadata: Record<string, unknown>,
) {
  return {
    evidenceType,
    entityId,
    dealId,
    artifacts: artifacts.map((a) => ({
      name: a.name,
      sha256: a.sha256,
    })),
    metadata,
    createdAt: new Date().toISOString(),
  }
}

// ── Quote Acceptance Pack ───────────────────────────────────────────────────

export function buildQuoteAcceptancePack(
  deal: TradeDeal,
  quote: TradeQuote,
  auditEntries: TradeAuditEntry[],
  hmacKey?: string,
): EvidencePackResult {
  const artifacts: EvidenceArtifact[] = [
    {
      name: 'deal_snapshot',
      sha256: hashData(deal as unknown as Record<string, unknown>),
      data: deal as unknown as Record<string, unknown>,
    },
    {
      name: 'quote_snapshot',
      sha256: hashData(quote as unknown as Record<string, unknown>),
      data: quote as unknown as Record<string, unknown>,
    },
    {
      name: 'audit_trail',
      sha256: hashData({ entries: auditEntries }),
      data: { entries: auditEntries },
    },
  ]

  const hashes = artifacts.map((a) => a.sha256)
  const merkleRoot = computeMerkleRoot(hashes) as string

  const packIndex = buildPackIndex(
    TradeEvidenceType.QUOTE_ACCEPTANCE,
    deal.entityId,
    deal.id,
    artifacts,
    {
      quoteId: quote.id,
      acceptedAt: quote.acceptedAt?.toISOString(),
      totalValue: quote.total,
      currency: quote.currency,
    },
  )

  const sealEnvelope = generateSeal(packIndex, { hmacKey }) as Record<string, unknown>

  return {
    evidenceType: TradeEvidenceType.QUOTE_ACCEPTANCE,
    packDigest: (sealEnvelope as { packDigest?: string }).packDigest ?? hashData(packIndex),
    artifactsMerkleRoot: merkleRoot,
    sealEnvelope,
    artifacts,
    metadata: packIndex.metadata,
  }
}

// ── Shipment Docs Pack ──────────────────────────────────────────────────────

export function buildShipmentDocsPack(
  deal: TradeDeal,
  shipment: TradeShipment,
  documents: TradeDocument[],
  auditEntries: TradeAuditEntry[],
  hmacKey?: string,
): EvidencePackResult {
  const artifacts: EvidenceArtifact[] = [
    {
      name: 'deal_snapshot',
      sha256: hashData(deal as unknown as Record<string, unknown>),
      data: deal as unknown as Record<string, unknown>,
    },
    {
      name: 'shipment_snapshot',
      sha256: hashData(shipment as unknown as Record<string, unknown>),
      data: shipment as unknown as Record<string, unknown>,
    },
    ...documents.map((doc) => ({
      name: `document_${doc.docType}`,
      sha256: doc.contentHash,
      data: doc as unknown as Record<string, unknown>,
    })),
    {
      name: 'audit_trail',
      sha256: hashData({ entries: auditEntries }),
      data: { entries: auditEntries },
    },
  ]

  const hashes = artifacts.map((a) => a.sha256)
  const merkleRoot = computeMerkleRoot(hashes) as string

  const packIndex = buildPackIndex(
    TradeEvidenceType.SHIPMENT_DOCS,
    deal.entityId,
    deal.id,
    artifacts,
    {
      shipmentId: shipment.id,
      deliveredAt: shipment.actualArrival?.toISOString(),
      documentCount: documents.length,
    },
  )

  const sealEnvelope = generateSeal(packIndex, { hmacKey }) as Record<string, unknown>

  return {
    evidenceType: TradeEvidenceType.SHIPMENT_DOCS,
    packDigest: (sealEnvelope as { packDigest?: string }).packDigest ?? hashData(packIndex),
    artifactsMerkleRoot: merkleRoot,
    sealEnvelope,
    artifacts,
    metadata: packIndex.metadata,
  }
}

// ── Commission Settlement Pack ──────────────────────────────────────────────

export function buildCommissionSettlementPack(
  deal: TradeDeal,
  commission: TradeCommission,
  auditEntries: TradeAuditEntry[],
  hmacKey?: string,
): EvidencePackResult {
  const artifacts: EvidenceArtifact[] = [
    {
      name: 'deal_snapshot',
      sha256: hashData(deal as unknown as Record<string, unknown>),
      data: deal as unknown as Record<string, unknown>,
    },
    {
      name: 'commission_snapshot',
      sha256: hashData(commission as unknown as Record<string, unknown>),
      data: commission as unknown as Record<string, unknown>,
    },
    {
      name: 'audit_trail',
      sha256: hashData({ entries: auditEntries }),
      data: { entries: auditEntries },
    },
  ]

  const hashes = artifacts.map((a) => a.sha256)
  const merkleRoot = computeMerkleRoot(hashes) as string

  const packIndex = buildPackIndex(
    TradeEvidenceType.COMMISSION_SETTLEMENT,
    deal.entityId,
    deal.id,
    artifacts,
    {
      commissionId: commission.id,
      partyId: commission.partyId,
      calculatedAmount: commission.calculatedAmount,
      currency: commission.currency,
      finalizedAt: commission.finalizedAt?.toISOString(),
    },
  )

  const sealEnvelope = generateSeal(packIndex, { hmacKey }) as Record<string, unknown>

  return {
    evidenceType: TradeEvidenceType.COMMISSION_SETTLEMENT,
    packDigest: (sealEnvelope as { packDigest?: string }).packDigest ?? hashData(packIndex),
    artifactsMerkleRoot: merkleRoot,
    sealEnvelope,
    artifacts,
    metadata: packIndex.metadata,
  }
}

// ── Org export ──────────────────────────────────────────────────────────────

export interface OrgTradeExport {
  exportedAt: string
  entityId: string
  packs: EvidencePackResult[]
  totalPacks: number
}

export function buildOrgTradeExport(
  entityId: string,
  packs: EvidencePackResult[],
): OrgTradeExport {
  return {
    exportedAt: new Date().toISOString(),
    entityId,
    packs,
    totalPacks: packs.length,
  }
}
