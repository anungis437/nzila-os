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
