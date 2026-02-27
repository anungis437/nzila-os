/**
 * Nzila OS — Integration DB: Health + Metrics Repository Ports
 *
 * Org-scoped repositories for provider health, metrics windows,
 * and SLO target management. Pure port interfaces — no DB coupling.
 */
import type { IntegrationProvider, HealthStatus } from '@nzila/integrations-core'

// ── Circuit state type ──────────────────────────────────────────────────────

export type CircuitState = 'closed' | 'open' | 'half_open'

// ── Provider health record ──────────────────────────────────────────────────

export interface ProviderHealthRecord {
  readonly id: string
  readonly orgId: string
  readonly provider: IntegrationProvider
  readonly status: HealthStatus
  readonly lastCheckedAt: string | null
  readonly lastErrorCode: string | null
  readonly lastErrorMessage: string | null
  readonly consecutiveFailures: number
  readonly circuitState: CircuitState
  readonly circuitOpenedAt: string | null
  readonly circuitNextRetryAt: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

// ── Provider metrics window ─────────────────────────────────────────────────

export interface ProviderMetricsWindow {
  readonly id: string
  readonly orgId: string
  readonly provider: IntegrationProvider
  readonly windowStart: string
  readonly windowEnd: string
  readonly sentCount: number
  readonly successCount: number
  readonly failureCount: number
  readonly p50LatencyMs: number
  readonly p95LatencyMs: number
  readonly p99LatencyMs: number
  readonly rateLimitedCount: number
  readonly timeoutCount: number
  readonly createdAt: string
}

// ── SLO target ──────────────────────────────────────────────────────────────

export interface SloTarget {
  readonly id: string
  readonly orgId: string | null
  readonly provider: IntegrationProvider
  readonly channel: string | null
  readonly successRateTarget: number
  readonly p95LatencyTarget: number
  readonly windowDays: number
  readonly isDefault: boolean
  readonly metadata: Record<string, unknown>
  readonly createdAt: string
  readonly updatedAt: string
}

// ── Health repository port ──────────────────────────────────────────────────

export interface IntegrationHealthRepo {
  upsert(
    orgId: string,
    provider: IntegrationProvider,
    data: {
      status: HealthStatus
      lastErrorCode?: string
      lastErrorMessage?: string
      consecutiveFailures: number
      circuitState: CircuitState
      circuitOpenedAt?: string | null
      circuitNextRetryAt?: string | null
    },
  ): Promise<ProviderHealthRecord>

  findByOrgAndProvider(
    orgId: string,
    provider: IntegrationProvider,
  ): Promise<ProviderHealthRecord | null>

  listByOrg(orgId: string): Promise<readonly ProviderHealthRecord[]>

  listAll(): Promise<readonly ProviderHealthRecord[]>

  updateCircuitState(
    orgId: string,
    provider: IntegrationProvider,
    state: CircuitState,
    nextRetryAt?: string | null,
  ): Promise<ProviderHealthRecord | null>
}

// ── Metrics repository port ─────────────────────────────────────────────────

export interface IntegrationMetricsRepo {
  recordMetrics(data: {
    orgId: string
    provider: IntegrationProvider
    windowStart: string
    windowEnd: string
    sentCount: number
    successCount: number
    failureCount: number
    p50LatencyMs: number
    p95LatencyMs: number
    p99LatencyMs: number
    rateLimitedCount: number
    timeoutCount: number
  }): Promise<ProviderMetricsWindow>

  queryByOrgAndProvider(
    orgId: string,
    provider: IntegrationProvider,
    opts?: { from?: string; to?: string; limit?: number },
  ): Promise<readonly ProviderMetricsWindow[]>

  latestByOrgAndProvider(
    orgId: string,
    provider: IntegrationProvider,
  ): Promise<ProviderMetricsWindow | null>

  aggregateByOrg(
    orgId: string,
    opts?: { from?: string; to?: string },
  ): Promise<readonly ProviderMetricsWindow[]>
}

// ── SLO target repository port ──────────────────────────────────────────────

export interface IntegrationSloTargetRepo {
  upsert(data: {
    orgId: string | null
    provider: IntegrationProvider
    channel?: string | null
    successRateTarget: number
    p95LatencyTarget: number
    windowDays?: number
    isDefault?: boolean
  }): Promise<SloTarget>

  findForOrgAndProvider(
    orgId: string,
    provider: IntegrationProvider,
    channel?: string | null,
  ): Promise<SloTarget | null>

  findDefault(
    provider: IntegrationProvider,
    channel?: string | null,
  ): Promise<SloTarget | null>

  listByOrg(orgId: string): Promise<readonly SloTarget[]>

  listDefaults(): Promise<readonly SloTarget[]>
}
