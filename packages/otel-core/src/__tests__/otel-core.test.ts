import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  EvidenceSpanProcessor,
  injectTraceContext,
  verifyEvidenceTrace,
  type EvidenceTraceContext,
} from '../evidence-correlation.js';
import { evaluateBurnRate, SLOMonitor } from '../slo.js';
import { attributeCost, type ResourceMetrics } from '../cost-attribution.js';
import { createNzilaSpan, withNzilaSpan, addNzilaAttributes } from '../spans.js';

// ── Evidence Correlation ─────────────────────────────────────────────────────

describe('EvidenceSpanProcessor', () => {
  it('should track evidence spans by pack ID', () => {
    const processor = new EvidenceSpanProcessor();
    const traceId = 'a'.repeat(32);
    const spanId = 'b'.repeat(16);

    processor.onStart({
      spanContext: () => ({ traceId, spanId, traceFlags: 1 }),
      setAttribute: () => {},
      attributes: { 'nzila.evidence.pack_id': 'pack-123' },
    });

    const ctx = processor.getTraceContext('pack-123');
    expect(ctx).toBeDefined();
    expect(ctx?.traceId).toBe(traceId);
    expect(ctx?.spanId).toBe(spanId);
    expect(ctx?.traceparent).toBe(`00-${traceId}-${spanId}-01`);
  });

  it('should return undefined for unknown pack IDs', () => {
    const processor = new EvidenceSpanProcessor();
    expect(processor.getTraceContext('nonexistent')).toBeUndefined();
  });

  it('should support onEnd, forceFlush, and shutdown lifecycle', async () => {
    const processor = new EvidenceSpanProcessor();
    const traceId = 'a'.repeat(32);
    const spanId = 'b'.repeat(16);

    processor.onStart({
      spanContext: () => ({ traceId, spanId, traceFlags: 1 }),
      setAttribute: () => {},
      attributes: { 'nzila.evidence.pack_id': 'pack-lifecycle' },
    });

    processor.onEnd({
      spanContext: () => ({ traceId, spanId, traceFlags: 1 }),
      attributes: { 'nzila.evidence.pack_id': 'pack-lifecycle' },
      duration: [1, 500_000_000],
    });

    await expect(processor.forceFlush()).resolves.toBeUndefined();
    expect(processor.getTraceContext('pack-lifecycle')).toBeDefined();

    await processor.shutdown();
    expect(processor.getTraceContext('pack-lifecycle')).toBeUndefined();
  });
});

describe('verifyEvidenceTrace', () => {
  const packId = '01234567-89ab-4cde-8f01-234567890abc';

  it('should verify valid trace context', async () => {
    const traceId = 'a'.repeat(32);
    const spanId = 'b'.repeat(16);
    const ctx: EvidenceTraceContext = {
      traceId,
      spanId,
      traceFlags: 1,
      traceparent: `00-${traceId}-${spanId}-01`,
      evidencePackId: packId,
    };

    const result = await verifyEvidenceTrace(packId, ctx);
    expect(result.verified).toBe(true);
    expect(result.confidence).toBe('high');
  });

  it('should reject tampered traceparent', async () => {
    const traceId = 'a'.repeat(32);
    const spanId = 'b'.repeat(16);
    const ctx: EvidenceTraceContext = {
      traceId,
      spanId,
      traceFlags: 1,
      traceparent: `00-${'c'.repeat(32)}-${spanId}-01`,
      evidencePackId: packId,
    };

    const result = await verifyEvidenceTrace(packId, ctx);
    expect(result.verified).toBe(false);
    expect(result.confidence).toBe('low');
    expect(result.details).toContain('tampering');
  });

  it('should reject all-zero trace IDs', async () => {
    const traceId = '0'.repeat(32);
    const spanId = 'b'.repeat(16);
    const ctx: EvidenceTraceContext = {
      traceId,
      spanId,
      traceFlags: 0,
      traceparent: `00-${traceId}-${spanId}-00`,
    };

    const result = await verifyEvidenceTrace('01234567-89ab-4cde-8f01-234567890def', ctx);
    expect(result.verified).toBe(false);
    expect(result.details).toContain('all zeros');
  });

  it('should reject invalid trace context format', async () => {
    const result = await verifyEvidenceTrace(
      '01234567-89ab-4cde-8f01-234567890abc',
      {
        traceId: 'short',
        spanId: 'b'.repeat(16),
        traceFlags: 1,
        traceparent: 'invalid',
      } as EvidenceTraceContext,
    );

    expect(result.verified).toBe(false);
    expect(result.details).toContain('Invalid trace context format');
  });

  it('should return medium confidence when evidence pack id differs', async () => {
    const traceId = 'a'.repeat(32);
    const spanId = 'b'.repeat(16);
    const ctx: EvidenceTraceContext = {
      traceId,
      spanId,
      traceFlags: 1,
      traceparent: `00-${traceId}-${spanId}-01`,
      evidencePackId: '01234567-89ab-4cde-8f01-234567890abc',
    };

    const result = await verifyEvidenceTrace('01234567-89ab-4cde-8f01-234567890def', ctx);
    expect(result.verified).toBe(true);
    expect(result.confidence).toBe('medium');
  });
});

