import { z } from 'zod'

// ─── Continuity Risk Category ─────────────────────────────────────────────────

export const continuityRiskCategorySchema = z.enum([
  'governance-drift',
  'founder-dependency',
  'operational-concentration',
  'institutional-memory-fragility',
  'undocumented-process',
  'continuity-debt',
  'escalation-instability',
  'organizational-entropy',
  'evidence-chain-degradation',
  'knowledge-concentration',
])

export type ContinuityRiskCategory = z.infer<typeof continuityRiskCategorySchema>

// ─── Severity Scale ───────────────────────────────────────────────────────────

export const continuityScale = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
])

export type ContinuityScale = z.infer<typeof continuityScale>

// ─── Continuity Risk Signal ───────────────────────────────────────────────────

export const continuityRiskSignalSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().min(1),
  category: continuityRiskCategorySchema,
  description: z.string().min(1),

  // Scores
  severity: continuityScale,
  exposure: continuityScale,           // How widely exposed is the org to this risk
  detectability: continuityScale,      // How easily can this be detected (inverse = harder to detect = higher risk)
  riskIndex: z.number().min(0).max(125), // severity × exposure × detectability

  // Evidence
  evidenceRefs: z.array(z.string()),
  affectedSystems: z.array(z.string()),
  affectedRoles: z.array(z.string()),

  // Remediation
  mitigationState: z.enum(['unmitigated', 'partial', 'mitigated', 'accepted']),
  mitigationNotes: z.string(),

  detectedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type ContinuityRiskSignal = z.infer<typeof continuityRiskSignalSchema>

// ─── Governance Maturity Indicator ────────────────────────────────────────────

export const governanceMaturityIndicatorSchema = z.object({
  dimension: z.enum([
    'policy-coverage',
    'evidence-completeness',
    'decision-traceability',
    'continuity-documentation',
    'succession-planning',
    'process-formalisation',
    'audit-readiness',
    'knowledge-distribution',
  ]),
  score: z.number().min(0).max(100),
  rationale: z.string(),
  evidenceRefs: z.array(z.string()),
  lastAssessedAt: z.string().datetime(),
})

export type GovernanceMaturityIndicator = z.infer<typeof governanceMaturityIndicatorSchema>

// ─── Institutional Memory Coverage ───────────────────────────────────────────

export const institutionalMemoryCoverageSchema = z.object({
  domain: z.string().min(1),
  coveragePct: z.number().min(0).max(100),
  documentedDecisions: z.number().int().nonnegative(),
  undocumentedEstimate: z.number().int().nonnegative(),
  keyPersonDependencies: z.array(z.string()),
  lastUpdatedAt: z.string().datetime(),
})

export type InstitutionalMemoryCoverage = z.infer<typeof institutionalMemoryCoverageSchema>

// ─── Continuity Risk Score (aggregate) ───────────────────────────────────────

export const continuityRiskScoreSchema = z.object({
  orgId: z.string().min(1),
  computedAt: z.string().datetime(),

  // Composite scores (0–100, higher = worse)
  overallRiskScore: z.number().min(0).max(100),
  governanceDriftScore: z.number().min(0).max(100),
  operationalFragilityIndex: z.number().min(0).max(100),
  institutionalMemoryScore: z.number().min(0).max(100),  // higher = better coverage
  escalationInstabilityScore: z.number().min(0).max(100),

  // Signal breakdown
  signals: z.array(continuityRiskSignalSchema),
  maturityIndicators: z.array(governanceMaturityIndicatorSchema),
  memoryCoverage: z.array(institutionalMemoryCoverageSchema),

  // Trend (compared to previous assessment)
  trend: z.enum(['improving', 'stable', 'worsening', 'volatile', 'insufficient-data']),
  trendDelta: z.number().describe('Signed delta from previous overallRiskScore'),

  // Thresholds
  alertThreshold: z.number().min(0).max(100).default(65),
  criticalThreshold: z.number().min(0).max(100).default(80),
})

export type ContinuityRiskScore = z.infer<typeof continuityRiskScoreSchema>

// ─── Continuity Assessment Input ─────────────────────────────────────────────

export const continuityAssessmentInputSchema = z.object({
  orgId: z.string().min(1),
  signals: z.array(
    continuityRiskSignalSchema.omit({ id: true, riskIndex: true, detectedAt: true, updatedAt: true }),
  ),
  maturityIndicators: z.array(governanceMaturityIndicatorSchema),
  memoryCoverage: z.array(institutionalMemoryCoverageSchema),
  previousScore: continuityRiskScoreSchema.nullable().optional(),
})

export type ContinuityAssessmentInput = z.infer<typeof continuityAssessmentInputSchema>

// ─── Continuity Drift Event ───────────────────────────────────────────────────

export const continuityDriftEventSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().min(1),
  driftType: continuityRiskCategorySchema,
  description: z.string().min(1),
  detectedAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable(),
  severity: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  evidenceRefs: z.array(z.string()),
  remediation: z.string(),
  status: z.enum(['detected', 'acknowledged', 'remediating', 'resolved', 'accepted']),
})

export type ContinuityDriftEvent = z.infer<typeof continuityDriftEventSchema>
