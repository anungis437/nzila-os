import { describe, expect, it } from 'vitest'
import { defaultDomainPolicyPacks, evaluateDomainPolicy } from './domain-policy-packs'

describe('evaluateDomainPolicy', () => {
  it('requires review for sensitive labour grievance recommendations', () => {
    const decision = evaluateDomainPolicy({
      domain: 'labour',
      actionType: 'grievance_recommendation',
      confidenceScore: 0.8,
      hasEvidence: true,
    })

    expect(decision.allowed).toBe(true)
    expect(decision.reviewRequired).toBe(true)
    expect(decision.escalationTags).toContain('labour-sensitive-outcome')
  })

  it('blocks low-confidence finance outputs', () => {
    const decision = evaluateDomainPolicy({
      domain: 'finance',
      actionType: 'forecast',
      confidenceScore: 0.4,
      hasEvidence: true,
    })

    expect(decision.allowed).toBe(false)
    expect(decision.blocked).toBe(true)
    expect(decision.requiredLabels).toContain('non-advisory')
    expect(decision.escalationTags).toContain('finance-low-confidence-block')
  })

  it('enforces legal citations when required', () => {
    const decision = evaluateDomainPolicy({
      domain: 'legal',
      actionType: 'legal_interpretation',
      confidenceScore: 0.82,
      hasEvidence: true,
      legalInterpretation: true,
      citationsRequired: true,
      citationsIncluded: false,
      riskTier: 'high',
    })

    expect(decision.allowed).toBe(false)
    expect(decision.reviewRequired).toBe(true)
    expect(decision.escalationTags).toContain('legal-citation-required')
    expect(decision.escalationTags).toContain('legal-risk-tier-routing')
  })

  it('escalates education cheating signals', () => {
    const decision = evaluateDomainPolicy({
      domain: 'education',
      actionType: 'grading_help',
      confidenceScore: 0.88,
      cheatingSignal: true,
      hasEvidence: true,
    })

    expect(decision.allowed).toBe(true)
    expect(decision.reviewRequired).toBe(true)
    expect(decision.escalationTags).toContain('cheating-integrity-escalation')
  })

  it('flags media payout anomaly and fraud signals', () => {
    const decision = evaluateDomainPolicy({
      domain: 'media',
      actionType: 'payout_review',
      confidenceScore: 0.79,
      payoutAnomalyDetected: true,
      impersonationFraudSignal: true,
      hasEvidence: true,
    })

    expect(decision.allowed).toBe(true)
    expect(decision.reviewRequired).toBe(true)
    expect(decision.escalationTags).toContain('payout-anomaly-alert')
    expect(decision.escalationTags).toContain('impersonation-fraud-signal')
  })

  it('supports versioned configurable overrides', () => {
    const pack = defaultDomainPolicyPacks.finance
    const decision = evaluateDomainPolicy(
      {
        domain: 'finance',
        actionType: 'forecast',
        confidenceScore: 0.62,
        hasEvidence: true,
      },
      {
        version: '2026.05.01',
        thresholds: {
          ...pack.thresholds,
          blockingConfidence: 0.6,
        },
      },
    )

    expect(decision.policyVersion).toBe('2026.05.01')
    expect(decision.blocked).toBe(false)
    expect(decision.reviewRequired).toBe(true)
  })
})
