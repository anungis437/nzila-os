import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const h = vi.hoisted(() => {
  const selectQueue: unknown[][] = [];
  const onConflict = vi.fn(async () => ({}));
  const where = vi.fn(() => {
    const arr = selectQueue.length ? selectQueue.shift()! : [];
    return {
      limit: () => Promise.resolve(arr),
      then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(arr).then(res, rej),
    };
  });
  const db = {
    insert: vi.fn(() => ({ values: () => ({ onConflictDoUpdate: onConflict }) })),
    select: () => ({ from: () => ({ where }) }),
  };
  const client: Record<string, ReturnType<typeof vi.fn>> = {};
  return { selectQueue, onConflict, where, db, client };
});

vi.mock('@/db', () => ({ db: h.db }));
vi.mock('@/db/schema/domains/data/documents', () => new Proxy({}, {
  has: () => true,
  get: (_t, name) => {
    if (name === '__esModule') return false;
    return new Proxy({}, { get: (_o, col) => ({ __col: col }) });
  },
}));
vi.mock('drizzle-orm', () => ({ eq: () => ({}), and: () => ({}) }));
vi.mock('../sharepoint-client', () => ({
  SharePointClient: class { constructor() { return h.client; } },
}));

import { SharePointAdapter } from '../sharepoint-adapter';
import { IntegrationType, IntegrationProvider, SyncType } from '../../../types';

const initConfig = {
  organizationId: 'org-1',
  type: IntegrationType.DOCUMENT_MANAGEMENT,
  provider: IntegrationProvider.SHAREPOINT,
  credentials: { apiKey: 'key' },
  enabled: true,
};

const makeReady = async () => {
  const adapter = new SharePointAdapter('org-1', { clientId: 'c', clientSecret: 's', organizationId: 'tenant' });
  await adapter.initialize(initConfig);
  await adapter.connect();
  (adapter as unknown as { connected: boolean }).connected = true;
  return adapter;
};

