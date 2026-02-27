/**
 * Nzila OS — Integration Runtime: SLO/SLA Computer
 *
 * Computes SLO compliance per org + provider + channel:
 *   - Availability = success_count / sent_count
 *   - DeliveryLatencyP95 = computed from metrics
 *   - ErrorRate = failure_count / sent_count
 *
 * Compares against stored SLO targets (org-scoped overridable, platform default).
 * Detects breaches and emits audit events.
 */
import type { IntegrationProvider } from '@nzila/integrations-core'
import type {
  IntegrationMetricsRepo,
  IntegrationSloTargetRepo,
  ProviderMetricsWindow,
  SloTarget,
} from '@nzila/integrations-db'

// ── Types ───────────────────────────────────────────────────────────────────

export interface SloResult {
  readonly orgId: string
  readonly provider: IntegrationProvider
  readonly channel: string | null
  /** Availability = success_count / sent_count (0–1) */
  readonly availability: number
  /** P95 latency in ms, aggregated over the window */
  readonly p95LatencyMs: number
  /** Error rate = failure_count / sent_count (0–1) */
  readonly errorRate: number
  /** Total sent in the window */
  readonly sentCount: number
  /** Total failures in the window */
  readonly failureCount: number
  /** SLO target applied */
  readonly target: SloTarget | null
  /** Is the availability above the target? */
  readonly availabilityMet: boolean
  /** Is the P95 latency below the target? */
  readonly latencyMet: boolean
  /** Overall compliance */
  readonly compliant: boolean
  /** Computed at */
  readonly computedAt: string
}

export interface SlaBreach {
  readonly orgId: string
  readonly provider: IntegrationProvider
  readonly metric: 'availability' | 'latency'
  readonly actual: number
  readonly target: number
  readonly computedAt: string
}

// ── Ports ───────────────────────────────────────────────────────────────────

export interface SloComputerPorts {
  readonly metricsRepo: IntegrationMetricsRepo
  readonly sloTargetRepo: IntegrationSloTargetRepo
  readonly emitAudit: (event: {
    type: string
    orgId: string
    provider: IntegrationProvider
    details?: Record<string, unknown>
  }) => void
}

// ── SLO Computer ────────────────────────────────────────────────────────────

export class SloComputer {
  private readonly ports: SloComputerPorts

  constructor(ports: SloComputerPorts) {
    this.ports = ports
  }

  /**
   * Compute SLO for a specific org + provider.
   * Aggregates metrics over the SLO window (default 30 days).
   */
  async compute(
    orgId: string,
    provider: IntegrationProvider,
    channel?: string | null,
  ): Promise<SloResult> {
    // Get target: org-specific first, fallback to platform default
    const orgTarget = await this.ports.sloTargetRepo.findForOrgAndProvider(orgId, provider, channel)
    const target = orgTarget ?? await this.ports.sloTargetRepo.findDefault(provider, channel)

    const windowDays = target?.windowDays ?? 30
    const from = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString()
    const to = new Date().toISOString()

    const windows = await this.ports.metricsRepo.queryByOrgAndProvider(orgId, provider, { from, to })

    // Aggregate metrics across all windows
    const agg = this.aggregateWindows(windows)

    const availability = agg.sentCount > 0 ? agg.successCount / agg.sentCount : 1
    const errorRate = agg.sentCount > 0 ? agg.failureCount / agg.sentCount : 0
    const p95LatencyMs = agg.p95LatencyMs

    const successRateTarget = target?.successRateTarget ?? 0.99
    const p95LatencyTarget = target?.p95LatencyTarget ?? 5000

    const availabilityMet = availability >= successRateTarget
    const latencyMet = p95LatencyMs <= p95LatencyTarget
    const compliant = availabilityMet && latencyMet

    const computedAt = new Date().toISOString()

    // Emit breach events
    const breaches: SlaBreach[] = []
    if (!availabilityMet && agg.sentCount > 0) {
      breaches.push({
        orgId,
        provider,
        metric: 'availability',
        actual: availability,
        target: successRateTarget,
        computedAt,
      })
    }
    if (!latencyMet && agg.sentCount > 0) {
      breaches.push({
        orgId,
        provider,
        metric: 'latency',
        actual: p95LatencyMs,
        target: p95LatencyTarget,
        computedAt,
      })
    }

    for (const breach of breaches) {
      this.ports.emitAudit({
        type: 'integration.sla.breach',
        orgId,
        provider,
        details: {
          metric: breach.metric,
          actual: breach.actual,
          target: breach.target,
        },
      })
    }

    return {
      orgId,
      provider,
      channel: channel ?? null,
      availability,
      p95LatencyMs,
      errorRate,
      sentCount: agg.sentCount,
      failureCount: agg.failureCount,
      target,
      availabilityMet,
      latencyMet,
      compliant,
      computedAt,
    }
  }

  /**
   * Compute SLO results for all providers of an org.
   */
  async computeAll(orgId: string): Promise<SloResult[]> {
    const providers: IntegrationProvider[] = [
      'resend', 'sendgrid', 'mailgun', 'twilio',
      'firebase', 'slack', 'teams', 'hubspot',
    ]
    const results: SloResult[] = []
    for (const provider of providers) {
      results.push(await this.compute(orgId, provider))
    }
    return results
  }

  /**
   * Export SLO report as a serializable object.
   */
  async exportReport(orgId: string): Promise<{
    orgId: string
    generatedAt: string
    results: SloResult[]
    breaches: number
    compliant: boolean
  }> {
    const results = await this.computeAll(orgId)
    const breaches = results.filter((r) => !r.compliant).length
    return {
      orgId,
      generatedAt: new Date().toISOString(),
      results,
      breaches,
      compliant: breaches === 0,
    }
  }

  /** Aggregate multiple metric windows into a single summary. */
  private aggregateWindows(windows: readonly ProviderMetricsWindow[]): {
    sentCount: number
    successCount: number
    failureCount: number
    p95LatencyMs: number
    rateLimitedCount: number
    timeoutCount: number
  } {
    if (windows.length === 0) {
      return {
        sentCount: 0,
        successCount: 0,
        failureCount: 0,
        p95LatencyMs: 0,
        rateLimitedCount: 0,
        timeoutCount: 0,
      }
    }

    let sentCount = 0
    let successCount = 0
    let failureCount = 0
    let rateLimitedCount = 0
    let timeoutCount = 0
    // For P95, we take the weighted max across windows
    let maxP95 = 0

    for (const w of windows) {
      sentCount += w.sentCount
      successCount += w.successCount
      failureCount += w.failureCount
      rateLimitedCount += w.rateLimitedCount
      timeoutCount += w.timeoutCount
      if (w.p95LatencyMs > maxP95) maxP95 = w.p95LatencyMs
    }

    return {
      sentCount,
      successCount,
      failureCount,
      p95LatencyMs: maxP95,
      rateLimitedCount,
      timeoutCount,
    }
  }
}
