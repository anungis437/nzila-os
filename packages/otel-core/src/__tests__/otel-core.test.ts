import { describe, it, expect } from 'vitest';
import {
  EvidenceSpanProcessor,
  verifyEvidenceTrace,
  type EvidenceTraceContext,
} from '../evidence-correlation.js';
import { evaluateBurnRate, SLOMonitor } from '../slo.js';
import { attributeCost, type ResourceMetrics } from '../cost-attribution.js';

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
