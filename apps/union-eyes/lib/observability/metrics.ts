/**
 * Prometheus Metrics Collection
 * 
 * Exposes application metrics in Prometheus format for monitoring,
 * alerting, and capacity planning.
 * 
 * Metrics Categories:
 * - System: Memory, CPU, event loop lag
 * - Application: Request rates, error rates, latencies
 * - Business: Claims processed, members onboarded, payments
 * - Database: Query times, connection pool stats
 * - Cache: Hit rates, Redis operations
 * 
 * Access metrics at: GET /api/metrics
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

// Create registry
const register = new Registry();

// Collect default system metrics (memory, CPU, etc.)
collectDefaultMetrics({ 
  register,
  prefix: 'union_eyes_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// ============================================
// HTTP Request Metrics
// ============================================

export const httpRequestsTotal = new Counter({
  name: 'union_eyes_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: 'union_eyes_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

export const httpRequestSize = new Histogram({
  name: 'union_eyes_http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [register],
});

export const httpResponseSize = new Histogram({
  name: 'union_eyes_http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [register],
});

// ============================================
// Database Metrics
// ============================================

export const dbQueryDuration = new Histogram({
  name: 'union_eyes_db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2],
  registers: [register],
});

export const dbConnectionsActive = new Gauge({
  name: 'union_eyes_db_connections_active',
  help: 'Number of active database connections',
  registers: [register],
});

export const dbConnectionsIdle = new Gauge({
  name: 'union_eyes_db_connections_idle',
  help: 'Number of idle database connections',
  registers: [register],
});

export const dbConnectionsMax = new Gauge({
  name: 'union_eyes_db_connections_max',
  help: 'Maximum number of database connections',
  registers: [register],
});

export const dbQueryErrors = new Counter({
  name: 'union_eyes_db_query_errors_total',
  help: 'Total number of database query errors',
  labelNames: ['operation', 'error_type'],
  registers: [register],
});

export const dbConnectionPoolWaitTime = new Histogram({
  name: 'union_eyes_db_connection_pool_wait_seconds',
  help: 'Time waiting for a connection from the pool',
  buckets: [0.001, 0.01, 0.1, 0.5, 1, 2],
  registers: [register],
});

// ============================================
// Cache Metrics (Redis)
// ============================================

export const cacheHits = new Counter({
  name: 'union_eyes_cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_name'],
  registers: [register],
});

export const cacheMisses = new Counter({
  name: 'union_eyes_cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_name'],
  registers: [register],
});

export const cacheOperationDuration = new Histogram({
  name: 'union_eyes_cache_operation_duration_seconds',
  help: 'Duration of cache operations in seconds',
  labelNames: ['operation', 'cache_name'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
  registers: [register],
});

// ============================================
// Business Metrics
// ============================================

export const claimsProcessed = new Counter({
  name: 'union_eyes_claims_processed_total',
  help: 'Total number of claims processed',
  labelNames: ['status', 'organization_id'],
  registers: [register],
});

export const claimProcessingDuration = new Histogram({
  name: 'union_eyes_claim_processing_duration_seconds',
  help: 'Time to process a claim from submission to resolution',
  labelNames: ['claim_type', 'outcome'],
  buckets: [60, 300, 900, 3600, 86400, 604800], // 1m, 5m, 15m, 1h, 1d, 1w
  registers: [register],
});

export const membersOnboarded = new Counter({
  name: 'union_eyes_members_onboarded_total',
  help: 'Total number of members onboarded',
  labelNames: ['organization_id', 'onboarding_method'],
  registers: [register],
});

export const paymentsProcessed = new Counter({
  name: 'union_eyes_payments_processed_total',
  help: 'Total number of payments processed',
  labelNames: ['status', 'payment_method'],
  registers: [register],
});

export const paymentAmount = new Histogram({
  name: 'union_eyes_payment_amount_dollars',
  help: 'Payment amount in dollars',
  labelNames: ['payment_type'],
  buckets: [10, 50, 100, 500, 1000, 5000, 10000],
  registers: [register],
});

// ============================================
// Background Job Metrics
// ============================================

export const jobsQueued = new Gauge({
  name: 'union_eyes_jobs_queued',
  help: 'Number of jobs in the queue',
  labelNames: ['queue_name', 'job_type'],
  registers: [register],
});

export const jobsProcessed = new Counter({
  name: 'union_eyes_jobs_processed_total',
  help: 'Total number of jobs processed',
  labelNames: ['queue_name', 'job_type', 'status'],
  registers: [register],
});

export const jobProcessingDuration = new Histogram({
  name: 'union_eyes_job_processing_duration_seconds',
  help: 'Duration of job processing in seconds',
  labelNames: ['queue_name', 'job_type'],
  buckets: [1, 5, 10, 30, 60, 300, 600],
  registers: [register],
});

// ============================================
// Feature Flag Metrics
// ============================================

export const featureFlagEvaluations = new Counter({
  name: 'union_eyes_feature_flag_evaluations_total',
  help: 'Total number of feature flag evaluations',
  labelNames: ['flag_name', 'result'],
  registers: [register],
});

// ============================================
// Export Registry
// ============================================

/**
 * Get all metrics in Prometheus format
 */
export async function getMetrics(): Promise<string> {
  return register.metrics();
}

/**
 * Get metrics as JSON (for internal use)
 */
export async function getMetricsJSON(): Promise<unknown> {
  return register.getMetricsAsJSON();
}

/**
 * Get content type for Prometheus metrics
 */
export function getMetricsContentType(): string {
  return register.contentType;
}

/**
 * Reset all metrics (useful for testing)
 */
export function resetMetrics(): void {
  register.resetMetrics();
}

// Export registry for custom metrics
export { register };

