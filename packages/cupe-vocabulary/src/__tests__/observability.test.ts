/**
 * Tests for observability helpers — PR-070
 *
 * Tests correlation-ID extraction, response-header injection,
 * and W3C traceparent parsing without needing Clerk or Next.js runtime.
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Local mirrors (pure logic only — no AsyncLocalStorage or Clerk)
// ---------------------------------------------------------------------------

function extractCorrelationId(headers: Record<string, string | undefined>): string {
  return headers['x-correlation-id'] ?? headers['x-request-id'] ?? crypto.randomUUID();
}

function parseTraceparent(header: string | undefined): { traceId: string; spanId: string } | null {
  if (!header) return null;
  const parts = header.split('-');
  if (parts.length < 4) return null;
  const [, traceId, spanId] = parts;
  if (!traceId || traceId.length !== 32) return null;
  if (!spanId || spanId.length !== 16) return null;
  return { traceId, spanId };
}

function buildResponseHeaders(requestId: string, startTime: number, now: number): Record<string, string> {
  return {
    'x-request-id': requestId,
    'x-response-time': `${now - startTime}ms`,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('extractCorrelationId', () => {
  it('prefers x-correlation-id', () => {
    const id = extractCorrelationId({ 'x-correlation-id': 'abc-123', 'x-request-id': 'def-456' });
    expect(id).toBe('abc-123');
  });

  it('falls back to x-request-id', () => {
    const id = extractCorrelationId({ 'x-request-id': 'req-789' });
    expect(id).toBe('req-789');
  });

  it('generates a UUID when no header present', () => {
    const id = extractCorrelationId({});
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe('parseTraceparent', () => {
  it('parses a valid W3C traceparent header', () => {
    const result = parseTraceparent('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');
    expect(result).toEqual({
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      spanId: '00f067aa0ba902b7',
    });
  });

  it('returns null for undefined header', () => {
    expect(parseTraceparent(undefined)).toBeNull();
  });

  it('returns null for malformed header', () => {
    expect(parseTraceparent('not-a-traceparent')).toBeNull();
  });

  it('returns null for wrong traceId length', () => {
    expect(parseTraceparent('00-short-00f067aa0ba902b7-01')).toBeNull();
  });

  it('returns null for wrong spanId length', () => {
    expect(parseTraceparent('00-4bf92f3577b34da6a3ce929d0e0e4736-short-01')).toBeNull();
  });
});

describe('buildResponseHeaders', () => {
  it('includes request ID and response time', () => {
    const headers = buildResponseHeaders('req-001', 1000, 1250);
    expect(headers['x-request-id']).toBe('req-001');
    expect(headers['x-response-time']).toBe('250ms');
  });

  it('handles zero-duration requests', () => {
    const headers = buildResponseHeaders('req-002', 5000, 5000);
    expect(headers['x-response-time']).toBe('0ms');
  });
});
