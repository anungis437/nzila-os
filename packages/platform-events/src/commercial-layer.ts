import { z } from 'zod'

// Canonical cross-app lead envelope used by Flow, Zonga, and WeekOne.
export const sharedLeadCaptureSchema = z.object({
  appId: z.enum(['flow', 'zonga', 'weekone']),
  source: z.string().min(1),
  email: z.string().email(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  company: z.string().min(1).optional(),
  phone: z.string().min(5).optional(),
  campaign: z.string().min(1).optional(),
  locale: z.string().min(2).optional(),
  metadata: z.record(z.unknown()).optional(),
})

export type SharedLeadCaptureInput = z.infer<typeof sharedLeadCaptureSchema>

export const sharedCrmEventSchema = z.object({
  eventName: z.enum([
    'commercial.lead.created',
    'commercial.trial.started',
    'commercial.trial.activated',
    'commercial.subscription.started',
    'commercial.subscription.upgraded',
    'commercial.subscription.cancelled',
  ]),
  occurredAt: z.string().datetime(),
  appId: z.enum(['flow', 'zonga', 'weekone']),
  orgId: z.string().uuid().optional(),
  actorId: z.string().min(1).optional(),
  lead: sharedLeadCaptureSchema.partial().optional(),
  payload: z.record(z.unknown()).default({}),
})

export type SharedCrmEventInput = z.infer<typeof sharedCrmEventSchema>

// Shared analytics naming convention for commercial conversion moments.
export const COMMERCIAL_ANALYTICS_EVENTS = {
  FLOW_UPGRADE_CLICKED: 'flow.upgrade.clicked',
  FLOW_PLAN_CHANGED: 'flow.plan.changed',
  ZONGA_REFERRAL_SHARED: 'zonga.referral.shared',
  ZONGA_DEMO_SEEDED: 'zonga.demo.seeded',
  WEEKONE_UPGRADE_PROMPT_VIEWED: 'weekone.upgrade_prompt.viewed',
  WEEKONE_REFERRAL_SUBMITTED: 'weekone.referral.submitted',
  WEEKONE_INVITE_SENT: 'weekone.invite.sent',
} as const

export type CommercialAnalyticsEventName =
  (typeof COMMERCIAL_ANALYTICS_EVENTS)[keyof typeof COMMERCIAL_ANALYTICS_EVENTS]

export const SHARED_NOTIFICATION_CHANNELS = ['email', 'sms'] as const
export type SharedNotificationChannel = (typeof SHARED_NOTIFICATION_CHANNELS)[number]

export const sharedReferralAttributionSchema = z.object({
  referrerId: z.string().min(1),
  refereeEmail: z.string().email(),
  appId: z.enum(['flow', 'zonga', 'weekone']),
  campaign: z.string().min(1),
  conversionValueCents: z.number().int().min(0).optional(),
  convertedAt: z.string().datetime().optional(),
})

export type SharedReferralAttribution = z.infer<typeof sharedReferralAttributionSchema>

export const sharedAnalyticsDashboardRowSchema = z.object({
  appId: z.enum(['flow', 'zonga', 'weekone']),
  metric: z.string().min(1),
  value: z.number(),
  period: z.string().min(1),
  growthRatePct: z.number().optional(),
})

export type SharedAnalyticsDashboardRow = z.infer<typeof sharedAnalyticsDashboardRowSchema>
