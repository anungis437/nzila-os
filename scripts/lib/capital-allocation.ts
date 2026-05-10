import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { findRepoRoot, PORTFOLIO_CATALOG_PATH } from './portfolio-governance'
import {
  loadCapitalLiveSignals,
  type CapitalConfidence,
  type CapitalMetricObservation,
  type ProductLiveSignals,
} from './capital-live-signals'

export type CapitalDecision = 'FUND NOW' | 'MAINTAIN' | 'PAUSE' | 'SUNSET' | 'INCUBATE LIGHTLY' | 'BET THE COMPANY'

export interface CapitalWeights {
  revenue: number
  margin: number
  pipeline: number
  strategic: number
  efficiency: number
  risk_penalty: number
}

export interface CapitalScenarioInputs {
  current_cash: number
  monthly_overhead: number
  expected_closes_monthly: {
    conservative: number
    base: number
    aggressive: number
  }
  assumptions_note: string
}

export interface CapitalProduct {
  id: string
  name: string
  tier: 1 | 2 | 3 | 4 | 5
  status: 'production' | 'pilot' | 'incubating' | 'internal' | 'frozen' | 'sunset'
  proof_level: 'market-proof' | 'pilot-proof' | 'internal-proof' | 'none'
  gtm_posture: 'sell-now' | 'hold' | 'maintain' | 'internal-only' | 'sunset'
  strategic_role: string
  monthly_burn: number
  monthly_revenue: number
  annual_recurring_revenue: number
  pipeline_value: number
  expected_12m_revenue: number
  gross_margin_pct: number
  eng_hours_required_monthly: number
  founder_attention_hours: number
  support_hours: number
  customer_concentration_risk: number
  execution_risk: number
  churn_risk: number
  moat_score: number
  strategic_option_value: number
  ecosystem_synergy: number
  probability_of_close: number
  runway_priority: number
  pipeline_assumptions?: string
  data_quality?: 'estimated' | 'observed' | 'mixed'
}

export interface CapitalCatalog {
  schema_version: string
  capital_weights: CapitalWeights
  capital_model: {
    scenarios: CapitalScenarioInputs
  }
  products: CapitalProduct[]
}

export interface ProductScore {
  product: CapitalProduct
  live_signals: ProductLiveSignals
  capital_efficiency_score: number
  attention_efficiency_score: number
  engineering_roi_score: number
  engineering_velocity_score: number
  strategic_value_score: number
  risk_penalty_score: number
  data_confidence_pct: number
  confidence_penalty_score: number
  composite_allocation_score: number
  decision: CapitalDecision
  final_decision: CapitalDecision
  override_reason?: string
  recommended_monthly_budget: number
  recommended_eng_hours: number
  recommended_founder_hours: number
  execution_efficiency_flag: boolean
  reasoning: string[]
  explainability: string[]
}

export interface CapitalValidation {
  errors: string[]
  warnings: string[]
}

export interface CapitalOverrideEntry {
  date: string
  product: string
  engine_recommendation: string
  override_decision: string
  reason: string
  owner: string
  outcome_status?: 'pending' | 'correct' | 'incorrect'
  outcome_note?: string
}

export interface CapitalOverrideLog {
  overrides: CapitalOverrideEntry[]
}

export interface CashCalendarEvent {
  id: string
  date: string
  category: string
  amount: number
  confidence: CapitalConfidence
  source: string
  note?: string
}

export interface CapitalCashCalendar {
  as_of_date: string
  assumptions_note: string
  sustainable_founder_hours_per_week: number
  dormant_budget_cap_monthly: number
  obligations: CashCalendarEvent[]
  receivables: CashCalendarEvent[]
}

export interface ScenarioProductAdjustments {
  monthly_revenue_actual_delta?: number
  pipeline_actual_delta?: number
  collections_outstanding_delta?: number
  active_users_delta?: number
  engineering_velocity_delta?: number
  probability_of_close_delta?: number
}

export interface ScenarioGlobalAdjustments {
  current_cash_delta: number
  monthly_overhead_delta: number
  survival_probability_delta: number
  founder_capacity_multiplier: number
  hiring_bias: 'accelerate' | 'delay' | 'freeze' | 'defer'
}

export interface CapitalScenario {
  id: string
  title: string
  description: string
  product_adjustments: Record<string, ScenarioProductAdjustments>
  global_adjustments: ScenarioGlobalAdjustments
}

export interface CapitalScenarioPack {
  as_of_date: string
  assumptions_note: string
  scenarios: CapitalScenario[]
}

export interface CashForecastCheckpoint {
  days: 30 | 60 | 90
  date: string
  obligations: number
  receivables: number
  starting_cash: number
  ending_cash: number
  net_change: number
  stress_points: string[]
}

export interface CapitalAlert {
  severity: 'critical' | 'high' | 'medium'
  title: string
  detail: string
}

export interface OverrideAnalytics {
  override_frequency: number
  accuracy_pct: number | null
  open_overrides: CapitalOverrideEntry[]
  product_counts: Array<{ product: string; count: number }>
}

export interface ScenarioOutcome {
  scenario: CapitalScenario
  runway_months: number
  survival_probability_pct: number
  hiring_recommendation: string
  allocation_changes: Array<{ product: string; from: CapitalDecision; to: CapitalDecision; score_delta: number }>
}

export interface CapitalOutputs {
  catalog: CapitalCatalog
  validation: CapitalValidation
  live_signals: Map<string, ProductLiveSignals>
  override_log: CapitalOverrideLog
  cash_calendar: CapitalCashCalendar
  scenario_pack: CapitalScenarioPack
  scores: ProductScore[]
  cash_forecast: CashForecastCheckpoint[]
  alerts: CapitalAlert[]
  override_analytics: OverrideAnalytics
  scenario_outcomes: ScenarioOutcome[]
  runway_months_today: number
  most_mispriced_hidden_bet: ProductScore | null
}

export interface BuildAllocationOptions {
  liveSignals?: Map<string, ProductLiveSignals>
  overrides?: CapitalOverrideLog
}

