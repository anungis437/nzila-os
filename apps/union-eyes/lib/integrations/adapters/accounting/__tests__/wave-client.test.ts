import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WaveClient } from '../../../adapters/accounting/wave-client';
import { AuthenticationError, RateLimitError, IntegrationError } from '../../../types';

const resp = (body: unknown, init: { status?: number } = {}) => ({
  ok: (init.status ?? 200) >= 200 && (init.status ?? 200) < 300,
  status: init.status ?? 200,
  json: async () => body,
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
});

const tokenResponse = () =>
  resp({ access_token: 'at', refresh_token: 'rt2', token_type: 'Bearer', expires_in: 3600 });

// GraphQL data envelope
const gql = (data: unknown, errors?: unknown) => resp(errors ? { errors } : { data });

const queue: unknown[] = [];
const pushResp = (...r: unknown[]) => queue.push(...r);
let fetchMock: ReturnType<typeof vi.fn>;

const makeClient = (over: Record<string, unknown> = {}) =>
  new WaveClient({
    clientId: 'cid',
    clientSecret: 'secret',
    businessId: 'biz1',
    accessToken: 'existing-at',
    refreshToken: 'existing-rt',
    tokenExpiry: new Date(Date.now() + 60 * 60 * 1000),
    ...over,
  });

describe('WaveClient', () => {
  beforeEach(() => {
    queue.length = 0;
    fetchMock = vi.fn(async () => {
      const next = queue.length ? queue.shift() : resp({ data: {} });
      if (next instanceof Error) throw next;
      return next as Response;
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('authenticate refreshes and exposes the refresh token', async () => {
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

  it('getInvoices maps edges and computes hasMore from pageInfo', async () => {
    const client = makeClient();
    pushResp(
      gql({
        business: {
          invoices: {
            pageInfo: { currentPage: 1, totalPages: 3 },
            edges: [{ node: { id: 'i1', invoiceNumber: 'INV-1' } }],
          },
        },
      })
    );
    const result = await client.getInvoices({ page: 1, pageSize: 50 });
    expect(result.invoices).toHaveLength(1);
    expect(result.hasMore).toBe(true);
  });

  it('getCustomers maps currency code with USD fallback', async () => {
    const client = makeClient();
    pushResp(
      gql({
        business: {
          customers: {
            pageInfo: { currentPage: 1, totalPages: 1 },
            edges: [
              { node: { id: 'c1', name: 'A', currency: { code: 'CAD' } } },
              { node: { id: 'c2', name: 'B' } },
            ],
          },
        },
      })
    );
    const result = await client.getCustomers();
    expect(result.customers[0].currency).toBe('CAD');
    expect(result.customers[1].currency).toBe('USD');
    expect(result.hasMore).toBe(false);
  });

  it('getPayments filters to invoice-linked transactions', async () => {
    const client = makeClient();
    pushResp(
      gql({
        business: {
          moneyTransactions: {
            pageInfo: { currentPage: 1, totalPages: 1 },
            edges: [
              { node: { id: 'p1', invoice: { id: 'i1' } } },
              { node: { id: 'p2' } },
            ],
          },
        },
      })
    );
    const result = await client.getPayments();
    expect(result.payments).toHaveLength(1);
    expect(result.payments[0].id).toBe('p1');
  });

  it('graphql throws RateLimitError on 429', async () => {
    const client = makeClient();
    pushResp(resp({}, { status: 429 }));
    await expect(client.getInvoices()).rejects.toBeInstanceOf(RateLimitError);
  });

  it('graphql refreshes and retries on 401', async () => {
    const client = makeClient();
    pushResp(resp({}, { status: 401 })); // first attempt
    pushResp(tokenResponse()); // refresh
    pushResp(
      gql({ business: { invoices: { pageInfo: { currentPage: 1, totalPages: 1 }, edges: [] } } })
    );
    const result = await client.getInvoices();
    expect(result.invoices).toHaveLength(0);
  });

  it('graphql throws IntegrationError on non-ok response', async () => {
    const client = makeClient();
    pushResp(resp('boom', { status: 500 }));
    await expect(client.getInvoices()).rejects.toBeInstanceOf(IntegrationError);
  });

  it('graphql throws IntegrationError when GraphQL errors are present', async () => {
    const client = makeClient();
    pushResp(gql(null, [{ message: 'bad query' }]));
    await expect(client.getInvoices()).rejects.toBeInstanceOf(IntegrationError);
  });

  it('graphql wraps a network error as IntegrationError', async () => {
    const client = makeClient();
    pushResp(new Error('socket'));
    await expect(client.getInvoices()).rejects.toBeInstanceOf(IntegrationError);
  });

  it('ensureValidToken refreshes when near expiry', async () => {
    const client = makeClient({ tokenExpiry: new Date(Date.now() + 60 * 1000) });
    pushResp(tokenResponse());
    pushResp(gql({ business: { invoices: { pageInfo: { currentPage: 1, totalPages: 1 }, edges: [] } } }));
    await client.getInvoices();
    expect(client.getRefreshToken()).toBe('rt2');
  });

  it('healthCheck returns true then false', async () => {
    const client = makeClient();
    pushResp(gql({ user: { id: 'u1' } }));
    expect(await client.healthCheck()).toBe(true);
    pushResp(new Error('down'));
    expect(await client.healthCheck()).toBe(false);
  });
});
