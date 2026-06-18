import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { SunLifeClient } from '../../../adapters/insurance/sunlife-client';
import { AuthenticationError, RateLimitError, IntegrationError } from '../../../types';

const resp = (body: unknown, init: { status?: number } = {}) => ({
  ok: (init.status ?? 200) >= 200 && (init.status ?? 200) < 300,
  status: init.status ?? 200,
  json: async () => body,
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
});

const tokenResponse = () => resp({ access_token: 'at', refresh_token: 'rt2', expires_in: 3600, token_type: 'Bearer' });
const paged = (key: string, rows: unknown[], hasMore = false) =>
  resp({ [key]: rows, pagination: { page: 1, page_size: 100, total: rows.length, has_more: hasMore } });

const queue: unknown[] = [];
const pushResp = (...r: unknown[]) => queue.push(...r);
let fetchMock: ReturnType<typeof vi.fn>;

const makeClient = (over: Record<string, unknown> = {}) =>
  new SunLifeClient({ clientId: 'cid', clientSecret: 'secret', groupNumber: 'gn1', refreshToken: 'rt', environment: 'sandbox', ...over });

describe('SunLifeClient', () => {
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

  it('authenticate refreshes the token', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    await client.authenticate();
    expect(client.getRefreshToken()).toBe('rt2');
  });

  it('authenticate throws AuthenticationError when refresh fails', async () => {
    const client = makeClient();
    pushResp(resp('bad', { status: 400 }));
    await expect(client.authenticate()).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('refreshAccessToken throws when no token is available', async () => {
    const client = makeClient({ refreshToken: undefined });
    await expect(client.authenticate()).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('getPlans returns paginated plans with nextPage', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(paged('plans', [{ planId: '1' }], true));
    const r = await client.getPlans({ status: 'active' });
    expect(r.data).toHaveLength(1);
    expect(r.nextPage).toBe(2);
  });

  it('getEnrollments returns enrollments', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(paged('enrollments', [{ enrollmentId: '1' }]));
    const r = await client.getEnrollments({ status: 'active', modifiedSince: new Date('2023-01-01') });
    expect(r.data).toHaveLength(1);
  });

  it('getDependents returns dependents', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(paged('dependents', [{ dependentId: '1' }]));
    const r = await client.getDependents({ employeeId: 'e1' });
    expect(r.data).toHaveLength(1);
  });

  it('getCoverage returns coverage', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(paged('coverage', [{ coverageId: '1' }]));
    const r = await client.getCoverage({ employeeId: 'e1', status: 'active' });
    expect(r.data).toHaveLength(1);
  });

  it('request throws RateLimitError on 429', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(resp({}, { status: 429 }));
    await expect(client.getPlans()).rejects.toBeInstanceOf(RateLimitError);
  });

  it('request refreshes and retries on 401', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(resp({}, { status: 401 }));
    pushResp(tokenResponse());
    pushResp(paged('plans', [{ planId: '1' }]));
    const r = await client.getPlans();
    expect(r.data).toHaveLength(1);
  });

  it('request throws AuthenticationError when retry after 401 fails', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(resp({}, { status: 401 }));
    pushResp(tokenResponse());
    pushResp(resp('still bad', { status: 401 }));
    await expect(client.getPlans()).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('request throws IntegrationError on other non-ok', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(resp('boom', { status: 500 }));
    await expect(client.getPlans()).rejects.toBeInstanceOf(IntegrationError);
  });

  it('healthCheck returns true then false', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(resp({ status: 'ok' }));
    expect(await client.healthCheck()).toBe(true);
    const client2 = makeClient({ refreshToken: undefined });
    expect(await client2.healthCheck()).toBe(false);
  });
});
