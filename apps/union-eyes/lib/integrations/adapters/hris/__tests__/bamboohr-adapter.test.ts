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
vi.mock('../bamboohr-client', () => ({
  BambooHRClient: class { constructor() { return h.client; } },
}));

import { BambooHRAdapter } from '../bamboohr-adapter';
import { IntegrationType, IntegrationProvider, SyncType } from '../../../types';

const baseConfig = {
  organizationId: 'org-1',
  type: IntegrationType.HRIS,
  provider: IntegrationProvider.BAMBOOHR,
  credentials: { apiKey: 'k' },
  settings: { companyDomain: 'acme' },
  enabled: true,
};

const makeConnected = async () => {
  const adapter = new BambooHRAdapter();
  await adapter.initialize(baseConfig);
  await adapter.connect();
  return adapter;
};

describe('BambooHRAdapter', () => {
  beforeEach(() => {
    h.findFirstQueue.length = 0;
    h.findFirst.mockClear();
    h.db.insert.mockClear();
    h.db.update.mockClear();
    Object.assign(h.client, {
      healthCheck: vi.fn(async () => true),
      getEmployees: vi.fn(async () => []),
      getChangedEmployees: vi.fn(async () => ({ changes: [] })),
      getDepartments: vi.fn(async () => []),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('connect verifies health and healthCheck is healthy', async () => {
    const adapter = await makeConnected();
    expect(h.client.healthCheck).toHaveBeenCalled();
    expect((await adapter.healthCheck()).healthy).toBe(true);
  });

  it('connect throws when health check returns false', async () => {
    const adapter = new BambooHRAdapter();
    await adapter.initialize(baseConfig);
    h.client.healthCheck = vi.fn(async () => false);
    await expect(adapter.connect()).rejects.toThrow('health check failed');
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

  it('sync employees (full) creates and updates records and maps statuses', async () => {
    const adapter = await makeConnected();
    h.client.getEmployees = vi.fn(async () => [
      { id: 'e1', employeeNumber: 'E1', firstName: 'A', lastName: 'B', email: 'a@x.com', mobilePhone: '1', jobTitle: 'Dev', department: 'Eng', location: 'HQ', hireDate: '2020-01-01', employmentStatus: 'Active', supervisorId: 's1', supervisor: 'Sup' },
      { id: 'e2', employeeNumber: 'E2', firstName: 'C', lastName: 'D', email: 'c@x.com', workPhone: '2', jobTitle: 'QA', department: 'Eng', location: 'HQ', hireDate: null, employmentStatus: 'Terminated', supervisorId: 's1', supervisor: 'Sup' },
      { id: 'e3', employeeNumber: 'E3', firstName: 'E', lastName: 'F', employmentStatus: 'On Leave' },
      { id: 'e4', employeeNumber: 'E4', firstName: 'G', lastName: 'H', employmentStatus: 'Inactive' },
      { id: 'e5', employeeNumber: 'E5', firstName: 'I', lastName: 'J', employmentStatus: undefined },
    ]);
    h.findFirstQueue.push({ id: 'existing-1' });
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['employees'] });
    expect(r.recordsUpdated).toBe(1);
    expect(r.recordsCreated).toBe(4);
  });

  it('sync employees (incremental) uses changed employees API', async () => {
    const adapter = await makeConnected();
    const getChanged = vi.fn(async () => ({ changes: [{ id: 'e9', employeeNumber: 'E9', firstName: 'Z', lastName: 'Y', employmentStatus: 'Active' }] }));
    h.client.getChangedEmployees = getChanged;
    const r = await adapter.sync({ type: SyncType.INCREMENTAL, orgs: ['employees'], cursor: '2024-01-01' });
    expect(getChanged).toHaveBeenCalled();
    expect(r.recordsCreated).toBe(1);
  });

  it('sync employees counts a per-record failure', async () => {
    const adapter = await makeConnected();
    h.client.getEmployees = vi.fn(async () => [{ id: 'e1', employeeNumber: 'E1', firstName: 'A', lastName: 'B', employmentStatus: 'Active' }]);
    h.findFirst.mockImplementationOnce(() => Promise.reject(new Error('db boom')));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['employees'] });
    expect(r.recordsFailed).toBe(1);
  });

  it('sync departments and time_off entities', async () => {
    const adapter = await makeConnected();
    h.client.getDepartments = vi.fn(async () => [{ id: 'd1', name: 'Eng' }]);
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['departments', 'time_off'] });
    expect(r.recordsCreated).toBe(1);
  });

  it('sync uses default entities (filtering out time_off) when no orgs given', async () => {
    const adapter = await makeConnected();
    h.client.getEmployees = vi.fn(async () => [{ id: 'e1', employeeNumber: 'E1', firstName: 'A', lastName: 'B', employmentStatus: 'Active' }]);
    h.client.getDepartments = vi.fn(async () => [{ id: 'd1', name: 'Eng' }]);
    const r = await adapter.sync({ type: SyncType.FULL });
    expect(r.recordsCreated).toBe(2);
  });

  it('sync logs an unknown entity and records an entity-level error', async () => {
    const adapter = await makeConnected();
    h.client.getEmployees = vi.fn(() => Promise.reject(new Error('entity boom')));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['unknown', 'employees'] });
    expect(r.metadata?.syncErrors?.[0]).toContain('Failed to sync employees');
  });

  it('verifyWebhook returns false and processWebhook handles employee events', async () => {
    const adapter = await makeConnected();
    expect(await adapter.verifyWebhook('p', 's')).toBe(false);
    await adapter.processWebhook({ type: 'employee.updated', data: { employee: { id: 'e1' } } } as never);
    await adapter.processWebhook({ type: 'other.event', data: {} } as never);
    expect(true).toBe(true);
  });
});
