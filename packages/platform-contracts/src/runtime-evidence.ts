import { z } from 'zod'

// ── Enums ────────────────────────────────────────────────────────────────────

export const proofTypeSchema = z.enum([
  'release',
  'deploy',
  'health',
  'drift',
  'restore',
  'security',
  'evidence-seal',
  'ci-run',
])

export const evidenceStatusSchema = z.enum(['pass', 'warn', 'fail', 'unknown'])

export const driftClassificationSchema = z.enum([
  'no-drift',
  'expected-unknown',
  'warning-drift',
  'blocking-drift',
])

// ── Runtime Evidence Record ──────────────────────────────────────────────────

export const runtimeEvidenceRecordSchema = z.object({
  proofId: z.string(),
  proofType: proofTypeSchema,
  sourceSystem: z.string(),
  environment: z.string(),
  appName: z.string().optional(),
  productId: z.string().optional(),
  commitSha: z.string().optional(),
  branch: z.string().optional(),
  releaseVersion: z.string().optional(),
  imageTag: z.string().optional(),
  imageDigest: z.string().optional(),
  workflowName: z.string().optional(),
  workflowRunId: z.string().optional(),
  workflowRunUrl: z.string().optional(),
  actor: z.string().optional(),
  timestamp: z.string(),
  status: evidenceStatusSchema,
  severity: z.enum(['info', 'low', 'medium', 'high', 'critical']).optional(),
  evidencePath: z.string().optional(),
  rawSourcePath: z.string().optional(),
  sourceUrl: z.string().optional(),
  verificationStatus: z
    .enum(['verified', 'unverified', 'tampered', 'unknown'])
    .optional(),
  sealHash: z.string().optional(),
  notes: z.string().optional(),
  bootstrapEvidence: z.boolean().optional(),
})

// ── Release Ledger ───────────────────────────────────────────────────────────

export const releaseLedgerEntrySchema = z.object({
  version: z.string(),
  releaseId: z.string(),
  timestamp: z.string(),
  apps: z.array(z.string()),
  deployedBy: z.string(),
  environment: z.string(),
  status: z.enum(['success', 'failure', 'hotfix', 'rollback-candidate']),
  commitSha: z.string().optional(),
  imageDigest: z.string().optional(),
  healthCheckResult: z.enum(['pass', 'fail', 'skip']).optional(),
  rollbackTarget: z.string().optional(),
  linkedEvidencePack: z.string().optional(),
  workflowRunId: z.string().optional(),
  notes: z.string().optional(),
})

// ── Release Manifest ─────────────────────────────────────────────────────────
// Extended to accommodate existing manifests that lack imageDigest/workflowRunId

export const releaseManifestSchema = z.object({
  version: z.string(),
  tag: z.string(),
  previousVersion: z.string().optional(),
  bumpType: z.string().optional(),
  gitSha: z.string().optional(),
  gitBranch: z.string().optional(),
  date: z.string(),
  artifactId: z.string().optional(),
  releaseType: z.string().optional(),
  signed: z.boolean().optional(),
  signMethod: z.string().optional(),
  changelogUrl: z.string().optional(),
  approvedApps: z.array(z.string()).optional(),
  createdBy: z.string().optional(),
  // Extended fields (absent in older manifests)
  imageTag: z.string().optional(),
  imageDigest: z.string().optional(),
  workflowRunId: z.string().optional(),
  workflowRunUrl: z.string().optional(),
  healthCheckResult: z.enum(['pass', 'fail', 'skip']).optional(),
  rollbackTarget: z.string().optional(),
  linkedEvidencePack: z.string().optional(),
  deployActor: z.string().optional(),
  environment: z.string().optional(),
})

// ── Drift ────────────────────────────────────────────────────────────────────

export const driftItemSchema = z.object({
  app: z.string(),
  expectedVersion: z.string().optional(),
  deployedVersion: z.string().optional(),
  environment: z.string().optional(),
  baseDomain: z.string().optional(),
  imageDigest: z.string().optional(),
  requiredEnvFlags: z.array(z.string()).optional(),
  classification: driftClassificationSchema,
  notes: z.string().optional(),
})

export const driftReportSchema = z.object({
  generatedAt: z.string(),
  period: z.string(),
  driftItems: z.array(driftItemSchema),
  baseline: z.boolean().optional(),
  notes: z.string().optional(),
})

// ── Restore Drill ────────────────────────────────────────────────────────────

