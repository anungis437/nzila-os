/**
 * @nzila/observability — Extended spans tests
 *
 * Covers setSpanExporter callback, createSpan with explicit TraceContext,
 * withSpan error path details.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  createSpan,
  addSpanEvent,
  endSpan,
  setSpanExporter,
  withSpan,
  type Span,
} from '../spans'

afterEach(() => {
  // Reset the module-level exporter
  setSpanExporter(undefined as unknown as (s: Span) => void)
})

describe('setSpanExporter', () => {
  it('calls exporter on endSpan', () => {
    const exporter = vi.fn()
    setSpanExporter(exporter)

    const span = createSpan('test-span')
    endSpan(span, 'ok')

    expect(exporter).toHaveBeenCalledOnce()
    expect(exporter.mock.calls[0][0].name).toBe('test-span')
    expect(exporter.mock.calls[0][0].status).toBe('ok')
    expect(exporter.mock.calls[0][0].durationMs).toBeGreaterThanOrEqual(0)
  })

  it('does not call exporter before endSpan', () => {
    const exporter = vi.fn()
    setSpanExporter(exporter)

    const span = createSpan('test-span')
    addSpanEvent(span, 'something')

    expect(exporter).not.toHaveBeenCalled()
  })
})

describe('createSpan with explicit TraceContext', () => {
  it('uses the provided context instead of AsyncLocalStorage', () => {
    const ctx = {
      traceId: 'a'.repeat(32),
      spanId: 'b'.repeat(16),
      tenantId: 'ctx-tenant',
      actorId: 'ctx-actor',
      requestId: 'ctx-req',
    }

    const span = createSpan('my-span', ctx)
    expect(span.traceId).toBe('a'.repeat(32))
    expect(span.spanId).toBe('b'.repeat(16))
    expect(span.attributes.tenant_id).toBe('ctx-tenant')
    expect(span.attributes.actor_id).toBe('ctx-actor')
  })

  it('creates span with "unknown" ids when no context at all', () => {
    // No AsyncLocalStorage context and no explicit context
    const span = createSpan('orphan-span')
    expect(span.traceId).toBe('unknown')
    expect(span.spanId).toBe('unknown')
    expect(span.parentSpanId).toBeUndefined()
  })

  it('merges custom attributes with context attributes', () => {
    const ctx = {
      traceId: 'a'.repeat(32),
      spanId: 'b'.repeat(16),
      tenantId: 'x',
      actorId: 'y',
      requestId: 'z',
    }

    const span = createSpan('my-span', ctx, { custom: 'attr', count: 42 })
    expect(span.attributes.tenant_id).toBe('x')
    expect(span.attributes.custom).toBe('attr')
    expect(span.attributes.count).toBe(42)
  })
})

describe('withSpan — error path', () => {
  it('records exception event with error message', async () => {
    const exporter = vi.fn()
    setSpanExporter(exporter)

    await expect(
      withSpan('fail-span', async () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')

    const reported: Span = exporter.mock.calls[0][0]
    expect(reported.status).toBe('error')
    expect(reported.events).toHaveLength(1)
    expect(reported.events[0].name).toBe('exception')
    expect(reported.events[0].attributes['exception.message']).toBe('boom')
  })

  it('records non-Error thrown values', async () => {
    const exporter = vi.fn()
    setSpanExporter(exporter)

    await expect(
      withSpan('fail-span', async () => {
        throw 'string-error'
      }),
    ).rejects.toThrow('string-error')

    const reported: Span = exporter.mock.calls[0][0]
    expect(reported.events[0].attributes['exception.message']).toBe('string-error')
  })

  it('withSpan propagates attributes to the created span', async () => {
    const exporter = vi.fn()
    setSpanExporter(exporter)

    await withSpan('custom-span', async () => 'ok', { region: 'us-east' })

    const reported: Span = exporter.mock.calls[0][0]
    expect(reported.attributes.region).toBe('us-east')
  })
})
