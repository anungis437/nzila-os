import { describe, it, expect } from 'vitest'
import {
  duplicateTestRisk,
  referralDelay,
  incompleteHistoryRate,
  accessReviewCompletion,
} from '../analytics.js'
import type { AnalyticsInput } from '../types.js'

const input: AnalyticsInput = {
  organizationId: 'org-001',
  siteId: 'site-001',
}

describe('duplicateTestRisk', () => {
  it('returns score between 0 and 1', () => {
    const result = duplicateTestRisk(input)
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(1)
  })

  it('returns numeric affectedPatientCount and estimatedWastePercent', () => {
    const result = duplicateTestRisk(input)
    expect(typeof result.affectedPatientCount).toBe('number')
    expect(typeof result.estimatedWastePercent).toBe('number')
  })
})

describe('referralDelay', () => {
  it('returns numeric delay values', () => {
    const result = referralDelay(input)
    expect(typeof result.averageDaysToReferral).toBe('number')
    expect(typeof result.p90DaysToReferral).toBe('number')
    expect(typeof result.overdueReferralCount).toBe('number')
  })

  it('p90 is >= average', () => {
    const result = referralDelay(input)
    expect(result.p90DaysToReferral).toBeGreaterThanOrEqual(result.averageDaysToReferral)
  })
})

describe('incompleteHistoryRate', () => {
  it('returns rate between 0 and 1', () => {
    const result = incompleteHistoryRate(input)
    expect(result.rate).toBeGreaterThanOrEqual(0)
    expect(result.rate).toBeLessThanOrEqual(1)
  })

  it('returns an array of missing source systems', () => {
    const result = incompleteHistoryRate(input)
    expect(Array.isArray(result.missingSourceSystems)).toBe(true)
  })
})

describe('accessReviewCompletion', () => {
  it('returns completionRate between 0 and 1', () => {
    const result = accessReviewCompletion(input)
    expect(result.completionRate).toBeGreaterThanOrEqual(0)
    expect(result.completionRate).toBeLessThanOrEqual(1)
  })

  it('returns numeric overdueReviewCount', () => {
    const result = accessReviewCompletion(input)
    expect(typeof result.overdueReviewCount).toBe('number')
  })
})
