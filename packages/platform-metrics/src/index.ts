/**
 * Nzila OS — Platform Metrics
 *
 * Shared metrics module for cross-app KPI calculation.
 *
 * @module @nzila/platform-metrics
 */
export {
  getOrgPerformanceMetrics,
  type OrgPerformanceMetrics,
} from './org-metrics'

export {
  getPlatformOverviewMetrics,
  getOrgOverviewMetrics,
  type PlatformOverviewMetrics,
  type OrgScopedOverviewMetrics,
} from './platform-metrics'

export {
  computeUnitEconomics,
  computeNRRBreakdown,
  seedUnitEconomics,
  seedNRRBreakdown,
  type SaaSUnitEconomics,
  type CohortRetention,
  type NRRBreakdown,
} from './unit-economics'

export {
  computeESGScorecard,
  seedESGScorecard,
  seedSDGAlignments,
  type ESGScorecard,
  type ESGPillarScore,
  type SDGAlignment,
  type CarbonFootprint,
  type ESGRating,
} from './esg-impact'
