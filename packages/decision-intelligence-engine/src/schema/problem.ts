import { z } from 'zod'
import { severityScale } from './situation.js'

// ─── KT Problem Dimensions ────────────────────────────────────────────────────

export const whatDimensionSchema = z.object({
  is: z.string().min(1).describe('What IS exhibiting the deviation'),
  isNot: z.string().min(1).describe('What is NOT exhibiting the deviation'),
  distinctives: z.array(z.string()).describe('Characteristics of IS vs IS NOT'),
})

export const whereDimensionSchema = z.object({
  is: z.string().min(1).describe('Where the deviation IS observed'),
  isNot: z.string().min(1).describe('Where the deviation is NOT observed'),
  locations: z.array(z.string()).describe('Specific locations, systems, or units'),
})

export const occurencePatternSchema = z.enum([
  'continuous',
  'intermittent',
  'one-time',
  'escalating',
  'cyclical',
])

export type OccurrencePattern = z.infer<typeof occurencePatternSchema>

export const whenDimensionSchema = z.object({
  is: z.string().min(1).describe('When the deviation IS present'),
  isNot: z.string().min(1).describe('When the deviation is NOT present'),
  firstOccurrence: z.string().datetime().describe('ISO 8601 timestamp of first known occurrence'),
  lastOccurrence: z.string().datetime().nullable(),
  pattern: occurencePatternSchema,
})

export const extentDimensionSchema = z.object({
  is: z.string().min(1).describe('Extent to which the problem IS present'),
  isNot: z.string().min(1).describe('Extent that is NOT affected'),
  affectedCount: z.number().int().nonnegative().nullable().describe('Count of affected units if quantifiable'),
  severityLevel: severityScale,
})

// ─── Change Correlation ───────────────────────────────────────────────────────

export const releaseCorrelationSchema = z.object({
  releaseId: z.string(),
  releasedAt: z.string().datetime(),
  changeDescription: z.string(),
  correlationStrength: z.enum(['confirmed', 'likely', 'possible', 'unlikely', 'ruled-out']),
})

export type ReleaseCorrelation = z.infer<typeof releaseCorrelationSchema>

export const telemetryMarkerSchema = z.object({
  metric: z.string(),
  observedAt: z.string().datetime(),
  value: z.union([z.string(), z.number()]),
  baseline: z.union([z.string(), z.number()]).nullable(),
  deviationPct: z.number().nullable(),
})

export type TelemetryMarker = z.infer<typeof telemetryMarkerSchema>

// ─── Root Cause Hypothesis ────────────────────────────────────────────────────

export const rootCauseHypothesisSchema = z.object({
  id: z.string().uuid(),
  hypothesis: z.string().min(1),
  confidence: z.number().min(0).max(100).describe('Confidence score 0–100'),
  evidenceFor: z.array(z.string()),
  evidenceAgainst: z.array(z.string()),
  changeCorrelation: z.string().nullable().describe('Linked change/release ID if applicable'),
  status: z.enum(['proposed', 'testing', 'supported', 'refuted', 'confirmed']),
})

export type RootCauseHypothesis = z.infer<typeof rootCauseHypothesisSchema>

// ─── Mitigation Recommendation ───────────────────────────────────────────────

export const mitigationRecommendationSchema = z.object({
  id: z.string().uuid(),
  action: z.string().min(1),
  priority: severityScale,
  ownerId: z.string(),
  targetDate: z.string().datetime().nullable(),
  status: z.enum(['proposed', 'in-progress', 'completed', 'deferred']),
  evidenceRef: z.string().nullable(),
})

export type MitigationRecommendation = z.infer<typeof mitigationRecommendationSchema>

// ─── Problem Deviation Type ───────────────────────────────────────────────────

export const deviationTypeSchema = z.enum([
  'operational-deviation',
  'governance-drift',
  'continuity-failure',
  'release-regression',
  'institutional-fragility',
  'process-degradation',
  'dependency-concentration',
  'evidence-chain-degradation',
  'onboarding-velocity-collapse',
  'governance-entropy',
])

export type DeviationType = z.infer<typeof deviationTypeSchema>

export const confidenceSemanticsSchema = z.enum([
  'high',
  'moderate',
  'low',
  'insufficient-evidence',
])

export type ConfidenceSemantics = z.infer<typeof confidenceSemanticsSchema>

// ─── Problem Analysis ─────────────────────────────────────────────────────────

export const problemAnalysisSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().min(1),

  title: z.string().min(1).max(500),
  description: z.string().min(1),
  deviationType: deviationTypeSchema,

  // KT Is / Is Not framework
  what: whatDimensionSchema,
  where: whereDimensionSchema,
  when: whenDimensionSchema,
  extent: extentDimensionSchema,

  // Root cause analysis
  hypotheses: z.array(rootCauseHypothesisSchema),
  confirmedCause: z.string().nullable(),
  confirmedCauseHypothesisId: z.string().uuid().nullable(),

  // Timeline and evidence
  evidenceRefs: z.array(z.string()),
  releaseCorrelations: z.array(releaseCorrelationSchema),
  telemetryMarkers: z.array(telemetryMarkerSchema),

  // Governance linkage
  governanceReplayRef: z.string().nullable(),
  continuityImplications: z.array(z.string()),
  situationAssessmentRef: z.string().uuid().nullable(),

  // Mitigation
  mitigations: z.array(mitigationRecommendationSchema),

  // Analysis confidence (0–100)
  analysisConfidence: z.number().min(0).max(100),
  confidenceSemantics: confidenceSemanticsSchema,
  evidenceCompleteness: z.number().min(0).max(100),
  assumptionDensity: z.number().min(0),
  unresolvedUnknowns: z.number().int().nonnegative(),
  dependencyVolatility: z.enum(['low', 'moderate', 'high']),

  status: z.enum(['open', 'investigating', 'confirmed', 'mitigated', 'closed']),
  ownerId: z.string().min(1),

  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  closedAt: z.string().datetime().nullable(),
})

export type ProblemAnalysis = z.infer<typeof problemAnalysisSchema>

// ─── Input ────────────────────────────────────────────────────────────────────

export const problemAnalysisInputSchema = problemAnalysisSchema.omit({
  id: true,
  hypotheses: true,
  confirmedCause: true,
  confirmedCauseHypothesisId: true,
  mitigations: true,
  analysisConfidence: true,
  confidenceSemantics: true,
  evidenceCompleteness: true,
  assumptionDensity: true,
  unresolvedUnknowns: true,
  dependencyVolatility: true,
  createdAt: true,
  updatedAt: true,
  closedAt: true,
}).extend({
  evidenceRefs: z.array(z.string()).optional().default([]),
  releaseCorrelations: z.array(releaseCorrelationSchema).optional().default([]),
  telemetryMarkers: z.array(telemetryMarkerSchema).optional().default([]),
  continuityImplications: z.array(z.string()).optional().default([]),
  governanceReplayRef: z.string().nullable().optional().default(null),
  situationAssessmentRef: z.string().uuid().nullable().optional().default(null),
})

export type ProblemAnalysisInput = z.infer<typeof problemAnalysisInputSchema>
