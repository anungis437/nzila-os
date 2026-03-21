/**
 * @nzila/media-worker — Observability
 *
 * Structured logging, correlation IDs, typed errors,
 * health endpoints, and media/queue metrics.
 *
 * @module @nzila/media-worker/observability
 */

// ── Correlation Context ─────────────────────────────────────────────────────

export interface CorrelationContext {
  readonly correlationId: string
  readonly jobId?: string
  readonly assetId?: string
  readonly orgId?: string
  readonly queue?: string
}

export function createCorrelationId(): string {
  return crypto.randomUUID()
}

// ── Structured Logger ───────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  readonly level: LogLevel
  readonly message: string
  readonly timestamp: string
  readonly service: string
  readonly correlationId?: string
  readonly context?: Record<string, unknown>
  readonly error?: { message: string; stack?: string }
}

export interface StructuredLogger {
  debug(message: string, context?: Record<string, unknown>): void
  info(message: string, context?: Record<string, unknown>): void
  warn(message: string, context?: Record<string, unknown>): void
  error(message: string, error?: Error, context?: Record<string, unknown>): void
  child(context: Record<string, unknown>): StructuredLogger
}

export function createLogger(
  service: string,
  correlation?: CorrelationContext,
  minLevel: LogLevel = 'info',
): StructuredLogger {
  const LEVEL_RANK: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }
  const baseContext: Record<string, unknown> = {}
  if (correlation) {
    baseContext.correlationId = correlation.correlationId
    if (correlation.jobId) baseContext.jobId = correlation.jobId
    if (correlation.assetId) baseContext.assetId = correlation.assetId
    if (correlation.orgId) baseContext.orgId = correlation.orgId
    if (correlation.queue) baseContext.queue = correlation.queue
  }

  function emit(level: LogLevel, message: string, err?: Error, context?: Record<string, unknown>): void {
    if (LEVEL_RANK[level] < LEVEL_RANK[minLevel]) return

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      service,
      correlationId: correlation?.correlationId,
      context: { ...baseContext, ...context },
      error: err ? { message: err.message, stack: err.stack } : undefined,
    }

    // JSON structured log to stdout
    const output = JSON.stringify(entry)
    if (level === 'error') {
      console.error(output)
    } else {
      console.log(output)
    }
  }

  const logger: StructuredLogger = {
    debug: (msg, ctx) => emit('debug', msg, undefined, ctx),
    info: (msg, ctx) => emit('info', msg, undefined, ctx),
    warn: (msg, ctx) => emit('warn', msg, undefined, ctx),
    error: (msg, err, ctx) => emit('error', msg, err ?? undefined, ctx),
    child(ctx: Record<string, unknown>): StructuredLogger {
      return createLogger(service, {
        correlationId: correlation?.correlationId ?? createCorrelationId(),
        ...ctx as Partial<CorrelationContext>,
      }, minLevel)
    },
  }

  return logger
}

// ── Typed Errors ────────────────────────────────────────────────────────────

export type MediaErrorCode =
  | 'TRANSCODE_FAILED'
  | 'STORAGE_UPLOAD_FAILED'
  | 'STORAGE_DOWNLOAD_FAILED'
  | 'STORAGE_NOT_FOUND'
  | 'FFMPEG_TIMEOUT'
  | 'INVALID_SOURCE_FORMAT'
  | 'QUEUE_ENQUEUE_FAILED'
  | 'QUEUE_DEQUEUE_FAILED'
  | 'REDIS_CONNECTION_FAILED'
  | 'HEALTH_CHECK_FAILED'

export class MediaWorkerError extends Error {
  readonly code: MediaErrorCode
  readonly retryable: boolean
  readonly context: Record<string, unknown>

  constructor(
    code: MediaErrorCode,
    message: string,
    opts?: { retryable?: boolean; cause?: Error; context?: Record<string, unknown> },
  ) {
    super(message, { cause: opts?.cause })
    this.name = 'MediaWorkerError'
    this.code = code
    this.retryable = opts?.retryable ?? false
    this.context = opts?.context ?? {}
  }
}

