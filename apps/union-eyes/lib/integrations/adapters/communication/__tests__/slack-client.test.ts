import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SlackClient } from '../../../adapters/communication/slack-client';

const resp = (body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) => ({
  ok: (init.status ?? 200) >= 200 && (init.status ?? 200) < 300,
  status: init.status ?? 200,
  headers: { get: (k: string) => init.headers?.[k] ?? null },
  json: async () => body,
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
});

const queue: unknown[] = [];
const pushResp = (...r: unknown[]) => queue.push(...r);
let fetchMock: ReturnType<typeof vi.fn>;

const makeClient = () => new SlackClient({ botToken: 'xoxb-1', workspaceId: 'w1' });

const expectRejectName = async (p: Promise<unknown>, name: string) => {
  await expect(p).rejects.toMatchObject({ name });
};

describe('SlackClient', () => {
  beforeEach(() => {
    queue.length = 0;
    fetchMock = vi.fn(async () => {
      const next = queue.length ? queue.shift() : resp({ ok: true });
      if (next instanceof Error) throw next;
      return next as Response;
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getChannels returns channels and next cursor', async () => {
    const client = makeClient();
    pushResp(resp({ ok: true, channels: [{ id: 'c1', name: 'general' }], response_metadata: { next_cursor: 'cur' } }));
    const r = await client.getChannels({ cursor: 'x', limit: 100, excludeArchived: true });
    expect(r.channels).toHaveLength(1);
    expect(r.nextCursor).toBe('cur');
  });

  it('getChannelMessages returns messages', async () => {
    const client = makeClient();
    pushResp(resp({ ok: true, messages: [{ type: 'message', text: 'hi', user: 'u1', ts: '1' }] }));
    const r = await client.getChannelMessages('c1', { cursor: 'x', limit: 50, oldest: '1', latest: '2' });
    expect(r.messages).toHaveLength(1);
  });

  it('getUsers returns members', async () => {
    const client = makeClient();
    pushResp(resp({ ok: true, members: [{ id: 'u1', name: 'jane', team_id: 't1' }] }));
    const r = await client.getUsers({ cursor: 'x', limit: 100 });
    expect(r.users).toHaveLength(1);
  });

  it('getFiles returns files', async () => {
    const client = makeClient();
    pushResp(resp({ ok: true, files: [{ id: 'f1', name: 'a.pdf' }] }));
    const r = await client.getFiles({ cursor: 'x', limit: 10, channel: 'c1', user: 'u1', tsFrom: '1', tsTo: '2' });
    expect(r.files).toHaveLength(1);
    expect(r.nextCursor).toBeUndefined();
  });

  it('postMessage returns the posted message', async () => {
    const client = makeClient();
    pushResp(resp({ ok: true, message: { type: 'message', text: 'hi', user: 'bot', ts: '1' } }));
    const m = await client.postMessage('c1', 'hi', { threadTs: '0' });
    expect(m.text).toBe('hi');
  });

  it('getWorkspaceInfo returns the team', async () => {
    const client = makeClient();
    pushResp(resp({ ok: true, team: { id: 't1', name: 'Acme', domain: 'acme' } }));
    const t = await client.getWorkspaceInfo();
    expect(t.name).toBe('Acme');
  });

  it('request throws RateLimitError on 429', async () => {
    const client = makeClient();
    pushResp(resp({}, { status: 429, headers: { 'X-Rate-Limit-Reset': '1700000000' } }));
    await expectRejectName(client.getChannels(), 'RateLimitError');
  });

  it('request throws AuthenticationError on 401', async () => {
    const client = makeClient();
    pushResp(resp('unauthorized', { status: 401 }));
    await expectRejectName(client.getChannels(), 'AuthenticationError');
  });

  it('request throws IntegrationError on other non-ok', async () => {
    const client = makeClient();
    pushResp(resp('boom', { status: 500 }));
    await expectRejectName(client.getChannels(), 'IntegrationError');
  });

  it('request throws AuthenticationError on invalid_auth body error', async () => {
    const client = makeClient();
    pushResp(resp({ ok: false, error: 'invalid_auth' }));
    await expectRejectName(client.getChannels(), 'AuthenticationError');
  });

  it('request throws IntegrationError on other body error', async () => {
    const client = makeClient();
    pushResp(resp({ ok: false, error: 'channel_not_found' }));
    await expectRejectName(client.getChannels(), 'IntegrationError');
  });

  it('request wraps a network error as IntegrationError', async () => {
    const client = makeClient();
    pushResp(new Error('socket'));
    await expectRejectName(client.getChannels(), 'IntegrationError');
  });

  it('healthCheck returns ok on success and error on failure', async () => {
    const client = makeClient();
    pushResp(resp({ ok: true }));
    expect((await client.healthCheck()).status).toBe('ok');
    pushResp(resp('unauthorized', { status: 401 }));
    expect((await client.healthCheck()).status).toBe('error');
  });
});
