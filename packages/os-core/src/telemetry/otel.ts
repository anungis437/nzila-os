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

type TraceAttributes = Record<string, unknown>
type ExportSpan = {
  name: string
  attributes: TraceAttributes
  events: Array<{ attributes?: TraceAttributes }>
  links: Array<{ attributes?: TraceAttributes }>
  status: { code: number; message?: string }
  spanContext: () => unknown
}
type TraceExporter = {
  export: (spans: ExportSpan[], callback: (result: unknown) => void) => void
  shutdown: () => Promise<void>
  forceFlush?: () => Promise<void>
}

const sensitiveAttribute = /authorization|cookie|password|secret|api[._-]?key|connection[._-]?string|(?:^|[._-])(?:access[._-]?token|refresh[._-]?token|id[._-]?token|session[._-]?token|token)(?:$|[._-](?:value|hash)$)/i

function traceUrl(value: string): string {
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value)
      url.username = ''
      url.password = ''
      url.search = ''
      url.hash = ''
      return url.toString()
    } catch {
      return '[REDACTED]'
    }
  }
  const query = value.indexOf('?')
  const fragment = value.indexOf('#')
  const end = Math.min(query < 0 ? value.length : query, fragment < 0 ? value.length : fragment)
  return value.slice(0, end)
}

function traceText(value: string): string {
  return value.replace(/https?:\/\/[^\s"'<>]+/gi, traceUrl)
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .split(/(\s+)/).map(part => part.startsWith('/') ? traceUrl(part) : part).join('')
}

function traceAttributes(attributes: TraceAttributes = {}): TraceAttributes {
  return Object.fromEntries(Object.entries(attributes).map(([key, value]) => {
    const normalized = key.toLowerCase()
    if (sensitiveAttribute.test(key) || normalized === 'url.query' || normalized === 'url.fragment')
      return [key, '[REDACTED]']
    if (['http.url', 'http.target', 'url.full', 'url.original'].includes(normalized))
      return [key, typeof value === 'string' ? traceUrl(value) : '[REDACTED]']
    return [key, typeof value === 'string' ? traceText(value)
      : Array.isArray(value) ? value.map(item => typeof item === 'string' ? traceText(item) : item) : value]
  }))
}

/** Redact before either transport serializes spans, including Next-owned spans.
 * Never mutate the SDK's completed span or discard trace/correlation identity.
 */
export function redactSpanForExport<T extends ExportSpan>(span: T): T {
  const copy = Object.create(span) as T
  Object.defineProperties(copy, {
    name: { value: traceText(span.name) },
    attributes: { value: traceAttributes(span.attributes) },
    events: { value: span.events.map(event => ({ ...event, attributes: traceAttributes(event.attributes) })) },
    links: { value: span.links.map(link => ({ ...link, attributes: traceAttributes(link.attributes) })) },
    status: { value: { ...span.status, ...(span.status.message ? { message: traceText(span.status.message) } : {}) } },
    spanContext: { value: () => span.spanContext() },
  })
  return copy
}

function privateTraceExporter(delegate: TraceExporter): TraceExporter {
  return {
    export: (spans, callback) => delegate.export(spans.map(redactSpanForExport), callback),
    shutdown: () => delegate.shutdown(),
    ...(delegate.forceFlush ? { forceFlush: () => delegate.forceFlush!() } : {}),
  }
}

/**
 * Initialize OpenTelemetry with basic HTTP + console exporters.
 * Safe to call multiple times — only initializes once.
 */
export async function initOtel(config: OtelConfig): Promise<void> {
  if (initialized) return
  initialized = true

  // Dynamic import to avoid bundling OTel in non-server contexts
  try {
    type NodeSdkLike = {
      start: () => void
      shutdown: () => Promise<void>
    }
    const { NodeSDK } = (await import('@opentelemetry/sdk-node')) as {
      NodeSDK: new (config: {
        resource: unknown
        traceExporter?: unknown
        instrumentations?: unknown[]
      }) => NodeSdkLike
    }
    const { getNodeAutoInstrumentations } =
      await import('@opentelemetry/auto-instrumentations-node')
    const { resourceFromAttributes } = await import('@opentelemetry/resources')
    const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } =
      await import('@opentelemetry/semantic-conventions')

    const endpoint =
      config.endpoint ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318'

    // ACA's managed collector injects grpc; HTTP exporters cannot send to it.
    const protocol =
      process.env.OTEL_EXPORTER_OTLP_TRACES_PROTOCOL ??
      process.env.OTEL_EXPORTER_OTLP_PROTOCOL ??
      'http/json'
    let endpointEnd = endpoint.length
    while (endpointEnd > 0 && endpoint.charCodeAt(endpointEnd - 1) === 47) endpointEnd--
    const baseEndpoint = endpoint.slice(0, endpointEnd)
    let traceExporter: unknown
    if (protocol === 'grpc') {
      const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-grpc')
      traceExporter = new OTLPTraceExporter({
        url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ?? baseEndpoint,
      })
    } else if (protocol === 'http/json') {
      const { OTLPTraceExporter } = (await import('@opentelemetry/exporter-trace-otlp-http')) as {
        OTLPTraceExporter: new (config: { url: string }) => unknown
      }
      traceExporter = new OTLPTraceExporter({
        url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ?? `${baseEndpoint}/v1/traces`,
      })
    } else {
      throw new Error(`Unsupported OTLP trace protocol: ${protocol}`)
    }

    const sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: config.appName,
        [ATTR_SERVICE_VERSION]: config.version ?? process.env.npm_package_version ?? '0.0.0',
        'deployment.environment': process.env.NODE_ENV ?? 'development',
        ...config.attributes,
      }),
      traceExporter: privateTraceExporter(traceExporter as TraceExporter),
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-http': { enabled: true },
        }),
      ],
    })

    sdk.start()
    console.log(`[otel] Initialized for ${config.appName} → ${traceUrl(endpoint)}`)

    const nodeProcess = (
      globalThis as { process?: { on?: (event: string, cb: () => void) => void } }
    ).process
    nodeProcess?.on?.('SIGTERM', () => {
      sdk.shutdown().catch(console.error)
    })
  } catch (err) {
    // OTel packages may not be installed in all environments
    console.warn('[otel] Failed to initialize OpenTelemetry:', traceText((err as Error).message))
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
  let execute = fn
  try {
    const { trace, context, SpanStatusCode } = (await import('@opentelemetry/api')) as {
      trace: {
        getTracer: (name: string) => {
          startSpan: (
            spanName: string,
            options: { attributes: Record<string, string | number | boolean> },
          ) => {
            setStatus: (status: { code: number; message?: string }) => void
            end: () => void
          }
        }
        setSpan: (ctx: unknown, span: unknown) => unknown
      }
      context: {
        active: () => unknown
        with: <U>(ctx: unknown, fn: () => Promise<U>) => Promise<U>
      }
      SpanStatusCode: { OK: number; ERROR: number }
    }
    const tracer = trace.getTracer('nzila-os')
    const span = tracer.startSpan(name, { attributes })
    execute = async () => {
      try {
        const result = await context.with(trace.setSpan(context.active(), span), fn)
        span.setStatus({ code: SpanStatusCode.OK })
        return result
      } catch (err) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message })
        throw err
      } finally {
        span.end()
      }
    }
  } catch {
    // Fall back to no-op if OTel API not available
    return fn()
  }
  // A business failure is not an instrumentation initialization failure.
  // Execute outside the fallback catch so a committed action is never retried.
  return execute()
}
