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
} from './context.js'

export {
  type Span,
  type SpanEvent,
  type SpanStatus,
  createSpan,
  addSpanEvent,
  endSpan,
  withSpan,
  setSpanExporter,
} from './spans.js'

export {
  type LogLevel,
  type LogEntry,
  type LoggerConfig,
  TracedLogger,
  createLogger,
} from './logger.js'

export {
  type TelemetryExporter,
  ConsoleExporter,
  OtlpHttpExporter,
  MultiExporter,
  type OtlpExporterConfig,
} from './exporter.js'

export {
  type ObservabilityConfig,
  initObservability,
  getObservabilityLogger,
  shutdownObservability,
  isObservabilityInitialized,
} from './sdk.js'

export {
  withTraceContext,
  createTraceMiddleware,
  type TraceMiddlewareOptions,
  type GenericRequest,
} from './middleware.js'
