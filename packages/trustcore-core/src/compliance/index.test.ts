import { describe, expect, it } from 'vitest'

import { dashboardSummaryFromEvaluation, evaluateLaw25Compliance } from './index'
import type { Law25Inputs } from './types'

const ORG = 'org-test'

function emptyInputs(): Law25Inputs {
  return {
    programs: [],
    assets: [],
    pias: [],
    incidents: [],
    dsrRequests: [],
    vendors: [],
  }
}

describe('evaluateLaw25Compliance', () => {
  it('returns deterministic shape for fully-empty inputs', () => {
    const result = evaluateLaw25Compliance(ORG, emptyInputs())
    expect(result.orgId).toBe(ORG)
    expect(typeof result.score).toBe('number')
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
    expect(['compliant', 'at-risk', 'non-compliant']).toContain(result.status)
    expect(Array.isArray(result.risks)).toBe(true)
    expect(result.risks.some((r) => r.id === 'gov-no-program' && r.blocking)).toBe(true)
    expect(result.summary).toEqual({
      totalAssets: 0,
      missingPias: 0,
      overdueRequests: 0,
      openIncidents: 0,
      highRiskVendors: 0,
    })
  })

  it('produces a high score for a well-governed minimal program', () => {
    const inputs: Law25Inputs = {
      ...emptyInputs(),
      programs: [
        { status: 'active', privacyOfficerEmail: 'po@example.com' },
      ],
      assets: [
        {
          id: 'asset-1',
          status: 'active',
          sensitivityLevel: 'low',
          crossBorderTransfer: false,
          destinationCountry: null,
        },
      ],
    }
    const result = evaluateLaw25Compliance(ORG, inputs)
    expect(result.score).toBeGreaterThanOrEqual(85)
    expect(result.risks.find((r) => r.id === 'gov-no-program')).toBeUndefined()
  })

  it('flags a serious-harm incident not reported to CAI as blocking', () => {
    const now = new Date()
    const inputs: Law25Inputs = {
      ...emptyInputs(),
      programs: [{ status: 'active', privacyOfficerEmail: 'po@example.com' }],
      incidents: [
        {
          id: 'inc-1',
          severity: 'critical',
          resolutionStatus: 'open',
          seriousHarmLikely: true,
          reportedToCai: false,
          dateDetected: new Date(now.getTime() - 96 * 60 * 60 * 1000),
          createdAt: new Date(now.getTime() - 96 * 60 * 60 * 1000),
        },
      ],
    }
    const result = evaluateLaw25Compliance(ORG, inputs)
    expect(result.risks.some((r) => r.blocking && r.category === 'incident')).toBe(true)
    expect(result.summary.openIncidents).toBe(1)
  })
})

describe('dashboardSummaryFromEvaluation', () => {
  it('returns not_ready when blocking risks present', () => {
    const evaluation = evaluateLaw25Compliance(ORG, emptyInputs())
    const summary = dashboardSummaryFromEvaluation(evaluation, {
      incidents: [],
      dsrRequests: [],
    })
    expect(summary.orgId).toBe(ORG)
    expect(summary.complianceScore).toBe(evaluation.score)
    expect(summary.auditReadinessStatus).toBe('not_ready')
  })

  it('returns ready for high score with no blocking risks', () => {
    const inputs: Law25Inputs = {
      ...emptyInputs(),
      programs: [{ status: 'active', privacyOfficerEmail: 'po@example.com' }],
      assets: [
        {
          id: 'asset-1',
          status: 'active',
          sensitivityLevel: 'low',
          crossBorderTransfer: false,
          destinationCountry: null,
        },
      ],
    }
    const evaluation = evaluateLaw25Compliance(ORG, inputs)
    const summary = dashboardSummaryFromEvaluation(evaluation, {
      incidents: [],
      dsrRequests: [],
    })
    expect(summary.auditReadinessStatus).toBe('ready')
  })
})
