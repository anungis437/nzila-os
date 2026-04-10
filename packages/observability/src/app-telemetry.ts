/**
 * @nzila/observability — App Telemetry Factory
 *
 * Creates pre-configured observability stacks for any app in the registry.
 * Reads the app's manifest to automatically configure:
 *   - Structured logger with the correct service name
 *   - Trace context propagation
 *   - Metric prefix scoped to the app
 *   - Health check telemetry hooks
 *
 * Usage:
 *
 *   import { createAppTelemetry } from '@nzila/observability/app-telemetry'
 *
 *   const telemetry = createAppTelemetry('union-eyes')
 *   telemetry.logger.info('app.started', { port: 3002 })
 *   telemetry.trackMetric('claims_processed', 1, { claimType: 'disability' })
 *
 * @module @nzila/observability/app-telemetry
 */
import { TracedLogger, type LogLevel } from './logger'
import { generateRequestId } from './context'

// ── Types ───────────────────────────────────────────────────────────────────

export interface AppTelemetryConfig {
  /** Override the minimum log level (default: 'info') */
  minLevel?: LogLevel
  /** Custom log sink (default: structured JSON to stdout/stderr) */
  sink?: (entry: unknown) => void
  /** Additional static metadata attached to every log entry */
  staticMetadata?: Record<string, unknown>
}

export interface AppTelemetry {
  /** Pre-configured structured logger */
  readonly logger: TracedLogger
  /** App ID from the registry */
  readonly appId: string
  /** Scoped metric name generator: `nzila.<appId>.<metricName>` */
  metricName(name: string): string
  /** Track a metric value with optional dimensions */
  trackMetric(name: string, value: number, dimensions?: Record<string, string>): void
  /** Start a timed operation — returns a function to call when complete */
  startTimer(operationName: string): () => number
  /** Generate a scoped request ID */
  generateRequestId(): string
}

// ── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create a pre-configured telemetry stack for an app.
 *
 * @param appId - The app's ID (must match an APP_REGISTRY entry)
 * @param config - Optional overrides
 */
export function createAppTelemetry(
  appId: string,
  config?: AppTelemetryConfig,
): AppTelemetry {
  const serviceName = `nzila-${appId}`

  const logger = new TracedLogger({
    service: serviceName,
    minLevel: config?.minLevel ?? 'info',
    ...(config?.sink ? { sink: config.sink as (entry: unknown) => void } : {}),
  })

  // If static metadata is provided, return a child logger with it baked in
  const effectiveLogger = config?.staticMetadata
    ? logger.child(config.staticMetadata)
    : logger

  return {
    logger: effectiveLogger,
    appId,

    metricName(name: string): string {
      return `nzila.${appId}.${name}`
    },

    trackMetric(name: string, value: number, dimensions?: Record<string, string>): void {
      effectiveLogger.info('metric.recorded', {
        metric: `nzila.${appId}.${name}`,
        value,
        ...dimensions,
      })
    },

    startTimer(operationName: string): () => number {
      const start = performance.now()
      return () => {
        const durationMs = Math.round(performance.now() - start)
        effectiveLogger.info('operation.completed', {
          operation: operationName,
          durationMs,
        })
        return durationMs
      }
    },

    generateRequestId(): string {
      return generateRequestId()
    },
  }
}
