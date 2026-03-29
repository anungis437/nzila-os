// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockExecute: vi.fn(),
  mockBreakerGet: vi.fn(),
}));

vi.mock('../circuit-breaker', () => ({
  circuitBreakers: {
    get: mocks.mockBreakerGet.mockReturnValue({
      execute: mocks.mockExecute,
      getStats: vi.fn().mockReturnValue({ state: 'CLOSED', totalRequests: 0 }),
      reset: vi.fn(),
    }),
  },
  CIRCUIT_BREAKERS: {
    EXTERNAL_API: { threshold: 5, timeout: 60000, successThreshold: 2 },
  },
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { createApiClient } from '../api-client';

describe('api-client', () => {
  let client: ReturnType<typeof createApiClient>;

  beforeEach(() => {
    vi.clearAllMocks();
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

    client = createApiClient('test-api', { baseURL: 'https://api.example.com' });
  });

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

  it('PUT sends body as JSON', async () => {
    await client.put('/items/1', { name: 'updated' });
    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[1].method).toBe('PUT');
  });

  it('DELETE makes request', async () => {
    await client.delete('/items/1');
    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[1].method).toBe('DELETE');
  });

  it('getStats returns circuit breaker stats', () => {
    const stats = client.getStats();
    expect(stats).toEqual({ state: 'CLOSED', totalRequests: 0 });
  });
});
