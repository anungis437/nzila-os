import { describe, it, expect, beforeEach } from 'vitest'
import { computeRiskTier } from './risk.js'
import { ConsentService } from './consent.js'

describe('computeRiskTier', () => {
  it('returns low for empty factors', () => {
    expect(computeRiskTier([])).toBe('low')
  })

  it('returns low for low weighted score', () => {
    const tier = computeRiskTier([
      { name: 'age', weight: 1, value: 10 },
      { name: 'history', weight: 1, value: 5 },
    ])
    expect(tier).toBe('low')
  })

  it('returns medium for medium weighted score', () => {
    const tier = computeRiskTier([{ name: 'factor', weight: 1, value: 40 }])
    expect(tier).toBe('medium')
  })

  it('returns high for high weighted score', () => {
    const tier = computeRiskTier([{ name: 'factor', weight: 1, value: 60 }])
    expect(tier).toBe('high')
  })

  it('returns critical for critical weighted score', () => {
    const tier = computeRiskTier([{ name: 'factor', weight: 1, value: 90 }])
    expect(tier).toBe('critical')
  })
})

describe('ConsentService', () => {
  let service: ConsentService

  beforeEach(() => {
    service = new ConsentService()
  })

  it('records active consent', () => {
    const record = service.recordConsent('org-1', 'user-1', 'data_processing', true)
    expect(service.isConsentActive(record)).toBe(true)
  })

  it('records refused consent as inactive', () => {
    const record = service.recordConsent('org-1', 'user-1', 'marketing', false)
    expect(service.isConsentActive(record)).toBe(false)
  })

  it('revoked consent is inactive', () => {
    const record = service.recordConsent('org-1', 'user-1', 'data_processing', true)
    const revoked = service.revokeConsent('org-1', record.id)
    expect(service.isConsentActive(revoked)).toBe(false)
  })

  it('expired consent is inactive', () => {
    const past = new Date(Date.now() - 1000).toISOString()
    const record = service.recordConsent('org-1', 'user-1', 'data_processing', true, past)
    expect(service.isConsentActive(record)).toBe(false)
  })
})
