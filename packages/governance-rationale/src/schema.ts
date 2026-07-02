import { z } from 'zod'

// ─── Governance Decision Trigger ──────────────────────────────────────────────

export const governanceDecisionTriggerSchema = z.enum([
  'policy-change',
  'release-gate',
  'security-finding',
  'compliance-requirement',
  'risk-escalation',
  'audit-finding',
  'continuity-event',
  'architecture-change',
  'regulatory-mandate',
  'operational-incident',
  'financial-threshold',
  'executive-directive',
  'external-audit',
])

export type GovernanceDecisionTrigger = z.infer<typeof governanceDecisionTriggerSchema>

// ─── Assumption ───────────────────────────────────────────────────────────────

export const governanceAssumptionSchema = z.object({
  id: z.string().uuid(),
  assumption: z.string().min(1),
  evidenceRef: z.string().nullable(),
  confidence: z.number().min(0).max(100),
  validatedAt: z.string().datetime().nullable(),
  validatedBy: z.string().nullable(),
})

export type GovernanceAssumption = z.infer<typeof governanceAssumptionSchema>

// ─── Rejected Alternative ─────────────────────────────────────────────────────

export const rationaleRejectionSchema = z.object({
  alternativeId: z.string(),
  description: z.string().min(1),
  rejectionReason: z.string().min(1),
  evidenceRef: z.string().nullable(),
})

export type RationaleRejection = z.infer<typeof rationaleRejectionSchema>

// ─── Accepted Risk ────────────────────────────────────────────────────────────

export const rationaleAcceptedRiskSchema = z.object({
  id: z.string().uuid(),
  risk: z.string().min(1),
  severity: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  acceptedBy: z.string().min(1),
  rationale: z.string().min(1),
  mitigationCommitment: z.string().nullable(),
  reviewDate: z.string().datetime().nullable(),
})

export type RationaleAcceptedRisk = z.infer<typeof rationaleAcceptedRiskSchema>

// ─── Governance Rationale Record ──────────────────────────────────────────────

export const governanceRationaleSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().min(1),

  // Decision context
  decisionTitle: z.string().min(1).max(500),
  decisionType: z.string().min(1),
  trigger: governanceDecisionTriggerSchema,

  // Structured rationale
  context: z.string().min(1).describe('What situation required this governance decision?'),
  deviation: z.string().describe('What deviation or gap triggered this?'),
  outcome: z.string().min(1).describe('What was decided?'),
  rationale: z.string().min(1).describe('Why was this the correct decision?'),

  // Evidence & assumptions
  supportingEvidenceRefs: z.array(z.string()),
  assumptions: z.array(governanceAssumptionSchema),

  // Alternatives considered
  alternativesRejected: z.array(rationaleRejectionSchema),

  // Risk
  acceptedRisks: z.array(rationaleAcceptedRiskSchema),
  mitigationCommitments: z.array(z.string()),

  // Linkage
  policyRef: z.string().nullable().describe('Policy or framework this decision implements'),
  decisionAnalysisRef: z.string().uuid().nullable(),
  releaseRef: z.string().nullable(),
  continuityImplications: z.array(z.string()),

  // Approval
  approvedBy: z.array(z.object({
    actorId: z.string().min(1),
    role: z.string(),
    approvedAt: z.string().datetime(),
  })),

  // Audit fields
  isReplayable: z.boolean().default(true),
  replayHash: z.string().nullable().describe('SHA-256 hash of canonical rationale payload'),

  status: z.enum(['draft', 'active', 'superseded', 'archived']),
  ownerId: z.string().min(1),

  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  supersededBy: z.string().uuid().nullable(),
  supersedes: z.string().uuid().nullable(),
})

export type GovernanceRationale = z.infer<typeof governanceRationaleSchema>

// ─── Input ────────────────────────────────────────────────────────────────────

export const governanceRationaleInputSchema = governanceRationaleSchema.omit({
  id: true,
  assumptions: true,
  alternativesRejected: true,
  acceptedRisks: true,
  mitigationCommitments: true,
  approvedBy: true,
  isReplayable: true,
  replayHash: true,
  createdAt: true,
  updatedAt: true,
  supersededBy: true,
}).extend({
  supportingEvidenceRefs: z.array(z.string()).optional().default([]),
  continuityImplications: z.array(z.string()).optional().default([]),
  policyRef: z.string().nullable().optional().default(null),
  decisionAnalysisRef: z.string().uuid().nullable().optional().default(null),
  releaseRef: z.string().nullable().optional().default(null),
  supersedes: z.string().uuid().nullable().optional().default(null),
  deviation: z.string().optional().default(''),
})

export type GovernanceRationaleInput = z.input<typeof governanceRationaleInputSchema>

// ─── Replay Result ────────────────────────────────────────────────────────────

export const rationaleReplayResultSchema = z.object({
  rationaleId: z.string().uuid(),
  replayedAt: z.string().datetime(),
  integrityVerified: z.boolean(),
  computedHash: z.string(),
  storedHash: z.string().nullable(),
  hashMismatch: z.boolean(),
  rationaleSnapshot: governanceRationaleSchema,
})

export type RationaleReplayResult = z.infer<typeof rationaleReplayResultSchema>
