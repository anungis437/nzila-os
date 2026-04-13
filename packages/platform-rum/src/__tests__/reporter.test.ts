/**
 * Comprehensive tests for @nzila/platform-rum reporter module.
 *
 * Covers: processRUMBatch, handleRUMBeacon, isRUMHealthy, emitOTelMetrics
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processRUMBatch, handleRUMBeacon, isRUMHealthy, type RUMSummary } from '../reporter';

// ── OTel Mocks (hoisted for use inside vi.mock factory) ─────────────────────

const otelMocks = vi.hoisted(() => {
  const mockRecord = vi.fn();
  const mockAdd = vi.fn();
  const mockCreateHistogram = vi.fn(() => ({ record: mockRecord }));
  const mockCreateCounter = vi.fn(() => ({ add: mockAdd }));
  const mockGetMeter = vi.fn(() => ({
    createHistogram: mockCreateHistogram,
    createCounter: mockCreateCounter,
  }));
  return { mockRecord, mockAdd, mockCreateHistogram, mockCreateCounter, mockGetMeter };
});

vi.mock('@opentelemetry/api', () => ({
  metrics: { getMeter: otelMocks.mockGetMeter },
}));

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeValidEvent(overrides: Record<string, unknown> = {}) {
  return {
    metric: { name: 'LCP', value: 2000, rating: 'good', delta: 2000, id: 'v4-a' },
    pathname: '/',
    timestamp: new Date().toISOString(),
    appName: 'web',
    environment: 'development',
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('processRUMBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('processes valid events and computes average', async () => {
    const events = [
      makeValidEvent({ metric: { name: 'LCP', value: 2000, rating: 'good', delta: 2000, id: 'a' } }),
      makeValidEvent({ metric: { name: 'LCP', value: 4000, rating: 'poor', delta: 4000, id: 'b' } }),
    ];
    const summary = await processRUMBatch(events);

    expect(summary.received).toBe(2);
    expect(summary.valid).toBe(2);
    expect(summary.invalid).toBe(0);
    expect(summary.byMetric['LCP']!.count).toBe(2);
    expect(summary.byMetric['LCP']!.avgValue).toBe(3000);
    expect(summary.byMetric['LCP']!.poorCount).toBe(1);
  });

  it('handles multiple different metric names', async () => {
    const events = [
      makeValidEvent({ metric: { name: 'LCP', value: 2000, rating: 'good', delta: 2000, id: 'a' } }),
      makeValidEvent({ metric: { name: 'CLS', value: 0.05, rating: 'good', delta: 0.05, id: 'b' } }),
      makeValidEvent({ metric: { name: 'FCP', value: 1500, rating: 'good', delta: 1500, id: 'c' } }),
    ];
    const summary = await processRUMBatch(events);

    expect(Object.keys(summary.byMetric)).toHaveLength(3);
    expect(summary.byMetric['LCP']!.count).toBe(1);
    expect(summary.byMetric['CLS']!.count).toBe(1);
    expect(summary.byMetric['FCP']!.count).toBe(1);
  });

  it('handles empty array', async () => {
    const summary = await processRUMBatch([]);
    expect(summary.received).toBe(0);
    expect(summary.valid).toBe(0);
    expect(summary.invalid).toBe(0);
    expect(summary.byMetric).toEqual({});
  });

  it('counts invalid events when batch parse fails', async () => {
    const events = [
      { metric: { name: 'INVALID_METRIC', value: 'not-a-number' } }, // invalid
      { totally: 'wrong' }, // also invalid
    ];
    const summary = await processRUMBatch(events);

    expect(summary.received).toBe(2);
    expect(summary.valid).toBe(0);
    expect(summary.invalid).toBe(2);
  });

  it('returns 0 invalid when input is not an array', async () => {
    // @ts-expect-error – testing non-array input path
    const summary = await processRUMBatch('not-an-array');
    expect(summary.received).toBe(0);
    expect(summary.invalid).toBe(0);
  });

  // ── OTel Emission ─────────────────────────────────────────────────────

  it('emits OTel histogram for each valid event', async () => {
    const events = [
      makeValidEvent({ metric: { name: 'LCP', value: 2500, rating: 'good', delta: 2500, id: 'x' }, orgId: 'org_1', connectionType: '4g' }),
    ];
    await processRUMBatch(events);

    expect(otelMocks.mockGetMeter).toHaveBeenCalledWith('nzila-rum');
    expect(otelMocks.mockRecord).toHaveBeenCalledWith(
      2500,
      expect.objectContaining({
        'nzila.rum.metric_name': 'LCP',
        'nzila.rum.rating': 'good',
        'nzila.rum.app': 'web',
        'nzila.org.id': 'org_1',
        'nzila.rum.connection': '4g',
      }),
    );
  });

  it('emits OTel poor counter for poor-rated events', async () => {
    const events = [
      makeValidEvent({ metric: { name: 'LCP', value: 5000, rating: 'poor', delta: 5000, id: 'p' } }),
    ];
    await processRUMBatch(events);

    expect(otelMocks.mockAdd).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ 'nzila.rum.metric_name': 'LCP', 'nzila.rum.rating': 'poor' }),
    );
  });

  it('does not emit poor counter for good-rated events', async () => {
    const events = [
      makeValidEvent({ metric: { name: 'LCP', value: 1000, rating: 'good', delta: 1000, id: 'g' } }),
    ];
    await processRUMBatch(events);

    expect(otelMocks.mockAdd).not.toHaveBeenCalled();
  });

  it('omits optional orgId/connectionType attributes when absent', async () => {
    const events = [makeValidEvent()]; // no orgId, no connectionType
    await processRUMBatch(events);

    const attrs = otelMocks.mockRecord.mock.calls[0]?.[1];
    expect(attrs).not.toHaveProperty('nzila.org.id');
    expect(attrs).not.toHaveProperty('nzila.rum.connection');
  });

  it('gracefully handles OTel failure', async () => {
    otelMocks.mockGetMeter.mockImplementationOnce(() => {
      throw new Error('OTel unavailable');
    });

    const events = [makeValidEvent()];
    const summary = await processRUMBatch(events);

    // Still processes events — OTel failure is non-fatal
    expect(summary.valid).toBe(1);
  });
});

// ── handleRUMBeacon ─────────────────────────────────────────────────────────

describe('handleRUMBeacon', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('processes an array body and returns 200', async () => {
    const events = [makeValidEvent()];
    const request = new Request('http://test/api/rum', {
      method: 'POST',
      body: JSON.stringify(events),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await handleRUMBeacon(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.received).toBe(1);
    expect(body.valid).toBe(1);
  });

  it('wraps single event in array', async () => {
    const event = makeValidEvent();
    const request = new Request('http://test/api/rum', {
      method: 'POST',
      body: JSON.stringify(event),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await handleRUMBeacon(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.received).toBe(1);
  });

  it('returns 400 for invalid JSON', async () => {
    const request = new Request('http://test/api/rum', {
      method: 'POST',
      body: 'not valid json{{{',
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await handleRUMBeacon(request);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe('Invalid RUM payload');
  });

  it('sets Content-Type header on success', async () => {
    const request = new Request('http://test/api/rum', {
      method: 'POST',
      body: JSON.stringify([makeValidEvent()]),
    });

    const response = await handleRUMBeacon(request);
    expect(response.headers.get('Content-Type')).toBe('application/json');
  });

  it('sets Content-Type header on error', async () => {
    const request = new Request('http://test/api/rum', {
      method: 'POST',
      body: '<<<',
    });

    const response = await handleRUMBeacon(request);
    expect(response.headers.get('Content-Type')).toBe('application/json');
  });
});

// ── isRUMHealthy ────────────────────────────────────────────────────────────

describe('isRUMHealthy', () => {
  it('returns true for empty byMetric', () => {
    const summary: RUMSummary = { received: 0, valid: 0, invalid: 0, byMetric: {} };
    expect(isRUMHealthy(summary)).toBe(true);
  });

  it('returns true when poor rate is below default threshold (0.3)', () => {
    const summary: RUMSummary = {
      received: 10,
      valid: 10,
      invalid: 0,
      byMetric: { LCP: { count: 10, avgValue: 2000, poorCount: 2 } },
    };
    expect(isRUMHealthy(summary)).toBe(true);
  });

  it('returns false when poor rate exceeds default threshold', () => {
    const summary: RUMSummary = {
      received: 10,
      valid: 10,
      invalid: 0,
      byMetric: { LCP: { count: 10, avgValue: 5000, poorCount: 5 } },
    };
    expect(isRUMHealthy(summary)).toBe(false);
  });

  it('respects custom threshold parameter', () => {
    const summary: RUMSummary = {
      received: 10,
      valid: 10,
      invalid: 0,
      byMetric: { LCP: { count: 10, avgValue: 3000, poorCount: 2 } },
    };
    // 2/10 = 0.2, threshold 0.1 → unhealthy
    expect(isRUMHealthy(summary, 0.1)).toBe(false);
    // 2/10 = 0.2, threshold 0.25 → healthy
    expect(isRUMHealthy(summary, 0.25)).toBe(true);
  });

  it('returns true when poorCount is 0', () => {
    const summary: RUMSummary = {
      received: 5,
      valid: 5,
      invalid: 0,
      byMetric: {
        LCP: { count: 5, avgValue: 1000, poorCount: 0 },
        CLS: { count: 5, avgValue: 0.05, poorCount: 0 },
      },
    };
    expect(isRUMHealthy(summary)).toBe(true);
  });

  it('returns false if any metric exceeds threshold', () => {
    const summary: RUMSummary = {
      received: 20,
      valid: 20,
      invalid: 0,
      byMetric: {
        LCP: { count: 10, avgValue: 1000, poorCount: 0 }, // healthy
        CLS: { count: 10, avgValue: 0.5, poorCount: 8 },  // 80% poor → unhealthy
      },
    };
    expect(isRUMHealthy(summary)).toBe(false);
  });

  it('handles metrics with 0 count (skips division)', () => {
    const summary: RUMSummary = {
      received: 0,
      valid: 0,
      invalid: 0,
      byMetric: { LCP: { count: 0, avgValue: 0, poorCount: 0 } },
    };
    // 0/0 = NaN, NaN > 0.3 → false. But 0 count should be safe.
    expect(isRUMHealthy(summary)).toBe(true);
  });
});