export const restoreDrillRecordSchema = z.object({
  drillId: z.string(),
  timestamp: z.string(),
  mode: z.string(),
  environment: z.string(),
  overallStatus: z.enum(['pass', 'fail', 'partial']).optional(),
  rtoTarget: z.string().optional(),
  rtoActual: z.string().nullable().optional(),
  rpoTarget: z.string().optional(),
  operator: z.string().optional(),
  migrationCount: z.number().optional(),
  schemaVersion: z.literal(1).optional(),
  backupSources: z
    .array(
      z.object({
        type: z.string(),
        location: z.string().optional(),
        exists: z.boolean(),
        lastModified: z.string().optional(),
      }),
    )
    .optional(),
  checks: z
    .array(
      z.object({
        check: z.string(),
        status: z.string(),
        message: z.string().optional(),
        durationMs: z.number().optional(),
      }),
    )
    .optional(),
})

// ── Security Proof ───────────────────────────────────────────────────────────

export const securityProofSummarySchema = z.object({
  sbomPath: z.string().optional(),
  sbomExists: z.boolean(),
  trivyScanPath: z.string().optional(),
  trivyScanExists: z.boolean(),
  trivyScanStatus: evidenceStatusSchema.optional(),
  secretScanPath: z.string().optional(),
  secretScanExists: z.boolean(),
  secretScanStatus: evidenceStatusSchema.optional(),
  dependencyAuditPath: z.string().optional(),
  dependencyAuditExists: z.boolean(),
  dependencyAuditStatus: evidenceStatusSchema.optional(),
  dastEvidencePath: z.string().optional(),
  dastEvidenceExists: z.boolean(),
  overallStatus: evidenceStatusSchema,
  bootstrapEvidence: z.boolean().optional(),
})

// ── Evidence Seal Verification ───────────────────────────────────────────────

export const evidenceSealVerificationSchema = z.object({
  evidencePackExists: z.boolean(),
  sealExists: z.boolean(),
  sealVerified: z.boolean(),
  sealHash: z.string().optional(),
  evidencePackPath: z.string().optional(),
  verificationStatus: z.enum(['verified', 'unverified', 'tampered', 'unknown']),
  month: z.string().optional(),
  sourceCount: z.number().optional(),
})

// ── Scoring ──────────────────────────────────────────────────────────────────

export const runtimeProofScoreSchema = z.object({
  score: z.number().min(0).max(100),
  maxScore: z.literal(100),
  grade: z.enum(['A', 'B', 'C', 'D', 'F']),
  breakdown: z.object({
    releaseEvidence: z.object({ score: z.number(), max: z.literal(20) }),
    deploymentEvidence: z.object({ score: z.number(), max: z.literal(20) }),
    healthEvidence: z.object({ score: z.number(), max: z.literal(15) }),
    driftEvidence: z.object({ score: z.number(), max: z.literal(15) }),
    restoreEvidence: z.object({ score: z.number(), max: z.literal(10) }),
    securityEvidence: z.object({ score: z.number(), max: z.literal(10) }),
    sealVerification: z.object({ score: z.number(), max: z.literal(10) }),
  }),
  blockingFindings: z.array(z.string()),
  advisoryFindings: z.array(z.string()),
  unknowns: z.array(z.string()),
  nextRequiredEvidence: z.array(z.string()),
  bootstrapPenaltyApplied: z.boolean().optional(),
})

// ── Inferred Types ───────────────────────────────────────────────────────────

export type ProofType = z.infer<typeof proofTypeSchema>
export type EvidenceStatus = z.infer<typeof evidenceStatusSchema>
export type DriftClassification = z.infer<typeof driftClassificationSchema>
export type RuntimeEvidenceRecord = z.infer<typeof runtimeEvidenceRecordSchema>
export type ReleaseLedgerEntry = z.infer<typeof releaseLedgerEntrySchema>
export type ReleaseManifest = z.infer<typeof releaseManifestSchema>
export type DriftItem = z.infer<typeof driftItemSchema>
export type DriftReport = z.infer<typeof driftReportSchema>
export type RestoreDrillRecord = z.infer<typeof restoreDrillRecordSchema>
export type SecurityProofSummary = z.infer<typeof securityProofSummarySchema>
export type EvidenceSealVerification = z.infer<
  typeof evidenceSealVerificationSchema
>
export type RuntimeProofScore = z.infer<typeof runtimeProofScoreSchema>
