import { describe, expect, it } from 'vitest'

import {
  buildCommercialAlerts,
  buildForecast,
  classifyMarketPull,
  rankFounderRoi,
  scorePilotConversion,
  scoreRetentionRisk,
  type CommercialCatalogProduct,
  type FounderActivity,
  type Opportunity,
  type Pilot,
  type RetentionAccount,
} from '../scripts/lib/traction-engine'

function makeOpportunity(overrides: Partial<Opportunity>): Opportunity {
  return {
    id: 'opp-1',
    account: 'Account A',
    product: 'flow',
    stage: 'proposal',
    value: 50000,
    probability: 0.5,
    next_step: 'Review',
    owner: 'Founder',
    days_open: 12,
    risk: 'normal',
    commercial_motion: 'direct_sales',
    expected_close_date: '2026-05-15',
    source: 'manual',
    confidence: 'MEDIUM',
    ...overrides,
  }
}

function makePilot(overrides: Partial<Pilot>): Pilot {
  return {
    id: 'pilot-1',
    account: 'Pilot A',
    product: 'flow',
    start_date: '2026-03-01',
    sponsor_strength: 7,
    users_active: 20,
    weekly_engagement: 0.6,
    business_pain_solved: 7,
    paid_likelihood_pct: 55,
    expansion_value: 10000,
    procurement_path_defined: true,
    source: 'manual',
    confidence: 'MEDIUM',
    ...overrides,
  }
}

function makeActivity(overrides: Partial<FounderActivity>): FounderActivity {
  return {
    id: 'activity-1',
    lane: 'enterprise_demos',
    activity: 'Enterprise demos',
    hours: 10,
    pipeline_created: 80000,
    revenue_closed: 20000,
    owner: 'Founder',
    source: 'manual',
    confidence: 'MEDIUM',
    ...overrides,
  }
}

function makeAccount(overrides: Partial<RetentionAccount>): RetentionAccount {
  return {
    account: 'Customer A',
    product: 'flow',
    arr: 36000,
    usage_score: 45,
    sponsor_silence_days: 18,
    unpaid_invoices: 1,
    support_burden: 6,
    exec_engagement: false,
    source: 'manual',
    confidence: 'LOW',
    ...overrides,
  }
}

