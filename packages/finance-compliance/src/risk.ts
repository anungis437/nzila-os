import type { RiskTier } from './types.js'

export interface RiskFactor {
  name: string
  weight: number
  value: number
}

const RISK_TIER_THRESHOLDS = {
  LOW_MAX: 25,
  MEDIUM_MAX: 50,
  HIGH_MAX: 75,
} as const

export function computeRiskTier(factors: RiskFactor[]): RiskTier {
  if (factors.length === 0) return 'low'
  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0)
  if (totalWeight === 0) return 'low'
  const weightedScore = factors.reduce((sum, f) => sum + f.weight * f.value, 0) / totalWeight
  if (weightedScore <= RISK_TIER_THRESHOLDS.LOW_MAX) return 'low'
  if (weightedScore <= RISK_TIER_THRESHOLDS.MEDIUM_MAX) return 'medium'
  if (weightedScore <= RISK_TIER_THRESHOLDS.HIGH_MAX) return 'high'
  return 'critical'
}
