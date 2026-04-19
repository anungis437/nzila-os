import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { findRepoRoot, PORTFOLIO_CATALOG_PATH } from './portfolio-governance'

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
  capital_efficiency_score: number
  attention_efficiency_score: number
  engineering_roi_score: number
  strategic_value_score: number
  risk_penalty_score: number
  composite_allocation_score: number
  decision: CapitalDecision
  recommended_monthly_budget: number
  recommended_eng_hours: number
  recommended_founder_hours: number
  reasoning: string[]
}

export interface CapitalValidation {
  errors: string[]
  warnings: string[]
}

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

function getDerivedMetrics(products: CapitalProduct[]): {
  capitalEfficiency: number[]
  attentionEfficiency: number[]
  engineeringRoi: number[]
  pipelinePotential: number[]
  revenueScale: number[]
} {
  const capitalEfficiency = products.map((product) => {
    const marginAdjustedRevenue = product.monthly_revenue * (product.gross_margin_pct / 100)
    return safeDivide(marginAdjustedRevenue, Math.max(product.monthly_burn, 1))
  })

  const attentionEfficiency = products.map((product) => {
    const upside = (product.expected_12m_revenue * product.probability_of_close) + (product.pipeline_value * product.probability_of_close)
    return safeDivide(upside, Math.max(product.founder_attention_hours, 1))
  })

  const engineeringRoi = products.map((product) => {
    const upside = ((product.expected_12m_revenue - product.annual_recurring_revenue) * product.probability_of_close) + (product.pipeline_value * product.probability_of_close)
    return safeDivide(upside, Math.max(product.eng_hours_required_monthly, 1))
  })

  const pipelinePotential = products.map((product) => (product.pipeline_value * product.probability_of_close) + product.expected_12m_revenue)
  const revenueScale = products.map((product) => product.monthly_revenue)

  return { capitalEfficiency, attentionEfficiency, engineeringRoi, pipelinePotential, revenueScale }
}

function computeDecision(product: CapitalProduct, score: number, strategicScore: number, riskPenaltyScore: number): CapitalDecision {
  const hardPause = product.monthly_burn > 0
    && product.proof_level === 'none'
    && product.pipeline_value < 50000
    && strategicScore < 45

  const hardFund = product.monthly_revenue > 0
    && product.gross_margin_pct >= 65
    && product.pipeline_value >= 150000
    && product.support_hours <= 40

  if (product.status === 'sunset' || product.gtm_posture === 'sunset' || product.tier === 5) return 'SUNSET'
  if (hardPause) return 'PAUSE'
  if (score >= 88 && hardFund && riskPenaltyScore < 30 && product.tier === 1) return 'BET THE COMPANY'
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

export function buildCapitalAllocation(products: CapitalProduct[], weights: CapitalWeights): ProductScore[] {
  const { capitalEfficiency, attentionEfficiency, engineeringRoi, pipelinePotential, revenueScale } = getDerivedMetrics(products)
  const maxCapitalEfficiency = Math.max(...capitalEfficiency, 1)
  const maxAttentionEfficiency = Math.max(...attentionEfficiency, 1)
  const maxEngineeringRoi = Math.max(...engineeringRoi, 1)
  const maxPipelinePotential = Math.max(...pipelinePotential, 1)
  const maxRevenue = Math.max(...revenueScale, 1)

  return products.map((product, index) => {
    const capitalEfficiencyScore = normalizeByMax(capitalEfficiency[index], maxCapitalEfficiency)
    const attentionEfficiencyScore = normalizeByMax(attentionEfficiency[index], maxAttentionEfficiency)
    const engineeringRoiScore = normalizeByMax(engineeringRoi[index], maxEngineeringRoi)
    const strategicValueScore = normalizeRisk((product.moat_score + product.strategic_option_value + product.ecosystem_synergy) / 3)
    const riskPenaltyScore = normalizeRisk((product.churn_risk + product.customer_concentration_risk + product.execution_risk) / 3)

    const revenueScore = normalizeByMax(product.monthly_revenue, maxRevenue)
    const marginScore = normalizePercent(product.gross_margin_pct)
    const pipelineScore = normalizeByMax(pipelinePotential[index], maxPipelinePotential)
    const efficiencyScore = (capitalEfficiencyScore + attentionEfficiencyScore + engineeringRoiScore) / 3

    const compositeRaw = (weights.revenue * revenueScore)
      + (weights.margin * marginScore)
      + (weights.pipeline * pipelineScore)
      + (weights.strategic * strategicValueScore)
      + (weights.efficiency * efficiencyScore)
      - (weights.risk_penalty * riskPenaltyScore)

    const compositeScore = round1(clamp(compositeRaw, 0, 100))
    const decision = computeDecision(product, compositeScore, strategicValueScore, riskPenaltyScore)
    const allocation = allocateResources(product, decision)

    const reasoning: string[] = [
      `Capital efficiency=${round1(capitalEfficiencyScore)}`,
      `Attention efficiency=${round1(attentionEfficiencyScore)}`,
      `Engineering ROI=${round1(engineeringRoiScore)}`,
      `Strategic score=${round1(strategicValueScore)}`,
      `Risk penalty=${round1(riskPenaltyScore)}`,
    ]

    return {
      product,
      capital_efficiency_score: round1(capitalEfficiencyScore),
      attention_efficiency_score: round1(attentionEfficiencyScore),
      engineering_roi_score: round1(engineeringRoiScore),
      strategic_value_score: round1(strategicValueScore),
      risk_penalty_score: round1(riskPenaltyScore),
      composite_allocation_score: compositeScore,
      decision,
      recommended_monthly_budget: allocation.budget,
      recommended_eng_hours: allocation.engHours,
      recommended_founder_hours: allocation.founderHours,
      reasoning,
    }
  }).sort((left, right) => right.composite_allocation_score - left.composite_allocation_score)
}

export function buildCapitalOutputs(root = findRepoRoot()): {
  catalog: CapitalCatalog
  validation: CapitalValidation
  scores: ProductScore[]
} {
  const catalog = loadCapitalCatalog(root)
  const validation = validateCapitalCatalog(catalog)
  const scores = validation.errors.length > 0 ? [] : buildCapitalAllocation(catalog.products, catalog.capital_weights)
  return { catalog, validation, scores }
}