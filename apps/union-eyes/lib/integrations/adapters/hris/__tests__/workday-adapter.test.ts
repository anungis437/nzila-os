import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const h = vi.hoisted(() => {
  const findFirstQueue: unknown[] = [];
  const findFirst = vi.fn(async () => (findFirstQueue.length ? findFirstQueue.shift() : undefined));
  const tableProxy = new Proxy({}, { get: () => ({ findFirst }) });
  const db = {
    query: tableProxy,
    insert: vi.fn(() => ({ values: vi.fn(async () => ({})) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => ({})) })) })),
    delete: vi.fn(() => ({ where: vi.fn(async () => ({})) })),
  };
  const client: Record<string, ReturnType<typeof vi.fn>> = {};
  return { findFirstQueue, findFirst, db, client };
});

vi.mock('@/db', () => ({ db: h.db }));
vi.mock('@/db/schema', () => new Proxy({}, {
  has: () => true,
  get: (_t, name) => {
    if (name === '__esModule') return false;
    return new Proxy({}, { get: (_o, col) => ({ __col: col }) });
  },
}));
vi.mock('drizzle-orm', () => ({ eq: () => ({}), and: () => ({}) }));
vi.mock('../workday-client', () => ({
  WorkdayClient: class { constructor() { return h.client; } },
}));

import { WorkdayAdapter } from '../workday-adapter';
import { IntegrationType, IntegrationProvider, SyncType } from '../../../types';

const baseConfig = {
  organizationId: 'org-1',
  type: IntegrationType.HRIS,
  provider: IntegrationProvider.WORKDAY,
  credentials: { clientId: 'cid', clientSecret: 'secret', refreshToken: 'rt' },
  settings: { organizationId: 'tenant-1', environment: 'production' },
  enabled: true,
};

const makeConnected = async () => {
  const adapter = new WorkdayAdapter();
  await adapter.initialize(baseConfig);
  await adapter.connect();
  return adapter;
};

describe('WorkdayAdapter', () => {
  beforeEach(() => {
    h.findFirstQueue.length = 0;
    h.findFirst.mockClear();
    h.db.insert.mockClear();
    h.db.update.mockClear();
    Object.assign(h.client, {
      authenticate: vi.fn(async () => {}),
      healthCheck: vi.fn(async () => true),
      getEmployees: vi.fn(async () => ({ data: [], cursor: undefined })),
      getPositions: vi.fn(async () => ({ data: [] })),
      getDepartments: vi.fn(async () => ({ data: [] })),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('connect authenticates and healthCheck is healthy', async () => {
    const adapter = await makeConnected();
    expect(h.client.authenticate).toHaveBeenCalled();
    expect((await adapter.healthCheck()).healthy).toBe(true);
  });

  it('connect rethrows when authentication fails', async () => {
    const adapter = new WorkdayAdapter();
    await adapter.initialize(baseConfig);
    h.client.authenticate = vi.fn(() => Promise.reject(new Error('auth fail')));
    await expect(adapter.connect()).rejects.toThrow('auth fail');
  });

  it('disconnect clears state', async () => {
    const adapter = await makeConnected();
    await adapter.disconnect();
    await expect(adapter.sync({ type: SyncType.FULL })).rejects.toThrow();
  });

  it('healthCheck returns unhealthy on client error', async () => {
    const adapter = await makeConnected();
    h.client.healthCheck = vi.fn(() => Promise.reject(new Error('down')));
    expect((await adapter.healthCheck()).healthy).toBe(false);
  });

  it('sync employees creates and updates records (incremental)', async () => {
    const adapter = await makeConnected();
    h.client.getEmployees = vi.fn(async () => ({
      data: [
        { id: 'e1', employeeID: 'E1', firstName: 'A', lastName: 'B', email: 'a@x.com', phone: '1', position: 'Dev', department: 'Eng', location: 'HQ', hireDate: '2020-01-01', employmentStatus: 'active', workSchedule: 'FT', supervisor: { id: 's1', name: 'Sup' } },
        { id: 'e2', employeeID: 'E2', firstName: 'C', lastName: 'D', email: 'c@x.com', phone: '2', position: 'QA', department: 'Eng', location: 'HQ', hireDate: null, employmentStatus: 'inactive', workSchedule: 'PT' },
      ],
      cursor: undefined,
    }));
    h.findFirstQueue.push({ id: 'existing-1' });
    const r = await adapter.sync({ type: SyncType.INCREMENTAL, orgs: ['employees'] });
    expect(r.recordsUpdated).toBe(1);
    expect(r.recordsCreated).toBe(1);
  });

  it('sync employees counts a per-record failure', async () => {
    const adapter = await makeConnected();
    h.client.getEmployees = vi.fn(async () => ({
      data: [{ id: 'e1', employeeID: 'E1', firstName: 'A', lastName: 'B' }],
      cursor: undefined,
    }));
    h.findFirst.mockImplementationOnce(() => Promise.reject(new Error('db boom')));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['employees'] });
    expect(r.recordsFailed).toBe(1);
  });

  it('sync positions and departments process records', async () => {
    const adapter = await makeConnected();
    h.client.getPositions = vi.fn(async () => ({
      data: [{ id: 'p1', title: 'Dev', description: 'd', department: 'Eng', jobProfile: 'jp', effectiveDate: '2020-01-01' }],
    }));
    h.client.getDepartments = vi.fn(async () => ({
      data: [{ id: 'd1', name: 'Eng', code: 'ENG', manager: { id: 'm1', name: 'Mgr' }, parentDepartment: 'p0' }],
    }));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['positions', 'departments'] });
    expect(r.recordsCreated).toBe(2);
  });

  it('sync logs an unknown entity and records an entity-level error', async () => {
    const adapter = await makeConnected();
    h.client.getEmployees = vi.fn(() => Promise.reject(new Error('entity boom')));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['unknown', 'employees'] });
    expect(r.metadata?.errorMessages?.[0]).toContain('Failed to sync employees');
  });

  it('verifyWebhook returns false and processWebhook throws', async () => {
    const adapter = await makeConnected();
    expect(await adapter.verifyWebhook('p', 's')).toBe(false);
    await expect(adapter.processWebhook({ type: 'x', data: {} } as never)).rejects.toThrow('does not support');
  });
});
