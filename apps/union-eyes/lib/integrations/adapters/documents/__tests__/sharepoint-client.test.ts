import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SharePointClient } from '../../../adapters/documents/sharepoint-client';

const resp = (body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) => ({
  ok: (init.status ?? 200) >= 200 && (init.status ?? 200) < 300,
  status: init.status ?? 200,
  headers: { get: (k: string) => init.headers?.[k] ?? null },
  json: async () => body,
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
});

const tokenResponse = () => resp({ access_token: 'at', token_type: 'Bearer', expires_in: 3600 });
const value = (rows: unknown[], nextLink?: string) => resp({ value: rows, '@odata.nextLink': nextLink });

const queue: unknown[] = [];
const pushResp = (...r: unknown[]) => queue.push(...r);
let fetchMock: ReturnType<typeof vi.fn>;

const makeClient = () => new SharePointClient({ clientId: 'cid', clientSecret: 'secret', tenantId: 't1' });

const expectRejectName = async (p: Promise<unknown>, name: string) => {
  await expect(p).rejects.toMatchObject({ name });
};

describe('SharePointClient', () => {
  beforeEach(() => {
    queue.length = 0;
    fetchMock = vi.fn(async () => {
      const next = queue.length ? queue.shift() : resp({ value: [] });
      if (next instanceof Error) throw next;
      return next as Response;
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getSites authenticates then returns sites', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(value([{ id: 's1', displayName: 'Site' }], 'next'));
    const r = await client.getSites({ top: 10 });
    expect(r.sites).toHaveLength(1);
    expect(r.nextLink).toBe('next');
  });

  it('getSites follows a skipToken endpoint', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(value([{ id: 's2' }]));
    const r = await client.getSites({ skipToken: 'https://graph.microsoft.com/v1.0/sites?$skiptoken=abc' });
    expect(r.sites).toHaveLength(1);
  });

  it('getLibraries returns libraries', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(value([{ id: 'l1', name: 'Docs' }]));
    const r = await client.getLibraries('s1', { top: 5 });
    expect(r.libraries).toHaveLength(1);
  });

  it('getFiles returns files with a filter', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(value([{ id: 'f1', name: 'a.docx' }]));
    const r = await client.getFiles('d1', { top: 50, filter: "lastModifiedDateTime gt 2024-01-01T00:00:00Z" });
    expect(r.files).toHaveLength(1);
  });

  it('getFilePermissions returns permissions', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(value([{ id: 'p1', roles: ['read'] }]));
    const r = await client.getFilePermissions('d1', 'i1', { skipToken: 'https://graph.microsoft.com/v1.0/drives/d1/items/i1/permissions?$skiptoken=z' });
    expect(r.permissions).toHaveLength(1);
  });

  it('authenticate throws AuthenticationError on a non-ok token response', async () => {
    const client = makeClient();
    pushResp(resp('bad', { status: 401 }));
    await expectRejectName(client.getSites(), 'AuthenticationError');
  });

  it('authenticate wraps a network error as AuthenticationError', async () => {
    const client = makeClient();
    pushResp(new Error('net'));
    await expectRejectName(client.getSites(), 'AuthenticationError');
  });

  it('request throws RateLimitError on 429', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(resp({}, { status: 429, headers: { 'Retry-After': '30' } }));
    await expectRejectName(client.getSites(), 'RateLimitError');
  });

  it('request throws AuthenticationError on 401', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(resp('unauthorized', { status: 401 }));
    await expectRejectName(client.getSites(), 'AuthenticationError');
  });

  it('request throws IntegrationError on other non-ok', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(resp('boom', { status: 500 }));
    await expectRejectName(client.getSites(), 'IntegrationError');
  });

  it('request wraps a network error as IntegrationError', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(new Error('socket'));
    await expectRejectName(client.getSites(), 'IntegrationError');
  });

  it('healthCheck returns ok then error', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(value([{ id: 's1' }]));
    expect((await client.healthCheck()).status).toBe('ok');
    const client2 = makeClient();
    pushResp(resp('bad', { status: 401 }));
    expect((await client2.healthCheck()).status).toBe('error');
  });
});
