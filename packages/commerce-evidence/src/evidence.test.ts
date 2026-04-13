import { describe, it, expect, beforeEach } from 'vitest'
import { EvidenceType, OrgRole } from '@nzila/commerce-core/enums'
import { AuditAction, CommerceEntityType, buildActionAuditEntry as _buildActionAuditEntry, type AuditEntry } from '@nzila/commerce-audit'
import {
  generateCommercePackId,
  resetPackCounter,
  buildArtifact,
  buildCommerceEvidencePack,
  validateCommerceEvidencePack,
  toSealableIndex,
  COMMERCE_CONTROL_MAPPINGS,
  type BuildCommercePackContext,
  type CommerceArtifact,
} from './evidence'
import * as commerceEvidenceBarrel from './index'

// ── Fixtures ────────────────────────────────────────────────────────────────

const ORG_ID = 'org-001'
const TIMESTAMP = '2026-01-15T10:00:00.000Z'

function makeArtifact(overrides?: Partial<CommerceArtifact>): CommerceArtifact {
  return {
    artifactId: 'art-001',
    evidenceType: EvidenceType.QUOTE_PDF,
    filename: 'quote-Q2026001.pdf',
    contentType: 'application/pdf',
    sha256: 'abc123def456abc123def456abc123def456abc123def456abc123def456abcd',
    sizeBytes: 1024,
    description: 'Quote PDF',
    ...overrides,
  }
}

function makeAuditEntry(overrides?: Partial<AuditEntry>): AuditEntry {
  return {
    id: 'audit-001',
    orgId: ORG_ID,
    actorId: 'actor-001',
    role: OrgRole.SALES,
    entityType: CommerceEntityType.QUOTE,
    targetEntityId: 'quote-001',
    action: AuditAction.STATE_TRANSITION,
    fromState: 'draft',
    toState: 'pricing',
    label: 'Submit for pricing',
    metadata: {},
    eventsEmitted: ['quote.pricing'],
    actionsScheduled: [],
    timestamp: TIMESTAMP,
    ...overrides,
  } as AuditEntry
}

function makePackCtx(overrides?: Partial<BuildCommercePackContext>): BuildCommercePackContext {
  return {
    orgId: ORG_ID,
    commerceEntityType: 'quote',
    commerceEntityId: 'quote-001',
    createdBy: 'actor-001',
    timestamp: TIMESTAMP,
    ...overrides,
  }
}

// ── generateCommercePackId ──────────────────────────────────────────────────

describe('generateCommercePackId', () => {
  beforeEach(() => resetPackCounter())

  it('should generate sequential pack IDs', () => {
    const id1 = generateCommercePackId('quote', 'q-001', TIMESTAMP)
    const id2 = generateCommercePackId('order', 'o-001', TIMESTAMP)

    expect(id1).toBe('COM-QUOTE-20260115-0001')
    expect(id2).toBe('COM-ORDER-20260115-0002')
  })

  it('should uppercase entity type', () => {
    const id = generateCommercePackId('invoice', 'inv-001', TIMESTAMP)
    expect(id).toContain('INVOICE')
  })

  it('should generate an ID when timestamp is omitted', () => {
    const id = generateCommercePackId('quote', 'q-001')
    expect(id).toMatch(/^COM-QUOTE-\d{8}-\d{4}$/)
  })
})

// ── buildArtifact ───────────────────────────────────────────────────────────

