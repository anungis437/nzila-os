/**
 * @nzila/platform-observability — Lightweight Span API
 *
 * OpenTelemetry-compatible span creation and management.
 * Traces are lightweight and don't require a full OTel SDK.
 *
 * @module @nzila/platform-observability/span
 */
import { randomBytes } from 'node:crypto'
import { createLogger } from './logger'
import type { SpanData, SpanEvent, TraceContext } from './types'

const logger = createLogger()

// ── Span ────────────────────────────────────────────────────────────────────

/**
 * Lightweight span for tracing operations.
 * Compatible with W3C Trace Context and OpenTelemetry conventions.
 */
export class Span {
  readonly spanId: string
  readonly traceId: string
  readonly parentSpanId: string | null
  readonly operationName: string
  readonly serviceName: string
  readonly startTime: number

  private _endTime: number | null = null
  private _status: 'ok' | 'error' | 'unset' = 'unset'
  private readonly _attributes: Record<string, string | number | boolean> = {}
  private readonly _events: SpanEvent[] = []

  constructor(options: {
    operationName: string
    serviceName: string
    traceId?: string
    parentSpanId?: string | null
  }) {
    this.spanId = randomBytes(8).toString('hex')
    this.traceId = options.traceId ?? randomBytes(16).toString('hex')
    this.parentSpanId = options.parentSpanId ?? null
    this.operationName = options.operationName
    this.serviceName = options.serviceName
    this.startTime = performance.now()
  }

  /**
   * Set an attribute on the span.
   */
  setAttribute(key: string, value: string | number | boolean): this {
    this._attributes[key] = value
    return this
  }

  /**
   * Add an event to the span timeline.
   */
  addEvent(name: string, attributes: Record<string, string | number | boolean> = {}): this {
    this._events.push({
      name,
      timestamp: performance.now(),
      attributes,
    })
    return this
  }

  /**
   * Mark the span as successful and end it.
   */
  end(): SpanData {
    this._endTime = performance.now()
    if (this._status === 'unset') this._status = 'ok'
    return this.toData()
  }

  /**
   * Mark the span as failed and end it.
   */
  fail(error: string): SpanData {
    this._endTime = performance.now()
    this._status = 'error'
    this._attributes['error.message'] = error
    this.addEvent('exception', { message: error })
    return this.toData()
  }

  /**
   * Create a child span under the same trace.
   */
  child(operationName: string): Span {
    return new Span({
      operationName,
      serviceName: this.serviceName,
      traceId: this.traceId,
      parentSpanId: this.spanId,
    })
  }

  /**
   * Get W3C Trace Context for outbound propagation.
   */
  traceContext(): TraceContext {
    return {
      traceId: this.traceId,
      spanId: this.spanId,
      parentSpanId: this.parentSpanId,
      traceFlags: 1, // sampled
    }
  }

  /**
   * Get W3C traceparent header value.
   */
  traceparent(): string {
    return `00-${this.traceId}-${this.spanId}-01`
  }

  private toData(): SpanData {
    const endTime = this._endTime ?? performance.now()
    return {
      spanId: this.spanId,
      traceId: this.traceId,
      parentSpanId: this.parentSpanId,
      operationName: this.operationName,
      serviceName: this.serviceName,
      startTime: this.startTime,
      endTime,
      durationMs: Math.round((endTime - this.startTime) * 100) / 100,
      status: this._status,
      attributes: { ...this._attributes },
      events: [...this._events],
    }
  }
}

// ── Convenience ─────────────────────────────────────────────────────────────

/**
 * Trace an async operation with automatic span management.
 * The span is ended (or failed) when the function resolves/rejects.
 */
export async function trace<T>(
  operationName: string,
  serviceName: string,
  fn: (span: Span) => Promise<T>,
  parentSpanId?: string,
  traceId?: string,
): Promise<{ result: T; span: SpanData }> {
  const span = new Span({ operationName, serviceName, traceId, parentSpanId })

  try {
    const result = await fn(span)
    const data = span.end()
    return { result, span: data }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    const data = span.fail(errorMessage)
    logger.error('Span failed', {
      operationName,
      traceId: span.traceId,
      error: errorMessage,
      durationMs: data.durationMs,
    })
    throw err
  }
}
