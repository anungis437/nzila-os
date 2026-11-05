/**
 * @nzila/platform-procurement-proof — Types
 *
 * Types for the Procurement Proof Center — one-click evidence aggregation
 * across security, data lifecycle, ops, governance, and sovereignty.
 *
 * @module @nzila/platform-procurement-proof/types
 */
import { z } from 'zod'

// ── Proof Sections ──────────────────────────────────────────────────────────

export type ProofSection =
  | 'security'
  | 'data_lifecycle'
  | 'operational'
  | 'governance'
  | 'sovereignty'

export type ProofPackStatus = 'collecting' | 'complete' | 'signed' | 'exported'

// ── Security Posture ────────────────────────────────────────────────────────

export interface SecurityPosture {
  readonly dependencyAudit: DependencyAuditResult
  readonly signedAttestation: SignedAttestation
  readonly vulnerabilitySummary: VulnerabilitySummary
}

export interface DependencyAuditResult {
  readonly totalDependencies: number
  readonly directDependencies: number
  readonly criticalVulnerabilities: number
  readonly highVulnerabilities: number
  readonly mediumVulnerabilities: number
  readonly lowVulnerabilities: number
  readonly blockedLicenses: readonly string[]
  readonly lockfileIntegrity: boolean
  readonly auditedAt: string
}

export interface SignedAttestation {
  readonly attestationId: string
  readonly algorithm: string
  readonly digest: string
  readonly signedBy: string
  readonly signedAt: string
  readonly scope: string
}

export interface VulnerabilitySummary {
  readonly score: number // 0-100
  readonly grade: 'A' | 'B' | 'C' | 'D' | 'F'
  readonly lastScanAt: string
}

// ── Data Lifecycle ──────────────────────────────────────────────────────────

export interface DataLifecycle {
  readonly manifests: readonly DataManifest[]
  readonly retentionControls: RetentionControls
}

export interface DataManifest {
  readonly dataCategory: string
  readonly classification: 'public' | 'internal' | 'confidential' | 'restricted'
  readonly storageRegion: string
  readonly encryptionAtRest: boolean
  readonly encryptionInTransit: boolean
  readonly retentionDays: number
  readonly deletionPolicy: 'auto' | 'manual' | 'legal_hold'
}

export interface RetentionControls {
  readonly policiesEnforced: number
  readonly policiesTotal: number
  readonly autoDeleteEnabled: boolean
  readonly lastPurgeAt: string | null
}

// ── Operational Evidence ────────────────────────────────────────────────────

export interface OperationalEvidence {
  readonly sloCompliance: SloCompliance
  readonly performanceMetrics: PerformanceMetrics
  readonly incidentSummary: IncidentSummary
  readonly trendWarnings: readonly TrendWarning[]
}

export interface SloCompliance {
  readonly overall: number
  readonly targets: readonly SloTarget[]
}

export interface SloTarget {
  readonly name: string
  readonly target: number
  readonly actual: number
  readonly compliant: boolean
}

export interface PerformanceMetrics {
  readonly p50Ms: number
  readonly p95Ms: number
  readonly p99Ms: number
  readonly errorRate: number
  readonly uptimePercent: number
}

export interface IncidentSummary {
  readonly totalIncidents: number
  readonly resolvedIncidents: number
  readonly meanTimeToResolutionMinutes: number
  readonly lastIncidentAt: string | null
}

export interface TrendWarning {
  readonly metric: string
  readonly direction: 'increasing' | 'decreasing'
  readonly changePercent: number
  readonly severity: 'info' | 'warning' | 'critical'
  readonly detectedAt: string
}

// ── Governance Evidence ─────────────────────────────────────────────────────

export interface GovernanceEvidence {
  readonly evidencePackCount: number
  readonly snapshotChainLength: number
  readonly snapshotChainValid: boolean
  readonly policyComplianceRate: number
  readonly lastEvidencePackAt: string | null
  readonly controlFamiliesCovered: readonly string[]
}

// ── Sovereignty Profile ─────────────────────────────────────────────────────

export interface SovereigntyProfile {
  readonly deploymentRegion: string
  readonly dataResidency: string
  readonly regulatoryFrameworks: readonly string[]
  readonly crossBorderTransfer: boolean
  readonly validated: boolean
  readonly validatedAt: string | null
}

// ── Procurement Pack (Aggregate) ────────────────────────────────────────────

export interface ProcurementPack {
  readonly packId: string
  readonly orgId: string
  readonly generatedAt: string
  readonly generatedBy: string
  readonly status: ProofPackStatus
  readonly sections: {
    readonly security: SecurityPosture
    readonly dataLifecycle: DataLifecycle
    readonly operational: OperationalEvidence
    readonly governance: GovernanceEvidence
    readonly sovereignty: SovereigntyProfile
  }
  readonly manifest: ProcurementManifest
  readonly signature?: PackSignature
}

export interface ProcurementManifest {
  readonly version: string
  readonly sectionCount: number
  readonly artifactCount: number
  readonly generatedAt: string
  readonly checksums: Record<string, string>
}

export interface PackSignature {
  readonly algorithm: string
  readonly digest: string
  readonly signedAt: string
  readonly signedBy: string
  readonly keyId: string
}

// ── Ports ───────────────────────────────────────────────────────────────────

export interface ProcurementProofPorts {
  readonly getSecurityPosture: (orgId: string) => Promise<SecurityPosture>
  readonly getDataLifecycle: (orgId: string) => Promise<DataLifecycle>
  readonly getOperationalEvidence: (orgId: string) => Promise<OperationalEvidence>
  readonly getGovernanceEvidence: (orgId: string) => Promise<GovernanceEvidence>
  readonly getSovereigntyProfile: (orgId: string) => Promise<SovereigntyProfile>
  readonly signPack: (digest: string) => Promise<PackSignature>
}

// ── Zod Schemas ─────────────────────────────────────────────────────────────

export const procurementManifestSchema = z.object({
  version: z.string(),
  sectionCount: z.number().int().positive(),
  artifactCount: z.number().int().nonnegative(),
  generatedAt: z.string().datetime(),
  checksums: z.record(z.string(), z.string()),
})

export const packSignatureSchema = z.object({
  algorithm: z.string(),
  digest: z.string(),
  signedAt: z.string().datetime(),
  signedBy: z.string(),
  keyId: z.string(),
})
