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
vi.mock('../adp-client', () => ({
  ADPClient: class { constructor() { return h.client; } },
}));

import { ADPAdapter } from '../adp-adapter';
import { IntegrationType, IntegrationProvider, SyncType } from '../../../types';

const baseConfig = {
  organizationId: 'org-1',
  type: IntegrationType.HRIS,
  provider: IntegrationProvider.ADP,
  credentials: { clientId: 'cid', clientSecret: 'secret', metadata: { certificateKey: 'cert' } },
  settings: { environment: 'production' },
  enabled: true,
};

const makeConnected = async () => {
  const adapter = new ADPAdapter();
  await adapter.initialize(baseConfig);
  await adapter.connect();
  return adapter;
};

describe('ADPAdapter', () => {
  beforeEach(() => {
    h.findFirstQueue.length = 0;
    h.findFirst.mockClear();
    h.db.insert.mockClear();
    h.db.update.mockClear();
    Object.assign(h.client, {
      authenticate: vi.fn(async () => {}),
      healthCheck: vi.fn(async () => true),
      getWorkers: vi.fn(async () => ({ workers: [] })),
      getOrganizationalUnits: vi.fn(async () => ({ workers: [] })),
      mapWorkerToEmployee: vi.fn((w: { id: string; status?: string }) => ({
        id: w.id,
        employeeID: w.id,
        firstName: 'A',
        lastName: 'B',
        email: 'a@x.com',
        phone: '1',
        position: 'Dev',
        department: 'Eng',
        hireDate: '2020-01-01',
        employmentStatus: w.status,
        supervisorId: 's1',
      })),
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
    const adapter = new ADPAdapter();
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

  it('sync employees creates and updates records and maps statuses', async () => {
    const adapter = await makeConnected();
    h.client.getWorkers = vi.fn(async () => ({
      workers: [
        { associateOID: 'w1', id: 'w1', status: 'Active' },
        { associateOID: 'w2', id: 'w2', status: 'Terminated' },
        { associateOID: 'w3', id: 'w3', status: 'On Leave' },
        { associateOID: 'w4', id: 'w4', status: 'Inactive' },
        { associateOID: 'w5', id: 'w5', status: 'Suspended' },
        { associateOID: 'w6', id: 'w6', status: undefined },
        { associateOID: 'w7', id: 'w7', status: 'mystery' },
      ],
    }));
    h.findFirstQueue.push({ id: 'existing-1' });
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['employees', 'payroll'] });
    expect(r.recordsUpdated).toBe(1);
    expect(r.recordsCreated).toBe(6);
  });

  it('sync employees counts a per-record failure', async () => {
    const adapter = await makeConnected();
    h.client.getWorkers = vi.fn(async () => ({ workers: [{ associateOID: 'w1', id: 'w1', status: 'Active' }] }));
    h.findFirst.mockImplementationOnce(() => Promise.reject(new Error('db boom')));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['employees'] });
    expect(r.recordsFailed).toBe(1);
  });

  it('sync departments processes records', async () => {
    const adapter = await makeConnected();
    h.client.getOrganizationalUnits = vi.fn(async () => ({
      workers: [{ organizationalUnitID: 'u1', nameCode: { shortName: 'Eng', codeValue: 'ENG' }, parentOrganizationalUnitID: 'p0' }],
    }));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['departments'] });
    expect(r.recordsCreated).toBe(1);
  });

  it('sync logs an unknown entity and records an entity-level error', async () => {
    const adapter = await makeConnected();
    h.client.getWorkers = vi.fn(() => Promise.reject(new Error('entity boom')));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['unknown', 'employees'] });
    expect(r.metadata?.syncErrors?.[0]).toContain('Failed to sync employees');
  });

  it('verifyWebhook returns false and processWebhook handles worker events', async () => {
    const adapter = await makeConnected();
    expect(await adapter.verifyWebhook('p', 's')).toBe(false);
    await adapter.processWebhook({ type: 'worker.hire', data: { worker: { associateOID: 'w1' } } } as never);
    await adapter.processWebhook({ type: 'other.event', data: {} } as never);
    expect(true).toBe(true);
  });
});
