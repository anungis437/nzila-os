import { describe, expect, it } from 'vitest'
import {
  buildAIGovernanceTrendSummary,
  generateMonthlyAIGovernanceEvidencePack,
} from '../ai-governance-monthly'

describe('generateMonthlyAIGovernanceEvidencePack', () => {
  it('creates immutable monthly governance artifacts', () => {
    const pack = generateMonthlyAIGovernanceEvidencePack({
      orgId: '00000000-0000-0000-0000-000000000000',
      month: '2026-04',
      modelUsageSummary: { 'azure-openai:gpt-4.1-mini': 420 },
      spendSummaryUsd: { 'union-eyes': 120.5, cfo: 88.12 },
      latencySummaryMs: { p50: 640, p95: 1680 },
      incidents: [{ id: 'inc-1', severity: 'warning', summary: 'retry spike' }],
      overrides: { approvals: 72, overrides: 11, rejections: 6 },
      topRiskyPrompts: ['discipline recommendation template', 'forecast certainty wording'],
      blockedActions: 13,
      domainPolicyTriggers: {
        labour: 9,
        finance: 12,
        legal: 4,
        education: 5,
        media: 6,
      },
      dataRetentionCompliancePassed: true,
      configDriftDetected: false,
    })

    expect(pack.packId.startsWith('AI-GOV-2026-04-')).toBe(true)
    expect(pack.immutableDigest).toMatch(/^[a-f0-9]{64}$/)
    expect(pack.artifacts).toHaveLength(3)
    expect(pack.artifacts.every((artifact) => artifact.sha256.length === 64)).toBe(true)
  })
})

describe('buildAIGovernanceTrendSummary', () => {
  it('produces 3/6/12 month trend windows', () => {
    const summary = buildAIGovernanceTrendSummary([
      { month: '2025-05', spendUsd: 90, p95LatencyMs: 1800, incidents: 5, overrideRatePct: 8, blockedActions: 13 },
      { month: '2025-06', spendUsd: 88, p95LatencyMs: 1760, incidents: 4, overrideRatePct: 7, blockedActions: 12 },
      { month: '2025-07', spendUsd: 92, p95LatencyMs: 1700, incidents: 4, overrideRatePct: 7, blockedActions: 11 },
      { month: '2025-08', spendUsd: 94, p95LatencyMs: 1680, incidents: 3, overrideRatePct: 6, blockedActions: 10 },
      { month: '2025-09', spendUsd: 96, p95LatencyMs: 1650, incidents: 3, overrideRatePct: 6, blockedActions: 9 },
      { month: '2025-10', spendUsd: 100, p95LatencyMs: 1600, incidents: 2, overrideRatePct: 5, blockedActions: 8 },
      { month: '2025-11', spendUsd: 102, p95LatencyMs: 1560, incidents: 2, overrideRatePct: 5, blockedActions: 7 },
      { month: '2025-12', spendUsd: 103, p95LatencyMs: 1540, incidents: 2, overrideRatePct: 4.5, blockedActions: 7 },
      { month: '2026-01', spendUsd: 106, p95LatencyMs: 1490, incidents: 2, overrideRatePct: 4.2, blockedActions: 6 },
      { month: '2026-02', spendUsd: 108, p95LatencyMs: 1450, incidents: 1, overrideRatePct: 4, blockedActions: 6 },
      { month: '2026-03', spendUsd: 111, p95LatencyMs: 1410, incidents: 1, overrideRatePct: 3.9, blockedActions: 5 },
      { month: '2026-04', spendUsd: 115, p95LatencyMs: 1380, incidents: 1, overrideRatePct: 3.7, blockedActions: 4 },
    ])

    expect(summary.window3m.avgSpendUsd).toBe(111.33)
    expect(summary.window3m.totalIncidents).toBe(3)
    expect(summary.window6m.totalBlockedActions).toBe(35)
    expect(summary.window12m.avgP95LatencyMs).toBe(1585)
    expect(summary.window12m.avgOverrideRatePct).toBe(5.36)
  })
})
