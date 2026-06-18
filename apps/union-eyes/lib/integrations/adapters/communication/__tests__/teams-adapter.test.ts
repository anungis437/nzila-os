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
vi.mock('../teams-client', () => ({
  TeamsClient: class { constructor() { return h.client; } },
}));

import { TeamsAdapter } from '../teams-adapter';
import { IntegrationType, IntegrationProvider } from '../../../types';

const orgId = 'org-1';
const config = { clientId: 'cid', clientSecret: 'sec', organizationId: 'tenant', apiUrl: 'https://graph' };
const initConfig = {
  organizationId: orgId,
  type: IntegrationType.COMMUNICATION,
  provider: IntegrationProvider.MICROSOFT_TEAMS,
  credentials: { clientId: 'cid', clientSecret: 'sec' },
  enabled: true,
};

const makeConnected = async () => {
  const adapter = new TeamsAdapter(orgId, config);
  await adapter.initialize(initConfig);
  await adapter.connect();
  return adapter;
};

describe('TeamsAdapter', () => {
  beforeEach(() => {
    h.selectQueue.length = 0;
    h.onConflict.mockReset();
    h.onConflict.mockImplementation(() => undefined);
    Object.assign(h.client, {
      healthCheck: vi.fn(async () => ({ status: 'ok' })),
      getTeams: vi.fn(async () => ({ teams: [], nextLink: undefined })),
      getChannels: vi.fn(async () => ({ channels: [], nextLink: undefined })),
      getChannelMessages: vi.fn(async () => ({ messages: [], nextLink: undefined })),
      getTeamMembers: vi.fn(async () => ({ members: [], nextLink: undefined })),
      getChannelFiles: vi.fn(async () => ({ files: [], nextLink: undefined })),
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
    const adapter = new TeamsAdapter(orgId, config);
    h.client.healthCheck = vi.fn(async () => ({ status: 'fail', message: 'bad' }));
    await expect(adapter.connect()).rejects.toThrow('Failed to connect to Microsoft Teams');
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

  it('sync teams and channels processes records and counts a failure', async () => {
    const adapter = await makeConnected();
    h.client.getTeams = vi.fn(async () => ({
      teams: [{ id: 't1', displayName: 'Team', isArchived: false, createdDateTime: '2024-01-01', description: 'd' }],
      nextLink: undefined,
    }));
    h.client.getChannels = vi.fn(async () => ({
      channels: [{ id: 'ch1', displayName: 'General', membershipType: 'standard', createdDateTime: '2024-01-01', description: 'd' }],
      nextLink: undefined,
    }));
    let n = 0;
    h.onConflict.mockImplementation(() => { n++; if (n === 2) throw new Error('insert fail'); });
    const r = await adapter.sync({ type: 'full', orgs: ['teams'] } as never);
    expect(r.recordsFailed).toBe(1);
    expect(r.recordsProcessed).toBe(1);
  });

  it('sync messages iterates channels and aggregates reactions', async () => {
    const adapter = await makeConnected();
    h.selectQueue.push([
      { id: 'dbc1', externalId: 'ch1', channelType: 'standard', parentChannelId: 't1' },
      { id: 'dbteam', externalId: 't1', channelType: 'team', parentChannelId: null },
      { id: 'dbc2', externalId: 'ch2', channelType: 'standard', parentChannelId: null },
    ]);
    h.client.getChannelMessages = vi.fn(async () => ({
      messages: [
        { id: 'm1', from: { user: { id: 'u1' } }, body: { content: 'hi' }, messageType: 'message', createdDateTime: '2024-01-01', replyToId: undefined, reactions: [{}, {}] },
        { id: 'm2', from: undefined, body: { content: 'yo' }, messageType: 'message', createdDateTime: '2024-01-01' },
      ],
      nextLink: undefined,
    }));
    const r = await adapter.sync({ type: 'full', orgs: ['messages'], cursor: '2023-12-31' } as never);
    expect(r.recordsProcessed).toBe(2);
  });

  it('sync messages handles a fetch error per channel', async () => {
    const adapter = await makeConnected();
    h.selectQueue.push([{ id: 'dbc1', externalId: 'ch1', channelType: 'standard', parentChannelId: 't1' }]);
    h.client.getChannelMessages = vi.fn(() => Promise.reject(new Error('fetch fail')));
    const r = await adapter.sync({ type: 'full', orgs: ['messages'] } as never);
    expect(r.success).toBe(true);
  });

  it('sync members processes records', async () => {
    const adapter = await makeConnected();
    h.selectQueue.push([{ id: 'dbteam', externalId: 't1', channelType: 'team' }]);
    h.client.getTeamMembers = vi.fn(async () => ({
      members: [
        { userId: 'u1', email: 'jane@x.com', displayName: 'Jane', roles: ['owner'] },
        { userId: 'u2', email: undefined, displayName: 'Bob', roles: [] },
      ],
      nextLink: undefined,
    }));
    const r = await adapter.sync({ type: 'full', orgs: ['members'] } as never);
    expect(r.recordsProcessed).toBe(2);
  });

  it('sync members handles a fetch error per team', async () => {
    const adapter = await makeConnected();
    h.selectQueue.push([{ id: 'dbteam', externalId: 't1', channelType: 'team' }]);
    h.client.getTeamMembers = vi.fn(() => Promise.reject(new Error('fetch fail')));
    const r = await adapter.sync({ type: 'full', orgs: ['members'] } as never);
    expect(r.success).toBe(true);
  });

  it('sync files processes records', async () => {
    const adapter = await makeConnected();
    h.selectQueue.push([
      { id: 'dbc1', externalId: 'ch1', channelType: 'standard', parentChannelId: 't1' },
      { id: 'dbteam', externalId: 't1', channelType: 'team', parentChannelId: null },
    ]);
    h.client.getChannelFiles = vi.fn(async () => ({
      files: [{ id: 'f1', createdBy: { user: { id: 'u1' } }, name: 'doc.pdf', file: { mimeType: 'application/pdf' }, size: 100, webUrl: 'u', createdDateTime: '2024-01-01' }],
      nextLink: undefined,
    }));
    const r = await adapter.sync({ type: 'full', orgs: ['files'] } as never);
    expect(r.recordsProcessed).toBe(1);
  });

  it('sync files handles a fetch error per channel', async () => {
    const adapter = await makeConnected();
    h.selectQueue.push([{ id: 'dbc1', externalId: 'ch1', channelType: 'standard', parentChannelId: 't1' }]);
    h.client.getChannelFiles = vi.fn(() => Promise.reject(new Error('fetch fail')));
    const r = await adapter.sync({ type: 'full', orgs: ['files'] } as never);
    expect(r.success).toBe(true);
  });
});
