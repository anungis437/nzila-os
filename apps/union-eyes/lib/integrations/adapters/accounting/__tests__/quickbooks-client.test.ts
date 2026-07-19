import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { QuickBooksClient } from '../../../adapters/accounting/quickbooks-client';
import { AuthenticationError, RateLimitError, IntegrationError } from '../../../types';

const json = (body: unknown, init: { status?: number } = {}) => ({
  ok: (init.status ?? 200) >= 200 && (init.status ?? 200) < 300,
  status: init.status ?? 200,
  json: async () => body,
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
});

const tokenResponse = () =>
  json({ access_token: 'at', refresh_token: 'rt2', token_type: 'Bearer', expires_in: 3600, x_refresh_token_expires_in: 8000 });

const queue: unknown[] = [];
const pushResp = (...r: unknown[]) => queue.push(...r);
let fetchMock: ReturnType<typeof vi.fn>;

const makeClient = (over: Record<string, unknown> = {}) =>
  new QuickBooksClient({
    clientId: 'cid',
    clientSecret: 'secret',
    realmId: 'realm1',
    environment: 'sandbox',
    refreshToken: 'rt',
    ...over,
  });

const qr = (key: string, rows: unknown[]) => json({ QueryResponse: { [key]: rows, startPosition: 1, maxResults: rows.length } });

describe('QuickBooksClient', () => {
  beforeEach(() => {
    queue.length = 0;
    fetchMock = vi.fn(async () => {
      const next = queue.length ? queue.shift() : json({});
      if (next instanceof Error) throw next;
      return next as Response;
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('authenticate succeeds and exposes the refresh token', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    await client.authenticate();
    expect(client.getRefreshToken()).toBe('rt2');
  });

  it('authenticate throws without a refresh token', async () => {
    const client = makeClient({ refreshToken: undefined });
    await expect(client.authenticate()).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('authenticate throws on non-ok token response', async () => {
    const client = makeClient();
    pushResp(json('bad', { status: 401 }));
    await expect(client.authenticate()).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('authenticate wraps a network error', async () => {
    const client = makeClient();
    pushResp(new Error('net'));
    await expect(client.authenticate()).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('getInvoices returns invoices and hasMore when full page', async () => {
    const client = makeClient();
    pushResp(tokenResponse()); // ensureAuthenticated
    const invoices = Array.from({ length: 5 }, (_, i) => ({ Id: `${i}` }));
    pushResp(qr('Invoice', invoices));
    const result = await client.getInvoices({ limit: 5, offset: 0, modifiedSince: new Date('2023-01-01') });
    expect(result.invoices).toHaveLength(5);
    expect(result.hasMore).toBe(true);
  });

  it('getCustomers returns customers', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(qr('Customer', [{ Id: 'c1' }]));
    const result = await client.getCustomers({ limit: 100 });
    expect(result.customers).toHaveLength(1);
    expect(result.hasMore).toBe(false);
  });

  it('getPayments returns payments', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(qr('Payment', [{ Id: 'p1' }]));
    const result = await client.getPayments({ modifiedSince: new Date('2023-06-01') });
    expect(result.payments).toHaveLength(1);
  });

  it('getAccounts returns accounts', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(qr('Account', [{ Id: 'a1' }]));
    const result = await client.getAccounts();
    expect(result.accounts).toHaveLength(1);
  });

  it('request throws RateLimitError on 429', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(json({}, { status: 429 }));
    await expect(client.getAccounts()).rejects.toBeInstanceOf(RateLimitError);
  });

  it('request throws IntegrationError on non-ok', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(json('err', { status: 500 }));
    await expect(client.getAccounts()).rejects.toBeInstanceOf(IntegrationError);
  });

  it('request wraps a network error as IntegrationError', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(new Error('socket'));
    await expect(client.getAccounts()).rejects.toBeInstanceOf(IntegrationError);
  });

  it('healthCheck returns true on success, false on failure', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(qr('Account', []));
    expect(await client.healthCheck()).toBe(true);
    const client2 = makeClient({ refreshToken: undefined });
    expect(await client2.healthCheck()).toBe(false);
  });
});
