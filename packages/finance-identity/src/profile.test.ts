import { describe, it, expect } from 'vitest'
import { createProfile, updateRiskScore, isEligibleForTransactions } from './profile.js'

describe('createProfile', () => {
  it('creates profile with defaults', () => {
    const profile = createProfile({
      orgId: 'org-1',
      subjectId: 'user-1',
      subjectType: 'user',
      displayName: 'Test User',
    })
    expect(profile.kycStatus).toBe('not_started')
    expect(profile.sanctionsStatus).toBe('not_screened')
    expect(profile.riskTier).toBe('low')
  })
})

describe('isEligibleForTransactions', () => {
  it('returns true for approved, clear, non-critical profile', () => {
    const profile = createProfile({
      orgId: 'org-1',
      subjectId: 'user-1',
      subjectType: 'user',
      displayName: 'Test User',
      kycStatus: 'approved',
      sanctionsStatus: 'clear',
      riskTier: 'low',
    })
    expect(isEligibleForTransactions(profile)).toBe(true)
  })

  it('returns false for unapproved KYC', () => {
    const profile = createProfile({
      orgId: 'org-1',
      subjectId: 'user-1',
      subjectType: 'user',
      displayName: 'Test User',
      kycStatus: 'pending',
      sanctionsStatus: 'clear',
      riskTier: 'low',
    })
    expect(isEligibleForTransactions(profile)).toBe(false)
  })

  it('returns false for flagged sanctions', () => {
    const profile = createProfile({
      orgId: 'org-1',
      subjectId: 'user-1',
      subjectType: 'user',
      displayName: 'Test User',
      kycStatus: 'approved',
      sanctionsStatus: 'flagged',
      riskTier: 'low',
    })
    expect(isEligibleForTransactions(profile)).toBe(false)
  })

  it('returns false for critical risk tier', () => {
    const profile = createProfile({
      orgId: 'org-1',
      subjectId: 'user-1',
      subjectType: 'user',
      displayName: 'Test User',
      kycStatus: 'approved',
      sanctionsStatus: 'clear',
      riskTier: 'critical',
    })
    expect(isEligibleForTransactions(profile)).toBe(false)
  })

  it('updates risk score and tier', () => {
    const profile = createProfile({
      orgId: 'org-1',
      subjectId: 'user-1',
      subjectType: 'user',
      displayName: 'Test User',
    })
    const score = {
      profileId: profile.id,
      score: 85,
      tier: 'high' as const,
      factors: ['high_transactions'],
      computedAt: new Date().toISOString(),
    }
    const updated = updateRiskScore(profile, score)
    expect(updated.riskTier).toBe('high')
  })
})
