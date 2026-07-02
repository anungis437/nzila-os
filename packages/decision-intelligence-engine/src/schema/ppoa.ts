import { z } from 'zod'
import { severityScale } from './situation.js'

// ─── Context Type ─────────────────────────────────────────────────────────────

export const ppoaContextTypeSchema = z.enum([
  'deployment',
  'pilot',
  'release',
  'migration',
  'product-launch',
  'architectural-change',
  'vendor-change',
  'policy-rollout',
  'continuity-drill',
])

export type PPOAContextType = z.infer<typeof ppoaContextTypeSchema>

// ─── Governance Maturity Level ────────────────────────────────────────────────

export const governanceMaturitySchema = z.enum([
  'initial',
  'repeatable',
  'defined',
  'managed',
  'optimising',
])

export type GovernanceMaturity = z.infer<typeof governanceMaturitySchema>

// ─── Potential Risk ───────────────────────────────────────────────────────────

export const potentialRiskSchema = z.object({
  id: z.string().uuid(),
  description: z.string().min(1),
  category: z.enum([
    'technical',
    'operational',
    'governance',
    'continuity',
    'security',
    'compliance',
    'reputational',
    'financial',
  ]),
  probability: severityScale,
  severity: severityScale,
  detectionDifficulty: severityScale,

  // Composite score: probability × severity
  riskScore: z.number().min(1).max(25),

  preventionActions: z.array(z.string()),
  contingencyActions: z.array(z.string()),

  ownerId: z.string(),
  residualRisk: severityScale,
  evidenceRef: z.string().nullable(),
  status: z.enum(['identified', 'monitored', 'triggered', 'mitigated', 'accepted']),
})

export type PotentialRisk = z.infer<typeof potentialRiskSchema>

// ─── Potential Opportunity ────────────────────────────────────────────────────

export const potentialOpportunitySchema = z.object({
  id: z.string().uuid(),
  description: z.string().min(1),
  probability: severityScale,
  impact: severityScale,

  // Composite score: probability × impact
  opportunityScore: z.number().min(1).max(25),

  leverageActions: z.array(z.string()),
  ownerId: z.string(),
  evidenceRef: z.string().nullable(),
  status: z.enum(['identified', 'pursuing', 'captured', 'missed', 'deferred']),
})

export type PotentialOpportunity = z.infer<typeof potentialOpportunitySchema>

// ─── PPOA Analysis ────────────────────────────────────────────────────────────

export const ppoaAnalysisSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().min(1),

  title: z.string().min(1).max(500),
  context: z.string().min(1),
  contextType: ppoaContextTypeSchema,

  // Linked assets
  releaseRef: z.string().nullable(),
  pilotRef: z.string().nullable(),
  decisionAnalysisRef: z.string().uuid().nullable(),

  // Risks
  risks: z.array(potentialRiskSchema),

  // Opportunities
  opportunities: z.array(potentialOpportunitySchema),

  // Readiness scoring (0–100)
  operationalReadinessScore: z.number().min(0).max(100),
  rolloutConfidenceScore: z.number().min(0).max(100),

  // Governance maturity
  governanceMaturity: governanceMaturitySchema,

  // Critical risks (score >= threshold)
  criticalRiskCount: z.number().int().nonnegative(),
  criticalRiskThreshold: z.number().min(1).max(25).default(15),

  // Evidence
  evidenceRefs: z.array(z.string()),

  ownerId: z.string().min(1),
  targetDate: z.string().datetime().nullable(),
  status: z.enum(['preparing', 'reviewed', 'approved', 'active', 'completed', 'aborted']),

  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type PPOAAnalysis = z.infer<typeof ppoaAnalysisSchema>

// ─── Input ────────────────────────────────────────────────────────────────────

export const ppoaAnalysisInputSchema = ppoaAnalysisSchema.omit({
  id: true,
  risks: true,
  opportunities: true,
  operationalReadinessScore: true,
  rolloutConfidenceScore: true,
  criticalRiskCount: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  releaseRef: z.string().nullable().optional().default(null),
  pilotRef: z.string().nullable().optional().default(null),
  decisionAnalysisRef: z.string().uuid().nullable().optional().default(null),
  evidenceRefs: z.array(z.string()).optional().default([]),
  targetDate: z.string().datetime().nullable().optional().default(null),
  criticalRiskThreshold: z.number().int().min(1).max(25).optional().default(15),
})

/**
 * Caller-facing input type. Uses `z.input` (not `z.infer`) so fields with
 * `.optional().default(...)` are truly optional at the type level for
 * consumers. The schema still applies defaults at parse time via `.parse()`.
 */
export type PPOAAnalysisInput = z.input<typeof ppoaAnalysisInputSchema>

// ─── Readiness Report ─────────────────────────────────────────────────────────

export const readinessReportSchema = z.object({
  analysisId: z.string().uuid(),
  operationalReadinessScore: z.number().min(0).max(100),
  rolloutConfidenceScore: z.number().min(0).max(100),
  criticalRisks: z.array(potentialRiskSchema),
  topOpportunities: z.array(potentialOpportunitySchema),
  recommendation: z.enum(['proceed', 'proceed-with-conditions', 'defer', 'abort']),
  rationale: z.string(),
})

export type ReadinessReport = z.infer<typeof readinessReportSchema>
