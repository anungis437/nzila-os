import { describe, expect, it } from 'vitest'

import {
  buildCapitalAllocation,
  type CapitalProduct,
  type CapitalWeights,
  validateCapitalCatalog,
} from '../scripts/lib/capital-allocation'

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
    id: 'alpha',
    name: 'Alpha',
    tier: 2,
    status: 'pilot',
    proof_level: 'pilot-proof',
    gtm_posture: 'maintain',
    strategic_role: 'Test wedge',
    monthly_burn: 6000,
    monthly_revenue: 9000,
    annual_recurring_revenue: 108000,
    pipeline_value: 120000,
    expected_12m_revenue: 180000,
    gross_margin_pct: 70,
    eng_hours_required_monthly: 80,
    founder_attention_hours: 20,
    support_hours: 25,
    customer_concentration_risk: 4,
    execution_risk: 4,
    churn_risk: 3,
    moat_score: 7,
    strategic_option_value: 7,
    ecosystem_synergy: 8,
    probability_of_close: 0.4,
    runway_priority: 8,
    pipeline_assumptions: 'Based on current qualified opportunities',
    data_quality: 'estimated',
    ...overrides,
  }
}

describe('capital allocation engine', () => {
  it('weights must sum to 1', () => {
    const validation = validateCapitalCatalog({
      schema_version: 'x',
      capital_weights: { ...weights, efficiency: 0.2 },
      capital_model: {
        scenarios: {
          current_cash: 100000,
          monthly_overhead: 40000,
          expected_closes_monthly: { conservative: 10000, base: 20000, aggressive: 30000 },
          assumptions_note: 'test',
        },
      },
      products: [makeProduct({})],
    })

    expect(validation.errors).toContain('capital_weights must sum to 1.0 (received 1.1)')
  })

  it('high ROI product outranks vanity product', () => {
    const high = makeProduct({ id: 'high', name: 'High', monthly_revenue: 20000, gross_margin_pct: 80, pipeline_value: 300000, support_hours: 15 })
    const vanity = makeProduct({
      id: 'vanity',
      name: 'Vanity',
      monthly_revenue: 0,
      gross_margin_pct: 30,
      pipeline_value: 10000,
      moat_score: 6,
      strategic_option_value: 6,
      ecosystem_synergy: 6,
      customer_concentration_risk: 8,
      execution_risk: 8,
      churn_risk: 8,
      proof_level: 'none',
    })

    const scores = buildCapitalAllocation([high, vanity], weights)
    expect(scores[0].product.id).toBe('high')
    expect(scores[1].product.id).toBe('vanity')
  })

  it('sunset products receive no budget', () => {
    const scores = buildCapitalAllocation([
      makeProduct({ id: 'legacy', status: 'sunset', gtm_posture: 'sunset', tier: 5 }),
    ], weights)

    expect(scores[0].decision).toBe('SUNSET')
    expect(scores[0].recommended_monthly_budget).toBe(0)
    expect(scores[0].recommended_eng_hours).toBe(0)
  })

  it('impossible math input fails validation', () => {
    const validation = validateCapitalCatalog({
      schema_version: 'x',
      capital_weights: weights,
      capital_model: {
        scenarios: {
          current_cash: 100000,
          monthly_overhead: 40000,
          expected_closes_monthly: { conservative: 10000, base: 20000, aggressive: 30000 },
          assumptions_note: 'test',
        },
      },
      products: [makeProduct({ gross_margin_pct: -20 })],
    })

    expect(validation.errors).toContain('alpha: gross_margin_pct cannot be negative')
  })

  it('score ordering is deterministic', () => {
    const products = [
      makeProduct({ id: 'a', name: 'A', monthly_revenue: 10000 }),
      makeProduct({ id: 'b', name: 'B', monthly_revenue: 3000, pipeline_value: 20000, proof_level: 'none' }),
      makeProduct({ id: 'c', name: 'C', monthly_revenue: 8000, pipeline_value: 90000 }),
    ]

    const first = buildCapitalAllocation(products, weights).map((score) => score.product.id)
    const second = buildCapitalAllocation(products, weights).map((score) => score.product.id)
    expect(first).toEqual(second)
  })
})