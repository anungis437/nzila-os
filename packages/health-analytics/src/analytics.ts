import type {
  AnalyticsInput,
  DuplicateTestRisk,
  ReferralDelay,
  IncompleteHistoryRate,
  AccessReviewCompletion,
} from './types.js'

/** Returns synthetic demo values. Wire to real connector data for production use. */
export function duplicateTestRisk(_input: AnalyticsInput): DuplicateTestRisk {
  return {
    score: 0.12,
    affectedPatientCount: 3,
    estimatedWastePercent: 8.5,
  }
}

/** Returns synthetic demo values. Wire to real connector data for production use. */
export function referralDelay(_input: AnalyticsInput): ReferralDelay {
  return {
    averageDaysToReferral: 4.2,
    p90DaysToReferral: 11.0,
    overdueReferralCount: 1,
  }
}

/** Returns synthetic demo values. Wire to real connector data for production use. */
export function incompleteHistoryRate(_input: AnalyticsInput): IncompleteHistoryRate {
  return {
    rate: 0.07,
    affectedPatientCount: 2,
    missingSourceSystems: ['hl7v2'],
  }
}

/** Returns synthetic demo values. Wire to real connector data for production use. */
export function accessReviewCompletion(_input: AnalyticsInput): AccessReviewCompletion {
  return {
    completionRate: 0.92,
    overdueReviewCount: 0,
    lastReviewDate: '2024-12-01',
  }
}
