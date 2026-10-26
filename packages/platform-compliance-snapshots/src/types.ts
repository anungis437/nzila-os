/**
 * @nzila/platform-compliance-snapshots — Types
 *
 * Core types for immutable, chained compliance snapshots.
 * Each snapshot captures cross-system compliance state at a point in time
 * and is linked to its predecessor via SHA-256 hash chain, creating an
 * append-only audit trail.
 *
 * @module @nzila/platform-compliance-snapshots/types
 */
import { z } from 'zod'

// ── Control Families ────────────────────────────────────────────────────────

export const CONTROL_FAMILIES = [
  'access',
  'change-mgmt',
  'incident-response',
  'dr-bcp',
  'integrity',
  'sdlc',
  'retention',
  'data-governance',
  'security-operations',
] as const

export type ControlFamily = (typeof CONTROL_FAMILIES)[number]

// ── Snapshot Status ─────────────────────────────────────────────────────────

export type SnapshotStatus = 'pending' | 'collected' | 'chained' | 'verified' | 'failed'

// ── Compliance Control ──────────────────────────────────────────────────────

export interface ComplianceControl {
  readonly controlId: string
  readonly controlFamily: ControlFamily
  readonly title: string
  readonly status: 'compliant' | 'non-compliant' | 'partial' | 'not-assessed'
  readonly evidence: readonly string[]
  readonly lastAssessedAt: string
  readonly assessedBy: string
  readonly notes?: string
}

// ── Compliance Snapshot ─────────────────────────────────────────────────────

export interface ComplianceSnapshot {
  readonly snapshotId: string
  readonly orgId: string
  readonly version: number
  readonly status: SnapshotStatus
  readonly collectedAt: string
  readonly collectedBy: string
  readonly controls: readonly ComplianceControl[]
  readonly summary: SnapshotSummary
  readonly metadata: Record<string, string>
}

export interface SnapshotSummary {
  readonly totalControls: number
  readonly compliant: number
  readonly nonCompliant: number
  readonly partial: number
  readonly notAssessed: number
  readonly complianceScore: number
}

// ── Chain Entry ─────────────────────────────────────────────────────────────

export interface SnapshotChainEntry {
  readonly snapshotId: string
  readonly orgId: string
  readonly version: number
  readonly snapshotHash: string
  readonly previousHash: string | null
  readonly chainedAt: string
}

// ── Chain Verification ──────────────────────────────────────────────────────

export interface ChainVerificationResult {
  readonly orgId: string
  readonly valid: boolean
  readonly totalEntries: number
  readonly verifiedEntries: number
  readonly brokenAt: number | null
  readonly errors: readonly string[]
  readonly verifiedAt: string
}

// ── Ports ────────────────────────────────────────────────────────────────────

export interface CollectorPorts {
  readonly fetchControls: (orgId: string) => Promise<readonly ComplianceControl[]>
}

export interface ChainPorts {
  readonly loadChain: (orgId: string) => Promise<readonly SnapshotChainEntry[]>
  readonly appendEntry: (entry: SnapshotChainEntry) => Promise<void>
}

export interface GeneratorPorts {
  readonly saveSnapshot: (snapshot: ComplianceSnapshot) => Promise<void>
  readonly loadSnapshot: (snapshotId: string) => Promise<ComplianceSnapshot | null>
  readonly listSnapshots: (orgId: string) => Promise<readonly ComplianceSnapshot[]>
  readonly updateStatus: (snapshotId: string, status: SnapshotStatus) => Promise<void>
}

export interface VerifierPorts {
  readonly loadSnapshot: (snapshotId: string) => Promise<ComplianceSnapshot | null>
  readonly loadChain: (orgId: string) => Promise<readonly SnapshotChainEntry[]>
}

// ── Zod Schemas ─────────────────────────────────────────────────────────────

export const complianceControlSchema = z.object({
  controlId: z.string().min(1),
  controlFamily: z.enum(CONTROL_FAMILIES),
  title: z.string().min(1),
  status: z.enum(['compliant', 'non-compliant', 'partial', 'not-assessed']),
  evidence: z.array(z.string()),
  lastAssessedAt: z.string().min(1),
  assessedBy: z.string().min(1),
  notes: z.string().optional(),
})

export const snapshotSummarySchema = z.object({
  totalControls: z.number().int().nonnegative(),
  compliant: z.number().int().nonnegative(),
  nonCompliant: z.number().int().nonnegative(),
  partial: z.number().int().nonnegative(),
  notAssessed: z.number().int().nonnegative(),
  complianceScore: z.number().min(0).max(100),
})

export const complianceSnapshotSchema = z.object({
  snapshotId: z.string().min(1),
  orgId: z.guid(),
  version: z.number().int().positive(),
  status: z.enum(['pending', 'collected', 'chained', 'verified', 'failed']),
  collectedAt: z.string().min(1),
  collectedBy: z.string().min(1),
  controls: z.array(complianceControlSchema),
  summary: snapshotSummarySchema,
  metadata: z.record(z.string(), z.string()),
})

export const snapshotChainEntrySchema = z.object({
  snapshotId: z.string().min(1),
  orgId: z.guid(),
  version: z.number().int().positive(),
  snapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
  previousHash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  chainedAt: z.string().min(1),
})
