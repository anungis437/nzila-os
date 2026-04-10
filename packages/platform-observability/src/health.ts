/**
 * @nzila/platform-observability — Health Check Builder
 *
 * Composable health checks for services, databases, and external deps.
 * Aggregates individual checks into an overall health report.
 *
 * @module @nzila/platform-observability/health
 */
import { createLogger } from './logger'
import type { HealthCheckResult, HealthReport, HealthStatus } from './types'

const logger = createLogger()

// ── Types ───────────────────────────────────────────────────────────────────

/** A single health check function. */
export type HealthCheckFn = () => Promise<HealthCheckResult>

/** Configuration for a health check. */
export interface HealthCheckConfig {
  readonly name: string
  readonly check: HealthCheckFn
  readonly critical?: boolean
  readonly timeoutMs?: number
}

// ── HealthChecker ───────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 5_000

/**
 * Composable health-check builder.
 * Register individual checks, then run them all to produce a HealthReport.
 */
export class HealthChecker {
  private readonly checks: HealthCheckConfig[] = []
  private readonly serviceName: string

  constructor(serviceName: string) {
    this.serviceName = serviceName
  }

  /**
   * Register a health check.
   * Critical checks degrade the overall status to 'down' on failure.
   */
  register(config: HealthCheckConfig): this {
    this.checks.push(config)
    return this
  }

  /**
   * Convenience: register a simple async function as a health check.
   */
  addCheck(
    name: string,
    fn: () => Promise<void>,
    options?: { critical?: boolean; timeoutMs?: number },
  ): this {
    this.checks.push({
      name,
      critical: options?.critical ?? false,
      timeoutMs: options?.timeoutMs,
      check: async (): Promise<HealthCheckResult> => {
        const start = performance.now()
        try {
          await fn()
          return {
            name,
            status: 'healthy' as const,
            latencyMs: Math.round(performance.now() - start),
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
          return {
            name,
            status: 'down' as const,
            latencyMs: Math.round(performance.now() - start),
            message: msg,
          }
        }
      },
    })
    return this
  }

  /**
   * Run all registered checks and compile a HealthReport.
   */
  async run(): Promise<HealthReport> {
    const results: HealthCheckResult[] = []

    for (const config of this.checks) {
      try {
        const result = await withTimeout(
          config.check(),
          config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
          config.name,
        )
        results.push(result)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        logger.warn('Health check exception', { check: config.name, error: msg })
        results.push({
          name: config.name,
          status: 'down' as const,
          latencyMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
          message: msg,
        })
      }
    }

    const overallStatus = deriveOverallStatus(results, this.checks)

    return {
      service: this.serviceName,
      status: overallStatus,
      checks: results,
      timestamp: new Date().toISOString(),
    }
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function deriveOverallStatus(
  results: readonly HealthCheckResult[],
  configs: readonly HealthCheckConfig[],
): HealthStatus {
  if (results.length === 0) return 'healthy'

  const criticalNames = new Set(
    configs.filter((c) => c.critical).map((c) => c.name),
  )

  let hasAnyFailure = false

  for (const result of results) {
    if (result.status === 'down') {
      if (criticalNames.has(result.name)) {
        return 'down' // any critical failure → whole service down
      }
      hasAnyFailure = true
    } else if (result.status === 'degraded') {
      hasAnyFailure = true
    }
  }

  return hasAnyFailure ? 'degraded' : 'healthy'
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_resolve, reject) => {
      setTimeout(() => {
        reject(new Error(`Health check '${label}' timed out after ${ms}ms`))
      }, ms)
    }),
  ])
}
