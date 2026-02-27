/**
 * Nzila OS — Integration Runtime: Circuit Breaker
 *
 * Provider + org scoped circuit breaker to prevent cascading failures.
 *
 * State machine:
 *   CLOSED → OPEN   when consecutive_failures >= threshold OR failure_rate > threshold in window
 *   OPEN → HALF_OPEN after cooldown expires
 *   HALF_OPEN → CLOSED if probe succeeds
 *   HALF_OPEN → OPEN   if probe fails
 *
 * Persists state in integration_provider_health table.
 * Emits audit events on every state transition.
 *
 * @invariant INTEGRATION_CHAOS_PROD_GUARD_004
 */
import type { IntegrationProvider } from '@nzila/integrations-core'
import type { IntegrationHealthRepo, CircuitState } from '@nzila/integrations-db'

// ── Configuration ───────────────────────────────────────────────────────────

export interface CircuitBreakerConfig {
  /** Number of consecutive failures to trip the circuit (default: 5) */
  readonly failureThreshold: number
  /** Failure rate threshold in window (0-1) to trip the circuit (default: 0.5) */
  readonly failureRateThreshold: number
  /** Minimum sample count before failure rate applies (default: 10) */
  readonly failureRateSampleMin: number
  /** Cooldown in ms before transitioning from OPEN → HALF_OPEN (default: 60_000) */
  readonly cooldownMs: number
  /** Max probes allowed in HALF_OPEN before forced re-open (default: 3) */
  readonly halfOpenMaxProbes: number
}

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  failureRateThreshold: 0.5,
  failureRateSampleMin: 10,
  cooldownMs: 60_000,
  halfOpenMaxProbes: 3,
}

// ── Ports ───────────────────────────────────────────────────────────────────

export interface CircuitBreakerPorts {
  readonly healthRepo: IntegrationHealthRepo
  readonly emitAudit: (event: {
    type: string
    orgId: string
    provider: IntegrationProvider
    details?: Record<string, unknown>
  }) => void
  /** Current timestamp provider (for testability) */
  readonly now?: () => Date
}

// ── Result types ────────────────────────────────────────────────────────────

export interface CircuitCheckResult {
  readonly allowed: boolean
  readonly state: CircuitState
  readonly reason?: string
}

export interface CircuitRecordResult {
  readonly previousState: CircuitState
  readonly newState: CircuitState
  readonly transitioned: boolean
}

// ── Circuit Breaker ─────────────────────────────────────────────────────────

export class CircuitBreaker {
  private readonly ports: CircuitBreakerPorts
  private readonly config: CircuitBreakerConfig
  /** In-memory probe counter for half-open state (org:provider → count) */
  private readonly halfOpenProbes = new Map<string, number>()

