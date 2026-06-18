import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  getTracer,
  traced,
  startSpan,
  getTraceContext,
  addSpanEvent,
  setSpanAttributes,
  recordException,
  SpanStatusCode,
  TraceAttributes,
} from '../utils';

beforeEach(() => {
  vi.clearAllMocks();
});

// ── SpanStatusCode enum ──────────────────────────────────────────────────────

describe('SpanStatusCode', () => {
  it('has expected values', () => {
    expect(SpanStatusCode.UNSET).toBe(0);
    expect(SpanStatusCode.OK).toBe(1);
    expect(SpanStatusCode.ERROR).toBe(2);
  });
});

// ── TraceAttributes constant ─────────────────────────────────────────────────

describe('TraceAttributes', () => {
  it('has user attributes', () => {
    expect(TraceAttributes.USER_ID).toBe('user.id');
    expect(TraceAttributes.MEMBER_ID).toBe('member.id');
    expect(TraceAttributes.ORGANIZATION_ID).toBe('organization.id');
  });

  it('has claim attributes', () => {
    expect(TraceAttributes.CLAIM_ID).toBe('claim.id');
    expect(TraceAttributes.CLAIM_TYPE).toBe('claim.type');
  });

  it('has payment attributes', () => {
    expect(TraceAttributes.PAYMENT_ID).toBe('payment.id');
    expect(TraceAttributes.PAYMENT_CURRENCY).toBe('payment.currency');
  });

  it('has DB attributes', () => {
    expect(TraceAttributes.DB_OPERATION).toBe('db.operation');
    expect(TraceAttributes.DB_TABLE).toBe('db.table');
  });

  it('has HTTP attributes', () => {
    expect(TraceAttributes.HTTP_METHOD).toBe('http.method');
    expect(TraceAttributes.HTTP_STATUS_CODE).toBe('http.status_code');
  });

  it('has operation attributes', () => {
    expect(TraceAttributes.OPERATION_TYPE).toBe('operation.type');
    expect(TraceAttributes.OPERATION_SUCCESS).toBe('operation.success');
  });
});

// ── getTracer (falls back to no-op) ──────────────────────────────────────────

describe('getTracer', () => {
  it('returns a tracer with startSpan / startActiveSpan', () => {
    const tracer = getTracer();
    expect(tracer.startSpan).toBeTypeOf('function');
    expect(tracer.startActiveSpan).toBeTypeOf('function');
  });

  it('accepts custom name', () => {
    const tracer = getTracer('custom-service');
    expect(tracer).toBeDefined();
  });
});

// ── startSpan (no-op path) ───────────────────────────────────────────────────

describe('startSpan', () => {
  it('returns a no-op span with full interface', () => {
    const span = startSpan('test-span');
    expect(span.setAttribute).toBeTypeOf('function');
    expect(span.setAttributes).toBeTypeOf('function');
    expect(span.addEvent).toBeTypeOf('function');
    expect(span.recordException).toBeTypeOf('function');
    expect(span.setStatus).toBeTypeOf('function');
    expect(span.end).toBeTypeOf('function');
    expect(span.isRecording()).toBe(false);
  });

  it('no-op span methods are chainable', () => {
    const span = startSpan('test-span');
    const result = span.setAttribute('key', 'val').setAttributes({}).addEvent('ev');
    expect(result).toBeDefined();
  });

  it('accepts attributes', () => {
    const span = startSpan('test-span', { foo: 'bar' });
    expect(span).toBeDefined();
    span.end();
  });
});

// ── traced (no-op path) ──────────────────────────────────────────────────────

describe('traced', () => {
  it('executes function and returns result with no-op span', async () => {
    const result = await traced('my-op', async (span) => {
      span.setAttribute('key', 'val');
      return 42;
    });
    expect(result).toBe(42);
  });

  it('passes attributes when provided', async () => {
    const result = await traced(
      'op',
      async () => 'ok',
      { [TraceAttributes.USER_ID]: 'u1' },
    );
    expect(result).toBe('ok');
  });

  it('propagates thrown errors', async () => {
    await expect(
      traced('fail-op', async () => { throw new Error('boom'); }),
    ).rejects.toThrow('boom');
  });
});

// ── getTraceContext (no-op path) ─────────────────────────────────────────────

describe('getTraceContext', () => {
  it('returns empty object when OTel unavailable', () => {
    const ctx = getTraceContext();
    expect(ctx).toEqual({});
  });
});

// ── addSpanEvent (no-op path) ────────────────────────────────────────────────

describe('addSpanEvent', () => {
  it('does not throw when OTel unavailable', () => {
    expect(() => addSpanEvent('test-event', { key: 'val' })).not.toThrow();
  });
});

// ── setSpanAttributes (no-op path) ───────────────────────────────────────────

describe('setSpanAttributes', () => {
  it('does not throw when OTel unavailable', () => {
    expect(() => setSpanAttributes({ key: 'val' })).not.toThrow();
  });
});

// ── recordException (no-op path) ─────────────────────────────────────────────

describe('recordException', () => {
  it('does not throw when OTel unavailable', () => {
    expect(() => recordException(new Error('test'))).not.toThrow();
  });

  it('handles string error', () => {
    expect(() => recordException('test error' as any as Error)).not.toThrow();
  });
});
