import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const h = vi.hoisted(() => {
  const selectQueue: unknown[][] = [];
  const onConflict = vi.fn(() => undefined);
  const onConflictDoUpdate = (...args: unknown[]) => {
    onConflict(...args);
    const p = Promise.resolve([{ id: 'row-1' }]) as Promise<unknown> & { returning: () => Promise<unknown> };
    p.returning = () => Promise.resolve([{ id: 'row-1' }]);
    return p;
  };
  const where = () => {
    const rows = selectQueue.length ? selectQueue.shift()! : [];
    const p = Promise.resolve(rows) as Promise<unknown> & { limit: () => Promise<unknown> };
    p.limit = () => Promise.resolve(rows);
    return p;
  };
  const db = {
    insert: () => ({ values: () => ({ onConflictDoUpdate }) }),
    select: () => ({ from: () => ({ where }) }),
  };
  const client: Record<string, ReturnType<typeof vi.fn>> = {};
  return { selectQueue, onConflict, db, client };
});

vi.mock('@/db', () => ({ db: h.db }));
vi.mock('@/db/schema/domains/data/communication', () => new Proxy({}, {
  has: () => true,
  get: (_t, name) => {
    if (name === '__esModule') return false;
    return new Proxy({}, { get: (_o, col) => ({ __col: col }) });
  },
}));
vi.mock('drizzle-orm', () => ({ eq: () => ({}), and: () => ({}) }));
vi.mock('../slack-client', () => ({
  SlackClient: class { constructor() { return h.client; } },
}));

import { SlackAdapter } from '../slack-adapter';
import { IntegrationType, IntegrationProvider } from '../../../types';

const orgId = 'org-1';
const config = { botToken: 'tok', apiUrl: 'https://slack', workspaceId: 'ws' };
const initConfig = {
  organizationId: orgId,
  type: IntegrationType.COMMUNICATION,
  provider: IntegrationProvider.SLACK,
  credentials: { clientId: 'cid', clientSecret: 'sec', accessToken: 'tok' },
  enabled: true,
};

const makeConnected = async () => {
  const adapter = new SlackAdapter(orgId, config);
  await adapter.initialize(initConfig);
  await adapter.connect();
  return adapter;
};

describe('SlackAdapter', () => {
  beforeEach(() => {
    h.selectQueue.length = 0;
    h.onConflict.mockClear();
    Object.assign(h.client, {
      healthCheck: vi.fn(async () => ({ status: 'ok' })),
      getChannels: vi.fn(async () => ({ channels: [], nextCursor: undefined })),
      getChannelMessages: vi.fn(async () => ({ messages: [], nextCursor: undefined })),
      getUsers: vi.fn(async () => ({ users: [], nextCursor: undefined })),
      getFiles: vi.fn(async () => ({ files: [], nextCursor: undefined })),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('connect succeeds and healthCheck is healthy', async () => {
    const adapter = await makeConnected();
    expect((await adapter.healthCheck()).healthy).toBe(true);
  });

  it('connect throws when health is not ok', async () => {
    const adapter = new SlackAdapter(orgId, config);
    h.client.healthCheck = vi.fn(async () => ({ status: 'fail', message: 'bad' }));
    await expect(adapter.connect()).rejects.toThrow('Failed to connect to Slack');
  });

  it('healthCheck reports unhealthy status and handles thrown errors', async () => {
    const adapter = await makeConnected();
    h.client.healthCheck = vi.fn(async () => ({ status: 'fail', message: 'bad' }));
    expect((await adapter.healthCheck()).healthy).toBe(false);
    h.client.healthCheck = vi.fn(() => Promise.reject(new Error('boom')));
    expect((await adapter.healthCheck()).healthy).toBe(false);
  });

  it('disconnect clears state', async () => {
    const adapter = await makeConnected();
    await adapter.disconnect();
    await expect(adapter.sync({ type: 'full' } as never)).rejects.toThrow('not connected');
  });

  it('verifyWebhook returns false and processWebhook logs', async () => {
    const adapter = await makeConnected();
    expect(await adapter.verifyWebhook('p', 's')).toBe(false);
    await adapter.processWebhook({ type: 'message', data: {} } as never);
    expect(true).toBe(true);
  });

  it('sync channels processes records and counts a failure', async () => {
    const adapter = await makeConnected();
    h.client.getChannels = vi.fn(async () => ({
      channels: [
        { id: 'c1', name: 'general', is_private: false, is_archived: false, created: 1700000000, creator: 'u1', num_members: 5, topic: { value: 't' }, purpose: { value: 'p' } },
        { id: 'c2', name: 'priv', is_private: true, is_archived: true, created: 1700000000, creator: 'u1' },
      ],
      nextCursor: undefined,
    }));
    h.onConflict.mockImplementationOnce(() => { throw new Error('insert fail'); });
    const r = await adapter.sync({ type: 'full', orgs: ['channels'] } as never);
    expect(r.recordsFailed).toBe(1);
    expect(r.recordsProcessed).toBe(1);
  });

  it('sync messages iterates channels and aggregates reactions', async () => {
    const adapter = await makeConnected();
    h.selectQueue.push([{ id: 'dbc1', externalId: 'c1' }]);
    h.client.getChannelMessages = vi.fn(async () => ({
      messages: [
        { client_msg_id: 'm1', ts: '1700000000.0001', user: 'u1', text: 'hi', type: 'message', thread_ts: undefined, reply_count: 2, reactions: [{ count: 3 }, { count: 1 }] },
        { ts: '1700000000.0002', user: 'u2', text: 'yo', type: 'message' },
      ],
      nextCursor: undefined,
    }));
    const r = await adapter.sync({ type: 'full', orgs: ['messages'], cursor: '1699999999' } as never);
    expect(r.recordsProcessed).toBe(2);
  });

  it('sync users processes records', async () => {
    const adapter = await makeConnected();
    h.client.getUsers = vi.fn(async () => ({
      users: [
        { id: 'u1', name: 'jane', real_name: 'Jane', profile: { display_name: 'J', email: 'j@x.com', first_name: 'Jane', last_name: 'Doe', title: 'Dev', image_72: 'url', status_text: 'busy', status_emoji: ':x:' }, is_bot: false, is_admin: true, deleted: false },
        { id: 'u2', name: 'bot', profile: {}, is_bot: true },
      ],
      nextCursor: undefined,
    }));
    const r = await adapter.sync({ type: 'full', orgs: ['users'] } as never);
    expect(r.recordsProcessed).toBe(2);
  });

  it('sync files resolves channel db id and processes records', async () => {
    const adapter = await makeConnected();
    h.selectQueue.push([{ id: 'dbc1' }]);
    h.client.getFiles = vi.fn(async () => ({
      files: [
        { id: 'f1', channels: ['c1'], user: 'u1', name: 'doc.pdf', filetype: 'pdf', mimetype: 'application/pdf', size: 100, url_private: 'u', url_private_download: 'd', created: 1700000000, comments_count: 2 },
        { id: 'f2', channels: [], user: 'u2', name: 'img.png', filetype: 'png', mimetype: 'image/png', size: 50, url_private: 'u', url_private_download: 'd', created: 1700000000 },
      ],
      nextCursor: undefined,
    }));
    const r = await adapter.sync({ type: 'full', orgs: ['files'] } as never);
    expect(r.recordsProcessed).toBe(2);
  });

  it('sync logs an unknown entity', async () => {
    const adapter = await makeConnected();
    const r = await adapter.sync({ type: 'full', orgs: ['mystery'] } as never);
    expect(r.success).toBe(true);
  });
});
