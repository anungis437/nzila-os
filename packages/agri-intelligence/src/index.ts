// ---------------------------------------------------------------------------
// @nzila/agri-intelligence — barrel export
// ---------------------------------------------------------------------------

export {
  computeHistoricalMeanYieldPerHa,
  computeExpectedYield,
  computeYieldEfficiency,
  getExpectedYield,
} from './yield'
export type { YieldEfficiencyResult, ExpectedYieldResult } from './yield'

export { computeLossRate, computeLossRateByCrop } from './loss'
export type { LossRateResult, BatchWeightPair } from './loss'

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
