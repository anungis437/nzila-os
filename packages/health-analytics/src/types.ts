import { z } from 'zod'

export const AnalyticsInput = z.object({
  organizationId: z.string(),
  siteId: z.string(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
})

export const DuplicateTestRisk = z.object({
  score: z.number().min(0).max(1),
  affectedPatientCount: z.number(),
  estimatedWastePercent: z.number(),
})

export const ReferralDelay = z.object({
  averageDaysToReferral: z.number(),
  p90DaysToReferral: z.number(),
  overdueReferralCount: z.number(),
})

export const IncompleteHistoryRate = z.object({
  rate: z.number().min(0).max(1),
  affectedPatientCount: z.number(),
  missingSourceSystems: z.array(z.string()),
})

export const AccessReviewCompletion = z.object({
  completionRate: z.number().min(0).max(1),
  overdueReviewCount: z.number(),
  lastReviewDate: z.string().optional(),
})

export type AnalyticsInput = z.infer<typeof AnalyticsInput>
export type DuplicateTestRisk = z.infer<typeof DuplicateTestRisk>
export type ReferralDelay = z.infer<typeof ReferralDelay>
export type IncompleteHistoryRate = z.infer<typeof IncompleteHistoryRate>
export type AccessReviewCompletion = z.infer<typeof AccessReviewCompletion>
