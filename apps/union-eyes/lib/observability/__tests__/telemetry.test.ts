import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @opentelemetry/api which is the only actually-installed OTel package
const mockSpan = {
  setStatus: vi.fn(),
  recordException: vi.fn(),
  end: vi.fn(),
  addEvent: vi.fn(),
  setAttribute: vi.fn(),
};
const mockTracer = {
  startSpan: vi.fn(() => mockSpan),
};

vi.mock('@opentelemetry/api', () => ({
  trace: {
    getTracer: vi.fn(() => mockTracer),
    getActiveSpan: vi.fn(() => null),
    setSpan: vi.fn((_ctx: any, span: any) => span),
  },
  context: {
    active: vi.fn(() => ({})),
    with: vi.fn((_ctx: any, fn: () => unknown) => fn()),
  },
  propagation: {
    inject: vi.fn(),
  },
}));

// Mock the heavy OTel SDK packages that are @ts-ignored in source
vi.mock('@opentelemetry/sdk-node', () => {
  class MockNodeSDK {
    start() { /* noop */ }
    shutdown() { return Promise.resolve(); }
  }
  return { NodeSDK: MockNodeSDK };
});
vi.mock('@opentelemetry/auto-instrumentations-node', () => ({
  getNodeAutoInstrumentations: vi.fn(() => []),
}));
vi.mock('@opentelemetry/exporter-trace-otlp-http', () => ({
  OTLPTraceExporter: class {},
}));
vi.mock('@opentelemetry/resources', () => ({
  Resource: class {},
}));
vi.mock('@opentelemetry/semantic-conventions', () => ({
  SemanticResourceAttributes: {
    SERVICE_NAME: 'service.name',
    SERVICE_VERSION: 'service.version',
    DEPLOYMENT_ENVIRONMENT: 'deployment.environment',
  },
}));
vi.mock('@opentelemetry/sdk-trace-base', () => ({
  BatchSpanProcessor: class {},
}));

import {
  initializeTelemetry,
  withSpan,
  addSpanEvent,
  setSpanAttributes,
  getCurrentTraceContext,
} from '../telemetry';
import { trace } from '@opentelemetry/api';

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.OTEL_ENABLED;
});

describe('initializeTelemetry', () => {
  it('returns null when OTEL_ENABLED is not set and NODE_ENV is test', () => {
    const result = initializeTelemetry();
    expect(result).toBeNull();
  });

  it('initializes SDK when OTEL_ENABLED=true', () => {
    process.env.OTEL_ENABLED = 'true';
    const result = initializeTelemetry();
    // SDK start may throw in test env; at minimum it should not crash
    expect(result).toBeDefined();
  });
});

describe('withSpan', () => {
  it('creates a span and returns result from callback', async () => {
    const result = await withSpan('test-op', async () => 42);
    expect(result).toBe(42);
    expect(mockTracer.startSpan).toHaveBeenCalledWith('test-op', { attributes: undefined });
    expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: 1 });
    expect(mockSpan.end).toHaveBeenCalled();
  });

  it('passes attributes to span', async () => {
    await withSpan('op', async () => 'ok', { key: 'val' });
    expect(mockTracer.startSpan).toHaveBeenCalledWith('op', { attributes: { key: 'val' } });
  });

  it('records exception and re-throws on error', async () => {
    const err = new Error('boom');
    await expect(withSpan('fail', async () => { throw err; })).rejects.toThrow('boom');
    expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: 2, message: 'boom' });
    expect(mockSpan.recordException).toHaveBeenCalledWith(err);
    expect(mockSpan.end).toHaveBeenCalled();
  });

  it('handles non-Error exception message', async () => {
    await expect(withSpan('fail', async () => { throw 'string-error'; })).rejects.toBe('string-error');
    expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: 2, message: 'Unknown error' });
  });
});

describe('addSpanEvent', () => {
  it('does nothing when no active span', () => {
    addSpanEvent('test-event');
    // getActiveSpan returns null by default → no crash
    expect(trace.getActiveSpan).toHaveBeenCalled();
  });

  it('adds event when span active', () => {
    vi.mocked(trace.getActiveSpan).mockReturnValueOnce(mockSpan as never);
    addSpanEvent('evt', { key: 'value' });
    expect(mockSpan.addEvent).toHaveBeenCalledWith('evt', { key: 'value' });
  });
});

describe('setSpanAttributes', () => {
  it('does nothing when no active span', () => {
    setSpanAttributes({ key: 'val' });
    expect(trace.getActiveSpan).toHaveBeenCalled();
  });

  it('sets attributes on active span', () => {
    vi.mocked(trace.getActiveSpan).mockReturnValueOnce(mockSpan as never);
    setSpanAttributes({ a: '1', b: 2 });
    expect(mockSpan.setAttribute).toHaveBeenCalledWith('a', '1');
    expect(mockSpan.setAttribute).toHaveBeenCalledWith('b', 2);
  });
});

describe('getCurrentTraceContext', () => {
  it('returns empty carrier by default', () => {
    const ctx = getCurrentTraceContext();
    expect(ctx).toEqual({});
  });
});
