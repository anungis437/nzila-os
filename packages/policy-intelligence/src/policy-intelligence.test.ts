import { describe, expect, it } from 'vitest'

import { detectPolicyDrift, scorePolicy, suggestPolicyImprovements } from './index'
import type { DecisionAggregate } from '@nzila/decision-intelligence'

const aggregates: DecisionAggregate[] = [
  {
    organizationId: 'org-1',
    domain: 'commerce',
    decisionType: 'flow.quote.created',
    metrics: { total: 100, approvalRate: 0.82, rejectionRate: 0.1, escalationRate: 0.08, avgDecisionTimeMs: 900 },
    behavior: { overrideRate: 0.05, humanInterventionRate: 0.12 },
    policy: { version: '1.0.0', effectivenessScore: 0.79 },
    timeWindow: { start: '2026-05-01T00:00:00.000Z', end: '2026-05-31T00:00:00.000Z' },
  },
  {
    organizationId: 'org-2',
    domain: 'commerce',
    decisionType: 'flow.quote.created',
    metrics: { total: 100, approvalRate: 0.58, rejectionRate: 0.24, escalationRate: 0.18, avgDecisionTimeMs: 1800 },
    behavior: { overrideRate: 0.22, humanInterventionRate: 0.3 },
    policy: { version: '2.0.0', effectivenessScore: 0.41 },
    timeWindow: { start: '2026-06-01T00:00:00.000Z', end: '2026-06-30T00:00:00.000Z' },
  },
]

describe('@nzila/policy-intelligence', () => {
  it('scores policy effectiveness from aggregate behavior', () => {
    const score = scorePolicy({ decisionType: 'flow.quote.created', policyVersion: '1.0.0', aggregates })

    expect(score.successRate).toBe(0.82)
    expect(score.overrideRate).toBe(0.05)
    expect(score.effectivenessScore).toBe(0.79)
  })

  it('detects material drift between policy versions', () => {
    const drift = detectPolicyDrift({
      decisionType: 'flow.quote.created',
      oldVersion: '1.0.0',
      newVersion: '2.0.0',
      aggregates,
    })

    expect(drift.driftDetected).toBe(true)
    expect(drift.severity).toBe('high')
    expect(drift.deltas.effectivenessScore).toBeLessThan(0)
  })

  it('suggests policy adjustments from weak production characteristics', () => {
    const insight = suggestPolicyImprovements({
      decisionType: 'flow.quote.created',
      aggregates,
    })

    expect(insight.recommendations.length).toBeGreaterThan(0)
    expect(insight.confidenceScore).toBeGreaterThanOrEqual(0.4)
  })
})