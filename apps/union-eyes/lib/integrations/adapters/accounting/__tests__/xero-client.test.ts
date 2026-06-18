import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { XeroClient } from '../../../adapters/accounting/xero-client';
import { AuthenticationError, RateLimitError, IntegrationError } from '../../../types';

// Response-like helpers for the fetch queue
const json = (body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) => ({
  ok: (init.status ?? 200) >= 200 && (init.status ?? 200) < 300,
  status: init.status ?? 200,
  headers: { get: (k: string) => init.headers?.[k] ?? null },
  json: async () => body,
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
});

const tokenResponse = () =>
  json({ access_token: 'at', refresh_token: 'rt2', expires_in: 1800, token_type: 'Bearer' });

let fetchMock: ReturnType<typeof vi.fn>;

const queue: unknown[] = [];
const pushResp = (...r: unknown[]) => queue.push(...r);

const makeClient = (over: Record<string, unknown> = {}) =>
  new XeroClient({
    clientId: 'cid',
    clientSecret: 'secret',
    tenantId: 'tenant1',
    accessToken: 'existing-at',
    refreshToken: 'existing-rt',
    tokenExpiry: new Date(Date.now() + 60 * 60 * 1000),
    ...over,
  });

describe('XeroClient', () => {
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

  it('authenticate refreshes the access token', async () => {
    const client = makeClient({ accessToken: undefined, tokenExpiry: undefined });
    pushResp(tokenResponse());
    await client.authenticate();
    expect(client.getAccessToken()).toBe('at');
    expect(client.getRefreshToken()).toBe('rt2');
    expect(client.getTokenExpiry()).toBeInstanceOf(Date);
  });

  it('authenticate throws when no refresh token is available', async () => {
    const client = makeClient({ refreshToken: undefined });
    await expect(client.authenticate()).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('refreshAccessToken throws on a non-ok token response', async () => {
    const client = makeClient({ accessToken: undefined, tokenExpiry: undefined });
    pushResp(json('bad creds', { status: 400 }));
    await expect(client.authenticate()).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('refreshAccessToken wraps a network error as AuthenticationError', async () => {
    const client = makeClient({ accessToken: undefined, tokenExpiry: undefined });
    pushResp(new Error('network down'));
    await expect(client.authenticate()).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('getInvoices returns invoices and hasMore=true at 100 rows', async () => {
    const client = makeClient();
    const invoices = Array.from({ length: 100 }, (_, i) => ({ InvoiceID: `${i}` }));
    pushResp(json({ Invoices: invoices }));
    const result = await client.getInvoices({ page: 1, type: 'ACCREC', modifiedSince: new Date() });
    expect(result.invoices).toHaveLength(100);
    expect(result.hasMore).toBe(true);
  });

  it('getInvoice returns the first invoice', async () => {
    const client = makeClient();
    pushResp(json({ Invoices: [{ InvoiceID: 'i1' }] }));
    const inv = await client.getInvoice('i1');
    expect(inv.InvoiceID).toBe('i1');
  });

  it('getContacts returns contacts with hasMore=false under 100', async () => {
    const client = makeClient();
    pushResp(json({ Contacts: [{ ContactID: 'c1' }] }));
    const result = await client.getContacts({ page: 2, modifiedSince: new Date() });
    expect(result.contacts).toHaveLength(1);
    expect(result.hasMore).toBe(false);
  });

  it('getContact returns the first contact', async () => {
    const client = makeClient();
    pushResp(json({ Contacts: [{ ContactID: 'c1' }] }));
    const c = await client.getContact('c1');
    expect(c.ContactID).toBe('c1');
  });

  it('getPayments returns payments', async () => {
    const client = makeClient();
    pushResp(json({ Payments: [{ PaymentID: 'p1' }] }));
    const result = await client.getPayments({ page: 1, modifiedSince: new Date() });
    expect(result.payments).toHaveLength(1);
    expect(result.hasMore).toBe(false);
  });

  it('getAccounts returns accounts', async () => {
    const client = makeClient();
    pushResp(json({ Accounts: [{ AccountID: 'a1' }] }));
    const result = await client.getAccounts({ page: 1 });
    expect(result.accounts).toHaveLength(1);
  });

  it('getAccount returns the first account', async () => {
    const client = makeClient();
    pushResp(json({ Accounts: [{ AccountID: 'a1' }] }));
    const a = await client.getAccount('a1');
    expect(a.AccountID).toBe('a1');
  });

  it('request throws RateLimitError on 429', async () => {
    const client = makeClient();
    pushResp(json({}, { status: 429, headers: { 'Retry-After': '30' } }));
    await expect(client.getAccounts()).rejects.toBeInstanceOf(RateLimitError);
  });

  it('request retries on 401 then succeeds after refresh', async () => {
    const client = makeClient();
    pushResp(json({}, { status: 401 })); // first request -> 401
    pushResp(tokenResponse()); // refreshAccessToken
    pushResp(json({ Accounts: [{ AccountID: 'a1' }] })); // retry succeeds
    const result = await client.getAccounts();
    expect(result.accounts).toHaveLength(1);
  });

  it('request throws IntegrationError on a non-ok response', async () => {
    const client = makeClient();
    pushResp(json('server error', { status: 500 }));
    await expect(client.getAccounts()).rejects.toBeInstanceOf(IntegrationError);
  });

  it('request wraps a network error as IntegrationError', async () => {
    const client = makeClient();
    pushResp(new Error('socket hang up'));
    await expect(client.getAccounts()).rejects.toBeInstanceOf(IntegrationError);
  });

  it('ensureValidToken refreshes when the token is near expiry', async () => {
    const client = makeClient({ tokenExpiry: new Date(Date.now() + 60 * 1000) });
    pushResp(tokenResponse()); // refresh
    pushResp(json({ Accounts: [] })); // request
    await client.getAccounts();
    expect(client.getAccessToken()).toBe('at');
  });

  it('healthCheck returns true on success and false on failure', async () => {
    const client = makeClient();
    pushResp(json({ Accounts: [] }));
    expect(await client.healthCheck()).toBe(true);
    pushResp(new Error('boom'));
    expect(await client.healthCheck()).toBe(false);
  });
});
