import { z } from 'zod'

// ─── Evidence Classification ──────────────────────────────────────────────────

export const evidenceClassificationSchema = z.enum([
  'INTERNAL',
  'CONFIDENTIAL',
  'RESTRICTED',
  'PUBLIC',
])

export type EvidenceClassification = z.infer<typeof evidenceClassificationSchema>

// ─── Evidence Pack Type ───────────────────────────────────────────────────────

export const evidencePackTypeSchema = z.enum([
  'decision-analysis',
  'problem-analysis',
  'ppoa',
  'governance-rationale',
  'continuity-assessment',
  'situation-appraisal',
  'composite',
])

export type EvidencePackType = z.infer<typeof evidencePackTypeSchema>

// ─── Evidence Reference ───────────────────────────────────────────────────────

export const evidenceRefSchema = z.object({
  refId: z.string().uuid(),
  refType: z.string().min(1),
  description: z.string(),
  capturedAt: z.string().datetime(),
  classification: evidenceClassificationSchema,
  hash: z.string().nullable().describe('SHA-256 hash of referenced artifact'),
})

export type EvidenceRef = z.infer<typeof evidenceRefSchema>

// ─── Timeline Event ───────────────────────────────────────────────────────────

export const evidenceTimelineEventSchema = z.object({
  at: z.string().datetime(),
  actor: z.string(),
  event: z.string().min(1),
  evidenceRef: z.string().nullable(),
})

export type EvidenceTimelineEvent = z.infer<typeof evidenceTimelineEventSchema>

// ─── Approver Record ──────────────────────────────────────────────────────────

export const evidenceApproverSchema = z.object({
  actorId: z.string().min(1),
  role: z.string(),
  approvedAt: z.string().datetime(),
  notes: z.string(),
})

export type EvidenceApprover = z.infer<typeof evidenceApproverSchema>

// ─── Machine-Readable Metadata ────────────────────────────────────────────────

export const evidencePackMetadataSchema = z.object({
  packId: z.string().uuid(),
  orgId: z.string().min(1),
  packType: evidencePackTypeSchema,
  classification: evidenceClassificationSchema,
  createdAt: z.string().datetime(),
  sealedAt: z.string().datetime().nullable(),
  sealed: z.boolean(),
  packHash: z.string().nullable(),
  prevPackHash: z.string().nullable().describe('Hash of previous pack in chain'),
  schemaVersion: z.string().default('1.0.0'),
})

export type EvidencePackMetadata = z.infer<typeof evidencePackMetadataSchema>

// ─── Decision Evidence Pack ───────────────────────────────────────────────────

export const decisionEvidencePackSchema = z.object({
  // Identity & chain
  id: z.string().uuid(),
  orgId: z.string().min(1),
  packType: evidencePackTypeSchema,

  // Executive summary
  executiveSummary: z.string().min(1),
  decisionTitle: z.string().min(1),
  decisionOutcome: z.string().min(1),

  // Timeline
  timeline: z.array(evidenceTimelineEventSchema),

  // Scoring matrix (JSON-serialised — structure varies by pack type)
  scoringMatrix: z.unknown().nullable().describe('Serialised scoring matrix artifact'),

  // Evidence chain
  evidenceRefs: z.array(evidenceRefSchema),

  // Policy linkage
  policyReplayOutputs: z.array(z.object({
    policyRef: z.string(),
    replayedAt: z.string().datetime(),
    result: z.enum(['pass', 'fail', 'warning', 'skipped']),
    notes: z.string(),
  })),

  // Alternatives rejected
  alternativesRejected: z.array(z.object({
    name: z.string(),
    reason: z.string(),
  })),

  // Accepted risks
  acceptedRisks: z.array(z.object({
    risk: z.string(),
    severity: z.number(),
    acceptedBy: z.string(),
    mitigationPlan: z.string(),
  })),

  // Mitigation plans
  mitigationPlans: z.array(z.object({
    commitment: z.string(),
    owner: z.string(),
    targetDate: z.string().datetime().nullable(),
    status: z.string(),
  })),

  // Approvers
  approvers: z.array(evidenceApproverSchema),

  // Continuity
  continuityImplications: z.array(z.string()),

  // Integrity
  classification: evidenceClassificationSchema,
  packHash: z.string().nullable(),
  prevPackHash: z.string().nullable(),
  sealed: z.boolean().default(false),
  sealedAt: z.string().datetime().nullable(),
  schemaVersion: z.string().default('1.0.0'),

  createdAt: z.string().datetime(),
})

export type DecisionEvidencePack = z.infer<typeof decisionEvidencePackSchema>

// ─── Pack Input ───────────────────────────────────────────────────────────────

export const decisionEvidencePackInputSchema = decisionEvidencePackSchema.omit({
  id: true,
  packHash: true,
  sealed: true,
  sealedAt: true,
  createdAt: true,
}).extend({
  prevPackHash: z.string().nullable().optional().default(null),
  policyReplayOutputs: z.array(z.any()).optional().default([]),
  alternativesRejected: z.array(z.any()).optional().default([]),
  acceptedRisks: z.array(z.any()).optional().default([]),
  mitigationPlans: z.array(z.any()).optional().default([]),
  approvers: z.array(evidenceApproverSchema).optional().default([]),
  continuityImplications: z.array(z.string()).optional().default([]),
})

export type DecisionEvidencePackInput = z.infer<typeof decisionEvidencePackInputSchema>

// ─── Sealed Pack (immutable export) ──────────────────────────────────────────

export const sealedDecisionEvidencePackSchema = z.object({
  pack: decisionEvidencePackSchema,
  sealHash: z.string().describe('SHA-256 of full pack JSON at seal time'),
  sealedAt: z.string().datetime(),
  exportFormats: z.array(z.enum(['json', 'markdown'])),
})

export type SealedDecisionEvidencePack = z.infer<typeof sealedDecisionEvidencePackSchema>
