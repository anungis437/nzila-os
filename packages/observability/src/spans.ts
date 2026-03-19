import { z } from 'zod'
import { getTraceContext, type TraceContext } from './context.js'

// ─── Span Types ─────────────────────────────────────────────────────────────

export const spanStatusSchema = z.enum(['ok', 'error', 'unset'])
export type SpanStatus = z.infer<typeof spanStatusSchema>

export interface SpanEvent {
  readonly name: string
  readonly timestamp: number
  readonly attributes: Readonly<Record<string, string | number | boolean>>
}

export interface Span {
  readonly name: string
  readonly traceId: string
  readonly spanId: string
  readonly parentSpanId: string | undefined
  readonly startTime: number
  readonly attributes: Record<string, string | number | boolean>
  readonly events: SpanEvent[]
  status: SpanStatus
  endTime: number | undefined
  durationMs: number | undefined
}

// ─── Span Builder ───────────────────────────────────────────────────────────

let spanExporter: ((span: Span) => void) | undefined

export function setSpanExporter(exporter: (span: Span) => void): void {
  spanExporter = exporter
}

export function createSpan(
  name: string,
  ctx?: TraceContext,
  attributes?: Record<string, string | number | boolean>,
): Span {
  const traceCtx = ctx ?? getTraceContext()

  const span: Span = {
    name,
    traceId: traceCtx?.traceId ?? 'unknown',
    spanId: traceCtx?.spanId ?? 'unknown',
    parentSpanId: traceCtx?.parentSpanId,
    startTime: Date.now(),
    attributes: {
      ...(traceCtx ? { tenant_id: traceCtx.tenantId, actor_id: traceCtx.actorId } : {}),
      ...attributes,
    },
    events: [],
    status: 'unset',
    endTime: undefined,
    durationMs: undefined,
  }

  return span
}

export function addSpanEvent(
  span: Span,
  name: string,
  attributes: Record<string, string | number | boolean> = {},
): void {
  ;(span.events as SpanEvent[]).push({
    name,
    timestamp: Date.now(),
    attributes,
  })
}

export function endSpan(span: Span, status: SpanStatus = 'ok'): void {
  const mutable = span as { endTime: number | undefined; durationMs: number | undefined; status: SpanStatus }
  mutable.endTime = Date.now()
  mutable.durationMs = mutable.endTime - span.startTime
  mutable.status = status

  spanExporter?.(span)
}

// ─── Instrumented Execution ─────────────────────────────────────────────────

export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, string | number | boolean>,
): Promise<T> {
  const span = createSpan(name, undefined, attributes)
  try {
    const result = await fn(span)
    endSpan(span, 'ok')
    return result
  } catch (err) {
    addSpanEvent(span, 'exception', {
      'exception.message': err instanceof Error ? err.message : String(err),
    })
    endSpan(span, 'error')
    throw err
  }
}