describe('injectTraceContext', () => {
  it('should return null when no active span exists', async () => {
    const result = await injectTraceContext();
    expect(result).toBeNull();
  });
});

// ── SLO Monitor ──────────────────────────────────────────────────────────────

describe('SLOMonitor', () => {
  it('should record requests and produce no alerts within budget', () => {
    const monitor = new SLOMonitor([
      {
        name: 'test-availability',
        service: 'test',
        target: 0.999,
        indicator: 'availability',
        windowHours: 720,
        owner: 'test-team',
      },
    ]);

    // Record 1000 good requests
    for (let i = 0; i < 1000; i++) {
      monitor.recordRequest('test', 'availability', true);
    }

    const alerts = monitor.evaluate();
    expect(alerts).toHaveLength(0);
  });

  it('should alert on high burn rate', () => {
    const monitor = new SLOMonitor([
      {
        name: 'test-availability',
        service: 'test',
        target: 0.999,
        indicator: 'availability',
        windowHours: 720,
        owner: 'test-team',
      },
    ]);

    // Record 50% error rate (extreme)
    for (let i = 0; i < 100; i++) {
      monitor.recordRequest('test', 'availability', i % 2 === 0);
    }

    const alerts = monitor.evaluate();
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0]!.severity).toBeDefined();
    expect(alerts[0]!.burnRate).toBeGreaterThan(1);
  });
});

describe('evaluateBurnRate', () => {
  it('should return 1.0 for error rate equal to budget', () => {
    const rate = evaluateBurnRate(0.999, 0.999, 6, 720);
    expect(rate).toBeCloseTo(1.0, 1);
  });

  it('should return >1 when burning faster than budget allows', () => {
    const rate = evaluateBurnRate(0.999, 0.99, 6, 720);
    expect(rate).toBeGreaterThan(1);
  });

  it('should return 0 for perfect success rate', () => {
    const rate = evaluateBurnRate(0.999, 1.0, 6, 720);
    expect(rate).toBe(0);
  });

  it('should return Infinity when error budget is zero', () => {
    const rate = evaluateBurnRate(1, 0.9, 6, 720);
    expect(rate).toBe(Infinity);
  });
});

// ── Cost Attribution ─────────────────────────────────────────────────────────

describe('attributeCost', () => {
  it('should calculate compute cost from resource metrics', async () => {
    const metrics: ResourceMetrics = {
      orgId: 'org-123',
      serviceName: 'console',
      durationMs: 150,
      memoryMb: 256,
      cpuSeconds: 0.15,
    };

    const cost = await attributeCost(metrics);
    expect(cost.orgId).toBe('org-123');
    expect(cost.resourceType).toBe('compute');
    expect(cost.costUSD).toBeGreaterThan(0);
    expect(cost.serviceName).toBe('console');
  });

  it('should classify AI costs correctly', async () => {
    const metrics: ResourceMetrics = {
      orgId: 'org-456',
      serviceName: 'console',
      durationMs: 2000,
      memoryMb: 512,
      aiTokensInput: 1000,
      aiTokensOutput: 500,
      aiModelId: 'gpt-4o',
    };

    const cost = await attributeCost(metrics);
    expect(cost.resourceType).toBe('ai');
    expect(cost.costUSD).toBeGreaterThan(0);
  });

  it('should classify storage and network costs when present', async () => {
    const cost = await attributeCost({
      orgId: 'org-789',
      serviceName: 'console',
      durationMs: 1000,
      memoryMb: 128,
      storageBytes: 3 * 1024 * 1024 * 1024,
      networkBytes: 1024 * 1024 * 1024,
    });

    expect(cost.resourceType).toBe('network');
    expect(cost.costUSD).toBeGreaterThan(0);
  });

  it('should reject invalid metrics', async () => {
    await expect(
      attributeCost({
        orgId: '',
        serviceName: 'test',
        durationMs: 100,
        memoryMb: 128,
      } as ResourceMetrics),
    ).rejects.toThrow();
  });
});

