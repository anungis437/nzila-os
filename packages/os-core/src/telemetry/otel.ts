/**
 * @nzila/os-core — OpenTelemetry Bootstrap
 *
 * Provides basic RED metrics (Rate, Errors, Duration) and span helpers.
 * Initialize this at app startup before any requests are served.
 *
 * Usage in instrumentation.ts (Next.js):
 *   import { initOtel } from '@nzila/os-core/telemetry'
 *   export async function register() { await initOtel({ appName: 'console' }) }
 */

export interface OtelConfig {
  appName: string
  /** OTLP endpoint — defaults to OTEL_EXPORTER_OTLP_ENDPOINT env var */
  endpoint?: string
  /** Service version — defaults to npm_package_version */
  version?: string
  /** Additional resource attributes */
  attributes?: Record<string, string>
}

let initialized = false

/**
 * Initialize OpenTelemetry with basic HTTP + console exporters.
 * Safe to call multiple times — only initializes once.
 */
export async function initOtel(config: OtelConfig): Promise<void> {
  if (initialized) return
  initialized = true

  // Dynamic import to avoid bundling OTel in non-server contexts
  try {
    const { NodeSDK } = await import('@opentelemetry/sdk-node')
    const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node')
    const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http')
    const { Resource } = await import('@opentelemetry/resources')
    const { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } = await import(
      '@opentelemetry/semantic-conventions'
    )

    const endpoint =
      config.endpoint ??
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
      'http://localhost:4318'

    const sdk = new NodeSDK({
      resource: new Resource({
        [SEMRESATTRS_SERVICE_NAME]: config.appName,
        [SEMRESATTRS_SERVICE_VERSION]: config.version ?? process.env.npm_package_version ?? '0.0.0',
        'deployment.environment': process.env.NODE_ENV ?? 'development',
        ...config.attributes,
      }),
      traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-http': { enabled: true },
        }),
      ],
    })

    sdk.start()
    console.log(`[otel] Initialized for ${config.appName} → ${endpoint}`)

    process.on('SIGTERM', () => {
      sdk.shutdown().catch(console.error)
    })
  } catch (err) {
    // OTel packages may not be installed in all environments
    console.warn('[otel] Failed to initialize OpenTelemetry:', (err as Error).message)
  }
}

// ── Manual span helpers ───────────────────────────────────────────────────

/**
 * Creates a simple span wrapper for manual instrumentation.
 * Falls back to a no-op if OTel is not initialized.
 */
export async function withSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean>,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    const { trace, context, SpanStatusCode } = await import('@opentelemetry/api')
    const tracer = trace.getTracer('nzila-os')
    const span = tracer.startSpan(name, { attributes })
    try {
      const result = await context.with(
        trace.setSpan(context.active(), span),
        fn,
      )
      span.setStatus({ code: SpanStatusCode.OK })
      return result
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message })
      throw err
    } finally {
      span.end()
    }
  } catch {
    // Fall back to no-op if OTel API not available
    return fn()
  }
}
