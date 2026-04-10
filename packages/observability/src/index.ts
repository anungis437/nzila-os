// ─── @nzila/observability ────────────────────────────────────────────────────
// Enterprise-grade observability: distributed tracing, structured logging,
// OTLP export, and trace-context middleware.

export {
  type TraceContext,
  traceContextSchema,
  getTraceContext,
  requireTraceContext,
  withTraceContextAsync,
  generateTraceId,
  generateSpanId,
  generateRequestId,
  parseTraceparent,
  buildTraceparent,
  extractTraceFromHeaders,
  buildTraceHeaders,
} from './context'

export {
  type Span,
  type SpanEvent,
  type SpanStatus,
  createSpan,
  addSpanEvent,
  endSpan,
  withSpan,
  setSpanExporter,
} from './spans'

export {
  type LogLevel,
  type LogEntry,
  type LoggerConfig,
  TracedLogger,
  createLogger,
} from './logger'

export {
  type TelemetryExporter,
  ConsoleExporter,
  OtlpHttpExporter,
  MultiExporter,
  type OtlpExporterConfig,
} from './exporter'

export {
  type ObservabilityConfig,
  initObservability,
  getObservabilityLogger,
  shutdownObservability,
  isObservabilityInitialized,
} from './sdk'

export {
  withTraceContext,
  createTraceMiddleware,
  type TraceMiddlewareOptions,
  type GenericRequest,
} from './middleware'

export {
  createAppTelemetry,
  type AppTelemetry,
  type AppTelemetryConfig,
} from './app-telemetry'