describe('buildArtifact', () => {
  it('should construct artifact descriptor', () => {
    const artifact = buildArtifact(EvidenceType.QUOTE_PDF, {
      artifactId: 'art-001',
      filename: 'quote.pdf',
      contentType: 'application/pdf',
      sha256: 'abcdef1234567890',
      sizeBytes: 2048,
      description: 'Quote document',
    })

    expect(artifact.evidenceType).toBe(EvidenceType.QUOTE_PDF)
    expect(artifact.artifactId).toBe('art-001')
    expect(artifact.filename).toBe('quote.pdf')
    expect(artifact.sha256).toBe('abcdef1234567890')
    expect(artifact.sizeBytes).toBe(2048)
    expect(artifact.description).toBe('Quote document')
  })

  it('should use default description', () => {
    const artifact = buildArtifact(EvidenceType.DELIVERY_PROOF, {
      artifactId: 'art-002',
      filename: 'delivery.jpg',
      contentType: 'image/jpeg',
      sha256: 'hash123',
      sizeBytes: 512,
    })

    expect(artifact.description).toBe('delivery_proof artifact')
  })
})

// ── buildCommerceEvidencePack ────────────────────────────────────────────────

describe('buildCommerceEvidencePack', () => {
  beforeEach(() => resetPackCounter())

  it('should build pack with artifacts and audit trail', () => {
    const artifacts = [makeArtifact()]
    const auditEntries = [makeAuditEntry()]
    const pack = buildCommerceEvidencePack(makePackCtx(), artifacts, auditEntries)

    expect(pack.orgId).toBe(ORG_ID)
    expect(pack.commerceEntityType).toBe('quote')
    expect(pack.commerceEntityId).toBe('quote-001')
    expect(pack.createdBy).toBe('actor-001')
    expect(pack.artifacts).toHaveLength(1)
    expect(pack.auditTrailEntries).toHaveLength(1)
    expect(pack.createdAt).toBe(TIMESTAMP)
  })

  it('should use control mapping for quote', () => {
    const pack = buildCommerceEvidencePack(makePackCtx(), [makeArtifact()], [])

    expect(pack.controlFamily).toBe('change-mgmt')
    expect(pack.retentionClass).toBe('7_YEARS')
    expect(pack.controlsCovered).toContain('COM-01')
  })

  it('should use control mapping for invoice', () => {
    const pack = buildCommerceEvidencePack(
      makePackCtx({ commerceEntityType: 'invoice' }),
      [makeArtifact()],
      [],
    )

    expect(pack.controlFamily).toBe('integrity')
    expect(pack.controlsCovered).toContain('COM-05')
  })

  it('should use fallback for unknown entity type', () => {
    const pack = buildCommerceEvidencePack(
      makePackCtx({ commerceEntityType: 'unknown' }),
      [makeArtifact()],
      [],
    )

    expect(pack.controlFamily).toBe('integrity')
    expect(pack.retentionClass).toBe('7_YEARS')
  })

  it('should accept custom pack ID', () => {
    const pack = buildCommerceEvidencePack(
      makePackCtx({ packId: 'CUSTOM-001' }),
      [makeArtifact()],
      [],
    )

    expect(pack.packId).toBe('CUSTOM-001')
  })

  it('should auto-generate pack ID when not provided', () => {
    const pack = buildCommerceEvidencePack(makePackCtx(), [makeArtifact()], [])
    expect(pack.packId).toMatch(/^COM-QUOTE-/)
  })
})

// ── validateCommerceEvidencePack ─────────────────────────────────────────────

