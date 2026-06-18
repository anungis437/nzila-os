import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withAdminAuth: vi.fn(),
  getCurrentUser: vi.fn(),
  embeddingCache: {
    getStats: vi.fn(),
    clearCache: vi.fn(),
    resetStats: vi.fn(),
  },
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/api-auth-guard', () => ({
  withAdminAuth: m.withAdminAuth,
  getCurrentUser: m.getCurrentUser,
}));
vi.mock('@/lib/services/ai/embedding-cache', () => ({
  embeddingCache: m.embeddingCache,
}));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { VALIDATION_ERROR: 'VALIDATION_ERROR' },
  standardErrorResponse: (_code: string, message: string, details?: unknown) =>
    new Response(JSON.stringify({ message, details }), { status: 400, headers: { 'content-type': 'application/json' } }),
}));

async function loadRoute() {
  return import('../ai/cache-stats/route');
}

describe('ai/cache-stats route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withAdminAuth.mockImplementation(
      (handler: (req: NextRequest) => Promise<Response>) =>
        (req: NextRequest) => handler(req),
    );
    m.getCurrentUser.mockResolvedValue({ id: 'admin_1' });
    m.embeddingCache.getStats.mockResolvedValue({
      totalRequests: 10,
      hits: 4,
      misses: 6,
      hitRate: 40,
      estimatedCostSavingsUsd: 2.5,
    });
    m.embeddingCache.clearCache.mockResolvedValue({ deleted: 12 });
    m.embeddingCache.resetStats.mockResolvedValue(undefined);
  });

  it('GET returns cache stats payload', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/ai/cache-stats'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.hitRate).toBe(40);
  });

  it('GET returns 500 when stats retrieval fails', async () => {
    const { GET } = await loadRoute();
    m.embeddingCache.getStats.mockRejectedValueOnce(new Error('cache unavailable'));

    const response = await GET(new NextRequest('http://localhost/api/ai/cache-stats'));
    expect(response.status).toBe(500);
  });

  it('POST rejects invalid action values via schema validation', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/ai/cache-stats', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'unknown' }),
    }));

    expect(response.status).toBe(400);
  });

  it('POST rejects missing action with explicit error', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/ai/cache-stats', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }));

    expect(response.status).toBe(400);
  });

  it('POST clears cache when action is clear', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/ai/cache-stats', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'clear' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.deletedKeys).toBe(12);
    expect(m.embeddingCache.clearCache).toHaveBeenCalled();
  });

  it('POST resets stats when action is reset-stats', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/ai/cache-stats', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'reset-stats' }),
    }));

    expect(response.status).toBe(200);
    expect(m.embeddingCache.resetStats).toHaveBeenCalled();
  });

  it('POST returns 500 when request body parsing throws', async () => {
    const { POST } = await loadRoute();
    const badRequest = {
      json: async () => {
        throw new Error('bad json');
      },
    } as unknown as NextRequest;

    const response = await POST(badRequest);
    expect(response.status).toBe(500);
  });
});
