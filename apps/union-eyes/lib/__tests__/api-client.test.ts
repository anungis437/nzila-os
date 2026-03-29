// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockExecute: vi.fn(),
  mockBreakerGet: vi.fn(),
  mockReset: vi.fn(),
  mockGetStats: vi.fn(),
  mockGetAllStats: vi.fn(),
}));

vi.mock('../circuit-breaker', () => ({
  circuitBreakers: {
    get: mocks.mockBreakerGet.mockReturnValue({
      execute: mocks.mockExecute,
      getStats: mocks.mockGetStats.mockReturnValue({ state: 'CLOSED', totalRequests: 0 }),
      reset: mocks.mockReset,
    }),
    getAllStats: mocks.mockGetAllStats.mockReturnValue({ 'api-test': { state: 'CLOSED' } }),
  },
  CIRCUIT_BREAKERS: {
    EXTERNAL_API: { threshold: 5, timeout: 60000, successThreshold: 2 },
  },
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  createApiClient,
  createExternalApiClient,
  getApiHealthStatus,
} from '../api-client';

describe('api-client', () => {
  let client: ReturnType<typeof createApiClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Make circuit breaker pass through to the actual function
    mocks.mockExecute.mockImplementation((fn: () => unknown) => fn());

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({ data: 'result' }),
        headers: new Headers(),
      })
    );

    client = createApiClient('test-api', {
      baseURL: 'https://api.example.com',
      retries: 0,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Basic HTTP methods ────────────────────────────────────────────

  it('GET request returns parsed data', async () => {
    const response = await client.get('/items');
    expect(response.data).toEqual({ data: 'result' });
    expect(response.status).toBe(200);
  });

  it('POST sends body as JSON', async () => {
    const response = await client.post('/items', { name: 'test' });
    expect(response.data).toEqual({ data: 'result' });

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[1].method).toBe('POST');
    expect(fetchCall[1].body).toBe(JSON.stringify({ name: 'test' }));
  });

  it('POST without body sends undefined body', async () => {
    await client.post('/items');
    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[1].body).toBeUndefined();
  });

  it('PUT sends body as JSON', async () => {
    await client.put('/items/1', { name: 'updated' });
    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[1].method).toBe('PUT');
    expect(fetchCall[1].body).toBe(JSON.stringify({ name: 'updated' }));
  });

  it('PATCH sends body as JSON', async () => {
    await client.patch('/items/1', { name: 'patched' });
    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[1].method).toBe('PATCH');
    expect(fetchCall[1].body).toBe(JSON.stringify({ name: 'patched' }));
  });

  it('DELETE makes request', async () => {
    await client.delete('/items/1');
    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[1].method).toBe('DELETE');
  });

  // ── Headers ────────────────────────────────────────────────────────

  it('merges default and custom headers', async () => {
    const customClient = createApiClient('custom', {
      baseURL: 'https://api.example.com',
      headers: { 'X-Custom': 'value' },
      retries: 0,
    });
    await customClient.get('/test', { headers: { 'X-Extra': 'extra' } });
    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[1].headers).toMatchObject({
      'Content-Type': 'application/json',
      'X-Custom': 'value',
      'X-Extra': 'extra',
    });
  });

  // ── Error handling ─────────────────────────────────────────────────

  it('throws ApiError on non-ok response with JSON body', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      json: () => Promise.resolve({ error: 'validation' }),
      headers: new Headers(),
    });

    await expect(client.get('/fail')).rejects.toThrow('HTTP 422');

    try {
      await client.get('/fail');
    } catch (err: unknown) {
      const e = err as { status: number; response: unknown; name: string };
      expect(e.name).toBe('ApiError');
      expect(e.status).toBe(422);
      expect(e.response).toEqual({ error: 'validation' });
    }
  });

  it('falls back to text when error response JSON parse fails', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.reject(new Error('not json')),
      text: () => Promise.resolve('plain error'),
      headers: new Headers(),
    });

    try {
      await client.get('/fail');
    } catch (err: unknown) {
      const e = err as { response: unknown };
      expect(e.response).toBe('plain error');
    }
  });

  it('throws TimeoutError on AbortError', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(() => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      throw err;
    });

    try {
      await client.get('/slow');
    } catch (err: unknown) {
      const e = err as { name: string; isTimeout: boolean };
      expect(e.name).toBe('TimeoutError');
      expect(e.isTimeout).toBe(true);
    }
  });

  it('executes timeout abort callback when request hangs', async () => {
    const timeoutClient = createApiClient('timeout-test', {
      baseURL: 'https://api.example.com',
      timeout: 50,
      retries: 0,
    });

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation((_, init?: RequestInit) => {
      return new Promise((_, reject) => {
        const signal = init?.signal as AbortSignal;
        signal.addEventListener('abort', () => {
          const err = new Error('aborted by signal');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });

    const request = timeoutClient.get('/slow').catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(60);

    const err = await request;
    expect(err).toMatchObject({
      name: 'TimeoutError',
      isTimeout: true,
    });
  });

  // ── Non-retryable status codes ────────────────────────────────────

  it.each([400, 401, 403, 404])(
    'does not retry on HTTP %i',
    async (status) => {
      const retryClient = createApiClient('retry-test', {
        baseURL: 'https://api.example.com',
        retries: 3,
        retryDelay: 10,
      });

      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status,
        statusText: 'Error',
        json: () => Promise.resolve({}),
        headers: new Headers(),
      });

      await expect(retryClient.get('/no-retry')).rejects.toThrow(`HTTP ${status}`);
      // Should only have been called once (no retries)
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    }
  );

  // ── Retries with exponential backoff ─────────────────────────────

  it('retries on 500 errors with exponential backoff', async () => {
    const retryClient = createApiClient('retry-test', {
      baseURL: 'https://api.example.com',
      retries: 2,
      retryDelay: 100,
    });

    (globalThis.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Server Error',
        json: () => Promise.resolve({ error: 'fail' }),
        headers: new Headers(),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Server Error',
        json: () => Promise.resolve({ error: 'fail' }),
        headers: new Headers(),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({ data: 'ok' }),
        headers: new Headers(),
      });

    const p = retryClient.get('/retry');
    // Advance timer for first retry delay (100 * 2^0 = 100ms)
    await vi.advanceTimersByTimeAsync(100);
    // Advance timer for second retry delay (100 * 2^1 = 200ms)
    await vi.advanceTimersByTimeAsync(200);

    const result = await p;
    expect(result.data).toEqual({ data: 'ok' });
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  // ── Circuit breaker ───────────────────────────────────────────────

  it('getStats returns circuit breaker stats', () => {
    const stats = client.getStats();
    expect(stats).toEqual({ state: 'CLOSED', totalRequests: 0 });
  });

  it('resetCircuitBreaker calls breaker.reset()', () => {
    client.resetCircuitBreaker();
    expect(mocks.mockReset).toHaveBeenCalled();
  });

  // ── Factory and helpers ───────────────────────────────────────────

  describe('createExternalApiClient', () => {
    it('creates a client with specified base URL and headers', async () => {
      const ext = createExternalApiClient('ext', 'https://ext.api.com', {
        Authorization: 'Bearer token',
      });
      await ext.get('/resource');

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toBe('https://ext.api.com/resource');
      expect(fetchCall[1].headers).toMatchObject({
        Authorization: 'Bearer token',
      });
    });
  });

  describe('getApiHealthStatus', () => {
    it('returns all circuit breaker stats', () => {
      const status = getApiHealthStatus();
      expect(status).toEqual({ 'api-test': { state: 'CLOSED' } });
      expect(mocks.mockGetAllStats).toHaveBeenCalled();
    });
  });

  // ── Custom config ─────────────────────────────────────────────────

  it('uses custom circuit breaker config', () => {
    createApiClient('custom-cb', {
      circuitBreaker: { threshold: 10, timeout: 120000, successThreshold: 5 },
    });

    expect(mocks.mockBreakerGet).toHaveBeenCalledWith('api-custom-cb', {
      threshold: 10,
      timeout: 120000,
      successThreshold: 5,
    });
  });

  it('applies default circuit breaker values when partial config given', () => {
    createApiClient('partial-cb', {
      circuitBreaker: {},
    });

    expect(mocks.mockBreakerGet).toHaveBeenCalledWith('api-partial-cb', {
      threshold: 5,
      timeout: 60000,
      successThreshold: 2,
    });
  });

  /* ── Batch 32: branch gap-fill ── */

  it('stripeClient is null when STRIPE_SECRET_KEY is not set', async () => {
    const { stripeClient } = await import('../api-client');
    // STRIPE_SECRET_KEY is not set in test env → should be null
    expect(stripeClient).toBeNull();
  });

  it('createExternalApiClient creates one-off clients', () => {
    const client = createExternalApiClient('test-ext', {
      baseURL: 'https://api.example.com',
      timeout: 5000,
    });
    // Should have standard methods
    expect(client.get).toBeDefined();
    expect(client.post).toBeDefined();
  });

  /* ── Batch 33: branch gap-fill ── */

  it('PUT without body sends undefined body', async () => {
    await client.put('/items/1');
    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[1].body).toBeUndefined();
  });

  it('PATCH without body sends undefined body', async () => {
    await client.patch('/items/1');
    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[1].body).toBeUndefined();
  });

  /* ── Batch 34: branch gap-fill ── */

  it('stripeClient is non-null when STRIPE_SECRET_KEY is set', async () => {
    // L286: stripeClient ternary truthy arm
    const original = process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    vi.resetModules();
    const mod = await import('../api-client');
    expect(mod.stripeClient).not.toBeNull();
    expect(mod.stripeClient!.get).toBeDefined();
    // Restore
    if (original === undefined) {
      delete process.env.STRIPE_SECRET_KEY;
    } else {
      process.env.STRIPE_SECRET_KEY = original;
    }
  });
});
