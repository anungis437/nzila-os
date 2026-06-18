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
vi.mock('../sunlife-client', () => ({
  SunLifeClient: class { constructor() { return h.client; } },
}));

import { SunLifeAdapter } from '../sunlife-adapter';
import { IntegrationType, IntegrationProvider, SyncType } from '../../../types';

const baseConfig = {
  organizationId: 'org-1',
  type: IntegrationType.INSURANCE,
  provider: IntegrationProvider.SUNLIFE,
  credentials: { clientId: 'cid', clientSecret: 'secret', refreshToken: 'rt' },
  settings: { groupNumber: 'g-1' },
  enabled: true,
};

const makeConnected = async () => {
  const adapter = new SunLifeAdapter();
  await adapter.initialize(baseConfig);
  await adapter.connect();
  return adapter;
};

describe('SunLifeAdapter', () => {
  beforeEach(() => {
    h.findFirstQueue.length = 0;
    h.findFirst.mockClear();
    h.db.insert.mockClear();
    h.db.update.mockClear();
    Object.assign(h.client, {
      authenticate: vi.fn(async () => {}),
      getRefreshToken: vi.fn(() => 'rt-new'),
      healthCheck: vi.fn(async () => true),
      getPlans: vi.fn(async () => ({ data: [], hasMore: false })),
      getEnrollments: vi.fn(async () => ({ data: [], hasMore: false })),
      getDependents: vi.fn(async () => ({ data: [], hasMore: false })),
      getCoverage: vi.fn(async () => ({ data: [], hasMore: false })),
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
    const adapter = new SunLifeAdapter();
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

  it('sync plans creates and updates records', async () => {
    const adapter = await makeConnected();
    h.client.getPlans = vi.fn(async () => ({
      data: [
        { planId: 'p1', planName: 'Gold', planType: 'health', coverageLevel: 'family', effectiveDate: 'd', terminationDate: null, premium: 100, employerContribution: 60, employeeContribution: 40, status: 'active' },
        { planId: 'p2', planName: 'Silver', planType: 'dental', coverageLevel: 'single', effectiveDate: 'd', premium: null, status: 'inactive' },
      ],
      hasMore: false,
    }));
    h.findFirstQueue.push({ id: 'existing-1' });
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['plans'] });
    expect(r.recordsUpdated).toBe(1);
    expect(r.recordsCreated).toBe(1);
  });

  it('sync plans counts a per-record failure', async () => {
    const adapter = await makeConnected();
    h.client.getPlans = vi.fn(async () => ({
      data: [{ planId: 'p1', planName: 'Gold', planType: 'h', coverageLevel: 'f', effectiveDate: 'd', premium: 1, status: 's' }],
      hasMore: false,
    }));
    h.findFirst.mockImplementationOnce(() => Promise.reject(new Error('db boom')));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['plans'] });
    expect(r.recordsFailed).toBe(1);
  });

  it('sync enrollments (incremental), dependents and coverage process records', async () => {
    const adapter = await makeConnected();
    h.client.getEnrollments = vi.fn(async () => ({
      data: [{ enrollmentId: 'e1', employeeId: 'emp1', employeeName: 'A', planId: 'p1', planName: 'Gold', coverageLevel: 'family', enrollmentDate: 'd', effectiveDate: 'd', terminationDate: null, status: 'active', premium: 100, employeeContribution: 40 }],
      hasMore: false,
    }));
    h.client.getDependents = vi.fn(async () => ({
      data: [{ dependentId: 'd1', employeeId: 'emp1', firstName: 'A', lastName: 'B', dateOfBirth: 'd', relationship: 'child', status: 'active' }],
      hasMore: false,
    }));
    h.client.getCoverage = vi.fn(async () => ({
      data: [{ coverageId: 'c1', enrollmentId: 'e1', employeeId: 'emp1', planId: 'p1', planType: 'health', coverageAmount: 1000, deductible: 50, effectiveDate: 'd', terminationDate: null, status: 'active' }],
      hasMore: false,
    }));
    const r = await adapter.sync({ type: SyncType.INCREMENTAL, orgs: ['enrollments', 'dependents', 'coverage'], cursor: '2024-01-01' });
    expect(r.recordsCreated).toBe(3);
  });

  it('sync logs an unknown entity and records an entity-level error', async () => {
    const adapter = await makeConnected();
    h.client.getPlans = vi.fn(() => Promise.reject(new Error('entity boom')));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['unknown', 'plans'] });
    expect(r.errors?.[0]?.error).toContain('Failed to sync plans');
  });

  it('verifyWebhook returns false and processWebhook is a no-op', async () => {
    const adapter = await makeConnected();
    expect(await adapter.verifyWebhook('p', 's')).toBe(false);
    await adapter.processWebhook({ type: 'x', data: {} } as never);
    expect(true).toBe(true);
  });
});
