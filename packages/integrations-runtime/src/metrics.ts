/**
 * Nzila OS — Integration Runtime: Metrics Collector
 *
 * Tracks per-delivery latency and aggregates into rolling windows
 * (5m + 1h), writing snapshots to integration_provider_metrics.
 * Also updates provider health based on success/failure patterns.
 *
 * No secrets stored — only operational telemetry.
 */
import type { IntegrationProvider, HealthStatus } from '@nzila/integrations-core'
import type { IntegrationMetricsRepo, IntegrationHealthRepo, CircuitState } from '@nzila/integrations-db'

// ── Types ───────────────────────────────────────────────────────────────────

export interface DeliveryMetricEvent {
  readonly orgId: string
  readonly provider: IntegrationProvider
  readonly success: boolean
  readonly latencyMs: number
  readonly rateLimited: boolean
  readonly timedOut: boolean
  readonly errorCode?: string
  readonly errorMessage?: string
  readonly timestamp: string
}

export interface MetricsCollectorPorts {
  readonly metricsRepo: IntegrationMetricsRepo
  readonly healthRepo: IntegrationHealthRepo
  readonly emitAudit: (event: {
    type: string
    orgId: string
    provider: IntegrationProvider
    details?: Record<string, unknown>
  }) => void
}

interface WindowBuffer {
  readonly orgId: string
  readonly provider: IntegrationProvider
  latencies: number[]
  sentCount: number
  successCount: number
  failureCount: number
  rateLimitedCount: number
  timeoutCount: number
  windowStart: string
  windowEnd: string
}

// ── Percentile utility ──────────────────────────────────────────────────────

export function computePercentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)] ?? 0
}

// ── Collector ───────────────────────────────────────────────────────────────

const FIVE_MIN_MS = 5 * 60 * 1000
const ONE_HOUR_MS = 60 * 60 * 1000

export class MetricsCollector {
  private readonly ports: MetricsCollectorPorts
  /** In-memory buffers keyed by orgId:provider:windowType */
  private readonly buffers = new Map<string, WindowBuffer>()

  constructor(ports: MetricsCollectorPorts) {
    this.ports = ports
  }

  private bufferKey(orgId: string, provider: IntegrationProvider, windowType: '5m' | '1h'): string {
    return `${orgId}:${provider}:${windowType}`
  }

  private getOrCreateBuffer(
    orgId: string,
    provider: IntegrationProvider,
    windowType: '5m' | '1h',
    timestamp: string,
  ): WindowBuffer {
    const key = this.bufferKey(orgId, provider, windowType)
    const existing = this.buffers.get(key)
    const windowMs = windowType === '5m' ? FIVE_MIN_MS : ONE_HOUR_MS
    const now = new Date(timestamp).getTime()
    const windowStart = new Date(Math.floor(now / windowMs) * windowMs).toISOString()
    const windowEnd = new Date(Math.floor(now / windowMs) * windowMs + windowMs).toISOString()

    // If existing buffer is for the same window, reuse it
    if (existing && existing.windowStart === windowStart) {
      return existing
    }

    // Flush old buffer if it exists (window rolled over)
    if (existing) {
      void this.flushBuffer(existing)
    }

    const buffer: WindowBuffer = {
      orgId,
      provider,
      latencies: [],
      sentCount: 0,
      successCount: 0,
      failureCount: 0,
      rateLimitedCount: 0,
      timeoutCount: 0,
      windowStart,
      windowEnd,
    }
    this.buffers.set(key, buffer)
    return buffer
  }

  /** Record a single delivery metric event into rolling windows. */
  record(event: DeliveryMetricEvent): void {
    for (const windowType of ['5m', '1h'] as const) {
      const buf = this.getOrCreateBuffer(event.orgId, event.provider, windowType, event.timestamp)
      buf.sentCount++
      buf.latencies.push(event.latencyMs)
      if (event.success) buf.successCount++
      else buf.failureCount++
      if (event.rateLimited) buf.rateLimitedCount++
      if (event.timedOut) buf.timeoutCount++
    }
  }

  /** Flush a buffer to the metrics repo. */
  private async flushBuffer(buffer: WindowBuffer): Promise<void> {
    const sorted = [...buffer.latencies].sort((a, b) => a - b)
    await this.ports.metricsRepo.recordMetrics({
      orgId: buffer.orgId,
      provider: buffer.provider,
      windowStart: buffer.windowStart,
      windowEnd: buffer.windowEnd,
      sentCount: buffer.sentCount,
      successCount: buffer.successCount,
      failureCount: buffer.failureCount,
      p50LatencyMs: computePercentile(sorted, 50),
      p95LatencyMs: computePercentile(sorted, 95),
      p99LatencyMs: computePercentile(sorted, 99),
      rateLimitedCount: buffer.rateLimitedCount,
      timeoutCount: buffer.timeoutCount,
    })
  }

  /** Flush all current buffers (call at shutdown or interval). */
  async flushAll(): Promise<void> {
    const promises: Promise<void>[] = []
    for (const buf of this.buffers.values()) {
      if (buf.sentCount > 0) {
        promises.push(this.flushBuffer(buf))
      }
    }
    await Promise.all(promises)
    this.buffers.clear()
  }

  /** Update provider health snapshot based on latest delivery outcome. */
  async updateHealthSnapshot(
    orgId: string,
    provider: IntegrationProvider,
    success: boolean,
    errorCode?: string,
    errorMessage?: string,
  ): Promise<{ status: HealthStatus; consecutiveFailures: number; circuitState: CircuitState }> {
    const existing = await this.ports.healthRepo.findByOrgAndProvider(orgId, provider)
    const consecutiveFailures = success ? 0 : (existing?.consecutiveFailures ?? 0) + 1

    let status: HealthStatus = 'ok'
    if (consecutiveFailures >= 5) status = 'down'
    else if (consecutiveFailures >= 2) status = 'degraded'

    // Preserve circuit state from circuit breaker (don't interfere)
    const circuitState: CircuitState = existing?.circuitState ?? 'closed'

    const record = await this.ports.healthRepo.upsert(orgId, provider, {
      status,
      lastErrorCode: success ? undefined : errorCode,
      lastErrorMessage: success ? undefined : errorMessage,
      consecutiveFailures,
      circuitState,
    })

    return {
      status: record.status as HealthStatus,
      consecutiveFailures: record.consecutiveFailures,
      circuitState: record.circuitState as CircuitState,
    }
  }
}
