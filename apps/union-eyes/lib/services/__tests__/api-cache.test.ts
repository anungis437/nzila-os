import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCacheGetOrSetStale = vi.hoisted(() => vi.fn());

vi.mock('../cache-service', () => ({
  cacheGetOrSetStale: mockCacheGetOrSetStale,
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('next/server', () => {
  class MockNextResponse {
    body: string | null;
    status: number;
    statusText: string;
    headers: Map<string, string>;

    constructor(body: string | null, init?: { status?: number; statusText?: string; headers?: Map<string, string> }) {
      this.body = body;
      this.status = init?.status ?? 200;
      this.statusText = init?.statusText ?? 'OK';
      this.headers = init?.headers ?? new Map();
    }

    static json(data: unknown, init?: { status?: number }) {
      return new MockNextResponse(JSON.stringify(data), { status: init?.status ?? 200 });
    }
  }

  class MockNextRequest {
    url: string;
    method: string;

    constructor(url: string, init?: { method?: string }) {
      this.url = url;
      this.method = init?.method ?? 'GET';
    }
  }

  return {
    NextResponse: MockNextResponse,
    NextRequest: MockNextRequest,
  };
});

import { withApiCache } from '../api-cache';
import { NextRequest, NextResponse } from 'next/server';

describe('api-cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheGetOrSetStale.mockReset();
  });

  it('calls handler directly for non-GET requests', async () => {
    const request = new NextRequest('http://localhost/api/data', { method: 'POST' });
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));

    await withApiCache(request, handler);

    expect(handler).toHaveBeenCalled();
    expect(mockCacheGetOrSetStale).not.toHaveBeenCalled();
  });

  it('calls handler for GET requests without staleWhileRevalidate', async () => {
    const request = new NextRequest('http://localhost/api/data', { method: 'GET' });
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ items: [] }));

    const result = await withApiCache(request, handler, { revalidate: 60 });

    expect(handler).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('uses cacheGetOrSetStale when staleWhileRevalidate is set', async () => {
    const cachedResponse = NextResponse.json({ cached: true });
    mockCacheGetOrSetStale.mockResolvedValue(cachedResponse);

    const request = new NextRequest('http://localhost/api/orgs?page=1', { method: 'GET' });
    const handler = vi.fn();

    await withApiCache(request, handler, {
      revalidate: 60,
      staleWhileRevalidate: 30,
    });

    expect(mockCacheGetOrSetStale).toHaveBeenCalledWith(
      expect.stringContaining('GET:'),
      handler,
      expect.objectContaining({
        ttl: 60,
        staleWhileRevalidate: 30,
      })
    );
  });

  it('generates different cache keys for different URLs', async () => {
    const handler = vi.fn().mockResolvedValue(NextResponse.json({}));

    const request1 = new NextRequest('http://localhost/api/orgs', { method: 'GET' });
    const request2 = new NextRequest('http://localhost/api/members', { method: 'GET' });

    mockCacheGetOrSetStale.mockResolvedValue(NextResponse.json({}));

    await withApiCache(request1, handler, { staleWhileRevalidate: 10 });
    await withApiCache(request2, handler, { staleWhileRevalidate: 10 });

    const key1 = mockCacheGetOrSetStale.mock.calls[0][0];
    const key2 = mockCacheGetOrSetStale.mock.calls[1][0];

    expect(key1).not.toBe(key2);
  });
});
