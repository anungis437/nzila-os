import { describe, expect, it } from 'vitest'

import {
  buildCapitalAllocation,
  buildCapitalAlerts,
  evaluateScenarioStack,
  type CapitalCashCalendar,
  type CapitalCatalog,
  type CapitalProduct,
  type CapitalWeights,
} from '../scripts/lib/capital-allocation'
import type { ProductLiveSignals } from '../scripts/lib/capital-live-signals'
import { findRepoRoot } from '../scripts/lib/portfolio-governance'

const weights: CapitalWeights = {
  revenue: 0.3,
  margin: 0.15,
  pipeline: 0.2,
  strategic: 0.15,
  efficiency: 0.1,
  risk_penalty: 0.1,
}

function makeProduct(overrides: Partial<CapitalProduct>): CapitalProduct {
  return {
    id: 'flow',
    name: 'Flow',
    tier: 1,
    status: 'pilot',
    proof_level: 'pilot-proof',
    gtm_posture: 'sell-now',
    strategic_role: 'SMB operating wedge',
    monthly_burn: 12000,
    monthly_revenue: 10000,
    annual_recurring_revenue: 120000,
    pipeline_value: 220000,
    expected_12m_revenue: 300000,
    gross_margin_pct: 78,
    eng_hours_required_monthly: 90,
    founder_attention_hours: 24,
    support_hours: 18,
    customer_concentration_risk: 4,
    execution_risk: 4,
    churn_risk: 3,
    moat_score: 8,
    strategic_option_value: 8,
    ecosystem_synergy: 8,
    probability_of_close: 0.45,
    runway_priority: 9,
    pipeline_assumptions: 'Qualified near-term pipeline',
    data_quality: 'estimated',
    customers: 1,
    pilots: 1,
    deployment: 'internal',
    owner: 'Nzila Ventures',
    priority: 'high',
    revenue_status: 'pilot-contracting',
    last_reviewed: '2026-04-19',
    ...overrides,
  } as CapitalProduct
}

function makeSignals(product: CapitalProduct, confidencePct: number, sourceType: 'live' | 'estimate' = 'live'): Map<string, ProductLiveSignals> {
  const confidence = sourceType === 'live' ? 'HIGH' : 'LOW'
  return new Map([
    [product.id, {
      productId: product.id,
      confidencePct,
      connectors: [],
      engineeringSignals: {
        commitCount30d: 12,
        bugLoad30d: 1,
        cycleTimeHours: 48,
        releaseCadencePerWeek: 3,
      },
      metrics: {
        monthly_revenue_actual: { key: 'monthly_revenue_actual', value: product.monthly_revenue, source: sourceType, sourceType, confidence, observedAt: '2026-04-19' },
        pipeline_actual: { key: 'pipeline_actual', value: product.pipeline_value, source: sourceType, sourceType, confidence, observedAt: '2026-04-19' },
        collections_outstanding: { key: 'collections_outstanding', value: 12000, source: sourceType, sourceType, confidence, observedAt: '2026-04-19' },
        active_users: { key: 'active_users', value: 1200, source: sourceType, sourceType, confidence, observedAt: '2026-04-19' },
        engineering_velocity: { key: 'engineering_velocity', value: 78, source: sourceType, sourceType, confidence, observedAt: '2026-04-19' },
      },
    }],
  ])
}

