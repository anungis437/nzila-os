# Agri Stack — Evidence and Traceability

## Evidence Pack Architecture

Evidence packs are sealed, immutable records of material actions. They provide procurement-grade trust for certification, compliance, and auditability.

### When Evidence Packs Are Generated

| Trigger | Pack Type | Contents |
|---------|-----------|----------|
| Lot certified | `lot_certification_pack` | Lot snapshot, contributions, inspection results, grade, certification artifact |
| Shipment docs finalized | `shipment_manifest_pack` | Shipment snapshot, batch allocations, milestones, document references |
| Payment plan executed | `payment_distribution_pack` | Payment plan, individual payments, producer references |
| Traceability chain requested | `traceability_chain_pack` | Full chain: lot → batch → shipment with all linked records |

### Pack Structure

```typescript
interface EvidencePack {
  packId: string              // UUID
  packType: AgriEvidenceType
  orgId: string
  generatedAt: string         // ISO 8601
  generatedBy: string         // actor ID

  artifacts: EvidenceArtifact[]
  merkleRoot: string          // SHA-256 Merkle root of all artifacts
  seal: SealEnvelope          // HMAC seal for tamper detection

  index: PackIndex            // summary of contents
}

interface EvidenceArtifact {
  name: string                // e.g., "lot_snapshot", "inspection_results"
  contentHash: string         // SHA-256 of serialized content
  content: unknown            // serialized data
  timestamp: string
}

interface SealEnvelope {
  algorithm: 'sha256-hmac'
  merkleRoot: string
  signature: string           // HMAC of merkle root
  sealedAt: string
}
```

### Verification Process

1. Recompute content hash for each artifact
2. Rebuild Merkle tree from artifact hashes
3. Compare computed Merkle root with stored root
4. Verify HMAC seal signature
5. If any step fails → pack has been tampered with

## Traceability Chain

The traceability chain links every unit of product from producer to buyer:

```
Producer (who grew it)
  → Harvest (when + where it was collected)
    → Lot (how it was aggregated)
      → Quality Inspection (what grade it received)
        → Certification (what standards it meets)
          → Batch (warehouse inventory)
            → Shipment (how it was transported)
              → Payment (how the producer was paid)
```

Each link is recorded in `agri_traceability_links` with:

- Source type + ID
- Target type + ID
- Link metadata (timestamps, actors, conditions)

## Org Export

On-demand export of all agri data for an org:

```typescript
interface OrgAgriExport {
  exportedAt: string
  orgId: string

  // CSV tables
  producers: CSVExport
  harvests: CSVExport
  lots: CSVExport
  inspections: CSVExport
  batches: CSVExport
  shipments: CSVExport
  payments: CSVExport
  certifications: CSVExport

  // Audit events filtered to agri domain
  auditEvents: AuditEvent[]

  // Evidence pack index
  evidencePacks: PackIndex[]
}
```

## Certification Artifacts

Certification artifacts are content-hashed documents stored in blob storage:

1. Document uploaded or generated
2. SHA-256 hash computed
3. Hash stored in `agri_certifications.content_hash`
4. Document stored in Azure Blob with `agri_certifications.storage_key`
5. Evidence pack includes hash + metadata (not the document itself)

This allows verification without accessing the original document.
