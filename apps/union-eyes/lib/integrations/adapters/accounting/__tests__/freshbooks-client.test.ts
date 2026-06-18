import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FreshBooksClient } from '../../../adapters/accounting/freshbooks-client';
import { AuthenticationError, RateLimitError, IntegrationError } from '../../../types';

const resp = (body: unknown, init: { status?: number } = {}) => ({
  ok: (init.status ?? 200) >= 200 && (init.status ?? 200) < 300,
  status: init.status ?? 200,
  json: async () => body,
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
});

const tokenResponse = () =>
  resp({ access_token: 'at', refresh_token: 'rt2', token_type: 'Bearer', expires_in: 3600 });

const result = (key: string, rows: unknown[], pages = 1) =>
  resp({ response: { result: { [key]: rows, per_page: 100, pages } } });

const queue: unknown[] = [];
const pushResp = (...r: unknown[]) => queue.push(...r);
let fetchMock: ReturnType<typeof vi.fn>;

const makeClient = (over: Record<string, unknown> = {}) =>
  new FreshBooksClient({
    clientId: 'cid',
    clientSecret: 'secret',
    accountId: 'acc1',
    accessToken: 'existing-at',
    refreshToken: 'existing-rt',
    tokenExpiry: new Date(Date.now() + 60 * 60 * 1000),
    ...over,
  });

describe('FreshBooksClient', () => {
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

  it('authenticate refreshes and exposes refresh token', async () => {
    const client = makeClient({ accessToken: undefined, tokenExpiry: undefined });
    pushResp(tokenResponse());
    await client.authenticate();
    expect(client.getRefreshToken()).toBe('rt2');
  });

  it('authenticate throws when no refresh token', async () => {
    const client = makeClient({ refreshToken: undefined });
    await expect(client.authenticate()).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('refreshAccessToken throws on non-ok token response', async () => {
    const client = makeClient({ accessToken: undefined, tokenExpiry: undefined });
    pushResp(resp('bad', { status: 400 }));
    await expect(client.authenticate()).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('refreshAccessToken wraps a network error', async () => {
    const client = makeClient({ accessToken: undefined, tokenExpiry: undefined });
    pushResp(new Error('net'));
    await expect(client.authenticate()).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('getInvoices returns invoices and hasMore from pages', async () => {
    const client = makeClient();
    pushResp(result('invoices', [{ id: 1 }], 3));
    const r = await client.getInvoices({ page: 1, perPage: 100, updatedSince: new Date('2023-01-01') });
    expect(r.invoices).toHaveLength(1);
    expect(r.hasMore).toBe(true);
  });

  it('getClients returns clients', async () => {
    const client = makeClient();
    pushResp(result('clients', [{ id: 1 }], 1));
    const r = await client.getClients({ page: 1 });
    expect(r.clients).toHaveLength(1);
    expect(r.hasMore).toBe(false);
  });

  it('getPayments returns payments', async () => {
    const client = makeClient();
    pushResp(result('payments', [{ id: 1 }]));
    const r = await client.getPayments();
    expect(r.payments).toHaveLength(1);
  });

  it('getExpenses returns expenses', async () => {
    const client = makeClient();
    pushResp(result('expenses', [{ id: 1 }]));
    const r = await client.getExpenses();
    expect(r.expenses).toHaveLength(1);
  });

  it('request throws RateLimitError on 429', async () => {
    const client = makeClient();
    pushResp(resp({}, { status: 429 }));
    await expect(client.getClients()).rejects.toBeInstanceOf(RateLimitError);
  });

  it('request refreshes and retries on 401', async () => {
    const client = makeClient();
    pushResp(resp({}, { status: 401 }));
    pushResp(tokenResponse());
    pushResp(result('clients', [{ id: 1 }]));
    const r = await client.getClients();
    expect(r.clients).toHaveLength(1);
  });

  it('request throws IntegrationError on non-ok', async () => {
    const client = makeClient();
    pushResp(resp('boom', { status: 500 }));
    await expect(client.getClients()).rejects.toBeInstanceOf(IntegrationError);
  });

  it('request wraps a network error as IntegrationError', async () => {
    const client = makeClient();
    pushResp(new Error('socket'));
    await expect(client.getClients()).rejects.toBeInstanceOf(IntegrationError);
  });

  it('ensureValidToken refreshes when near expiry', async () => {
    const client = makeClient({ tokenExpiry: new Date(Date.now() + 60 * 1000) });
    pushResp(tokenResponse());
    pushResp(result('clients', []));
    await client.getClients();
    expect(client.getRefreshToken()).toBe('rt2');
  });

  it('healthCheck returns true then false', async () => {
    const client = makeClient();
    pushResp(result('clients', []));
    expect(await client.healthCheck()).toBe(true);
    pushResp(new Error('down'));
    expect(await client.healthCheck()).toBe(false);
  });
});