describe('capital engine v2', () => {
  it('low confidence reduces score', () => {
    const product = makeProduct({})
    const highConfidence = buildCapitalAllocation([product], weights, { liveSignals: makeSignals(product, 92, 'live') })
    const lowConfidence = buildCapitalAllocation([product], weights, { liveSignals: makeSignals(product, 28, 'estimate') })

    expect(lowConfidence[0].composite_allocation_score).toBeLessThan(highConfidence[0].composite_allocation_score)
    expect(lowConfidence[0].confidence_penalty_score).toBeGreaterThan(highConfidence[0].confidence_penalty_score)
  })

  it('override logs persist into final decisions', () => {
    const product = makeProduct({ id: 'zonga', name: 'Zonga', tier: 4, status: 'incubating', gtm_posture: 'hold', proof_level: 'none', monthly_revenue: 0, pipeline_value: 30000 })
    const scores = buildCapitalAllocation([product], weights, {
      liveSignals: makeSignals(product, 25, 'estimate'),
      overrides: {
        overrides: [{
          date: '2026-04-19',
          product: 'zonga',
          engine_recommendation: 'pause',
          override_decision: 'incubate lightly',
          reason: 'strategic creator upside',
          owner: 'CEO',
        }],
      },
    })

    expect(scores[0].final_decision).toBe('INCUBATE LIGHTLY')
    expect(scores[0].override_reason).toBe('strategic creator upside')
  })

  it('scenario math is stable for stacked scenarios', () => {
    const root = findRepoRoot()
    const first = evaluateScenarioStack(root, ['union-eyes-major-pilot', 'flow-slips-90-days'])
    const second = evaluateScenarioStack(root, ['union-eyes-major-pilot', 'flow-slips-90-days'])

    expect(first).not.toBeNull()
    expect(second).not.toBeNull()
    expect(first?.runway_months).toBe(second?.runway_months)
    expect(first?.survival_probability_pct).toBe(second?.survival_probability_pct)
  })

  it('runway alerts trigger correctly', () => {
    const product = makeProduct({ monthly_revenue: 1000, pipeline_value: 200000, founder_attention_hours: 40 })
    const [score] = buildCapitalAllocation([product], weights, { liveSignals: makeSignals(product, 40, 'estimate') })
    score.live_signals.metrics.pipeline_actual.value = 50000
    const catalog: CapitalCatalog = {
      schema_version: 'x',
      capital_weights: weights,
      capital_model: {
        scenarios: {
          current_cash: 100000,
          monthly_overhead: 80000,
          expected_closes_monthly: { conservative: 0, base: 0, aggressive: 0 },
          assumptions_note: 'test',
        },
      },
      products: [product],
    }
    const cashCalendar: CapitalCashCalendar = {
      as_of_date: '2026-04-19',
      assumptions_note: 'test',
      sustainable_founder_hours_per_week: 5,
      dormant_budget_cap_monthly: 5000,
      obligations: [],
      receivables: [],
    }
    const alerts = buildCapitalAlerts(catalog, [score], [{
      days: 30,
      date: '2026-05-19',
      obligations: 60000,
      receivables: 5000,
      starting_cash: 100000,
      ending_cash: 40000,
      net_change: -60000,
      stress_points: ['Cash falls below 75% of starting cash by day 30.'],
    }, {
      days: 60,
      date: '2026-06-18',
      obligations: 120000,
      receivables: 10000,
      starting_cash: 100000,
      ending_cash: -10000,
      net_change: -110000,
      stress_points: ['Obligations exceed receivables.'],
    }, {
      days: 90,
      date: '2026-07-18',
      obligations: 180000,
      receivables: 15000,
      starting_cash: 100000,
      ending_cash: -65000,
      net_change: -165000,
      stress_points: ['Cash falls below 75% of starting cash by day 90.'],
    }], cashCalendar)

    expect(alerts.some((alert) => alert.title.includes('Runway below 6 months'))).toBe(true)
    expect(alerts.some((alert) => alert.title.includes('pipeline fell more than 40%'))).toBe(true)
    expect(alerts.some((alert) => alert.title.includes('Founder load above sustainable threshold'))).toBe(true)
  })

  it('explainability outputs are complete', () => {
    const product = makeProduct({})
    const [score] = buildCapitalAllocation([product], weights, { liveSignals: makeSignals(product, 88, 'live') })

    expect(score.explainability.length).toBeGreaterThanOrEqual(4)
    expect(score.explainability.some((line) => line.includes('Revenue signal'))).toBe(true)
    expect(score.explainability.some((line) => line.includes('Confidence penalty'))).toBe(true)
  })
})