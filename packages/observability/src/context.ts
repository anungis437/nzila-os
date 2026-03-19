import { z } from 'zod'
import { randomUUID } from 'node:crypto'

// ─── Trace Context Schema ───────────────────────────────────────────────────

export const traceContextSchema = z.object({
  traceId: z.string().min(1),
  spanId: z.string().min(1),
  tenantId: z.string().min(1),
  actorId: z.string().min(1),
  parentSpanId: z.string().optional(),
  requestId: z.string().min(1),
})

export type TraceContext = z.infer<typeof traceContextSchema>

// ─── AsyncLocalStorage-based Context Propagation ────────────────────────────

import { AsyncLocalStorage } from 'node:async_hooks'

const traceStorage = new AsyncLocalStorage<TraceContext>()

export function getTraceContext(): TraceContext | undefined {
  return traceStorage.getStore()
}

export function requireTraceContext(): TraceContext {
  const ctx = traceStorage.getStore()
  if (!ctx) {
    throw new Error('TraceContext not available — wrap execution in withTraceContext()')
  }
  return ctx
}

export function withTraceContextAsync<T>(
  ctx: TraceContext,
  fn: () => T | Promise<T>,
): T | Promise<T> {
  return traceStorage.run(ctx, fn)
}

// ─── Generators ─────────────────────────────────────────────────────────────

export function generateTraceId(): string {
  return randomUUID().replace(/-/g, '')
}

export function generateSpanId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 16)
}

export function generateRequestId(): string {
  return randomUUID()
}

// ─── W3C Traceparent ────────────────────────────────────────────────────────

const TRACEPARENT_REGEX = /^00-([a-f0-9]{32})-([a-f0-9]{16})-([a-f0-9]{2})$/

export function parseTraceparent(header: string): { traceId: string; spanId: string; flags: string } | null {
  const match = TRACEPARENT_REGEX.exec(header)
  if (!match) return null
  return {
    traceId: match[1],
    spanId: match[2],
    flags: match[3],
  }
}

export function buildTraceparent(traceId: string, spanId: string, sampled = true): string {
  const flags = sampled ? '01' : '00'
  return `00-${traceId}-${spanId}-${flags}`
}

// ─── Header Extraction / Injection ──────────────────────────────────────────

export interface HeaderLike {
  get(name: string): string | null | undefined
}

export function extractTraceFromHeaders(
  headers: HeaderLike,
  defaults: { tenantId: string; actorId: string },
): TraceContext {
  const traceparentHeader = headers.get('traceparent')
  const parsed = traceparentHeader ? parseTraceparent(traceparentHeader) : null

  return {
    traceId: parsed?.traceId ?? generateTraceId(),
    spanId: generateSpanId(),
    parentSpanId: parsed?.spanId,
    tenantId: headers.get('x-tenant-id') ?? defaults.tenantId,
    actorId: headers.get('x-actor-id') ?? defaults.actorId,
    requestId: headers.get('x-request-id') ?? generateRequestId(),
  }
}

export function buildTraceHeaders(ctx: TraceContext): Record<string, string> {
  return {
    traceparent: buildTraceparent(ctx.traceId, ctx.spanId),
    'x-request-id': ctx.requestId,
    'x-tenant-id': ctx.tenantId,
    'x-actor-id': ctx.actorId,
  }
}