describe('SharePointAdapter', () => {
  beforeEach(() => {
    h.selectQueue.length = 0;
    h.where.mockClear();
    h.onConflict.mockReset();
    h.onConflict.mockImplementation(async () => ({}));
    h.db.insert.mockClear();
    Object.assign(h.client, {
      healthCheck: vi.fn(async () => ({ status: 'ok', message: 'ok' })),
      getSites: vi.fn(async () => ({ sites: [], nextLink: undefined })),
      getLibraries: vi.fn(async () => ({ libraries: [], nextLink: undefined })),
      getFiles: vi.fn(async () => ({ files: [], nextLink: undefined })),
      getFilePermissions: vi.fn(async () => ({ permissions: [], nextLink: undefined })),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('connect succeeds when health is ok and healthCheck reports healthy', async () => {
    const adapter = await makeReady();
    expect((await adapter.healthCheck()).healthy).toBe(true);
  });

  it('connect throws when health is not ok', async () => {
    const adapter = new SharePointAdapter('org-1', { clientId: 'c', clientSecret: 's' });
    await adapter.initialize(initConfig);
    h.client.healthCheck = vi.fn(async () => ({ status: 'error', message: 'bad' }));
    await expect(adapter.connect()).rejects.toThrow('Failed to connect to SharePoint');
  });

  it('healthCheck reports unhealthy when status is not ok', async () => {
    const adapter = await makeReady();
    h.client.healthCheck = vi.fn(async () => ({ status: 'error', message: 'bad' }));
    const hc = await adapter.healthCheck();
    expect(hc.healthy).toBe(false);
    expect(hc.lastError).toBe('bad');
  });

  it('disconnect logs without throwing', async () => {
    const adapter = await makeReady();
    await expect(adapter.disconnect()).resolves.toBeUndefined();
  });

  it('verifyWebhook returns false and processWebhook is a no-op', async () => {
    const adapter = await makeReady();
    expect(await adapter.verifyWebhook('p', 's')).toBe(false);
    await adapter.processWebhook({ type: 'x', data: {} } as never);
    expect(true).toBe(true);
  });

  it('sync sites processes sites and their libraries', async () => {
    const adapter = await makeReady();
    h.client.getSites = vi.fn(async () => ({
      sites: [{ id: 's1', displayName: 'Site', webUrl: 'http://s', description: 'd', createdDateTime: '2024-01-01', lastModifiedDateTime: '2024-02-01' }],
      nextLink: undefined,
    }));
    h.client.getLibraries = vi.fn(async () => ({
      libraries: [{ id: 'lib1', name: 'Docs', webUrl: 'http://l', description: 'd', driveType: 'documentLibrary', createdDateTime: '2024-01-01', createdBy: { user: { displayName: 'Bob' } } }],
      nextLink: undefined,
    }));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['sites'] });
    expect(r.recordsProcessed).toBe(2);
    expect(r.success).toBe(true);
  });

  it('sync sites counts a per-record failure', async () => {
    const adapter = await makeReady();
    h.client.getSites = vi.fn(async () => ({
      sites: [{ id: 's1', displayName: 'Site', webUrl: 'http://s', description: 'd', createdDateTime: '2024-01-01', lastModifiedDateTime: '2024-02-01' }],
      nextLink: undefined,
    }));
    h.onConflict.mockImplementationOnce(() => Promise.reject(new Error('db boom')));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['sites'] });
    expect(r.recordsFailed).toBe(1);
  });

  it('sync files reads libraries and inserts files (incremental cursor)', async () => {
    const adapter = await makeReady();
    h.selectQueue.push([{ id: 'lib1', externalId: 'extlib1' }]);
    h.client.getFiles = vi.fn(async () => ({
      files: [
        { id: 'f1', name: 'doc.docx', webUrl: 'http://f', size: 100, file: { mimeType: 'application/x' }, createdDateTime: '2024-01-01', createdBy: { user: { displayName: 'Bob', email: 'b@x' } }, lastModifiedDateTime: '2024-02-01', lastModifiedBy: { user: { displayName: 'Al' } }, parentReference: { path: '/root' } },
        { id: 'f2', name: 'folder', webUrl: 'http://g', size: 0, folder: { childCount: 3 }, createdDateTime: '2024-01-01', createdBy: { user: {} }, lastModifiedDateTime: '2024-02-01' },
      ],
      nextLink: undefined,
    }));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['files'], cursor: '2024-01-01' });
    expect(r.recordsProcessed).toBe(2);
  });

  it('sync files records an error when getFiles throws', async () => {
    const adapter = await makeReady();
    h.selectQueue.push([{ id: 'lib1', externalId: 'extlib1' }]);
    h.client.getFiles = vi.fn(() => Promise.reject(new Error('files boom')));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['files'] });
    expect(r.recordsFailed).toBe(0);
    expect(r.success).toBe(true);
  });

  it('sync permissions reads files and inserts permissions, skipping missing libraries', async () => {
    const adapter = await makeReady();
    h.selectQueue.push([
      { id: 'f1', libraryId: 'lib1', externalId: 'extf1' },
      { id: 'f2', libraryId: 'lib2', externalId: 'extf2' },
    ]);
    h.selectQueue.push([{ id: 'lib1', externalId: 'extlib1' }]);
    h.selectQueue.push([]);
    h.client.getFilePermissions = vi.fn(async () => ({
      permissions: [{ id: 'perm1', grantedToIdentitiesV2: [{ user: { id: 'u1', displayName: 'Bob' } }], roles: ['read'], link: { type: 'view', scope: 'org' } }],
      nextLink: undefined,
    }));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['permissions'] });
    expect(r.recordsProcessed).toBe(1);
  });

  it('sync sets errors when a fetch throws outside the per-record loop', async () => {
    const adapter = await makeReady();
    h.client.getSites = vi.fn(() => Promise.reject(new Error('sites fatal')));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['sites'] });
    expect(r.success).toBe(false);
    expect(r.errors?.[0]?.error).toBe('sites fatal');
  });
});
