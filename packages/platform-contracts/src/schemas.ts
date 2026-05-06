/**
 * Platform Contract Schemas — lightweight runtime validators.
 * No external dependencies. Used by apps to validate contract conformance.
 */

import type { HealthResponse, HealthStatus } from './health'
import type { MetricsSummary, MetricType } from './metrics'
import type { GovernanceTelemetry, GovernanceCheckResult } from './governance'
import type { EvidenceExport } from './evidence'

const VALID_HEALTH_STATUSES: HealthStatus[] = ['healthy', 'degraded', 'unhealthy']
const VALID_METRIC_TYPES: MetricType[] = ['counter', 'gauge', 'histogram']
const VALID_GOV_RESULTS: GovernanceCheckResult[] = ['pass', 'fail', 'warn', 'skip']

export function isValidHealthResponse(data: unknown): data is HealthResponse {
  if (!data || typeof data !== 'object') return false
  const r = data as Record<string, unknown>
  return (
    typeof r.status === 'string' &&
    VALID_HEALTH_STATUSES.includes(r.status as HealthStatus) &&
    typeof r.app === 'string' &&
    typeof r.version === 'string' &&
    typeof r.timestamp === 'string' &&
    typeof r.uptime_seconds === 'number' &&
    Array.isArray(r.components)
  )
}

export function isValidMetricsSummary(data: unknown): data is MetricsSummary {
  if (!data || typeof data !== 'object') return false
  const r = data as Record<string, unknown>
  return (
    typeof r.app === 'string' &&
    typeof r.org_id === 'string' &&
    Array.isArray(r.entries) &&
    (r.entries as Array<Record<string, unknown>>).every(
      (e) =>
        typeof e.name === 'string' &&
        VALID_METRIC_TYPES.includes(e.type as MetricType) &&
        typeof e.value === 'number'
    )
  )
}

export function isValidGovernanceTelemetry(data: unknown): data is GovernanceTelemetry {
  if (!data || typeof data !== 'object') return false
  const r = data as Record<string, unknown>
  return (
    typeof r.app === 'string' &&
    typeof r.org_id === 'string' &&
    Array.isArray(r.checks) &&
    VALID_GOV_RESULTS.includes(r.overall_result as GovernanceCheckResult)
  )
}

export function isValidEvidenceExport(data: unknown): data is EvidenceExport {
  if (!data || typeof data !== 'object') return false
  const r = data as Record<string, unknown>
  return (
    typeof r.app === 'string' &&
    typeof r.org_id === 'string' &&
    typeof r.export_id === 'string' &&
    Array.isArray(r.artifacts) &&
    typeof r.chain_hash === 'string'
  )
}
