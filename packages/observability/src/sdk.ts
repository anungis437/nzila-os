import type { TelemetryExporter } from './exporter'
import { ConsoleExporter } from './exporter'
import { setSpanExporter } from './spans'
import { createLogger, type TracedLogger } from './logger'

// ─── SDK Configuration ──────────────────────────────────────────────────────

export interface ObservabilityConfig {
  readonly serviceName: string
  readonly environment: string
  readonly exporter: TelemetryExporter
  readonly enableConsoleExporter: boolean
}

// ─── SDK State ──────────────────────────────────────────────────────────────

let initialized = false
let activeExporter: TelemetryExporter | undefined
let sdkLogger: TracedLogger | undefined

export function initObservability(
  config: Partial<ObservabilityConfig> & { serviceName: string },
): TracedLogger {
  if (initialized) {
    return sdkLogger!
  }

  const exporter = config.exporter ?? new ConsoleExporter()
  activeExporter = exporter

  setSpanExporter((span) => {
    exporter.exportSpan(span)
  })

  sdkLogger = createLogger(config.serviceName)
  initialized = true

  sdkLogger.info('observability.initialized', {
    exporter: exporter.name,
    environment: config.environment ?? 'unknown',
  })

  return sdkLogger
}

export function getObservabilityLogger(): TracedLogger {
  if (!sdkLogger) {
    sdkLogger = createLogger('nzila')
  }
  return sdkLogger
}

export async function shutdownObservability(): Promise<void> {
  if (activeExporter) {
    await activeExporter.shutdown()
    activeExporter = undefined
  }
  initialized = false
  sdkLogger = undefined
}

export function isObservabilityInitialized(): boolean {
  return initialized
}
