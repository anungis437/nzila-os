import { z } from 'zod'
import { severityScale } from './situation.js'

// ─── Decision Type ────────────────────────────────────────────────────────────

export const decisionTypeSchema = z.enum([
  'vendor-selection',
  'release-approval',
  'architecture',
  'ai-governance',
  'pilot-approval',
  'procurement',
  'continuity-strategy',
  'policy-change',
  'personnel',
  'platform-investment',
  'regulatory-response',
  'other',
])

export type DecisionType = z.infer<typeof decisionTypeSchema>

// ─── Criterion (MUST — go/bust) ──────────────────────────────────────────────

export const criterionSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1).max(200),
  description: z.string(),
  isGo: z.boolean().describe('true = must pass (go), false = must fail (bust)'),
})

export type Criterion = z.infer<typeof criterionSchema>

// ─── Weighted Criterion (WANT) ────────────────────────────────────────────────

export const weightedCriterionSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1).max(200),
  description: z.string(),
  weight: z.number().int().min(1).max(10).describe('Relative importance 1–10'),
})

export type WeightedCriterion = z.infer<typeof weightedCriterionSchema>

// ─── Alternative ──────────────────────────────────────────────────────────────

export const alternativeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string(),
  mustScores: z.record(z.string(), z.boolean()).describe('criterionId → pass/fail'),
  wantScores: z.record(z.string(), z.number().min(1).max(10)).describe('criterionId → 1–10 score'),
  weightedScore: z.number().min(0).describe('Computed weighted total'),
  passesAllMust: z.boolean().describe('Computed: all must criteria pass'),
  risks: z.array(z.string()),
  assumptions: z.array(z.string()),
  notes: z.string(),
})

export type Alternative = z.infer<typeof alternativeSchema>

// ─── Risk Acceptance ──────────────────────────────────────────────────────────

export const riskAcceptanceSchema = z.object({
  id: z.string().uuid(),
  risk: z.string().min(1),
  severity: severityScale,
  probability: severityScale,
  acceptedBy: z.string().min(1),
  acceptedAt: z.string().datetime(),
  rationale: z.string().min(1),
  mitigationRef: z.string().nullable(),
})

export type RiskAcceptance = z.infer<typeof riskAcceptanceSchema>

// ─── Mitigation Commitment ────────────────────────────────────────────────────

export const mitigationCommitmentSchema = z.object({
  id: z.string().uuid(),
  commitment: z.string().min(1),
  ownerId: z.string().min(1),
  targetDate: z.string().datetime().nullable(),
  evidenceRef: z.string().nullable(),
  status: z.enum(['committed', 'in-progress', 'completed', 'waived']),
})

export type MitigationCommitment = z.infer<typeof mitigationCommitmentSchema>

// ─── Approver ─────────────────────────────────────────────────────────────────

export const approverSchema = z.object({
  id: z.string().uuid(),
  actorId: z.string().min(1),
  role: z.string().min(1),
  approvedAt: z.string().datetime().nullable(),
  signedOff: z.boolean(),
  notes: z.string(),
})

export type Approver = z.infer<typeof approverSchema>

// ─── Rejected Alternative ─────────────────────────────────────────────────────

export const rejectedAlternativeSchema = z.object({
  alternativeId: z.string().uuid(),
  rejectionReason: z.string().min(1),
  failedMustCriteria: z.array(z.string()),
})

export type RejectedAlternative = z.infer<typeof rejectedAlternativeSchema>

// ─── Confidence Semantics ─────────────────────────────────────────────────────

export const confidenceSemanticsSchema = z.enum([
  'high',
  'moderate',
  'low',
  'insufficient-evidence',
])

export type ConfidenceSemantics = z.infer<typeof confidenceSemanticsSchema>

// ─── Decision Analysis ────────────────────────────────────────────────────────

