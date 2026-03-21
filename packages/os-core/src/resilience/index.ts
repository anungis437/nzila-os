/**
 * Resilience Patterns for Nzila OS
 *
 * Provides:
 * - Circuit breaker (prevents cascade failures)
 * - Bulkhead (limits concurrent operations)
 * - Retry with exponential backoff + jitter
 * - Timeout wrapper
 * - Fallback chains
 *
 * All patterns emit OTel-compatible events and integrate with
 * the evidence system for compliance reporting.
 */

export { CircuitBreaker, type CircuitBreakerOptions, type CircuitState } from './circuit-breaker';
export { Bulkhead, type BulkheadOptions } from './bulkhead';
export { OrgBulkheadPool, OrgBulkheadOverloadError, type OrgBulkheadPoolOptions } from './org-bulkhead';
export { retry, type RetryOptions } from './retry';
export { withTimeout, type TimeoutOptions } from './timeout';
