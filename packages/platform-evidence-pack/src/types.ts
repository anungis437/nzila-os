/**
 * @nzila/platform-evidence-pack — Types
 *
 * Core types for evidence pack orchestration, export, verification, and retention.
 *
 * @module @nzila/platform-evidence-pack/types
 */
import { z } from 'zod'

// ── Evidence Pack ───────────────────────────────────────────────────────────

export type EvidencePackStatus = 'draft' | 'sealed' | 'exported' | 'verified' | 'expired'

export interface EvidenceArtifact {
  readonly artifactId: string
  readonly artifactType: string
  readonly sha256: string
  readonly sizeBytes: number
  readonly mimeType: string
  readonly blobPath: string
  readonly collectedAt: string
  readonly metadata: Record<string, string>
}

export interface EvidencePackIndex {
  readonly packId: string
  readonly orgId: string
  readonly controlFamily: string
  readonly eventType: string
  readonly eventId: string
  readonly runId: string
  readonly createdBy: string
  readonly createdAt: string
  readonly summary: string
  readonly controlsCovered: readonly string[]
  readonly artifacts: readonly EvidenceArtifact[]
  readonly seal?: SealData
}

export interface SealData {
  readonly sealVersion: string
  readonly algorithm: string
  readonly packDigest: string
  readonly artifactsMerkleRoot: string
  readonly artifactCount: number
  readonly sealedAt: string
  readonly hmacSignature?: string
  readonly hmacKeyId?: string
}

// ── Orchestrator ────────────────────────────────────────────────────────────

export interface OrchestratorPorts {
  /** Persist pack index to database */
  readonly savePack: (pack: EvidencePackIndex) => Promise<void>
  /** Load pack index from database */
  readonly loadPack: (packId: string) => Promise<EvidencePackIndex | null>
  /** List packs by org */
  readonly listPacks: (orgId: string) => Promise<readonly EvidencePackIndex[]>
  /** Update pack status */
  readonly updateStatus: (packId: string, status: EvidencePackStatus) => Promise<void>
}

// ── Exporter ────────────────────────────────────────────────────────────────

export type ExportFormat = 'json' | 'zip'

export interface ExportResult {
  readonly packId: string
  readonly format: ExportFormat
  readonly data: Buffer | string
  readonly exportedAt: string
  readonly artifactCount: number
}

export interface ExporterPorts {
  /** Read artifact blob content by path */
  readonly readBlob: (blobPath: string) => Promise<Buffer>
}

// ── Verifier ────────────────────────────────────────────────────────────────

export interface VerificationResult {
  readonly packId: string
  readonly valid: boolean
  readonly digestMatch: boolean
  readonly merkleMatch: boolean
  readonly artifactIntegrity: readonly ArtifactVerification[]
  readonly verifiedAt: string
  readonly errors: readonly string[]
}

export interface ArtifactVerification {
  readonly artifactId: string
  readonly expectedHash: string
  readonly actualHash: string | null
  readonly match: boolean
  readonly error?: string
}

export interface VerifierPorts {
  /** Read artifact blob for hash verification */
  readonly readBlob: (blobPath: string) => Promise<Buffer>
}

// ── Retention ───────────────────────────────────────────────────────────────

export type RetentionClass = 'standard' | 'extended' | 'regulatory' | 'permanent'

export interface RetentionPolicy {
  readonly retentionClass: RetentionClass
  readonly retentionDays: number
  readonly autoArchive: boolean
  readonly autoDelete: boolean
}

export interface RetentionResult {
  readonly packId: string
  readonly action: 'retained' | 'archived' | 'deleted' | 'skipped'
  readonly reason: string
  readonly processedAt: string
}

export interface RetentionPorts {
  /** Load pack for retention check */
  readonly loadPack: (packId: string) => Promise<EvidencePackIndex | null>
  /** List packs older than a given date */
  readonly listPacksOlderThan: (date: string) => Promise<readonly EvidencePackIndex[]>
  /** Archive a pack */
  readonly archivePack: (packId: string) => Promise<void>
  /** Delete a pack */
  readonly deletePack: (packId: string) => Promise<void>
}

// ── Zod Schemas ─────────────────────────────────────────────────────────────

export const evidenceArtifactSchema = z.object({
  artifactId: z.string().min(1),
  artifactType: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  sizeBytes: z.number().int().nonnegative(),
  mimeType: z.string().min(1),
  blobPath: z.string().min(1),
  collectedAt: z.string().datetime(),
  metadata: z.record(z.string(), z.string()),
})

export const evidencePackIndexSchema = z.object({
  packId: z.string().min(1),
  orgId: z.guid(),
  controlFamily: z.string().min(1),
  eventType: z.string().min(1),
  eventId: z.string().min(1),
  runId: z.guid(),
  createdBy: z.string().min(1),
  createdAt: z.string().datetime(),
  summary: z.string(),
  controlsCovered: z.array(z.string()),
  artifacts: z.array(evidenceArtifactSchema),
})

export const retentionPolicySchema = z.object({
  retentionClass: z.enum(['standard', 'extended', 'regulatory', 'permanent']),
  retentionDays: z.number().int().positive(),
  autoArchive: z.boolean(),
  autoDelete: z.boolean(),
})
