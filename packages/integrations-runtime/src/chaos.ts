/**
 * Nzila OS — Integration Runtime: Chaos Simulation
 *
 * Env-gated chaos simulation for provider outage drills.
 * HARD GUARD: Disabled in production. Always.
 *
 * Scenarios:
 *   - provider_down: force adapter failure
 *   - slow: inject latency
 *   - rate_limited: inject 429 + retry-after
 *   - partial_fail: fail N% of calls
 *
 * All chaos toggles are audited.
 *
 * @invariant INTEGRATION_CHAOS_PROD_GUARD_004
 */
import type { IntegrationProvider, SendResult, RateLimitInfo } from '@nzila/integrations-core'

// ── Hard production guard ───────────────────────────────────────────────────

/**
 * PRODUCTION GUARD — chaos is NEVER allowed in production.
 * Checks NODE_ENV, VERCEL_ENV, and AZURE_FUNCTIONS_ENVIRONMENT.
 * Returns true ONLY when explicitly non-production AND env var enabled.
 */
export function isChaosAllowed(): boolean {
  const nodeEnv = process.env.NODE_ENV ?? ''
  const vercelEnv = process.env.VERCEL_ENV ?? ''
  const azureEnv = process.env.AZURE_FUNCTIONS_ENVIRONMENT ?? ''
  const chaosMode = process.env.INTEGRATIONS_CHAOS_MODE ?? ''

  // Block if any env signals production
  if (nodeEnv === 'production') return false
  if (vercelEnv === 'production') return false
  if (azureEnv === 'Production') return false

  // Must be explicitly enabled
  return chaosMode === 'true'
}

// ── Scenario types ──────────────────────────────────────────────────────────

export type ChaosScenario = 'provider_down' | 'slow' | 'rate_limited' | 'partial_fail'

export const CHAOS_SCENARIOS: readonly ChaosScenario[] = [
  'provider_down',
  'slow',
  'rate_limited',
  'partial_fail',
]

export interface ChaosConfig {
  /** Active scenario */
  readonly scenario: ChaosScenario
  /** Target provider(s). Empty = all providers. */
  readonly targetProviders: readonly IntegrationProvider[]
  /** Target org(s). Empty = all orgs. */
  readonly targetOrgIds: readonly string[]
  /** Injected latency for 'slow' scenario (ms) */
  readonly slowLatencyMs: number
  /** Failure percentage for 'partial_fail' (0–100) */
  readonly partialFailPercent: number
  /** Retry-after for 'rate_limited' scenario (ms) */
  readonly rateLimitRetryAfterMs: number
}

export const DEFAULT_CHAOS_CONFIG: ChaosConfig = {
  scenario: 'provider_down',
  targetProviders: [],
  targetOrgIds: [],
  slowLatencyMs: 5_000,
  partialFailPercent: 50,
  rateLimitRetryAfterMs: 30_000,
}

// ── Ports ───────────────────────────────────────────────────────────────────

export interface ChaosPorts {
  readonly emitAudit: (event: {
    type: string
    orgId: string
    provider: IntegrationProvider
    details?: Record<string, unknown>
  }) => void
  /** Random number generator for partial_fail (testable) */
  readonly random?: () => number
}

// ── Chaos result ────────────────────────────────────────────────────────────

export interface ChaosInterceptionResult {
  readonly intercepted: boolean
  readonly result?: SendResult
  readonly delayMs?: number
}

// ── Chaos Simulator ─────────────────────────────────────────────────────────

export class ChaosSimulator {
  private config: ChaosConfig | null = null
  private enabled = false
  private readonly ports: ChaosPorts

  constructor(ports: ChaosPorts) {
    this.ports = ports
  }

  /**
   * Enable chaos with a configuration.
   * HARD GUARD: throws if called in production.
   */
  enable(config: Partial<ChaosConfig> = {}): void {
    if (!isChaosAllowed()) {
      throw new Error('CHAOS_GUARD: Chaos simulation is disabled in production environments')
    }
    this.config = { ...DEFAULT_CHAOS_CONFIG, ...config }
    this.enabled = true
  }

  /** Disable chaos simulation. */
  disable(): void {
    this.config = null
    this.enabled = false
  }

  /** Check if chaos is currently active. */
  isActive(): boolean {
    return this.enabled && this.config !== null && isChaosAllowed()
  }

  /** Get current chaos config (null if not active). */
  getConfig(): ChaosConfig | null {
    return this.isActive() ? this.config : null
  }

  /**
   * Check if this request should be intercepted by chaos.
   * Returns intercept result before the actual adapter call.
   */
  intercept(orgId: string, provider: IntegrationProvider): ChaosInterceptionResult {
    if (!this.isActive() || !this.config) {
      return { intercepted: false }
    }

    // Check scope filters
    if (this.config.targetProviders.length > 0 && !this.config.targetProviders.includes(provider)) {
      return { intercepted: false }
    }
    if (this.config.targetOrgIds.length > 0 && !this.config.targetOrgIds.includes(orgId)) {
      return { intercepted: false }
    }

    const random = this.ports.random ?? Math.random

    switch (this.config.scenario) {
      case 'provider_down':
        return {
          intercepted: true,
          result: {
            ok: false,
            error: 'CHAOS: Provider simulated as down',
          },
        }

      case 'slow':
        return {
          intercepted: false, // Don't block, just delay
          delayMs: this.config.slowLatencyMs,
        }

      case 'rate_limited': {
        const rateLimitInfo: RateLimitInfo = {
          isRateLimited: true,
          retryAfterMs: this.config.rateLimitRetryAfterMs,
        }
        return {
          intercepted: true,
          result: {
            ok: false,
            error: 'CHAOS: Rate limit simulated (429)',
            rateLimitInfo,
          },
        }
      }

      case 'partial_fail':
        if (random() * 100 < this.config.partialFailPercent) {
          return {
            intercepted: true,
            result: {
              ok: false,
              error: `CHAOS: Partial failure simulated (${this.config.partialFailPercent}% fail rate)`,
            },
          }
        }
        return { intercepted: false }

      default:
        return { intercepted: false }
    }
  }
}
