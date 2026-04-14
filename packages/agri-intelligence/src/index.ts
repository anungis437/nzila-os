// ---------------------------------------------------------------------------
// @nzila/agri-intelligence — barrel export
// ---------------------------------------------------------------------------

export {
  computeHistoricalMeanYieldPerHa,
  forecastYieldPerHaTrend,
  computeClimateRiskAdjustment,
  computeExpectedYield,
  computeExpectedYieldWithTrend,
  applyClimateAdjustment,
  computeYieldEfficiency,
  getExpectedYield,
  getExpectedYieldWithClimateAdjustment,
} from './yield'
export type {
  YieldEfficiencyResult,
  ExpectedYieldResult,
  YieldTrendForecast,
  ClimateAdjustedYieldResult,
} from './yield'

export {
  computeLossRate,
  computeLossRateByCrop,
  detectLossAnomalies,
  detectLossDrift,
} from './loss'
export type {
  LossRateResult,
  BatchWeightPair,
  TimedBatchWeightPair,
  LossAnomaly,
  LossDriftResult,
} from './loss'

export { simulatePayout, computeFairShare } from './payout'
export type { PayoutEntry, PayoutSimulationResult, PayoutLineItem } from './payout'

export {
  createStubYieldProvider,
  createStubPricingProvider,
  createStubClimateProvider,
} from './providers'
export type {
  YieldDataPoint,
  PriceObservation,
  ClimateRiskFactor,
  YieldModelProvider,
  PricingSignalProvider,
  ClimateRiskProvider,
} from './providers'

export {
  createRecommendation,
  createAlert,
  createInsight,
  assertExplainable,
} from './explainability'