  constructor(ports: CircuitBreakerPorts, config?: Partial<CircuitBreakerConfig>) {
    this.ports = ports
    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config }
  }

  private key(orgId: string, provider: IntegrationProvider): string {
    return `${orgId}:${provider}`
  }

  private now(): Date {
    return this.ports.now?.() ?? new Date()
  }

  /**
   * Check if a delivery attempt is allowed through the circuit.
   * Returns allowed=false if circuit is OPEN and cooldown hasn't expired.
   * Automatically transitions OPEN → HALF_OPEN when cooldown expires.
   */
  async canExecute(orgId: string, provider: IntegrationProvider): Promise<CircuitCheckResult> {
    const health = await this.ports.healthRepo.findByOrgAndProvider(orgId, provider)

    // No record → circuit is implicitly closed
    if (!health) {
      return { allowed: true, state: 'closed' }
    }

    const state = health.circuitState as CircuitState

    if (state === 'closed') {
      return { allowed: true, state: 'closed' }
    }

    if (state === 'open') {
      const nextRetry = health.circuitNextRetryAt
        ? new Date(health.circuitNextRetryAt).getTime()
        : 0
      const now = this.now().getTime()

      if (now >= nextRetry) {
        // Cooldown expired → transition to half-open
        await this.ports.healthRepo.updateCircuitState(orgId, provider, 'half_open')
        this.halfOpenProbes.set(this.key(orgId, provider), 0)
        this.ports.emitAudit({
          type: 'integration.circuit.half_open',
          orgId,
          provider,
          details: { reason: 'cooldown_expired' },
        })
        return { allowed: true, state: 'half_open' }
      }

      return {
        allowed: false,
        state: 'open',
        reason: `Circuit OPEN until ${health.circuitNextRetryAt}`,
      }
    }

    // half_open: allow limited probes
    const k = this.key(orgId, provider)
    const probes = this.halfOpenProbes.get(k) ?? 0
    if (probes >= this.config.halfOpenMaxProbes) {
      return {
        allowed: false,
        state: 'half_open',
        reason: 'Max half-open probes reached',
      }
    }
    this.halfOpenProbes.set(k, probes + 1)
    return { allowed: true, state: 'half_open' }
  }

  /**
   * Record a delivery outcome and decide if the circuit should transition.
   */
  async recordResult(
    orgId: string,
    provider: IntegrationProvider,
    success: boolean,
    opts?: {
      totalInWindow?: number
      failuresInWindow?: number
    },
  ): Promise<CircuitRecordResult> {
    const health = await this.ports.healthRepo.findByOrgAndProvider(orgId, provider)
    const previousState: CircuitState = (health?.circuitState as CircuitState) ?? 'closed'
    const consecutiveFailures = success ? 0 : (health?.consecutiveFailures ?? 0) + 1

    // Determine new state
    let newState: CircuitState = previousState

    if (previousState === 'half_open') {
      if (success) {
        // Probe succeeded → close the circuit
        newState = 'closed'
        this.halfOpenProbes.delete(this.key(orgId, provider))
      } else {
        // Probe failed → reopen
        newState = 'open'
        this.halfOpenProbes.delete(this.key(orgId, provider))
      }
    } else if (previousState === 'closed') {
      // Check failure threshold
      if (consecutiveFailures >= this.config.failureThreshold) {
        newState = 'open'
      }
      // Check failure rate threshold
      if (
        opts?.totalInWindow &&
        opts.totalInWindow >= this.config.failureRateSampleMin &&
        opts.failuresInWindow !== undefined
      ) {
        const failureRate = opts.failuresInWindow / opts.totalInWindow
        if (failureRate > this.config.failureRateThreshold) {
          newState = 'open'
        }
      }
    }

    // Persist new state
    const nextRetryAt =
      newState === 'open'
        ? new Date(this.now().getTime() + this.config.cooldownMs).toISOString()
        : null

    await this.ports.healthRepo.upsert(orgId, provider, {
      status: newState === 'open' ? 'down' : newState === 'half_open' ? 'degraded' : 'ok',
      consecutiveFailures,
      circuitState: newState,
      circuitOpenedAt: newState === 'open' ? this.now().toISOString() : (health?.circuitOpenedAt ?? undefined) ?? undefined,
      circuitNextRetryAt: nextRetryAt,
    })

    const transitioned = newState !== previousState

    // Emit audit on transitions
    if (transitioned) {
      const eventType =
        newState === 'open'
          ? 'integration.circuit.opened'
          : newState === 'half_open'
            ? 'integration.circuit.half_open'
            : 'integration.circuit.closed'

      this.ports.emitAudit({
        type: eventType,
        orgId,
        provider,
        details: {
          previousState,
          newState,
          consecutiveFailures,
          reason: success ? 'probe_success' : 'failure_threshold',
        },
      })
    }

    return { previousState, newState, transitioned }
  }

  /**
   * Force open the circuit (platform admin action).
   */
  async forceOpen(orgId: string, provider: IntegrationProvider): Promise<void> {
    const nextRetryAt = new Date(this.now().getTime() + this.config.cooldownMs).toISOString()
    await this.ports.healthRepo.updateCircuitState(orgId, provider, 'open', nextRetryAt)
    this.ports.emitAudit({
      type: 'integration.circuit.opened',
      orgId,
      provider,
      details: { reason: 'manual_force_open' },
    })
  }

  /**
   * Reset (close) the circuit (platform admin action).
   */
  async forceReset(orgId: string, provider: IntegrationProvider): Promise<void> {
    await this.ports.healthRepo.upsert(orgId, provider, {
      status: 'ok',
      consecutiveFailures: 0,
      circuitState: 'closed',
      circuitOpenedAt: null,
      circuitNextRetryAt: null,
    })
    this.halfOpenProbes.delete(this.key(orgId, provider))
    this.ports.emitAudit({
      type: 'integration.circuit.closed',
      orgId,
      provider,
      details: { reason: 'manual_reset' },
    })
  }
}
