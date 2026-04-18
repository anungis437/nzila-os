import { describe, expect, it, vi } from 'vitest'

import { evaluateDomainPolicy } from '@repo-root/packages/ai-control/src/domain-policy-packs'
import { recordAiReviewDecision } from '@repo-root/packages/ai-sdk/src/business-output'
import { generateMonthlyAIGovernanceEvidencePack } from '@repo-root/packages/platform-evidence-pack/src/ai-governance-monthly'
import { aggregateAiOperatingMetrics, type AiTelemetryRecord } from '@repo-root/packages/platform-metrics/src/ai-governance-metrics'

describe('AI governance operating intelligence contract proofs', () => {
  it('labour sensitive output requires review', () => {
    const decision = evaluateDomainPolicy({
      domain: 'labour',
      actionType: 'grievance_recommendation',
      confidenceScore: 0.81,
      hasEvidence: true,
    })

    expect(decision.reviewRequired).toBe(true)
    expect(decision.escalationTags).toContain('labour-sensitive-outcome')
  })

  it('finance low-confidence recommendation is blocked', () => {
    const decision = evaluateDomainPolicy({
      domain: 'finance',
      actionType: 'forecast',
      confidenceScore: 0.41,
      hasEvidence: true,
    })

    expect(decision.blocked).toBe(true)
    expect(decision.escalationTags).toContain('finance-low-confidence-block')
  })

  it('legal reviewer decision is recorded with rejection state', () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    try {
      recordAiReviewDecision({
        appKey: 'abr',
        orgId: 'org-legal-1',
        modelUsed: 'gpt-4.1-mini',
        engineVersion: 'azure-openai:gpt-4.1-mini',
        approved: false,
        overridden: false,
        requestId: 'req-legal-43',
      })

      const writes = stdoutSpy.mock.calls.map((call) => String(call[0] ?? ''))
      const metricLine = writes.find((line) => line.includes('nzila.ai.governance.metric'))

      expect(metricLine).toBeTruthy()
      expect(metricLine).toContain('"status":"rejected"')
      expect(metricLine).toContain('"appKey":"abr"')
    } finally {
      stdoutSpy.mockRestore()
    }
  })

  it('education cheating signal escalates for manual handling', () => {
    const decision = evaluateDomainPolicy({
      domain: 'education',
      actionType: 'grading_help',
      confidenceScore: 0.79,
      hasEvidence: true,
      cheatingSignal: true,
    })

    expect(decision.reviewRequired).toBe(true)
    expect(decision.escalationTags).toContain('cheating-integrity-escalation')
  })

  it('media payout anomaly is tagged for fraud escalation', () => {
    const decision = evaluateDomainPolicy({
      domain: 'media',
      actionType: 'payout_review',
      confidenceScore: 0.74,
      hasEvidence: true,
      payoutAnomalyDetected: true,
      impersonationFraudSignal: true,
    })

    expect(decision.reviewRequired).toBe(true)
    expect(decision.escalationTags).toContain('payout-anomaly-alert')
    expect(decision.escalationTags).toContain('impersonation-fraud-signal')
  })

  it('monthly immutable governance evidence pack is generated', () => {
    const pack = generateMonthlyAIGovernanceEvidencePack({
      orgId: 'org-proof-1',
      month: '2026-04',
      modelUsageSummary: { 'gpt-4.1-mini': 1244 },
      spendSummaryUsd: { 'union-eyes': 248.21, flow: 188.73 },
      latencySummaryMs: { p50: 520, p95: 1630 },
      incidents: [{ id: 'INC-9001', severity: 'warning', summary: 'provider timeout spike' }],
      overrides: { approvals: 74, overrides: 8, rejections: 11 },
      topRiskyPrompts: ['legal_missing_citation', 'finance_low_confidence'],
      blockedActions: 13,
      domainPolicyTriggers: { legal: 7, finance: 9, labour: 3 },
      dataRetentionCompliancePassed: true,
      configDriftDetected: false,
    })

    expect(pack.packId).toContain('AI-GOV-')
    expect(pack.immutableDigest).toMatch(/^[a-f0-9]{64}$/)
    expect(pack.artifacts.length).toBeGreaterThan(0)
  })

  it('telemetry aggregation computes cross-app operating metrics correctly', () => {
    const records: AiTelemetryRecord[] = [
      {
        timestamp: '2026-04-01T09:00:00.000Z',
        appKey: 'union-eyes',
        orgId: 'org-1',
        endpoint: '/ai/review',
        modelUsed: 'gpt-4.1-mini',
        provider: 'azure-openai',
        status: 'approved',
        latencyMs: 620,
        tokenCostUsd: 0.32,
        tokensIn: 520,
        tokensOut: 170,
        confidenceScore: 0.83,
        evidenceRefsCount: 2,
        reviewRequired: true,
        approved: true,
        conversionType: 'workflow',
        converted: true,
        queueName: 'ai-review',
        queueBacklog: 3,
      },
      {
        timestamp: '2026-04-01T10:00:00.000Z',
        appKey: 'cfo',
        orgId: 'org-2',
        endpoint: '/ai/advice',
        modelUsed: 'gpt-4.1-mini',
        provider: 'azure-openai',
        status: 'rejected',
        latencyMs: 1450,
        tokenCostUsd: 0.27,
        tokensIn: 610,
        tokensOut: 220,
        confidenceScore: 0.39,
        evidenceRefsCount: 0,
        reviewRequired: true,
        approved: false,
        conversionType: 'deal',
        converted: false,
        timedOut: true,
        retryCount: 1,
        providerFailure: true,
        errorClass: 'timeout',
        queueName: 'advice-review',
        queueBacklog: 7,
      },
      {
        timestamp: '2026-04-01T11:00:00.000Z',
        appKey: 'zonga',
        orgId: 'org-3',
        endpoint: '/ai/payout',
        modelUsed: 'gpt-4.1-mini',
        provider: 'azure-openai',
        status: 'error',
        latencyMs: 980,
        tokenCostUsd: 0.19,
        tokensIn: 440,
        tokensOut: 130,
        confidenceScore: 0.66,
        evidenceRefsCount: 1,
        reviewRequired: false,
        approved: null,
        conversionType: 'deal',
        converted: false,
        queueName: 'payments',
        queueBacklog: 12,
      },
    ]

    const aggregated = aggregateAiOperatingMetrics(records)

    expect(aggregated.recordCount).toBe(3)
    const totalSpend = Object.values(aggregated.byApp).reduce((sum, app) => sum + app.cost.tokenSpendUsd, 0)
    expect(totalSpend).toBeCloseTo(0.78, 3)
    expect(aggregated.byApp['cfo'].performance.timeoutPct).toBeGreaterThan(0)
    expect(aggregated.byApp['union-eyes'].quality.approvalRatePct).toBeGreaterThan(0)
    expect(aggregated.byApp['zonga'].operations.queueBacklog.payments).toBe(12)
  })
})