describe('traction engine', () => {
  it('builds increasing forecast windows', () => {
    const opportunities: Opportunity[] = [
      makeOpportunity({ id: 'o-1', expected_close_date: '2026-05-01', stage: 'legal', probability: 0.7, value: 60000, confidence: 'HIGH' }),
      makeOpportunity({ id: 'o-2', expected_close_date: '2026-06-05', stage: 'proposal', probability: 0.5, value: 40000 }),
      makeOpportunity({ id: 'o-3', expected_close_date: '2026-07-12', stage: 'demo', probability: 0.3, value: 30000 }),
    ]

    const forecast = buildForecast(opportunities, '2026-04-19')

    expect(forecast).toHaveLength(3)
    expect(forecast[1].weighted_pipeline).toBeGreaterThanOrEqual(forecast[0].weighted_pipeline)
    expect(forecast[2].weighted_pipeline).toBeGreaterThanOrEqual(forecast[1].weighted_pipeline)
  })

  it('classifies pilots correctly', () => {
    const strong = scorePilotConversion(makePilot({ sponsor_strength: 9, weekly_engagement: 0.82, paid_likelihood_pct: 78, procurement_path_defined: true }))
    const weak = scorePilotConversion(makePilot({ sponsor_strength: 2, users_active: 4, weekly_engagement: 0.12, business_pain_solved: 2, paid_likelihood_pct: 9, procurement_path_defined: false }))

    expect(strong.classification).toBe('likely to convert')
    expect(weak.classification).toBe('dead pilot walking')
    expect(strong.conversion_score).toBeGreaterThan(weak.conversion_score)
  })

  it('ranks founder ROI from highest to lowest', () => {
    const ranked = rankFounderRoi([
      makeActivity({ id: 'a1', lane: 'warm_intros', hours: 4, pipeline_created: 60000, revenue_closed: 12000 }),
      makeActivity({ id: 'a2', lane: 'cold_outreach', hours: 8, pipeline_created: 20000, revenue_closed: 0 }),
    ])

    expect(ranked[0].lane).toBe('warm_intros')
    expect(ranked[0].roi).toBeGreaterThan(ranked[1].roi)
  })

  it('flags high retention risk', () => {
    const scored = scoreRetentionRisk([
      makeAccount({ account: 'Risky Customer', usage_score: 22, sponsor_silence_days: 30, unpaid_invoices: 2, support_burden: 8, exec_engagement: false }),
      makeAccount({ account: 'Healthy Customer', usage_score: 86, sponsor_silence_days: 3, unpaid_invoices: 0, support_burden: 2, exec_engagement: true }),
    ])

    expect(scored[0].risk_level).toBe('high')
    expect(scored[0].risk_score).toBeGreaterThan(scored[1].risk_score)
  })

  it('produces actionable commercial alerts', () => {
    const opportunities = [
      makeOpportunity({ account: 'Large Account', value: 120000, days_open: 40, stage: 'proposal' }),
      makeOpportunity({ account: 'Mid Account', value: 30000, days_open: 35, stage: 'demo' }),
    ]
    const founder = rankFounderRoi([
      makeActivity({ lane: 'partner_calls', hours: 20, pipeline_created: 10000, revenue_closed: 0 }),
      makeActivity({ lane: 'enterprise_demos', hours: 6, pipeline_created: 90000, revenue_closed: 20000 }),
    ])
    const pilots = [
      scorePilotConversion(makePilot({ account: 'Pilot Risk', weekly_engagement: 0.6, procurement_path_defined: false })),
    ]
    const retention = scoreRetentionRisk([
      makeAccount({ account: 'Risky', usage_score: 20, sponsor_silence_days: 35, unpaid_invoices: 2, exec_engagement: false }),
    ])
    const forecast = buildForecast(opportunities, '2026-04-19')

    const alerts = buildCommercialAlerts(opportunities, founder, pilots, retention, forecast)

    expect(alerts.length).toBeGreaterThan(0)
    expect(alerts.some((alert) => /stalled/i.test(alert.message))).toBe(true)
    expect(alerts.some((alert) => /procurement path/i.test(alert.message))).toBe(true)
    expect(alerts.some((alert) => /churn risk/i.test(alert.message))).toBe(true)
  })

  it('classifies market pull for products', () => {
    const products: CommercialCatalogProduct[] = [
      {
        id: 'flow',
        name: 'Flow',
        tier: 1,
        commercial_motion: 'direct_sales',
        avg_deal_size: 30000,
        sales_cycle_days: 45,
        close_rate_pct: 25,
        renewal_rate_pct: 80,
        expansion_rate_pct: 20,
        gross_logo_target_12m: 8,
        primary_buyer: 'Ops Lead',
        proof_stage: 'pilot',
        market_pull_score: 8,
      },
      {
        id: 'cfo',
        name: 'CFO',
        tier: 2,
        commercial_motion: 'founder_led',
        avg_deal_size: 20000,
        sales_cycle_days: 80,
        close_rate_pct: 18,
        renewal_rate_pct: 75,
        expansion_rate_pct: 15,
        gross_logo_target_12m: 4,
        primary_buyer: 'Finance Director',
        proof_stage: 'interest',
        market_pull_score: 3,
      },
    ]

    const opportunities: Opportunity[] = [
      makeOpportunity({ product: 'flow', stage: 'proposal', source: 'gmail', next_step: 'partner intro', days_open: 12 }),
      makeOpportunity({ product: 'flow', stage: 'demo', source: 'manual', next_step: 'review', days_open: 10 }),
      makeOpportunity({ product: 'cfo', stage: 'meeting', source: 'manual', next_step: 'follow up', days_open: 45 }),
    ]

    const pilots = [
      scorePilotConversion(makePilot({ product: 'flow', expansion_value: 12000 })),
      scorePilotConversion(makePilot({ product: 'cfo', expansion_value: 0, weekly_engagement: 0.2 })),
    ]

    const pull = classifyMarketPull(products, opportunities, pilots)

    expect(pull[0].product).toBe('flow')
    expect(pull[0].pull_score).toBeGreaterThan(pull[1].pull_score)
  })
})