const CAPITAL_OVERRIDE_LOG_PATH = 'governance/foundations/capital/override-log.json'
const CAPITAL_CASH_CALENDAR_PATH = 'governance/foundations/capital/cash-calendar.json'
const CAPITAL_SCENARIO_PACK_PATH = 'governance/foundations/capital/scenario-pack.json'

const REQUIRED_NUMERIC_FIELDS: Array<keyof CapitalProduct> = [
  'monthly_burn',
  'monthly_revenue',
  'annual_recurring_revenue',
  'pipeline_value',
  'expected_12m_revenue',
  'gross_margin_pct',
  'eng_hours_required_monthly',
  'founder_attention_hours',
  'support_hours',
  'customer_concentration_risk',
  'execution_risk',
  'churn_risk',
  'moat_score',
  'strategic_option_value',
  'ecosystem_synergy',
  'probability_of_close',
  'runway_priority',
]

function safeDivide(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  return numerator / denominator
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function normalizeByMax(value: number, max: number): number {
  if (max <= 0) return 0
  return clamp((value / max) * 100, 0, 100)
}

function normalizeRisk(value: number): number {
  return clamp((value / 10) * 100, 0, 100)
}

function normalizePercent(value: number): number {
  return clamp(value, 0, 100)
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(isoDate)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function normalizeDecisionLabel(value: string): CapitalDecision {
  const normalized = value.trim().toUpperCase().replace(/_/g, ' ')
  if (normalized === 'FUND NOW') return 'FUND NOW'
  if (normalized === 'MAINTAIN') return 'MAINTAIN'
  if (normalized === 'PAUSE') return 'PAUSE'
  if (normalized === 'SUNSET') return 'SUNSET'
  if (normalized === 'INCUBATE LIGHTLY') return 'INCUBATE LIGHTLY'
  return 'BET THE COMPANY'
}

function readJsonOrFallback<T>(root: string, relativePath: string, fallback: T): T {
  const absolutePath = join(root, relativePath)
  if (!existsSync(absolutePath)) return fallback
  return JSON.parse(readFileSync(absolutePath, 'utf8')) as T
}

function confidenceWeight(observation: CapitalMetricObservation): number {
  if (observation.sourceType === 'unavailable') return 0.1
  if (observation.confidence === 'HIGH') return 1
  if (observation.confidence === 'MEDIUM') return 0.65
  return 0.3
}

function metricNumber(product: CapitalProduct, liveSignals: ProductLiveSignals, key: 'monthly_revenue_actual' | 'pipeline_actual' | 'collections_outstanding' | 'active_users' | 'engineering_velocity'): number {
  const observation = liveSignals.metrics[key]
  if (observation.value !== null) return observation.value
  if (key === 'monthly_revenue_actual') return product.monthly_revenue
  if (key === 'pipeline_actual') return product.pipeline_value
  return 0
}

function loadCapitalOverrideLog(root = findRepoRoot()): CapitalOverrideLog {
  return readJsonOrFallback(root, CAPITAL_OVERRIDE_LOG_PATH, { overrides: [] })
}

function loadCapitalCashCalendar(root = findRepoRoot()): CapitalCashCalendar {
  return readJsonOrFallback(root, CAPITAL_CASH_CALENDAR_PATH, {
    as_of_date: new Date().toISOString().slice(0, 10),
    assumptions_note: 'No cash calendar configured.',
    sustainable_founder_hours_per_week: 45,
    dormant_budget_cap_monthly: 5000,
    obligations: [],
    receivables: [],
  })
}

function loadCapitalScenarioPack(root = findRepoRoot()): CapitalScenarioPack {
  return readJsonOrFallback(root, CAPITAL_SCENARIO_PACK_PATH, {
    as_of_date: new Date().toISOString().slice(0, 10),
    assumptions_note: 'No scenario pack configured.',
    scenarios: [],
  })
}

function latestOverrideForProduct(overrides: CapitalOverrideLog, productId: string): CapitalOverrideEntry | null {
  const matches = overrides.overrides
    .filter((entry) => entry.product === productId)
    .sort((left, right) => right.date.localeCompare(left.date))
  return matches[0] ?? null
}

export function loadCapitalCatalog(root = findRepoRoot()): CapitalCatalog {
  const catalog = JSON.parse(readFileSync(join(root, PORTFOLIO_CATALOG_PATH), 'utf8')) as CapitalCatalog
  return catalog
}

export function validateCapitalCatalog(catalog: CapitalCatalog): CapitalValidation {
  const errors: string[] = []
  const warnings: string[] = []

  if (!catalog.capital_weights) {
    errors.push('Catalog missing capital_weights')
  } else {
    const sum = Object.values(catalog.capital_weights).reduce((acc, value) => acc + value, 0)
    if (Math.abs(sum - 1) > 0.0001) {
      errors.push(`capital_weights must sum to 1.0 (received ${round1(sum)})`)
    }

    for (const [key, value] of Object.entries(catalog.capital_weights)) {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        errors.push(`capital_weights.${key} must be numeric`)
      } else if (value < 0 || value > 1) {
        errors.push(`capital_weights.${key} must be between 0 and 1`)
      }
    }
  }

  if (!catalog.capital_model?.scenarios) {
    errors.push('Catalog missing capital_model.scenarios')
  }

  for (const product of catalog.products) {
    for (const field of REQUIRED_NUMERIC_FIELDS) {
      const value = product[field]
      if (typeof value !== 'number' || Number.isNaN(value)) {
        errors.push(`${product.id}: ${String(field)} must be numeric`)
      }
    }

    if (product.gross_margin_pct < 0) {
      errors.push(`${product.id}: gross_margin_pct cannot be negative`)
    }
    if (product.gross_margin_pct > 100) {
      errors.push(`${product.id}: gross_margin_pct cannot exceed 100`)
    }

    if (product.customer_concentration_risk < 1 || product.customer_concentration_risk > 10) {
      errors.push(`${product.id}: customer_concentration_risk must be 1-10`)
    }
    if (product.execution_risk < 1 || product.execution_risk > 10) {
      errors.push(`${product.id}: execution_risk must be 1-10`)
    }
    if (product.churn_risk < 1 || product.churn_risk > 10) {
      errors.push(`${product.id}: churn_risk must be 1-10`)
    }

    if (product.moat_score < 1 || product.moat_score > 10) {
      errors.push(`${product.id}: moat_score must be 1-10`)
    }
    if (product.strategic_option_value < 1 || product.strategic_option_value > 10) {
      errors.push(`${product.id}: strategic_option_value must be 1-10`)
    }
    if (product.ecosystem_synergy < 1 || product.ecosystem_synergy > 10) {
      errors.push(`${product.id}: ecosystem_synergy must be 1-10`)
    }

    if (product.probability_of_close < 0 || product.probability_of_close > 1) {
      errors.push(`${product.id}: probability_of_close must be 0-1`)
    }

    if (product.tier === 1 && (product.eng_hours_required_monthly <= 0 || product.founder_attention_hours <= 0)) {
      errors.push(`${product.id}: tier 1 product cannot have zero resource plan`)
    }

    if (!product.pipeline_assumptions || product.pipeline_assumptions.trim().length === 0) {
      warnings.push(`${product.id}: missing pipeline assumptions`) 
    }
  }

  return { errors, warnings }
}

function getDerivedMetrics(products: CapitalProduct[], liveSignals: Map<string, ProductLiveSignals>): {
  capitalEfficiency: number[]
  attentionEfficiency: number[]
  engineeringRoi: number[]
  pipelinePotential: number[]
  revenueScale: number[]
  engineeringVelocity: number[]
  activeUsers: number[]
} {
  const capitalEfficiency = products.map((product) => {
    const signals = liveSignals.get(product.id)
    const actualRevenue = signals ? metricNumber(product, signals, 'monthly_revenue_actual') : product.monthly_revenue
    const marginAdjustedRevenue = actualRevenue * (product.gross_margin_pct / 100)
    return safeDivide(marginAdjustedRevenue, Math.max(product.monthly_burn, 1))
  })

  const attentionEfficiency = products.map((product) => {
    const signals = liveSignals.get(product.id)
    const actualPipeline = signals ? metricNumber(product, signals, 'pipeline_actual') : product.pipeline_value
    const activeUsers = signals ? metricNumber(product, signals, 'active_users') : 0
    const upside = (product.expected_12m_revenue * product.probability_of_close) + (actualPipeline * product.probability_of_close) + (activeUsers * 25)
    return safeDivide(upside, Math.max(product.founder_attention_hours, 1))
  })

  const engineeringRoi = products.map((product) => {
    const signals = liveSignals.get(product.id)
    const actualPipeline = signals ? metricNumber(product, signals, 'pipeline_actual') : product.pipeline_value
    const velocity = signals ? metricNumber(product, signals, 'engineering_velocity') : 0
    const upside = ((product.expected_12m_revenue - product.annual_recurring_revenue) * product.probability_of_close) + (actualPipeline * product.probability_of_close)
    const velocityMultiplier = 0.5 + (velocity / 200)
    return safeDivide(upside, Math.max(product.eng_hours_required_monthly, 1)) * velocityMultiplier
  })

  const pipelinePotential = products.map((product) => {
    const signals = liveSignals.get(product.id)
    const actualPipeline = signals ? metricNumber(product, signals, 'pipeline_actual') : product.pipeline_value
    const activeUsers = signals ? metricNumber(product, signals, 'active_users') : 0
    return (actualPipeline * product.probability_of_close) + product.expected_12m_revenue + (activeUsers * 20)
  })
  const revenueScale = products.map((product) => {
    const signals = liveSignals.get(product.id)
    return signals ? metricNumber(product, signals, 'monthly_revenue_actual') : product.monthly_revenue
  })
  const engineeringVelocity = products.map((product) => {
    const signals = liveSignals.get(product.id)
    return signals ? metricNumber(product, signals, 'engineering_velocity') : 0
  })
  const activeUsers = products.map((product) => {
    const signals = liveSignals.get(product.id)
    return signals ? metricNumber(product, signals, 'active_users') : 0
  })

  return { capitalEfficiency, attentionEfficiency, engineeringRoi, pipelinePotential, revenueScale, engineeringVelocity, activeUsers }
}

function computeDecision(
  product: CapitalProduct,
  score: number,
  strategicScore: number,
  riskPenaltyScore: number,
  confidencePct: number,
  actualRevenue: number,
  actualPipeline: number,
): CapitalDecision {
  const hardPause = product.monthly_burn > 0
    && product.proof_level === 'none'
    && actualPipeline < 50000
    && strategicScore < 45

  const hardFund = actualRevenue > 0
    && product.gross_margin_pct >= 65
    && actualPipeline >= 150000
    && product.support_hours <= 40

  if (product.status === 'sunset' || product.gtm_posture === 'sunset' || product.tier === 5) return 'SUNSET'
  if (hardPause) return 'PAUSE'
  if (score >= 88 && hardFund && riskPenaltyScore < 30 && product.tier === 1) return 'BET THE COMPANY'
  if (product.tier === 1 && confidencePct < 35 && score < 75) return 'MAINTAIN'
  if (hardFund || score >= 60) return 'FUND NOW'

  // Internal control surfaces with strong strategic leverage should be maintained.
  if (product.tier === 3 && product.gtm_posture === 'internal-only' && strategicScore >= 65) return 'MAINTAIN'

  // Incubating options with strategic signal should remain lightly funded, not terminated.
  if (product.tier === 4 && strategicScore >= 50) return 'INCUBATE LIGHTLY'

  if (score >= 42) return 'MAINTAIN'
  return 'PAUSE'
}

function allocateResources(product: CapitalProduct, decision: CapitalDecision): {
  budget: number
  engHours: number
  founderHours: number
} {
  if (decision === 'SUNSET') {
    return { budget: 0, engHours: 0, founderHours: 0 }
  }
  if (decision === 'PAUSE') {
    return {
      budget: round1(product.monthly_burn * 0.2),
      engHours: Math.max(0, Math.round(product.eng_hours_required_monthly * 0.2)),
      founderHours: Math.max(0, Math.round(product.founder_attention_hours * 0.2)),
    }
  }
  if (decision === 'INCUBATE LIGHTLY') {
    return {
      budget: round1(product.monthly_burn * 0.35),
      engHours: Math.max(0, Math.round(product.eng_hours_required_monthly * 0.4)),
      founderHours: Math.max(0, Math.round(product.founder_attention_hours * 0.45)),
    }
  }
  if (decision === 'MAINTAIN') {
    return {
      budget: round1(product.monthly_burn * 0.75),
      engHours: Math.max(0, Math.round(product.eng_hours_required_monthly * 0.75)),
      founderHours: Math.max(0, Math.round(product.founder_attention_hours * 0.8)),
    }
  }
  if (decision === 'BET THE COMPANY') {
    return {
      budget: round1(product.monthly_burn * 1.8),
      engHours: Math.max(0, Math.round(product.eng_hours_required_monthly * 1.8)),
      founderHours: Math.max(0, Math.round(product.founder_attention_hours * 1.5)),
    }
  }

  return {
    budget: round1(product.monthly_burn * 1.2),
    engHours: Math.max(0, Math.round(product.eng_hours_required_monthly * 1.2)),
    founderHours: Math.max(0, Math.round(product.founder_attention_hours * 1.15)),
  }
}

export function buildCapitalAllocation(products: CapitalProduct[], weights: CapitalWeights, options: BuildAllocationOptions = {}): ProductScore[] {
  const liveSignals = options.liveSignals ?? loadCapitalLiveSignals(products)
  const overrides = options.overrides ?? { overrides: [] }
  const { capitalEfficiency, attentionEfficiency, engineeringRoi, pipelinePotential, revenueScale, engineeringVelocity, activeUsers } = getDerivedMetrics(products, liveSignals)
  const maxCapitalEfficiency = Math.max(...capitalEfficiency, 1)
  const maxAttentionEfficiency = Math.max(...attentionEfficiency, 1)
  const maxEngineeringRoi = Math.max(...engineeringRoi, 1)
  const maxPipelinePotential = Math.max(...pipelinePotential, 1)
  const maxRevenue = Math.max(...revenueScale, 1)
  const maxEngineeringVelocity = Math.max(...engineeringVelocity, 1)
  const maxActiveUsers = Math.max(...activeUsers, 1)

  return products.map((product, index) => {
    const productSignals = liveSignals.get(product.id) ?? {
      productId: product.id,
      metrics: {
        monthly_revenue_actual: { key: 'monthly_revenue_actual', value: product.monthly_revenue, source: 'catalog estimate', sourceType: 'estimate', confidence: 'LOW', observedAt: product.last_reviewed ?? null },
        pipeline_actual: { key: 'pipeline_actual', value: product.pipeline_value, source: 'catalog estimate', sourceType: 'estimate', confidence: 'LOW', observedAt: product.last_reviewed ?? null },
        collections_outstanding: { key: 'collections_outstanding', value: null, source: 'unavailable', sourceType: 'unavailable', confidence: 'LOW', observedAt: null },
        active_users: { key: 'active_users', value: null, source: 'unavailable', sourceType: 'unavailable', confidence: 'LOW', observedAt: null },
        engineering_velocity: { key: 'engineering_velocity', value: 0, source: 'unavailable', sourceType: 'unavailable', confidence: 'LOW', observedAt: null },
      },
      connectors: [],
      confidencePct: 30,
      engineeringSignals: { commitCount30d: 0, bugLoad30d: 0, cycleTimeHours: null, releaseCadencePerWeek: null },
    }
    const actualRevenue = metricNumber(product, productSignals, 'monthly_revenue_actual')
    const actualPipeline = metricNumber(product, productSignals, 'pipeline_actual')
    const engineeringVelocityScore = normalizeByMax(engineeringVelocity[index], maxEngineeringVelocity)
    const activeUserScore = normalizeByMax(activeUsers[index], maxActiveUsers)
    const capitalEfficiencyScore = normalizeByMax(capitalEfficiency[index], maxCapitalEfficiency)
    const attentionEfficiencyScore = normalizeByMax(attentionEfficiency[index], maxAttentionEfficiency)
    const engineeringRoiScore = normalizeByMax(engineeringRoi[index], maxEngineeringRoi)
    const strategicCore = normalizeRisk((product.moat_score + product.strategic_option_value + product.ecosystem_synergy) / 3)
    const strategicValueScore = clamp((strategicCore * 0.85) + (activeUserScore * 0.15), 0, 100)
    const riskPenaltyScore = normalizeRisk((product.churn_risk + product.customer_concentration_risk + product.execution_risk) / 3)

    const revenueScore = normalizeByMax(actualRevenue, maxRevenue)
    const marginScore = normalizePercent(product.gross_margin_pct)
    const pipelineScore = normalizeByMax(pipelinePotential[index], maxPipelinePotential)
    const efficiencyScore = (capitalEfficiencyScore + attentionEfficiencyScore + engineeringRoiScore + engineeringVelocityScore) / 4
    const confidencePct = round1(productSignals.confidencePct)
    const confidencePenaltyScore = round1((100 - confidencePct) * 0.12)

    const compositeRaw = (weights.revenue * revenueScore)
      + (weights.margin * marginScore)
      + (weights.pipeline * pipelineScore)
      + (weights.strategic * strategicValueScore)
      + (weights.efficiency * efficiencyScore)
      - (weights.risk_penalty * riskPenaltyScore)

    const compositeScore = round1(clamp(compositeRaw - confidencePenaltyScore, 0, 100))
    const decision = computeDecision(product, compositeScore, strategicValueScore, riskPenaltyScore, confidencePct, actualRevenue, actualPipeline)
    const productOverride = latestOverrideForProduct(overrides, product.id)
    const finalDecision = productOverride ? normalizeDecisionLabel(productOverride.override_decision) : decision
    const allocation = allocateResources(product, finalDecision)
    const executionEfficiencyFlag = (finalDecision === 'FUND NOW' || finalDecision === 'BET THE COMPANY') && engineeringVelocityScore < 35

    const reasoning: string[] = [
      `Capital efficiency=${round1(capitalEfficiencyScore)}`,
      `Attention efficiency=${round1(attentionEfficiencyScore)}`,
      `Engineering ROI=${round1(engineeringRoiScore)}`,
      `Engineering velocity=${round1(engineeringVelocityScore)}`,
      `Strategic score=${round1(strategicValueScore)}`,
      `Risk penalty=${round1(riskPenaltyScore)}`,
      `Confidence=${confidencePct}%`,
    ]

    const explainability: string[] = [
      `Revenue signal ${actualRevenue.toLocaleString()} from ${productSignals.metrics.monthly_revenue_actual.source} (${productSignals.metrics.monthly_revenue_actual.confidence}).`,
      `Pipeline signal ${actualPipeline.toLocaleString()} from ${productSignals.metrics.pipeline_actual.source} (${productSignals.metrics.pipeline_actual.confidence}).`,
      `Low churn/execution risk profile=${round1(100 - riskPenaltyScore)} support points.`,
      `Confidence penalty subtracts ${confidencePenaltyScore.toFixed(1)} points due to estimate-heavy or unavailable data.`,
      executionEfficiencyFlag
        ? `Execution inefficiency flagged: engineering velocity ${round1(engineeringVelocityScore)} despite funded priority.`
        : `Engineering execution signal ${round1(engineeringVelocityScore)} supports current allocation.`,
    ]

    if (productOverride) {
      explainability.push(`Leadership override: ${decision} -> ${finalDecision} by ${productOverride.owner} because ${productOverride.reason}.`)
    }

    return {
      product,
      live_signals: productSignals,
      capital_efficiency_score: round1(capitalEfficiencyScore),
      attention_efficiency_score: round1(attentionEfficiencyScore),
      engineering_roi_score: round1(engineeringRoiScore),
      engineering_velocity_score: round1(engineeringVelocityScore),
      strategic_value_score: round1(strategicValueScore),
      risk_penalty_score: round1(riskPenaltyScore),
      data_confidence_pct: confidencePct,
      confidence_penalty_score: confidencePenaltyScore,
      composite_allocation_score: compositeScore,
      decision,
      final_decision: finalDecision,
      override_reason: productOverride?.reason,
      recommended_monthly_budget: allocation.budget,
      recommended_eng_hours: allocation.engHours,
      recommended_founder_hours: allocation.founderHours,
      execution_efficiency_flag: executionEfficiencyFlag,
      reasoning,
      explainability,
    }
  }).sort((left, right) => right.composite_allocation_score - left.composite_allocation_score)
}

export function calculateRunwayMonths(currentCash: number, monthlyOverhead: number, scores: ProductScore[], expectedClosesMonthly: number): number {
  const monthlyBudget = scores.reduce((acc, score) => acc + score.recommended_monthly_budget, 0)
  const monthlyRevenue = scores.reduce((acc, score) => acc + metricNumber(score.product, score.live_signals, 'monthly_revenue_actual'), 0)
  const netBurn = (monthlyOverhead + monthlyBudget) - (monthlyRevenue + expectedClosesMonthly)
  if (netBurn <= 0) return 120
  return round2(currentCash / netBurn)
}

function buildOverrideAnalytics(scores: ProductScore[], overrides: CapitalOverrideLog): OverrideAnalytics {
  const resolved = overrides.overrides.filter((entry) => entry.outcome_status === 'correct' || entry.outcome_status === 'incorrect')
  const correct = resolved.filter((entry) => entry.outcome_status === 'correct').length
  const counts = new Map<string, number>()
  for (const entry of overrides.overrides) {
    counts.set(entry.product, (counts.get(entry.product) ?? 0) + 1)
  }
  return {
    override_frequency: round2(overrides.overrides.length / Math.max(scores.length, 1)),
    accuracy_pct: resolved.length === 0 ? null : round1((correct / resolved.length) * 100),
    open_overrides: overrides.overrides.filter((entry) => !entry.outcome_status || entry.outcome_status === 'pending'),
    product_counts: Array.from(counts.entries()).map(([product, count]) => ({ product, count })).sort((left, right) => right.count - left.count),
  }
}

function derivedCollectionsReceivables(scores: ProductScore[], asOfDate: string): CashCalendarEvent[] {
  return scores
    .map((score, index) => {
      const outstanding = metricNumber(score.product, score.live_signals, 'collections_outstanding')
      if (outstanding <= 0) return null
      return {
        id: `${score.product.id}-collections-${index}`,
        date: addDays(asOfDate, 15),
        category: 'collections',
        amount: outstanding,
        confidence: score.live_signals.metrics.collections_outstanding.confidence,
        source: score.live_signals.metrics.collections_outstanding.source,
        note: 'Collections outstanding derived from capital live signal.',
      }
    })
    .filter((event): event is CashCalendarEvent => event !== null)
}

export function buildCashForecast(catalog: CapitalCatalog, scores: ProductScore[], cashCalendar: CapitalCashCalendar): CashForecastCheckpoint[] {
  const currentCash = catalog.capital_model.scenarios.current_cash
  const asOfDate = cashCalendar.as_of_date
  const recurringReceivablesMonthly = scores.reduce((acc, score) => acc + metricNumber(score.product, score.live_signals, 'monthly_revenue_actual'), 0)
  const monthlyBudget = scores.reduce((acc, score) => acc + score.recommended_monthly_budget, 0)
  const receivables = [...cashCalendar.receivables, ...derivedCollectionsReceivables(scores, asOfDate)]

  return ([30, 60, 90] as Array<30 | 60 | 90>).map((days) => {
    const obligations = cashCalendar.obligations
      .filter((event) => event.date <= addDays(asOfDate, days))
      .reduce((acc, event) => acc + event.amount, 0)
    const scheduledReceivables = receivables
      .filter((event) => event.date <= addDays(asOfDate, days))
      .reduce((acc, event) => acc + event.amount, 0)
    const earnedReceivables = recurringReceivablesMonthly * (days / 30)
    const productBurn = monthlyBudget * (days / 30)
    const endingCash = round2(currentCash - obligations - productBurn + scheduledReceivables + earnedReceivables)
    const netChange = round2(endingCash - currentCash)
    const stressPoints: string[] = []
    if (endingCash < currentCash * 0.75) {
      stressPoints.push(`Cash falls below 75% of starting cash by day ${days}.`)
    }
    if (obligations > scheduledReceivables + earnedReceivables) {
      stressPoints.push(`Obligations exceed receivables by ${(obligations - (scheduledReceivables + earnedReceivables)).toLocaleString()}.`)
    }

    return {
      days,
      date: addDays(asOfDate, days),
      obligations: round2(obligations + productBurn),
      receivables: round2(scheduledReceivables + earnedReceivables),
      starting_cash: currentCash,
      ending_cash: endingCash,
      net_change: netChange,
      stress_points: stressPoints,
    }
  })
}

function estimateSurvivalProbability(runwayMonths: number, scores: ProductScore[], founderThreshold: number, survivalDelta: number): number {
  const confidenceAvg = scores.reduce((acc, score) => acc + score.data_confidence_pct, 0) / Math.max(scores.length, 1)
  const founderWeeklyLoad = scores.reduce((acc, score) => acc + (score.recommended_founder_hours / 4), 0)
  const tier1Funded = scores.filter((score) => score.product.tier === 1 && (score.final_decision === 'FUND NOW' || score.final_decision === 'BET THE COMPANY')).length
  const base = 30 + Math.min(runwayMonths * 6, 36) + Math.min(tier1Funded * 6, 18) + ((confidenceAvg - 50) * 0.25)
  const overloadPenalty = founderWeeklyLoad > founderThreshold ? (founderWeeklyLoad - founderThreshold) * 1.5 : 0
  return round1(clamp(base - overloadPenalty + survivalDelta, 5, 95))
}

export function buildHiringRecommendation(runwayMonths: number, alerts: CapitalAlert[], hiringBias: ScenarioGlobalAdjustments['hiring_bias'] = 'defer'): string {
  if (hiringBias === 'freeze') return 'Freeze new hiring and protect current runway.'
  if (hiringBias === 'delay') return 'Delay non-critical hiring until top wedge pipeline recovers.'
  if (hiringBias === 'accelerate' && runwayMonths >= 9) return 'Advance 1 focused hire into the strongest funded wedge.'
  if (runwayMonths < 6 || alerts.some((alert) => alert.severity === 'critical')) return 'Do not hire; cut burn or raise immediately.'
  if (runwayMonths < 9) return 'Only replacement or directly revenue-linked hiring.'
  return 'Selective hiring is supportable in top funded products.'
}

export function buildCapitalAlerts(catalog: CapitalCatalog, scores: ProductScore[], cashForecast: CashForecastCheckpoint[], cashCalendar: CapitalCashCalendar): CapitalAlert[] {
  const alerts: CapitalAlert[] = []
  const runwayMonths = calculateRunwayMonths(
    catalog.capital_model.scenarios.current_cash,
    catalog.capital_model.scenarios.monthly_overhead,
    scores,
    catalog.capital_model.scenarios.expected_closes_monthly.base,
  )
  if (runwayMonths < 6) {
    alerts.push({ severity: 'critical', title: 'Runway below 6 months', detail: `Current modeled runway is ${runwayMonths.toFixed(1)} months.` })
  }

  for (const score of scores.filter((entry) => entry.product.tier === 1)) {
    const observedPipeline = metricNumber(score.product, score.live_signals, 'pipeline_actual')
    if (score.product.pipeline_value > 0 && observedPipeline < score.product.pipeline_value * 0.6) {
      alerts.push({ severity: 'high', title: `${score.product.name} pipeline fell more than 40%`, detail: `Observed pipeline ${observedPipeline.toLocaleString()} vs catalog ${score.product.pipeline_value.toLocaleString()}.` })
    }
    if (!(score.final_decision === 'FUND NOW' || score.final_decision === 'BET THE COMPANY') || score.recommended_eng_hours < Math.round(score.product.eng_hours_required_monthly * 0.75)) {
      alerts.push({ severity: 'high', title: `${score.product.name} underfunded`, detail: 'Tier 1 product is not receiving its required resource envelope.' })
    }
  }

  const founderWeeklyLoad = scores.reduce((acc, score) => acc + (score.recommended_founder_hours / 4), 0)
  if (founderWeeklyLoad > cashCalendar.sustainable_founder_hours_per_week) {
    alerts.push({ severity: 'high', title: 'Founder load above sustainable threshold', detail: `Weekly founder load ${round1(founderWeeklyLoad)}h exceeds ${cashCalendar.sustainable_founder_hours_per_week}h.` })
  }

  for (const score of scores) {
    if ((score.final_decision === 'PAUSE' || score.final_decision === 'SUNSET' || score.final_decision === 'INCUBATE LIGHTLY')
      && score.recommended_monthly_budget > cashCalendar.dormant_budget_cap_monthly) {
      alerts.push({ severity: 'medium', title: `${score.product.name} dormant budget cap breach`, detail: `Budget ${score.recommended_monthly_budget.toLocaleString()} exceeds cap ${cashCalendar.dormant_budget_cap_monthly.toLocaleString()}.` })
    }
    if (score.execution_efficiency_flag) {
      alerts.push({ severity: 'medium', title: `${score.product.name} execution inefficiency`, detail: 'Budget is allocated while engineering velocity remains weak.' })
    }
  }

  const stressPoint = cashForecast.find((checkpoint) => checkpoint.stress_points.length > 0)
  if (stressPoint) {
    alerts.push({ severity: 'medium', title: '90-day cash stress detected', detail: `${stressPoint.stress_points.join(' ')} Ending cash by day ${stressPoint.days}: ${stressPoint.ending_cash.toLocaleString()}.` })
  }

  return alerts
}

function buildScenarioOutcomes(
  catalog: CapitalCatalog,
  baseScores: ProductScore[],
  liveSignals: Map<string, ProductLiveSignals>,
  overrides: CapitalOverrideLog,
  scenarioPack: CapitalScenarioPack,
  cashCalendar: CapitalCashCalendar,
): ScenarioOutcome[] {
  return scenarioPack.scenarios.map((scenario) => {
    const clonedProducts = catalog.products.map((product) => ({ ...product }))
    const clonedSignals = new Map<string, ProductLiveSignals>()

    for (const [productId, signal] of liveSignals.entries()) {
      clonedSignals.set(productId, {
        ...signal,
        metrics: {
          monthly_revenue_actual: { ...signal.metrics.monthly_revenue_actual },
          pipeline_actual: { ...signal.metrics.pipeline_actual },
          collections_outstanding: { ...signal.metrics.collections_outstanding },
          active_users: { ...signal.metrics.active_users },
          engineering_velocity: { ...signal.metrics.engineering_velocity },
        },
        connectors: signal.connectors.map((connector) => ({ ...connector })),
        engineeringSignals: { ...signal.engineeringSignals },
      })
    }

    for (const product of clonedProducts) {
      const adjustments = scenario.product_adjustments[product.id]
      if (!adjustments) continue
      const signal = clonedSignals.get(product.id)
      if (signal) {
        const metricMap = [
          ['monthly_revenue_actual', adjustments.monthly_revenue_actual_delta],
          ['pipeline_actual', adjustments.pipeline_actual_delta],
          ['collections_outstanding', adjustments.collections_outstanding_delta],
          ['active_users', adjustments.active_users_delta],
          ['engineering_velocity', adjustments.engineering_velocity_delta],
        ] as const
        for (const [key, delta] of metricMap) {
          if (delta !== undefined) {
            const current = signal.metrics[key].value ?? metricNumber(product, signal, key)
            signal.metrics[key] = {
              ...signal.metrics[key],
              value: current + delta,
              source: `scenario:${scenario.id}`,
              sourceType: 'estimate',
              confidence: 'LOW',
              note: `Scenario adjustment ${delta >= 0 ? '+' : ''}${delta}.`,
            }
          }
        }
        signal.confidencePct = round1([
          signal.metrics.monthly_revenue_actual,
          signal.metrics.pipeline_actual,
          signal.metrics.collections_outstanding,
          signal.metrics.active_users,
          signal.metrics.engineering_velocity,
        ].reduce((acc, observation, index) => {
          const weight = [0.3, 0.25, 0.15, 0.1, 0.2][index]
          return acc + (confidenceWeight(observation) * weight)
        }, 0) * 100)
      }
      if (adjustments.probability_of_close_delta !== undefined) {
        product.probability_of_close = clamp(product.probability_of_close + adjustments.probability_of_close_delta, 0, 1)
      }
    }

    const scenarioScores = buildCapitalAllocation(clonedProducts, catalog.capital_weights, { liveSignals: clonedSignals, overrides })
    const scenarioCashForecast = buildCashForecast(
      {
        ...catalog,
        capital_model: {
          scenarios: {
            ...catalog.capital_model.scenarios,
            current_cash: catalog.capital_model.scenarios.current_cash + scenario.global_adjustments.current_cash_delta,
            monthly_overhead: catalog.capital_model.scenarios.monthly_overhead + scenario.global_adjustments.monthly_overhead_delta,
          },
        },
      },
      scenarioScores,
      cashCalendar,
    )
    const scenarioAlerts = buildCapitalAlerts(
      {
        ...catalog,
        capital_model: {
          scenarios: {
            ...catalog.capital_model.scenarios,
            current_cash: catalog.capital_model.scenarios.current_cash + scenario.global_adjustments.current_cash_delta,
            monthly_overhead: catalog.capital_model.scenarios.monthly_overhead + scenario.global_adjustments.monthly_overhead_delta,
          },
        },
      },
      scenarioScores,
      scenarioCashForecast,
      cashCalendar,
    )
    const runwayMonths = calculateRunwayMonths(
      catalog.capital_model.scenarios.current_cash + scenario.global_adjustments.current_cash_delta,
      catalog.capital_model.scenarios.monthly_overhead + scenario.global_adjustments.monthly_overhead_delta,
      scenarioScores,
      catalog.capital_model.scenarios.expected_closes_monthly.base,
    )
    const survivalProbabilityPct = estimateSurvivalProbability(runwayMonths, scenarioScores, cashCalendar.sustainable_founder_hours_per_week * scenario.global_adjustments.founder_capacity_multiplier, scenario.global_adjustments.survival_probability_delta)
    const allocationChanges = scenarioScores
      .map((score) => {
        const baseline = baseScores.find((candidate) => candidate.product.id === score.product.id)
        return {
          product: score.product.name,
          from: baseline?.final_decision ?? score.final_decision,
          to: score.final_decision,
          score_delta: round1(score.composite_allocation_score - (baseline?.composite_allocation_score ?? 0)),
        }
      })
      .filter((entry) => entry.from !== entry.to || Math.abs(entry.score_delta) >= 2)
      .sort((left, right) => Math.abs(right.score_delta) - Math.abs(left.score_delta))
      .slice(0, 5)

    return {
      scenario,
      runway_months: runwayMonths,
      survival_probability_pct: survivalProbabilityPct,
      hiring_recommendation: buildHiringRecommendation(runwayMonths, scenarioAlerts, scenario.global_adjustments.hiring_bias),
      allocation_changes: allocationChanges,
    }
  })
}

function getMostMispricedHiddenBet(scores: ProductScore[]): ProductScore | null {
  const bets = scores
    .filter((score) => score.final_decision !== 'FUND NOW' && score.final_decision !== 'BET THE COMPANY')
    .map((score) => ({
      score,
      upsideGap: round1((score.strategic_value_score + score.data_confidence_pct) - score.composite_allocation_score),
    }))
    .sort((left, right) => right.upsideGap - left.upsideGap)
  return bets[0]?.score ?? null
}

export function buildCapitalOutputs(root = findRepoRoot()): CapitalOutputs {
  const catalog = loadCapitalCatalog(root)
  const validation = validateCapitalCatalog(catalog)
  const liveSignals = validation.errors.length > 0 ? new Map<string, ProductLiveSignals>() : loadCapitalLiveSignals(catalog.products, root)
  const overrideLog = loadCapitalOverrideLog(root)
  const cashCalendar = loadCapitalCashCalendar(root)
  const scenarioPack = loadCapitalScenarioPack(root)
  const scores = validation.errors.length > 0 ? [] : buildCapitalAllocation(catalog.products, catalog.capital_weights, { liveSignals, overrides: overrideLog })
  const cashForecast = validation.errors.length > 0 ? [] : buildCashForecast(catalog, scores, cashCalendar)
  const alerts = validation.errors.length > 0 ? [] : buildCapitalAlerts(catalog, scores, cashForecast, cashCalendar)
  const overrideAnalytics = buildOverrideAnalytics(scores, overrideLog)
  const scenarioOutcomes = validation.errors.length > 0 ? [] : buildScenarioOutcomes(catalog, scores, liveSignals, overrideLog, scenarioPack, cashCalendar)
  const runwayMonthsToday = validation.errors.length > 0
    ? 0
    : calculateRunwayMonths(catalog.capital_model.scenarios.current_cash, catalog.capital_model.scenarios.monthly_overhead, scores, catalog.capital_model.scenarios.expected_closes_monthly.base)
  return {
    catalog,
    validation,
    live_signals: liveSignals,
    override_log: overrideLog,
    cash_calendar: cashCalendar,
    scenario_pack: scenarioPack,
    scores,
    cash_forecast: cashForecast,
    alerts,
    override_analytics: overrideAnalytics,
    scenario_outcomes: scenarioOutcomes,
    runway_months_today: runwayMonthsToday,
    most_mispriced_hidden_bet: getMostMispricedHiddenBet(scores),
  }
}

function combineScenarios(scenarios: CapitalScenario[]): CapitalScenario | null {
  if (scenarios.length === 0) return null
  const combined: CapitalScenario = {
    id: scenarios.map((scenario) => scenario.id).join('+'),
    title: scenarios.map((scenario) => scenario.title).join(' + '),
    description: scenarios.map((scenario) => scenario.description).join(' '),
    product_adjustments: {},
    global_adjustments: {
      current_cash_delta: 0,
      monthly_overhead_delta: 0,
      survival_probability_delta: 0,
      founder_capacity_multiplier: 1,
      hiring_bias: 'defer',
    },
  }

  const biasRank: Record<ScenarioGlobalAdjustments['hiring_bias'], number> = {
    accelerate: 4,
    delay: 2,
    freeze: 1,
    defer: 3,
  }

  for (const scenario of scenarios) {
    combined.global_adjustments.current_cash_delta += scenario.global_adjustments.current_cash_delta
    combined.global_adjustments.monthly_overhead_delta += scenario.global_adjustments.monthly_overhead_delta
    combined.global_adjustments.survival_probability_delta += scenario.global_adjustments.survival_probability_delta
    combined.global_adjustments.founder_capacity_multiplier *= scenario.global_adjustments.founder_capacity_multiplier
    if (biasRank[scenario.global_adjustments.hiring_bias] < biasRank[combined.global_adjustments.hiring_bias]) {
      combined.global_adjustments.hiring_bias = scenario.global_adjustments.hiring_bias
    }

    for (const [productId, adjustment] of Object.entries(scenario.product_adjustments)) {
      const existing = combined.product_adjustments[productId] ?? {}
      combined.product_adjustments[productId] = {
        monthly_revenue_actual_delta: (existing.monthly_revenue_actual_delta ?? 0) + (adjustment.monthly_revenue_actual_delta ?? 0),
        pipeline_actual_delta: (existing.pipeline_actual_delta ?? 0) + (adjustment.pipeline_actual_delta ?? 0),
        collections_outstanding_delta: (existing.collections_outstanding_delta ?? 0) + (adjustment.collections_outstanding_delta ?? 0),
        active_users_delta: (existing.active_users_delta ?? 0) + (adjustment.active_users_delta ?? 0),
        engineering_velocity_delta: (existing.engineering_velocity_delta ?? 0) + (adjustment.engineering_velocity_delta ?? 0),
        probability_of_close_delta: (existing.probability_of_close_delta ?? 0) + (adjustment.probability_of_close_delta ?? 0),
      }
    }
  }

  return combined
}

export function evaluateScenarioStack(root = findRepoRoot(), scenarioIds: string[]): ScenarioOutcome | null {
  const cacheKey = `${root}::${scenarioIds.slice().sort().join(',')}`
  const cached = scenarioOutcomeCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const outputs = getCachedCapitalOutputs(root)
  const scenarios = outputs.scenario_pack.scenarios.filter((scenario) => scenarioIds.includes(scenario.id))
  const combined = combineScenarios(scenarios)
  if (!combined) {
    scenarioOutcomeCache.set(cacheKey, null)
    return null
  }

  const outcome = buildScenarioOutcomes(
    outputs.catalog,
    outputs.scores,
    outputs.live_signals,
    outputs.override_log,
    {
      as_of_date: outputs.scenario_pack.as_of_date,
      assumptions_note: outputs.scenario_pack.assumptions_note,
      scenarios: [combined],
    },
    outputs.cash_calendar,
  )[0] ?? null

  scenarioOutcomeCache.set(cacheKey, outcome)
  return outcome
}

const capitalOutputsCache = new Map<string, ReturnType<typeof buildCapitalOutputs>>()
const scenarioOutcomeCache = new Map<string, ScenarioOutcome | null>()

function getCachedCapitalOutputs(root: string): ReturnType<typeof buildCapitalOutputs> {
  const cached = capitalOutputsCache.get(root)
  if (cached) {
    return cached
  }
  const outputs = buildCapitalOutputs(root)
  capitalOutputsCache.set(root, outputs)
  return outputs
}