import { z } from 'zod'

export const HealthcareSurveyQuestionTypeSchema = z.enum([
  'single_choice',
  'multiple_choice',
  'rating_1_5',
  'free_text',
  'yes_no_unsure',
])

export const HealthcareSurveyRiskLevelSchema = z.enum(['low', 'medium', 'sensitive'])

export const HealthcareSurveyStatusSchema = z.enum(['draft', 'active', 'closed', 'archived'])

export const HealthcareSurveyResponseReviewStatusSchema = z.enum([
  'unreviewed',
  'reviewed',
  'flagged_for_redaction',
])

export const HealthcareInsightTypeSchema = z.enum([
  'top_pain_point',
  'top_workflow',
  'adoption_concern',
  'evidence_gap',
  'pilot_recommendation',
  'privacy_risk',
  'other',
])

export const RecommendationConfidenceSchema = z.enum(['low', 'medium', 'high'])

export const RecommendedWedgeSchema = z.enum([
  'schedule_change_log',
  'open_shift_offer_trace',
  'shift_exchange_checklist',
  'agreement_review_prompts',
  'scheduling_event_timeline',
  'evidence_packet',
  'discovery_only',
])

export const HealthcareSurveyQuestionSchema = z.object({
  id: z.string(),
  surveyId: z.string().optional(),
  templateId: z.string().optional(),
  text: z.string(),
  helperText: z.string().optional(),
  type: HealthcareSurveyQuestionTypeSchema,
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
  maxSelections: z.number().int().positive().optional(),
  displayOrder: z.number().int().nonnegative(),
  mapsToWorkflow: z.string().optional(),
  riskLevel: HealthcareSurveyRiskLevelSchema.default('low'),
  avoidIdentifyingDetails: z.boolean().default(true),
  warningText: z.string().optional(),
})

export const HealthcareSurveyTemplateSchema = z.object({
  id: z.string(),
  key: z.string(),
  title: z.string(),
  description: z.string(),
  intendedUse: z.string(),
  estimatedMinutes: z.number().int().positive(),
  category: z.string(),
  introText: z.string(),
  questions: z.array(HealthcareSurveyQuestionSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const HealthcareSurveySchema = z.object({
  id: z.string(),
  orgId: z.string().nullable().optional(),
  campaignKey: z.string().nullable().optional(),
  campaignName: z.string().nullable().optional(),
  unitName: z.string(),
  siteName: z.string().nullable().optional(),
  localName: z.string(),
  championLabel: z.string(),
  championInternalOnly: z.boolean().default(true),
  title: z.string(),
  description: z.string(),
  audience: z.string().optional(),
  status: HealthcareSurveyStatusSchema,
  anonymous: z.boolean(),
  allowFreeText: z.boolean(),
  purposeStatement: z.string(),
  privacyNotice: z.string(),
  distributionMessage: z.string().optional(),
  internalNotes: z.string().optional(),
  shareToken: z.string().nullable().optional(),
  launchDate: z.string().nullable().optional(),
  closeDate: z.string().nullable().optional(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const HealthcareSurveyResponseSchema = z.object({
  id: z.string(),
  surveyId: z.string(),
  anonymousResponseId: z.string(),
  submittedAt: z.string(),
  answers: z.record(z.string(), z.unknown()),
  workflowScores: z.record(z.string(), z.number()),
  topPriority: z.string().nullable().optional(),
  concernTags: z.array(z.string()).default([]),
  containsFreeText: z.boolean().default(false),
  reviewStatus: HealthcareSurveyResponseReviewStatusSchema.default('unreviewed'),
  redactionNote: z.string().nullable().optional(),
  createdAt: z.string(),
})

export const HealthcareSurveyInsightSchema = z.object({
  id: z.string(),
  surveyId: z.string(),
  insightType: HealthcareInsightTypeSchema,
  title: z.string(),
  summary: z.string(),
  supportingMetric: z.number().nullable().optional(),
  supportingCount: z.number().int().nullable().optional(),
  confidence: RecommendationConfidenceSchema,
  recommendedAction: z.string(),
  createdAt: z.string(),
})

export const HealthcarePilotRecommendationSchema = z.object({
  surveyId: z.string(),
  recommendedWedge: RecommendedWedgeSchema,
  title: z.string(),
  rationale: z.string(),
  supportingScores: z.record(z.string(), z.number()),
  adoptionRisks: z.array(z.string()),
  confidence: RecommendationConfidenceSchema,
  recommendedNextStep: z.string(),
})

export type HealthcareSurveyQuestion = z.infer<typeof HealthcareSurveyQuestionSchema>
export type HealthcareSurveyTemplate = z.infer<typeof HealthcareSurveyTemplateSchema>
export type HealthcareSurvey = z.infer<typeof HealthcareSurveySchema>
export type HealthcareSurveyResponse = z.infer<typeof HealthcareSurveyResponseSchema>
export type HealthcareSurveyInsight = z.infer<typeof HealthcareSurveyInsightSchema>
export type HealthcarePilotRecommendation = z.infer<typeof HealthcarePilotRecommendationSchema>

export type WorkflowKey =
  | 'scheduling_clarity'
  | 'consistency_confidence'
  | 'friction_areas'
  | 'evidence_gap'
  | 'reconstruction_difficulty'
  | 'current_tracking_methods'
  | 'schedule_change_tracking'
  | 'open_shift_transparency'
  | 'shift_exchange_clarity'
  | 'agreement_review_prompts'
  | 'evidence_timeline'
  | 'evidence_packet'
  | 'first_pilot_wedge'
  | 'paired_workflow_signal'
  | 'adoption_concerns'
  | 'qualitative_feedback'
  | 'unit_specific_context'
