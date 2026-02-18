/**
 * @nzila/os-core — Evidence pack types
 *
 * Shared type definitions for evidence pack generation.
 * Mirrors the DB enums and the Evidence-Pack-Index.schema.json contract.
 */
import { z } from 'zod'

// ── Control families (matches DB controlFamilyEnum) ─────────────────────────

export const ControlFamily = z.enum([
  'access',
  'change-mgmt',
  'incident-response',
  'dr-bcp',
  'integrity',
  'sdlc',
  'retention',
])
export type ControlFamily = z.infer<typeof ControlFamily>

// ── Evidence event types (matches DB evidenceEventTypeEnum) ─────────────────

export const EvidenceEventType = z.enum([
  'incident',
  'dr-test',
  'access-review',
  'period-close',
  'release',
  'restore-test',
  'control-test',
  'audit-request',
])
export type EvidenceEventType = z.infer<typeof EvidenceEventType>

// ── Retention classes ───────────────────────────────────────────────────────

export const RetentionClass = z.enum(['PERMANENT', '7_YEARS', '3_YEARS', '1_YEAR'])
export type RetentionClass = z.infer<typeof RetentionClass>

// ── Classification ──────────────────────────────────────────────────────────

export const Classification = z.enum(['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'])
export type Classification = z.infer<typeof Classification>

// ── Blob containers used for evidence ───────────────────────────────────────

export const BlobContainer = z.enum(['evidence', 'minutebook', 'exports'])
export type BlobContainer = z.infer<typeof BlobContainer>

// ── Single artifact descriptor ──────────────────────────────────────────────

export const ArtifactDescriptor = z.object({
  artifactId: z.string(),
  artifactType: z.string(),
  filename: z.string(),
  buffer: z.instanceof(Buffer),
  contentType: z.string(),
  retentionClass: RetentionClass,
  classification: Classification.default('INTERNAL'),
  description: z.string().optional(),
})
export type ArtifactDescriptor = z.infer<typeof ArtifactDescriptor>

// ── Evidence pack request ───────────────────────────────────────────────────

export const EvidencePackRequest = z.object({
  /** Unique pack identifier (e.g. IR-2026-001, RES-2026-042) */
  packId: z.string().min(1),
  /** Entity UUID */
  entityId: z.string().uuid(),
  /** Control family for this evidence */
  controlFamily: ControlFamily,
  /** Type of triggering event */
  eventType: EvidenceEventType,
  /** ID of the triggering event (incident ID, resolution ID, release tag, …) */
  eventId: z.string().min(1),
  /** Blob container to upload into */
  blobContainer: BlobContainer.default('evidence'),
  /** Human-readable summary */
  summary: z.string().default(''),
  /** Control IDs covered (e.g. ["IR-01","IR-02"]) */
  controlsCovered: z.array(z.string()).default([]),
  /** Clerk user ID or "system" */
  createdBy: z.string().min(1),
  /** Artifact descriptors to include in the pack */
  artifacts: z.array(ArtifactDescriptor).min(1),
})
export type EvidencePackRequest = z.infer<typeof EvidencePackRequest>

// ── Evidence pack result ────────────────────────────────────────────────────

export interface UploadedArtifact {
  artifactId: string
  artifactType: string
  filename: string
  blobPath: string
  sha256: string
  contentType: string
  sizeBytes: number
  retentionClass: RetentionClass
  classification: Classification
  documentId: string // UUID of the documents row
  auditEventId: string // UUID of the audit_events row
}

export interface EvidencePackResult {
  packId: string
  runId: string
  entityId: string
  controlFamily: ControlFamily
  eventType: EvidenceEventType
  eventId: string
  blobContainer: BlobContainer
  basePath: string
  summary: string
  controlsCovered: string[]
  artifacts: UploadedArtifact[]
  indexBlobPath: string
  indexDocumentId: string
  evidencePackDbId: string
  createdAt: string
}

// ── Governance action → evidence mapping ────────────────────────────────────

export interface GovernanceEvidenceMapping {
  actionType: string
  controlFamily: ControlFamily
  eventType: EvidenceEventType
  controlsCovered: string[]
  retentionClass: RetentionClass
  blobContainer: BlobContainer
}

/**
 * Default mappings from governance action types to evidence metadata.
 * Used by the MinuteBookOS artifact registry to auto-tag evidence packs.
 */
export const GOVERNANCE_EVIDENCE_MAPPINGS: Record<string, GovernanceEvidenceMapping> = {
  issue_shares: {
    actionType: 'issue_shares',
    controlFamily: 'integrity',
    eventType: 'period-close',
    controlsCovered: ['INT-01', 'INT-02'],
    retentionClass: 'PERMANENT',
    blobContainer: 'minutebook',
  },
  transfer_shares: {
    actionType: 'transfer_shares',
    controlFamily: 'integrity',
    eventType: 'period-close',
    controlsCovered: ['INT-01', 'INT-03'],
    retentionClass: 'PERMANENT',
    blobContainer: 'minutebook',
  },
  convert_shares: {
    actionType: 'convert_shares',
    controlFamily: 'integrity',
    eventType: 'period-close',
    controlsCovered: ['INT-01'],
    retentionClass: 'PERMANENT',
    blobContainer: 'minutebook',
  },
  repurchase_shares: {
    actionType: 'repurchase_shares',
    controlFamily: 'integrity',
    eventType: 'period-close',
    controlsCovered: ['INT-01', 'INT-04'],
    retentionClass: 'PERMANENT',
    blobContainer: 'minutebook',
  },
  dividend: {
    actionType: 'dividend',
    controlFamily: 'integrity',
    eventType: 'period-close',
    controlsCovered: ['INT-05'],
    retentionClass: '7_YEARS',
    blobContainer: 'minutebook',
  },
  borrow_funds: {
    actionType: 'borrow_funds',
    controlFamily: 'change-mgmt',
    eventType: 'period-close',
    controlsCovered: ['CM-02'],
    retentionClass: '7_YEARS',
    blobContainer: 'minutebook',
  },
  amend_rights: {
    actionType: 'amend_rights',
    controlFamily: 'change-mgmt',
    eventType: 'period-close',
    controlsCovered: ['CM-01', 'CM-03'],
    retentionClass: 'PERMANENT',
    blobContainer: 'minutebook',
  },
  create_class: {
    actionType: 'create_class',
    controlFamily: 'change-mgmt',
    eventType: 'period-close',
    controlsCovered: ['CM-01'],
    retentionClass: 'PERMANENT',
    blobContainer: 'minutebook',
  },
  merger_acquisition: {
    actionType: 'merger_acquisition',
    controlFamily: 'change-mgmt',
    eventType: 'period-close',
    controlsCovered: ['CM-01', 'CM-04'],
    retentionClass: 'PERMANENT',
    blobContainer: 'minutebook',
  },
  elect_directors: {
    actionType: 'elect_directors',
    controlFamily: 'access',
    eventType: 'access-review',
    controlsCovered: ['AC-01', 'AC-02'],
    retentionClass: '7_YEARS',
    blobContainer: 'minutebook',
  },
  amend_constitution: {
    actionType: 'amend_constitution',
    controlFamily: 'change-mgmt',
    eventType: 'period-close',
    controlsCovered: ['CM-01', 'CM-05'],
    retentionClass: 'PERMANENT',
    blobContainer: 'minutebook',
  },
}
