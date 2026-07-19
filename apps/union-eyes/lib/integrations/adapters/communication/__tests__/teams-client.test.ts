import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TeamsClient } from '../../../adapters/communication/teams-client';

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

const makeClient = () => new TeamsClient({ clientId: 'cid', clientSecret: 'secret', tenantId: 't1' });

const expectRejectName = async (p: Promise<unknown>, name: string) => {
  await expect(p).rejects.toMatchObject({ name });
};

describe('TeamsClient', () => {
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

  it('getTeams authenticates then returns teams', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(value([{ id: 't1', displayName: 'Acme' }], 'next'));
    const r = await client.getTeams({ top: 10 });
    expect(r.teams).toHaveLength(1);
    expect(r.nextLink).toBe('next');
  });

  it('getTeams follows a skipToken endpoint', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(value([{ id: 't2', displayName: 'B' }]));
    const r = await client.getTeams({ skipToken: 'https://graph.microsoft.com/v1.0/teams?$skiptoken=abc' });
    expect(r.teams).toHaveLength(1);
  });

  it('getChannels returns channels', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(value([{ id: 'c1', displayName: 'General' }]));
    const r = await client.getChannels('t1', { top: 5 });
    expect(r.channels).toHaveLength(1);
  });

  it('getChannelMessages returns messages with a filter', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(value([{ id: 'm1' }]));
    const r = await client.getChannelMessages('t1', 'c1', { top: 50, filter: "lastModifiedDateTime gt 2024-01-01T00:00:00Z" });
    expect(r.messages).toHaveLength(1);
  });

  it('getTeamMembers returns members', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(value([{ id: 'mem1', displayName: 'Jane', userId: 'u1' }]));
    const r = await client.getTeamMembers('t1', { skipToken: 'https://graph.microsoft.com/v1.0/teams/t1/members?$skiptoken=z' });
    expect(r.members).toHaveLength(1);
  });

  it('getChannelFiles returns files', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(value([{ id: 'f1', name: 'a.docx' }]));
    const r = await client.getChannelFiles('t1', 'c1', { top: 10 });
    expect(r.files).toHaveLength(1);
  });

  it('authenticate throws AuthenticationError on a non-ok token response', async () => {
    const client = makeClient();
    pushResp(resp('bad', { status: 401 }));
    await expectRejectName(client.getTeams(), 'AuthenticationError');
  });

  it('authenticate wraps a network error as AuthenticationError', async () => {
    const client = makeClient();
    pushResp(new Error('net'));
    await expectRejectName(client.getTeams(), 'AuthenticationError');
  });

  it('request throws RateLimitError on 429', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(resp({}, { status: 429, headers: { 'Retry-After': '30' } }));
    await expectRejectName(client.getTeams(), 'RateLimitError');
  });

  it('request throws AuthenticationError on 401', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(resp('unauthorized', { status: 401 }));
    await expectRejectName(client.getTeams(), 'AuthenticationError');
  });

  it('request throws IntegrationError on other non-ok', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(resp('boom', { status: 500 }));
    await expectRejectName(client.getTeams(), 'IntegrationError');
  });

  it('request wraps a network error as IntegrationError', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(new Error('socket'));
    await expectRejectName(client.getTeams(), 'IntegrationError');
  });

  it('healthCheck returns ok then error', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(value([{ id: 't1', displayName: 'Acme' }]));
    expect((await client.healthCheck()).status).toBe('ok');
    const client2 = makeClient();
    pushResp(resp('bad', { status: 401 }));
    expect((await client2.healthCheck()).status).toBe('error');
  });
});
