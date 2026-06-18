import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { GreenShieldClient } from '../../../adapters/insurance/greenshield-client';
import { AuthenticationError, RateLimitError, IntegrationError } from '../../../errors';

const resp = (body: unknown, init: { status?: number; statusText?: string; headers?: Record<string, string> } = {}) => ({
  ok: (init.status ?? 200) >= 200 && (init.status ?? 200) < 300,
  status: init.status ?? 200,
  statusText: init.statusText ?? 'OK',
  headers: { get: (k: string) => init.headers?.[k] ?? null },
  json: async () => body,
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
});

const tokenResponse = () => resp({ access_token: 'at', refresh_token: 'rt2', expires_in: 3600 });

const queue: unknown[] = [];
const pushResp = (...r: unknown[]) => queue.push(...r);
let fetchMock: ReturnType<typeof vi.fn>;

const makeClient = (over: Record<string, unknown> = {}) =>
  new GreenShieldClient({ clientId: 'cid', clientSecret: 'secret', groupNumber: 'gn1', refreshToken: 'rt', environment: 'sandbox', ...over });

describe('GreenShieldClient', () => {
  beforeEach(() => {
    queue.length = 0;
    fetchMock = vi.fn(async () => {
      const next = queue.length ? queue.shift() : resp({});
      if (next instanceof Error) throw next;
      return next as Response;
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('authenticate stores the refresh token', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    await client.authenticate();
    expect(client.getRefreshToken()).toBe('rt2');
  });

  it('authenticate (client_credentials) works without a refresh token', async () => {
    const client = makeClient({ refreshToken: undefined });
    pushResp(tokenResponse());
    await client.authenticate();
    expect(client.getRefreshToken()).toBe('rt2');
  });

  it('authenticate throws AuthenticationError on non-ok response', async () => {
    const client = makeClient();
    pushResp(resp('bad', { status: 401 }));
    await expect(client.authenticate()).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('authenticate wraps a network error as AuthenticationError', async () => {
    const client = makeClient();
    pushResp(new Error('net'));
    await expect(client.authenticate()).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('getPlans returns plans', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(resp({ plans: [{ planId: '1' }] }));
    const r = await client.getPlans(1, 100, new Date('2023-01-01'));
    expect(r).toHaveLength(1);
  });

  it('getEnrollments returns enrollments', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(resp({ enrollments: [{ enrollmentId: '1' }] }));
    const r = await client.getEnrollments(1, 100, new Date('2023-01-01'));
    expect(r).toHaveLength(1);
  });

  it('getClaims returns claims', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(resp({ claims: [{ claimId: '1' }] }));
    const r = await client.getClaims(1, 100, new Date('2023-01-01'));
    expect(r).toHaveLength(1);
  });

  it('getCoverage returns coverage', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(resp({ coverage: [{ coverageId: '1' }] }));
    const r = await client.getCoverage();
    expect(r).toHaveLength(1);
  });

  it('makeRequest throws RateLimitError on 429', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(resp({}, { status: 429, headers: { 'Retry-After': '30' } }));
    await expect(client.getPlans()).rejects.toBeInstanceOf(RateLimitError);
  });

  it('makeRequest throws AuthenticationError on 401', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(resp('unauthorized', { status: 401 }));
    await expect(client.getPlans()).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('makeRequest throws IntegrationError on other non-ok', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(resp('boom', { status: 500, statusText: 'Server Error' }));
    await expect(client.getPlans()).rejects.toBeInstanceOf(IntegrationError);
  });

  it('healthCheck returns true then false', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(resp({ status: 'ok' }));
    expect(await client.healthCheck()).toBe(true);
    const client2 = makeClient();
    pushResp(resp('bad', { status: 500 }));
    expect(await client2.healthCheck()).toBe(false);
  });
});