export const decisionAnalysisSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().min(1),

  title: z.string().min(1).max(500),
  objective: z.string().min(1),
  decisionType: decisionTypeSchema,

  // Criteria
  mustCriteria: z.array(criterionSchema),
  wantCriteria: z.array(weightedCriterionSchema),

  // Alternatives
  alternatives: z.array(alternativeSchema),
  rejectedAlternatives: z.array(rejectedAlternativeSchema),

  // Outcome
  selectedAlternativeId: z.string().uuid().nullable(),
  rationale: z.string(),
  rationaleEvidenceRefs: z.array(z.string()),

  // Risk & governance
  riskAcceptances: z.array(riskAcceptanceSchema),
  mitigationCommitments: z.array(mitigationCommitmentSchema),

  // Approval chain
  approvers: z.array(approverSchema),
  allApproversSignedOff: z.boolean(),

  // Linkage
  evidenceRefs: z.array(z.string()),
  continuityImplications: z.array(z.string()),

  // Confidence and uncertainty semantics
  confidenceSemantics: confidenceSemanticsSchema,
  evidenceCompleteness: z.number().min(0).max(100),
  assumptionDensity: z.number().min(0),
  unresolvedUnknowns: z.number().int().nonnegative(),
  dependencyVolatility: z.enum(['low', 'moderate', 'high']),

  supersededBy: z.string().uuid().nullable(),
  supersedes: z.string().uuid().nullable(),

  status: z.enum(['drafting', 'under-review', 'decided', 'implemented', 'superseded']),
  ownerId: z.string().min(1),

  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  decidedAt: z.string().datetime().nullable(),
})

export type DecisionAnalysis = z.infer<typeof decisionAnalysisSchema>

// ─── Input ────────────────────────────────────────────────────────────────────

export const decisionAnalysisInputSchema = decisionAnalysisSchema.omit({
  id: true,
  alternatives: true,
  rejectedAlternatives: true,
  selectedAlternativeId: true,
  rationale: true,
  rationaleEvidenceRefs: true,
  riskAcceptances: true,
  mitigationCommitments: true,
  approvers: true,
  allApproversSignedOff: true,
  supersededBy: true,
  createdAt: true,
  updatedAt: true,
  decidedAt: true,
}).extend({
  mustCriteria: z.array(criterionSchema).optional().default([]),
  wantCriteria: z.array(weightedCriterionSchema).optional().default([]),
  evidenceRefs: z.array(z.string()).optional().default([]),
  continuityImplications: z.array(z.string()).optional().default([]),
  confidenceSemantics: confidenceSemanticsSchema.optional().default('insufficient-evidence'),
  evidenceCompleteness: z.number().min(0).max(100).optional().default(0),
  assumptionDensity: z.number().min(0).optional().default(0),
  unresolvedUnknowns: z.number().int().nonnegative().optional().default(0),
  dependencyVolatility: z.enum(['low', 'moderate', 'high']).optional().default('moderate'),
  supersedes: z.string().uuid().nullable().optional().default(null),
})

export type DecisionAnalysisInput = z.infer<typeof decisionAnalysisInputSchema>

// ─── Score Result ─────────────────────────────────────────────────────────────

export const decisionScoringResultSchema = z.object({
  decisionId: z.string().uuid(),
  viableAlternatives: z.array(alternativeSchema),
  eliminatedAlternatives: z.array(
    z.object({
      alternativeId: z.string().uuid(),
      name: z.string(),
      failedCriteria: z.array(z.string()),
    }),
  ),
  recommendedAlternativeId: z.string().uuid().nullable(),
  scoringMatrix: z.array(
    z.object({
      alternativeId: z.string().uuid(),
      name: z.string(),
      weightedScore: z.number(),
      mustPass: z.boolean(),
      criterionScores: z.array(
        z.object({
          criterionId: z.string().uuid(),
          label: z.string(),
          weight: z.number(),
          score: z.number(),
          weightedContribution: z.number(),
        }),
      ),
    }),
  ),
})

export type DecisionScoringResult = z.infer<typeof decisionScoringResultSchema>
