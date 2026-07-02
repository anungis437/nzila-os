import { z } from 'zod'

// ─── Situation Category ──────────────────────────────────────────────────────

export const situationCategorySchema = z.enum([
  'security',
  'governance',
  'operational',
  'financial',
  'compliance',
  'continuity',
  'reputational',
])

export type SituationCategory = z.infer<typeof situationCategorySchema>

// ─── Severity Scale (1–5) ────────────────────────────────────────────────────

export const severityScale = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
])

export type SeverityScale = z.infer<typeof severityScale>

// ─── Trend ───────────────────────────────────────────────────────────────────

export const situationTrendSchema = z.enum([
  'stable',
  'improving',
  'worsening',
  'volatile',
])

export type SituationTrend = z.infer<typeof situationTrendSchema>

// ─── Situation Assessment ────────────────────────────────────────────────────

export const situationAssessmentSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().min(1),

  category: situationCategorySchema,
  concern: z.string().min(1).max(2000),

  urgency: severityScale,
  impact: severityScale,
  priorityScore: z.number().int().min(1).max(25), // urgency × impact

  trend: situationTrendSchema,

  evidenceRefs: z.array(z.string()),
  dependencies: z.array(z.string()),
  unknowns: z.array(z.string()),
  recommendedActions: z.array(z.string()),

  escalationThreshold: z.string().min(1),
  escalated: z.boolean().default(false),
  escalatedAt: z.string().datetime().nullable(),

  ownerId: z.string().min(1),
  continuityImplications: z.array(z.string()),

  status: z.enum(['open', 'monitoring', 'escalated', 'resolved']),

  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type SituationAssessment = z.infer<typeof situationAssessmentSchema>

// ─── Input (before system-assigned fields) ───────────────────────────────────

export const situationAssessmentInputSchema = situationAssessmentSchema.omit({
  id: true,
  priorityScore: true,
  escalated: true,
  escalatedAt: true,
  createdAt: true,
  updatedAt: true,
})

export type SituationAssessmentInput = z.infer<typeof situationAssessmentInputSchema>

// ─── Priority Matrix Entry ────────────────────────────────────────────────────

export const situationPriorityEntrySchema = z.object({
  assessment: situationAssessmentSchema,
  priorityRank: z.number().int().positive(),
  requiresEscalation: z.boolean(),
})

export type SituationPriorityEntry = z.infer<typeof situationPriorityEntrySchema>
