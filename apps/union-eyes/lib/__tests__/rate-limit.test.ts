import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  rateLimit,
  createRateLimitHeaders,
  createRateLimitResponse,
} from '../rate-limit';

function makeRequest(ip = '127.0.0.1'): Request {
  return new Request('http://localhost/api/test', {
    headers: {
      'x-forwarded-for': ip,
      'user-agent': 'test-agent',
    },
  });
}

describe('rateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests under the limit', () => {
    const req = makeRequest('10.0.0.1');
    const result = rateLimit(req, { maxRequests: 5, windowSeconds: 60 });
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('blocks requests over the limit', () => {
    const req = makeRequest('10.0.0.2');
    for (let i = 0; i < 3; i++) {
      rateLimit(req, { maxRequests: 3, windowSeconds: 60 });
    }
    const result = rateLimit(req, { maxRequests: 3, windowSeconds: 60 });
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('resets after window expires', () => {
    const req = makeRequest('10.0.0.3');
    for (let i = 0; i < 3; i++) {
      rateLimit(req, { maxRequests: 3, windowSeconds: 1 });
    }
    // advance past the window
    vi.advanceTimersByTime(1100);

    const result = rateLimit(req, { maxRequests: 3, windowSeconds: 1 });
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it('isolates different IPs', () => {
    const r1 = makeRequest('10.0.0.4');
    const r2 = makeRequest('10.0.0.5');

    rateLimit(r1, { maxRequests: 1, windowSeconds: 60 });
    const blocked = rateLimit(r1, { maxRequests: 1, windowSeconds: 60 });
    const allowed = rateLimit(r2, { maxRequests: 1, windowSeconds: 60 });

    expect(blocked.success).toBe(false);
    expect(allowed.success).toBe(true);
  });

  it('supports a custom key generator', () => {
    const req = makeRequest();
    const result = rateLimit(req, {
      maxRequests: 5,
      keyGenerator: () => 'custom-key',
    });
    expect(result.success).toBe(true);
  });
});

describe('createRateLimitHeaders', () => {
  it('includes standard rate limit headers', () => {
    const headers = createRateLimitHeaders({
      success: true,
      remaining: 4,
      resetAt: 1700000000000,
    });
    expect(headers['X-RateLimit-Remaining']).toBe('4');
    expect(headers['X-RateLimit-Reset']).toBeDefined();
  });
});

describe('createRateLimitResponse', () => {
  it('returns 429 status', () => {
    const response = createRateLimitResponse({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 30_000,
    });
    expect(response.status).toBe(429);
  });
});