describe('validateCommerceEvidencePack', () => {
  beforeEach(() => resetPackCounter())

  it('should return empty for valid pack', () => {
    const pack = buildCommerceEvidencePack(makePackCtx(), [makeArtifact()], [makeAuditEntry()])
    const errors = validateCommerceEvidencePack(pack)
    expect(errors).toEqual([])
  })

  it('should detect missing artifacts', () => {
    const pack = buildCommerceEvidencePack(makePackCtx(), [], [])
    const errors = validateCommerceEvidencePack(pack)
    expect(errors).toContain('At least one artifact is required')
  })

  it('should detect org mismatch in audit entries', () => {
    const badEntry = makeAuditEntry({ orgId: 'other-org' })
    const pack = buildCommerceEvidencePack(makePackCtx(), [makeArtifact()], [badEntry])
    const errors = validateCommerceEvidencePack(pack)
    expect(errors.some(e => e.includes('org'))).toBe(true)
  })

  it('should detect invalid artifact hash', () => {
    const badArtifact = makeArtifact({ sha256: '' })
    const pack = buildCommerceEvidencePack(makePackCtx(), [badArtifact], [])
    const errors = validateCommerceEvidencePack(pack)
    expect(errors.some(e => e.includes('sha256'))).toBe(true)
  })

  it('should detect invalid artifact size', () => {
    const badArtifact = makeArtifact({ sizeBytes: 0 })
    const pack = buildCommerceEvidencePack(makePackCtx(), [badArtifact], [])
    const errors = validateCommerceEvidencePack(pack)
    expect(errors.some(e => e.includes('size'))).toBe(true)
  })

  it('should detect missing required top-level fields', () => {
    const pack = buildCommerceEvidencePack(
      makePackCtx({ packId: '', orgId: '', commerceEntityType: '', commerceEntityId: '', createdBy: '' }),
      [makeArtifact()],
      [],
    )
    const errors = validateCommerceEvidencePack(pack)

    expect(errors).toContain('packId is required')
    expect(errors).toContain('orgId is required (org scope)')
    expect(errors).toContain('commerceEntityType is required')
    expect(errors).toContain('commerceEntityId is required')
    expect(errors).toContain('createdBy is required')
  })
})

// ── toSealableIndex ─────────────────────────────────────────────────────────

describe('toSealableIndex', () => {
  beforeEach(() => resetPackCounter())

  it('should produce sealable index shape', () => {
    const pack = buildCommerceEvidencePack(makePackCtx(), [makeArtifact()], [])
    const index = toSealableIndex(pack)

    expect(index.packId).toBe(pack.packId)
    expect(index.orgId).toBe(ORG_ID)
    expect(index.artifacts).toHaveLength(1)
    expect(index.artifacts[0]).toHaveProperty('sha256')
    expect(index.artifacts[0]).toHaveProperty('artifactId')
    expect(index.artifacts[0]).toHaveProperty('filename')
    expect(index.artifacts[0]).toHaveProperty('contentType')
  })

  it('should strip evidence-specific fields from artifact', () => {
    const pack = buildCommerceEvidencePack(makePackCtx(), [makeArtifact()], [])
    const index = toSealableIndex(pack)

    // Should NOT have evidenceType or sizeBytes (those are commerce-specific)
    const artifact = index.artifacts[0] as Record<string, unknown>
    expect(artifact).not.toHaveProperty('evidenceType')
    expect(artifact).not.toHaveProperty('sizeBytes')
  })
})

// ── COMMERCE_CONTROL_MAPPINGS ───────────────────────────────────────────────

describe('COMMERCE_CONTROL_MAPPINGS', () => {
  it('should have mappings for core commerce entity types', () => {
    expect(COMMERCE_CONTROL_MAPPINGS).toHaveProperty('quote')
    expect(COMMERCE_CONTROL_MAPPINGS).toHaveProperty('order')
    expect(COMMERCE_CONTROL_MAPPINGS).toHaveProperty('invoice')
    expect(COMMERCE_CONTROL_MAPPINGS).toHaveProperty('fulfillment')
    expect(COMMERCE_CONTROL_MAPPINGS).toHaveProperty('payment')
    expect(COMMERCE_CONTROL_MAPPINGS).toHaveProperty('refund')
  })

  it('should assign valid retention classes', () => {
    for (const mapping of Object.values(COMMERCE_CONTROL_MAPPINGS)) {
      expect(['PERMANENT', '7_YEARS', '3_YEARS', '1_YEAR']).toContain(mapping.retentionClass)
    }
  })

  it('should export pack builders from barrel index', () => {
    expect(typeof commerceEvidenceBarrel.buildCommerceEvidencePack).toBe('function')
    expect(typeof commerceEvidenceBarrel.validateCommerceEvidencePack).toBe('function')
    expect(typeof commerceEvidenceBarrel.toSealableIndex).toBe('function')
  })
})
