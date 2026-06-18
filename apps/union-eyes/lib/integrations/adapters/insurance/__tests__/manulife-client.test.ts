import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { ManulifeClient } from '../../../adapters/insurance/manulife-client';
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
  new ManulifeClient({ clientId: 'cid', clientSecret: 'secret', policyGroupId: 'pg1', refreshToken: 'rt', environment: 'sandbox', ...over });

describe('ManulifeClient', () => {
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

  it('getClaims returns paginated claims with nextPage', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(paged('claims', [{ claimId: '1' }], true));
    const r = await client.getClaims({ page: 1, pageSize: 100, status: 'paid', modifiedSince: new Date('2023-01-01') });
    expect(r.data).toHaveLength(1);
    expect(r.hasMore).toBe(true);
    expect(r.nextPage).toBe(2);
  });

  it('getPolicies returns policies', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(paged('policies', [{ policyId: '1' }]));
    const r = await client.getPolicies({ status: 'active' });
    expect(r.data).toHaveLength(1);
    expect(r.nextPage).toBeUndefined();
  });

  it('getBeneficiaries returns beneficiaries', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(paged('beneficiaries', [{ beneficiaryId: '1' }]));
    const r = await client.getBeneficiaries({ employeeId: 'e1' });
    expect(r.data).toHaveLength(1);
  });

  it('getUtilization returns utilization', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(paged('utilization', [{ utilizationId: '1' }]));
    const r = await client.getUtilization({ employeeId: 'e1' });
    expect(r.data).toHaveLength(1);
  });

  it('request throws RateLimitError on 429', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(resp({}, { status: 429 }));
    await expect(client.getPolicies()).rejects.toBeInstanceOf(RateLimitError);
  });

  it('request refreshes and retries on 401', async () => {
    const client = makeClient();
    pushResp(tokenResponse()); // initial auth
    pushResp(resp({}, { status: 401 })); // first request -> 401
    pushResp(tokenResponse()); // authenticate again
    pushResp(paged('policies', [{ policyId: '1' }])); // retry succeeds
    const r = await client.getPolicies();
    expect(r.data).toHaveLength(1);
  });

  it('request throws AuthenticationError when retry after 401 fails', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(resp({}, { status: 401 }));
    pushResp(tokenResponse());
    pushResp(resp('still bad', { status: 401 }));
    await expect(client.getPolicies()).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('request throws IntegrationError on other non-ok', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(resp('boom', { status: 500 }));
    await expect(client.getPolicies()).rejects.toBeInstanceOf(IntegrationError);
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
