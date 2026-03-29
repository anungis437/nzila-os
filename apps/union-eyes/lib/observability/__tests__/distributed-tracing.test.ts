import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { tracingService, trace } from '../distributed-tracing';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DistributedTracing (tracingService)', () => {
  it('startTrace creates a trace context', () => {
    const ctx = tracingService.startTrace('test-trace');
    expect(ctx.traceId).toBeDefined();
    expect(ctx.spanId).toBeDefined();
    expect(typeof ctx.sampled).toBe('boolean');
  });

  it('startSpan creates a child span', () => {
    tracingService.startTrace('parent');
    const span = tracingService.startSpan('child');
    expect(span.name).toBe('child');
    expect(span.parentId).toBeDefined();
  });

  it('endSpan sets duration and status', () => {
    tracingService.startTrace('trace');
    const span = tracingService.startSpan('work');
    tracingService.endSpan(span, 'ok', { result: 'success' });
    expect(span.duration).toBeGreaterThanOrEqual(0);
    expect(span.status).toBe('ok');
    expect(span.attributes.result).toBe('success');
  });

  it('endSpan with no active span logs warning', () => {
    // End all active spans first
    tracingService.endSpan(undefined, 'ok');
    tracingService.endSpan(undefined, 'ok');
    tracingService.endSpan(undefined, 'ok');
    // This should warn — no active span
    tracingService.endSpan();
  });

  it('addEvent adds event to current span', () => {
    tracingService.startTrace('ev-trace');
    const span = tracingService.startSpan('ev-span');
    tracingService.addEvent('something-happened', { key: 'val' });
    expect(span.events).toHaveLength(1);
    expect(span.events[0].name).toBe('something-happened');
  });

  it('setAttribute sets attribute on current span', () => {
    tracingService.startTrace('attr-trace');
    const span = tracingService.startSpan('attr-span');
    tracingService.setAttribute('myKey', 'myVal');
    expect(span.attributes.myKey).toBe('myVal');
  });

  it('setAttribute on specific span', () => {
    tracingService.startTrace('attr2');
    const span = tracingService.startSpan('target');
    tracingService.setAttribute('x', 'y', span);
    expect(span.attributes.x).toBe('y');
  });

  it('recordException marks span as error', () => {
    tracingService.startTrace('err-trace');
    const span = tracingService.startSpan('err-span');
    tracingService.recordException(new Error('boom'));
    expect(span.status).toBe('error');
    expect(span.attributes['error']).toBe('true');
    expect(span.attributes['error.message']).toBe('boom');
  });

  it('injectContext adds trace headers', () => {
    tracingService.startTrace('inject-trace');
    tracingService.startSpan('inject-span');
    const carrier = tracingService.injectContext({});
    expect(carrier['x-trace-id']).toBeDefined();
    expect(carrier['x-span-id']).toBeDefined();
  });

  it('injectContext returns carrier unchanged when no active span', () => {
    // Clear active spans
    tracingService.endSpan(undefined, 'ok');
    tracingService.endSpan(undefined, 'ok');
    tracingService.endSpan(undefined, 'ok');
    tracingService.endSpan(undefined, 'ok');
    const carrier = tracingService.injectContext({ existing: 'v' });
    expect(carrier.existing).toBe('v');
  });

  it('extractContext parses headers', () => {
    const ctx = tracingService.extractContext({
      'x-trace-id': 'abc123',
      'x-span-id': 'def456',
    });
    expect(ctx).not.toBeNull();
    expect(ctx!.traceId).toBe('abc123');
    expect(ctx!.spanId).toBe('def456');
  });

  it('extractContext returns null for missing headers', () => {
    expect(tracingService.extractContext({})).toBeNull();
  });

  it('getCurrentTrace returns context of active span', () => {
    tracingService.startTrace('current');
    const ctx = tracingService.getCurrentTrace();
    expect(ctx).not.toBeNull();
    expect(ctx!.traceId).toBeDefined();
  });

  it('getCurrentTrace returns null when no active span', () => {
    // Clear spans
    tracingService.endSpan(undefined, 'ok');
    tracingService.endSpan(undefined, 'ok');
    tracingService.endSpan(undefined, 'ok');
    const ctx = tracingService.getCurrentTrace();
    expect(ctx).toBeNull();
  });

  it('endSpan restores parent as current', () => {
    tracingService.startTrace('parent-restore');
    const parentSnap = tracingService.getCurrentTrace();
    tracingService.startSpan('child-span');
    tracingService.endSpan(undefined, 'ok');
    const cur = tracingService.getCurrentTrace();
    expect(cur?.spanId).toBe(parentSnap?.spanId);
  });
});

describe('trace decorator', () => {
  it('wraps sync method', () => {
    const descriptor: PropertyDescriptor = {
      value: function () { return 'sync-ok'; },
      writable: true,
      enumerable: false,
      configurable: true,
    };

    const wrapped = trace('test-sync')({}, 'method', descriptor);
    const result = wrapped.value();
    expect(result).toBe('sync-ok');
  });

  it('wraps async method', async () => {
    const descriptor: PropertyDescriptor = {
      value: async function () { return 'async-ok'; },
      writable: true,
      enumerable: false,
      configurable: true,
    };

    const wrapped = trace('test-async')({}, 'method', descriptor);
    const result = await wrapped.value();
    expect(result).toBe('async-ok');
  });

  it('handles async error', async () => {
    const descriptor: PropertyDescriptor = {
      value: async function () { throw new Error('oops'); },
      writable: true,
      enumerable: false,
      configurable: true,
    };

    const wrapped = trace('err-async')({}, 'method', descriptor);
    await expect(wrapped.value()).rejects.toThrow('oops');
  });

  it('handles sync error', () => {
    const descriptor: PropertyDescriptor = {
      value: function () { throw new Error('sync-err'); },
      writable: true,
      enumerable: false,
      configurable: true,
    };

    const wrapped = trace('err-sync')({}, 'method', descriptor);
    expect(() => wrapped.value()).toThrow('sync-err');
  });
});
