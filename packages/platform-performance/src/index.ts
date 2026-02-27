/**
 * Nzila OS — Platform Performance Envelope
 *
 * Request-level metrics tracking and percentile computation.
 * No secrets exposed. Org-scoped visibility with platform admin global view.
 *
 * @module @nzila/platform-performance
 */

export {
  trackRequestMetrics,
  getPerformanceEnvelope,
  getGlobalPerformanceEnvelope,
  type RequestMetric,
  type PerformanceEnvelope,
} from './metrics'