/**
 * Classifies whether an error is retryable.
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof MediaWorkerError) return error.retryable
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    // Network/timeout errors are retryable
    if (msg.includes('timeout') || msg.includes('econnrefused') || msg.includes('econnreset')) {
      return true
    }
    // S3 throttling is retryable
    if (msg.includes('slowdown') || msg.includes('throttl')) return true
  }
  return false
}

// ── Metrics ─────────────────────────────────────────────────────────────────

export interface MetricsCollector {
  increment(metric: string, value?: number, tags?: Record<string, string>): void
  gauge(metric: string, value: number, tags?: Record<string, string>): void
  histogram(metric: string, value: number, tags?: Record<string, string>): void
  timing(metric: string, durationMs: number, tags?: Record<string, string>): void
}

/**
 * In-process metrics collector that logs metrics as structured JSON.
 * In production, replace with StatsD/Prometheus client.
 */
export function createMetricsCollector(logger: StructuredLogger): MetricsCollector {
  return {
    increment(metric, value = 1, tags) {
      logger.debug(`metric.counter`, { metric, value, tags })
    },
    gauge(metric, value, tags) {
      logger.debug(`metric.gauge`, { metric, value, tags })
    },
    histogram(metric, value, tags) {
      logger.debug(`metric.histogram`, { metric, value, tags })
    },
    timing(metric, durationMs, tags) {
      logger.debug(`metric.timing`, { metric, durationMs, tags })
    },
  }
}

// ── Health Check ────────────────────────────────────────────────────────────

export interface HealthStatus {
  readonly status: 'healthy' | 'degraded' | 'unhealthy'
  readonly version: string
  readonly uptime: number
  readonly checks: readonly HealthCheck[]
}

export interface HealthCheck {
  readonly name: string
  readonly status: 'pass' | 'fail'
  readonly message?: string
  readonly durationMs: number
}

export interface HealthCheckDep {
  readonly name: string
  check(): Promise<{ ok: boolean; message?: string }>
}

export function createHealthChecker(deps: {
  version: string
  startTime: number
  checks: readonly HealthCheckDep[]
}) {
  return {
    async check(): Promise<HealthStatus> {
      const results: HealthCheck[] = []

      for (const dep of deps.checks) {
        const start = Date.now()
        try {
          const result = await dep.check()
          results.push({
            name: dep.name,
            status: result.ok ? 'pass' : 'fail',
            message: result.message,
            durationMs: Date.now() - start,
          })
        } catch (err) {
          results.push({
            name: dep.name,
            status: 'fail',
            message: err instanceof Error ? err.message : 'Unknown error',
            durationMs: Date.now() - start,
          })
        }
      }

      const allPass = results.every((r) => r.status === 'pass')
      const anyFail = results.some((r) => r.status === 'fail')

      return {
        status: allPass ? 'healthy' : anyFail ? 'unhealthy' : 'degraded',
        version: deps.version,
        uptime: Date.now() - deps.startTime,
        checks: results,
      }
    },
  }
}

// ── Media Pipeline Metrics (named constants) ────────────────────────────────

export const MEDIA_METRICS = {
  TRANSCODE_STARTED: 'media.transcode.started',
  TRANSCODE_COMPLETED: 'media.transcode.completed',
  TRANSCODE_FAILED: 'media.transcode.failed',
  TRANSCODE_DURATION: 'media.transcode.duration_ms',
  UPLOAD_BYTES: 'media.storage.upload_bytes',
  DOWNLOAD_BYTES: 'media.storage.download_bytes',
  QUEUE_ENQUEUED: 'media.queue.enqueued',
  QUEUE_PROCESSED: 'media.queue.processed',
  QUEUE_FAILED: 'media.queue.failed',
  QUEUE_DEPTH: 'media.queue.depth',
  QUEUE_DLQ_SIZE: 'media.queue.dlq_size',
  STREAM_SERVED: 'media.stream.served',
  STREAM_REVENUE_QUALIFIED: 'media.stream.revenue_qualified',
  HLS_SEGMENTS_UPLOADED: 'media.hls.segments_uploaded',
  PREVIEW_GENERATED: 'media.preview.generated',
  WAVEFORM_GENERATED: 'media.waveform.generated',
} as const
