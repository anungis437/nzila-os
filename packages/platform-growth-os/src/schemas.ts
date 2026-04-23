/**
 * @nzila/platform-growth-os — Zod schemas mirroring `./types`.
 *
 * Every record is zod-validated on every store read and write.
 */
import { z } from 'zod'

export const growthScopeSchema = z.object({
  tenantId: z.string().min(1),
  orgId: z.string().min(1),
  product: z.string().min(1).optional(),
})

export const trustPostureSchema = z.enum(['evidence-first', 'proof-first', 'neutral'])

export const brandVoiceSchema = z.object({
  id: z.string().min(1),
  scope: growthScopeSchema,
  label: z.string().min(1),
  tone: z.array(z.string().min(1)),
  forbiddenPhrases: z.array(z.string()),
  trustPosture: trustPostureSchema,
  requiredDisclosures: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const campaignChannelSchema = z.enum([
  'email',
  'landing_page',
  'partner_co_sell',
  'founder_outbound',
  'enterprise_procurement',
  'event',
  'paid',
])

export const campaignStatusSchema = z.enum([
  'draft',
  'scheduled',
  'live',
  'paused',
  'completed',
  'archived',
])

export const campaignSchema = z.object({
  id: z.string().min(1),
  scope: growthScopeSchema,
  name: z.string().min(1),
  objective: z.string().min(1),
  channels: z.array(campaignChannelSchema).min(1),
  audienceSegmentIds: z.array(z.string()),
  brandVoiceId: z.string().min(1),
  offerIds: z.array(z.string()),
  ownerId: z.string().optional(),
  status: campaignStatusSchema,
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  tags: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const audiencePredicateSchema = z.object({
  field: z.string().min(1),
  op: z.enum(['eq', 'in', 'gte', 'lte', 'has_tag', 'matches']),
  value: z.union([z.string(), z.number(), z.array(z.string())]),
})

export const audienceSegmentSchema = z.object({
  id: z.string().min(1),
  scope: growthScopeSchema,
  label: z.string().min(1),
  description: z.string(),
  predicates: z.array(audiencePredicateSchema),
  estimatedSize: z.number().int().nonnegative().optional(),
  estimatedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const campaignRunResultSchema = z.object({
  reached: z.number().int().nonnegative(),
  responded: z.number().int().nonnegative(),
  converted: z.number().int().nonnegative(),
  pipelineCreated: z.number().nonnegative().optional(),
  notes: z.string().optional(),
})

export const campaignRunSchema = z.object({
  id: z.string().min(1),
  scope: growthScopeSchema,
  campaignId: z.string().min(1),
  contentAssetId: z.string().min(1),
  audienceSize: z.number().int().nonnegative(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  result: campaignRunResultSchema.optional(),
})

export const approvalStateSchema = z.enum(['draft', 'in_review', 'approved', 'rejected'])

export const contentAssetSchema = z.object({
  id: z.string().min(1),
  scope: growthScopeSchema,
  campaignId: z.string().optional(),
  brandVoiceId: z.string().min(1),
  channel: campaignChannelSchema,
  kind: z.enum([
    'email_copy',
    'landing_page_brief',
    'one_pager',
    'objection_card',
    'sequence',
    'roi_packet',
    'partner_kit',
    'social_post',
  ]),
  title: z.string().min(1),
  body: z.string(),
  sources: z.array(z.string()),
  approval: approvalStateSchema,
  approvedBy: z.string().optional(),
  approvedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  version: z.number().int().positive(),
})

export const offerComponentSchema = z.object({
  kind: z.enum([
    'roi_brief',
    'security_one_pager',
    'pilot_offer',
    'demo_script',
    'objection_pack',
    'trust_link',
  ]),
  ref: z.string().min(1),
})

export const commercialOfferSchema = z.object({
  id: z.string().min(1),
  scope: growthScopeSchema,
  label: z.string().min(1),
  product: z.string().min(1),
  buyerType: z.string().min(1),
  pilotDurationDays: z.number().int().positive().optional(),
  pilotPriceCad: z.number().nonnegative().optional(),
  annualPriceLowCad: z.number().nonnegative().optional(),
  annualPriceHighCad: z.number().nonnegative().optional(),
  components: z.array(offerComponentSchema),
  approval: approvalStateSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const leadStageSchema = z.enum([
  'unscored',
  'cold',
  'warming',
  'engaged',
  'qualified',
  'in_pilot',
  'paid',
  'expansion',
  'churn_risk',
  'dormant',
])

export const leadScoreSchema = z.object({
  id: z.string().min(1),
  scope: growthScopeSchema,
  subjectKind: z.enum(['contact', 'opportunity', 'partner_deal', 'pilot']),
  subjectId: z.string().min(1),
  score: z.number().min(0).max(1),
  stage: leadStageSchema,
  confidence: z.number().min(0).max(1),
  contributions: z.array(
    z.object({
      feature: z.string(),
      weight: z.number(),
      value: z.number(),
      contribution: z.number(),
    }),
  ),
  modelVersion: z.string().min(1),
  scoredAt: z.string().datetime(),
})

export const attributionEventSchema = z.object({
  id: z.string().min(1),
  scope: growthScopeSchema,
  subjectKind: z.enum(['contact', 'opportunity', 'pilot', 'deal']),
  subjectId: z.string().min(1),
  kind: z.enum([
    'campaign_touch',
    'partner_referral',
    'organic_visit',
    'founder_outreach',
    'demo_attended',
    'pilot_started',
    'opportunity_created',
    'quote_sent',
    'deal_closed_won',
    'deal_closed_lost',
  ]),
  channel: campaignChannelSchema.optional(),
  campaignRunId: z.string().optional(),
  partnerId: z.string().optional(),
  revenueCad: z.number().nonnegative().optional(),
  occurredAt: z.string().datetime(),
  recordedAt: z.string().datetime(),
})

export const proofRequestSchema = z.object({
  id: z.string().min(1),
  scope: growthScopeSchema,
  subjectKind: z.enum(['pilot', 'opportunity', 'partner_deal']),
  subjectId: z.string().min(1),
  proofKind: z.enum(['testimonial', 'case_study', 'reference_call', 'logo', 'kpi_baseline']),
  customerLabel: z.string().optional(),
  status: z.enum([
    'requested',
    'awaiting_permission',
    'permission_granted',
    'awaiting_quote',
    'awaiting_kpi',
    'awaiting_legal',
    'ready_to_publish',
    'published',
    'declined',
    'cancelled',
  ]),
  kpiBaselines: z.array(
    z.object({
      metric: z.string().min(1),
      baselineValue: z.number(),
      observedValue: z.number().optional(),
      unit: z.string().min(1),
      capturedAt: z.string().datetime().optional(),
    }),
  ),
  quoteText: z.string().optional(),
  quoteAttribution: z.string().optional(),
  permission: z
    .object({
      grantedBy: z.string().min(1),
      grantedAt: z.string().datetime(),
      scope: z.enum(['logo_only', 'name_quote', 'full_case_study', 'reference_call']),
      expiresAt: z.string().datetime().optional(),
    })
    .optional(),
  publishedAt: z.string().datetime().optional(),
  publishedRef: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const founderTopicSchema = z.object({
  id: z.string().min(1),
  scope: growthScopeSchema,
  ownerId: z.string().min(1),
  theme: z.string().min(1),
  audiences: z.array(z.enum(['investor', 'partner', 'customer', 'media', 'community'])),
  talkingPoints: z.array(z.string()),
  sources: z.array(z.string()),
  cadenceDays: z.number().int().positive(),
  lastSurfacedAt: z.string().datetime().optional(),
  status: z.enum(['active', 'snoozed', 'retired']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const auditEntrySchema = z.object({
  id: z.string().min(1),
  scope: growthScopeSchema,
  actor: z.string().min(1),
  action: z.string().min(1),
  subjectKind: z.string().min(1),
  subjectId: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
  occurredAt: z.string().datetime(),
})