describe('spans helpers', () => {
  it('createNzilaSpan executes callback and returns value in no-op mode', async () => {
    const result = await createNzilaSpan(
      'unit.span',
      { 'nzila.org.id': 'org-1', 'compute.duration.ms': 10 },
      async (span) => {
        span.setAttribute('test.attr', 'ok');
        span.addEvent('step');
        span.setStatus({ code: 1, message: 'ready' });
        span.end();
        return 'done';
      },
    );

    expect(result).toBe('done');
  });

  it('withNzilaSpan passes through return values', async () => {
    const value = await withNzilaSpan('wrapped', 'org-2', async () => 42);
    expect(value).toBe(42);
  });

  it('addNzilaAttributes is a no-op without active span', async () => {
    await expect(addNzilaAttributes({ 'nzila.org.id': 'org-3' })).resolves.toBeUndefined();
  });
});

describe('index exports', () => {
  it('exposes public API surface', async () => {
    const api = await import('../index.js');
    expect(typeof api.createNzilaSpan).toBe('function');
    expect(typeof api.attributeCost).toBe('function');
    expect(typeof api.verifyEvidenceTrace).toBe('function');
    expect(typeof api.SLOMonitor).toBe('function');
  });
});

describe('OpenTelemetry active instrumentation paths', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('createNzilaSpan sets attributes and success status when OTel is available', async () => {
    const span = {
      setAttribute: vi.fn(),
      addEvent: vi.fn(),
      setStatus: vi.fn(),
      end: vi.fn(),
      recordException: vi.fn(),
    };
    const startActiveSpan = vi.fn(async (_name: string, cb: (s: typeof span) => Promise<string>) => cb(span));

    vi.doMock('@opentelemetry/api', () => ({
      trace: {
        getTracer: () => ({ startActiveSpan }),
      },
      SpanStatusCode: {
        OK: 1,
        ERROR: 2,
      },
    }));

    const { createNzilaSpan } = await import('../spans.js');
    const result = await createNzilaSpan(
      'otel.success',
      { 'nzila.org.id': 'org-otel', 'compute.duration.ms': 20 },
      async () => 'ok',
    );

    expect(result).toBe('ok');
    expect(startActiveSpan).toHaveBeenCalledTimes(1);
    expect(span.setAttribute).toHaveBeenCalledWith('nzila.org.id', 'org-otel');
    expect(span.setAttribute).toHaveBeenCalledWith('compute.duration.ms', 20);
    expect(span.setStatus).toHaveBeenCalledWith({ code: 1 });
    expect(span.end).toHaveBeenCalledTimes(1);
  });

  it('createNzilaSpan records exception and rethrows when callback fails', async () => {
    const span = {
      setAttribute: vi.fn(),
      addEvent: vi.fn(),
      setStatus: vi.fn(),
      end: vi.fn(),
      recordException: vi.fn(),
    };
    const startActiveSpan = vi.fn(async (_name: string, cb: (s: typeof span) => Promise<never>) => cb(span));

    vi.doMock('@opentelemetry/api', () => ({
      trace: {
        getTracer: () => ({ startActiveSpan }),
      },
      SpanStatusCode: {
        OK: 1,
        ERROR: 2,
      },
    }));

    const { createNzilaSpan } = await import('../spans.js');
    await expect(
      createNzilaSpan('otel.error', { 'nzila.org.id': 'org-otel' }, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(span.recordException).toHaveBeenCalledTimes(1);
    expect(span.end).toHaveBeenCalledTimes(1);
    expect(span.setStatus).toHaveBeenCalledWith({ code: 2, message: 'boom' });
  });

  it('addNzilaAttributes sets attributes on an active span', async () => {
    const activeSpan = { setAttribute: vi.fn() };

    vi.doMock('@opentelemetry/api', () => ({
      trace: {
        getActiveSpan: () => activeSpan,
      },
    }));

    const { addNzilaAttributes } = await import('../spans.js');
    await addNzilaAttributes({
      'nzila.user.id': 'user-1',
      'compute.memory.mb': 128,
    });

    expect(activeSpan.setAttribute).toHaveBeenCalledWith('nzila.user.id', 'user-1');
    expect(activeSpan.setAttribute).toHaveBeenCalledWith('compute.memory.mb', 128);
  });
});

describe('fastify-plugin', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registers plugin and annotates request/response spans when dependencies are available', async () => {
    const otelPlugin = vi.fn();
    const activeSpan = { setAttribute: vi.fn() };
    const hooks: Record<string, (...args: unknown[]) => Promise<void>> = {};

    vi.doMock('@fastify/otel', () => ({ default: otelPlugin }));
    vi.doMock('@opentelemetry/api', () => ({
      trace: {
        getActiveSpan: () => activeSpan,
      },
    }));

    const { default: plugin } = await import('../fastify-plugin.js');
    const fastify = {
      register: vi.fn(async () => {}),
      addHook: vi.fn((name: string, fn: (...args: unknown[]) => Promise<void>) => {
        hooks[name] = fn;
      }),
      log: {
        info: vi.fn(),
        warn: vi.fn(),
      },
    };

    await plugin(fastify as never, { serviceName: 'orchestrator-api', enableCostAttribution: true });
    expect(fastify.register).toHaveBeenCalledTimes(1);
    expect(fastify.log.info).toHaveBeenCalledTimes(1);
    expect(fastify.addHook).toHaveBeenCalledTimes(2);

    await hooks.onRequest({
      headers: {
        'x-org-id': 'org-1',
        'x-user-id': 'user-1',
        'x-request-id': 'req-1',
      },
    });
    expect(activeSpan.setAttribute).toHaveBeenCalledWith('nzila.org.id', 'org-1');
    expect(activeSpan.setAttribute).toHaveBeenCalledWith('nzila.user.id', 'user-1');
    expect(activeSpan.setAttribute).toHaveBeenCalledWith('nzila.request.id', 'req-1');
    expect(activeSpan.setAttribute).toHaveBeenCalledWith('compute.resource.type', 'container');

    await hooks.onResponse({}, { statusCode: 200, elapsedTime: 42 });
    expect(activeSpan.setAttribute).toHaveBeenCalledWith('http.response.status_code', 200);
    expect(activeSpan.setAttribute).toHaveBeenCalledWith('compute.duration.ms', 42);
    expect(activeSpan.setAttribute).toHaveBeenCalledWith('compute.memory.mb', expect.any(Number));
  });

  it('warns when @fastify/otel is unavailable', async () => {
    vi.doMock('@fastify/otel', async () => {
      throw new Error('missing');
    });
    vi.doMock('@opentelemetry/api', () => ({
      trace: {
        getActiveSpan: () => null,
      },
    }));

    const { default: plugin } = await import('../fastify-plugin.js');
    const hooks: Record<string, (...args: unknown[]) => Promise<void>> = {};
    const fastify = {
      register: vi.fn(async () => {}),
      addHook: vi.fn((name: string, fn: (...args: unknown[]) => Promise<void>) => {
        hooks[name] = fn;
      }),
      log: {
        info: vi.fn(),
        warn: vi.fn(),
      },
    };

    await plugin(fastify as never, { serviceName: 'orchestrator-api' });

    expect(fastify.register).not.toHaveBeenCalled();
    expect(fastify.log.warn).toHaveBeenCalledTimes(1);

    await expect(hooks.onRequest({ headers: {} })).resolves.toBeUndefined();
    await expect(hooks.onResponse({}, { statusCode: 500, elapsedTime: 1 })).resolves.toBeUndefined();
  });
});
